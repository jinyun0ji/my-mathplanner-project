const functions = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { assertStaff } = require('../_utils/assertStaff');

const generateCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const adminCreateLinkCode = functions.https.onCall(async (data, context) => {
    const { uid } = await assertStaff(context);

    const rawStudentId = typeof data?.studentId === 'string' ? data.studentId.trim() : '';
    const studentId = rawStudentId && !Number.isNaN(Number(rawStudentId)) ? Number(rawStudentId) : rawStudentId;
    if (!studentId && studentId !== 0) {
        throw new functions.https.HttpsError('invalid-argument', '학생 ID가 필요합니다.');
    }

    const db = getFirestore();
    const codes = db.collection('linkCodes');

    let issuedCode = '';
    await db.runTransaction(async (tx) => {
        let attempts = 0;
        while (true) {
            attempts += 1;
            if (attempts > 10) {
                throw new functions.https.HttpsError('internal', '코드 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
            }

            const candidate = generateCode();
            const ref = codes.doc(candidate);
            const snap = await tx.get(ref);
            if (snap.exists) continue;

            tx.set(ref, {
                studentId,
                createdBy: uid,
                createdAt: FieldValue.serverTimestamp(),
                claimedBy: null,
                claimedAt: null,
            });
            issuedCode = candidate;
            break;
        }
    });

    return { code: issuedCode, studentId };
});

module.exports = { adminCreateLinkCode };