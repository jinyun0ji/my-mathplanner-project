'use strict';

// MUST execute before SDK imports, client construction, fixture creation or tests.
const emulator = require('./emulator-safety.cjs').assertEmulatorEnvironment();

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const http = require('node:http');
const { test, before, after } = require('node:test');
const { Firestore, Timestamp } = require('firebase-admin/firestore');
const { createLessonReportService, notificationIdFor, SERVICE_VERSION } = require('../service');

// No default Admin app, ADC, Auth client, Functions emulator or Messaging client.
// The host/project are pinned in both the environment and SDK settings.
const db = new Firestore({ projectId: emulator.projectId, host: emulator.host, ssl: false, preferRest: false });

before(async () => {
    // Bounded, read-only preflight before fixture writes. Never starts an emulator.
    await new Promise((resolve, reject) => {
        const path = `/v1/projects/${emulator.projectId}/databases/(default)/documents/lessonReportEmulatorChecks/${randomUUID()}`;
        const request = http.get({ hostname: '127.0.0.1', port: 8080, path, timeout: 3000 }, (response) => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => { body += chunk; });
            response.on('end', () => {
                if (response.statusCode === 404 && body.includes('NOT_FOUND')) resolve();
                else reject(new Error(`Firestore Emulator preflight failed: HTTP ${response.statusCode}`));
            });
        });
        request.on('timeout', () => request.destroy(new Error('Firestore Emulator preflight timed out')));
        request.on('error', reject);
    });
});
after(async () => db.terminate());

async function fixture(t, reportPatch = {}) {
    const id = `it-lesson-report-${randomUUID()}`;
    const studentProfile = `${id}-student-profile`;
    const parentProfile = `${id}-parent-profile`;
    const studentUid = `${id}-student-auth`;
    const parentUid = `${id}-parent-auth`;
    const report = db.collection('lessonReports').doc(id);
    const receipt = report.collection('dispatches').doc('first-publication');
    const item = (uid) => db.collection('notifications').doc(uid).collection('items').doc(notificationIdFor(id, uid));
    const sentinel = report.collection('integrationFixtures').doc('existing-commit-collision');
    const seed = [
        [report, { studentId: studentProfile, classId: `${id}-class`, lessonDate: '2026-10-26', status: 'draft',
            sendStatus: 'draft', sendMode: 'now', scheduledSendAt: null, sentAt: null,
            studentNotificationSent: false, parentNotificationSent: false, ...reportPatch }],
        [db.collection('users').doc(studentProfile), { role: 'student', authUid: studentUid, parentIds: [parentProfile] }],
        [db.collection('users').doc(parentProfile), { role: 'parent', authUid: parentUid, studentIds: [studentProfile] }],
        [db.collection('userAuthIndex').doc(studentUid), { userDocId: studentProfile, role: 'student' }],
        [db.collection('userAuthIndex').doc(parentUid), { userDocId: parentProfile, role: 'parent' }],
        [sentinel, { fixtureId: id }],
    ];
    const owned = new Map([...seed.map(([ref]) => ref), receipt, item(studentUid), item(parentUid)].map((ref) => [ref.path, ref]));
    let seeded = false;
    t.after(async () => {
        if (!seeded) return; // A failed atomic seed must not delete someone else's document.
        const batch = db.batch();
        for (const ref of owned.values()) batch.delete(ref);
        await batch.commit();
        const leftovers = await db.getAll(...owned.values());
        assert.ok(leftovers.every((snapshot) => !snapshot.exists), `Fixture cleanup incomplete: ${id}`);
    });
    const batch = db.batch();
    for (const [ref, data] of seed) batch.create(ref, data);
    await batch.commit();
    seeded = true;

    // Only Auth.getUser is a local allowlist stub. All profile/index/parent reads,
    // notification writes, snapshots and transactions use the real Emulator.
    const auth = { getUser: async (uid) => {
        if (![studentUid, parentUid].includes(uid)) throw Object.assign(new Error('Fictional Auth user not found'), { code: 'auth/user-not-found' });
        return { uid, disabled: false };
    } };
    const service = (options = {}) => createLessonReportService({ db, auth, sendingEnabled: () => true, ...options });
    const dispatch = (instance = service(), options = {}) => instance.dispatch({ reportId: id, expectedRevision: 0, ...options });
    const snapshots = () => db.getAll(report, receipt, item(studentUid), item(parentUid));
    const assertAtomicPublication = async () => {
        const [r, job, student, parent] = await snapshots();
        assert.equal(r.get('status'), 'sent');
        assert.equal(r.get('sendStatus'), 'sent');
        assert.equal(job.get('state'), 'completed');
        assert.equal(student.exists, true);
        assert.equal(parent.exists, true);
        for (const snapshot of [job, student, parent]) {
            assert.ok(snapshot.updateTime.isEqual(r.updateTime), 'Report, receipt and both items must have the same Emulator commit timestamp');
        }
        return [r, job, student, parent];
    };
    return { id, studentProfile, parentProfile, studentUid, parentUid, report, receipt, sentinel,
        item, owned, service, dispatch, snapshots, assertAtomicPublication };
}

