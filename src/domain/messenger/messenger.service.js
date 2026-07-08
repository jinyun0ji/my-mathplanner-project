import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    where,
    writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../../firebase/client';
import { uploadChatAttachment } from '../../components/chatAttachments';

const createOrGetChatRoomCallable = httpsCallable(functions, 'createOrGetChatRoom');
const broadcastChatMessageCallable = httpsCallable(functions, 'broadcastChatMessage');


const normalizeString = (value) => String(value || '').trim();

const getInternalRoomTypeForTargetRole = (targetRole) => (
    String(targetRole || '').toLowerCase() === 'parent' ? 'parent_institute' : 'student_institute'
);

const getRoomType = (room = {}) => normalizeString(room?.roomType || room?.channel || room?.type);

const getRoomParticipantIds = (room = {}) => (
    Array.isArray(room?.participantIds) ? room.participantIds.map(normalizeString).filter(Boolean) : []
);

const roomHasTarget = (room = {}, target = {}) => {
    const targetAuthUid = normalizeString(target.targetAuthUid);
    const targetUserDocId = normalizeString(target.targetUserDocId);
    const targetStudentId = normalizeString(target.studentId);
    const targetParentId = normalizeString(target.parentId);
    const participants = getRoomParticipantIds(room);
    const participantUserDocIds = room?.participantUserDocIds && typeof room.participantUserDocIds === 'object'
        ? room.participantUserDocIds
        : {};

    if (targetAuthUid && participants.includes(targetAuthUid)) return true;
    if (targetUserDocId && Object.values(participantUserDocIds).map(normalizeString).includes(targetUserDocId)) return true;

    const roomStudentIds = [room?.studentId, room?.studentDocId, ...(Array.isArray(room?.studentIds) ? room.studentIds : [])]
        .map(normalizeString)
        .filter(Boolean);

    if (targetStudentId && roomStudentIds.length > 0 && !roomStudentIds.includes(targetStudentId)) return false;

    if (String(target.targetRole || '').toLowerCase() === 'parent') {
        return Boolean(targetParentId) && [room?.parentId, room?.parentUid, ...(Array.isArray(room?.parentUids) ? room.parentUids : [])]
            .map(normalizeString)
            .includes(targetParentId);
    }

    return Boolean(targetStudentId) && roomStudentIds.includes(targetStudentId);
};

export const findExistingInternalRoom = (rooms = [], target = {}) => {
    const expectedRoomType = normalizeString(target.roomType) || getInternalRoomTypeForTargetRole(target.targetRole);
    return (Array.isArray(rooms) ? rooms : []).find((room) => (
        room?.id
        && room?.internalOnly === true
        && getRoomType(room) === expectedRoomType
        && roomHasTarget(room, target)
    )) || null;
};

const uniqueStrings = (values = []) => Array.from(new Set(values.flat(Infinity).map((value) => String(value || '').trim()).filter(Boolean)));

const pickCounterpartUid = (participantIds, participantUid) => participantIds.find((uid) => uid !== participantUid) || '';

const buildUserChatRoomIndexData = ({ roomId, roomData = {}, participantUid, lastMessageText, timestamp, lastSenderId }) => {
    const participantIds = uniqueStrings(Array.isArray(roomData.participantIds) ? roomData.participantIds : []);
    return {
        roomId,
        roomType: roomData.roomType || roomData.channel || roomData.type || '',
        channel: roomData.channel || roomData.roomType || '',
        slot: roomData.slot || '',
        counterpartUid: roomData.counterpartUid && String(roomData.counterpartUid) !== String(participantUid)
            ? String(roomData.counterpartUid)
            : pickCounterpartUid(participantIds, String(participantUid)),
        lastMessageText,
        lastMessageAt: timestamp,
        lastSenderId,
        updatedAt: timestamp,
        studentId: roomData.studentId || '',
        parentId: roomData.parentId || '',
        parentUid: roomData.parentUid || '',
        staffAuthUid: roomData.staffAuthUid || '',
        teacherAuthUid: roomData.teacherAuthUid || '',
    };
};

