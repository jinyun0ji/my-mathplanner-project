const functions = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { notifyUsers } = require('../notify/notifications');
const { createUserIdentityResolver } = require('../identity/resolveUserIdentity');

const TYPE = 'CHAT_MESSAGE';
const db = getFirestore();

const uniqueStrings = (values = []) => Array.from(new Set(
    values.map((value) => String(value || '').trim()).filter(Boolean)
));

const getChatRoomParticipantCandidates = (roomData = {}) => uniqueStrings([
    ...(Array.isArray(roomData.participantIds) ? roomData.participantIds : []),
    roomData.studentId,
    roomData.studentUid,
    roomData.studentAuthUid,
    roomData.parentId,
    roomData.parentUid,
    roomData.parentAuthUid,
]);

const resolveChatRecipientAuthUids = async ({ roomData, senderId, resolveIdentity }) => {
    const participantCandidates = getChatRoomParticipantCandidates(roomData);
    const senderIdentity = await resolveIdentity(senderId);
    const identities = await Promise.all(participantCandidates.map((candidate) => resolveIdentity(candidate)));
    return {
        participantCandidates,
        senderAuthUid: senderIdentity?.authUid || '',
        recipientAuthUids: uniqueStrings(identities
            .map((identity) => identity?.authUid)
            .filter((authUid) => authUid && authUid !== senderIdentity?.authUid)),
    };
};

const buildChatRoomNotification = ({ roomId, messageId, messageData }) => ({
    type: TYPE,
    category: 'message',
    title: '새 메시지가 있습니다.',
    body: '새 메시지가 있습니다.',
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
        const resolveIdentity = createUserIdentityResolver({ db });
        const senderId = String(messageData.senderId || '').trim();
        const roomSnapshot = await db.collection('chatRooms').doc(roomId).get();
        if (!roomSnapshot.exists) {
            console.warn('[notifications] chat room message skipped: room not found', { roomId, messageId });
            return null;
        }

        const roomData = roomSnapshot.data() || {};
        const { participantCandidates, senderAuthUid, recipientAuthUids: recipientOwnerUids } = await resolveChatRecipientAuthUids({
            roomData,
            senderId,
            resolveIdentity,
        });
        const senderOwnerUids = uniqueStrings([senderAuthUid]);

        console.log('[notifications] chat room message recipients resolved', {
            roomId,
            messageId,
            senderId,
            participantCandidates,
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
        const resolveIdentity = createUserIdentityResolver({ db });

        const senderIdentity = await resolveIdentity(senderId);
        const resolvedParticipants = await Promise.all(participantIds.map((uid) => resolveIdentity(uid)));
        const recipients = uniqueStrings(resolvedParticipants
            .map((identity) => identity?.authUid)
            .filter((uid) => uid && uid !== senderIdentity?.authUid));

        const refId = context.params.chatId;
        const lastMessageText = messageData.text || messageData.body || '';
        const lastMessageAt = messageData.createdAt || FieldValue.serverTimestamp();
        const batch = db.batch();

        if (recipients.length === 0) {
            await notifyUsers({
                userIds: [],
                payload: {
                    type: TYPE,
                    title: '새 메시지가 있습니다.',
                    body: '새 메시지가 있습니다.',
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
                title: '새 메시지가 있습니다.',
                body: '새 메시지가 있습니다.',
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
    getChatRoomParticipantCandidates,
    onChatMessageCreated,
    onChatRoomMessageCreated,
    resolveChatRecipientAuthUids,
};
