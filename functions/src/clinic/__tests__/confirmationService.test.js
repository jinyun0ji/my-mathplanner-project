const test = require('node:test');
const assert = require('node:assert/strict');
const { Timestamp } = require('firebase-admin/firestore');
const { createFakeFirestore } = require('./fakeFirestore.cjs');
const { createClinicConfirmationService, confirmationEventKey } = require('../confirmationService');
const { createUpdateClinicReservationTime } = require('../updateClinicReservationTime');

const context = { auth: { uid: 'fictional-staff-auth' } };
const base = { studentDocId: 'fictional-student-doc', date: '2030-02-01', plannedTime: '14:00', status: 'pending',
    comment: 'preserved', tutor: 'fictional-teacher', staffMemoRef: 'fictional-memo',
    legacyPayload: { marker: 'unchanged' }, notificationSent: true };
const profiles = {
    'users/fictional-staff-doc': { role: 'staff', authUid: 'fictional-staff-auth' },
    'userAuthIndex/fictional-staff-auth': { userDocId: 'fictional-staff-doc', role: 'staff' },
    'users/fictional-student-doc': { role: 'student', authUid: 'fictional-student-auth' },
    'userAuthIndex/fictional-student-auth': { userDocId: 'fictional-student-doc' },
    'userAuthIndex/fictional-review-auth': { userDocId: 'fictional-student-doc' },
    'users/fictional-parent-doc': { role: 'parent', authUid: 'fictional-parent-auth' },
    'userAuthIndex/fictional-parent-auth': { userDocId: 'fictional-parent-doc' },
};
const itemFor = (source = 'clinicReservations', id = 'original-id', revision = 0) => ({ sourceCollection: source,
    reservationId: id, expectedRevision: revision });
const outboxPath = (item) => `clinicConfirmationOutbox/${confirmationEventKey(item)}`;
const historyPath = (item) => `clinicReservationConfirmations/${confirmationEventKey(item)}`;
function setup(extra = {}) {
    const db = createFakeFirestore({ ...profiles, 'clinicReservations/original-id': base, ...extra });
    let millis = Date.parse('2030-01-01T00:00:00Z');
    const now = () => Timestamp.fromMillis(millis);
    const confirm = createClinicConfirmationService({ db, now, serverTimestamp: now }).confirmReservations;
    return { db, now, later: () => { millis += 1000; },
        confirm: (items = [itemFor()], caller = context) => confirm({ reservations: items }, caller),
        raw: confirm };
}
const rejectsCode = (promise, code) => assert.rejects(promise, (cause) => cause.code === code);
const expectFailure = (result, code) => {
    assert.equal(result.results[0].status, 'failed');
    assert.equal(result.results[0].error.code, code);
};