const upsertUserChatRoomIndexWrites = ({ batch, roomId, roomData = {}, lastMessageText, timestamp, lastSenderId }) => {
    const participantIds = uniqueStrings(Array.isArray(roomData.participantIds) ? roomData.participantIds : []);
    participantIds.forEach((participantUid) => {
        batch.set(
            doc(db, 'userChatRooms', participantUid, 'rooms', roomId),
            buildUserChatRoomIndexData({ roomId, roomData, participantUid, lastMessageText, timestamp, lastSenderId }),
            { merge: true },
        );
    });
};

const normalizeRoom = (docSnapshot) => ({
    id: docSnapshot.id,
    ...docSnapshot.data(),
});

const normalizeMessage = (docSnapshot) => ({
    id: docSnapshot.id,
    ...docSnapshot.data(),
});

export const createOrGetChatRoom = async ({
    targetAuthUid,
    targetUserDocId = null,
    targetRole = null,
    targetName = null,
    studentId = null,
    parentId = null,
}) => {
    const result = await createOrGetChatRoomCallable({
        targetAuthUid,
        targetUserDocId,
        targetRole,
        targetName,
        studentId,
        parentId,
    });

    return result?.data || null;
};

export const createOrOpenRoom = async ({
    roomId = null,
    existingRooms = [],
    targetAuthUid,
    targetUserDocId = null,
    targetRole = null,
    targetName = null,
    studentId = null,
    parentId = null,
}) => {
    if (roomId) return { roomId, status: 'existing' };

    const existingRoom = findExistingInternalRoom(existingRooms, {
        targetAuthUid,
        targetUserDocId,
        targetRole,
        studentId,
        parentId,
    });
    if (existingRoom?.id) return { roomId: existingRoom.id, status: 'existing' };

    return createOrGetChatRoom({
        targetAuthUid,
        targetUserDocId,
        targetRole,
        targetName,
        studentId,
        parentId,
    });
};

export const sendMessageDirect = async ({
    roomId,
    text,
    messageType = 'text',
    attachments = [],
    senderMeta = {},
    clientTempId = null,
}) => {
    const now = Date.now();
    const roomRef = doc(db, 'chatRooms', roomId);
    const uploadedAttachment = attachments?.[0]?.file ? await uploadChatAttachment({
        roomId,
        messageId: clientTempId || String(now),
        file: attachments[0].file,
        uploaderUid: senderMeta?.senderId || '',
    }) : null;
    const finalAttachments = uploadedAttachment ? [uploadedAttachment] : attachments.filter((item) => !item.file);
    const finalMessageType = uploadedAttachment ? (uploadedAttachment.type === 'image' ? 'image' : 'file') : messageType;
    const fallbackLastMessage = uploadedAttachment ? (uploadedAttachment.type === 'image' ? '사진 첨부' : 'PDF 첨부') : text;

    const messagePayload = {
        roomId,
        senderId: senderMeta?.senderId || null,
        senderRole: senderMeta?.senderRole || null,
        senderName: senderMeta?.senderName || null,
        messageType: finalMessageType,
        text,
        attachments: finalAttachments,
        createdAt: serverTimestamp(),
        internalOnly: true,
        clientTempId,
    };

    const roomPatch = {
        lastMessageText: text || fallbackLastMessage,
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: senderMeta?.senderId || null,
        lastSenderId: senderMeta?.senderId || null,
        updatedAt: serverTimestamp(),
        updatedBy: senderMeta?.senderId || null,
        // TODO: unreadCountByUser 업데이트는 후속 단계에서 최소 비용 방식으로 재설계
    };

    const roomSnapshot = await getDoc(roomRef);
    const roomData = roomSnapshot.exists() ? roomSnapshot.data() || {} : {};

    const batch = writeBatch(db);
    const messageRef = doc(collection(db, 'chatRooms', roomId, 'messages'));
    batch.set(messageRef, messagePayload);
    batch.update(roomRef, roomPatch);
    upsertUserChatRoomIndexWrites({
        batch,
        roomId,
        roomData,
        lastMessageText: text || fallbackLastMessage,
        timestamp: roomPatch.lastMessageAt,
        lastSenderId: senderMeta?.senderId || null,
    });

    await batch.commit();

    return {
        roomId,
        messageId: messageRef.id,
        acceptedAt: now,
        lastMessageText: text || fallbackLastMessage,
        lastMessageSenderId: senderMeta?.senderId || null,
    };
};

