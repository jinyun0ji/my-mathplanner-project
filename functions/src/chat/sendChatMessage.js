const functions = require('firebase-functions');
const {
    getUserProfileByAuthUid,
    writeMessageAndRoomState,
    db,
} = require('./chatHelpers');

const sendChatMessage = functions.https.onCall(async (data, context) => {
    const senderUid = context?.auth?.uid;
    if (!senderUid) {
        throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const text = typeof data?.text === 'string' ? data.text.trim() : '';

    if (!roomId || !text) {
        throw new functions.https.HttpsError('invalid-argument', 'roomId와 text는 필수입니다.');
    }

    const roomRef = db.collection('chatRooms').doc(roomId);
    const roomSnapshot = await roomRef.get();
    if (!roomSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', '채팅방을 찾을 수 없습니다.');
    }

    const roomData = roomSnapshot.data() || {};
    const participantIds = Array.isArray(roomData.participantIds) ? roomData.participantIds : [];
    if (!participantIds.includes(senderUid)) {
        throw new functions.https.HttpsError('permission-denied', '참여자만 메시지를 전송할 수 있습니다.');
    }

    const sender = await getUserProfileByAuthUid(senderUid);
    if (!sender) {
        throw new functions.https.HttpsError('not-found', '발신자 프로필을 찾을 수 없습니다.');
    }

    const messageId = await writeMessageAndRoomState({
        roomId,
        roomData,
        sender,
        messagePayload: {
            messageType: data?.messageType || 'text',
            text,
            attachments: data?.attachments || [],
            isBroadcastCopy: Boolean(data?.isBroadcastCopy),
            broadcastId: data?.broadcastId || null,
        },
    });

    return {
        roomId,
        messageId,
        status: 'ok',
    };
});

module.exports = {
    sendChatMessage,
};