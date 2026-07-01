const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const isWriteMode = process.argv.includes('--write');
const dryRun = !isWriteMode;
const batchLimit = 450;

const uniqueStrings = (values = []) => Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));

const getLastMessageText = (message = {}) => {
    const text = String(message.text || message.message || message.body || '').trim();
    if (text) return text;
    const firstAttachment = Array.isArray(message.attachments) ? message.attachments[0] : null;
    if (!firstAttachment) return '';
    return firstAttachment.type === 'image' ? '사진 첨부' : 'PDF 첨부';
};

const buildIndexData = ({ roomId, room, lastMessageText, lastMessageAt, lastSenderId }) => ({
    roomId,
    roomType: room.roomType || room.channel || '',
    channel: room.channel || room.roomType || '',
    slot: room.slot || '',
    counterpartUid: room.counterpartUid || room.staffAuthUid || room.teacherAuthUid || '',
    lastMessageText,
    lastMessageAt,
    lastSenderId,
    updatedAt: lastMessageAt || room.updatedAt || room.createdAt || null,
    studentId: room.studentId || '',
    parentId: room.parentId || '',
    parentUid: room.parentUid || '',
    studentAuthUid: room.studentAuthUid || room.studentUid || '',
    staffAuthUid: room.staffAuthUid || '',
    teacherAuthUid: room.teacherAuthUid || '',
});

const commitBatch = async (batch, writes) => {
    if (!writes || dryRun) return;
    await batch.commit();
};

const main = async () => {
    console.log(`[backfill:chatRoomLastMessages] start (${dryRun ? 'dry-run' : 'write'})`);
    const roomsSnap = await db.collection('chatRooms').get();
    let batch = db.batch();
    let pendingWrites = 0;
    let roomsScanned = 0;
    let roomsWithoutMessages = 0;
    let roomWrites = 0;
    let indexWrites = 0;

    for (const roomDoc of roomsSnap.docs) {
        roomsScanned += 1;
        const room = roomDoc.data() || {};
        const latestMessagesSnap = await roomDoc.ref.collection('messages')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();

        if (latestMessagesSnap.empty) {
            roomsWithoutMessages += 1;
            console.log('[backfill:chatRoomLastMessages] skip empty room', { roomId: roomDoc.id });
            continue;
        }

        const latestMessage = latestMessagesSnap.docs[0].data() || {};
        const lastMessageText = getLastMessageText(latestMessage);
        const lastMessageAt = latestMessage.createdAt || room.updatedAt || room.createdAt || null;
        const lastSenderId = String(latestMessage.senderId || latestMessage.createdBy || '').trim();
        const participantIds = uniqueStrings(Array.isArray(room.participantIds) ? room.participantIds : []);
        const roomPatch = {
            lastMessageText,
            lastMessageAt,
            lastSenderId,
            lastMessageSenderId: lastSenderId,
            updatedAt: lastMessageAt || room.updatedAt || room.createdAt || null,
        };

        console.log('[backfill:chatRoomLastMessages] room', {
            roomId: roomDoc.id,
            lastMessageText,
            lastSenderId,
            participantCount: participantIds.length,
        });

        roomWrites += 1;
        if (dryRun) {
            console.log('[dry-run]', roomDoc.ref.path, roomPatch);
        } else {
            batch.set(roomDoc.ref, roomPatch, { merge: true });
            pendingWrites += 1;
        }

        participantIds.forEach((participantId) => {
            const indexRef = db.collection('userChatRooms').doc(participantId).collection('rooms').doc(roomDoc.id);
            const indexData = buildIndexData({ roomId: roomDoc.id, room, lastMessageText, lastMessageAt, lastSenderId });
            indexWrites += 1;
            if (dryRun) {
                console.log('[dry-run]', indexRef.path, indexData);
                return;
            }
            batch.set(indexRef, indexData, { merge: true });
            pendingWrites += 1;
        });

        if (pendingWrites >= batchLimit) {
            await commitBatch(batch, pendingWrites);
            batch = db.batch();
            pendingWrites = 0;
        }
    }

    await commitBatch(batch, pendingWrites);
    console.log(`[backfill:chatRoomLastMessages] complete roomsScanned=${roomsScanned} roomsWithoutMessages=${roomsWithoutMessages} ${dryRun ? 'wouldWriteRooms' : 'wroteRooms'}=${roomWrites} ${dryRun ? 'wouldWriteIndexes' : 'wroteIndexes'}=${indexWrites}`);
};

main().catch((error) => {
    console.error('[backfill:chatRoomLastMessages] failed', error);
    process.exitCode = 1;
});
