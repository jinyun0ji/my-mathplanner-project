const functions = require('firebase-functions');
const crypto = require('crypto');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { assertAdmin } = require('../_utils/assertAdmin');
const { ROLE } = require('../_utils/roles');

const createStaffUser = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);

    const email = typeof data?.email === 'string' ? data.email.trim() : '';
    const role = typeof data?.role === 'string' ? data.role.trim() : '';
    const requestedPassword = typeof data?.tempPassword === 'string' ? data.tempPassword : '';
    const tempPassword = requestedPassword || crypto.randomBytes(8).toString('base64').slice(0, 12);

    if (!email || !role) {
        throw new functions.https.HttpsError('invalid-argument', 'Email and role are required.');
    }

    if (![ROLE.STAFF, ROLE.ADMIN].includes(role)) {
        throw new functions.https.HttpsError('invalid-argument', 'Role must be staff or admin.');
    }

    const auth = getAuth();
    const db = getFirestore();

    let userRecord;
    let createdUser = false;

    try {
        userRecord = await auth.getUserByEmail(email);
    } catch (error) {
        if (error?.code !== 'auth/user-not-found') {
            throw error;
        }
    }

    if (!userRecord) {
        userRecord = await auth.createUser({ email, password: tempPassword, emailVerified: false });
        createdUser = true;
    }

    const userRef = db.collection('users').doc(userRecord.uid);
    const existingSnapshot = createdUser ? null : await userRef.get();
    const shouldInitialize = createdUser || !existingSnapshot?.exists;

    const userPayload = {
        email: userRecord.email ?? email,
        displayName: userRecord.displayName ?? null,
        role,
    };

    if (shouldInitialize) {
        userPayload.active = true;
        userPayload.createdAt = FieldValue.serverTimestamp();
    }

    await userRef.set(userPayload, { merge: true });

    return { uid: userRecord.uid, email: userRecord.email, role, tempPassword };
});

module.exports = { createStaffUser };