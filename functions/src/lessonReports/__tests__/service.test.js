const assert = require('node:assert/strict');
const test = require('node:test');
const { Timestamp } = require('firebase-admin/firestore');
const { createLessonReportService, notificationIdFor, SERVICE_VERSION } = require('../service');
const { createFakeFirestore, createFakeAuth } = require('./fakeFirestore');

const REPORT = 'lessonReports/report-one';
const JOB = `${REPORT}/dispatches/first-publication`;
const pathFor = (uid) => `notifications/${uid}/items/${notificationIdFor('report-one', uid)}`;
const setup = (reportPatch = {}, options = {}) => {
    let millis = Date.UTC(2026, 9, 25, 0, 0);
    let enabled = true;
    const db = createFakeFirestore({
        [REPORT]: { studentId: 'student-profile', classId: 'class-one', lessonDate: '2026-10-25',
            status: 'draft', sendStatus: 'draft', sendMode: 'now', scheduledSendAt: null, sentAt: null,
            studentNotificationSent: false, parentNotificationSent: false, ...reportPatch },
        'users/student-profile': { role: 'student', authUid: 'student-auth' },
        'users/parent-profile': { role: 'parent', authUid: 'parent-auth', studentIds: ['student-profile'] },
    });
    const auth = createFakeAuth(['student-auth', 'parent-auth']);
    const now = () => Timestamp.fromMillis(millis);
    const service = createLessonReportService({ db, auth, now, sendingEnabled: () => enabled, ...options });
    const dispatch = (extra = {}) => service.dispatch({ reportId: 'report-one', expectedRevision: 0, ...extra });
    const fcmObservations = [];
    db.onCreate(({ path }) => {
        if (path.startsWith('notifications/')) fcmObservations.push({
            path, reportStatus: db.read(REPORT).status, sendStatus: db.read(REPORT).sendStatus,
            receiptState: db.read(JOB).state,
        });
    });
    return { db, service, dispatch, now, fcmObservations,
        advance: (ms) => { millis += ms; }, disable: () => { enabled = false; } };
};

test('completion follows item creation and uses the existing notification schema, never direct FCM', async () => {
    const ctx = setup();
    const result = await ctx.dispatch();
    assert.equal(result.state, 'completed');
    assert.equal(result.createdCount, 2);
    const report = ctx.db.read(REPORT);
    assert.equal(report.status, 'sent');
    assert.equal(report.sendStatus, 'sent');
    assert.equal(report.studentNotificationSent, true);
    assert.equal(report.parentNotificationSent, true);
    assert.ok(report.sentAt instanceof Timestamp);
    const item = ctx.db.read(pathFor('student-auth'));
    assert.equal(item.refCollection, 'lessonReports');
    assert.equal(item.refId, 'report-one');
    assert.equal(item.type, 'lesson_report');
    assert.equal(item.category, 'lessonReport');
    assert.equal(item.studentId, 'student-profile');
    assert.equal(item.isRead, false);
    const publication = ctx.db.commits.find(({ writes }) => writes.some(({ path, value }) => path === REPORT && value.status === 'sent'));
    assert.equal(publication.writes.filter(({ op }) => op === 'create').length, 2);
    assert.equal(publication.readCount, 4);
    assert.equal(ctx.fcmObservations.length, 2);
    assert.ok(ctx.fcmObservations.every(({ reportStatus, receiptState }) => reportStatus === 'sent' && receiptState === 'completed'));
    assert.ok(ctx.db.writes.every(({ path }) => path === REPORT || path === JOB || path.startsWith('notifications/')));
});

test('parallel duplicate invocations publish one event and exactly one item per UID', async () => {
    const ctx = setup();
    const results = await Promise.all(Array.from({ length: 5 }, () => ctx.dispatch()));
    assert.equal(results.filter(({ state }) => state === 'completed').length, 1);
    assert.ok(results.every(({ state }) => ['completed', 'busy', 'already_sent'].includes(state)));
    assert.equal(ctx.db.writes.filter(({ op }) => op === 'create').length, 2);
    assert.equal((await ctx.dispatch()).state, 'already_sent');
});

