/* eslint-disable no-console */
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const args = new Set(process.argv.slice(2));
const dryRun = !args.has('--write');
const inspectChats = args.has('--inspect-chats');
const allChats = args.has('--all-chats');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const inspectLimit = Math.max(1, Number(limitArg?.split('=')[1] || 20));

const uniqueStrings = (values) => Array.from(new Set(
    values.flat(Infinity).filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()),
));

const getFirstString = (...values) => uniqueStrings(values)[0] || '';

const valueType = (value) => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'list';
    if (typeof value?.toDate === 'function') return 'timestamp';
    return typeof value;
};

const fieldExists = (data, field) => Object.prototype.hasOwnProperty.call(data, field);

const serializableValue = (value) => {
    if (typeof value?.toDate === 'function') return value.toDate().toISOString();
    if (Array.isArray(value)) return value.map(serializableValue);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serializableValue(entry)]));
    }
    return value;
};

const collectStringValues = (value, options = {}) => {
    const { includeObjectUidFields = false, includeObjectKeys = false } = options;
    if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
    if (Array.isArray(value)) return uniqueStrings(value.map((entry) => collectStringValues(entry, options)));
    if (value && typeof value === 'object') {
        const strings = [];
        if (includeObjectUidFields) {
            strings.push(...uniqueStrings([
                value.uid,
                value.authUid,
                value.authUID,
                value.userUid,
                value.userAuthUid,
                value.parentUid,
                value.parentAuthUid,
                value.studentUid,
                value.studentAuthUid,
                value.id,
            ]));
        }
        if (includeObjectKeys) {
            for (const [key, entry] of Object.entries(value)) {
                if (typeof key === 'string' && key.trim() && entry !== false && entry !== null && entry !== undefined) {
                    strings.push(key.trim());
                }
            }
        }
        return uniqueStrings(strings);
    }
    return [];
};


const collectParticipantValues = (value) => {
    if (Array.isArray(value)) {
        return uniqueStrings(value.map((entry) => collectStringValues(entry, { includeObjectUidFields: true })));
    }
    if (value && typeof value === 'object') {
        return uniqueStrings([
            collectStringValues(value, { includeObjectUidFields: true }),
            collectStringValues(value, { includeObjectKeys: true }),
        ]);
    }
    return collectStringValues(value);
};

const detectParticipantIdsIssues = (data) => {
    const issues = [];
    if (!fieldExists(data, 'participantIds')) {
        issues.push('participantIds_missing');
        return issues;
    }

    const participantIds = data.participantIds;
    if (!Array.isArray(participantIds)) {
        issues.push('participantIds_not_list');
        if (typeof participantIds === 'string') issues.push('participantIds_string');
        if (participantIds && typeof participantIds === 'object') issues.push('participantIds_map');
        return issues;
    }

    if (participantIds.length === 0) issues.push('participantIds_empty_array');
    participantIds.forEach((value) => {
        if (value === null || value === undefined) issues.push('participantIds_null_member');
        if (typeof value !== 'string') issues.push('participantIds_non_string_member');
        if (typeof value === 'number') issues.push('participantIds_number_member');
        if (value && typeof value === 'object') issues.push('participantIds_object_member');
        if (typeof value === 'string' && !value.trim()) issues.push('participantIds_blank_string_member');
    });

    return Array.from(new Set(issues));
};

const detectParentUidsMismatch = (data) => {
    if (!fieldExists(data, 'participantIds') || !fieldExists(data, 'parentUids')) return [];
    const participantIdsIsList = Array.isArray(data.participantIds);
    const parentUidsIsList = Array.isArray(data.parentUids);
    return participantIdsIsList !== parentUidsIsList ? ['participantIds_parentUids_type_mismatch'] : [];
};

const sanitizeChatParticipantIds = (chatData, parentAuthUid = '') => {
    const detectedIssues = [
        ...detectParticipantIdsIssues(chatData),
        ...detectParentUidsMismatch(chatData),
    ];

    const beforeParticipantIds = fieldExists(chatData, 'participantIds') ? chatData.participantIds : undefined;
    const existingParticipantIds = collectStringValues(chatData.participantIds);
    const mergedIds = uniqueStrings([
        existingParticipantIds,
        collectStringValues(chatData.participantUids),
        collectParticipantValues(chatData.participants),
        collectStringValues(chatData.parentUid),
        collectStringValues(chatData.parentUids),
        parentAuthUid,
    ]);

    if (mergedIds.length === 0) detectedIssues.push('participantIds_unable_to_repair_without_source_ids');

    const issues = Array.from(new Set(detectedIssues));
    const beforeStringIds = Array.isArray(beforeParticipantIds) ? collectStringValues(beforeParticipantIds) : collectStringValues(beforeParticipantIds);
    const changed = JSON.stringify(beforeStringIds) !== JSON.stringify(mergedIds)
        || issues.length > 0;

    return {
        beforeParticipantIds,
        afterParticipantIds: mergedIds,
        detectedIssues: issues,
        changed,
    };
};

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


