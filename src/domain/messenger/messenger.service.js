import {
    collection,
    doc,
    getDoc,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    where,
    writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase/client';
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

const uniqueStrings = (values = []) => Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));

const pickCounterpartUid = (participantIds, participantUid) => participantIds.find((uid) => uid !== participantUid) || '';

const buildUserChatRoomIndexData = ({ roomId, roomData = {}, participantUid, lastMessageText, timestamp }) => {
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
        updatedAt: timestamp,
        studentId: roomData.studentId || '',
        parentId: roomData.parentId || '',
        parentUid: roomData.parentUid || '',
        staffAuthUid: roomData.staffAuthUid || '',
        teacherAuthUid: roomData.teacherAuthUid || '',
    };
};

const upsertUserChatRoomIndexWrites = ({ batch, roomId, roomData = {}, lastMessageText, timestamp }) => {
    const participantIds = uniqueStrings(Array.isArray(roomData.participantIds) ? roomData.participantIds : []);
    participantIds.forEach((participantUid) => {
        batch.set(
            doc(db, 'userChatRooms', participantUid, 'rooms', roomId),
            buildUserChatRoomIndexData({ roomId, roomData, participantUid, lastMessageText, timestamp }),
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

export const subscribeInternalChatRooms = (currentAuthUid, onChange, onError = null) => {
    if (!currentAuthUid) return () => {};

    const roomsQuery = query(
        collection(db, 'chatRooms'),
        where('participantIds', 'array-contains', currentAuthUid),
    );

    return onSnapshot(
        roomsQuery,
        (snapshot) => {
            onChange(snapshot.docs
                .map(normalizeRoom)
                .filter((room) => room?.internalOnly === true)
                .sort((a, b) => {
                    const getTime = (value) => (typeof value?.toDate === 'function' ? value.toDate() : new Date(value || 0)).getTime() || 0;
                    return getTime(b?.lastMessageAt) - getTime(a?.lastMessageAt);
                })
                .slice(0, 100));
        },
        onError || (() => {}),
    );
};

export const subscribeChatMessages = (roomId, onChange, onError = null) => {
    if (!roomId) return () => {};

    const messagesQuery = query(
        collection(db, 'chatRooms', roomId, 'messages'),
        orderBy('createdAt', 'asc'),
        limit(200),
    );

    return onSnapshot(
        messagesQuery,
        (snapshot) => {
            onChange(snapshot.docs.map(normalizeMessage));
        },
        onError || (() => {}),
    );
};