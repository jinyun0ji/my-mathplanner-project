const functions = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { notifyUsers } = require('../notify/notifications');

const TYPE = 'CHAT_MESSAGE';
const db = getFirestore();

const uniqueStrings = (values = []) => Array.from(new Set(
    values.map((value) => String(value || '').trim()).filter(Boolean)
));

const resolveParticipantAuthUid = async (participantId) => {
    const normalizedId = String(participantId || '').trim();
    if (!normalizedId) return '';

    const userSnapshot = await db.collection('users').doc(normalizedId).get();
    const authUid = userSnapshot.exists ? String(userSnapshot.data()?.authUid || '').trim() : '';
    return authUid || normalizedId;
};

const buildChatRoomNotification = ({ roomId, messageId, messageData }) => ({
    type: TYPE,
    category: 'message',
    title: '새 메시지',
    body: messageData.text || '첨부파일이 도착했습니다.',
    ref: `chatRooms/${roomId}`,
    refCollection: 'chatRooms',
    refId: roomId,
    roomId,
    senderId: messageData.senderId || '',
    senderName: messageData.senderName || '',
    createdAt: FieldValue.serverTimestamp(),
    isRead: false,
    payload: {
        type: TYPE,
        category: 'message',
        roomId,
        messageId,
        refCollection: 'chatRooms',
    },
});

const onChatRoomMessageCreated = functions.firestore
    .document('chatRooms/{roomId}/messages/{messageId}')
    .onCreate(async (snapshot, context) => {
        const messageData = snapshot.data() || {};
        if (messageData.internalOnly !== true) {
            return null;
        }

        const { roomId, messageId } = context.params;
        const senderId = String(messageData.senderId || '').trim();
        const roomSnapshot = await db.collection('chatRooms').doc(roomId).get();
        if (!roomSnapshot.exists) {
            console.warn('[notifications] chat room message skipped: room not found', { roomId, messageId });
            return null;
        }

        const roomData = roomSnapshot.data() || {};
        const participantIds = uniqueStrings(Array.isArray(roomData.participantIds) ? roomData.participantIds : []);
        const senderOwnerUids = uniqueStrings([
            senderId,
            senderId ? await resolveParticipantAuthUid(senderId) : '',
        ]);
        const senderOwnerUidSet = new Set(senderOwnerUids);
        const recipientOwnerUids = uniqueStrings((await Promise.all(
            participantIds.map(async (participantId) => ([
                participantId,
                await resolveParticipantAuthUid(participantId),
            ]))
        )).flat()).filter((ownerUid) => ownerUid && !senderOwnerUidSet.has(ownerUid));

        console.log('[notifications] chat room message recipients resolved', {
            roomId,
            messageId,
            senderId,
            participantIds,
            senderOwnerUids,
            recipientOwnerUids,
        });

        if (!recipientOwnerUids.length) {
            return null;
        }

        const batch = db.batch();
        recipientOwnerUids.forEach((recipientOwnerUid) => {
            const notificationRef = db
                .collection('notifications')
                .doc(recipientOwnerUid)
                .collection('items')
                .doc(`${roomId}_${messageId}`);
            batch.set(notificationRef, buildChatRoomNotification({ roomId, messageId, messageData }), { merge: true });
        });

        await batch.commit();
        return null;
    });


const onChatMessageCreated = functions.firestore
    .document('chats/{chatId}/messages/{messageId}')
    .onCreate(async (snapshot, context) => {
        const messageData = snapshot.data() || {};
        const chatSnapshot = await db.collection('chats').doc(context.params.chatId).get();
        const chatData = chatSnapshot.data() || {};
        const participantIds = Array.isArray(chatData.participantIds) ? chatData.participantIds : [];
        const senderId = messageData.senderId;

        const recipients = participantIds.filter((uid) => uid && uid !== senderId);

        const refId = context.params.chatId;
        const lastMessageText = messageData.text || messageData.body || '';
        const lastMessageAt = messageData.createdAt || FieldValue.serverTimestamp();
        const batch = db.batch();

        if (recipients.length === 0) {
            await notifyUsers({
                userIds: [],
                payload: {
                    type: TYPE,
                    title: '새 메시지',
                    body: '새 메시지가 도착했습니다.',
                    ref: `chats/${refId}`,
                },
                fcmData: {
                    type: TYPE,
                    refCollection: 'chats',
                    refId,
                },
            });
            return null;
        }

        recipients.forEach((uid) => {
            const chatIndexRef = db.collection('users').doc(uid).collection('chatIndex').doc(refId);
            batch.set(chatIndexRef, {
                unreadCount: FieldValue.increment(1),
                lastMessageAt,
                lastMessageText,
            }, { merge: true });
        });

        await batch.commit();

        await notifyUsers({
            userIds: recipients,
            payload: {
                type: TYPE,
                title: '새 메시지',
                body: '새 메시지가 도착했습니다.',
                ref: `chats/${refId}`,
            },
            fcmData: {
                type: TYPE,
                refCollection: 'chats',
                refId,
            },
        });
        return null;
    });

module.exports = {
    onChatMessageCreated,
    onChatRoomMessageCreated,
};