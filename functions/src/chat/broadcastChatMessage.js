const functions = require('firebase-functions');
const {
    assertStaffLikeCaller,
    getUserProfileByAuthUid,
    getDirectRoomId,
    applyRoomMetadata,
    writeMessageAndRoomState,
    db,
    FieldValue,
} = require('./chatHelpers');

const toStringList = (input) => Array.from(new Set((Array.isArray(input) ? input : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)));

const resolveClassMemberTargetUids = async (targetClassIds = []) => {
    const classIds = toStringList(targetClassIds);
    if (!classIds.length) return [];

    const classSnaps = await Promise.all(classIds.map((classId) => db.collection('classes').doc(classId).get()));
    const studentKeys = new Set();

    classSnaps.forEach((snapshot) => {
        const students = Array.isArray(snapshot.data()?.students) ? snapshot.data().students : [];
        students.forEach((value) => {
            const key = String(value || '').trim();
            if (key) studentKeys.add(key);
        });
    });

    if (!studentKeys.size) return [];

    const keys = Array.from(studentKeys);
    const userSnapshots = await Promise.all(keys.map((key) => db.collection('users').doc(key).get()));

    const resolved = [];
    userSnapshots.forEach((snapshot, idx) => {
        if (snapshot.exists) {
            const authUid = snapshot.data()?.authUid;
            if (authUid) resolved.push(String(authUid));
            return;
        }
        // classes.students 배열에 authUid가 이미 들어있는 레거시 케이스 fallback
        resolved.push(keys[idx]);
    });

    return toStringList(resolved);
};

const getResolvedTargets = async ({ targetType, targetUserIds, targetClassIds }) => {
    if (targetType === 'classMembers') {
        return resolveClassMemberTargetUids(targetClassIds);
    }

    return toStringList(targetUserIds);
};

const broadcastChatMessage = functions.https.onCall(async (data, context) => {
    const sender = await assertStaffLikeCaller(context);

    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    const targetType = typeof data?.targetType === 'string' ? data.targetType.trim() : 'custom';
    const targetUserIds = toStringList(data?.targetUserIds || []);
    const targetClassIds = toStringList(data?.targetClassIds || []);

    if (!text) {
        throw new functions.https.HttpsError('invalid-argument', 'text는 필수입니다.');
    }

    const resolvedTargets = (await getResolvedTargets({ targetType, targetUserIds, targetClassIds }))
        .filter((uid) => uid !== sender.authUid);

    if (!resolvedTargets.length) {
        throw new functions.https.HttpsError('invalid-argument', '전송 대상이 없습니다.');
    }

    const logRef = db.collection('chatBroadcastLogs').doc();
    const now = FieldValue.serverTimestamp();

    await logRef.set({
        senderId: sender.authUid,
        senderRole: sender.role,
        targetType,
        targetClassIds,
        targetUserIds: resolvedTargets,
        sourceMessageText: text,
        createdAt: now,
        createdBy: sender.authUid,
        resultRoomIds: [],
        resultCount: 0,
        status: 'queued',
        failures: [],
    });

    const successRoomIds = [];
    const failures = [];

    for (const targetUid of resolvedTargets) {
        try {
            const target = await getUserProfileByAuthUid(targetUid);
            if (!target) {
                failures.push({ targetUid, reason: 'target-not-found' });
                continue;
            }

            const roomId = getDirectRoomId(sender.authUid, targetUid);
            const roomRef = db.collection('chatRooms').doc(roomId);
            const roomSnapshot = await roomRef.get();

            if (!roomSnapshot.exists) {
                const roomData = applyRoomMetadata({
                    caller: sender,
                    target,
                    now,
                    targetRoleHint: target.role,
                    targetUserDocIdHint: target.userDocId,
                    targetNameHint: target.name,
                    studentIdHint: target.role === 'student' ? target.userDocId : null,
                    parentIdHint: target.role === 'parent' ? target.userDocId : null,
                });
                await roomRef.set({
                    ...roomData,
                    createdAt: now,
                    createdBy: sender.authUid,
                    lastMessageText: '',
                    lastMessageAt: now,
                    lastMessageSenderId: null,
                });
            }

            const roomData = (await roomRef.get()).data() || {};
            await writeMessageAndRoomState({
                roomId,
                roomData,
                sender,
                messagePayload: {
                    messageType: 'text',
                    text,
                    attachments: [],
                    isBroadcastCopy: true,
                    broadcastId: logRef.id,
                },
            });

            successRoomIds.push(roomId);
        } catch (error) {
            failures.push({
                targetUid,
                reason: error?.message || 'unknown-error',
            });
        }
    }

    await logRef.set({
        resultRoomIds: successRoomIds,
        resultCount: successRoomIds.length,
        status: failures.length ? 'failed' : 'done',
        failures,
        updatedAt: now,
        updatedBy: sender.authUid,
    }, { merge: true });

    return {
        broadcastId: logRef.id,
        successCount: successRoomIds.length,
        failureCount: failures.length,
        status: failures.length ? 'partial' : 'done',
    };
});

module.exports = {
    broadcastChatMessage,
};