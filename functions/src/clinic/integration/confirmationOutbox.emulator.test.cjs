const { assertClinicTransactionEmulatorEnvironment } = require('./transaction-emulator-safety.cjs');
const binding = assertClinicTransactionEmulatorEnvironment(process.env);
// Firestore-only suite. Auth is an explicit fictional-account map; NO Auth,
// Messaging or Functions emulator/deployed endpoint is contacted by this code.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { initializeApp, getApps, deleteApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
if (getApps().length) throw new Error('CLINIC_TRANSACTION_EMULATOR_SAFETY_STOP: fresh process required');
const app = initializeApp({ projectId: binding.projectId });
const db = getFirestore(app);
db.settings({ host: binding.host, ssl: false });
const { createClinicConfirmationService } = require('../confirmationService');
const { createClinicConfirmationOutboxService, notificationIdFor } = require('../confirmationOutbox');
const { createClinicConfirmationRecipientResolver } = require('../confirmationRecipients');
const { createUpdateClinicReservationTime } = require('../updateClinicReservationTime');
const prefix = `clinic-inbox-${randomUUID()}`;
const owned = new Map();
const rawRun = db.runTransaction.bind(db);
const started = Date.now();
const day = (offset = 0) => new Date(started + (30 + offset) * 86400000).toISOString().slice(0, 10);
const staffUid = `${prefix}-staff-auth`;
let sequence = 0;
function own(path) { const ref = db.doc(path); owned.set(path, ref); return ref; }
async function seed(path, data) {
    assert.ok(path.split('/')[1].startsWith(prefix));
    const ref = own(path); await ref.set(data); return ref;
}
async function unchanged(ref, before) {
    const after = await ref.get();
    assert.deepEqual(after.data(), before.data());
    assert.ok(after.updateTime.isEqual(before.updateTime));
}
async function fixture(source = 'clinicReservations') {
    const id = ++sequence;
    const studentId = `${prefix}-student-doc-${id}`;
    const studentUid = `${prefix}-student-auth-${id}`;
    const parentId = `${prefix}-parent-doc-${id}`;
    const parentUid = `${prefix}-parent-auth-${id}`;
    const records = new Map([[studentUid, {}], [parentUid, {}]]);
    const failures = new Set();
    const auth = { getUser: async (uid) => {
        if (failures.has(uid)) throw Object.assign(new Error('Fictional Auth outage'), { code: 'auth/internal-error' });
        if (!records.has(uid)) throw Object.assign(new Error('Fictional account not found'), { code: 'auth/user-not-found' });
        return { uid, disabled: false, ...records.get(uid) };
    } };
    await seed(`users/${studentId}`, { role: 'student', authUid: studentUid });
    await seed(`userAuthIndex/${studentUid}`, { userDocId: studentId });
    await seed(`users/${parentId}`, { role: 'parent', authUid: parentUid, studentIds: [studentId] });
    await seed(`userAuthIndex/${parentUid}`, { userDocId: parentId });
    const sourceRef = await seed(`${source}/${prefix}-booking-${id}`, { studentDocId: studentId, date: day(), plannedTime: '14:00', status: 'pending', comment: 'preserve' });
    const request = { sourceCollection: source, reservationId: sourceRef.id, expectedRevision: 0 };
    const confirmation = await createClinicConfirmationService({ db }).confirmReservations({ reservations: [request] }, { auth: { uid: staffUid } });
    assert.equal(confirmation.results[0].status, 'confirmed');
    const eventKey = confirmation.results[0].eventKey;
    const historyRef = own(`clinicReservationConfirmations/${eventKey}`);
    const jobRef = own(`clinicConfirmationOutbox/${eventKey}`);
    let millis = Date.now();
    let enabled = true;
    const now = () => Timestamp.fromMillis(millis);
    const inboxRef = (uid) => own(`notifications/${uid}/items/${notificationIdFor(eventKey, uid)}`);
    const receiptRef = (uid) => own(`clinicConfirmationDeliveries/${notificationIdFor(eventKey, uid)}`);
    const track = () => [...records.keys()].forEach((uid) => { inboxRef(uid); receiptRef(uid); });
    const process = (options = {}) => {
        track();
        return createClinicConfirmationOutboxService({ db, auth, now, sendingEnabled: () => enabled, ...options }).process(eventKey);
    };
    return { studentId, studentUid, parentId, parentUid, records, failures, auth, now, sourceRef, historyRef, jobRef, request, eventKey,
        inboxRef, receiptRef, process, advance: (ms = 30001) => { millis += ms; }, enable: (value) => { enabled = value; },
        resolve: createClinicConfirmationRecipientResolver({ db, auth }) };
}
test.before(async () => {
    const response = await fetch(`http://${binding.host}/`, { redirect: 'error', signal: AbortSignal.timeout(5000) });
    await response.body?.cancel();
    await seed(`users/${prefix}-staff-doc`, { role: 'staff', authUid: staffUid });
    await seed(`userAuthIndex/${staffUid}`, { userDocId: `${prefix}-staff-doc` });
});
test.after(async () => {
    db.runTransaction = rawRun;
    try {
        const results = await Promise.allSettled([...owned.values()].map(async (ref) => {
            const snapshot = await ref.get();
            if (!snapshot.exists) return;
            const data = snapshot.data();
            assert.ok(ref.path.split('/')[1].startsWith(prefix) || data.studentProfileDocId?.startsWith(prefix)
                || data.studentDocId?.startsWith(prefix), `Refuse unowned cleanup: ${ref.path}`);
            await ref.delete();
        }));
        const errors = results.filter((result) => result.status === 'rejected');
        if (errors.length) throw new AggregateError(errors.map((result) => result.reason), 'Owned document cleanup failed');
    } finally { await deleteApp(app); }
});