test('student create staged before parent failure rolls back every item and emits no FCM event', async () => {
    const ctx = setup();
    let stagedStudent = false;
    ctx.db.beforeCommit((writes) => {
        if (writes.some(({ path, op }) => path === pathFor('parent-auth') && op === 'create')) {
            stagedStudent = writes[0].path === pathFor('student-auth');
            assert.equal(ctx.db.read(pathFor('student-auth')), undefined);
            assert.equal(ctx.db.read(REPORT).status, 'draft');
        }
    });
    ctx.db.failNext(pathFor('parent-auth'));
    const failed = await ctx.dispatch();
    assert.equal(stagedStudent, true);
    assert.equal(failed.state, 'failed');
    assert.equal(failed.createdCount, 0);
    assert.deepEqual(failed.failedUids, ['student-auth', 'parent-auth']);
    assert.equal(ctx.db.read(REPORT).status, 'draft');
    assert.equal(ctx.db.read(REPORT).sentAt, null);
    assert.equal(ctx.db.read(REPORT).studentNotificationSent, false);
    assert.equal(ctx.db.read(REPORT).parentNotificationSent, false);
    assert.equal(ctx.db.read(pathFor('student-auth')), undefined);
    assert.equal(ctx.db.read(pathFor('parent-auth')), undefined);
    assert.equal(ctx.fcmObservations.length, 0);
    ctx.advance(1000);
    assert.equal((await ctx.dispatch()).state, 'completed');
    assert.equal(ctx.fcmObservations.length, 2);
    assert.ok(ctx.fcmObservations.every(({ reportStatus }) => reportStatus === 'sent'));
    const original = ctx.db.read(pathFor('student-auth'));
    ctx.db.seed(pathFor('student-auth'), { ...original, isRead: true, readAt: ctx.now() });
    assert.equal((await ctx.dispatch()).state, 'already_sent');
    assert.equal(ctx.db.read(pathFor('student-auth')).isRead, true);
    assert.equal(ctx.db.read(pathFor('student-auth')).createdAt.toMillis(), original.createdAt.toMillis());
    assert.equal(ctx.db.writes.filter(({ path, op }) => path === pathFor('student-auth') && op === 'create').length, 1);
});

test('complete failure remains retryable and distinct from no recipients', async () => {
    const ctx = setup();
    ctx.db.failNext(pathFor('parent-auth'), 2);
    assert.equal((await ctx.dispatch()).state, 'failed');
    assert.equal(ctx.db.read(REPORT).sentAt, null);
    assert.equal((await ctx.dispatch()).state, 'failed');
    assert.equal(ctx.fcmObservations.length, 0);
    assert.equal((await ctx.dispatch()).state, 'completed');
});

test('flag OFF never creates items or consumes a due reservation (including configured test UID)', async () => {
    const ctx = setup({ sendStatus: 'scheduled', sendMode: 'scheduled', dispatchServiceVersion: SERVICE_VERSION,
        scheduledSendAt: Timestamp.fromMillis(1) });
    const beforeTestUid = process.env.NOTIFICATION_TEST_UID;
    process.env.NOTIFICATION_TEST_UID = 'student-auth';
    try {
        ctx.disable();
        assert.equal((await ctx.dispatch({ mode: 'scheduled' })).state, 'deferred_disabled');
        assert.equal(ctx.db.read(REPORT).sendStatus, 'scheduled');
        assert.equal(ctx.db.read(REPORT).status, 'draft');
        assert.equal(ctx.db.read(REPORT).sentAt, null);
        assert.equal(ctx.db.paths().filter((path) => path.startsWith('notifications/')).length, 0);
        assert.equal(ctx.db.read(JOB), undefined);
    } finally {
        if (beforeTestUid === undefined) delete process.env.NOTIFICATION_TEST_UID;
        else process.env.NOTIFICATION_TEST_UID = beforeTestUid;
    }
});

