const { assertClinicTransactionEmulatorEnvironment } = require('./transaction-emulator-safety.cjs');
const binding = assertClinicTransactionEmulatorEnvironment(process.env);
// No SDK import, Admin initialization or connection occurs before the guard.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { initializeApp, getApps, deleteApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
if (getApps().length) throw new Error('CLINIC_TRANSACTION_EMULATOR_SAFETY_STOP: fresh process required');
const app = initializeApp({ projectId: binding.projectId });
const db = getFirestore(app);
db.settings({ host: binding.host, ssl: false });
getAuth(app).getUser = async () => { throw new Error('AUTH_NETWORK_FORBIDDEN'); };
const { confirmClinicReservations } = require('../confirmClinicReservations');
const { confirmationEventKey } = require('../confirmationService');
const { updateClinicReservationTime } = require('../updateClinicReservationTime');
const prefix = `clinic-confirm-${randomUUID()}`;
const owned = new Map();
const millis = Date.now();
const day = (offset = 0) => new Date(millis + (30 + offset) * 86400000).toISOString().slice(0, 10);
const staffUid = `${prefix}-staff-auth`;
const studentId = `${prefix}-student-doc`;
const studentUid = `${prefix}-student-auth`;
const context = { auth: { uid: staffUid } };
const rawRun = db.runTransaction.bind(db);
let sequence = 0;
function own(collection, id) {
    const ref = db.collection(collection).doc(id);
    owned.set(ref.path, ref);
    return ref;
}
async function seed(collection, id, data) {
    assert.ok(id.startsWith(prefix));
    const ref = own(collection, id);
    await ref.set(data);
    return ref;
}
async function reservation(source = 'clinicReservations', patch = {}) {
    return seed(source, `${prefix}-reservation-${++sequence}`, { studentDocId: studentId, date: day(), plannedTime: '14:00',
        status: 'pending', comment: 'preserve', tutor: `${prefix}-teacher`, notificationSent: true, ...patch });
}
const item = (ref, revision = 0) => ({ sourceCollection: ref.parent.id, reservationId: ref.id, expectedRevision: revision });
function refs(request) {
    const key = confirmationEventKey(request);
    return { history: own('clinicReservationConfirmations', key), outbox: own('clinicConfirmationOutbox', key) };
}
function confirm(requests, caller = context) {
    requests.forEach(refs);
    return confirmClinicReservations.run({ reservations: requests }, caller);
}
async function unchanged(ref, before) {
    const after = await ref.get();
    assert.equal(after.exists, before.exists);
    if (before.exists) {
        assert.deepEqual(after.data(), before.data());
        assert.ok(after.updateTime.isEqual(before.updateTime));
    }
}
async function together(operations) {
    let arrivals = 0;
    let release;
    let reject;
    const ready = new Promise((resolve, fail) => { release = resolve; reject = fail; });
    const timeout = setTimeout(() => reject(new Error('Transaction entry barrier timed out')), 10000);
    db.runTransaction = async (...args) => {
        if (++arrivals === operations.length) release();
        await ready;
        return rawRun(...args);
    };
    try { return await Promise.allSettled(operations.map((operation) => operation())); }
    finally { clearTimeout(timeout); db.runTransaction = rawRun; }
}
test.before(async () => {
    const response = await fetch(`http://${binding.host}/`, { redirect: 'error', signal: AbortSignal.timeout(5000) });
    await response.body?.cancel();
    await seed('users', `${prefix}-staff-doc`, { role: 'staff', authUid: staffUid });
    await seed('userAuthIndex', staffUid, { userDocId: `${prefix}-staff-doc`, role: 'staff' });
    await seed('users', studentId, { role: 'student', authUid: studentUid });
    await seed('userAuthIndex', studentUid, { userDocId: studentId, role: 'student' });
});
test.after(async () => {
    db.runTransaction = rawRun;
    try {
        const results = await Promise.allSettled([...owned.values()].map(async (ref) => {
            const snapshot = await ref.get();
            if (!snapshot.exists) return;
            assert.ok(ref.id.startsWith(prefix) || snapshot.data().studentProfileDocId === studentId
                || snapshot.data().studentDocId === studentId, `Refuse unowned cleanup: ${ref.path}`);
            await ref.delete();
        }));
        const failures = results.filter((result) => result.status === 'rejected');
        if (failures.length) throw new AggregateError(failures.map((result) => result.reason), 'Owned document cleanup failed');
    } finally { await deleteApp(app); }
});

