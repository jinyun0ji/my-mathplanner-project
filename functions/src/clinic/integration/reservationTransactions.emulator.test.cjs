// Opt-in only. This suite NEVER uploads Rules or starts/calls deployed Functions.
const { assertClinicTransactionEmulatorEnvironment } = require('./transaction-emulator-safety.cjs');
const binding = assertClinicTransactionEmulatorEnvironment(process.env);
// Validate BEFORE any Firebase import or Admin initialization.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { initializeApp, getApps, deleteApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
if (getApps().length) throw new Error('CLINIC_TRANSACTION_EMULATOR_SAFETY_STOP: run in a fresh Node process.');
const app = initializeApp({ projectId: binding.projectId }); // Default app needed by createClinicReservation.
const db = getFirestore(app);
db.settings({ host: binding.host, ssl: false });
// Firestore uses the REAL Admin SDK. Auth is not emulated: prevent its only
// identity-resolver API from making any network request, even for legacy IDs.
const auth = getAuth(app);
const originalGetUser = auth.getUser;
auth.getUser = async () => { throw Object.assign(new Error('No Auth network in this suite'), { code: 'auth/user-not-found' }); };
const { updateClinicReservationTime } = require('../updateClinicReservationTime');
const { createClinicReservation } = require('../createClinicReservation');

const prefix = `clinic-tx-${randomUUID()}`;
const owned = new Map();
const rawRunTransaction = db.runTransaction.bind(db);
let sequence = 0;
let studentId;
let studentAuthUid;
let reviewUid;
const staffId = `${prefix}-staff-doc`;
const staffUid = `${prefix}-staff-auth`;
const viewerUid = `${prefix}-viewer-auth`;
const staffContext = { auth: { uid: staffUid } };
const sources = ['clinicReservations', 'clinicLogs'];
// Future dates relative to execution, independent of Node/OS timezone.
const suiteStartMillis = Date.now();
const day = (offset) => new Date(suiteStartMillis + (30 + offset) * 86400000).toISOString().slice(0, 10);
const allowedWrites = new Set([...sources, '_clinicReservationDateLocks']);
const registerWrite = (ref, data) => {
    assert.ok(allowedWrites.has(ref.parent.id), `Unexpected service write: ${ref.path}`);
    if (data?.studentDocId) assert.ok(data.studentDocId.startsWith(prefix), 'Refuse non-test student writes');
    assert.ok(owned.has(ref.path) || data?.studentDocId?.startsWith(prefix), 'Refuse unowned service writes');
    owned.set(ref.path, ref);
};
// Observe exact document references for cleanup, including auto-ID reservations
// and lock writes from retried/failed transactions. Forward every operation to
// the actual SDK; no in-memory Firestore/commit implementation is substituted.
db.runTransaction = (callback, options) => rawRunTransaction(async (tx) => {
    const set = tx.set.bind(tx);
    const update = tx.update.bind(tx);
    tx.set = (ref, data, ...args) => { registerWrite(ref, data); return set(ref, data, ...args); };
    tx.update = (ref, data, ...args) => { registerWrite(ref, data); return update(ref, data, ...args); };
    return callback(tx);
}, options);
const observedRunTransaction = db.runTransaction;

