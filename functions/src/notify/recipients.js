const { getFirestore } = require('firebase-admin/firestore');
const { ROLE } = require('../_utils/roles');
const { createUserIdentityResolver, identityFromProfile } = require('../identity/resolveUserIdentity');

const db = getFirestore();

const createStudentRecipientResolver = ({ database = db, resolveIdentity = createUserIdentityResolver({ db: database }) } = {}) => async (studentKey) => {
    if (!studentKey) {
        return null;
    }

    const student = await resolveIdentity(studentKey);
    if (!student || student.role !== ROLE.STUDENT || !student.studentDocId) {
        return null;
    }

    const parentQuery = await database.collection('users')
        .where('role', '==', ROLE.PARENT)
        .where('studentIds', 'array-contains', student.studentDocId)
        .get();
    const parentUids = parentQuery.docs
        .map((doc) => identityFromProfile(doc, { matchedKey: doc.id })?.authUid)
        .filter(Boolean);
    const uniqueAuthUids = [...new Set([student.authUid, ...parentUids])];

    return {
        studentUid: student.authUid,
        parentUids: uniqueAuthUids.filter((uid) => uid !== student.authUid),
        studentIdentity: student,
    };
};

const getRecipientsForStudent = createStudentRecipientResolver();

module.exports = {
    getRecipientsForStudent,
    createStudentRecipientResolver,
};
