import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/client';

const log = (...args) => {
    if (process.env.NODE_ENV === 'development') console.log('[roomFactory]', ...args);
};

const uniqueStrings = (values = []) => Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));

const buildUserRoomIndexData = ({ roomId, room = {}, timestamp }) => ({
    roomId,
    roomType: room.roomType || room.channel || '',
    channel: room.channel || '',
    slot: room.slot || '',
    counterpartUid: room.counterpartUid || room.staffAuthUid || room.teacherAuthUid || '',
    lastMessageText: room.lastMessageText || room.lastMessage || room.message || '',
    lastMessageAt: room.lastMessageAt || room.updatedAt || room.createdAt || timestamp,
    updatedAt: room.updatedAt || room.lastMessageAt || room.createdAt || timestamp,
    studentId: room.studentId || '',
    parentUid: room.parentUid || '',
    studentAuthUid: room.studentAuthUid || room.studentUid || '',
    staffAuthUid: room.staffAuthUid || '',
    teacherAuthUid: room.teacherAuthUid || '',
});

const createUserChatRoomIndexes = async ({ roomId, room, timestamp }) => {
    const participantIds = uniqueStrings(Array.isArray(room?.participantIds) ? room.participantIds : []);
    if (!participantIds.length) return;
    await Promise.all(participantIds.map((participantUid) => setDoc(
        doc(db, 'userChatRooms', participantUid, 'rooms', roomId),
        buildUserRoomIndexData({ roomId, room, timestamp }),
        { merge: true }
    )));
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
    const timestamp = serverTimestamp();
    const roomPayload = { ...payload, createdAt: timestamp, updatedAt: timestamp };
    await setDoc(roomRef, roomPayload);
    await createUserChatRoomIndexes({ roomId, room: roomPayload, timestamp });
    log('created room', { roomId, roomType: payload?.roomType, slot: payload?.slot });
    return { id: roomId, ...payload, created: true };
};
