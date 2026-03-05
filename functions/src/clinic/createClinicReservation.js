const functions = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ROLE, isStaffGroupRole } = require('../_utils/roles');
const {
    requireString,
    assertRequired,
    normalizeStudentDocId,
    normalizeClassId,
} = require('../_utils/ids');

const createClinicReservation = functions
    .region('us-central1')
    .https.onCall(async (data, context) => {
    if (!context?.auth?.uid) {
        throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const db = getFirestore();
    const authUid = context.auth.uid;

    const resolveCallerRole = async () => {
        // 1) B안: userAuthIndex/{authUid} -> users/{userDocId}
        try {
            const idxSnap = await db.collection('userAuthIndex').doc(authUid).get();
            const userDocId = idxSnap.exists ? String(idxSnap.data()?.userDocId || '').trim() : '';
            if (userDocId) {
                const uSnap = await db.collection('users').doc(userDocId).get();
                if (uSnap.exists) return uSnap.data()?.role || null;
            }
        } catch (e) {
            console.warn('[createClinicReservation] userAuthIndex lookup failed', e);
        }

        // 2) 레거시: users/{authUid}
        try {
            const uSnap = await db.collection('users').doc(authUid).get();
            if (uSnap.exists) return uSnap.data()?.role || null;
        } catch (e) {
            console.warn('[createClinicReservation] users/{uid} lookup failed', e);
        }

        // 3) 최후: users where authUid == uid
        try {
            const qSnap = await db.collection('users').where('authUid', '==', authUid).limit(1).get();
            if (!qSnap.empty) return qSnap.docs[0].data()?.role || null;
        } catch (e) {
            console.warn('[createClinicReservation] users query authUid lookup failed', e);
        }

        return null;
    };

    const role = await resolveCallerRole();
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

    let resolvedStudentAuthUid = data?.authUid ? String(data.authUid).trim() : '';
    if (!resolvedStudentAuthUid) {
        try {
            const studentSnap = await db.collection('users').doc(studentDocId).get();
            if (studentSnap.exists) {
                resolvedStudentAuthUid = String(studentSnap.data()?.authUid || '').trim();
            }
        } catch (e) {
            console.warn('[createClinicReservation] users/{studentDocId} authUid lookup failed', {
                studentDocId,
                message: e?.message || e,
            });
        }
    }

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
            authUid: resolvedStudentAuthUid || null,
            authUid: data?.authUid ? String(data.authUid).trim() : null,
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

module.exports = { createClinicReservation };