test('no recipients and resolution failure are recorded separately without publication', async () => {
    const ctx = setup({ studentId: 'missing-student' });
    assert.equal((await ctx.dispatch()).state, 'no_recipients');
    assert.equal(ctx.db.read(JOB).state, 'no_recipients');
    assert.equal(ctx.db.read(REPORT).status, 'draft');
    const invalid = setup({}, { resolveRecipients: async () => ({ recipients: [], issues: [{ reason: 'unresolved_parent_link' }] }) });
    assert.equal((await invalid.dispatch()).state, 'recipient_resolution_failed');
    assert.equal(invalid.db.paths().some((path) => path.startsWith('notifications/')), false);
});

test('schedule requires explicit enrollment, Timestamp and a future instant', async () => {
    const ctx = setup({ sendMode: 'scheduled', sendStatus: 'scheduled', scheduledSendAt: Timestamp.fromMillis(1) });
    assert.equal((await ctx.dispatch({ mode: 'scheduled' })).state, 'legacy_schedule_not_enrolled');
    await assert.rejects(ctx.service.schedule({ reportId: 'report-one', expectedRevision: 0, scheduledSendAt: new Date() }), /Timestamp/);
    await assert.rejects(ctx.service.schedule({ reportId: 'report-one', expectedRevision: 0, scheduledSendAt: Timestamp.fromMillis(1) }), /future/);
    const due = Timestamp.fromMillis(ctx.now().toMillis() + 60000);
    assert.equal((await ctx.service.schedule({ reportId: 'report-one', expectedRevision: 0, scheduledSendAt: due })).state, 'scheduled');
    assert.equal(ctx.db.read(REPORT).scheduleTimeZone, 'Asia/Seoul');
    assert.equal((await ctx.dispatch({ mode: 'scheduled', expectedRevision: 1 })).state, 'not_due');
    ctx.advance(60000);
    assert.equal((await ctx.dispatch({ mode: 'scheduled', expectedRevision: 1 })).state, 'completed');
});

test('changed and cancelled schedules invalidate earlier versions without sending', async () => {
    const ctx = setup();
    const schedule = (revision, offset) => ctx.service.schedule({ reportId: 'report-one', expectedRevision: revision,
        scheduledSendAt: Timestamp.fromMillis(ctx.now().toMillis() + offset) });
    await schedule(0, 1000);
    await schedule(1, 2000);
    ctx.advance(1000);
    assert.equal((await ctx.dispatch({ mode: 'scheduled', expectedRevision: 1 })).state, 'stale_revision');
    assert.equal((await ctx.dispatch({ mode: 'scheduled', expectedRevision: 2 })).state, 'not_due');
    assert.equal((await ctx.service.cancelSchedule({ reportId: 'report-one', expectedRevision: 2 })).state, 'cancelled');
    ctx.advance(5000);
    assert.equal((await ctx.dispatch({ mode: 'scheduled', expectedRevision: 2 })).state, 'stale_revision');
    assert.equal((await ctx.dispatch({ mode: 'scheduled', expectedRevision: 3 })).state, 'not_scheduled');
    assert.equal(ctx.db.paths().some((path) => path.startsWith('notifications/')), false);
});