const getUserAuthUid = (docSnap) => {
    const data = docSnap.data() || {};
    return getFirstString(
        data.authUid,
        data.authUID,
        data.userAuthUid,
        data.parentAuthUid,
        data.uid,
        data.userUid,
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

const findAllChats = async () => {
    const snapshot = await db.collection('chats').get();
    return snapshot.docs;
};

const buildPatch = (chatData, parentAuthUid = '') => {
    const sanitized = sanitizeChatParticipantIds(chatData, parentAuthUid);
    const existingParentUids = collectStringValues(chatData.parentUids);
    const needsParentUid = parentAuthUid && !chatData.parentUid;
    const needsParentUids = parentAuthUid && !existingParentUids.includes(parentAuthUid);

    if (parentAuthUid && !sanitized.afterParticipantIds.includes(parentAuthUid)) {
        sanitized.afterParticipantIds.push(parentAuthUid);
    }

    const needsParticipantIdUpdate = sanitized.changed
        || (parentAuthUid && !collectStringValues(chatData.participantIds).includes(parentAuthUid));

    if (!needsParticipantIdUpdate && !needsParentUid && !needsParentUids) return null;
    if (sanitized.afterParticipantIds.length === 0) return { sanitized, patch: null };

    const patch = {
        participantIds: uniqueStrings(sanitized.afterParticipantIds),
        participantIdsSanitizedAt: FieldValue.serverTimestamp(),
    };

    if (parentAuthUid) {
        patch.parentUids = FieldValue.arrayUnion(parentAuthUid);
        patch.backfilledParentParticipantIdsAt = FieldValue.serverTimestamp();
    }

    if (needsParentUid) {
        patch.parentUid = parentAuthUid;
    }

    return { sanitized, patch };
};

const inspectChatRows = async () => {
    const snapshot = await db.collection('chats').limit(inspectLimit).get();
    const malformedIds = [];
    const rows = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() || {};
        const sanitized = sanitizeChatParticipantIds(data);
        const isMalformed = sanitized.detectedIssues.some((issue) => [
            'participantIds_missing',
            'participantIds_not_list',
            'participantIds_non_string_member',
            'participantIds_empty_array',
        ].includes(issue));
        if (isMalformed) malformedIds.push(docSnap.id);
        return {
            documentId: docSnap.id,
            participantIdsExists: fieldExists(data, 'participantIds'),
            participantIdsType: fieldExists(data, 'participantIds') ? valueType(data.participantIds) : 'missing',
            participantIdsValue: JSON.stringify(serializableValue(data.participantIds)),
            participantsExists: fieldExists(data, 'participants'),
            participantUidsExists: fieldExists(data, 'participantUids'),
            parentUidExists: fieldExists(data, 'parentUid'),
            parentUidsExists: fieldExists(data, 'parentUids'),
            studentIdValue: data.studentId || '',
            updatedAtType: fieldExists(data, 'updatedAt') ? valueType(data.updatedAt) : 'missing',
            detectedIssues: sanitized.detectedIssues.join(', '),
        };
    });

    console.table(rows);
    console.log('[inspect] malformed participantIds chat ids:', malformedIds);
};

    const logSanitization = (roomId, sanitized) => {
    console.log(JSON.stringify({
        roomId,
        beforeParticipantIds: serializableValue(sanitized.beforeParticipantIds),
        afterParticipantIds: sanitized.afterParticipantIds,
        detectedIssues: sanitized.detectedIssues,
    }));
};


