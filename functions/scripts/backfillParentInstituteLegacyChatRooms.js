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

const INSTITUTE_AUTH_UID = 'lVwBt6If6JVwkop9uPIbOIHQmwg2';

const getString = (value) => (typeof value === 'string' ? value.trim() : '');
const getList = (value) => (Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : []);
const hasField = (data, field) => Object.prototype.hasOwnProperty.call(data, field);
const getRoomType = (data) => getString(data.roomType || data.channel);
const hasRoomTypeOrChannel = (data, expected) => getString(data.roomType) === expected || getString(data.channel) === expected;

const getParticipantRole = (data, uid) => getString(data.participantRoles?.[uid]);

const findParentUid = (data) => {
    const participantIds = getList(data.participantIds);
    const explicitParentUid = getString(data.parentUid || data.parentId);
    if (explicitParentUid && participantIds.includes(explicitParentUid)) return explicitParentUid;

    const roleParentUid = participantIds.find((uid) => getParticipantRole(data, uid) === 'parent');
    if (roleParentUid) return roleParentUid;

    if (getList(data.visibleToRoles).includes('parent')) {
        return participantIds.find((uid) => uid !== INSTITUTE_AUTH_UID) || '';
    }

    return '';
};

const isParentInstituteLegacyRoom = (data) => {
    const participantIds = getList(data.participantIds);
    if (participantIds.length !== 2) return false;
    if (!participantIds.includes(INSTITUTE_AUTH_UID)) return false;
    if (hasRoomTypeOrChannel(data, 'student_institute')) return false;
    if (getRoomType(data) === 'student_institute') return false;
    if (getParticipantRole(data, INSTITUTE_AUTH_UID) === 'student') return false;

    const parentUid = findParentUid(data);
    if (!parentUid || parentUid === INSTITUTE_AUTH_UID) return false;
    if (getParticipantRole(data, parentUid) === 'student') return false;

    return Boolean(parentUid);
};

const buildPatch = (data, parentUid) => {
    const patch = {
        roomType: 'parent_institute',
        channel: 'parent_institute',
        slot: 'institute',
        counterpartUid: INSTITUTE_AUTH_UID,
        staffAuthUid: INSTITUTE_AUTH_UID,
        targetRole: 'staff',
        parentUid,
        parentId: getString(data.parentId) || parentUid,
        internalOnly: true,
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (!hasField(data, 'participantRoles') || typeof data.participantRoles !== 'object' || data.participantRoles === null) {
        patch.participantRoles = { [parentUid]: 'parent', [INSTITUTE_AUTH_UID]: 'admin' };
    } else {
        patch.participantRoles = {
            ...data.participantRoles,
            [parentUid]: getString(data.participantRoles[parentUid]) || 'parent',
            [INSTITUTE_AUTH_UID]: getString(data.participantRoles[INSTITUTE_AUTH_UID]) || 'admin',
        };
    }

    if (!getList(data.visibleToRoles).includes('parent')) {
        patch.visibleToRoles = Array.from(new Set([...getList(data.visibleToRoles), 'parent']));
    }

    return patch;
};

async function main() {
    console.log(`[backfillParentInstituteLegacyChatRooms] start (${dryRun ? 'dry-run' : 'write'})`);

    const snapshot = await db.collection('chatRooms')
        .where('participantIds', 'array-contains', INSTITUTE_AUTH_UID)
        .get();

    let scanned = 0;
    let wouldUpdate = 0;
    let skipped = 0;

    for (const docSnap of snapshot.docs) {
        if (scanLimit && scanned >= scanLimit) break;
        scanned += 1;
        const data = docSnap.data() || {};

        if (!isParentInstituteLegacyRoom(data)) {
            skipped += 1;
            continue;
        }

        const parentUid = findParentUid(data);
        const patch = buildPatch(data, parentUid);
        wouldUpdate += 1;
        console.log('[backfillParentInstituteLegacyChatRooms] update candidate', {
            id: docSnap.id,
            parentUid,
            participantIds: getList(data.participantIds),
            currentRoomType: getString(data.roomType),
            currentChannel: getString(data.channel),
            currentStudentId: hasField(data, 'studentId') ? data.studentId : undefined,
            patch,
        });

        if (!dryRun) await docSnap.ref.set(patch, { merge: true });
    }

    console.log(`[backfillParentInstituteLegacyChatRooms] complete scanned=${scanned} ${dryRun ? 'wouldUpdate' : 'updated'}=${wouldUpdate} skipped=${skipped}`);
}

main().catch((error) => {
    console.error('[backfillParentInstituteLegacyChatRooms] failed', error);
    process.exitCode = 1;
});