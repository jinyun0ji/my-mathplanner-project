/* eslint-disable no-console */
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const args = new Set(process.argv.slice(2));
const dryRun = !args.has('--write');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const scanLimit = Math.max(0, Number(limitArg?.split('=')[1] || 0));

const TEACHER_AUTH_UID = 'EzOXjwwyATO2sP5yuc3CkS3oRw22';
const INSTITUTE_AUTH_UID = 'lVwBt6If6JVwkop9uPIbOIHQmwg2';

const STANDARD_ROOM_TYPES = new Set([
    'student_institute',
    'parent_institute',
    'student_teacher',
    'parent_teacher',
]);

const getString = (value) => (typeof value === 'string' ? value.trim() : '');
const getRoomType = (data) => getString(data.roomType || data.channel);
const hasField = (data, field) => Object.prototype.hasOwnProperty.call(data, field);
const isStandardType = (value) => STANDARD_ROOM_TYPES.has(value);

const inferViewerKind = (data) => {
    if (getString(data.parentUid) || getString(data.parentId)) return 'parent';
    if (getString(data.studentAuthUid) || getString(data.studentUid) || getString(data.studentId)) return 'student';
    return '';
};

const inferSlot = (data) => {
    const explicitSlot = getString(data.slot);
    if (explicitSlot === 'teacher' || explicitSlot === 'institute') return explicitSlot;

    const currentType = getRoomType(data);
    if (currentType === 'teacher' || currentType.endsWith('_teacher')) return 'teacher';
    if (currentType === 'institute' || currentType.endsWith('_institute')) return 'institute';

    if (getString(data.teacherAuthUid) || getString(data.teacherName)) return 'teacher';
    if (getString(data.counterpartUid) === TEACHER_AUTH_UID || (getString(data.counterpartUid) && getString(data.targetRole) === 'teacher')) return 'teacher';
    if (getString(data.staffAuthUid) || getString(data.staffName) || getString(data.counterpartUid) === INSTITUTE_AUTH_UID) return 'institute';
    return '';
};

const inferRoomType = (data) => {
    const currentType = getRoomType(data);
    if (isStandardType(currentType)) return { roomType: currentType, reason: 'already_standard' };

    const slot = inferSlot(data);
    const viewerKind = inferViewerKind(data);

    if (!slot) return { roomType: '', reason: 'unknown_slot' };
    if (!viewerKind) return { roomType: '', reason: 'unknown_viewer_kind' };

    if (slot === 'institute') return { roomType: `${viewerKind}_institute`, reason: `${viewerKind}_institute_inferred` };
    if (slot === 'teacher') return { roomType: `${viewerKind}_teacher`, reason: `${viewerKind}_teacher_inferred` };
    return { roomType: '', reason: 'unsupported_slot' };
};

const buildPatch = (data, roomType) => {
    const slot = roomType.endsWith('_teacher') ? 'teacher' : 'institute';
    const patch = {
        roomType,
        channel: roomType,
        slot,
        internalOnly: true,
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (!hasField(data, 'targetRole')) patch.targetRole = slot === 'teacher' ? 'teacher' : 'staff';
    if (!hasField(data, 'counterpartUid')) {
        const counterpartUid = slot === 'teacher' ? getString(data.teacherAuthUid) : getString(data.staffAuthUid);
        if (counterpartUid) patch.counterpartUid = counterpartUid;
    }
    return patch;
};

async function main() {
    console.log(`[backfillChatRoomTypes] start (${dryRun ? 'dry-run' : 'write'})`);
    const snapshot = await db.collection('chatRooms').get();
    let scanned = 0;
    let wouldUpdate = 0;
    let skipped = 0;

    for (const docSnap of snapshot.docs) {
        if (scanLimit && scanned >= scanLimit) break;
        scanned += 1;
        const data = docSnap.data() || {};
        const currentType = getRoomType(data);
        const missingRoomType = !getString(data.roomType);
        const legacyChannel = currentType === 'institute' || currentType === 'teacher';
        const hasTeacherClue = Boolean(getString(data.teacherAuthUid) || getString(data.counterpartUid) || getString(data.teacherName));

        if (!missingRoomType && isStandardType(currentType)) {
            skipped += 1;
            continue;
        }
        if (!legacyChannel && !hasTeacherClue) {
            skipped += 1;
            continue;
        }

        const { roomType, reason } = inferRoomType(data);
        if (!roomType) {
            skipped += 1;
            console.log('[backfillChatRoomTypes] skip ambiguous room', {
                id: docSnap.id,
                currentType,
                reason,
                participantIds: Array.isArray(data.participantIds) ? data.participantIds : [],
                studentId: getString(data.studentId),
                parentUid: getString(data.parentUid),
                teacherAuthUid: getString(data.teacherAuthUid),
                counterpartUid: getString(data.counterpartUid),
            });
            continue;
        }

        const patch = buildPatch(data, roomType);
        wouldUpdate += 1;
        console.log('[backfillChatRoomTypes] update candidate', { id: docSnap.id, currentType, reason, patch });
        if (!dryRun) await docSnap.ref.set(patch, { merge: true });
    }

    console.log(`[backfillChatRoomTypes] complete scanned=${scanned} ${dryRun ? 'wouldUpdate' : 'updated'}=${wouldUpdate} skipped=${skipped}`);
}

main().catch((error) => {
    console.error('[backfillChatRoomTypes] failed', error);
    process.exitCode = 1;
});
