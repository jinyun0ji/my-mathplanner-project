const functions = require('firebase-functions');
const admin = require('firebase-admin');

const getNumericScore = (grade = {}) => {
    for (const value of [grade.score, grade.totalScore, grade.result]) {
        if (value === null || value === undefined || value === '') continue;
        const score = Number(value);
        if (Number.isFinite(score)) return score;
    }
    return null;
};

const calculateClassTestStats = (grades = []) => {
    const scores = grades
        .filter((grade) => grade?.attempted === true)
        .map(getNumericScore)
        .filter((score) => score !== null);
    const submittedCount = scores.length;
    return {
        average: submittedCount ? scores.reduce((sum, score) => sum + score, 0) / submittedCount : null,
        maxScore: submittedCount ? Math.max(...scores) : null,
        submittedCount,
        absentCount: grades.length - submittedCount,
        totalCount: grades.length,
    };
};

const recomputeClassTestStats = async ({ db, testId, classId = '' }) => {
    if (!testId) return null;
    let resolvedClassId = classId;
    if (!resolvedClassId) {
        const testSnapshot = await db.collection('tests').doc(testId).get();
        resolvedClassId = testSnapshot.exists ? testSnapshot.data()?.classId : '';
    }
    if (!resolvedClassId) throw new Error(`classId not found for test ${testId}`);

    const gradesSnapshot = await db.collection('grades').where('testId', '==', testId).get();
    const stats = calculateClassTestStats(gradesSnapshot.docs.map((snapshot) => snapshot.data()));
    const payload = {
        classId: resolvedClassId,
        testId,
        ...stats,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection('classTestStats').doc(`${resolvedClassId}_${testId}`).set(payload, { merge: true });
    return payload;
};

const onGradeWriteUpdateClassTestStats = functions.firestore
    .document('grades/{gradeDocId}')
    .onWrite(async (change) => {
        const grade = change.after.exists ? change.after.data() : change.before.data();
        if (!grade?.testId) return null;
        try {
            const stats = await recomputeClassTestStats({
                db: admin.firestore(),
                testId: grade.testId,
                classId: grade.classId,
            });
            if (process.env.NODE_ENV !== 'production') {
                console.log('[classTestStats] recomputed', {
                    testId: grade.testId,
                    classId: stats?.classId,
                    submittedCount: stats?.submittedCount,
                });
            }
        } catch (error) {
            console.warn('[classTestStats] recompute failed', { testId: grade.testId, error });
        }
        return null;
    });

module.exports = {
    calculateClassTestStats,
    recomputeClassTestStats,
    onGradeWriteUpdateClassTestStats,
};
