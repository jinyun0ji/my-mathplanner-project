const { assertClinicTransactionEmulatorEnvironment } = require('./transaction-emulator-safety.cjs');
const binding = assertClinicTransactionEmulatorEnvironment(process.env);
// Explicit Firestore-only demo suite; no Auth/FCM/Functions requests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { initializeApp, deleteApp } = require('firebase/app');
const { getFirestore: getClientFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, terminate } = require('firebase/firestore');
const prefix = `clinic-inbox-rules-${randomUUID()}`;
const app = initializeAdmin({ projectId: binding.projectId }, prefix);
const db = getFirestore(app);
db.settings({ host: binding.host, ssl: false });
const owned = [];
const clients = [];
const receiptId = `${prefix}-receipt`;
const studentUid = `${prefix}-student-auth`;
let staff;
let student;
let parent;
let anonymous;
async function seed(collection, id, data) {
    const ref = db.collection(collection).doc(id); owned.push(ref); await ref.set(data);
}
function client(uid) {
    const app = initializeApp({ projectId: binding.projectId, apiKey: 'fictional-emulator-key' }, `${prefix}-${clients.length}`);
    const db = getClientFirestore(app);
    connectFirestoreEmulator(db, '127.0.0.1', binding.port, uid ? { mockUserToken: { sub: uid, user_id: uid } } : {});
    clients.push({ app, db }); return db;
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
    await seed('clinicConfirmationDeliveries', receiptId, { recipientAuthUid: studentUid, inboxState: 'created', pushState: 'pending' });
    staff = client(`${prefix}-staff-auth`); student = client(studentUid);
    parent = client(`${prefix}-parent-auth`); anonymous = client();
});
test.after(async () => {
    try {
        const results = await Promise.allSettled([
            ...clients.map(async ({ app, db }) => { await terminate(db); await deleteApp(app); }),
            ...owned.map((ref) => ref.delete()),
        ]);
        const errors = results.filter((result) => result.status === 'rejected');
        if (errors.length) throw new AggregateError(errors.map((result) => result.reason), 'Owned test cleanup failed');
    } finally { await deleteAdmin(app); }
});

test('delivery receipts are unreadable and unwritable to all clients including staff and recipient', async () => {
    for (const client of [staff, student, parent, anonymous]) {
        const id = `${prefix}-forged-${clients.findIndex((entry) => entry.db === client)}`;
        owned.push(db.collection('clinicConfirmationDeliveries').doc(id));
        await denied(getDoc(doc(client, 'clinicConfirmationDeliveries', receiptId)));
        await denied(setDoc(doc(client, 'clinicConfirmationDeliveries', id), { pushState: 'accepted' }));
        await denied(updateDoc(doc(client, 'clinicConfirmationDeliveries', receiptId), { pushState: 'accepted' }));
        await denied(deleteDoc(doc(client, 'clinicConfirmationDeliveries', receiptId)));
    }
});
test('new Auth UID inbox retains existing owner read/read-marking rights while receipt stays private', async () => {
    const ref = db.collection('notifications').doc(studentUid).collection('items').doc(`${prefix}-item`);
    owned.push(ref);
    await ref.set({ type: 'CLINIC_RESERVATION_CONFIRMED', title: '클리닉 예약 완료', body: '2030-01-01 14:00', isRead: false,
        createdAt: new Date(), eventKey: `${prefix}-event`, deliveryId: receiptId });
    const target = doc(student, 'notifications', studentUid, 'items', ref.id);
    assert.equal((await getDoc(target)).data().isRead, false);
    await updateDoc(target, { isRead: true, readAt: new Date() });
    assert.equal((await getDoc(target)).data().isRead, true);
    await denied(getDoc(doc(anonymous, 'notifications', studentUid, 'items', ref.id)));
    await denied(getDoc(doc(student, 'clinicConfirmationDeliveries', receiptId)));
});