function serverRejectedParentCreate(f) {
    const counters = { studentCreates: 0, parentCreates: 0 };
    // Fault injection changes only the parent's buffered create target to a
    // fixture document that already exists. Firestore itself rejects the commit
    // with ALREADY_EXISTS, after the student's create has already been buffered.
    // Reads, SDK Transaction objects and commit/rollback are NOT mocked.
    const wrapped = {
        collection: db.collection.bind(db),
        runTransaction: (callback) => db.runTransaction((transaction) => callback(new Proxy(transaction, {
            get(target, property) {
                if (property === 'create') return (ref, data) => {
                    if (ref.path === f.item(f.studentUid).path) counters.studentCreates += 1;
                    if (ref.path === f.item(f.parentUid).path) {
                        counters.parentCreates += 1;
                        return target.create(f.sentinel, data);
                    }
                    return target.create(ref, data);
                };
                const value = Reflect.get(target, property, target);
                return typeof value === 'function' ? value.bind(target) : value;
            },
        })), { maxAttempts: 1 }),
    };
    return { wrapped, counters };
}

test('concurrent requests complete once, with exactly one item per UID and one atomic commit', { timeout: 120000 }, async (t) => {
    const f = await fixture(t);
    const instance = f.service();
    const results = await Promise.all(Array.from({ length: 3 }, () => f.dispatch(instance)));
    assert.equal(results.filter(({ state }) => state === 'completed').length, 1);
    assert.ok(results.every(({ state }) => ['completed', 'busy', 'already_sent'].includes(state)), JSON.stringify(results));
    await f.assertAtomicPublication();
    for (const uid of [f.studentUid, f.parentUid]) {
        const items = await db.collection('notifications').doc(uid).collection('items').get();
        assert.equal(items.size, 1);
        assert.equal(items.docs[0].id, notificationIdFor(f.id, uid));
    }
});

test('server commit rejection after student create rolls back both items and report; retry succeeds', { timeout: 120000 }, async (t) => {
    const f = await fixture(t);
    const { wrapped, counters } = serverRejectedParentCreate(f);
    const result = await f.dispatch(f.service({ db: wrapped }));
    assert.equal(result.state, 'failed');
    assert.equal(result.errorCode, 6); // gRPC ALREADY_EXISTS from Emulator, not a thrown mock error.
    assert.equal(counters.studentCreates, 1);
    assert.equal(counters.parentCreates, 1);
    const [report, receipt, student, parent] = await f.snapshots();
    assert.equal(report.get('status'), 'draft');
    assert.equal(report.get('sentAt'), null);
    assert.equal(receipt.get('state'), 'failed');
    assert.equal(student.exists, false);
    assert.equal(parent.exists, false);
    assert.equal((await f.sentinel.get()).get('fixtureId'), f.id);
    assert.equal((await f.dispatch()).state, 'completed');
    await f.assertAtomicPublication();
    assert.equal((await f.dispatch()).state, 'already_sent');
});