async function seed(source, id, data) {
    assert.ok(id.startsWith(prefix));
    const ref = db.collection(source).doc(id);
    owned.set(ref.path, ref);
    await ref.set(data);
    return ref;
}
function lockRef(date) {
    const id = createHash('sha256').update(JSON.stringify([studentId, date])).digest('hex');
    const ref = db.collection('_clinicReservationDateLocks').doc(id);
    owned.set(ref.path, ref);
    return ref;
}
async function reservation(source = 'clinicReservations', patch = {}) {
    return seed(source, `${prefix}-reservation-${++sequence}`, { studentDocId: studentId, studentId,
        authUid: studentAuthUid, classId: `${prefix}-class`, date: day(0), plannedTime: '14:00', status: 'pending',
        comment: 'preserve comment', tutor: `${prefix}-teacher`, staffMemoRef: `${prefix}-memo`,
        checkIn: '', checkOut: '', notificationSent: true, legacyPayload: { marker: prefix }, ...patch });
}
function change(ref, patch = {}, context = staffContext) {
    return updateClinicReservationTime.run({ sourceCollection: ref.parent.id, reservationId: ref.id,
        expectedRevision: 0, date: day(1), plannedTime: '15:30', ...patch }, context);
}
function create(date, context = staffContext) {
    return createClinicReservation.run({ studentDocId: studentId, classId: `${prefix}-class`, date, timeSlot: '17:00' }, context);
}
const rejectsCode = (promise, code) => assert.rejects(promise, (error) => error.code === code);
async function unchanged(ref, before) {
    const after = await ref.get();
    assert.equal(after.exists, before.exists);
    if (before.exists) {
        assert.deepEqual(after.data(), before.data());
        assert.ok(after.updateTime.isEqual(before.updateTime), `Unexpected write: ${ref.path}`);
    }
}
async function studentDayReservations(date) {
    const snapshots = await Promise.all(sources.map((source) => db.collection(source).where('date', '==', date).get()));
    return snapshots.flatMap((snapshot) => snapshot.docs).filter((doc) => doc.data().studentDocId === studentId);
}
function oneWinner(results, losingCode) {
    assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
    const loser = results.find((item) => item.status === 'rejected');
    assert.ok(loser, 'Expected a rejected competing operation');
    assert.equal(loser.reason.code, losingCode);
}
async function together(operations) {
    let arrivals = 0;
    let release;
    let reject;
    const ready = new Promise((resolve, fail) => { release = resolve; reject = fail; });
    const timeout = setTimeout(() => reject(new Error('Transaction entry barrier timed out')), 10000);
    // Synchronize before transactions acquire locks, never after locking a doc.
    db.runTransaction = async (...args) => {
        if (++arrivals === operations.length) release();
        await ready;
        return observedRunTransaction(...args);
    };
    try { return await Promise.allSettled(operations.map((operation) => operation())); }
    finally { clearTimeout(timeout); db.runTransaction = observedRunTransaction; }
}

