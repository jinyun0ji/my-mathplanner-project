import {
    collection,
    doc,
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
    targetAuthUid,
    targetUserDocId = null,
    targetRole = null,
    targetName = null,
    studentId = null,
    parentId = null,
}) => {
    if (roomId) return { roomId, status: 'existing' };

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

    const batch = writeBatch(db);
    const messageRef = doc(collection(db, 'chatRooms', roomId, 'messages'));
    batch.set(messageRef, messagePayload);
    batch.update(roomRef, roomPatch);

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
        where('internalOnly', '==', true),
        orderBy('lastMessageAt', 'desc'),
        limit(100),
    );

    return onSnapshot(
        roomsQuery,
        (snapshot) => {
            onChange(snapshot.docs.map(normalizeRoom));
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