const functions = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { notifyUsers } = require('../notify/notifications');

const TYPE = 'CHAT_MESSAGE';
const db = getFirestore();

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
};