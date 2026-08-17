const functions = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ROLE, isStaffGroupRole } = require('../_utils/roles');
const {
    requireString,
    assertRequired,
    normalizeStudentDocId,
    normalizeClassId,
} = require('../_utils/ids');
const { createUserIdentityResolver } = require('../identity/resolveUserIdentity');

const buildReservationIdentity = ({ resolvedStudentAuthUid, requestAuthUid }) => ({
    authUid: String(resolvedStudentAuthUid || requestAuthUid || '').trim() || null,
});

const createClinicReservation = functions
    .region('us-central1')
    .https.onCall(async (data, context) => {
    if (!context?.auth?.uid) {
        throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const db = getFirestore();
    const authUid = context.auth.uid;
    const resolveIdentity = createUserIdentityResolver({ db });

    const role = (await resolveIdentity(authUid))?.role || null;
    if (!isStaffGroupRole(role) && role !== ROLE.TEACHER) {
        throw new functions.https.HttpsError('permission-denied', '직원/조교만 예약을 생성할 수 있습니다.');
    }

    const studentDocId = normalizeStudentDocId(data);
    const classId = normalizeClassId(data);
    const date = requireString(data, 'date');
    const timeSlot = requireString(data, 'timeSlot') || requireString(data, 'plannedTime');

    const missing = [];
    if (!studentDocId) missing.push('studentDocId');
    if (!classId) missing.push('classId');
    if (!date) missing.push('date');
    if (!timeSlot) missing.push('timeSlot');

    assertRequired(missing);

    const studentIdentity = await resolveIdentity(studentDocId);
    const resolvedStudentAuthUid = studentIdentity?.role === ROLE.STUDENT ? studentIdentity.authUid : '';
    const requestIdentity = !resolvedStudentAuthUid && data?.authUid
        ? await resolveIdentity(data.authUid)
        : null;
    const requestAuthUid = requestIdentity?.role === ROLE.STUDENT
        && requestIdentity.studentDocId === studentDocId
        ? requestIdentity.authUid
        : '';

    const col = db.collection('clinicReservations');

    let reservationId = '';
    await db.runTransaction(async (tx) => {
        const dupQ = await tx.get(
            col
                .where('studentDocId', '==', studentDocId)
                .where('date', '==', date)
                .where('status', 'in', ['reserved', 'booked', 'pending'])
                .limit(1)
        );

        if (!dupQ.empty) {
            throw new functions.https.HttpsError('already-exists', '이미 해당 날짜에 예약이 있습니다.');
        }

        const ref = col.doc();
        reservationId = ref.id;
        tx.set(ref, {
            studentDocId,
            ...buildReservationIdentity({ resolvedStudentAuthUid, requestAuthUid }),
            studentUid: data?.studentUid ? String(data.studentUid).trim() : null,
            classId,
            date,
            plannedTime: timeSlot,
            status: 'pending',
            legacyPayload: data,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            createdBy: context.auth.uid,
            updatedBy: context.auth.uid,
        });
    });

    return { ok: true, id: reservationId };
});

module.exports = { buildReservationIdentity, createClinicReservation };
