const functions = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');
const { assertAdmin } = require('../_utils/assertAdmin');

const getStaffList = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);

    const db = getFirestore();
    const snapshot = await db.collection('users').where('role', 'in', ['admin', 'staff']).get();

    return snapshot.docs.map((doc) => {
        const payload = doc.data() || {};

        return {
            uid: doc.id,
            email: payload.email ?? null,
            displayName: payload.displayName ?? null,
            role: payload.role ?? null,
            active: payload.active ?? null,
            createdAt: payload.createdAt ?? null,
        };
    });
});

module.exports = { getStaffList };