export const broadcastChatMessage = async ({
    text,
    targetUserIds = [],
    targetType = 'custom',
    targetClassIds = [],
}) => {
    const result = await broadcastChatMessageCallable({
        text,
        targetUserIds,
        targetType,
        targetClassIds,
    });

    return result?.data || null;
};

const getTime = (value) => (typeof value?.toDate === 'function' ? value.toDate() : new Date(value || 0)).getTime() || 0;

const sortInternalRooms = (rooms = []) => [...rooms]
    .filter((room) => room?.internalOnly === true || room?.fromUserChatRoomIndex === true)
    .sort((a, b) => getTime(b?.lastMessageAt || b?.updatedAt || b?.createdAt) - getTime(a?.lastMessageAt || a?.updatedAt || a?.createdAt))
    .slice(0, 100);

const mergeRoomWithIndex = (room, index = {}) => ({
    ...(room || {}),
    fromUserChatRoomIndex: Boolean(index?.id || index?.roomId),
    id: room?.id || index?.roomId || index?.id || '',
    roomId: room?.roomId || index?.roomId || index?.id || '',
    lastMessageText: room?.lastMessageText || index?.lastMessageText || index?.lastMessage || '',
    lastMessage: room?.lastMessage || index?.lastMessage || '',
    lastMessageAt: room?.lastMessageAt || index?.lastMessageAt || null,
    lastSenderId: room?.lastSenderId || index?.lastSenderId || room?.lastMessageSenderId || '',
    updatedAt: room?.updatedAt || index?.updatedAt || null,
    participantIds: Array.isArray(room?.participantIds) && room.participantIds.length > 0
        ? room.participantIds
        : uniqueStrings([index?.participantIds || [], index?.counterpartUid, index?.staffAuthUid, index?.teacherAuthUid]),
    internalOnly: room?.internalOnly === true || Boolean(index?.id || index?.roomId),
});

const fetchUserAuthIndexProfile = async (authUid) => {
    const currentAuthUid = normalizeString(authUid);
    if (!currentAuthUid) return { userDocId: '', profile: {} };
    const indexSnap = await getDoc(doc(db, 'userAuthIndex', currentAuthUid));
    const userDocId = indexSnap.exists() ? normalizeString(indexSnap.data()?.userDocId) : '';
    if (!userDocId) return { userDocId: '', profile: {} };
    const userSnap = await getDoc(doc(db, 'users', userDocId));
    return { userDocId, profile: userSnap.exists() ? userSnap.data() || {} : {} };
};

const fetchRoomsForInternalIndexes = async (indexes = []) => (
    indexes
        .map((index) => {
            const roomId = normalizeString(index?.roomId || index?.id);
            if (!roomId) return null;
            return mergeRoomWithIndex({ id: roomId }, index);
        })
        .filter(Boolean)
);

const fetchInternalUserChatRoomIndexes = async (keys = [], debug = {}) => {
    const indexesById = new Map();
    const pathsTried = [];
    for (const key of keys) {
        const path = `userChatRooms/${key}/rooms`;
        pathsTried.push(path);
        try {
            const snap = await getDocs(query(collection(db, 'userChatRooms', key, 'rooms')));
            snap.docs.forEach((docSnapshot) => indexesById.set(docSnapshot.id, { id: docSnapshot.id, ...docSnapshot.data() }));
        } catch (error) {
            console.warn('[staff messenger] userChatRooms read failed; continuing fallback', { path, code: error?.code, message: error?.message });
        }
    }
    if (process.env.NODE_ENV === 'development') {
        console.log('[staff messenger] userChatRooms paths tried', { ...debug, pathsTried, matchedCount: indexesById.size });
    }
    return { indexes: Array.from(indexesById.values()), pathsTried };
};