for (const source of ['clinicReservations', 'clinicLogs']) test(`${source}: confirmation, server timestamps and pending outbox commit together`, async () => {
    const ref = await reservation(source);
    const request = item(ref);
    const result = await confirm([request]);
    assert.equal(result.results[0].status, 'confirmed');
    const saved = (await ref.get()).data();
    const event = refs(request);
    const history = (await event.history.get()).data();
    const job = (await event.outbox.get()).data();
    assert.equal(saved.status, 'pending');
    assert.equal(saved.confirmedRevision, 0);
    assert.equal(saved.confirmedBy, staffUid);
    assert.ok(saved.confirmedAt instanceof Timestamp);
    assert.ok(saved.confirmedAt.isEqual(history.confirmedAt));
    assert.ok(saved.confirmedAt.isEqual(job.createdAt));
    assert.equal(history.studentProfileDocId, studentId);
    assert.notEqual(studentId, studentUid);
    assert.equal(job.state, 'pending');
    assert.equal(job.attempts, 0);
    assert.equal(history.reminderDueAt.toDate().toISOString(), `${day(-1)}T09:00:00.000Z`);
    const before = await ref.get();
    const historyBefore = await event.history.get();
    await event.outbox.update({ state: 'partial', attempts: 3, lastError: { code: 'future-worker-failure' } });
    const jobBefore = await event.outbox.get();
    assert.equal((await confirm([request])).results[0].status, 'already_confirmed');
    await unchanged(ref, before);
    await unchanged(event.history, historyBefore);
    await unchanged(event.outbox, jobBefore);
});

test('same revision concurrent calls create one history and outbox', { timeout: 90000 }, async () => {
    const ref = await reservation();
    const request = item(ref);
    const results = await together([() => confirm([request]), () => confirm([request])]);
    assert.ok(results.every((result) => result.status === 'fulfilled'));
    assert.deepEqual(results.map((result) => result.value.results[0].status).sort(), ['already_confirmed', 'confirmed']);
    const event = refs(request);
    assert.equal((await event.history.get()).exists, true);
    assert.equal((await event.outbox.get()).data().attempts, 0);
});

test('server rejects a staged three-document commit atomically, then retry succeeds', { timeout: 45000 }, async () => {
    const ref = await reservation();
    const request = item(ref);
    const event = refs(request);
    const before = await ref.get();
    const missing = own('clinicLogs', `${prefix}-missing-${++sequence}`);
    db.runTransaction = (callback) => rawRun(async (tx) => {
        const result = await callback(tx);
        tx.update(missing, { probe: true }); // Real server precondition failure, not a fake commit.
        return result;
    });
    let result;
    try { result = await confirm([request]); }
    finally { db.runTransaction = rawRun; }
    assert.equal(result.results[0].status, 'failed');
    assert.equal(result.results[0].error.code, 'not-found');
    await unchanged(ref, before);
    assert.equal((await event.history.get()).exists, false);
    assert.equal((await event.outbox.get()).exists, false);
    assert.equal((await confirm([request])).results[0].status, 'confirmed');
});

test('2-A time edit retains old history and reconfirmation creates a new event', async () => {
    const ref = await reservation();
    const first = item(ref);
    await confirm([first]);
    const event = refs(first);
    const before = await event.history.get();
    own('_clinicReservationDateLocks', createHash('sha256').update(JSON.stringify([studentId, day(1)])).digest('hex'));
    await updateClinicReservationTime.run({ ...first, date: day(1), plannedTime: '16:00' }, context);
    assert.equal((await ref.get()).data().confirmationStatus, 'reconfirmation_required');
    const next = item(ref, 1);
    assert.equal((await confirm([next])).results[0].status, 'confirmed');
    await unchanged(event.history, before);
    assert.equal((await event.outbox.get()).exists, true);
    assert.equal((await refs(next).history.get()).data().previousConfirmation.confirmedRevision, 0);
});

test('confirmation racing with 2-A time edit never confirms a stale revision at commit', { timeout: 90000 }, async () => {
    const ref = await reservation();
    const request = item(ref);
    const event = refs(request);
    own('_clinicReservationDateLocks', createHash('sha256').update(JSON.stringify([studentId, day(2)])).digest('hex'));
    const results = await together([() => confirm([request]),
        () => updateClinicReservationTime.run({ ...request, date: day(2), plannedTime: '17:00' }, context)]);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[1].status, 'fulfilled');
    const saved = (await ref.get()).data();
    assert.equal(saved.reservationRevision, 1);
    const confirmation = results[0].value.results[0];
    if (confirmation.status === 'confirmed') {
        assert.equal(saved.confirmationStatus, 'reconfirmation_required');
        assert.equal(saved.confirmedRevision, 0);
        assert.equal((await event.history.get()).data().reservationRevision, 0);
    } else {
        assert.equal(confirmation.status, 'failed');
        assert.equal(confirmation.error.code, 'aborted');
        assert.equal((await event.history.get()).exists, false);
        assert.equal((await event.outbox.get()).exists, false);
    }
});

