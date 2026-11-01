const functions = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();

const toFiniteScore = (value) => {
    if (value === null || value === undefined || value === '' || value === '미응시' || value === '미입력') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const isCorrect = (value) => [true, 1, '1', 'O', 'o', '맞음', '고침', '정답', 'correct'].includes(value);

const getQuestionScores = (test = {}) => {
    const totalQuestions = Number.parseInt(test.totalQuestions, 10) || 0;
    const maxScore = toFiniteScore(test.maxScore) ?? 100;
    if (Array.isArray(test.questionScores) && test.questionScores.length >= totalQuestions) {
        return test.questionScores.map((score) => toFiniteScore(score) ?? 0);
    }
    return totalQuestions > 0 ? Array.from({ length: totalQuestions }, () => maxScore / totalQuestions) : [];
};

const isAbsentGrade = (grade = {}) => (
    grade.attempted === false
    || grade.isAbsent === true
    || grade.absent === true
    || ['미응시', '미입력'].includes(String(grade.result || '').trim())
    || ['미응시', '미입력'].includes(String(grade.status || '').trim())
);

const getGradeScore = (grade = {}, test = {}, questionScores = []) => {
    const savedScore = toFiniteScore(grade.totalScore) ?? toFiniteScore(grade.score) ?? toFiniteScore(grade.result);
    if (savedScore !== null) return savedScore;
    const correctCount = grade.correctCount;
    const totalQuestions = Number.parseInt(test.totalQuestions, 10) || questionScores.length;
    if (!correctCount || typeof correctCount !== 'object' || totalQuestions <= 0) return null;
    let total = 0;
    for (let i = 1; i <= totalQuestions; i += 1) {
        if (isCorrect(correctCount[String(i)])) total += questionScores[i - 1] || 0;
    }
    return Number.isFinite(total) ? total : null;
};

const recomputeTestStats = async (testId) => {
    if (!testId) return null;
    const testSnap = await db.collection('tests').doc(testId).get();
    if (!testSnap.exists) return null;
    const test = testSnap.data() || {};
    const gradesSnap = await db.collection('grades').where('testId', '==', testId).get();
    const questionScores = getQuestionScores(test);
    const scores = gradesSnap.docs
        .map((doc) => doc.data() || {})
        .filter((grade) => !isAbsentGrade(grade))
        .map((grade) => getGradeScore(grade, test, questionScores))
        .filter((score) => score !== null);
    const submittedCount = scores.length;
    const classAverage = submittedCount ? Math.round((scores.reduce((sum, score) => sum + score, 0) / submittedCount) * 10) / 10 : null;
    const highestScore = submittedCount ? Math.round(Math.max(...scores) * 10) / 10 : null;
    const payload = {
        classAverage,
        average: classAverage,
        highestScore,
        classHighestScore: highestScore,
        submittedCount,
        statsUpdatedAt: FieldValue.serverTimestamp(),
    };
    await testSnap.ref.set(payload, { merge: true });
    if (test.classId) {
        await db.collection('classTestStats').doc(`${test.classId}_${testId}`).set({
            classId: test.classId,
            testId,
            average: classAverage,
            maxScore: highestScore,
            highestScore,
            submittedCount,
            attemptedCount: submittedCount,
            count: submittedCount,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    return payload;
};

const onGradeWritten = functions.firestore
    .document('grades/{id}')
    .onWrite(async (change) => {
        const changedData = change.after.exists ? change.after.data() : change.before.data();
        if (changedData?.testId) {
            await recomputeTestStats(changedData.testId);
        }

        return null;
    });

module.exports = {
    onGradeWritten,
};
