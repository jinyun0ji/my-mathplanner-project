const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const functions = require('firebase-functions');

const STAFF_ROLES = new Set(['admin', 'staff', 'teacher', 'teaching', 'staffOrTeaching']);
const VIEWER_ROLES = new Set(['student', 'parent']);

const db = getFirestore();

const normalizeRole = (role) => {
    const raw = String(role || '').trim();
    if (!raw) return null;
    if (raw === 'teaching' || raw === 'staffOrTeaching') return 'teacher';
    return raw;
};

const roleFromDoc = (userData = {}) => normalizeRole(userData.role || null);

const getUserProfileByAuthUid = async (authUid) => {
    if (!authUid || typeof authUid !== 'string') return null;

    const indexSnapshot = await db.collection('userAuthIndex').doc(authUid).get();
    const profileDocId = indexSnapshot.exists ? indexSnapshot.data()?.userDocId : authUid;
    if (!profileDocId) return null;

    const userSnapshot = await db.collection('users').doc(profileDocId).get();
    if (!userSnapshot.exists) return null;

    const data = userSnapshot.data() || {};
    const userRole = roleFromDoc(data);

    return {
        authUid,
        userDocId: profileDocId,
        role: userRole,
        name: data.name || data.displayName || data.studentName || data.parentName || '',
        data,
    };
};

const assertStaffLikeCaller = async (context) => {
    const uid = context?.auth?.uid;
    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const caller = await getUserProfileByAuthUid(uid);
    const callerRole = normalizeRole(caller?.role);
    if (!caller || !callerRole || !STAFF_ROLES.has(callerRole)) {
        throw new functions.https.HttpsError('permission-denied', '운영자 권한이 필요합니다.');
    }

    return { ...caller, role: callerRole };
};

const getDirectRoomId = (uidA, uidB) => {
    return `direct__${[uidA, uidB].sort().join('__')}`;
};

const applyRoomMetadata = ({
    caller,
    target,
    now,
    targetRoleHint,
    targetUserDocIdHint,
    targetNameHint,
    studentIdHint,
    parentIdHint,
}) => {
    const callerRole = normalizeRole(caller.role);
    const targetRole = normalizeRole(targetRoleHint || target.role);

    if (!VIEWER_ROLES.has(targetRole)) {
        throw new functions.https.HttpsError('failed-precondition', '상담 대상은 student 또는 parent만 가능합니다.');
    }

    const participantIds = [caller.authUid, target.authUid];

    const participantRoles = {
        [caller.authUid]: callerRole,
        [target.authUid]: targetRole,
    };

    const participantNames = {
        [caller.authUid]: caller.name || caller.authUid,
        [target.authUid]: targetNameHint || target.name || target.authUid,
    };

    const participantUserDocIds = {
        [caller.authUid]: caller.userDocId,
        [target.authUid]: targetUserDocIdHint || target.userDocId,
    };

    const studentId =
        studentIdHint
        || (targetRole === 'student' ? (targetUserDocIdHint || target.userDocId) : null)
        || (callerRole === 'student' ? caller.userDocId : null)
        || null;

    const parentId =
        parentIdHint
        || (targetRole === 'parent' ? (targetUserDocIdHint || target.userDocId) : null)
        || (callerRole === 'parent' ? caller.userDocId : null)
        || null;

    return {
        type: 'individual',
        participantIds,
        participantRoles,
        participantNames,
        participantUserDocIds,
        studentId,
        parentId,
        staffId: caller.authUid,
        visibleToRoles: Array.from(new Set([callerRole, targetRole])),
        status: 'active',
        internalOnly: true,
        updatedAt: now,
        updatedBy: caller.authUid,
        unreadCountByUser: {
            [caller.authUid]: 0,
            [target.authUid]: 0,
        },
    };
};

const writeMessageAndRoomState = async ({ roomId, roomData, sender, messagePayload }) => {
    const now = FieldValue.serverTimestamp();
    const participantIds = Array.isArray(roomData?.participantIds) ? roomData.participantIds : [];
    const unreadPatch = {};

    participantIds.forEach((participantId) => {
        unreadPatch[`unreadCountByUser.${participantId}`] = participantId === sender.authUid
            ? 0
            : FieldValue.increment(1);
    });

    const messageRef = db.collection('chatRooms').doc(roomId).collection('messages').doc();
    await messageRef.set({
        roomId,
        senderId: sender.authUid,
        senderRole: normalizeRole(sender.role),
        senderName: sender.name || sender.authUid,
        messageType: messagePayload.messageType || 'text',
        text: messagePayload.text || '',
        attachments: Array.isArray(messagePayload.attachments) ? messagePayload.attachments : [],
        createdAt: now,
        editedAt: null,
        deletedAt: null,
        readBy: {
            [sender.authUid]: now,
        },
        isBroadcastCopy: Boolean(messagePayload.isBroadcastCopy),
        broadcastId: messagePayload.broadcastId || null,
        internalOnly: true,
    });

    await db.collection('chatRooms').doc(roomId).set({
        lastMessageText: messagePayload.text || '',
        lastMessageAt: now,
        lastMessageSenderId: sender.authUid,
        updatedAt: now,
        updatedBy: sender.authUid,
        ...unreadPatch,
    }, { merge: true });

    return messageRef.id;
};

module.exports = {
    STAFF_ROLES,
    VIEWER_ROLES,
    normalizeRole,
    getUserProfileByAuthUid,
    assertStaffLikeCaller,
    getDirectRoomId,
    applyRoomMetadata,
    writeMessageAndRoomState,
    db,
    FieldValue,
};