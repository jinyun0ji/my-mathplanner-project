import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/client';

const log = (...args) => {
    if (process.env.NODE_ENV === 'development') console.log('[roomFactory]', ...args);
};

export const buildDeterministicRoomId = (roomType, ownerUid, counterpartUid, studentId = '') => {
    if (!roomType || !ownerUid || !counterpartUid) return '';
    if (roomType === 'parent_institute') return `direct_parent_institute_${ownerUid}_${counterpartUid}_${String(studentId || '').trim()}`;
    return `direct_${roomType}_${ownerUid}_${counterpartUid}`;
};

export const createRoomIfMissing = async ({ roomId, payload }) => {
    const roomRef = doc(db, 'chatRooms', roomId);
    const existing = await getDoc(roomRef);
    if (existing.exists()) {
        log('existing room reused', { roomId });
        return { id: roomId, ...existing.data(), created: false };
    }
    await setDoc(roomRef, { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    log('created room', { roomId, roomType: payload?.roomType, slot: payload?.slot });
    return { id: roomId, ...payload, created: true };
};
