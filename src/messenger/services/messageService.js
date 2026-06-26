import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/client';

const log = (...args) => {
    if (process.env.NODE_ENV === 'development') console.log('[messages]', ...args);
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
    await updateDoc(doc(db, 'chatRooms', roomId), {
        lastMessageText,
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: updaterUid,
        updatedAt: serverTimestamp(),
        updatedBy: updaterUid,
    });
    log('sent', { roomId, messageId: messageRef.id });
    return messageRef;
};
