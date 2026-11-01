// Explicit opt-in suite: do not include in generic unit-test globs.
// No Functions emulator or Messaging SDK is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const projectId = 'demo-clinic-reservation';
const host = '127.0.0.1:8080';
if (process.env.FIRESTORE_EMULATOR_HOST !== host || process.env.GCLOUD_PROJECT !== projectId
    || (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_PROJECT !== projectId)
    || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('CLINIC_EMULATOR_SAFETY_STOP: require exact loopback/demo project, no Auth emulator.');
}
// Import SDKs only AFTER the safety check. Mock user tokens are emulator-only.
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { initializeApp, deleteApp } = require('firebase/app');
const { getFirestore: getClientFirestore, connectFirestoreEmulator, doc, updateDoc, setDoc,
    deleteField, getDoc, terminate } = require('firebase/firestore');
const prefix = `clinic-rules-${randomUUID()}`;
const adminApp = initializeAdmin({ projectId }, prefix);
const adminDb = getFirestore(adminApp);
const created = [];
const clients = [];
const booking = { studentDocId: `${prefix}-student`, date: '2030-02-01', plannedTime: '14:00', status: 'pending',
    reservationRevision: 0, confirmationStatus: 'unconfirmed', confirmedAt: null, confirmedBy: null, confirmedRevision: null,
    reservationStartsAt: new Date('2030-02-01T05:00:00Z'), reminderDueAt: new Date('2030-01-31T09:00:00Z') };
let staff;
let viewer;
let anonymous;
function client(uid) {
    const app = initializeApp({ projectId, apiKey: 'fictional-emulator-only-api-key' }, `${prefix}-${clients.length}`);
    const db = getClientFirestore(app);
    connectFirestoreEmulator(db, '127.0.0.1', 8080, uid ? { mockUserToken: { sub: uid, user_id: uid } } : {});
    clients.push({ app, db });
    return db;
}
async function seed(source, id, data) {
    const ref = adminDb.collection(source).doc(id);
    created.push(ref);
    await ref.set(data);
    return ref.path;
}
async function denied(operation) {
    await assert.rejects(operation, (error) => error.code === 'permission-denied');
}
test.before(async () => {
    const response = await fetch(`http://${host}/emulator/v1/projects/${projectId}:securityRules`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules',
            content: fs.readFileSync(path.resolve(__dirname, '../../../../firestore.rules'), 'utf8') }] } }),
    });
    assert.equal(response.ok, true, await response.text());
    await seed('users', `${prefix}-staff-profile`, { role: 'staff', authUid: `${prefix}-staff-auth` });
    await seed('userAuthIndex', `${prefix}-staff-auth`, { userDocId: `${prefix}-staff-profile`, role: 'staff' });
    await seed('users', `${prefix}-student`, { role: 'student', authUid: `${prefix}-student-auth` });
    await seed('userAuthIndex', `${prefix}-student-auth`, { userDocId: `${prefix}-student`, role: 'student' });
    staff = client(`${prefix}-staff-auth`);
    viewer = client(`${prefix}-student-auth`);
    anonymous = client();
});
test.after(async () => {
    // Delete only exact unique documents created by this suite, never clear a database.
    await Promise.all(clients.map(async ({ app, db }) => { await terminate(db); await deleteApp(app); }));
    await Promise.all(created.map((ref) => ref.delete()));
    await deleteAdmin(adminApp);
});

for (const source of ['clinicReservations', 'clinicLogs']) {
    test(`${source}: staff direct time changes and server-field additions/removals are denied`, async () => {
        const target = await seed(source, `${prefix}-${source}-protected`, booking);
        for (const patch of [{ date: '2030-02-02' }, { plannedTime: '15:00' }, { timeSlot: '15:00' },
            { reservationRevision: 1 }, { confirmationStatus: 'confirmed' }, { confirmedAt: new Date() },
            { confirmedBy: 'forged' }, { confirmedRevision: 0 }, { reservationStartsAt: new Date() },
            { reminderDueAt: new Date() }, { confirmedBy: deleteField() }]) {
            await denied(updateDoc(doc(staff, target), patch));
        }
    });
    test(`${source}: comment/check-in/check-out/activity status save remains allowed`, async () => {
        const target = await seed(source, `${prefix}-${source}-activity`, booking);
        await updateDoc(doc(staff, target), { comment: 'fictional comment', tutor: 'fictional teacher', checkIn: '14:00',
            checkOut: '15:00', status: 'attended', notificationSent: true });
        assert.equal((await getDoc(doc(staff, target))).data().comment, 'fictional comment');
        await denied(updateDoc(doc(viewer, target), { comment: 'forbidden' }));
        await denied(updateDoc(doc(anonymous, target), { comment: 'forbidden' }));
        assert.equal((await getDoc(doc(viewer, target))).exists(), true);
    });
    test(`${source}: legacy field insertion and whole-document replacement cannot bypass protection`, async () => {
        const legacy = { studentId: `${prefix}-student`, date: booking.date, plannedTime: booking.plannedTime, status: 'pending' };
        const target = await seed(source, `${prefix}-${source}-legacy`, legacy);
        await denied(updateDoc(doc(staff, target), { confirmationStatus: 'confirmed' }));
        await denied(setDoc(doc(staff, target), { ...legacy, date: '2030-02-02' }));
        await updateDoc(doc(staff, target), { comment: 'legacy comments still work' });
    });
}
test('unreserved clinic activity creation and corrections remain allowed; conversion to reservation is denied', async () => {
    const id = `${prefix}-unreserved`;
    created.push(adminDb.collection('clinicLogs').doc(id));
    const ref = doc(staff, 'clinicLogs', id);
    await setDoc(ref, { studentId: `${prefix}-student`, date: booking.date, plannedTime: null, status: 'attended', comment: '' });
    await updateDoc(ref, { date: '2030-02-02', comment: 'corrected activity' });
    await denied(updateDoc(ref, { plannedTime: '15:00', status: 'pending' }));
});
test('clients cannot create reserved documents or write the server lock collection', async () => {
    for (const source of ['clinicLogs', 'clinicReservations']) {
        const id = `${prefix}-forged-${source}`;
        created.push(adminDb.collection(source).doc(id));
        await denied(setDoc(doc(staff, source, id), { date: booking.date, plannedTime: '14:00', status: 'pending' }));
    }
    const id = `${prefix}-forged-lock`;
    created.push(adminDb.collection('_clinicReservationDateLocks').doc(id));
    await denied(setDoc(doc(staff, '_clinicReservationDateLocks', id), { version: 999 }));
});
