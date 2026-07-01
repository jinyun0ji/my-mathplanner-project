import { addDoc, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/client';

const log = (...args) => {
    if (process.env.NODE_ENV === 'development') console.log('[messages]', ...args);
};

const uniqueStrings = (values = []) => Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));

const buildUserRoomIndexData = ({ roomId, room = {}, lastMessageText, timestamp, lastSenderId }) => ({
    roomId,
    lastMessageText,
    lastMessageAt: timestamp,
    lastSenderId,
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


const logCreatedAtOrderFailure = async ({ roomId, error }) => {
    if (process.env.NODE_ENV !== 'development') return;
    try {
        const snap = await getDocs(query(collection(db, 'chatRooms', roomId, 'messages'), limit(30)));
        const missingCreatedAt = snap.docs
            .filter((docSnap) => !docSnap.data()?.createdAt)
            .map((docSnap) => docSnap.id);
        console.warn('[messages] createdAt orderBy failed; checked latest fallback batch for missing createdAt', {
            roomId,
            code: error?.code,
            message: error?.message,
            checkedCount: snap.docs.length,
            missingCreatedAtCount: missingCreatedAt.length,
            missingCreatedAtIds: missingCreatedAt,
        });
    } catch (diagnosticError) {
        console.warn('[messages] createdAt orderBy failed; missing createdAt diagnostic failed', {
            roomId,
            code: error?.code,
            message: error?.message,
            diagnosticCode: diagnosticError?.code,
            diagnosticMessage: diagnosticError?.message,
        });
    }
};

const updateUserChatRoomIndexes = async ({ roomId, lastMessageText, timestamp, lastSenderId, roomData = null }) => {
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
            buildUserRoomIndexData({ roomId, room, lastMessageText, timestamp, lastSenderId }),
            { merge: true }
        )));
    } catch (indexError) {
        console.warn('[messages] failed to update userChatRooms index', { roomId, message: indexError?.message, code: indexError?.code });
    }
};

export const subscribeRoomMessages = ({ roomId, onNext, onError, withOrderBy = true }) => {
    const messagesRef = collection(db, 'chatRooms', roomId, 'messages');
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const messagesQuery = withOrderBy ? query(messagesRef, orderBy('createdAt', 'desc'), limit(30)) : query(messagesRef, limit(30));
    log('subscribe', { messagesPath: `chatRooms/${roomId}/messages`, withOrderBy, orderBy: withOrderBy ? ['createdAt', 'desc'] : null, limit: 30 });
    return onSnapshot(messagesQuery, (snap) => {
        const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        log('initial messages loaded', { roomId, count: snap.docs.length, loadTimeMs: Math.round(finishedAt - startedAt) });
        onNext(snap);
    }, (error) => {
        if (withOrderBy) logCreatedAtOrderFailure({ roomId, error });
        onError?.(error);
    });
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
        lastSenderId: updaterUid,
        updatedAt: timestamp,
        updatedBy: updaterUid,
    });
    await updateUserChatRoomIndexes({ roomId, lastMessageText, timestamp, lastSenderId: updaterUid });
    log('sent', { roomId, messageId: messageRef.id });
    return messageRef;
};