const fetchInternalFallbackRooms = async (participantKeyCandidates = [], debug = {}) => {
    const chunk = uniqueStrings(participantKeyCandidates).slice(0, 10);
    if (!chunk.length) return [];
    try {
        const snap = await getDocs(query(
            collection(db, 'chatRooms'),
            where('participantIds', 'array-contains-any', chunk),
        ));
        const rooms = snap.docs.map(normalizeRoom);
        if (process.env.NODE_ENV === 'development') {
            console.log('[staff messenger] chatRooms fallback matched count', { ...debug, count: rooms.length });
        }
        return rooms;
    } catch (error) {
        console.warn('[staff messenger] chatRooms fallback failed', { ...debug, code: error?.code, message: error?.message });
        return [];
    }
};

export const subscribeInternalChatRooms = (currentAuthUid, onChange, onError = null, options = {}) => {
    const authUid = normalizeString(auth.currentUser?.uid || currentAuthUid);
    if (!authUid) return () => {};

    let cancelled = false;

    const loadRooms = async () => {
        try {
            const initialProfileDocId = normalizeString(options.profileDocId);
            const initialUserChatRoomKeys = uniqueStrings([authUid, initialProfileDocId]);
            const initialDebug = { authUid, profileDocId: initialProfileDocId, userAuthIndexUserDocId: '', participantKeyCandidates: initialUserChatRoomKeys };

            if (process.env.NODE_ENV === 'development') {
                console.log('[staff messenger] resolver identity', initialDebug);
            }

            const { indexes } = await fetchInternalUserChatRoomIndexes(initialUserChatRoomKeys, initialDebug);
            const indexedRooms = await fetchRoomsForInternalIndexes(indexes);
            let finalRooms = sortInternalRooms(indexedRooms);

            if (finalRooms.length === 0) {
                const { userDocId: indexedUserDocId, profile } = await fetchUserAuthIndexProfile(authUid);
                const profileDocId = normalizeString(options.profileDocId || indexedUserDocId);
                const userAuthIndexUserDocId = indexedUserDocId;
                const participantKeyCandidates = uniqueStrings([
                    authUid,
                    profileDocId,
                    userAuthIndexUserDocId,
                    profile?.uid,
                    profile?.authUid,
                    profile?.userUid,
                    profile?.id,
                ]).slice(0, 10);
                const fallbackDebug = { authUid, profileDocId, userAuthIndexUserDocId, participantKeyCandidates };
                const fallbackRooms = await fetchInternalFallbackRooms(participantKeyCandidates, fallbackDebug);
                finalRooms = sortInternalRooms(fallbackRooms);
            }

            if (process.env.NODE_ENV === 'development') {
                console.log('[staff messenger] room list count', { ...debug, count: finalRooms.length });
                console.log('[staff messenger] rooms missing lastMessageText count', { ...debug, count: finalRooms.filter((room) => !room?.lastMessageText).length });
            }

            if (!cancelled) onChange(finalRooms);
        } catch (error) {
            if (!cancelled) onError?.(error);
        }
    };

    loadRooms();

    return () => {
        cancelled = true;
    };
};

export const subscribeChatMessages = (roomId, onChange, onError = null) => {
    if (!roomId) return () => {};
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (process.env.NODE_ENV === 'development') console.log('[staff messenger] selected room id', { roomId });

    const messagesQuery = query(
        collection(db, 'chatRooms', roomId, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(30),
    );

    return onSnapshot(
        messagesQuery,
        (snapshot) => {
            const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
            if (process.env.NODE_ENV === 'development') console.log('[staff messenger] initial messages loaded count', { roomId, count: snapshot.docs.length, loadTimeMs: Math.round(finishedAt - startedAt) });
            onChange(snapshot.docs.map(normalizeMessage).reverse());
        },
        onError || (() => {}),
    );
};