test('content saves preserve schedules and published state, rejecting delivery field patches', async () => {
    const ctx = setup();
    const due = Timestamp.fromMillis(ctx.now().toMillis() + 1000);
    await ctx.service.schedule({ reportId: 'report-one', expectedRevision: 0, scheduledSendAt: due });
    await ctx.service.saveContent({ reportId: 'report-one', expectedRevision: 1, content: { comment: 'Updated locally' } });
    assert.equal(ctx.db.read(REPORT).scheduledSendAt.toMillis(), due.toMillis());
    assert.equal(ctx.db.read(REPORT).sendStatus, 'scheduled');
    assert.equal((await ctx.dispatch({ mode: 'scheduled', expectedRevision: 1 })).state, 'stale_revision');
    ctx.advance(1000);
    await ctx.dispatch({ mode: 'scheduled', expectedRevision: 2 });
    const sentAt = ctx.db.read(REPORT).sentAt;
    ctx.advance(1000);
    await ctx.service.saveContent({ reportId: 'report-one', expectedRevision: 2, content: { comment: 'Edited after publication' } });
    assert.equal(ctx.db.read(REPORT).status, 'sent');
    assert.equal(ctx.db.read(REPORT).sendStatus, 'sent');
    assert.equal(ctx.db.read(REPORT).sentAt.toMillis(), sentAt.toMillis());
    await assert.rejects(ctx.service.saveContent({ reportId: 'report-one', expectedRevision: 3, content: { sendStatus: 'draft' } }), /content fields/);
});

test('already sent legacy report does not invent delivery receipts or resend', async () => {
    const ctx = setup({ status: 'sent', sendStatus: 'draft', sentAt: Timestamp.fromMillis(123) });
    assert.equal((await ctx.dispatch()).state, 'already_sent');
    assert.equal(ctx.db.writes.length, 0);
    await ctx.service.saveContent({ reportId: 'report-one', expectedRevision: 0, content: { comment: 'Edit' } });
    assert.equal(ctx.db.read(REPORT).sendStatus, 'sent');
    assert.equal(ctx.db.read(REPORT).sentAt.toMillis(), 123);
});

test('expired owner is fenced out; another invocation safely resumes its event', async () => {
    let release;
    const paused = new Promise((resolve) => { release = resolve; });
    const targets = [{ uid: 'student-auth', roles: ['student'] }];
    let calls = 0;
    const ctx = setup({}, { resolveRecipients: async () => {
        calls += 1;
        if (calls === 1) await paused;
        return { recipients: targets, issues: [] };
    } });
    const first = ctx.dispatch();
    // Wait until the first invocation owns the lease and is resolving recipients.
    while (calls === 0) await new Promise((resolve) => setImmediate(resolve));
    assert.equal((await ctx.service.cancelSchedule({ reportId: 'report-one', expectedRevision: 0 })).state, 'busy');
    ctx.advance(60001);
    assert.equal((await ctx.dispatch()).state, 'completed');
    release();
    assert.equal((await first).state, 'superseded');
    assert.equal(ctx.db.writes.filter(({ op }) => op === 'create').length, 1);
});

test('a failed atomic attempt leaves no partial delivery and can be edited or cancelled', async () => {
    const ctx = setup({ sendMode: 'scheduled', sendStatus: 'scheduled', dispatchServiceVersion: SERVICE_VERSION,
        scheduledSendAt: Timestamp.fromMillis(1) });
    ctx.db.failNext(pathFor('parent-auth'));
    await ctx.dispatch({ mode: 'scheduled' });
    assert.equal(ctx.fcmObservations.length, 0);
    assert.equal((await ctx.service.saveContent({ reportId: 'report-one', expectedRevision: 0, content: { comment: 'Change' } })).state, 'saved');
    assert.equal((await ctx.service.cancelSchedule({ reportId: 'report-one', expectedRevision: 1 })).state, 'cancelled');
});

test('flag turning off during processing prevents completion and remaining writes', async () => {
    let checks = 0;
    const ctx = setup({}, { sendingEnabled: () => ++checks <= 2 });
    assert.equal((await ctx.dispatch()).state, 'deferred_disabled');
    assert.equal(ctx.db.read(REPORT).status, 'draft');
    assert.equal(ctx.db.read(REPORT).sentAt, null);
    assert.equal(ctx.db.writes.filter(({ op }) => op === 'create').length, 0);
    assert.equal(ctx.fcmObservations.length, 0);
});