test('single confirmation atomically creates immutable history and pending outbox without notifications', async () => {
    const { db, now, confirm } = setup();
    const result = await confirm();
    assert.deepEqual(result.summary, { requested: 1, confirmed: 1, alreadyConfirmed: 0, failed: 0 });
    const saved = db.read('clinicReservations/original-id');
    for (const field of Object.keys(base)) assert.deepEqual(saved[field], base[field], field);
    assert.equal(saved.confirmationStatus, 'confirmed');
    assert.equal(saved.confirmedRevision, 0);
    assert.equal(saved.confirmedBy, context.auth.uid);
    assert.ok(saved.confirmedAt.isEqual(now()));
    const history = db.read(historyPath(itemFor()));
    assert.equal(history.studentProfileDocId, 'fictional-student-doc');
    assert.notEqual(history.studentProfileDocId, 'fictional-student-auth');
    assert.equal(history.date, base.date);
    assert.equal(history.plannedTime, base.plannedTime);
    assert.equal(history.timeZone, 'Asia/Seoul');
    assert.equal(history.reservationStartsAt.toDate().toISOString(), '2030-02-01T05:00:00.000Z');
    assert.equal(history.reminderDueAt.toDate().toISOString(), '2030-01-31T09:00:00.000Z');
    assert.equal(history.confirmedByProfileDocId, 'fictional-staff-doc');
    const job = db.read(outboxPath(itemFor()));
    assert.equal(job.confirmationRef, historyPath(itemFor()));
    assert.equal(job.state, 'pending');
    assert.equal(job.attempts, 0);
    assert.equal(job.owner, null);
    assert.equal(job.leaseUntil, null);
    assert.deepEqual(job.recipientResults, {});
    assert.equal(db.writes.length, 3);
    assert.equal(db.paths().some((path) => path.startsWith('notifications/')), false);
});
test('20 reservations across both collections commit independently and same document IDs do not collide', async () => {
    const extra = {};
    const items = Array.from({ length: 20 }, (_, i) => itemFor(i % 2 ? 'clinicLogs' : 'clinicReservations', `id-${Math.floor(i / 2)}`));
    for (const item of items) extra[`${item.sourceCollection}/${item.reservationId}`] = base;
    const { db, confirm } = setup(extra);
    assert.equal((await confirm(items)).summary.confirmed, 20);
    assert.equal(new Set(items.map(confirmationEventKey)).size, 20);
    assert.equal(db.paths().filter((path) => path.startsWith('clinicReservationConfirmations/')).length, 20);
});
test('empty, malformed and more-than-20 requests reject before any writes', async () => {
    const { db, raw } = setup();
    for (const data of [null, {}, { reservations: [] }, { reservations: 'invalid' }, { reservations: Array(21).fill(itemFor()) },
        { reservations: [itemFor()], studentId: 'forged' }]) await rejectsCode(raw(data, context), 'invalid-argument');
    assert.equal(db.writes.length, 0);
});
test('duplicate reservation input rejects even if expected revisions differ', async () => {
    const { confirm, db } = setup();
    await rejectsCode(confirm([itemFor(), itemFor('clinicReservations', 'original-id', 1)]), 'invalid-argument');
    assert.equal(db.writes.length, 0);
});
test('strict item validation rejects arbitrary collections, invalid revisions and client supplied student/time data', async () => {
    const { confirm, db } = setup();
    for (const patch of [{ sourceCollection: 'users' }, { expectedRevision: undefined }, { expectedRevision: -1 },
        { expectedRevision: 0.5 }, { expectedRevision: '0' }, { reservationId: '..' }, { reservationId: 'a/b' },
        { date: '2030-02-02' }, { studentId: 'forged' }, { confirmedBy: 'forged' }]) {
        await rejectsCode(confirm([{ ...itemFor(), ...patch }]), 'invalid-argument');
    }
    assert.equal(db.writes.length, 0);
});
test('anonymous, student, parent and forged claims cannot confirm', async () => {
    const { db, confirm } = setup();
    await rejectsCode(confirm(undefined, {}), 'unauthenticated');
    for (const uid of ['fictional-student-auth', 'fictional-parent-auth', 'unknown-auth']) {
        await rejectsCode(confirm(undefined, { auth: { uid, token: { role: 'admin' } } }), 'permission-denied');
    }
    assert.equal(db.writes.length, 0);
});
for (const role of ['admin', 'staff', 'teacher', 'teaching', 'staffOrTeaching']) test(`existing reservation manager role ${role} is supported`, async () => {
    const { confirm } = setup({ 'users/fictional-staff-doc': { role, authUid: 'fictional-staff-auth' } });
    assert.equal((await confirm()).results[0].status, 'confirmed');
});
for (const role of ['admin', 'staff', 'teacher', 'teaching', 'staffOrTeaching']) test(`inactive ${role} is rejected despite unchanged role and forged active/role claims`, async () => {
    const { db, confirm } = setup({ 'users/fictional-staff-doc': { role, authUid: 'fictional-staff-auth', active: false } });
    await rejectsCode(confirm(undefined, { auth: { uid: context.auth.uid, token: { role: 'admin', active: true } } }), 'permission-denied');
    assert.equal(db.read('users/fictional-staff-doc').role, role);
    assert.deepEqual(db.read('clinicReservations/original-id'), base);
    assert.equal(db.read(historyPath(itemFor())), undefined);
    assert.equal(db.read(outboxPath(itemFor())), undefined);
    assert.equal(db.writes.length, 0);
});
for (const [label, extra] of [['explicit active=true', { active: true }], ['missing legacy active', {}]]) {
    test(`${label} allows an authorized staff profile`, async () => {
        const profile = { role: 'staff', authUid: 'fictional-staff-auth', ...extra };
        const { db, confirm } = setup({ 'users/fictional-staff-doc': profile });
        assert.equal((await confirm()).results[0].status, 'confirmed');
        assert.deepEqual(db.read('users/fictional-staff-doc'), profile);
    });
}
test('deactivation after initial authorization is rejected inside the transaction without confirmation writes', async () => {
    const { db, confirm } = setup({ 'users/fictional-staff-doc': { role: 'staff', authUid: context.auth.uid, active: true } });
    const run = db.runTransaction;
    db.runTransaction = async (callback) => {
        await run(async (tx) => { tx.update(db.collection('users').doc('fictional-staff-doc'), { active: false }); });
        return run(callback);
    };
    expectFailure(await confirm(), 'permission-denied');
    assert.equal(db.read('users/fictional-staff-doc').role, 'staff');
    assert.equal(db.read('users/fictional-staff-doc').active, false);
    assert.deepEqual(db.read('clinicReservations/original-id'), base);
    assert.equal(db.read(historyPath(itemFor())), undefined);
    assert.equal(db.read(outboxPath(itemFor())), undefined);
    assert.ok(db.writes.every((write) => write.path === 'users/fictional-staff-doc'));
});
test('profile version conflict retries and checks the latest active=false before committing any confirmation', async () => {
    const { db, confirm } = setup({ 'users/fictional-staff-doc': { role: 'staff', authUid: context.auth.uid, active: true } });
    const run = db.runTransaction;
    let attempts = 0;
    db.runTransaction = (callback) => run(async (tx) => {
        attempts += 1;
        const result = await callback(tx);
        if (attempts === 1) {
            // Another transaction commits after our profile read and staged writes.
            // The double detects the changed read version and reruns the callback.
            await run(async (other) => { other.update(db.collection('users').doc('fictional-staff-doc'), { active: false }); });
        }
        return result;
    });
    expectFailure(await confirm(), 'permission-denied');
    assert.equal(attempts, 2);
    assert.equal(db.read('users/fictional-staff-doc').role, 'staff');
    assert.equal(db.read('users/fictional-staff-doc').active, false);
    assert.deepEqual(db.read('clinicReservations/original-id'), base);
    assert.equal(db.read(historyPath(itemFor())), undefined);
    assert.equal(db.read(outboxPath(itemFor())), undefined);
    assert.ok(db.writes.every((write) => write.path === 'users/fictional-staff-doc'));
});
test('role revocation between authorization and transaction prevents confirmation', async () => {
    const { db, confirm } = setup();
    const run = db.runTransaction;
    let revoked = false;
    db.runTransaction = async (callback) => {
        if (!revoked) {
            revoked = true;
            await run((tx) => { tx.update(db.collection('users').doc('fictional-staff-doc'), { role: 'parent' }); });
        }
        return run(callback);
    };
    expectFailure(await confirm(), 'permission-denied');
    assert.equal(db.read('clinicReservations/original-id').confirmationStatus, undefined);
});
test('legacy equal-ID staff profile works without an external Auth lookup', async () => {
    const { confirm } = setup({ 'users/legacy-staff-auth': { role: 'staff' } });
    assert.equal((await confirm(undefined, { auth: { uid: 'legacy-staff-auth' } })).results[0].status, 'confirmed');
});
test('same revision retry by another staff keeps first actor/time/history and outbox failure state', async () => {
    const { db, confirm, later } = setup({ 'users/second-staff': { role: 'teacher' } });
    await confirm();
    await db.runTransaction((tx) => { tx.update(db.collection('clinicConfirmationOutbox').doc(confirmationEventKey(itemFor())),
        { state: 'partial', attempts: 4, lastError: { code: 'future-worker-error' } }); });
    const before = db.paths().map((path) => [path, db.read(path)]);
    const writes = db.writes.length;
    later();
    const result = await confirm(undefined, { auth: { uid: 'second-staff' } });
    assert.equal(result.results[0].status, 'already_confirmed');
    assert.equal(result.results[0].outboxState, 'partial');
    assert.equal(db.writes.length, writes);
    for (const [path, data] of before) assert.deepEqual(db.read(path), data);
});
test('actual 2-A time update requires reconfirmation and the previous revision history remains immutable', async () => {
    const { db, now, confirm, later } = setup();
    await confirm();
    const first = db.read(historyPath(itemFor()));
    const update = createUpdateClinicReservationTime({ db, now, auth: { getUser: async () => { throw new Error('Unexpected Auth network'); } } });
    later();
    await update({ ...itemFor(), date: '2030-02-02', plannedTime: '16:00' }, context);
    assert.equal(db.read('clinicReservations/original-id').confirmationStatus, 'reconfirmation_required');
    assert.equal(db.read('clinicReservations/original-id').confirmedBy, first.confirmedBy);
    assert.ok(db.read('clinicReservations/original-id').confirmedAt.isEqual(first.confirmedAt));
    later();
    const next = itemFor('clinicReservations', 'original-id', 1);
    assert.equal((await confirm([next])).results[0].status, 'confirmed');
    assert.deepEqual(db.read(historyPath(itemFor())), first);
    assert.equal(db.read(historyPath(next)).previousConfirmation.confirmedRevision, 0);
    assert.equal(db.read(outboxPath(itemFor())).state, 'pending'); // Future worker must supersede it.
    assert.equal(db.read('clinicReservations/original-id').confirmedRevision, 1);
});
for (const patch of [{ status: 'cancelled' }, { isDeleted: true }, { deletedAt: Timestamp.fromMillis(1) },
    { status: 'completed' }, { status: 'attended' }, { status: 'no-show' }, { status: 'noshow' }, { checkIn: '14:00' },
    { checkOut: '15:00' }, { status: 'unknown' }]) test(`invalid activity state is rejected: ${JSON.stringify(patch)}`, async () => {
    const { db, confirm } = setup({ 'clinicReservations/original-id': { ...base, ...patch } });
    expectFailure(await confirm(), 'failed-precondition');
    assert.equal(db.writes.length, 0);
});
test('stale revision, missing source, malformed dates and past reservations fail independently', async () => {
    const { db, confirm } = setup({ 'clinicLogs/invalid-date': { ...base, date: '2030-02-30' },
        'clinicLogs/past': { ...base, date: '2029-01-01' }, 'clinicLogs/revised': { ...base, reservationRevision: 2 } });
    const result = await confirm([itemFor(), itemFor('clinicLogs'), itemFor('clinicLogs', 'invalid-date'),
        itemFor('clinicLogs', 'past'), itemFor('clinicLogs', 'revised')]);
    assert.deepEqual(result.results.map((item) => item.status), ['confirmed', 'failed', 'failed', 'failed', 'failed']);
    assert.deepEqual(result.results.slice(1).map((item) => item.error.code), ['not-found', 'invalid-argument', 'failed-precondition', 'aborted']);
    assert.equal(db.paths().filter((path) => path.startsWith('clinicReservationConfirmations/')).length, 1);
});
test('rejected commit leaves all three documents unchanged and a later independent item can succeed', async () => {
    const { db, confirm } = setup({ 'clinicLogs/second': base });
    db.failNextCommit();
    const result = await confirm([itemFor(), itemFor('clinicLogs', 'second')]);
    expectFailure(result, 'unavailable');
    assert.equal(result.results[1].status, 'confirmed');
    assert.deepEqual(db.read('clinicReservations/original-id'), base);
    assert.equal(db.read(historyPath(itemFor())), undefined);
    assert.equal(db.read(outboxPath(itemFor())), undefined);
    assert.equal((await confirm()).results[0].status, 'confirmed');
});
test('concurrent confirmations produce exactly one history and outbox', async () => {
    const { db, confirm } = setup();
    const results = await Promise.all([confirm(), confirm()]);
    assert.deepEqual(results.map((result) => result.results[0].status).sort(), ['already_confirmed', 'confirmed']);
    assert.equal(db.paths().filter((path) => path.startsWith('clinicReservationConfirmations/')).length, 1);
    assert.equal(db.paths().filter((path) => path.startsWith('clinicConfirmationOutbox/')).length, 1);
    assert.equal(db.writes.length, 3);
});
test('a lost commit acknowledgement is safe to retry without replacing evidence', async () => {
    const { db, confirm, later } = setup();
    const run = db.runTransaction;
    db.runTransaction = async (callback) => { await run(callback); throw Object.assign(new Error('Lost response'), { code: 14 }); };
    expectFailure(await confirm(), 'unavailable');
    const first = db.read(historyPath(itemFor()));
    db.runTransaction = run;
    later();
    assert.equal((await confirm()).results[0].status, 'already_confirmed');
    assert.deepEqual(db.read(historyPath(itemFor())), first);
});
test('confirmation and unchanged 2-A time update serialize on the reservation document', async () => {
    const { db, now, confirm } = setup();
    const update = createUpdateClinicReservationTime({ db, now, auth: { getUser: async () => { throw new Error('Unexpected Auth request'); } } });
    const run = db.runTransaction;
    let arrivals = 0;
    let release;
    const ready = new Promise((resolve) => { release = resolve; });
    db.runTransaction = async (callback) => {
        if (++arrivals === 2) release();
        await ready;
        return run(callback);
    };
    const [result] = await Promise.all([confirm(), update({ ...itemFor(), date: '2030-02-02', plannedTime: '16:00' }, context)]);
    const saved = db.read('clinicReservations/original-id');
    assert.equal(saved.reservationRevision, 1);
    if (result.results[0].status === 'confirmed') {
        assert.equal(saved.confirmationStatus, 'reconfirmation_required');
        assert.equal(saved.confirmedRevision, 0);
        assert.equal(db.read(historyPath(itemFor())).reservationRevision, 0);
    } else {
        expectFailure(result, 'aborted');
        assert.equal(db.read(historyPath(itemFor())), undefined);
        assert.equal(db.read(outboxPath(itemFor())), undefined);
    }
});
test('unlinked and reverse-index-only students can be confirmed without recipient/Auth availability', async () => {
    for (const profile of [{ role: 'student' }, { role: 'student', userUid: 'fictional-old-alias' }]) {
        const { confirm } = setup({ 'users/fictional-student-doc': profile });
        assert.equal((await confirm()).results[0].status, 'confirmed');
    }
    const { confirm } = setup({ 'users/unlinked-student': { role: 'student' },
        'clinicReservations/original-id': { ...base, studentDocId: 'unlinked-student' } });
    assert.equal((await confirm()).results[0].status, 'confirmed');
});
test('demo login alias resolves canonical student while original links stay intact', async () => {
    const { db, confirm } = setup({ 'clinicReservations/original-id': { ...base, studentDocId: 'fictional-review-auth' } });
    await confirm();
    assert.equal(db.read(historyPath(itemFor())).studentProfileDocId, 'fictional-student-doc');
    assert.equal(db.read('clinicReservations/original-id').studentDocId, 'fictional-review-auth');
});
test('notification flag OFF still confirms and creates pending outbox with no inbox items', async () => {
    const previous = process.env.NOTIFICATION_SENDING_ENABLED;
    process.env.NOTIFICATION_SENDING_ENABLED = 'false';
    try {
        const { db, confirm } = setup();
        assert.equal((await confirm()).results[0].status, 'confirmed');
        assert.equal(db.read(outboxPath(itemFor())).state, 'pending');
        assert.equal(db.paths().some((path) => path.startsWith('notifications/')), false);
    } finally {
        if (previous === undefined) delete process.env.NOTIFICATION_SENDING_ENABLED;
        else process.env.NOTIFICATION_SENDING_ENABLED = previous;
    }
});
test('missing or mismatched receipts fail closed rather than overwriting existing history', async () => {
    for (const extra of [
        { [historyPath(itemFor())]: { marker: 'do not replace' } },
        { [outboxPath(itemFor())]: { state: 'completed' } },
        { 'clinicReservations/original-id': { ...base, confirmationStatus: 'confirmed', confirmedRevision: 0 } },
    ]) {
        const { db, confirm } = setup(extra);
        expectFailure(await confirm(), 'failed-precondition');
        assert.equal(db.writes.length, 0);
    }
});
test('earlier legacy confirmation fields are preserved as evidence when confirming a newer revision', async () => {
    const previousAt = Timestamp.fromMillis(1);
    const { db, confirm } = setup({ 'clinicReservations/original-id': { ...base, reservationRevision: 3,
        confirmationStatus: 'reconfirmation_required', confirmedRevision: 1, confirmedAt: previousAt, confirmedBy: 'older-staff' } });
    const item = itemFor('clinicReservations', 'original-id', 3);
    assert.equal((await confirm([item])).results[0].status, 'confirmed');
    assert.ok(db.read(historyPath(item)).previousConfirmation.confirmedAt.isEqual(previousAt));
    assert.equal(db.read(historyPath(item)).previousConfirmation.confirmedBy, 'older-staff');
});
