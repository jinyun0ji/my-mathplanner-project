const functions = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');

const assertStaff = async (context) => {
    if (!context?.auth?.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication is required.');
    }

    const db = getFirestore();
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    const role = userDoc.exists ? userDoc.data()?.role : null;

    if (role !== 'staff') {
        throw new functions.https.HttpsError('permission-denied', '직원만 실행할 수 있는 기능입니다.');
    }

    return { uid: context.auth.uid, role };
};

module.exports = { assertStaff };