import {
    collection,
    limit,
    onSnapshot,
    orderBy,
    query,
    where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase/client';

const createOrGetChatRoomCallable = httpsCallable(functions, 'createOrGetChatRoom');
const sendChatMessageCallable = httpsCallable(functions, 'sendChatMessage');
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

export const sendChatMessage = async ({
    roomId,
    text,
    messageType = 'text',
    attachments = [],
    isBroadcastCopy = false,
    broadcastId = null,
    clientTempId = null,
}) => {
    const result = await sendChatMessageCallable({
        roomId,
        text,
        messageType,
        attachments,
        isBroadcastCopy,
        broadcastId,
        clientTempId,
    });

    return result?.data || null;
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