const functions = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ROLE, isStaffGroupRole } = require('../_utils/roles');

const createClinicReservation = functions.https.onCall(async (data, context) => {
    if (!context?.auth?.uid) {
        throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const db = getFirestore();
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    const role = userDoc.exists ? userDoc.data()?.role : null;
    if (!isStaffGroupRole(role) && role !== ROLE.TEACHER) {
        throw new functions.https.HttpsError('permission-denied', '직원/조교만 예약을 생성할 수 있습니다.');
    }

    const classId = String(data?.classId || '').trim();
    const date = String(data?.date || '').trim();
    const timeSlot = String(data?.timeSlot || data?.plannedTime || '').trim();
    const studentId = String(data?.studentId || '').trim();

    if (!classId || !date || !timeSlot || !studentId) {
        throw new functions.https.HttpsError('invalid-argument', '필수 값 누락');
    }

    const col = db.collection('clinicLogs');

    let reservationId = '';
    await db.runTransaction(async (tx) => {
        const dupQ = await tx.get(
            col
                .where('studentId', '==', studentId)
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
            ...data,
            classId,
            studentId,
            date,
            plannedTime: timeSlot,
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            createdBy: context.auth.uid,
            updatedBy: context.auth.uid,
        });
    });

    return { ok: true, id: reservationId };
});

module.exports = { createClinicReservation };