test('stable item IDs unify immediate and scheduled first-publication attempts', async () => {
    const ctx = setup();
    await ctx.service.schedule({ reportId: 'report-one', expectedRevision: 0,
        scheduledSendAt: Timestamp.fromMillis(ctx.now().toMillis() + 1000) });
    assert.equal((await ctx.dispatch({ expectedRevision: 1 })).state, 'completed');
    ctx.advance(1000);
    assert.equal((await ctx.dispatch({ mode: 'scheduled', expectedRevision: 1 })).state, 'already_sent');
    assert.equal(ctx.db.writes.filter(({ op }) => op === 'create').length, 2);
});

test('publication write failure rolls back all notifications and is safely retryable', async () => {
    const ctx = setup();
    ctx.db.failNext(REPORT);
    assert.equal((await ctx.dispatch()).state, 'failed');
    assert.equal(ctx.db.read(REPORT).status, 'draft');
    assert.equal(ctx.db.read(JOB).completedUids.length, 0);
    assert.equal(ctx.fcmObservations.length, 0);
    assert.equal((await ctx.dispatch()).state, 'completed');
    assert.equal(ctx.db.writes.filter(({ op }) => op === 'create').length, 2);
});

test('pre-existing deterministic notification is reused without updating any fields', async () => {
    const ctx = setup();
    const existing = { type: 'lesson_report', refId: 'report-one', dispatchEvent: 'first-publication',
        isRead: true, readAt: Timestamp.fromMillis(50), createdAt: Timestamp.fromMillis(10) };
    ctx.db.seed(pathFor('student-auth'), existing);
    assert.equal((await ctx.dispatch()).state, 'completed');
    assert.deepEqual(ctx.db.read(pathFor('student-auth')), existing);
    assert.equal(ctx.db.writes.some(({ path }) => path === pathFor('student-auth')), false);
});

test('lookup errors can retry after correction without consuming the event', async () => {
    let fail = true;
    const ctx = setup({}, { resolveRecipients: async () => {
        if (fail) throw Object.assign(new Error('Mock lookup unavailable'), { code: 'unavailable' });
        return { recipients: [{ uid: 'student-auth', roles: ['student'] }], issues: [] };
    } });
    assert.equal((await ctx.dispatch()).state, 'recipient_resolution_failed');
    assert.equal(ctx.db.read(REPORT).status, 'draft');
    fail = false;
    assert.equal((await ctx.dispatch()).state, 'completed');
    assert.equal(ctx.db.read(REPORT).parentNotificationSent, false);
});

test('default production flag guard stays OFF even with a test-UID exception', async () => {
    const savedFlag = process.env.NOTIFICATION_SENDING_ENABLED;
    const savedUid = process.env.NOTIFICATION_TEST_UID;
    process.env.NOTIFICATION_SENDING_ENABLED = 'false';
    process.env.NOTIFICATION_TEST_UID = 'student-auth';
    try {
        const ctx = setup();
        const service = createLessonReportService({ db: ctx.db, auth: createFakeAuth(['student-auth']), now: ctx.now });
        assert.equal((await service.dispatch({ reportId: 'report-one', expectedRevision: 0 })).state, 'deferred_disabled');
        assert.equal(ctx.db.paths().some((path) => path.startsWith('notifications/')), false);
    } finally {
        if (savedFlag === undefined) delete process.env.NOTIFICATION_SENDING_ENABLED;
        else process.env.NOTIFICATION_SENDING_ENABLED = savedFlag;
        if (savedUid === undefined) delete process.env.NOTIFICATION_TEST_UID;
        else process.env.NOTIFICATION_TEST_UID = savedUid;
    }
});

