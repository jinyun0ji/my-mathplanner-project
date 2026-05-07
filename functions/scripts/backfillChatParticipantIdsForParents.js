/* eslint-disable no-console */
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const args = new Set(process.argv.slice(2));
const dryRun = !args.has('--write');

const uniqueStrings = (values) => Array.from(new Set(
    values.flat().filter((value) => value !== undefined && value !== null && String(value).trim()).map((value) => String(value).trim()),
));

const getFirstString = (...values) => uniqueStrings(values)[0] || '';

const getParentAuthUid = (docSnap) => {
    const data = docSnap.data() || {};
    return getFirstString(
        data.authUid,
        data.authUID,
        data.userAuthUid,
        data.parentAuthUid,
        data.uid,
        data.userUid,
        docSnap.id,
    );
};

const getLinkedStudentIdsFromParent = (parent) => uniqueStrings([
    parent.studentId,
    parent.studentDocId,
    parent.studentUid,
    parent.studentAuthUid,
    Array.isArray(parent.studentIds) ? parent.studentIds : [],
    Array.isArray(parent.childrenIds) ? parent.childrenIds : [],
    Array.isArray(parent.childIds) ? parent.childIds : [],
]);

const studentKeysFromDoc = (docSnap) => {
    if (!docSnap?.exists) return [];
    const data = docSnap.data() || {};
    return uniqueStrings([
        docSnap.id,
        data.id,
        data.uid,
        data.authUid,
        data.authUID,
        data.userAuthUid,
        data.studentId,
        data.studentDocId,
        data.studentUid,
        data.studentAuthUid,
    ]);
};

const addChatSnapshot = (map, snapshot) => {
    snapshot.forEach((docSnap) => map.set(docSnap.id, docSnap));
};

const queryUsersByField = async (field, op, value) => {
    if (!value) return [];
    const snapshot = await db.collection('users').where(field, op, value).get();
    return snapshot.docs;
};

const findStudentDocs = async (parentAuthUid, linkedStudentIds) => {
    const docs = new Map();

    for (const studentId of linkedStudentIds) {
        const byId = await db.collection('users').doc(studentId).get();
        if (byId.exists) docs.set(byId.id, byId);

        for (const field of ['id', 'uid', 'authUid', 'studentId', 'studentUid', 'studentAuthUid']) {
            const matches = await queryUsersByField(field, '==', studentId);
            matches.forEach((docSnap) => docs.set(docSnap.id, docSnap));
        }
    }

    for (const field of ['parentUid', 'parentAuthUid']) {
        const matches = await queryUsersByField(field, '==', parentAuthUid);
        matches.forEach((docSnap) => docs.set(docSnap.id, docSnap));
    }

    const parentUidsMatches = await queryUsersByField('parentUids', 'array-contains', parentAuthUid);
    parentUidsMatches.forEach((docSnap) => docs.set(docSnap.id, docSnap));

    return Array.from(docs.values());
};

const findChatsForStudentKeys = async (studentKeys) => {
    const chats = new Map();
    const equalityFields = ['studentId', 'studentDocId', 'studentUid', 'studentAuthUid'];
    const arrayFields = ['participantIds', 'participants', 'participantUids'];

    for (const key of studentKeys) {
        for (const field of equalityFields) {
            addChatSnapshot(chats, await db.collection('chats').where(field, '==', key).get());
        }
        for (const field of arrayFields) {
            addChatSnapshot(chats, await db.collection('chats').where(field, 'array-contains', key).get());
        }
    }

    return Array.from(chats.values());
};

const buildPatch = (chatData, parentAuthUid) => {
    const participantIds = Array.isArray(chatData.participantIds) ? chatData.participantIds.map(String) : [];
    const parentUids = Array.isArray(chatData.parentUids) ? chatData.parentUids.map(String) : [];
    const patch = {
        participantIds: FieldValue.arrayUnion(parentAuthUid),
        parentUids: FieldValue.arrayUnion(parentAuthUid),
        backfilledParentParticipantIdsAt: FieldValue.serverTimestamp(),
    };

    if (!chatData.parentUid) {
        patch.parentUid = parentAuthUid;
    }

    const needsParticipantId = !participantIds.includes(parentAuthUid);
    const needsParentUid = !chatData.parentUid;
    const needsParentUids = !parentUids.includes(parentAuthUid);

    return needsParticipantId || needsParentUid || needsParentUids ? patch : null;
};

const run = async () => {
    console.log(`[backfill] chat parent participantIds start (${dryRun ? 'dry-run' : 'write'})`);

    const parentsSnapshot = await db.collection('users').where('role', '==', 'parent').get();
    console.log(`[backfill] found ${parentsSnapshot.size} parent users`);

    let scannedChats = 0;
    let updatedChats = 0;
    let skippedParents = 0;
    const pendingWrites = [];

    for (const parentDoc of parentsSnapshot.docs) {
        const parent = parentDoc.data() || {};
        const parentAuthUid = getParentAuthUid(parentDoc);
        if (!parentAuthUid) {
            skippedParents += 1;
            console.warn(`[backfill] skip parent ${parentDoc.id}: auth uid not found`);
            continue;
        }

        const linkedStudentIds = getLinkedStudentIdsFromParent(parent);
        const studentDocs = await findStudentDocs(parentAuthUid, linkedStudentIds);
        const studentKeys = uniqueStrings([linkedStudentIds, studentDocs.map(studentKeysFromDoc)]);

        if (!studentKeys.length) {
            console.warn(`[backfill] parent ${parentDoc.id}: no linked student keys found`);
            continue;
        }

        const chats = await findChatsForStudentKeys(studentKeys);
        scannedChats += chats.length;

        for (const chatDoc of chats) {
            const patch = buildPatch(chatDoc.data() || {}, parentAuthUid);
            if (!patch) continue;

            updatedChats += 1;
            console.log(`[backfill] ${dryRun ? 'would update' : 'update'} chat ${chatDoc.id} for parent ${parentAuthUid}`);
            if (!dryRun) {
                pendingWrites.push(chatDoc.ref.set(patch, { merge: true }));
                if (pendingWrites.length >= 400) {
                    await Promise.all(pendingWrites.splice(0));
                }
            }
        }
    }

    if (!dryRun && pendingWrites.length) {
        await Promise.all(pendingWrites);
    }

    console.log(`[backfill] complete. scannedChats=${scannedChats}, ${dryRun ? 'wouldUpdate' : 'updated'}=${updatedChats}, skippedParents=${skippedParents}`);
    if (dryRun) {
        console.log('[backfill] dry-run only. Re-run with --write to persist changes.');
    }
};

run().catch((error) => {
    console.error('[backfill] failed', error);
    process.exitCode = 1;
});