const functions = require('firebase-functions');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { assertAdmin } = require('../_utils/assertAdmin');

const adminCreateStaffUser = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);

    const email = typeof data?.email === 'string' ? data.email.trim() : '';
    const tempPassword = typeof data?.tempPassword === 'string' ? data.tempPassword : '';

    if (!email || !tempPassword) {
        throw new functions.https.HttpsError('invalid-argument', 'Email and tempPassword are required.');
    }

    const auth = getAuth();
    const db = getFirestore();

    const userRecord = await auth.createUser({ email, password: tempPassword, emailVerified: false });

    await db.collection('users').doc(userRecord.uid).set({ role: 'staff' }, { merge: true });

    return { uid: userRecord.uid, email: userRecord.email, role: 'staff' };
});

module.exports = { adminCreateStaffUser };