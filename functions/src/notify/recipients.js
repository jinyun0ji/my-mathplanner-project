const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();

const getRecipientsForStudent = async (studentId) => {
    if (!studentId) {
        return null;
    }

    const studentRef = db.collection('students').doc(String(studentId));
    const snapshot = await studentRef.get();

    if (!snapshot.exists) {
        return null;
    }

    const data = snapshot.data() || {};
    const parentUids = Array.isArray(data.parentUids) ? data.parentUids.filter(Boolean) : [];
    const studentUid = data.uid || studentId;

    return {
        studentUid,
        parentUids,
    };
};

module.exports = {
    getRecipientsForStudent,
};