test('cancel invalidates a paused expired owner before it materializes any notification', async () => {
    let release;
    let started = false;
    const paused = new Promise((resolve) => { release = resolve; });
    const ctx = setup({ sendStatus: 'scheduled', sendMode: 'scheduled', dispatchServiceVersion: SERVICE_VERSION,
        scheduledSendAt: Timestamp.fromMillis(1) }, { resolveRecipients: async () => {
        started = true;
        await paused;
        return { recipients: [{ uid: 'student-auth', roles: ['student'] }], issues: [] };
    } });
    const pending = ctx.dispatch({ mode: 'scheduled' });
    while (!started) await new Promise((resolve) => setImmediate(resolve));
    ctx.advance(60001);
    assert.equal((await ctx.service.cancelSchedule({ reportId: 'report-one', expectedRevision: 0 })).state, 'cancelled');
    release();
    assert.equal((await pending).state, 'superseded');
    assert.equal(ctx.db.paths().some((path) => path.startsWith('notifications/')), false);
});

test('missing/stale revisions and oversized target sets fail closed', async () => {
    const ctx = setup();
    assert.equal((await ctx.dispatch({ expectedRevision: undefined })).state, 'stale_revision');
    assert.equal((await ctx.dispatch({ expectedRevision: 1 })).state, 'stale_revision');
    const limited = setup({}, { maxRecipients: 1 });
    assert.equal((await limited.dispatch()).state, 'recipient_limit_exceeded');
    assert.equal(limited.db.paths().some((path) => path.startsWith('notifications/')), false);
});

test('due scheduled dispatch racing immediate dispatch publishes only once', async () => {
    const ctx = setup({ sendMode: 'scheduled', sendStatus: 'scheduled', dispatchServiceVersion: SERVICE_VERSION,
        scheduledSendAt: Timestamp.fromMillis(1) });
    const results = await Promise.all([ctx.dispatch({ mode: 'scheduled' }), ctx.dispatch({ mode: 'now' })]);
    assert.equal(results.filter(({ state }) => state === 'completed').length, 1);
    assert.ok(results.every(({ state }) => ['completed', 'busy', 'already_sent'].includes(state)));
    assert.equal(ctx.db.commits.filter(({ writes }) => writes.some(({ path, value }) => path === REPORT && value.status === 'sent')).length, 1);
    assert.equal(ctx.fcmObservations.length, 2);
    assert.ok(ctx.fcmObservations.every(({ reportStatus, sendStatus }) => reportStatus === 'sent' && sendStatus === 'sent'));
});

test('SDK callback retries discard staged creates on conflict and emit events only for the committed attempt', async () => {
    const ctx = setup();
    let attempts = 0;
    ctx.db.beforeCommit((writes) => {
        if (!writes.some(({ op }) => op === 'create')) return;
        attempts += 1;
        assert.equal(ctx.fcmObservations.length, 0);
        if (attempts === 1) ctx.db.seed(REPORT, { ...ctx.db.read(REPORT), comment: 'Concurrent edit without revision' });
    });
    assert.equal((await ctx.dispatch()).state, 'completed');
    assert.equal(attempts, 2);
    assert.equal(ctx.db.writes.filter(({ op }) => op === 'create').length, 2);
    assert.equal(ctx.fcmObservations.length, 2);
    assert.ok(ctx.fcmObservations.every(({ reportStatus }) => reportStatus === 'sent'));
});

test('worker stopped after staging creates has no visible items; lease takeover publishes atomically', async () => {
    const ctx = setup();
    let release;
    let stopped = false;
    const pause = new Promise((resolve) => { release = resolve; });
    ctx.db.beforeCommit(async (writes) => {
        if (!stopped && writes.some(({ op }) => op === 'create')) {
            stopped = true;
            await pause;
        }
    });
    const interrupted = ctx.dispatch();
    while (!stopped) await new Promise((resolve) => setImmediate(resolve));
    assert.equal(ctx.db.read(REPORT).status, 'draft');
    assert.equal(ctx.db.read(pathFor('student-auth')), undefined);
    assert.equal(ctx.db.read(pathFor('parent-auth')), undefined);
    assert.equal(ctx.fcmObservations.length, 0);
    assert.equal((await ctx.dispatch()).state, 'busy');
    ctx.advance(60001);
    assert.equal((await ctx.dispatch()).state, 'completed');
    release();
    assert.equal((await interrupted).state, 'already_sent');
    assert.equal(ctx.fcmObservations.length, 2);
    assert.ok(ctx.fcmObservations.every(({ reportStatus }) => reportStatus === 'sent'));
});