test('scheduled and immediate requests racing for the same due report publish once', { timeout: 120000 }, async (t) => {
    const f = await fixture(t, { sendMode: 'scheduled', sendStatus: 'scheduled', dispatchServiceVersion: SERVICE_VERSION,
        scheduledSendAt: Timestamp.fromMillis(Date.now() - 60000) });
    const instance = f.service();
    const results = await Promise.all([f.dispatch(instance, { mode: 'scheduled' }), f.dispatch(instance, { mode: 'now' })]);
    assert.equal(results.filter(({ state }) => state === 'completed').length, 1);
    assert.ok(results.every(({ state }) => ['completed', 'busy', 'already_sent'].includes(state)), JSON.stringify(results));
    await f.assertAtomicPublication();
});

test('flag OFF leaves due reservation pending and creates no items or dispatch receipt', { timeout: 30000 }, async (t) => {
    const f = await fixture(t, { sendMode: 'scheduled', sendStatus: 'scheduled', dispatchServiceVersion: SERVICE_VERSION,
        scheduledSendAt: Timestamp.fromMillis(Date.now() - 60000) });
    const result = await f.dispatch(f.service({ sendingEnabled: () => false }), { mode: 'scheduled' });
    assert.equal(result.state, 'deferred_disabled');
    const [report, receipt, student, parent] = await f.snapshots();
    assert.equal(report.get('status'), 'draft');
    assert.equal(report.get('sendStatus'), 'scheduled');
    assert.equal(report.get('sentAt'), null);
    assert.equal(receipt.exists, false);
    assert.equal(student.exists, false);
    assert.equal(parent.exists, false);
});

test('pre-existing matching notification retains its complete data and server updateTime', { timeout: 30000 }, async (t) => {
    const f = await fixture(t);
    const existing = { dispatchEvent: 'first-publication', refId: f.id, type: 'lesson_report',
        isRead: true, readAt: Timestamp.fromMillis(2000), createdAt: Timestamp.fromMillis(1000), extraField: 'preserve' };
    await f.item(f.studentUid).create(existing);
    const beforeSnapshot = await f.item(f.studentUid).get();
    const result = await f.dispatch();
    assert.equal(result.state, 'completed');
    assert.equal(result.newItemCount, 1);
    const [report, receipt, student, parent] = await f.snapshots();
    assert.deepEqual(student.data(), existing);
    assert.ok(student.updateTime.isEqual(beforeSnapshot.updateTime));
    assert.ok(report.updateTime.isEqual(parent.updateTime));
    assert.ok(report.updateTime.isEqual(receipt.updateTime));
});

test('distinct document IDs and Auth UIDs resolve through real Emulator profiles and indexes', { timeout: 30000 }, async (t) => {
    const f = await fixture(t);
    assert.notEqual(f.studentProfile, f.studentUid);
    assert.notEqual(f.parentProfile, f.parentUid);
    assert.equal((await f.dispatch()).state, 'completed');
    const [, , student, parent] = await f.assertAtomicPublication();
    assert.equal(student.ref.parent.parent.id, f.studentUid);
    assert.equal(parent.ref.parent.parent.id, f.parentUid);
    assert.equal(student.get('studentId'), f.studentProfile);
    for (const profileId of [f.studentProfile, f.parentProfile]) {
        assert.equal((await db.collection('notifications').doc(profileId).collection('items').get()).empty, true);
    }
});

test('rescheduling and cancellation reject stale workers without creating notifications', { timeout: 30000 }, async (t) => {
    const f = await fixture(t);
    const instance = f.service();
    const args = { reportId: f.id, scheduledSendAt: Timestamp.fromMillis(Date.now() + 3600000) };
    assert.equal((await instance.schedule({ ...args, expectedRevision: 0 })).state, 'scheduled');
    assert.equal((await instance.schedule({ ...args, expectedRevision: 1 })).state, 'scheduled');
    assert.equal((await f.dispatch(instance, { mode: 'scheduled', expectedRevision: 1 })).state, 'stale_revision');
    assert.equal((await instance.cancelSchedule({ reportId: f.id, expectedRevision: 2 })).state, 'cancelled');
    assert.equal((await f.dispatch(instance, { mode: 'scheduled', expectedRevision: 2 })).state, 'stale_revision');
    assert.equal((await f.dispatch(instance, { mode: 'scheduled', expectedRevision: 3 })).state, 'not_scheduled');
    const [report, , student, parent] = await f.snapshots();
    assert.equal(report.get('status'), 'draft');
    assert.equal(student.exists, false);
    assert.equal(parent.exists, false);
});
