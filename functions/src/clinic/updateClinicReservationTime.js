const functions = require('firebase-functions');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { createUserIdentityResolver } = require('../identity/resolveUserIdentity');
const { SOURCES, studentKey, plannedTime, isPendingReservation, parseKoreanReservationTime,
    studentReservationKeys, checkReservationDate, writeReservationDateLock, error } = require('./reservationPolicy');

const REQUEST_FIELDS = new Set(['sourceCollection', 'reservationId', 'expectedRevision', 'date', 'plannedTime']);
// Match the staff/teacher aliases already allowed by the existing Firestore Rules.
const STAFF_ROLES = new Set(['admin', 'staff', 'teacher', 'teaching', 'staffOrTeaching']);

const createUpdateClinicReservationTime = ({ db, auth, now = () => Timestamp.now(),
    resolveIdentity = createUserIdentityResolver({ db, auth }) }) => async (data, context) => {
    if (!context?.auth?.uid) throw error('unauthenticated', '로그인이 필요합니다.');
    if (!data || typeof data !== 'object' || Array.isArray(data)
        || Object.keys(data).some((key) => !REQUEST_FIELDS.has(key))
        || !SOURCES.includes(data.sourceCollection)
        || typeof data.reservationId !== 'string' || !data.reservationId.trim() || data.reservationId.includes('/')
        || ['.', '..'].includes(data.reservationId) || /^__.*__$/.test(data.reservationId)
        || Buffer.byteLength(data.reservationId, 'utf8') > 1500
        || !Number.isSafeInteger(data.expectedRevision) || data.expectedRevision < 0
        || data.expectedRevision >= Number.MAX_SAFE_INTEGER) {
        throw error('invalid-argument', '원본 컬렉션, 예약 ID, expectedRevision과 변경할 일시를 확인해주세요.');
    }
    const caller = await resolveIdentity(context.auth.uid);
    if (!STAFF_ROLES.has(caller?.role)) throw error('permission-denied', '교직원만 예약 일시를 수정할 수 있습니다.');
    const times = parseKoreanReservationTime(data.date, data.plannedTime);
    if (times.reservationStartsAt.toMillis() <= now().toMillis()) throw error('failed-precondition', '미래의 예약 일시를 입력해주세요.');

    const ref = db.collection(data.sourceCollection).doc(data.reservationId);
    const initial = await ref.get();
    if (!initial.exists) throw error('not-found', '지정한 원본 예약을 찾을 수 없습니다.');
    const originalStudentKey = studentKey(initial.data());
    const student = await studentReservationKeys({ db, resolveIdentity, key: originalStudentKey });
    return db.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists) throw error('not-found', '지정한 원본 예약을 찾을 수 없습니다.');
        const reservation = snapshot.data();
        const revision = reservation.reservationRevision === undefined ? 0 : reservation.reservationRevision;
        if (!Number.isSafeInteger(revision) || revision < 0) throw error('failed-precondition', '예약 버전 값이 유효하지 않습니다.');
        if (revision !== data.expectedRevision || studentKey(reservation) !== originalStudentKey) {
            throw error('aborted', '다른 작업으로 예약이 변경되었습니다. 새로고침 후 다시 시도해주세요.');
        }
        if (!isPendingReservation(reservation)) throw error('failed-precondition', '실제 예약 중인 기록만 수정할 수 있습니다.');
        if (times.reservationStartsAt.toMillis() <= now().toMillis()) throw error('failed-precondition', '예약 시간이 이미 지났습니다.');
        if (reservation.date === data.date && plannedTime(reservation) === data.plannedTime) {
            return { ok: true, changed: false, reservationId: ref.id, sourceCollection: data.sourceCollection, reservationRevision: revision };
        }
        const lock = await checkReservationDate(tx, db, student, data.date, ref.path);
        const at = now();
        const hadConfirmation = ['confirmed', 'reconfirmation_required'].includes(reservation.confirmationStatus)
            || (Number.isSafeInteger(reservation.confirmedRevision) && reservation.confirmedAt instanceof Timestamp);
        const patch = { date: data.date, plannedTime: data.plannedTime, reservationRevision: revision + 1, ...times,
            confirmationStatus: hadConfirmation ? 'reconfirmation_required' : 'unconfirmed',
            // Keep previous confirmation evidence; it no longer matches the new revision.
            confirmedRevision: reservation.confirmedRevision ?? null,
            confirmedAt: reservation.confirmedAt ?? null, confirmedBy: reservation.confirmedBy ?? null,
            updatedAt: at, updatedBy: context.auth.uid };
        for (const alias of ['timeSlot', 'time', 'slot']) {
            if (Object.hasOwn(reservation, alias)) patch[alias] = data.plannedTime;
        }
        tx.update(ref, patch);
        writeReservationDateLock(tx, lock, student, data.date, at);
        return { ok: true, changed: true, reservationId: ref.id, sourceCollection: data.sourceCollection, reservationRevision: revision + 1,
            confirmationStatus: patch.confirmationStatus };
    });
};

const updateClinicReservationTime = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context?.auth?.uid) throw error('unauthenticated', '로그인이 필요합니다.');
    return createUpdateClinicReservationTime({ db: getFirestore() })(data, context);
});

module.exports = { createUpdateClinicReservationTime, updateClinicReservationTime };
