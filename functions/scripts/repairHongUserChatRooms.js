const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const dryRun = !process.argv.includes('--write');
const batchLimit = 450;

const TARGETS = [
    {
        label: 'hong-student',
        userDocId: 'ulloGGaEVgfhYlDJX6zi',
        aliases: ['7MRv5ErsCpdJtuw8hgSOovXQz4x2', 'v2wTP8NiWMQwsVvwL6uDbPotkFz1'],
    },
    {
        label: 'hong-parent',
        userDocId: 'AEI9gfytJRPufKUp1AA1cKfNVh03',
        aliases: ['AEI9gfytJRPufKUp1AA1cKfNVh03', 'qKIVPaoWfWaDhggNJ3ttyefZ59s1'],
    },
];

const uniqueStrings = (values = []) => Array.from(new Set(values.flat(Infinity).map((value) => String(value || '').trim()).filter(Boolean)));

const roomIdentityValues = (room = {}) => uniqueStrings([
    Array.isArray(room.participantIds) ? room.participantIds : [],
    room.studentId,
    room.parentId,
    room.parentUid,
    room.studentAuthUid,
    room.studentUid,
]);

const matchesTarget = (room, target) => {
    const identities = roomIdentityValues(room);
    return uniqueStrings([target.userDocId, target.aliases]).some((key) => identities.includes(key));
};

const buildIndexData = ({ roomId, room }) => ({
    roomId,
    roomType: room.roomType || room.channel || '',
    channel: room.channel || '',
    slot: room.slot || '',
    counterpartUid: room.counterpartUid || room.staffAuthUid || room.teacherAuthUid || '',
    lastMessageText: room.lastMessageText || room.lastMessage || room.message || '',
    lastMessageAt: room.lastMessageAt || room.updatedAt || room.createdAt || null,
    updatedAt: room.updatedAt || room.lastMessageAt || room.createdAt || null,
    studentId: room.studentId || '',
    parentId: room.parentId || '',
    parentUid: room.parentUid || '',
    studentAuthUid: room.studentAuthUid || room.studentUid || '',
    staffAuthUid: room.staffAuthUid || '',
    teacherAuthUid: room.teacherAuthUid || '',
});

const main = async () => {
    console.log(`[repair:hong-userChatRooms] start (${dryRun ? 'dry-run' : 'write'})`);
    const snapshot = await db.collection('chatRooms').get();
    let batch = db.batch();
    let pendingWrites = 0;
    let scannedRooms = 0;
    let matchedRooms = 0;
    let indexWrites = 0;

    for (const roomDoc of snapshot.docs) {
        scannedRooms += 1;
        const room = roomDoc.data() || {};
        const matchedTargets = TARGETS.filter((target) => matchesTarget(room, target));
        if (!matchedTargets.length) continue;
        matchedRooms += 1;
        const indexData = buildIndexData({ roomId: roomDoc.id, room });

        for (const target of matchedTargets) {
            for (const alias of target.aliases) {
                const indexRef = db.collection('userChatRooms').doc(alias).collection('rooms').doc(roomDoc.id);
                indexWrites += 1;
                console.log('[repair:hong-userChatRooms] mirror index', { target: target.label, alias, roomDocId: roomDoc.id, roomType: indexData.roomType });
                if (!dryRun) {
                    batch.set(indexRef, indexData, { merge: true });
                    pendingWrites += 1;
                    if (pendingWrites >= batchLimit) {
                        await batch.commit();
                        batch = db.batch();
                        pendingWrites = 0;
                    }
                }
            }
        }
    }

    if (!dryRun && pendingWrites > 0) await batch.commit();
    console.log(`[repair:hong-userChatRooms] complete scannedRooms=${scannedRooms} matchedRooms=${matchedRooms} ${dryRun ? 'wouldWrite' : 'wrote'}=${indexWrites}`);
};

main().catch((error) => {
    console.error('[repair:hong-userChatRooms] failed', error);
    process.exitCode = 1;
});
