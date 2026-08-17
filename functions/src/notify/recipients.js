const { getFirestore } = require('firebase-admin/firestore');
const { ROLE } = require('../_utils/roles');
const { createUserIdentityResolver } = require('../identity/resolveUserIdentity');

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
    const parentIdentities = await Promise.all(parentQuery.docs.map((doc) => resolveIdentity(doc.id)));
    parentIdentities.forEach((identity, index) => {
        if (!identity) {
            console.warn('[notifications] parent recipient excluded: canonical Auth UID unresolved', {
                parentProfileDocId: parentQuery.docs[index].id,
                studentProfileDocId: student.studentDocId,
            });
        }
    });
    const parentUids = parentIdentities.map((identity) => identity?.authUid).filter(Boolean);
    const uniqueAuthUids = [...new Set([student.authUid, ...parentUids])];

    return {
        studentUid: student.authUid,
        parentUids: uniqueAuthUids.filter((uid) => uid !== student.authUid),
        studentIdentity: student,
    };
};

// One-shot convenience wrapper. Trigger handlers should inject one resolver per invocation.
const getRecipientsForStudent = (studentKey, options) => createStudentRecipientResolver(options)(studentKey);

module.exports = {
    getRecipientsForStudent,
    createStudentRecipientResolver,
};
