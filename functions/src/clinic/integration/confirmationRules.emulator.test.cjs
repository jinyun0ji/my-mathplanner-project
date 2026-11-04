const { assertClinicTransactionEmulatorEnvironment } = require('./transaction-emulator-safety.cjs');
const binding = assertClinicTransactionEmulatorEnvironment(process.env);
// Uploads Rules ONLY to the explicitly selected non-8080 demo emulator.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { initializeApp, deleteApp } = require('firebase/app');
const { getFirestore: getClientFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc,
    deleteDoc, deleteField, terminate } = require('firebase/firestore');
const prefix = `clinic-confirm-rules-${randomUUID()}`;
const app = initializeAdmin({ projectId: binding.projectId }, prefix);
const db = getFirestore(app);
db.settings({ host: binding.host, ssl: false });
const owned = [];
const clients = [];
const historyId = `${prefix}-history`;
const outboxId = `${prefix}-outbox`;
let staff;
let student;
let parent;
let anonymous;
async function seed(source, id, data) {
    const ref = db.collection(source).doc(id);
    owned.push(ref);
    await ref.set(data);
}
function client(uid) {
    const app = initializeApp({ projectId: binding.projectId, apiKey: 'fictional-emulator-api-key' }, `${prefix}-${clients.length}`);
    const db = getClientFirestore(app);
    connectFirestoreEmulator(db, '127.0.0.1', binding.port, uid ? { mockUserToken: { sub: uid, user_id: uid } } : {});
    clients.push({ app, db });
    return db;
}
const denied = (promise) => assert.rejects(promise, (cause) => cause.code === 'permission-denied');
test.before(async () => {
    const response = await fetch(`http://${binding.host}/emulator/v1/projects/${binding.projectId}:securityRules`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: fs.readFileSync(path.resolve(__dirname, '../../../../firestore.rules'), 'utf8') }] } }),
    });
    assert.equal(response.ok, true, await response.text());
    for (const role of ['staff', 'student', 'parent']) {
        await seed('users', `${prefix}-${role}-doc`, { role, authUid: `${prefix}-${role}-auth` });
        await seed('userAuthIndex', `${prefix}-${role}-auth`, { role, userDocId: `${prefix}-${role}-doc` });
    }
    await seed('clinicReservationConfirmations', historyId, { marker: prefix, confirmedBy: `${prefix}-staff-auth` });
    await seed('clinicConfirmationOutbox', outboxId, { marker: prefix, state: 'pending', recipientResults: {} });
    staff = client(`${prefix}-staff-auth`);
    student = client(`${prefix}-student-auth`);
    parent = client(`${prefix}-parent-auth`);
    anonymous = client();
});
test.after(async () => {
    try {
        const results = await Promise.allSettled([
            ...clients.map(async ({ app, db }) => { await terminate(db); await deleteApp(app); }),
            ...owned.map((ref) => ref.delete()),
        ]);
        const failures = results.filter((result) => result.status === 'rejected');
        if (failures.length) throw new AggregateError(failures.map((result) => result.reason), 'Owned test cleanup failed');
    } finally { await deleteAdmin(app); }
});

test('confirmation history can be read by staff, not students/parents/anonymous', async () => {
    assert.equal((await getDoc(doc(staff, 'clinicReservationConfirmations', historyId))).exists(), true);
    for (const db of [student, parent, anonymous]) await denied(getDoc(doc(db, 'clinicReservationConfirmations', historyId)));
});
test('all clients including staff are denied history create/update/delete', async () => {
    for (const db of [staff, student, parent, anonymous]) {
        const id = `${prefix}-forged-history-${clients.findIndex((entry) => entry.db === db)}`;
        owned.push(getFirestore(app).collection('clinicReservationConfirmations').doc(id));
        await denied(setDoc(doc(db, 'clinicReservationConfirmations', id), { confirmedBy: 'forged' }));
        await denied(updateDoc(doc(db, 'clinicReservationConfirmations', historyId), { confirmedBy: 'forged' }));
        await denied(deleteDoc(doc(db, 'clinicReservationConfirmations', historyId)));
    }
});
test('outbox and future recipient results cannot be read or written by any client including staff', async () => {
    for (const db of [staff, student, parent, anonymous]) {
        const id = `${prefix}-forged-outbox-${clients.findIndex((entry) => entry.db === db)}`;
        owned.push(getFirestore(app).collection('clinicConfirmationOutbox').doc(id));
        await denied(getDoc(doc(db, 'clinicConfirmationOutbox', outboxId)));
        await denied(setDoc(doc(db, 'clinicConfirmationOutbox', id), { state: 'completed' }));
        await denied(updateDoc(doc(db, 'clinicConfirmationOutbox', outboxId), { state: 'completed' }));
        await denied(deleteDoc(doc(db, 'clinicConfirmationOutbox', outboxId)));
    }
});
for (const source of ['clinicReservations', 'clinicLogs']) test(`${source}: confirmation field protection and normal clinic edits/read access remain intact`, async () => {
    const id = `${prefix}-${source}`;
    await seed(source, id, { date: '2030-01-01', plannedTime: '14:00', status: 'pending', reservationRevision: 0,
        confirmationStatus: 'confirmed', confirmedRevision: 0, confirmedBy: `${prefix}-staff-auth`, confirmedAt: new Date('2029-01-01T00:00:00Z') });
    for (const patch of [{ confirmationStatus: 'unconfirmed' }, { confirmedRevision: 1 }, { confirmedBy: 'forged' },
        { confirmedAt: new Date('2029-01-02T00:00:00Z') }, { confirmedBy: deleteField() }]) await denied(updateDoc(doc(staff, source, id), patch));
    await updateDoc(doc(staff, source, id), { comment: 'keep old edit capability', tutor: 'fictional teacher', checkIn: '14:00', status: 'attended' });
    assert.equal((await getDoc(doc(student, source, id))).exists(), true);
    assert.equal((await getDoc(doc(parent, source, id))).exists(), true);
    await denied(updateDoc(doc(student, source, id), { comment: 'forbidden' }));
});
