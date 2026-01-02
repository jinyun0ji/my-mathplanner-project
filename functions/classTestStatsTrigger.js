const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

const chunkArray = (items = [], size = 10) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

const isCorrectAnswer = (value) => value === true || value === 1 || value === '맞음' || value === '고침';

const getPerQuestionScore = (test = {}, index = 0) => {
    if (Array.isArray(test.questionScores) && test.questionScores.length > index) {
        const value = Number(test.questionScores[index]);
        if (Number.isFinite(value)) return value;
    }

    const maxScore = Number(test.maxScore);
    const totalQuestions = Number(test.totalQuestions);
    if (Number.isFinite(maxScore) && Number.isFinite(totalQuestions) && totalQuestions > 0) {
        return maxScore / totalQuestions;
    }

    return 1;
};

const getScore = (grade = {}, test = {}) => {
    const totalScore = Number(grade?.totalScore ?? grade?.score);
    if (Number.isFinite(totalScore)) {
        return totalScore;
    }

    const answers = grade?.answers;
    const correctCount = grade?.correctCount;

    const answerMap =
        answers && typeof answers === 'object' && !Array.isArray(answers) && Object.keys(answers).length > 0
            ? answers
            : null;
    const correctCountMap =
        correctCount && typeof correctCount === 'object' && !Array.isArray(correctCount) && Object.keys(correctCount).length > 0
            ? correctCount
            : null;

    const scoringMap = answerMap || correctCountMap;

    if (scoringMap) {
        return Object.entries(scoringMap).reduce((sum, [questionNumber, value]) => {
            if (!isCorrectAnswer(value)) return sum;
            const index = Number(questionNumber) - 1;
            return sum + getPerQuestionScore(test, Number.isFinite(index) && index >= 0 ? index : 0);
        }, 0);
    }

    if (Number.isFinite(Number(correctCount))) {
        const defaultScore = getPerQuestionScore(test, 0);
        return Number(correctCount) * defaultScore;
    }

    return null;
};

const collectGradesForField = async ({ testId, studentIds, field }) => {
    const grades = [];

    for (const chunk of chunkArray(studentIds, 10)) {
        if (chunk.length === 0) continue;

        const snap = await db
            .collection('grades')
            .where('testId', '==', testId)
            .where(field, 'in', chunk)
            .get();

        snap.docs.forEach((docSnap) => {
            grades.push({ id: docSnap.id, ...docSnap.data() });
        });
    }

    return grades;
};

const onGradesWriteUpdateClassTestStats = functions.firestore
    .document('grades/{gradeId}')
    .onWrite(async (change) => {
        const afterData = change.after.exists ? change.after.data() : null;
        const beforeData = change.before.exists ? change.before.data() : null;
        const testId = afterData?.testId || beforeData?.testId;

        if (!testId) {
            return null;
        }

        const testSnap = await db.collection('tests').doc(testId).get();
        if (!testSnap.exists) {
            return null;
        }

        const test = { id: testSnap.id, ...testSnap.data() };
        const classId = test.classId;

        if (!classId) {
            return null;
        }

        const classSnap = await db.collection('classes').doc(classId).get();
        if (!classSnap.exists) {
            return null;
        }

        const students = Array.isArray(classSnap.data()?.students)
            ? classSnap.data().students.filter(Boolean)
            : [];

        if (students.length === 0) {
            return null;
        }

        const gradeMap = new Map();

        const byAuthUid = await collectGradesForField({ testId, studentIds: students, field: 'authUid' });
        byAuthUid.forEach((grade) => gradeMap.set(grade.id, grade));

        const byStudentDocId = await collectGradesForField({ testId, studentIds: students, field: 'studentDocId' });
        byStudentDocId.forEach((grade) => gradeMap.set(grade.id, grade));

        const grades = Array.from(gradeMap.values());

        const totalQuestions =
            Number(test?.totalQuestions) || (Array.isArray(test?.questionScores) ? test.questionScores.length : 0);

        const scores = [];
        const correctCounts = {};

        grades.forEach((grade) => {
            const answers = grade?.answers;
            const correctCount = grade?.correctCount;
            const hasAttempted =
                (answers && typeof answers === 'object' && Object.keys(answers).length > 0) ||
                (correctCount &&
                    ((typeof correctCount === 'object' && Object.keys(correctCount).length > 0) ||
                        Number.isFinite(Number(correctCount))));

            if (!hasAttempted) return;

            const score = getScore(grade, test);
            if (!Number.isFinite(score)) return;

            scores.push(score);

            if (totalQuestions > 0) {
                const answerMap =
                    answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : undefined;
                const correctCountMap =
                    correctCount && typeof correctCount === 'object' && !Array.isArray(correctCount)
                        ? correctCount
                        : undefined;

                const mapForCorrectRates = answerMap || correctCountMap;

                if (mapForCorrectRates) {
                    for (let i = 1; i <= totalQuestions; i++) {
                        const status = mapForCorrectRates?.[i.toString()];
                        if (isCorrectAnswer(status)) {
                            correctCounts[i] = (correctCounts[i] || 0) + 1;
                        }
                    }
                }
            }
        });

        const count = scores.length;
        const average = count > 0 ? scores.reduce((sum, value) => sum + value, 0) / count : null;
        const maxScore = count > 0 ? Math.max(...scores) : null;
        const minScore = count > 0 ? Math.min(...scores) : null;
        const variance = count > 0 && Number.isFinite(average)
            ? scores.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / count
            : null;
        const stdDev = variance !== null ? Math.sqrt(variance) : null;

        const correctRates = {};
        if (totalQuestions > 0 && count > 0) {
            for (let i = 1; i <= totalQuestions; i++) {
                const correct = correctCounts[i] || 0;
                correctRates[i] = correct / count;
            }
        }

        const docId = `${classId}_${testId}`;

        await db
            .collection('classTestStats')
            .doc(docId)
            .set(
                {
                    classId,
                    testId,
                    count,
                    average,
                    maxScore,
                    minScore,
                    stdDev,
                    correctRates,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true },
            );

        return null;
    });

module.exports = { onGradesWriteUpdateClassTestStats };