for (const source of ['clinicReservations', 'clinicLogs']) test(`${source}: actual SDK creates paired inbox/receipts without changing confirmation`, async () => {
    const c = await fixture(source);
    const before = await c.sourceRef.get();
    const history = await c.historyRef.get();
    const result = await c.process();
    assert.equal(result.state, 'completed');
    assert.equal(result.newItemCount, 2);
    for (const uid of [c.studentUid, c.parentUid]) {
        const inbox = (await c.inboxRef(uid).get()).data();
        const receipt = (await c.receiptRef(uid).get()).data();
        assert.equal(inbox.title, '클리닉 예약 완료');
        assert.equal(inbox.body, `${day()} 14:00`);
        assert.equal(inbox.ref, c.sourceRef.path);
        assert.equal(inbox.recipientAuthUid, uid);
        assert.equal(receipt.inboxState, 'created');
        assert.equal(receipt.pushState, 'pending');
        assert.ok(inbox.createdAt instanceof Timestamp);
    }
    assert.equal((await own(`notifications/${c.studentId}/items/${notificationIdFor(c.eventKey, c.studentId)}`).get()).exists, false);
    await unchanged(c.sourceRef, before);
    await unchanged(c.historyRef, history);
});
test('multiple real Firestore parent links and review aliases resolve to verified fictional Auth accounts', async () => {
    const c = await fixture();
    const review = `${prefix}-review-${sequence}`;
    const second = `${prefix}-second-parent-${sequence}`;
    const secondUid = `${prefix}-second-auth-${sequence}`;
    await seed(`userAuthIndex/${review}`, { userDocId: c.studentId });
    await seed(`users/${second}`, { role: 'parent', authUid: secondUid, childrenIds: [{ id: c.studentId }] });
    await seed(`userAuthIndex/${secondUid}`, { userDocId: second });
    c.records.set(review, {}); c.records.set(secondUid, {});
    assert.equal((await c.process()).targetCount, 4);
    for (const uid of [c.studentUid, review, c.parentUid, secondUid]) assert.equal((await c.inboxRef(uid).get()).exists, true);
});
test('profile inactivity, Auth disabled and conflicting binding exclude only affected recipients', async () => {
    const c = await fixture();
    await db.doc(`users/${c.parentId}`).update({ active: false });
    assert.equal((await c.process()).state, 'completed');
    assert.equal((await c.inboxRef(c.parentUid).get()).exists, false);
    const second = await fixture();
    second.records.set(second.studentUid, { disabled: true });
    assert.equal((await second.process()).state, 'completed');
    assert.equal((await second.inboxRef(second.studentUid).get()).exists, false);
    assert.equal((await second.inboxRef(second.parentUid).get()).exists, true);
    const conflict = await fixture();
    await db.doc(`userAuthIndex/${conflict.parentUid}`).update({ userDocId: `${prefix}-wrong-profile` });
    assert.equal((await conflict.process()).state, 'partial');
    assert.equal((await conflict.inboxRef(conflict.studentUid).get()).exists, true);
    assert.equal((await conflict.inboxRef(conflict.parentUid).get()).exists, false);
});
test('concurrent workers publish one set and only one claim attempt', { timeout: 90000 }, async () => {
    const c = await fixture();
    const results = await Promise.all([c.process(), c.process()]);
    assert.equal(results.filter((result) => result.newItemCount === 2).length, 1);
    assert.ok(results.every((result) => ['completed', 'busy'].includes(result.state)));
    assert.equal((await c.jobRef.get()).data().attempts, 1);
    for (const uid of [c.studentUid, c.parentUid]) assert.equal((await c.receiptRef(uid).get()).exists, true);
});
test('real rejected commit leaves no subset of inbox/receipt pairs, then retries safely', { timeout: 45000 }, async () => {
    const c = await fixture();
    const before = await c.sourceRef.get();
    const history = await c.historyRef.get();
    const missing = own(`clinicLogs/${prefix}-missing-${sequence}`);
    let calls = 0;
    db.runTransaction = (callback) => {
        const publication = ++calls === 2;
        return rawRun(async (tx) => {
            const result = await callback(tx);
            if (publication) tx.update(missing, { probe: true });
            return result;
        });
    };
    try { assert.equal((await c.process()).state, 'partial'); }
    finally { db.runTransaction = rawRun; }
    for (const uid of [c.studentUid, c.parentUid]) {
        assert.equal((await c.inboxRef(uid).get()).exists, false);
        assert.equal((await c.receiptRef(uid).get()).exists, false);
    }
    await unchanged(c.sourceRef, before); await unchanged(c.historyRef, history);
    c.advance(); assert.equal((await c.process()).state, 'completed');
});
test('rereading paired inbox preserves real updateTime, read fields and future unknown push state', async () => {
    const c = await fixture();
    await c.process();
    await c.inboxRef(c.studentUid).update({ isRead: true, readAt: Timestamp.now() });
    await c.receiptRef(c.studentUid).update({ pushState: 'unknown', pushAttempts: 1 });
    const inbox = await c.inboxRef(c.studentUid).get();
    const receipt = await c.receiptRef(c.studentUid).get();
    await c.jobRef.update({ state: 'partial', nextAttemptAt: null });
    assert.equal((await c.process()).newItemCount, 0);
    await unchanged(c.inboxRef(c.studentUid), inbox); await unchanged(c.receiptRef(c.studentUid), receipt);
});
test('flag OFF defers; due retry after enabling creates inboxes', async () => {
    const c = await fixture();
    c.enable(false);
    assert.equal((await c.process()).state, 'deferred');
    assert.equal((await c.inboxRef(c.studentUid).get()).exists, false);
    c.enable(true); c.advance(); assert.equal((await c.process()).state, 'completed');
});
test('expired owner cannot publish after replacement owner commits', { timeout: 45000 }, async () => {
    const c = await fixture();
    let notify;
    let resume;
    const claimed = new Promise((resolve) => { notify = resolve; });
    const wait = new Promise((resolve) => { resume = resolve; });
    const first = c.process({ leaseMs: 1000, resolveRecipients: async (input) => {
        const result = await c.resolve(input); notify(); await wait; return result;
    } });
    first.catch(() => notify()); // Fail promptly rather than hanging at the barrier on a setup/RPC error.
    await claimed;
    try {
        assert.equal((await c.process()).state, 'busy');
        c.advance(1001);
        assert.equal((await c.process()).state, 'completed');
    } finally { resume(); }
    assert.equal((await first).state, 'lease_lost');
    assert.equal((await c.jobRef.get()).data().attempts, 2);
});
test('2-A edit after claim suppresses old inbox publication', async () => {
    const c = await fixture();
    const lockId = createHash('sha256').update(JSON.stringify([c.studentId, day(1)])).digest('hex');
    own(`_clinicReservationDateLocks/${lockId}`);
    const result = await c.process({ resolveRecipients: async (input) => {
        const resolution = await c.resolve(input);
        await createUpdateClinicReservationTime({ db, auth: c.auth, now: c.now })({ ...c.request, date: day(1), plannedTime: '15:00' }, { auth: { uid: staffUid } });
        return resolution;
    } });
    assert.equal(result.state, 'superseded');
    assert.equal((await c.inboxRef(c.studentUid).get()).exists, false);
});
test('parent unlink and transient Auth failure preserve good student then retry only missing target', async () => {
    const c = await fixture();
    c.failures.add(c.parentUid);
    assert.equal((await c.process()).state, 'partial');
    const saved = await c.inboxRef(c.studentUid).get();
    assert.equal((await c.inboxRef(c.parentUid).get()).exists, false);
    c.failures.clear(); c.advance();
    assert.equal((await c.process()).state, 'completed');
    await unchanged(c.inboxRef(c.studentUid), saved);
    const unlinked = await fixture();
    assert.equal((await unlinked.process({ resolveRecipients: async (input) => {
        const resolution = await unlinked.resolve(input);
        await db.doc(`users/${unlinked.parentId}`).update({ studentIds: [] });
        return resolution;
    } })).state, 'partial');
    assert.equal((await unlinked.inboxRef(unlinked.studentUid).get()).exists, true);
    assert.equal((await unlinked.inboxRef(unlinked.parentUid).get()).exists, false);
});
test('inactive and started sources are superseded without new inbox', async () => {
    for (const patch of [{ status: 'cancelled' }, { status: 'completed' }, { status: 'noshow' }, { checkIn: '14:00' }, null]) {
        const c = await fixture();
        if (patch === null) await c.sourceRef.delete();
        else await c.sourceRef.update(patch);
        assert.equal((await c.process()).state, 'superseded');
        assert.equal((await c.inboxRef(c.studentUid).get()).exists, false);
    }
});
