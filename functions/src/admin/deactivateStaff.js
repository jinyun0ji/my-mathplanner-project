const functions = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { assertAdmin } = require('../_utils/assertAdmin');

const deactivateStaff = functions.https.onCall(async (data, context) => {
    const { uid: adminUid } = await assertAdmin(context);

    const uid = typeof data?.uid === 'string' ? data.uid.trim() : '';

    if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'uid is required.');
    }

    if (uid === adminUid) {
        throw new functions.https.HttpsError('failed-precondition', 'You cannot deactivate your own account.');
    }

    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);
    const snapshot = await userRef.get();

    if (!snapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'User not found.');
    }

    await userRef.set(
        {
            active: false,
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
    );

    return { uid, active: false };
});

module.exports = { deactivateStaff };