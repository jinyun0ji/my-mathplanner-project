const { createHash, randomUUID } = require('node:crypto');
const { Timestamp } = require('firebase-admin/firestore');
const { isNotificationSendingEnabled } = require('../notify/settings');
const { buildNotificationDocument } = require('../notify/builders');
const { createClinicConfirmationRecipientResolver, validUid, validDocId, snapshotSignature } = require('./confirmationRecipients');
const { readCurrentConfirmation } = require('./confirmationEligibility');

const TYPE = 'CLINIC_RESERVATION_CONFIRMED';
const CATEGORY = 'clinicConfirmation';
const notificationIdFor = (eventKey, uid) => `clinicConfirmationInbox_${createHash('sha256').update(JSON.stringify([eventKey, uid])).digest('hex')}`;
const outcome = (state, extra = {}) => ({ state, ...extra });
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const bytes = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8');
const active = (job, at) => job.state === 'processing' && job.leaseUntil instanceof Timestamp && job.leaseUntil.toMillis() > at.toMillis();
const owns = (job, owner, at) => job?.owner === owner && active(job, at);
const codeOf = (cause) => String(cause?.code || 'inbox_commit_failed').slice(0, 80);

// Internal only: this module registers NO callable, trigger or Scheduler and
// never imports Messaging. Auth must be explicitly supplied by its future caller.
const createClinicConfirmationOutboxService = ({ db, auth, sendingEnabled = isNotificationSendingEnabled,
    now = () => Timestamp.now(), leaseMs = 120000, retryMs = 30000, batchSize = 25, maxRecipients = 200,
    resolveRecipients = createClinicConfirmationRecipientResolver({ db, auth }) }) => {
    if (!db || typeof auth?.getUser !== 'function') throw new Error('Explicit Firestore and Auth dependencies required');
    if (![leaseMs, retryMs, batchSize, maxRecipients].every((n) => Number.isSafeInteger(n) && n > 0)
        || leaseMs > 600000 || batchSize > 50 || maxRecipients > 200) throw new Error('Invalid delivery budgets');
    const refForPath = (path) => {
        const parts = typeof path === 'string' ? path.split('/') : [];
        if (parts.length !== 2 || !['users', 'userAuthIndex'].includes(parts[0]) || !validDocId(parts[1])) throw new Error('Invalid recipient evidence');
        return db.collection(parts[0]).doc(parts[1]);
    };
    const release = (tx, event, state, reason = null, patch = {}) => {
        const at = now();
        tx.update(event.jobRef, { state, owner: null, leaseUntil: null, updatedAt: at,
            nextAttemptAt: ['partial', 'deferred'].includes(state) ? Timestamp.fromMillis(at.toMillis() + retryMs) : null,
            lastError: reason ? { code: reason, at } : null, ...patch });
        return outcome(state, reason ? { reason } : {});
    };
    const terminal = (tx, event) => event.state === 'superseded'
        ? release(tx, event, 'superseded', event.reason)
        : release(tx, event, 'partial', event.reason || 'invalid_outbox');
    const finish = (eventKey, owner, state, reason, patch = {}) => db.runTransaction(async (tx) => {
        const ref = db.collection('clinicConfirmationOutbox').doc(eventKey);
        const snap = await tx.get(ref);
        if (!snap.exists || !owns(snap.data(), owner, now())) return outcome('lease_lost');
        const event = await readCurrentConfirmation(tx, db, eventKey, now(), snap);
        if (event.state !== 'eligible') return terminal(tx, event);
        if (!sendingEnabled()) return release(tx, event, 'deferred', 'notification_disabled');
        return release(tx, event, state, reason, patch);
    });

    const process = async (eventKey) => {
        if (typeof eventKey !== 'string' || !/^clinicConfirmation_[a-f0-9]{64}$/.test(eventKey)) throw new Error('Invalid clinic confirmation event key');
        const owner = randomUUID();
        const claim = await db.runTransaction(async (tx) => {
            const jobRef = db.collection('clinicConfirmationOutbox').doc(eventKey);
            const snap = await tx.get(jobRef);
            if (!snap.exists) return outcome('not_found');
            const job = snap.data();
            if (active(job, now())) return outcome('busy');
            if (job.nextAttemptAt instanceof Timestamp && job.nextAttemptAt.toMillis() > now().toMillis()) return outcome('not_due');
            const event = await readCurrentConfirmation(tx, db, eventKey, now(), snap);
            if (event.state !== 'eligible') return terminal(tx, event);
            if (job.state === 'completed' || job.state === 'superseded') return outcome(job.state);
            if (!sendingEnabled()) return release(tx, event, 'deferred', 'notification_disabled');
            if (!Number.isSafeInteger(job.attempts) || job.attempts < 0 || job.attempts >= Number.MAX_SAFE_INTEGER) {
                return release(tx, event, 'partial', 'invalid_attempt_count');
            }
            const at = now();
            tx.update(jobRef, { state: 'processing', owner, leaseUntil: Timestamp.fromMillis(at.toMillis() + leaseMs),
                attempts: job.attempts + 1, lastAttemptedAt: at, updatedAt: at, nextAttemptAt: null, lastError: null });
            return outcome('claimed', { studentProfileDocId: job.studentProfileDocId });
        });
        if (claim.state !== 'claimed') return claim;
        let resolution;
        try { resolution = await resolveRecipients({ studentProfileDocId: claim.studentProfileDocId }); }
        catch (cause) { return finish(eventKey, owner, 'partial', 'recipient_lookup_failed',
            { recipientResolution: { state: 'failed', resolvedAt: now(), issues: [{ reason: 'recipient_lookup_failed', code: codeOf(cause), retryable: true }] } }); }
        const recipients = resolution?.recipients;
        if (!Array.isArray(recipients) || recipients.length > maxRecipients) return finish(eventKey, owner, 'partial', 'recipient_limit_exceeded');
        if (!Array.isArray(resolution.issues) || !Array.isArray(resolution.excluded)
            || new Set(recipients.map((item) => item.uid)).size !== recipients.length
            || recipients.some((item) => !validUid(item.uid) || !Array.isArray(item.roles) || !item.roles.length
                || item.roles.some((role) => !['student', 'parent'].includes(role)) || !Array.isArray(item.profileIds)
                || !item.profileIds.length || item.profileIds.some((id) => !validDocId(id))
                || !Array.isArray(item.evidence) || !item.evidence.length)) return finish(eventKey, owner, 'partial', 'invalid_recipient_plan');

        let newItemCount = 0;
        const deliveryErrors = [];
        for (let offset = 0; offset < recipients.length; offset += batchSize) {
            const batch = recipients.slice(offset, offset + batchSize);
            try {
                const result = await db.runTransaction(async (tx) => {
                    const jobRef = db.collection('clinicConfirmationOutbox').doc(eventKey);
                    const snap = await tx.get(jobRef);
                    if (!snap.exists || !owns(snap.data(), owner, now())) return outcome('lease_lost');
                    const event = await readCurrentConfirmation(tx, db, eventKey, now(), snap);
                    if (event.state !== 'eligible') return terminal(tx, event);
                    if (!sendingEnabled()) return release(tx, event, 'deferred', 'notification_disabled');
                    const evidence = new Map();
                    for (const target of batch) for (const proof of target.evidence) {
                        if (typeof proof.signature !== 'string') throw new Error('Invalid recipient proof');
                        const ref = refForPath(proof.path);
                        if (!evidence.has(proof.path)) evidence.set(proof.path, { ref });
                    }
                    const signatures = await Promise.all([...evidence].map(async ([path, value]) => [path, snapshotSignature(await tx.get(value.ref))]));
                    const latest = new Map(signatures);
                    const targets = batch.map((recipient) => {
                        const notificationId = notificationIdFor(eventKey, recipient.uid);
                        return { recipient, notificationId,
                            inboxRef: db.collection('notifications').doc(recipient.uid).collection('items').doc(notificationId),
                            receiptRef: db.collection('clinicConfirmationDeliveries').doc(notificationId) };
                    });
                    const existing = await Promise.all(targets.map(async (target) => ({ ...target,
                        inbox: await tx.get(target.inboxRef), receipt: await tx.get(target.receiptRef) })));
                    const at = now();
                    if (!owns(event.job, owner, at)) return outcome('lease_lost');
                    if (!sendingEnabled()) return release(tx, event, 'deferred', 'notification_disabled');
                    const previous = event.job.recipientResults;
                    if (!isObject(previous) || Object.keys(previous).length > 500) return release(tx, event, 'partial', 'recipient_results_limit');
                    const merged = new Map(Object.entries(previous));
                    const pending = [];
                    const failures = [];
                    for (const target of existing) {
                        const { recipient, notificationId, inboxRef, receiptRef, inbox, receipt } = target;
                        const identity = { schemaVersion: 1, deliveryKind: 'clinic_confirmation', eventKey,
                            sourceCollection: event.job.sourceCollection, reservationId: event.job.reservationId,
                            sourcePath: event.job.sourcePath,
                            reservationRevision: event.job.reservationRevision, studentProfileDocId: event.job.studentProfileDocId,
                            recipientAuthUid: recipient.uid, notificationId, deliveryId: notificationId };
                        const sameIdentity = (data) => data && Object.entries(identity).every(([field, value]) => data[field] === value);
                        let reason = null;
                        if (!recipient.evidence.every((proof) => latest.get(proof.path) === proof.signature)) reason = 'recipient_state_changed';
                        else if (inbox.exists !== receipt.exists) reason = 'inbox_receipt_pair_missing';
                        else if (inbox.exists && (!sameIdentity(inbox.data()) || !sameIdentity(receipt.data())
                            || inbox.data().type !== TYPE || inbox.data().ref !== event.job.sourcePath
                            || inbox.data().category !== CATEGORY || inbox.data().refCollection !== event.job.sourceCollection
                            || inbox.data().refId !== event.job.reservationId || inbox.data().studentId !== event.job.studentProfileDocId
                            || inbox.data().title !== '클리닉 예약 완료' || inbox.data().body !== `${event.history.date} ${event.history.plannedTime}`
                            || receipt.data().confirmationRef !== event.job.confirmationRef || receipt.data().outboxRef !== jobRef.path
                            || receipt.data().inboxPath !== inboxRef.path || receipt.data().inboxState !== 'created')) reason = 'delivery_identity_conflict';
                        if (reason) {
                            failures.push({ uid: recipient.uid, reason });
                            // Never erase the record of an earlier successful inbox.
                            if (merged.get(recipient.uid)?.inboxState !== 'created') merged.set(recipient.uid, { inboxState: 'failed', errorCode: reason });
                            continue;
                        }
                        if (!inbox.exists) {
                            const inboxData = { ...buildNotificationDocument({ type: TYPE, category: CATEGORY,
                                title: '클리닉 예약 완료', body: `${event.history.date} ${event.history.plannedTime}`,
                                ref: event.job.sourcePath, refCollection: event.job.sourceCollection,
                                refId: event.job.reservationId, studentId: event.job.studentProfileDocId }),
                                ...identity, createdAt: at, payload: { eventKey, reservationRevision: event.job.reservationRevision,
                                    studentId: event.job.studentProfileDocId, sourceCollection: event.job.sourceCollection,
                                    reservationId: event.job.reservationId, deliveryId: notificationId, category: CATEGORY } };
                            const receiptData = { ...identity, confirmationRef: event.job.confirmationRef,
                                outboxRef: jobRef.path, inboxPath: inboxRef.path, recipientProfileIds: recipient.profileIds,
                                recipientRoles: recipient.roles, inboxState: 'created', inboxCreatedAt: at,
                                pushState: 'pending', pushAttempts: 0, pushOwner: null, pushLeaseUntil: null,
                                pushNextAttemptAt: null, pushLastAttemptedAt: null, pushLastError: null,
                                pushAcceptedAt: null, createdAt: at, updatedAt: at };
                            pending.push({ inboxRef, receiptRef, inboxData, receiptData });
                        }
                        merged.set(recipient.uid, { notificationId, deliveryId: notificationId, inboxState: 'created' });
                    }
                    const recipientResults = Object.fromEntries(merged);
                    const estimate = pending.reduce((total, item) => total + bytes(item.inboxData) + bytes(item.receiptData)
                        + Buffer.byteLength(item.inboxRef.path + item.receiptRef.path, 'utf8') + 4096, bytes(recipientResults) + 16384);
                    if (merged.size > 500 || bytes(recipientResults) > 128 * 1024 || estimate > 2 * 1024 * 1024
                        || pending.some((item) => bytes(item.inboxData) > 16 * 1024 || bytes(item.receiptData) > 16 * 1024)) {
                        return release(tx, event, 'partial', 'atomic_payload_limit');
                    }
                    // Last eligibility check after reads, before any write. Source
                    // edits conflict with its transaction read and cause a retry.
                    if (event.history.reservationStartsAt.toMillis() <= at.toMillis()) return release(tx, event, 'superseded', 'reservation_time_passed');
                    for (const item of pending) {
                        tx.create(item.inboxRef, item.inboxData);
                        tx.create(item.receiptRef, item.receiptData);
                    }
                    tx.update(jobRef, { recipientResults, updatedAt: at,
                        leaseUntil: Timestamp.fromMillis(at.toMillis() + leaseMs) });
                    return outcome('batch_created', { newItemCount: pending.length, failures });
                });
                if (result.state !== 'batch_created') return result;
                newItemCount += result.newItemCount;
                deliveryErrors.push(...result.failures);
            } catch (cause) {
                // A failed/lost-ack commit is safe to retry: existing paired
                // inbox/receipt documents are read and never overwritten.
                return finish(eventKey, owner, 'partial', 'inbox_commit_failed',
                    { lastError: { code: 'inbox_commit_failed', causeCode: codeOf(cause), at: now() } });
            }
        }
        const issueCount = resolution.issues.length + deliveryErrors.length;
        const state = recipients.length && !issueCount ? 'completed' : 'partial';
        const result = await finish(eventKey, owner, state, state === 'partial'
            ? (recipients.length ? 'recipient_partial_failure' : 'no_recipients') : null, {
            recipientResolution: { state: issueCount ? 'partial' : 'completed', resolvedAt: now(),
                issueCount, issues: [...resolution.issues, ...deliveryErrors].slice(0, 100),
                issuesTruncated: issueCount > 100, excludedCount: resolution.excluded.length,
                excluded: resolution.excluded.slice(0, 100) },
        });
        return { ...result, targetCount: recipients.length, newItemCount, issueCount };
    };
    return { process };
};

module.exports = { createClinicConfirmationOutboxService, notificationIdFor, TYPE, CATEGORY };
