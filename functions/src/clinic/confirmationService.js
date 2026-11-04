const { createHash } = require('node:crypto');
const { Timestamp, FieldValue } = require('firebase-admin/firestore');
const { createUserIdentityResolver } = require('../identity/resolveUserIdentity');
const { SOURCES, studentKey, plannedTime, isPendingReservation, parseKoreanReservationTime,
    studentReservationKeys, error } = require('./reservationPolicy');

const SCHEMA_VERSION = 1;
const STAFF_ROLES = new Set(['admin', 'staff', 'teacher', 'teaching', 'staffOrTeaching']);
const OUTBOX_STATES = Object.freeze(['pending', 'deferred', 'processing', 'partial', 'completed', 'superseded']);
const PROFILE_ALIASES = ['authUid', 'uid', 'userUid', 'studentUid', 'studentAuthUid'];
const confirmationEventKey = ({ sourceCollection, reservationId, expectedRevision }) => `clinicConfirmation_${createHash('sha256')
    .update(JSON.stringify(['clinic-confirmation-v1', sourceCollection, reservationId, expectedRevision])).digest('hex')}`;
const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);
const isRevision = (value) => Number.isSafeInteger(value) && value >= 0;
const revisionOf = (data) => data.reservationRevision === undefined ? 0 : data.reservationRevision;
const sameTimestamp = (left, right) => left instanceof Timestamp && right instanceof Timestamp && left.isEqual(right);

function validateRequest(data) {
    if (!isRecord(data) || Object.keys(data).some((key) => key !== 'reservations')
        || !Array.isArray(data.reservations) || data.reservations.length < 1 || data.reservations.length > 20) {
        throw error('invalid-argument', 'reservations에 1~20개의 예약을 지정해주세요.');
    }
    const seen = new Set();
    for (const item of data.reservations) {
        if (!isRecord(item) || Object.keys(item).some((key) => !['sourceCollection', 'reservationId', 'expectedRevision'].includes(key))
            || !SOURCES.includes(item.sourceCollection) || !isRevision(item.expectedRevision)
            || typeof item.reservationId !== 'string' || !item.reservationId.trim() || item.reservationId.includes('/')
            || ['.', '..'].includes(item.reservationId) || /^__.*__$/.test(item.reservationId)
            || Buffer.byteLength(item.reservationId, 'utf8') > 1500) {
            throw error('invalid-argument', '원본 컬렉션, 예약 ID와 expectedRevision을 확인해주세요.');
        }
        const key = JSON.stringify([item.sourceCollection, item.reservationId]);
        if (seen.has(key)) throw error('invalid-argument', '동일 예약을 중복으로 지정할 수 없습니다.');
        seen.add(key);
    }
}

// The verified callable context already proves the caller's Auth UID. Other
// profile IDs are NOT assumed to be Auth UIDs. Confirmation needs Firestore
// profile identity only, so no Auth/FCM/notification dependency can block it.
const profileResolver = (db, callerUid) => createUserIdentityResolver({ db, auth: {
    getUser: async (uid) => {
        if (uid === callerUid) return { uid };
        throw Object.assign(new Error('Auth lookup not needed for confirmation'), { code: 'auth/user-not-found' });
    },
} });
function boundToProfile(key, profile, index) {
    if (index.exists) return index.data().userDocId === profile.id;
    return key === profile.id || PROFILE_ALIASES.some((field) => profile.data()[field] === key);
}
function safeFailure(cause) {
    const numeric = { 4: 'deadline-exceeded', 5: 'not-found', 6: 'already-exists', 7: 'permission-denied',
        8: 'resource-exhausted', 9: 'failed-precondition', 10: 'aborted', 14: 'unavailable' };
    const allowed = new Set(['invalid-argument', 'not-found', 'permission-denied', 'failed-precondition', 'aborted']);
    if (allowed.has(cause?.code)) return { code: cause.code, message: cause.message };
    return { code: (typeof cause?.code === 'number' ? numeric[cause.code] : null)
        || (cause?.code === 'unavailable' ? 'unavailable' : 'internal'),
        message: '확정을 저장하지 못했습니다. 상태를 새로고침한 뒤 다시 시도해주세요.' };
}

