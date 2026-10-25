const { createHash, randomUUID } = require('node:crypto');
const { Timestamp } = require('firebase-admin/firestore');
const { isNotificationSendingEnabled } = require('../notify/settings');
const { buildNotificationDocument } = require('../notify/builders');
const { createLessonReportRecipientResolver } = require('./recipients');

const EVENT = 'first-publication';
const SERVICE_VERSION = 1;
const TIME_ZONE = 'Asia/Seoul';
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

        const failures = [];
        for (const recipient of recipients) {
            try {
                const result = await db.runTransaction(async (tx) => {
                    const ref = itemRef(reportId, recipient.uid);
                    const [snap, jobSnap, existing] = await Promise.all([tx.get(reportRef), tx.get(jobRef), tx.get(ref)]);
                    if (!snap.exists || !locked(snap.data(), jobSnap.data(), owner, expectedRevision, now(), mode)) return 'superseded';
                    if (!sendingEnabled()) return 'deferred_disabled';
                    const job = jobSnap.data();
                    if (existing.exists) {
                        if (existing.data().dispatchEvent !== EVENT || existing.data().refId !== reportId) throw new Error('Notification identity conflict');
                    } else {
                        tx.create(ref, { ...buildNotificationDocument({ type: 'lesson_report', category: 'lessonReport',
                            title: '학습리포트가 도착했습니다.', body: '학습리포트가 도착했습니다.',
                            ref: `lessonReports/${reportId}`, refCollection: 'lessonReports', refId: reportId,
                            studentId: snap.data().studentId }),
                        dispatchEvent: EVENT, createdAt: now(), payload: { reportId, studentId: snap.data().studentId,
                            classId: snap.data().classId || null, lessonDate: snap.data().lessonDate || null,
                            type: 'lesson_report', refCollection: 'lessonReports' } });
                    }
                    tx.update(jobRef, { completedUids: [...new Set([...(job.completedUids || []), recipient.uid])] });
                    return 'created_or_existing';
                });
                if (result === 'superseded') return outcome('superseded');
                if (result === 'deferred_disabled') break;
            } catch (error) { failures.push({ uid: recipient.uid, errorCode: error.code || 'item-write-failed' }); }
        }

        return db.runTransaction(async (tx) => {
            const [snap, jobSnap] = await Promise.all([tx.get(reportRef), tx.get(jobRef)]);
            if (!snap.exists || !locked(snap.data(), jobSnap.data(), owner, expectedRevision, now(), mode)) return outcome('superseded');
            const completed = new Set(jobSnap.data().completedUids || []);
            const disabled = !sendingEnabled();
            const complete = !disabled && recipients.every(({ uid }) => completed.has(uid));
            const state = disabled ? 'deferred_disabled' : complete ? 'completed' : completed.size ? 'partial_failure' : 'failed';
            const result = { state, targetCount: recipients.length, createdCount: completed.size,
                failedUids: recipients.filter(({ uid }) => !completed.has(uid)).map(({ uid }) => uid), failures, at: now() };
            const roleComplete = (role) => {
                const targets = recipients.filter(({ roles }) => roles.includes(role));
                return targets.length > 0 && targets.every(({ uid }) => completed.has(uid));
            };
            const patch = { dispatchLastResult: result, studentNotificationSent: roleComplete('student'), parentNotificationSent: roleComplete('parent') };
            if (complete) Object.assign(patch, { status: 'sent', sendStatus: 'sent', sendMode: mode,
                scheduledSendAt: null, scheduledBy: null, sentAt: now() });
            tx.update(reportRef, patch);
            tx.update(jobRef, { ...result, leaseUntil: now() });
            return result;
        });
    };

    return {
        dispatch,
        schedule: (args) => change({ ...args, operation: 'schedule' }),
        cancelSchedule: (args) => change({ ...args, operation: 'cancel' }),
        saveContent: (args) => change({ ...args, operation: 'save' }),
    };
};

module.exports = { createLessonReportService, notificationIdFor, SERVICE_VERSION, TIME_ZONE };