const runChatRoomsParentAuthUidRepair = async () => {
    console.log(`[repair] chatRooms parent auth uid repair start (${dryRun ? 'dry-run' : 'write'})`);
    const chatRoomsSnapshot = await db.collection('chatRooms').get();
    const parentDocCache = new Map();
    const pendingWrites = [];
    let scannedRooms = 0;
    let updatedRooms = 0;
    let skippedRooms = 0;

    for (const roomDoc of chatRoomsSnapshot.docs) {
        scannedRooms += 1;
        const room = roomDoc.data() || {};
        const parentId = getFirstString(room.parentId);
        if (!parentId) {
            skippedRooms += 1;
            continue;
        }

        if (!parentDocCache.has(parentId)) {
            parentDocCache.set(parentId, await db.collection('users').doc(parentId).get());
        }

        const parentDoc = parentDocCache.get(parentId);
        if (!parentDoc.exists) {
            skippedRooms += 1;
            console.warn(`[repair] skip chatRoom ${roomDoc.id}: users/${parentId} not found`);
            continue;
        }

        const parentAuthUid = getUserAuthUid(parentDoc);
        if (!parentAuthUid) {
            skippedRooms += 1;
            console.warn(`[repair] skip chatRoom ${roomDoc.id}: auth uid not found in users/${parentId}`);
            continue;
        }

        const participantIds = collectStringValues(room.participantIds);
        const parentUids = collectStringValues(room.parentUids);
        const needsParticipantId = !participantIds.includes(parentAuthUid);
        const needsParentUids = !parentUids.includes(parentAuthUid);

        if (!needsParticipantId && !needsParentUids) continue;

        updatedRooms += 1;
        console.log(JSON.stringify({
            roomId: roomDoc.id,
            parentId,
            parentAuthUid,
            participantIdsBefore: serializableValue(room.participantIds),
            parentUidsBefore: serializableValue(room.parentUids),
            addToParticipantIds: needsParticipantId,
            addToParentUids: needsParentUids,
        }));
        console.log(`[repair] ${dryRun ? 'would update' : 'update'} chatRoom ${roomDoc.id} for parent auth uid ${parentAuthUid}`);

        if (!dryRun) {
            pendingWrites.push(roomDoc.ref.set({
                participantIds: FieldValue.arrayUnion(parentAuthUid),
                parentUids: FieldValue.arrayUnion(parentAuthUid),
                backfilledParentAuthUidAt: FieldValue.serverTimestamp(),
            }, { merge: true }));
            if (pendingWrites.length >= 400) {
                await Promise.all(pendingWrites.splice(0));
            }
        }
    }

    if (!dryRun && pendingWrites.length) {
        await Promise.all(pendingWrites);
    }

    console.log(`[repair] chatRooms complete. scannedRooms=${scannedRooms}, ${dryRun ? 'wouldUpdate' : 'updated'}=${updatedRooms}, skippedRooms=${skippedRooms}`);
};

const runParentBackfill = async () => {
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
            const { sanitized, patch } = buildPatch(chatDoc.data() || {}, parentAuthUid) || {};
            if (!sanitized) continue;

            if (!patch) {
                logSanitization(chatDoc.id, sanitized);
                console.warn(`[backfill] skip chat ${chatDoc.id}: unable to build non-empty participantIds from available fields`);
                continue;
            }

            updatedChats += 1;
            logSanitization(chatDoc.id, sanitized);
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

const runAllChatsRepair = async () => {
    console.log(`[repair] all chats participantIds sanitization start (${dryRun ? 'dry-run' : 'write'})`);
    const chats = await findAllChats();
    const pendingWrites = [];
    let updatedChats = 0;
    let skippedChats = 0;

    for (const chatDoc of chats) {
        const { sanitized, patch } = buildPatch(chatDoc.data() || {}) || {};
        if (!sanitized) continue;
        if (!patch) {
            skippedChats += 1;
            logSanitization(chatDoc.id, sanitized);
            continue;
        }
        updatedChats += 1;
        logSanitization(chatDoc.id, sanitized);
        if (!dryRun) {
            pendingWrites.push(chatDoc.ref.set(patch, { merge: true }));
            if (pendingWrites.length >= 400) {
                await Promise.all(pendingWrites.splice(0));
            }
        }
    }

    if (!dryRun && pendingWrites.length) {
        await Promise.all(pendingWrites);
    }

    console.log(`[repair] complete. scannedChats=${chats.length}, ${dryRun ? 'wouldUpdate' : 'updated'}=${updatedChats}, skippedChats=${skippedChats}`);
};

const run = async () => {
    if (inspectChats) {
        await inspectChatRows();
        return;
    }

    if (allChats) {
        await runAllChatsRepair();
        return;
    }

    await runParentBackfill();
    await runChatRoomsParentAuthUidRepair();
};

run().catch((error) => {
    console.error('[backfill] failed', error);
    process.exitCode = 1;
});