test.before(async () => {
    // Bounded connection probe. Never probe 8080, clear a DB or upload Rules.
    const response = await fetch(`http://${binding.host}/`, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    await response.body?.cancel();
    await seed('users', staffId, { role: 'staff', authUid: staffUid });
    await seed('userAuthIndex', staffUid, { userDocId: staffId, role: 'staff' });
    await seed('users', `${prefix}-viewer-doc`, { role: 'parent', authUid: viewerUid });
    await seed('userAuthIndex', viewerUid, { userDocId: `${prefix}-viewer-doc`, role: 'parent' });
});
test.beforeEach(async () => {
    // Per-test student isolation: previous case's reservations cannot interfere.
    studentId = `${prefix}-student-doc-${++sequence}`;
    studentAuthUid = `${prefix}-student-auth-${sequence}`;
    reviewUid = `${prefix}-review-auth-${sequence}`;
    await seed('users', studentId, { role: 'student', authUid: studentAuthUid, userUid: `${prefix}-legacy-${sequence}` });
    await seed('userAuthIndex', studentAuthUid, { userDocId: studentId, role: 'student' });
    await seed('userAuthIndex', reviewUid, { userDocId: studentId, role: 'student' });
});
test.after(async () => {
    db.runTransaction = rawRunTransaction;
    auth.getUser = originalGetUser;
    try {
        // Only exact references observed/seeded by this process; no collection
        // deletes, recursive deletes, clearFirestoreData or emulator DELETE API.
        const cleanups = await Promise.allSettled([...owned.values()].map(async (ref) => {
            const snapshot = await ref.get();
            if (!snapshot.exists) return;
            assert.ok(ref.id.startsWith(prefix) || snapshot.data().studentDocId?.startsWith(prefix),
                `Refuse cleanup of non-test data: ${ref.path}`);
            await ref.delete();
        }));
        const failures = cleanups.filter((result) => result.status === 'rejected');
        if (failures.length) throw new AggregateError(failures.map((result) => result.reason), 'Some owned test documents could not be cleaned');
    } finally { await deleteApp(app); }
});

for (const source of sources) test(`${source}: real SDK updates revision/timestamps atomically and preserves original ID/data`, { timeout: 45000 }, async () => {
    const ref = await reservation(source);
    const before = (await ref.get()).data();
    const result = await change(ref);
    const saved = (await ref.get()).data();
    assert.equal(result.reservationId, ref.id);
    assert.equal(result.reservationRevision, 1);
    assert.equal(saved.date, day(1));
    assert.equal(saved.plannedTime, '15:30');
    assert.ok(saved.reservationStartsAt instanceof Timestamp);
    assert.equal(saved.reservationStartsAt.toDate().toISOString(), `${day(1)}T06:30:00.000Z`);
    assert.equal(saved.reminderDueAt.toDate().toISOString(), `${day(0)}T09:00:00.000Z`);
    for (const key of Object.keys(before).filter((key) => !['date', 'plannedTime'].includes(key))) assert.deepEqual(saved[key], before[key], key);
    assert.equal(saved.confirmationStatus, 'unconfirmed'); // notificationSent is not confirmation.
    assert.equal((await lockRef(day(1)).get()).data().version, 1);
});

test('identical IDs in both collections never cause fallback or update of the other source', async () => {
    const selected = await reservation();
    const other = await seed('clinicLogs', selected.id, { studentDocId: studentId, date: day(0),
        plannedTime: '14:00', status: 'pending', comment: 'untouched other source' });
    const before = await other.get();
    assert.equal((await change(selected)).sourceCollection, 'clinicReservations');
    await unchanged(other, before);
    assert.equal((await selected.get()).data().reservationRevision, 1);
});

test('confirmed reservation becomes reconfirmation_required and retains prior confirmation evidence', async () => {
    const confirmedAt = Timestamp.fromMillis(Date.now() - 86400000);
    const ref = await reservation('clinicReservations', { reservationRevision: 3, confirmationStatus: 'confirmed',
        confirmedRevision: 3, confirmedAt, confirmedBy: staffUid, timeSlot: '14:00' });
    await change(ref, { expectedRevision: 3 });
    const saved = (await ref.get()).data();
    assert.equal(saved.reservationRevision, 4);
    assert.equal(saved.confirmationStatus, 'reconfirmation_required');
    assert.equal(saved.confirmedRevision, 3);
    assert.ok(saved.confirmedAt.isEqual(confirmedAt));
    assert.equal(saved.confirmedBy, staffUid);
    assert.equal(saved.timeSlot, '15:30');
});

test('identical time is a complete no-op including updateTime and an existing lock', async () => {
    const ref = await reservation();
    const lock = lockRef(day(0));
    await lock.set({ studentDocId: studentId, date: day(0), version: 9 });
    const before = await ref.get();
    const lockBefore = await lock.get();
    assert.equal((await change(ref, { date: day(0), plannedTime: '14:00' })).changed, false);
    await unchanged(ref, before);
    await unchanged(lock, lockBefore);
});

test('stale expectedRevision rejects without reservation or lock writes', async () => {
    const ref = await reservation('clinicReservations', { reservationRevision: 2 });
    const before = await ref.get();
    const lock = lockRef(day(1));
    const lockBefore = await lock.get();
    await rejectsCode(change(ref), 'aborted');
    await unchanged(ref, before);
    await unchanged(lock, lockBefore);
});

test('same student/day duplicate across collections is rejected at a different hour', async () => {
    const ref = await reservation();
    await reservation('clinicLogs', { date: day(1), plannedTime: '18:00' });
    const before = await ref.get();
    const lock = lockRef(day(1));
    const lockBefore = await lock.get();
    await rejectsCode(change(ref), 'already-exists');
    await rejectsCode(create(day(1)), 'already-exists');
    await unchanged(ref, before);
    await unchanged(lock, lockBefore);
});

test('anonymous and linked parent callers cannot update or create, regardless of claimed role', async () => {
    const ref = await reservation();
    const before = await ref.get();
    for (const context of [{}, { auth: { uid: viewerUid, token: { role: 'admin' } } }]) {
        const code = context.auth ? 'permission-denied' : 'unauthenticated';
        await rejectsCode(change(ref, {}, context), code);
        await rejectsCode(create(day(1), context), code);
    }
    await unchanged(ref, before);
    assert.equal((await lockRef(day(1)).get()).exists, false);
});

test('completed, no-show, cancelled and started reservations cannot be changed', async () => {
    for (const patch of [{ status: 'completed' }, { status: 'attended' }, { status: 'noshow' },
        { status: 'no-show' }, { status: 'cancelled' }, { checkIn: '14:00' }, { checkOut: '15:00' }]) {
        const ref = await reservation('clinicLogs', patch);
        const before = await ref.get();
        await rejectsCode(change(ref), 'failed-precondition');
        await unchanged(ref, before);
    }
    assert.equal((await lockRef(day(1)).get()).exists, false);
});

test('server-rejected commit leaves reservation and existing lock unchanged, then a normal retry succeeds', { timeout: 45000 }, async () => {
    const ref = await reservation();
    const lock = lockRef(day(1));
    await lock.set({ studentDocId: studentId, date: day(1), version: 7 });
    const before = await ref.get();
    const lockBefore = await lock.get();
    const missing = db.collection('clinicLogs').doc(`${prefix}-must-not-exist-${++sequence}`);
    owned.set(missing.path, missing);
    db.runTransaction = (callback) => observedRunTransaction(async (tx) => {
        const result = await callback(tx);
        // Genuine server-side commit precondition failure AFTER both service
        // writes have been staged. Do not replace Firestore's commit method.
        tx.update(missing, { probe: true });
        return result;
    });
    try { await rejectsCode(change(ref), 5); } // gRPC NOT_FOUND from update of absent document.
    finally { db.runTransaction = observedRunTransaction; }
    await unchanged(ref, before);
    await unchanged(lock, lockBefore);
    assert.equal((await missing.get()).exists, false);
    assert.equal((await change(ref)).reservationRevision, 1);
    assert.equal((await lock.get()).data().version, 8);
});

test('callback failure after staging writes rolls back a new lock and reservation', async () => {
    const ref = await reservation();
    const before = await ref.get();
    const lock = lockRef(day(1));
    db.runTransaction = (callback) => observedRunTransaction(async (tx) => {
        await callback(tx);
        throw new Error('TEST_ABORT_AFTER_STAGING');
    });
    try { await assert.rejects(change(ref), /TEST_ABORT_AFTER_STAGING/); }
    finally { db.runTransaction = observedRunTransaction; }
    await unchanged(ref, before);
    assert.equal((await lock.get()).exists, false);
    assert.equal((await change(ref)).reservationRevision, 1);
});

test('server-rejected creation leaves no auto-ID reservation and preserves the lock before retry', { timeout: 45000 }, async () => {
    const lock = lockRef(day(1));
    await lock.set({ studentDocId: studentId, date: day(1), version: 5 });
    const before = await lock.get();
    const missing = db.collection('clinicLogs').doc(`${prefix}-creation-missing-${++sequence}`);
    owned.set(missing.path, missing);
    const priorPaths = new Set(owned.keys());
    db.runTransaction = (callback) => observedRunTransaction(async (tx) => {
        const result = await callback(tx);
        tx.update(missing, { probe: true });
        return result;
    });
    try { await rejectsCode(create(day(1)), 5); }
    finally { db.runTransaction = observedRunTransaction; }
    await unchanged(lock, before);
    const staged = [...owned.values()].filter((ref) => !priorPaths.has(ref.path) && ref.parent.id === 'clinicReservations');
    assert.equal(staged.length, 1, 'Capture the auto-ID reference even when the callable rejects');
    assert.equal((await staged[0].get()).exists, false);
    assert.equal((await studentDayReservations(day(1))).length, 0);
    await create(day(1));
    assert.equal((await studentDayReservations(day(1))).length, 1);
    assert.equal((await lock.get()).data().version, 6);
});

test('SDK retries a retryable abort without publishing the first attempt or incrementing revision twice', { timeout: 45000 }, async () => {
    const ref = await reservation();
    let attempts = 0;
    db.runTransaction = (callback) => observedRunTransaction(async (tx) => {
        const result = await callback(tx);
        if (++attempts === 1) throw Object.assign(new Error('TEST_RETRYABLE_ABORT'), { code: 10 });
        return result;
    });
    try { assert.equal((await change(ref)).reservationRevision, 1); }
    finally { db.runTransaction = observedRunTransaction; }
    assert.ok(attempts >= 2, 'Actual Admin SDK must rerun the transaction callback');
    assert.equal((await ref.get()).data().reservationRevision, 1);
    assert.equal((await lockRef(day(1)).get()).data().version, 1);
});

test('real creation commits new reservation, server timestamps and shared lock together', async () => {
    const result = await create(day(1));
    const ref = db.collection('clinicReservations').doc(result.id);
    const saved = (await ref.get()).data();
    assert.equal(saved.studentDocId, studentId);
    assert.equal(saved.authUid, studentAuthUid);
    assert.notEqual(saved.authUid, saved.studentDocId);
    assert.equal(saved.reservationRevision, 0);
    assert.equal(saved.confirmationStatus, 'unconfirmed');
    assert.equal(saved.confirmedAt, null);
    assert.ok(saved.createdAt instanceof Timestamp);
    assert.ok(saved.updatedAt instanceof Timestamp);
    assert.ok(saved.reservationStartsAt instanceof Timestamp);
    assert.equal((await lockRef(day(1)).get()).data().version, 1);
    await rejectsCode(create(day(1)), 'already-exists');
    assert.equal((await studentDayReservations(day(1))).length, 1);
});

test('concurrent creation and time update admit one winner and one active reservation', { timeout: 90000 }, async () => {
    const ref = await reservation('clinicLogs');
    const results = await together([() => change(ref), () => create(day(1))]);
    oneWinner(results, 'already-exists');
    assert.equal((await studentDayReservations(day(1))).length, 1);
    const source = (await ref.get()).data();
    assert.equal(source.reservationRevision ?? 0, results[0].status === 'fulfilled' ? 1 : 0);
    assert.equal((await lockRef(day(1)).get()).data().version, 1);
});

test('concurrent edits of the same reservation commit exactly one revision', { timeout: 90000 }, async () => {
    const ref = await reservation();
    const results = await together([() => change(ref), () => change(ref, { plannedTime: '16:00' })]);
    oneWinner(results, 'aborted');
    const saved = (await ref.get()).data();
    assert.equal(saved.reservationRevision, 1);
    assert.equal(saved.plannedTime, results[0].status === 'fulfilled' ? '15:30' : '16:00');
    assert.equal((await lockRef(day(1)).get()).data().version, 1);
});

test('different reservations moving to the same empty student/day share one lock', { timeout: 90000 }, async () => {
    const first = await reservation();
    const second = await reservation('clinicLogs', { date: day(2) });
    const results = await together([() => change(first), () => change(second)]);
    oneWinner(results, 'already-exists');
    assert.equal((await studentDayReservations(day(1))).length, 1);
    assert.equal((await lockRef(day(1)).get()).data().version, 1);
});

test('review Auth index and legacy profile alias queries resolve the same student', async () => {
    const profile = (await db.collection('users').doc(studentId).get()).data();
    const ref = await reservation('clinicLogs', { studentDocId: reviewUid, studentId: reviewUid });
    assert.equal((await change(ref)).changed, true);
    assert.equal((await ref.get()).data().studentDocId, reviewUid); // Do not migrate links.
    assert.equal((await lockRef(day(1)).get()).data().studentDocId, studentId);
    await reservation('clinicReservations', { date: day(2), studentDocId: profile.userUid, studentId: profile.userUid,
        authUid: profile.userUid });
    await rejectsCode(change(ref, { expectedRevision: 1, date: day(2) }), 'already-exists');
});

test('reverse-only student index links remain usable without Auth network or equal-ID assumptions', async () => {
    await db.collection('users').doc(studentId).set({ role: 'student' });
    const ref = await reservation();
    assert.equal((await change(ref)).changed, true);
    assert.equal((await lockRef(day(1)).get()).data().studentDocId, studentId);
});
