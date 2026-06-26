const functions = require('firebase-functions');
const { upsertUserChatRoomIndexes } = require('../chat/chatHelpers');

const onChatRoomWritten = functions.firestore
    .document('chatRooms/{roomId}')
    .onWrite(async (change, context) => {
        if (!change.after.exists) return null;
        const roomData = change.after.data() || {};
        const participantIds = Array.isArray(roomData.participantIds) ? roomData.participantIds : [];
        if (!participantIds.length) return null;
        await upsertUserChatRoomIndexes({
            roomId: context.params.roomId,
            roomData,
            participantIds,
            lastMessageText: roomData.lastMessageText || roomData.lastMessage || roomData.message || '',
            lastMessageAt: roomData.lastMessageAt || roomData.updatedAt || null,
            updatedAt: roomData.updatedAt || null,
        });
        return null;
    });

module.exports = {
    onChatRoomWritten,
};
