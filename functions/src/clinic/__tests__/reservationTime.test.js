const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { Timestamp } = require('firebase-admin/firestore');
const { createFakeFirestore } = require('./fakeFirestore.cjs');

// Substitute SDK entry points only; the real identity resolver and transaction
// service execute against the local double. No credentials or Firebase app.
let activeDb;
const fakeAuth = { getUser: async () => { throw Object.assign(new Error('Fictional account only'), { code: 'auth/user-not-found' }); } };
const load = Module._load;
Module._load = function (name, ...args) {
    if (name === 'firebase-functions') return {
        https: { HttpsError: class extends Error { constructor(code, message) { super(message); this.code = code; } } },
        region: () => ({ https: { onCall: (handler) => handler } }),
    };
    if (name === 'firebase-admin/firestore') return { ...load.call(this, name, ...args), getFirestore: () => activeDb };
    if (name === 'firebase-admin/auth') return { getAuth: () => fakeAuth };
    return load.call(this, name, ...args);
};
const { createUpdateClinicReservationTime } = require('../updateClinicReservationTime');
const { createClinicReservation } = require('../createClinicReservation');
const { parseKoreanReservationTime } = require('../reservationPolicy');
Module._load = load;

const context = { auth: { uid: 'fictional-staff-auth' } };
const now = () => Timestamp.fromDate(new Date('2030-01-01T00:00:00Z'));
const base = { studentDocId: 'fictional-student-doc', date: '2030-02-01', plannedTime: '14:00', status: 'pending',
    comment: 'keep comment', tutor: 'fictional-teacher', studentId: 'fictional-student-doc',
    staffMemoRef: 'fictional-memo', checkIn: '', checkOut: '', notificationSent: true,
    legacyPayload: { marker: 'keep original payload' }, classId: 'fictional-class' };
const profiles = {
    'users/fictional-staff-doc': { role: 'staff', authUid: 'fictional-staff-auth' },
    'users/fictional-student-doc': { role: 'student', authUid: 'fictional-student-auth' },
    'userAuthIndex/fictional-staff-auth': { userDocId: 'fictional-staff-doc' },
    'userAuthIndex/fictional-student-auth': { userDocId: 'fictional-student-doc' },
    'userAuthIndex/fictional-review-auth': { userDocId: 'fictional-student-doc' },
};
function setup(extra = {}, source = 'clinicReservations') {
    const path = `${source}/original-id`;
    const db = createFakeFirestore({ ...profiles, [path]: base, ...extra });
    activeDb = db;
    const send = createUpdateClinicReservationTime({ db, auth: fakeAuth, now });
    const request = { sourceCollection: source, reservationId: 'original-id', expectedRevision: 0, date: '2030-02-02', plannedTime: '15:30' };
    return { db, path, request, change: (patch = {}, caller = context) => send({ ...request, ...patch }, caller) };
}
const rejectsCode = (promise, code) => assert.rejects(promise, (error) => error.code === code);

for (const source of ['clinicReservations', 'clinicLogs']) test(`${source}: keeps ID, links, comments, and initializes revision without sending`, async () => {
    const { db, path, change } = setup({}, source);
    const result = await change();
    assert.equal(result.reservationId, 'original-id');
    assert.equal(result.reservationRevision, 1);
    const saved = db.read(path);
    for (const field of Object.keys(base).filter((key) => !['date', 'plannedTime'].includes(key))) assert.deepEqual(saved[field], base[field], field);
    assert.equal(saved.status, 'pending');
    assert.equal(saved.confirmationStatus, 'unconfirmed'); // notificationSent is not confirmation evidence.
    assert.equal(saved.confirmedRevision, null);
    assert.equal(saved.reservationStartsAt.toDate().toISOString(), '2030-02-02T06:30:00.000Z');
    assert.equal(saved.reminderDueAt.toDate().toISOString(), '2030-02-01T09:00:00.000Z');
    assert.ok(db.writes.every(({ path: target }) => target === path || target.startsWith('_clinicReservationDateLocks/')));
    assert.equal(db.paths().filter((key) => key.startsWith(`${source}/`)).length, 1);
});