test('lost commit acknowledgement is reconciled as already sent and never overwrites success', async () => {
    const ctx = setup();
    let lost = false;
    ctx.db.afterCommit((writes) => {
        if (!lost && writes.some(({ path, value }) => path === REPORT && value.status === 'sent')) {
            lost = true;
            throw Object.assign(new Error('Mock lost acknowledgement'), { code: 'deadline-exceeded' });
        }
    });
    assert.equal((await ctx.dispatch()).state, 'already_sent');
    assert.equal(ctx.db.read(REPORT).dispatchLastResult.state, 'completed');
    assert.equal(ctx.db.read(JOB).state, 'completed');
    assert.equal((await ctx.dispatch()).state, 'already_sent');
    assert.equal(ctx.fcmObservations.length, 2);
});

test('maximum recipient set has 202 reads/writes in one publication, with every event seeing public state', async () => {
    const recipients = Array.from({ length: 200 }, (_, i) => ({ uid: `fictional-auth-${i}`, roles: ['student'] }));
    const ctx = setup({}, { resolveRecipients: async () => ({ recipients, issues: [] }) });
    assert.equal((await ctx.dispatch()).state, 'completed');
    const publication = ctx.db.commits.find(({ writes }) => writes.some(({ path, value }) => path === REPORT && value.status === 'sent'));
    assert.equal(publication.readCount, 202);
    assert.equal(publication.writes.length, 202);
    assert.equal(ctx.fcmObservations.length, 200);
    assert.ok(ctx.fcmObservations.every(({ reportStatus, receiptState }) => reportStatus === 'sent' && receiptState === 'completed'));
});

test('oversized metadata aborts before any visible item and does not split the publication', async () => {
    const ctx = setup({ classId: 'x'.repeat(9000) });
    assert.equal((await ctx.dispatch()).state, 'atomic_payload_too_large');
    assert.equal(ctx.db.read(REPORT).status, 'draft');
    assert.equal(ctx.fcmObservations.length, 0);
    assert.equal(ctx.db.writes.filter(({ op }) => op === 'create').length, 0);
});

test('conflicting existing notification fails closed without creating the remaining item', async () => {
    const ctx = setup();
    const foreignItem = { refId: 'different-report', dispatchEvent: 'first-publication', isRead: true };
    ctx.db.seed(pathFor('student-auth'), foreignItem);
    assert.equal((await ctx.dispatch()).state, 'notification_identity_conflict');
    assert.deepEqual(ctx.db.read(pathFor('student-auth')), foreignItem);
    assert.equal(ctx.db.read(pathFor('parent-auth')), undefined);
    assert.equal(ctx.fcmObservations.length, 0);
});

test('legacy partial receipt is completed atomically without modifying an already read item', async () => {
    const ctx = setup();
    const existing = { refId: 'report-one', dispatchEvent: 'first-publication', isRead: true,
        readAt: Timestamp.fromMillis(20), createdAt: Timestamp.fromMillis(10) };
    ctx.db.seed(pathFor('student-auth'), existing);
    ctx.db.seed(JOB, { state: 'partial_failure', revision: 0, completedUids: ['student-auth'],
        recipients: [{ uid: 'student-auth', roles: ['student'] }, { uid: 'parent-auth', roles: ['parent'] }] });
    assert.equal((await ctx.service.cancelSchedule({ reportId: 'report-one', expectedRevision: 0 })).state, 'dispatch_already_started');
    const result = await ctx.dispatch();
    assert.equal(result.state, 'completed');
    assert.equal(result.newItemCount, 1);
    assert.deepEqual(ctx.db.read(pathFor('student-auth')), existing);
    assert.equal(ctx.fcmObservations.length, 1);
    assert.equal(ctx.fcmObservations[0].reportStatus, 'sent');
});
