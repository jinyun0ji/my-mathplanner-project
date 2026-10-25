const { createHash, randomUUID } = require('node:crypto');
const { Timestamp } = require('firebase-admin/firestore');
const { isNotificationSendingEnabled } = require('../notify/settings');
const { buildNotificationDocument } = require('../notify/builders');
const { createLessonReportRecipientResolver } = require('./recipients');

const EVENT = 'first-publication';
const SERVICE_VERSION = 1;
const TIME_ZONE = 'Asia/Seoul';
// Application budgets, deliberately below Firestore's 10 MiB request limit.
// The SDK/server still enforce wire size, document/index and transaction limits.
const MAX_ITEM_BYTES = 8 * 1024;
const MAX_ATOMIC_BYTES = 2 * 1024 * 1024;
const CONTENT_FIELDS = new Set(['comment', 'learnedTopics', 'attendanceStatus', 'selectedHomeworkProgressIds',
    'selectedAssignedHomeworkIds', 'selectedHomeworkIds', 'selectedTestIds', 'homeworkSummary',
    'assignedHomeworkSummary', 'testSummary', 'autoInputStatus', 'isModified']);
const notificationIdFor = (reportId, uid) => `lessonReport_${createHash('sha256')
    .update(JSON.stringify([reportId, EVENT, uid])).digest('hex')}`;
const outcome = (state, extra = {}) => ({ state, ...extra });
const isTimestamp = (value) => value instanceof Timestamp;