const createClinicConfirmationService = ({ db, now = () => Timestamp.now(),
    serverTimestamp = () => FieldValue.serverTimestamp() }) => {
    if (!db) throw new Error('Explicit Firestore dependency is required');

    const confirmOne = async (item, callerUid, caller, resolveIdentity) => {
        const reservationRef = db.collection(item.sourceCollection).doc(item.reservationId);
        const initial = await reservationRef.get();
        if (!initial.exists) throw error('not-found', '지정한 원본 예약을 찾을 수 없습니다.');
        const originalStudentKey = studentKey(initial.data());
        const student = await studentReservationKeys({ db, resolveIdentity, key: originalStudentKey });
        const eventKey = confirmationEventKey(item);
        const historyRef = db.collection('clinicReservationConfirmations').doc(eventKey);
        const outboxRef = db.collection('clinicConfirmationOutbox').doc(eventKey);
        return db.runTransaction(async (tx) => {
            // All reads, including identity evidence, precede all three writes.
            const [snapshot, history, outbox, callerProfile, callerIndex, studentProfile, studentIndex] = await Promise.all([
                tx.get(reservationRef), tx.get(historyRef), tx.get(outboxRef),
                tx.get(db.collection('users').doc(caller.profileDocId)), tx.get(db.collection('userAuthIndex').doc(callerUid)),
                tx.get(db.collection('users').doc(student.studentDocId)), tx.get(db.collection('userAuthIndex').doc(originalStudentKey)),
            ]);
            if (!callerProfile.exists || !STAFF_ROLES.has(callerProfile.data().role)
                || callerProfile.data().active === false
                || !boundToProfile(callerUid, callerProfile, callerIndex)) {
                throw error('permission-denied', '예약 관리 권한을 확인할 수 없습니다.');
            }
            if (!snapshot.exists) throw error('not-found', '지정한 원본 예약을 찾을 수 없습니다.');
            const reservation = snapshot.data();
            const revision = revisionOf(reservation);
            if (!isRevision(revision)) throw error('failed-precondition', '예약 버전 값이 유효하지 않습니다.');
            if (revision !== item.expectedRevision || studentKey(reservation) !== originalStudentKey) {
                throw error('aborted', '예약이 변경되었습니다. 새로고침 후 다시 확정해주세요.');
            }
            if (!studentProfile.exists || studentProfile.data().role !== 'student'
                || !boundToProfile(originalStudentKey, studentProfile, studentIndex)) {
                throw error('failed-precondition', '예약의 학생 연결이 변경되었거나 유효하지 않습니다.');
            }
            if (!isPendingReservation(reservation)) throw error('failed-precondition', '활동이 시작되지 않은 유효한 예약만 확정할 수 있습니다.');
            const date = reservation.date;
            const time = plannedTime(reservation);
            const times = parseKoreanReservationTime(date, time);
            if (times.reservationStartsAt.toMillis() <= now().toMillis()) throw error('failed-precondition', '지난 예약은 확정할 수 없습니다.');
            if (history.exists || outbox.exists) {
                const recorded = history.data();
                const job = outbox.data();
                const sameIdentity = (value) => value?.schemaVersion === SCHEMA_VERSION && value.eventKey === eventKey
                    && value.sourceCollection === item.sourceCollection && value.reservationId === item.reservationId
                    && value.sourcePath === reservationRef.path
                    && value.reservationRevision === revision && value.studentProfileDocId === student.studentDocId;
                if (!sameIdentity(recorded) || !sameIdentity(job) || recorded.date !== date || recorded.plannedTime !== time
                    || !sameTimestamp(recorded.reservationStartsAt, times.reservationStartsAt)
                    || !sameTimestamp(recorded.reminderDueAt, times.reminderDueAt)
                    || job.confirmationRef !== historyRef.path || !OUTBOX_STATES.includes(job.state)
                    || typeof recorded.confirmedBy !== 'string' || !recorded.confirmedBy
                    || typeof recorded.confirmedByProfileDocId !== 'string' || !recorded.confirmedByProfileDocId
                    || reservation.confirmationStatus !== 'confirmed' || reservation.confirmedRevision !== revision
                    || reservation.confirmedBy !== recorded.confirmedBy || !sameTimestamp(reservation.confirmedAt, recorded.confirmedAt)) {
                    throw error('failed-precondition', '확정 이력과 예약 상태가 일치하지 않습니다. 관리자 확인이 필요합니다.');
                }
                return { status: 'already_confirmed', eventKey, reservationRevision: revision, outboxState: job.state };
            }
            // Do not silently reconstruct missing receipts or re-send a legacy
            // same-revision confirmation whose provenance cannot be established.
            if (reservation.confirmationStatus === 'confirmed' || reservation.confirmedRevision === revision) {
                throw error('failed-precondition', '기존 확정에 대한 이력이 없습니다. 관리자 확인이 필요합니다.');
            }
            const at = serverTimestamp();
            const identity = { schemaVersion: SCHEMA_VERSION, eventKey, sourceCollection: item.sourceCollection,
                reservationId: item.reservationId, sourcePath: reservationRef.path,
                studentProfileDocId: student.studentDocId, reservationRevision: revision };
            tx.create(historyRef, { ...identity, eventType: 'clinic_reservation_confirmed', date, plannedTime: time, ...times,
                timeZone: 'Asia/Seoul', confirmedBy: callerUid, confirmedByProfileDocId: caller.profileDocId,
                confirmedAt: at, createdAt: at,
                previousConfirmation: { confirmationStatus: reservation.confirmationStatus ?? null,
                    confirmedRevision: reservation.confirmedRevision ?? null, confirmedAt: reservation.confirmedAt ?? null,
                    confirmedBy: reservation.confirmedBy ?? null } });
            tx.create(outboxRef, { ...identity, confirmationRef: historyRef.path, state: 'pending',
                createdAt: at, updatedAt: at, attempts: 0, owner: null, leaseUntil: null,
                lastAttemptedAt: null, nextAttemptAt: null, lastError: null,
                recipientResolution: { state: 'not_started', issues: [] }, recipientResults: {} });
            tx.update(reservationRef, { confirmationStatus: 'confirmed', confirmedRevision: revision,
                confirmedAt: at, confirmedBy: callerUid, reservationRevision: revision, ...times,
                updatedAt: at, updatedBy: callerUid });
            return { status: 'confirmed', eventKey, reservationRevision: revision, outboxState: 'pending' };
        });
    };

    const confirmReservations = async (data, context) => {
        const callerUid = context?.auth?.uid;
        if (!callerUid) throw error('unauthenticated', '로그인이 필요합니다.');
        validateRequest(data);
        const resolveIdentity = profileResolver(db, callerUid);
        const caller = await resolveIdentity(callerUid);
        if (!caller || !STAFF_ROLES.has(caller.role)) throw error('permission-denied', '교직원만 예약을 확정할 수 있습니다.');
        const initialCallerProfile = await db.collection('users').doc(caller.profileDocId).get();
        if (!initialCallerProfile.exists || !STAFF_ROLES.has(initialCallerProfile.data().role)
            || initialCallerProfile.data().active === false) {
            throw error('permission-denied', '예약 관리 권한을 확인할 수 없습니다.');
        }
        const results = [];
        // Independent bounded commits; Firestore owns transaction retries.
        for (const item of data.reservations) {
            try { results.push({ ...item, ...await confirmOne(item, callerUid, caller, resolveIdentity) }); }
            catch (cause) { results.push({ ...item, status: 'failed', error: safeFailure(cause) }); }
        }
        return { results, summary: { requested: results.length,
            confirmed: results.filter((item) => item.status === 'confirmed').length,
            alreadyConfirmed: results.filter((item) => item.status === 'already_confirmed').length,
            failed: results.filter((item) => item.status === 'failed').length } };
    };
    return { confirmReservations };
};

module.exports = { createClinicConfirmationService, confirmationEventKey, SCHEMA_VERSION, OUTBOX_STATES };