test('bulk failures are independent; notification OFF does not block valid confirmations', async () => {
    const previous = process.env.NOTIFICATION_SENDING_ENABLED;
    process.env.NOTIFICATION_SENDING_ENABLED = 'false';
    try {
        const first = await reservation('clinicLogs', { status: 'noshow' });
        const second = await reservation();
        const firstBefore = await first.get();
        const result = await confirm([item(first), item(second)]);
        assert.deepEqual(result.results.map((entry) => entry.status), ['failed', 'confirmed']);
        assert.equal(result.results[0].error.code, 'failed-precondition');
        await unchanged(first, firstBefore); // Includes exact data and updateTime.
        assert.equal((await refs(item(first)).history.get()).exists, false);
        assert.equal((await refs(item(first)).outbox.get()).exists, false);
        assert.equal(result.results[1].sourceCollection, second.parent.id);
        assert.equal(result.results[1].reservationId, second.id);
        assert.equal(result.results[1].expectedRevision, 0);
        assert.equal(result.results[1].eventKey, confirmationEventKey(item(second)));
        assert.equal((await refs(item(second)).history.get()).data().sourcePath, second.path);
        assert.equal((await refs(item(second)).outbox.get()).data().state, 'pending');
    } finally {
        if (previous === undefined) delete process.env.NOTIFICATION_SENDING_ENABLED;
        else process.env.NOTIFICATION_SENDING_ENABLED = previous;
    }
});

test('initially inactive staff is denied without changing reservation/history/outbox', async () => {
    const staff = db.collection('users').doc(`${prefix}-staff-doc`);
    const staffBefore = (await staff.get()).data();
    const ref = await reservation();
    const before = await ref.get();
    const request = item(ref);
    const event = refs(request);
    try {
        await staff.update({ active: false }); // Same field used by deactivateStaff; role stays staff.
        await assert.rejects(confirm([request]), (cause) => cause.code === 'permission-denied');
        assert.equal((await staff.get()).data().role, 'staff');
        await unchanged(ref, before);
        assert.equal((await event.history.get()).exists, false);
        assert.equal((await event.outbox.get()).exists, false);
    } finally { await staff.set(staffBefore); }
});

test('deactivation between initial authorization and transaction is rejected on the actual profile read', async () => {
    const staff = db.collection('users').doc(`${prefix}-staff-doc`);
    const staffBefore = (await staff.get()).data();
    const ref = await reservation();
    const before = await ref.get();
    const request = item(ref);
    const event = refs(request);
    try {
        await staff.update({ active: true });
        db.runTransaction = async (...args) => {
            await staff.update({ active: false }); // Commit before the real confirmation transaction starts.
            return rawRun(...args);
        };
        const result = await confirm([request]);
        assert.equal(result.results[0].status, 'failed');
        assert.equal(result.results[0].error.code, 'permission-denied');
        await unchanged(ref, before);
        assert.equal((await event.history.get()).exists, false);
        assert.equal((await event.outbox.get()).exists, false);
    } finally { db.runTransaction = rawRun; await staff.set(staffBefore); }
});

test('concurrent staff deactivation and confirmation respect real Firestore serialization', { timeout: 90000 }, async () => {
    const staff = db.collection('users').doc(`${prefix}-staff-doc`);
    const staffBefore = (await staff.get()).data();
    const ref = await reservation();
    const before = await ref.get();
    const request = item(ref);
    const event = refs(request);
    try {
        await staff.update({ active: true });
        let release;
        const ready = new Promise((resolve) => { release = resolve; });
        const confirmation = (async () => { await ready; return confirm([request]); })();
        const deactivation = (async () => { await ready; return staff.update({ active: false }); })();
        release(); // Outside transactions: never wait while holding profile read locks.
        const [confirmed, deactivated] = await Promise.allSettled([confirmation, deactivation]);
        assert.equal(deactivated.status, 'fulfilled');
        const profile = (await staff.get()).data();
        assert.equal(profile.role, 'staff');
        assert.equal(profile.active, false);
        const result = confirmed.status === 'fulfilled' ? confirmed.value.results[0] : null;
        if (result?.status === 'confirmed') {
            // Confirmation may legally commit first; deactivation cannot undo it.
            for (const saved of [await ref.get(), await event.history.get(), await event.outbox.get()]) {
                assert.equal(saved.exists, true);
                assert.ok(saved.updateTime.toMillis() <= deactivated.value.writeTime.toMillis(),
                    'A successful confirmation must commit before staff deactivation');
            }
        } else {
            const code = confirmed.status === 'rejected' ? confirmed.reason.code : result?.error?.code;
            assert.equal(code, 'permission-denied');
            await unchanged(ref, before);
            assert.equal((await event.history.get()).exists, false);
            assert.equal((await event.outbox.get()).exists, false);
        }
    } finally { await staff.set(staffBefore); }
});
