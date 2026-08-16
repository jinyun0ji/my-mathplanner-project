import { formatRoundedScore } from '../../utils/numberFormat';
import { formatStudentScore, isAbsentGradeRecord, pickScoreValue, toFiniteScoreNumber } from '../../utils/scoreDisplay';

const firstDisplayValue = (records, keys, fallback = null) => {
    for (const record of records) {
        for (const key of keys) {
            const value = record?.[key];
            if (value !== undefined && value !== null && value !== '') return value;
        }
    }
    return fallback;
};

export const resolveGradeTestId = (grade = {}) => firstDisplayValue(
    [grade],
    ['testId', 'examId', 'assessmentId', 'testDocId'],
    '',
);

export const resolveGradeDisplay = ({ grade = {}, test = {}, classDoc = {} } = {}) => ({
    className: firstDisplayValue([classDoc], ['name', 'className', 'title'], '(클래스 미상)'),
    testDate: firstDisplayValue(
        [{ value: test.date }, { value: test.testDate }, { value: grade.testDate }, { value: grade.date }],
        ['value'],
        null,
    ),
    classAverage: firstDisplayValue(
        [
            { value: grade.classAverage },
            { value: grade.average },
            { value: test.average },
            { value: test.classAverage },
        ],
        ['value'],
        null,
    ),
    highestScore: firstDisplayValue(
        [
            { value: grade.classMax },
            { value: grade.maxScore },
            { value: test.maxScore },
            { value: test.highestScore },
        ],
        ['value'],
        null,
    ),
});

const isCorrectAnswer = (value) => {
    return value === true || value === 1 || value === '맞음' || value === '고침';
};

export const buildCompetitionRanking = (rows = []) => {
    const ordered = [...rows].sort(
        (a, b) => b.score - a.score || String(a.name || a.studentName || '').localeCompare(String(b.name || b.studentName || ''), 'ko'),
    );
    let currentRank = 0;
    return ordered.map((item, index) => {
        if (index === 0 || item.score < ordered[index - 1].score) currentRank = index + 1;
        return { ...item, rank: currentRank };
    });
};

export const isAbsentGrade = (grade) => {
    if (!grade) return true;
    if (isAbsentGradeRecord(grade)) return true;

    const score = toFiniteScoreNumber(pickScoreValue(grade));
    if (score !== null) return false;

    const answerMap = grade.answers || grade.correctCount;
    if (answerMap && typeof answerMap === 'object' && !Array.isArray(answerMap)) {
        return Object.keys(answerMap).length === 0;
    }
    if (Array.isArray(grade.questionResults) && grade.questionResults.length > 0) return false;
    if (grade.scores && typeof grade.scores === 'object' && !Array.isArray(grade.scores)) {
        return Object.keys(grade.scores).length === 0;
    }

    return true;
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

    if (isAbsentGrade(grade)) return null;

    const answerMap = grade.answers || grade.correctCount;
    if (answerMap && typeof answerMap === 'object' && !Array.isArray(answerMap)) {
        const entries = Object.entries(answerMap);
        // 빈 정오표는 미응시로 간주하여 학생/학부모 화면에서 0점으로 표기되지 않도록 처리
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

export const formatGradeScoreText = (grade = null, totalScore = null, test = {}) => {
    const resolvedGrade = grade || null;
    const explicitTotal = toFiniteScoreNumber(totalScore);
    const serviceTotal = resolvedGrade && !isAbsentGrade(resolvedGrade) ? getTotalScore(resolvedGrade, test) : null;
    const pickedScore = resolvedGrade ? toFiniteScoreNumber(pickScoreValue(resolvedGrade)) : null;
    const resolvedTotalScore = explicitTotal !== null
        ? explicitTotal
        : (Number.isFinite(serviceTotal) ? serviceTotal : pickedScore);

    const isNoShow = resolvedTotalScore === null && isAbsentGrade(resolvedGrade);
    const scoreText = isNoShow
        ? '미응시'
        : (resolvedTotalScore !== null ? formatRoundedScore(resolvedTotalScore, 1) : formatStudentScore(resolvedGrade, { includeUnit: false, absentLabel: '-' }));

    return { scoreText, isNoShow, totalScore: resolvedTotalScore };
};

export const getStudentClassStatus = (student = {}, classId) => {
    if (!classId) return { status: '진행중' };
    const key = String(classId);
    const status = student?.classStatusMap?.[key] || student?.classStatuses?.[key];
    if (status && typeof status === 'object') return status;
    return { status: '진행중' };
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
    const normalizedStatus = classStatus?.status === 'withdrawn' ? '퇴원' : classStatus?.status;
    const isWithdrawn = ['퇴원', '전반', '종강'].includes(normalizedStatus);
    if (isWithdrawn) {
        const testDate = parseTimestampToDate(test?.date);
        const endDate = parseTimestampToDate(classStatus.endedAt || classStatus.endDate || classStatus.withdrawnAt);

        if (endDate && testDate && endDate < testDate) {
            return false;
        }

        if (!testDate) {
            return false;
        }
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

    const getStudentScore = (studentId) => {
        const grade = gradeMap[studentId]?.[test.id];
        if (isAbsentGrade(grade)) return null;
        return getTotalScore(grade, test);
    };

    const scores = eligibleStudents
        .map(s => getStudentScore(s.id))
        .filter(score => Number.isFinite(score));

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

    const rank = buildCompetitionRanking(attemptedScores)
        .map(({ score, studentId, rank: position }) => ({ score, studentId, rank: position }));

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
        .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
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
            const grade = grades[student.id]?.[test.id];
            if (isAbsentGrade(grade)) return;
            const score = getTotalScore(grade, test);
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
