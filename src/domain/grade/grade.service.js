const isCorrectAnswer = (value) => {
    return value === true || value === 1 || value === '맞음' || value === '고침';
};

const getPerQuestionScore = (test, index) => {
    if (Array.isArray(test?.questionScores) && test.questionScores.length > 0) {
        const value = test.questionScores[index];
        if (Number.isFinite(Number(value))) return Number(value);
    }

    if (Number.isFinite(test?.maxScore) && Number.isFinite(test?.totalQuestions) && test.totalQuestions > 0) {
        return test.maxScore / test.totalQuestions;
    }

    return 1;
};

export const getTotalScore = (grade = {}, test = {}) => {
    if (!grade) return null;

    const answerMap = grade.answers || grade.correctCount;
    if (answerMap && typeof answerMap === 'object' && !Array.isArray(answerMap)) {
        const entries = Object.entries(answerMap);
        // 빈 정오표는 미응시로 간주하여 학생/학부모 화면에서 0점으로 표기되지 않도록 처리
        if (entries.length === 0) {
            // 점수 필드가 명시적으로 null이면 미응시로 판단
            if (grade.score === null || grade.totalScore === null) return null;

            // 그 외 특수 케이스는 기존 0점 처리 유지
            return 0;
        }

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

export const getStudentClassStatus = (student = {}, classId) => {
    if (!classId) return { status: 'active' };
    const key = String(classId);
    const status = student?.classStatuses?.[key];
    if (status && typeof status === 'object') return status;
    return { status: 'active' };
};

const parseTimestampToDate = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') {
        return value.toDate();
    }
    const asDate = new Date(value);
    return Number.isNaN(asDate.getTime()) ? null : asDate;
};

export const isStudentEligibleForTest = (student = {}, test = {}, classId = null) => {
    if (!student || !test) return false;
    const resolvedClassId = classId || test.classId;
    const classStatus = getStudentClassStatus(student, resolvedClassId);
    if (classStatus.status === 'withdrawn') {
        const testDate = test?.date ? new Date(test.date) : null;
        const withdrawnAtDate = parseTimestampToDate(classStatus.withdrawnAt);

        if (withdrawnAtDate && testDate && withdrawnAtDate <= testDate) {
            return false;
        }

        if (!withdrawnAtDate) return false;
    }

    if (classStatus?.withdrawnAt && !test?.date) {
        return false;
    }

    return true;
};

const computeTestStatisticsInternal = (test, students, grades, classAverages, classId = null) => {
    const studentList = Array.isArray(students) ? students : [];
    const gradeMap = grades || {};
    const targetClassId = classId || test?.classId;

    if (!test || studentList.length === 0) {
        return { average: null, maxScore: null, minScore: null, stdDev: null, correctRates: {}, rank: [] };
    }

    const eligibleStudents = studentList.filter((student) => isStudentEligibleForTest(student, test, targetClassId));

    if (eligibleStudents.length === 0) {
        return { average: null, maxScore: null, minScore: null, stdDev: null, correctRates: {}, rank: [] };
    }

    const getStudentScore = (studentId) => getTotalScore(gradeMap[studentId]?.[test.id], test);

    const scores = eligibleStudents.map(s => getStudentScore(s.id)).filter(score => Number.isFinite(score));

    if (scores.length === 0) {
        return { average: null, maxScore: null, minScore: null, stdDev: null, correctRates: {}, rank: [] };
    }

    const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - average, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    const attemptedStudents = eligibleStudents.filter(s => Number.isFinite(getStudentScore(s.id)));
    const attemptedScores = attemptedStudents.map(s => ({
        score: getStudentScore(s.id),
        name: s.name,
        studentId: s.id,
    }));

    const rankedScores = attemptedScores.sort((a, b) => b.score - a.score);

    let currentRank = 1;
    let rank = rankedScores.map((item, index) => {
        if (index > 0 && item.score < rankedScores[index - 1].score) {
            currentRank = index + 1;
        }
        return { score: item.score, studentId: item.studentId, rank: currentRank };
    });

    const correctRates = {};
    const totalAttempted = attemptedStudents.length;

    const totalQuestions = Number(test?.totalQuestions) || 0;

    if (totalQuestions > 0 && totalAttempted > 0) {
        for (let i = 1; i <= totalQuestions; i++) {
            let correctCount = 0;
            attemptedStudents.forEach(student => {
                const grade = gradeMap[student.id]?.[test.id] || {};
                const answerMap = grade.answers || grade.correctCount;
                const status = answerMap?.[i.toString()];
                if (isCorrectAnswer(status)) {
                    correctCount++;
                }
            });
            correctRates[i] = correctCount / totalAttempted;
        }
    }

    return { average, maxScore, minScore, stdDev, correctRates, rank };
};

export const getClassStudents = (students = [], selectedClass) => {
    if (!selectedClass) return [];

    const classId = String(selectedClass.id);

    return students
        .filter((student) => {
            const classIds = Array.isArray(student.classIds)
                ? student.classIds
                : (student.classes || []);
            return classIds.map(String).includes(classId);
        })
        .sort((a, b) => a.name.localeCompare(b.name));
};

export const getClassTests = (tests = [], classId) => {
    if (!classId) return [];

    return tests
        .filter(t => t.classId === classId)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
};

export const getClassAverages = (classTests = [], classStudents = [], grades = {}) => {
    const averages = {};
    classTests.forEach(test => {
        let totalScore = 0;
        let count = 0;
        classStudents.forEach(student => {
            if (!isStudentEligibleForTest(student, test, test.classId)) return;
            const score = getTotalScore(grades[student.id]?.[test.id], test);
            if (Number.isFinite(score)) {
                totalScore += score;
                count++;
            }
        });
        averages[test.id] = count > 0 ? (totalScore / count) : null;
    });
    return averages;
};

export const getTestStatistics = (classTests = [], classStudents = [], grades = {}, classAverages = {}) => {
    const stats = {};
    classTests.forEach(test => {
        stats[test.id] = computeTestStatisticsInternal(test, classStudents, grades, classAverages, test?.classId);
    });
    return stats;
};

export const computeTestStatistics = computeTestStatisticsInternal;