const { Timestamp } = require('firebase-admin/firestore');
const { confirmationEventKey, SCHEMA_VERSION, OUTBOX_STATES } = require('./confirmationService');
const { SOURCES, studentKey, plannedTime, isPendingReservation, parseKoreanReservationTime } = require('./reservationPolicy');
const { AUTH_FIELDS, keys, validDocId } = require('./confirmationRecipients');

const sameTime = (left, right) => left instanceof Timestamp && right instanceof Timestamp && left.isEqual(right);
const validJob = (job, eventKey) => job && job.schemaVersion === SCHEMA_VERSION && job.eventKey === eventKey
    && SOURCES.includes(job.sourceCollection) && validDocId(job.reservationId) && validDocId(job.studentProfileDocId)
    && Number.isSafeInteger(job.reservationRevision) && job.reservationRevision >= 0
    && OUTBOX_STATES.includes(job.state)
    && job.sourcePath === `${job.sourceCollection}/${job.reservationId}`
    && job.confirmationRef === `clinicReservationConfirmations/${eventKey}`
    && confirmationEventKey({ ...job, expectedRevision: job.reservationRevision }) === eventKey;

// Read-only transaction helper. No Auth/network side effects or writes.
async function readCurrentConfirmation(tx, db, eventKey, at, jobSnapshot = null) {
    const jobRef = db.collection('clinicConfirmationOutbox').doc(eventKey);
    const jobSnap = jobSnapshot || await tx.get(jobRef);
    if (!jobSnap.exists) return { state: 'not_found', jobRef };
    const job = jobSnap.data();
    const result = { jobRef, job };
    if (!validJob(job, eventKey)) return { ...result, state: 'invalid', reason: 'invalid_outbox' };
    const historyRef = db.collection('clinicReservationConfirmations').doc(eventKey);
    const reservationRef = db.collection(job.sourceCollection).doc(job.reservationId);
    const studentRef = db.collection('users').doc(job.studentProfileDocId);
    const [historySnap, reservationSnap, studentSnap] = await Promise.all([tx.get(historyRef), tx.get(reservationRef), tx.get(studentRef)]);
    if (!historySnap.exists) return { ...result, state: 'invalid', reason: 'confirmation_history_missing' };
    const history = historySnap.data();
    const identityFields = ['schemaVersion', 'eventKey', 'sourceCollection', 'reservationId', 'sourcePath', 'studentProfileDocId', 'reservationRevision'];
    if (identityFields.some((field) => history[field] !== job[field]) || history.eventType !== 'clinic_reservation_confirmed'
        || history.timeZone !== 'Asia/Seoul' || !(history.confirmedAt instanceof Timestamp)
        || typeof history.confirmedBy !== 'string' || !history.confirmedBy) {
        return { ...result, state: 'invalid', reason: 'confirmation_identity_conflict' };
    }
    let times;
    try { times = parseKoreanReservationTime(history.date, history.plannedTime); }
    catch (_) { return { ...result, state: 'invalid', reason: 'invalid_confirmation_time' }; }
    if (!sameTime(history.reservationStartsAt, times.reservationStartsAt) || !sameTime(history.reminderDueAt, times.reminderDueAt)) {
        return { ...result, state: 'invalid', reason: 'invalid_confirmation_time' };
    }
    const stale = (reason) => ({ ...result, state: 'superseded', reason });
    if (!reservationSnap.exists) return stale('reservation_missing');
    const reservation = reservationSnap.data();
    if ((reservation.reservationRevision ?? 0) !== job.reservationRevision || reservation.confirmedRevision !== job.reservationRevision
        || reservation.confirmationStatus !== 'confirmed') return stale('revision_or_confirmation_changed');
    if (reservation.confirmedBy !== history.confirmedBy || !sameTime(reservation.confirmedAt, history.confirmedAt)) return stale('confirmation_changed');
    if (reservation.date !== history.date || plannedTime(reservation) !== history.plannedTime
        || !sameTime(reservation.reservationStartsAt, history.reservationStartsAt)
        || !sameTime(reservation.reminderDueAt, history.reminderDueAt)) return stale('reservation_time_changed');
    if (!isPendingReservation(reservation)) return stale('reservation_inactive_or_started');
    if (history.reservationStartsAt.toMillis() <= at.toMillis()) return stale('reservation_time_passed');
    if (!studentSnap.exists || studentSnap.data().role !== 'student') return stale('student_profile_changed');
    const primary = studentKey(reservation);
    if (!validDocId(primary)) return stale('student_link_changed');
    const index = await tx.get(db.collection('userAuthIndex').doc(primary));
    const bound = index.exists ? index.data().userDocId === studentSnap.id
        : primary === studentSnap.id || AUTH_FIELDS.some((field) => keys(studentSnap.data()[field]).includes(primary));
    if (!bound) return stale('student_link_changed');
    return { ...result, state: 'eligible', history, reservation, historyRef, reservationRef };
}

module.exports = { readCurrentConfirmation, validJob };
