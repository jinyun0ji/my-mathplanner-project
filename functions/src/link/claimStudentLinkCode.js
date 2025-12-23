const functions = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const claimStudentLinkCode = functions.https.onCall(async (data, context) => {
    if (!context?.auth?.uid) {
        throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const code = typeof data?.code === 'string' ? data.code.trim().toUpperCase() : '';
    if (!code) {
        throw new functions.https.HttpsError('invalid-argument', '연결 코드를 입력해주세요.');
    }

    const db = getFirestore();
    const userRef = db.collection('users').doc(context.auth.uid);
    const codeRef = db.collection('linkCodes').doc(code);

    await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        const userRole = userSnap.exists ? userSnap.data()?.role : null;
        if (userRole && userRole !== 'pending' && userRole !== 'parent') {
            throw new functions.https.HttpsError('permission-denied', '학부모만 학생을 연결할 수 있습니다.');
        }

        const linkSnap = await tx.get(codeRef);
        if (!linkSnap.exists) {
            throw new functions.https.HttpsError('not-found', '유효하지 않은 연결 코드입니다.');
        }

        const linkData = linkSnap.data();
        if (linkData.claimedBy) {
            throw new functions.https.HttpsError('already-exists', '이미 사용된 코드입니다.');
        }

        const rawStudentId = typeof linkData.studentId === 'string' ? linkData.studentId.trim() : linkData.studentId;
        const studentId = rawStudentId !== undefined && rawStudentId !== null && !Number.isNaN(Number(rawStudentId))
            ? Number(rawStudentId)
            : rawStudentId;
        if (!studentId && studentId !== 0) {
            throw new functions.https.HttpsError('failed-precondition', '학생 정보가 없는 코드입니다.');
        }

        tx.update(codeRef, { claimedBy: context.auth.uid, claimedAt: FieldValue.serverTimestamp() });
        tx.set(
            userRef,
            { role: 'parent', studentIds: FieldValue.arrayUnion(studentId) },
            { merge: true },
        );
    });

    return { success: true };
});

module.exports = { claimStudentLinkCode };