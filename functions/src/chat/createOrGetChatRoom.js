const functions = require('firebase-functions');
const {
    assertStaffLikeCaller,
    getUserProfileByAuthUid,
    getDirectRoomId,
    applyRoomMetadata,
    db,
    FieldValue,
} = require('./chatHelpers');

const createOrGetChatRoom = functions.https.onCall(async (data, context) => {
    const caller = await assertStaffLikeCaller(context);

    const targetAuthUid = typeof data?.targetAuthUid === 'string' ? data.targetAuthUid.trim() : '';
    if (!targetAuthUid) {
        throw new functions.https.HttpsError('invalid-argument', 'targetAuthUid가 필요합니다.');
    }

    if (targetAuthUid === caller.authUid) {
        throw new functions.https.HttpsError('invalid-argument', '자기 자신과 채팅방을 생성할 수 없습니다.');
    }

    const target = await getUserProfileByAuthUid(targetAuthUid);
    if (!target) {
        throw new functions.https.HttpsError('not-found', '대상 사용자 프로필을 찾을 수 없습니다.');
    }

    const roomId = getDirectRoomId(caller.authUid, targetAuthUid);
    const roomRef = db.collection('chatRooms').doc(roomId);
    const now = FieldValue.serverTimestamp();

    await db.runTransaction(async (transaction) => {
        const roomSnapshot = await transaction.get(roomRef);
        if (roomSnapshot.exists) {
            transaction.set(roomRef, {
                updatedAt: now,
                updatedBy: caller.authUid,
            }, { merge: true });
            return;
        }

        const baseRoomData = applyRoomMetadata({
            caller,
            target,
            now,
            targetRoleHint: data?.targetRole || null,
            targetUserDocIdHint: data?.targetUserDocId || null,
            targetNameHint: data?.targetName || null,
            studentIdHint: data?.studentId || null,
            parentIdHint: data?.parentId || null,
        });

        transaction.set(roomRef, {
            ...baseRoomData,
            createdAt: now,
            createdBy: caller.authUid,
            lastMessageText: '',
            lastMessageAt: now,
            lastMessageSenderId: null,
        });
    });

    return {
        roomId,
        status: 'ok',
    };
});

module.exports = {
    createOrGetChatRoom,
};