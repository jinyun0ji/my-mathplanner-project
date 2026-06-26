const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const isWriteMode = process.argv.includes('--write');
const dryRun = !isWriteMode;
const batchLimit = 450;

const uniqueStrings = (values = []) => Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));

const counterpartFor = (participantIds, participantId, room = {}) => {
    if (room.counterpartUid && String(room.counterpartUid) !== String(participantId)) return String(room.counterpartUid);
    return participantIds.find((uid) => uid !== participantId) || '';
};

const buildIndexData = ({ roomId, room, participantId, participantIds }) => ({
    roomId,
    roomType: room.roomType || room.channel || room.type || '',
    channel: room.channel || room.roomType || '',
    slot: room.slot || '',
    counterpartUid: counterpartFor(participantIds, participantId, room),
    lastMessageText: room.lastMessageText || room.lastMessage || room.message || '',
    lastMessageAt: room.lastMessageAt || room.updatedAt || null,
    updatedAt: room.updatedAt || FieldValue.serverTimestamp(),
});

const commitBatch = async (batch, writes) => {
    if (!writes) return;
    if (dryRun) return;
    await batch.commit();
};

const main = async () => {
    console.log(`[backfill:userChatRooms] start (${dryRun ? 'dry-run' : 'write'})`);
    const snapshot = await db.collection('chatRooms').get();
    let batch = db.batch();
    let pendingWrites = 0;
    let roomsScanned = 0;
    let indexWrites = 0;
    let skippedRooms = 0;

    for (const roomDoc of snapshot.docs) {
        roomsScanned += 1;
        const room = roomDoc.data() || {};
        const participantIds = uniqueStrings(Array.isArray(room.participantIds) ? room.participantIds : []);
        if (!participantIds.length) {
            skippedRooms += 1;
            console.warn(`[backfill:userChatRooms] skip ${roomDoc.id}: participantIds missing/empty`);
            continue;
        }

        participantIds.forEach((participantId) => {
            const indexRef = db.collection('userChatRooms').doc(participantId).collection('rooms').doc(roomDoc.id);
            const indexData = buildIndexData({ roomId: roomDoc.id, room, participantId, participantIds });
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
    console.log(`[backfill:userChatRooms] complete roomsScanned=${roomsScanned} skippedRooms=${skippedRooms} ${dryRun ? 'wouldWrite' : 'wrote'}=${indexWrites}`);
};

main().catch((error) => {
    console.error('[backfill:userChatRooms] failed', error);
    process.exitCode = 1;
});
