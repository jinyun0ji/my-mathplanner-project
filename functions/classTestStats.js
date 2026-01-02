const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

const chunkArray = (items, size = 10) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

const isCorrectAnswer = (value) => value === true || value === 1 || value === '맞음' || value === '고침';

const getPerQuestionScore = (test, index) => {
    if (Array.isArray(test?.questionScores) && test.questionScores.length > index) {
        const value = Number(test.questionScores[index]);
        if (Number.isFinite(value)) return value;
    }

    if (Number.isFinite(test?.maxScore) && Number.isFinite(test?.totalQuestions) && test.totalQuestions > 0) {
        return Number(test.maxScore) / Number(test.totalQuestions);
    }

    return 1;
};

const getTotalScore = (grade = {}, test = {}) => {
    if (!grade) return null;

    const storedScore = grade.totalScore ?? grade.score;
    if (Number.isFinite(Number(storedScore))) {
        return Number(storedScore);
    }

    const answerMap = grade.answers || grade.correctCount;
    if (answerMap && typeof answerMap === 'object' && !Array.isArray(answerMap)) {
        const entries = Object.entries(answerMap);
        if (entries.length === 0) return null;

        return entries.reduce((sum, [questionNumber, value]) => {
            if (!isCorrectAnswer(value)) return sum;
            const index = Number(questionNumber) - 1;
            return sum + getPerQuestionScore(test, Number.isFinite(index) ? index : 0);
        }, 0);
    }

    if (Array.isArray(grade.questionResults) && grade.questionResults.length > 0) {
        return grade.questionResults.reduce((sum, result) => {
            const value = Number(result?.score);
            return Number.isFinite(value) ? sum + value : sum;
        }, 0);
    }

    if (grade.scores && typeof grade.scores === 'object' && !Array.isArray(grade.scores)) {
        const scoreValues = Object.values(grade.scores).map(Number).filter(Number.isFinite);
        if (scoreValues.length > 0) {
            return scoreValues.reduce((sum, value) => sum + value, 0);
        }
    }

    return null;
};

const collectGradesForField = async ({ testId, studentIds, field }) => {
    const docs = [];
    const chunks = chunkArray(studentIds, 10);

    for (const chunk of chunks) {
        const snap = await db
            .collection('grades')
            .where('testId', '==', testId)
            .where(field, 'in', chunk)
            .get();

        snap.docs.forEach((docSnap) => {
            docs.push({ id: docSnap.id, ...docSnap.data() });
        });
    }

    return docs;
};

const onGradeWriteUpdateClassTestStats = functions.firestore
    .document('grades/{gradeDocId}')
    .onWrite(async (change) => {
        const gradeData = change.after.exists ? change.after.data() : change.before.data();
        if (!gradeData?.testId) {
            return null;
        }

        const testId = gradeData.testId;
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

        const classStudents = Array.isArray(classSnap.data()?.students)
            ? classSnap.data().students.filter(Boolean)
            : [];

        if (classStudents.length === 0) {
            return null;
        }

        const gradeMap = new Map();

        const byStudentId = await collectGradesForField({ testId, studentIds: classStudents, field: 'studentDocId' });
        byStudentId.forEach((g) => gradeMap.set(g.id, g));

        const byAuthUid = await collectGradesForField({ testId, studentIds: classStudents, field: 'authUid' });
        byAuthUid.forEach((g) => gradeMap.set(g.id, g));

        const byStudentUid = await collectGradesForField({ testId, studentIds: classStudents, field: 'studentUid' });
        byStudentUid.forEach((g) => gradeMap.set(g.id, g));

        const grades = Array.from(gradeMap.values());
        const totalQuestions = Number(test?.totalQuestions) || (Array.isArray(test?.questionScores) ? test.questionScores.length : 0);

        const correctCounts = {};
        const scores = [];

        grades.forEach((g) => {
            const score = getTotalScore(g, test);
            if (!Number.isFinite(score)) return;
            scores.push(score);

            if (totalQuestions > 0) {
                const answerMap = g.answers || g.correctCount;
                for (let i = 1; i <= totalQuestions; i++) {
                    const status = answerMap?.[i.toString()];
                    if (isCorrectAnswer(status)) {
                        correctCounts[i] = (correctCounts[i] || 0) + 1;
                    }
                }
            }
        });

        const count = scores.length;
        const average = count > 0 ? scores.reduce((sum, s) => sum + s, 0) / count : null;
        const maxScore = count > 0 ? Math.max(...scores) : null;
        const minScore = count > 0 ? Math.min(...scores) : null;
        const variance = count > 0 && Number.isFinite(average)
            ? scores.reduce((sum, s) => sum + Math.pow(s - average, 2), 0) / count
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
        await db.collection('classTestStats').doc(docId).set({
            classId,
            testId,
            count,
            average,
            maxScore,
            minScore,
            stdDev,
            correctRates,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        return null;
    });

module.exports = {
    onGradeWriteUpdateClassTestStats,
};