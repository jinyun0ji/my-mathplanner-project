import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/client';

const log = (...args) => {
    if (process.env.NODE_ENV === 'development') console.log('[messages]', ...args);
};

const uniqueStrings = (values = []) => Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));

const buildUserRoomIndexData = ({ roomId, room = {}, lastMessageText, timestamp }) => ({
    roomId,
    lastMessageText,
    lastMessageAt: timestamp,
    updatedAt: timestamp,
    roomType: room.roomType || room.channel || '',
    channel: room.channel || '',
    slot: room.slot || '',
    counterpartUid: room.counterpartUid || room.staffAuthUid || room.teacherAuthUid || '',
    studentId: room.studentId || '',
    parentUid: room.parentUid || '',
    studentAuthUid: room.studentAuthUid || room.studentUid || '',
    staffAuthUid: room.staffAuthUid || '',
    teacherAuthUid: room.teacherAuthUid || '',
});

const updateUserChatRoomIndexes = async ({ roomId, lastMessageText, timestamp, roomData = null }) => {
    try {
        let room = roomData || {};
        let participantIds = uniqueStrings(Array.isArray(room.participantIds) ? room.participantIds : []);
        if (!participantIds.length) {
            const roomSnap = await getDoc(doc(db, 'chatRooms', roomId));
            if (!roomSnap.exists()) return;
            room = roomSnap.data() || {};
            participantIds = uniqueStrings(Array.isArray(room.participantIds) ? room.participantIds : []);
        }
        await Promise.all(participantIds.map((participantUid) => setDoc(
            doc(db, 'userChatRooms', participantUid, 'rooms', roomId),
            buildUserRoomIndexData({ roomId, room, lastMessageText, timestamp }),
            { merge: true }
        )));
    } catch (indexError) {
        console.warn('[messages] failed to update userChatRooms index', { roomId, message: indexError?.message, code: indexError?.code });
    }
};

export const subscribeRoomMessages = ({ roomId, onNext, onError, withOrderBy = true }) => {
    const messagesRef = collection(db, 'chatRooms', roomId, 'messages');
    const messagesQuery = withOrderBy ? query(messagesRef, orderBy('createdAt', 'asc')) : query(messagesRef);
    log('subscribe', { messagesPath: `chatRooms/${roomId}/messages`, withOrderBy });
    return onSnapshot(messagesQuery, onNext, onError);
};

export const sendRoomMessage = async ({ roomId, message, lastMessageText, updaterUid }) => {
    const messageRef = await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        ...message,
        roomId,
        createdAt: serverTimestamp(),
        internalOnly: true,
    });
    const timestamp = serverTimestamp();
    await updateDoc(doc(db, 'chatRooms', roomId), {
        lastMessageText,
        lastMessageAt: timestamp,
        lastMessageSenderId: updaterUid,
        updatedAt: timestamp,
        updatedBy: updaterUid,
    });
    await updateUserChatRoomIndexes({ roomId, lastMessageText, timestamp });
    log('sent', { roomId, messageId: messageRef.id });
    return messageRef;
};