// No Cloud Function is registered here. db/auth are explicit so tests never use ADC.
const createLessonReportService = ({ db, auth, sendingEnabled = isNotificationSendingEnabled,
    now = () => Timestamp.now(), leaseMs = 60000, maxRecipients = 200,
    resolveRecipients = createLessonReportRecipientResolver({ db, auth }) }) => {
    if (!db || !auth) throw new Error('Explicit db and auth dependencies are required');
    if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0 || !Number.isSafeInteger(maxRecipients) || maxRecipients < 1 || maxRecipients > 200) {
        throw new Error('Invalid lease or recipient limit');
    }
    const refs = (reportId) => {
        if (typeof reportId !== 'string' || !reportId.trim() || reportId.includes('/')) throw new Error('Invalid reportId');
        const report = db.collection('lessonReports').doc(reportId);
        return { report, job: report.collection('dispatches').doc(EVENT) };
    };
    const active = (job, at) => job?.state === 'processing' && job.leaseUntil?.toMillis() > at.toMillis();
    const revisionMatches = (report, expected) => Number.isSafeInteger(expected) && expected >= 0
        && (report.dispatchRevision || 0) === expected;
    const eligibility = (report, mode, at) => {
        if (mode !== 'scheduled') return null;
        if (report.dispatchServiceVersion !== SERVICE_VERSION) return 'legacy_schedule_not_enrolled';
        if (report.sendMode !== 'scheduled' || report.sendStatus !== 'scheduled') return 'not_scheduled';
        if (!isTimestamp(report.scheduledSendAt)) return 'invalid_schedule';
        if (report.scheduledSendAt.toMillis() > at.toMillis()) return 'not_due';
        return null;
    };
    const locked = (report, job, owner, revision, at, mode) => revisionMatches(report, revision)
        && job?.owner === owner && active(job, at) && !eligibility(report, mode, at);
    const itemRef = (reportId, uid) => db.collection('notifications').doc(uid).collection('items').doc(notificationIdFor(reportId, uid));

    const change = async ({ reportId, expectedRevision, operation, scheduledSendAt, content }) => {
        const { report: reportRef, job: jobRef } = refs(reportId);
        if (operation === 'schedule' && (!isTimestamp(scheduledSendAt) || scheduledSendAt.toMillis() <= now().toMillis())) {
            throw new Error('scheduledSendAt must be a future Firestore Timestamp');
        }
        if (operation === 'save' && (!content || Object.keys(content).some((key) => !CONTENT_FIELDS.has(key)))) {
            throw new Error('Only report content fields may be saved');
        }
        return db.runTransaction(async (tx) => {
            const [snap, jobSnap] = await Promise.all([tx.get(reportRef), tx.get(jobRef)]);
            if (!snap.exists) return outcome('not_found');
            const report = snap.data();
            const job = jobSnap.data();
            if (!revisionMatches(report, expectedRevision)) return outcome('stale_revision');
            if (active(job, now())) return outcome('busy');
            if (job?.completedUids?.length && job.state !== 'completed') return outcome('dispatch_already_started');
            if (report.status === 'sent' && operation !== 'save') return outcome('already_sent');
            const patch = { dispatchRevision: expectedRevision + 1, updatedAt: now() };
            if (operation === 'save') {
                Object.assign(patch, content);
                // Preserve pending schedules; repair the historical sent/draft mismatch.
                if (report.status === 'sent') Object.assign(patch, { sendStatus: 'sent', scheduledSendAt: null,
                    scheduledBy: null, lastEditedAfterSentAt: now() });
            } else if (operation === 'schedule') {
                Object.assign(patch, { status: 'draft', sendStatus: 'scheduled', sendMode: 'scheduled',
                    scheduledSendAt, sentAt: null, studentNotificationSent: false, parentNotificationSent: false,
                    dispatchServiceVersion: SERVICE_VERSION, scheduleTimeZone: TIME_ZONE });
            } else {
                if (report.sendStatus !== 'scheduled') return outcome('not_scheduled');
                Object.assign(patch, { status: 'draft', sendStatus: 'draft', sendMode: 'now', scheduledSendAt: null,
                    scheduledBy: null, dispatchLastResult: { state: 'cancelled', at: now() } });
            }
            tx.update(reportRef, patch);
            if (jobSnap.exists && job.state !== 'completed') tx.update(jobRef, { state: 'invalidated', leaseUntil: now() });
            return outcome(operation === 'save' ? 'saved' : operation === 'schedule' ? 'scheduled' : 'cancelled',
                { revision: expectedRevision + 1 });
        });
    };

    const dispatch = async ({ reportId, mode = 'now', expectedRevision }) => {
        if (!['now', 'scheduled'].includes(mode)) throw new Error('Invalid mode');
        const { report: reportRef, job: jobRef } = refs(reportId);
        const owner = randomUUID();
        const claim = await db.runTransaction(async (tx) => {
            const [snap, jobSnap] = await Promise.all([tx.get(reportRef), tx.get(jobRef)]);
            if (!snap.exists) return outcome('not_found');
            const report = snap.data();
            const job = jobSnap.data();
            if (!revisionMatches(report, expectedRevision)) return outcome('stale_revision');
            if (report.status === 'sent' || job?.state === 'completed') return outcome('already_sent');
            const invalid = eligibility(report, mode, now());
            if (invalid) return outcome(invalid);
            if (active(job, now())) return outcome('busy');
            if (!sendingEnabled()) {
                tx.update(reportRef, { dispatchLastResult: { state: 'deferred_disabled', at: now() } });
                return outcome('deferred_disabled');
            }
            const sameRevision = job?.revision === expectedRevision;
            tx.set(jobRef, { event: EVENT, revision: expectedRevision, owner, state: 'processing',
                leaseUntil: Timestamp.fromMillis(now().toMillis() + leaseMs), attemptedAt: now(),
                attempts: (job?.attempts || 0) + 1,
                completedUids: sameRevision ? (job.completedUids || []) : [],
                recipients: sameRevision ? (job.recipients || null) : null });
            return outcome('claimed', { report, recipients: sameRevision ? job.recipients : null });
        });
        if (claim.state !== 'claimed') return claim;

        const finishWithoutDelivery = async (state, details = {}) => db.runTransaction(async (tx) => {
            const [snap, job] = await Promise.all([tx.get(reportRef), tx.get(jobRef)]);
            if (snap.exists && (snap.data().status === 'sent' || job.data()?.state === 'completed')) return outcome('already_sent');
            if (!snap.exists || !locked(snap.data(), job.data(), owner, expectedRevision, now(), mode)) return outcome('superseded');
            const result = { state, ...details, at: now() };
            tx.update(jobRef, { ...result, leaseUntil: now() });
            tx.update(reportRef, { dispatchLastResult: result });
            return result;
        });

        let recipients = claim.recipients;
        if (!recipients) {
            let resolution;
            try { resolution = await resolveRecipients(claim.report); }
            catch (error) { return finishWithoutDelivery('recipient_resolution_failed', { errorCode: error.code || 'lookup-failed' }); }
            if (resolution.issues.length) return finishWithoutDelivery('recipient_resolution_failed', { issues: resolution.issues });
            recipients = resolution.recipients;
            if (!recipients.length) return finishWithoutDelivery('no_recipients', { reason: resolution.reason || 'empty' });
            if (recipients.length > maxRecipients) return finishWithoutDelivery('recipient_limit_exceeded');
            const planned = await db.runTransaction(async (tx) => {
                const [snap, job] = await Promise.all([tx.get(reportRef), tx.get(jobRef)]);
                if (!snap.exists || !locked(snap.data(), job.data(), owner, expectedRevision, now(), mode)) return false;
                tx.update(jobRef, { recipients });
                return true;
            });
            if (!planned) return outcome('superseded');
        }

        // Validate frozen plans too: an old receipt must not bypass today's cap.
        if (!Array.isArray(recipients) || !recipients.length || recipients.length > maxRecipients) {
            return finishWithoutDelivery('recipient_limit_exceeded');
        }
        if (new Set(recipients.map(({ uid }) => uid)).size !== recipients.length
            || recipients.some(({ uid, roles }) => typeof uid !== 'string' || !uid || uid.includes('/') || uid.length > 128
                || !Array.isArray(roles) || !roles.length || roles.some((role) => !['student', 'parent'].includes(role)))) {
            return finishWithoutDelivery('invalid_recipient_plan');
        }

        try {
            const result = await db.runTransaction(async (tx) => {
                const [snap, jobSnap] = await Promise.all([tx.get(reportRef), tx.get(jobRef)]);
                if (!snap.exists) return outcome('superseded');
                if (snap.data().status === 'sent' || jobSnap.data()?.state === 'completed') return outcome('already_sent');
                if (!locked(snap.data(), jobSnap.data(), owner, expectedRevision, now(), mode)) return outcome('superseded');
                if (!sendingEnabled()) return outcome('deferred_disabled');

                const notificationRefs = recipients.map(({ uid }) => itemRef(reportId, uid));
                // All N+2 reads precede any write. No FCM/Auth/network side effects
                // inside the callback: Firestore may execute it more than once.
                const existing = await Promise.all(notificationRefs.map((ref) => tx.get(ref)));
                const report = snap.data();
                const at = now();
                for (const field of ['studentId', 'classId', 'lessonDate']) {
                    if (report[field] != null && typeof report[field] !== 'string') return outcome('invalid_report_metadata');
                }
                const documents = recipients.map(() => ({
                    ...buildNotificationDocument({ type: 'lesson_report', category: 'lessonReport',
                        title: '학습리포트가 도착했습니다.', body: '학습리포트가 도착했습니다.',
                        ref: `lessonReports/${reportId}`, refCollection: 'lessonReports', refId: reportId,
                        studentId: report.studentId }),
                    dispatchEvent: EVENT, createdAt: at, payload: { reportId, studentId: report.studentId,
                        classId: report.classId || null, lessonDate: report.lessonDate || null,
                        type: 'lesson_report', refCollection: 'lessonReports' },
                }));
                const itemBytes = documents.map((document) => Buffer.byteLength(JSON.stringify(document), 'utf8'));
                // Estimate bounded new writes plus paths/receipt and metadata margin.
                // This is not a replacement for Firestore's protobuf/index limits.
                const estimatedBytes = itemBytes.reduce((sum, bytes, i) => sum + bytes
                    + Buffer.byteLength(notificationRefs[i].path, 'utf8') + 1024, 0)
                    + Buffer.byteLength(JSON.stringify(recipients), 'utf8') + 8192;
                if (itemBytes.some((bytes) => bytes > MAX_ITEM_BYTES) || estimatedBytes > MAX_ATOMIC_BYTES) {
                    return outcome('atomic_payload_too_large');
                }
                for (const item of existing) {
                    if (item.exists && (item.data().dispatchEvent !== EVENT || item.data().refId !== reportId)) {
                        return outcome('notification_identity_conflict');
                    }
                }
                // Recheck after reads; cancellation/rescheduling conflicts with
                // this transaction's report read and forces an SDK retry.
                if (!locked(report, jobSnap.data(), owner, expectedRevision, at, mode)) return outcome('superseded');
                if (!sendingEnabled()) return outcome('deferred_disabled');

                const completed = recipients.map(({ uid }) => uid);
                const completedResult = { state: 'completed', targetCount: recipients.length,
                    createdCount: recipients.length, newItemCount: existing.filter((item) => !item.exists).length,
                    failedUids: [], failures: [], at };
                existing.forEach((item, i) => {
                    if (!item.exists) tx.create(notificationRefs[i], documents[i]);
                });
                // These writes and ALL creates commit together or none commit.
                // An onCreate event is emitted only after the report is public.
                tx.update(reportRef, { dispatchLastResult: completedResult,
                    studentNotificationSent: recipients.some(({ roles }) => roles.includes('student')),
                    parentNotificationSent: recipients.some(({ roles }) => roles.includes('parent')),
                    status: 'sent', sendStatus: 'sent', sendMode: mode,
                    scheduledSendAt: null, scheduledBy: null, sentAt: at });
                tx.update(jobRef, { ...completedResult, completedUids: completed,
                    atomicPublicationVersion: 1, leaseUntil: at });
                return completedResult;
            });
            if (['completed', 'already_sent', 'superseded'].includes(result.state)) return result;
            return finishWithoutDelivery(result.state);
        } catch (error) {
            // A rejected commit creates no subset of items. If the server
            // committed but its response was lost, never overwrite that success.
            return finishWithoutDelivery('failed', { errorCode: error.code || 'atomic-commit-failed',
                targetCount: recipients.length, createdCount: 0, failedUids: recipients.map(({ uid }) => uid) });
        }
    };

    return {
        dispatch,
        schedule: (args) => change({ ...args, operation: 'schedule' }),
        cancelSchedule: (args) => change({ ...args, operation: 'cancel' }),
        saveContent: (args) => change({ ...args, operation: 'save' }),
    };
};

module.exports = { createLessonReportService, notificationIdFor, SERVICE_VERSION, TIME_ZONE };
