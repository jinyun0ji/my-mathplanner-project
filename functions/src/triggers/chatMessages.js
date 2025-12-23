const functions = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');
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

        if (recipients.length === 0) {
            return null;
        }

        const refId = context.params.chatId;

        return notifyUsers({
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
    });

module.exports = {
    onChatMessageCreated,
};