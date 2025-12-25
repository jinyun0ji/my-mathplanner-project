const functions = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');
const { assertAdmin } = require('../_utils/assertAdmin');
const { ROLE } = require('../_utils/roles');

const updateStaffRole = functions.https.onCall(async (data, context) => {
    const { uid: requesterUid } = await assertAdmin(context);

    const targetUid = typeof data?.targetUid === 'string' ? data.targetUid.trim() : '';
    const newRole = typeof data?.newRole === 'string' ? data.newRole.trim() : '';

    if (!targetUid || !newRole) {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid and newRole are required.');
    }

    if (![ROLE.ADMIN, ROLE.STAFF].includes(newRole)) {
        throw new functions.https.HttpsError('invalid-argument', 'newRole must be admin or staff.');
    }

    if (targetUid === requesterUid) {
        throw new functions.https.HttpsError('failed-precondition', 'Cannot change your own role.');
    }

    const db = getFirestore();
    await db.collection('users').doc(targetUid).set(
        {
            role: newRole,
        },
        { merge: true },
    );

    return { uid: targetUid, role: newRole };
});

module.exports = { updateStaffRole };