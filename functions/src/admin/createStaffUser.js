const functions = require('firebase-functions');
const crypto = require('crypto');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { assertAdmin } = require('../_utils/assertAdmin');

const createStaffUser = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);

    const email = typeof data?.email === 'string' ? data.email.trim() : '';
    const role = typeof data?.role === 'string' ? data.role.trim() : '';
    const requestedPassword = typeof data?.tempPassword === 'string' ? data.tempPassword : '';
    const tempPassword = requestedPassword || crypto.randomBytes(8).toString('base64').slice(0, 12);

    if (!email || !role) {
        throw new functions.https.HttpsError('invalid-argument', 'Email and role are required.');
    }

    if (!['staff', 'admin'].includes(role)) {
        throw new functions.https.HttpsError('invalid-argument', 'Role must be staff or admin.');
    }

    const auth = getAuth();
    const db = getFirestore();

    const userRecord = await auth.createUser({ email, password: tempPassword, emailVerified: false });

    await db.collection('users').doc(userRecord.uid).set({ role }, { merge: true });

    return { uid: userRecord.uid, email: userRecord.email, role, tempPassword };
});

module.exports = { createStaffUser };