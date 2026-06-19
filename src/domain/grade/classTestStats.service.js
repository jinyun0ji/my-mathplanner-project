import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    where,
} from 'firebase/firestore';
import { toFiniteScoreNumber } from '../../utils/scoreDisplay';

export const resolveClassTestStats = (test = {}, statsMap = {}) => (
    statsMap?.[`${test?.classId}_${test?.id}`]
    || statsMap?.[test?.id]
    || null
);

const getNumericGradeScore = (grade = {}) => {
    for (const value of [grade.score, grade.totalScore, grade.result]) {
        const score = toFiniteScoreNumber(value);
        if (score !== null) return score;
    }
    return null;
};

export const recomputeClassTestStats = async (db, testId, classId = '') => {
    if (!testId) return null;

    let resolvedClassId = classId;
    if (!resolvedClassId) {
        const testSnapshot = await getDoc(doc(db, 'tests', testId));
        resolvedClassId = testSnapshot.exists() ? testSnapshot.data()?.classId : '';
    }
    if (!resolvedClassId) throw new Error(`classId not found for test ${testId}`);

    const gradesSnapshot = await getDocs(query(
        collection(db, 'grades'),
        where('testId', '==', testId),
    ));
    const grades = gradesSnapshot.docs.map((snapshot) => snapshot.data());
    const scores = grades
        .filter((grade) => grade?.attempted === true)
        .map(getNumericGradeScore)
        .filter((score) => score !== null);
    const submittedCount = scores.length;
    const stats = {
        classId: resolvedClassId,
        testId,
        average: submittedCount ? scores.reduce((sum, score) => sum + score, 0) / submittedCount : null,
        maxScore: submittedCount ? Math.max(...scores) : null,
        submittedCount,
        absentCount: grades.length - submittedCount,
        totalCount: grades.length,
        updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'classTestStats', `${resolvedClassId}_${testId}`), stats, { merge: true });
    if (process.env.NODE_ENV !== 'production') {
        console.log('[classTestStats] recomputed', { ...stats, updatedAt: undefined });
    }
    return stats;
};