test('confirmed reservation requires reconfirmation while preserving past confirmation evidence and aliases', async () => {
    const confirmedAt = now();
    const { db, path, change } = setup({ 'clinicReservations/original-id': { ...base, timeSlot: '14:00', reservationRevision: 3,
        confirmationStatus: 'confirmed', confirmedRevision: 3, confirmedAt, confirmedBy: 'fictional-confirming-staff' } });
    await change({ expectedRevision: 3 });
    const saved = db.read(path);
    assert.equal(saved.reservationRevision, 4);
    assert.equal(saved.timeSlot, '15:30');
    assert.equal(saved.confirmationStatus, 'reconfirmation_required');
    assert.equal(saved.confirmedRevision, 3);
    assert.equal(saved.confirmedAt, confirmedAt);
    assert.equal(saved.confirmedBy, 'fictional-confirming-staff');
});

test('identical time is a true no-op, including legacy metadata', async () => {
    const { db, path, change } = setup();
    assert.equal((await change({ date: base.date, plannedTime: base.plannedTime })).changed, false);
    assert.deepEqual(db.read(path), base);
    assert.equal(db.writes.length, 0);
});
test('stale revision is rejected, even when requested time matches', async () => {
    const { change } = setup({ 'clinicReservations/original-id': { ...base, reservationRevision: 2 } });
    await rejectsCode(change({ date: base.date, plannedTime: base.plannedTime }), 'aborted');
});
for (const status of ['attended', 'completed', 'noshow', 'no-show', '미참석', 'cancelled', '취소']) {
    test(`rejects terminal activity status ${status}`, async () => {
        const { db, change } = setup({ 'clinicReservations/original-id': { ...base, status } });
        await rejectsCode(change(), 'failed-precondition');
        assert.equal(db.writes.length, 0);
    });
}
test('check-in, check-out, soft deletion and unknown activity status also block edits', async () => {
    for (const patch of [{ checkIn: '14:00' }, { checkOut: '15:00' }, { isDeleted: true }, { status: 'unexpected' }, { attendanceStatus: 'absent' }]) {
        const { change } = setup({ 'clinicReservations/original-id': { ...base, ...patch } });
        await rejectsCode(change(), 'failed-precondition');
    }
});
test('same student duplicate is blocked across collections and review/login aliases, even at a different hour', async () => {
    for (const field of ['studentDocId', 'studentId', 'authUid', 'studentUid']) {
        const { db, change } = setup({ 'clinicLogs/other': { date: '2030-02-02', plannedTime: '18:00', status: 'pending', [field]: 'fictional-review-auth' } });
        await rejectsCode(change(), 'already-exists');
        assert.equal(db.writes.length, 0);
    }
});
test('another student or a finished record does not block reservation', async () => {
    const { change } = setup({
        'clinicLogs/other-student': { ...base, studentDocId: 'another-fictional-student', studentId: '', date: '2030-02-02' },
        'clinicLogs/finished': { ...base, status: 'attended', date: '2030-02-02' },
    });
    assert.equal((await change()).changed, true);
});
test('same reservation concurrent revisions: exactly one update commits', async () => {
    const { db, path, change } = setup();
    const results = await Promise.allSettled([change(), change({ plannedTime: '16:00' })]);
    assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal(results.find((item) => item.status === 'rejected').reason.code, 'aborted');
    assert.equal(db.read(path).reservationRevision, 1);
});
test('different source reservations moving to an empty day contend on the same student/date lock', async () => {
    const { db, change } = setup({ 'clinicLogs/second': { ...base, date: '2030-02-03' } });
    const results = await Promise.allSettled([change(), change({ sourceCollection: 'clinicLogs', reservationId: 'second' })]);
    assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal(results.find((item) => item.status === 'rejected').reason.code, 'already-exists');
    assert.equal(['clinicReservations/original-id', 'clinicLogs/second'].filter((key) => db.read(key).date === '2030-02-02').length, 1);
});
test('creation and time modification share the lock and cannot introduce same-day duplicates', async () => {
    const { db, change } = setup();
    const results = await Promise.allSettled([change(), createClinicReservation({ studentDocId: 'fictional-student-doc',
        classId: 'fictional-class', date: '2030-02-02', timeSlot: '17:00' }, context)]);
    assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal(results.find((item) => item.status === 'rejected').reason.code, 'already-exists');
    assert.equal(db.paths().filter((key) => key.startsWith('clinicReservations/') && db.read(key).date === '2030-02-02').length, 1);
});
test('commit failure rolls back time and lock; retry succeeds without changing ID', async () => {
    const { db, path, change } = setup();
    db.failNextCommit();
    await rejectsCode(change(), 'unavailable');
    assert.deepEqual(db.read(path), base);
    assert.equal(db.writes.length, 0);
    assert.equal((await change()).reservationRevision, 1);
});
test('source collection is exact; never updates a same-ID fallback document', async () => {
    const { db, path, change } = setup();
    await rejectsCode(change({ sourceCollection: 'clinicLogs' }), 'not-found');
    assert.deepEqual(db.read(path), base);
});
test('staff authorization uses linked server profile, ignores supplied claims and rejects anonymous/viewers', async () => {
    const { db, change } = setup();
    await rejectsCode(change({}, {}), 'unauthenticated');
    await rejectsCode(change({}, { auth: { uid: 'fictional-review-auth', token: { role: 'admin' } } }), 'permission-denied');
    assert.equal(db.writes.length, 0);
});
test('reverse-only index student profile remains editable without assuming document ID is an Auth UID', async () => {
    const { change } = setup({ 'users/fictional-student-doc': { role: 'student' } });
    assert.equal((await change()).changed, true);
});
test('unlinked legacy student profile is usable for booking edits without inventing an Auth UID', async () => {
    const { change } = setup({ 'users/unlinked-fictional-student': { role: 'student' },
        'clinicReservations/original-id': { ...base, studentDocId: 'unlinked-fictional-student', studentId: 'unlinked-fictional-student' } });
    assert.equal((await change()).changed, true);
});
test('creation initializes server-managed fields without confirmation or notification writes', async () => {
    const { db } = setup();
    const result = await createClinicReservation({ studentDocId: 'fictional-student-doc', classId: 'fictional-class',
        date: '2030-02-05', timeSlot: '16:00' }, context);
    const saved = db.read(`clinicReservations/${result.id}`);
    assert.equal(saved.reservationRevision, 0);
    assert.equal(saved.confirmationStatus, 'unconfirmed');
    assert.equal(saved.confirmedAt, null);
    assert.equal(saved.confirmedBy, null);
    assert.ok(saved.reservationStartsAt instanceof Timestamp);
    assert.ok(db.writes.every(({ path }) => /^(clinicReservations|_clinicReservationDateLocks)\//.test(path)));
});
test('strict request validation rejects missing version, collection injection and arbitrary fields', async () => {
    const { change } = setup();
    for (const patch of [{ expectedRevision: undefined }, { expectedRevision: -1 }, { expectedRevision: '0' },
        { sourceCollection: 'users' }, { reservationId: '../other' }, { reservationId: '..' },
        { reservationId: '__reserved__' }, { confirmedBy: 'forged' }]) {
        await rejectsCode(change(patch), 'invalid-argument');
    }
});
test('Korean calendar/time validation rejects impossible, noncanonical and past values', async () => {
    const { change } = setup();
    for (const patch of [{ date: '2030-02-30' }, { date: '0000-01-01' }, { date: '0001-01-01' }, { plannedTime: '24:00' },
        { plannedTime: '9:00' }, { date: '2030-2-02' }, { plannedTime: '15:30+09:00' }]) {
        await rejectsCode(change(patch), 'invalid-argument');
    }
    await rejectsCode(change({ date: '2029-12-31' }), 'failed-precondition');
    const leap = parseKoreanReservationTime('2032-02-29', '00:00');
    assert.equal(leap.reservationStartsAt.toDate().toISOString(), '2032-02-28T15:00:00.000Z');
});
