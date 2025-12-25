const { getFirestore } = require('firebase-admin/firestore');
const { ROLE } = require('../_utils/roles');

const db = getFirestore();

const getRecipientsForStudent = async (authUid) => {
    if (!authUid) {
        return null;
    }

    const studentRef = db.collection('users').doc(String(authUid));
    const snapshot = await studentRef.get();

    if (!snapshot.exists) {
        return null;
    }

    const data = snapshot.data() || {};
    const parentQuery = await db.collection('users')
        .where('role', '==', ROLE.PARENT)
        .where('studentIds', 'array-contains', String(authUid))
        .get();
    const parentUids = parentQuery.docs.map((doc) => doc.id).filter(Boolean);
    const studentUid = data.authUid || data.uid || authUid;

    return {
        studentUid,
        parentUids,
    };
};

module.exports = {
    getRecipientsForStudent,
};