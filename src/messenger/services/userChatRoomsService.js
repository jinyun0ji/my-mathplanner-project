import { collection, doc, getDoc, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../firebase/client';

export const getUserChatRoomsQueryShape = (authUid) => ({ collection: `userChatRooms/${authUid}/rooms` });

const toMillis = (value) => {
    if (!value) return 0;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
};

export const sortUserRoomIndexes = (indexes = []) => [...indexes].sort((left, right) => toMillis(right.lastMessageAt || right.updatedAt) - toMillis(left.lastMessageAt || left.updatedAt));

export const mergeRoomWithIndex = (room, index) => ({
    ...(room || {}),
    id: room?.id || index?.roomId || index?.id || '',
    roomId: room?.roomId || index?.roomId || index?.id || '',
    indexLastMessageText: index?.lastMessageText || '',
    indexLastMessageAt: index?.lastMessageAt || null,
    indexUpdatedAt: index?.updatedAt || null,
    lastMessageText: index?.lastMessageText || room?.lastMessageText || '',
    lastMessageAt: index?.lastMessageAt || room?.lastMessageAt || null,
    updatedAt: index?.updatedAt || room?.updatedAt || null,
});

export const fetchRoomsForIndexes = async (indexes = []) => {
    const rooms = await Promise.all(sortUserRoomIndexes(indexes).map(async (index) => {
        const roomId = String(index?.roomId || index?.id || '').trim();
        if (!roomId) return null;
        const roomSnap = await getDoc(doc(db, 'chatRooms', roomId));
        if (!roomSnap.exists()) return mergeRoomWithIndex({ id: roomId }, index);
        return mergeRoomWithIndex({ id: roomSnap.id, ...roomSnap.data() }, index);
    }));
    return rooms.filter(Boolean);
};

export const subscribeUserChatRooms = ({ authUid, onNext, onError }) => {
    const indexQuery = query(collection(db, 'userChatRooms', authUid, 'rooms'));
    return onSnapshot(indexQuery, async (snap) => {
        try {
            const indexes = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
            onNext(await fetchRoomsForIndexes(indexes), indexes);
        } catch (error) {
            onError?.(error);
        }
    }, onError);
};
