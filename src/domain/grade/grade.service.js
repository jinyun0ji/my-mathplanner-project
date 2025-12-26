const computeTestStatisticsInternal = (test, students, grades, classAverages) => {
    if (!test || !students.length) {
        return { average: 0, maxScore: 0, minScore: 0, stdDev: 0, correctRates: {}, rank: [] };
    }

    const scores = students.map(s => {
        const score = grades[s.id]?.[test.id]?.score;
        return score === undefined ? null : score;
    }).filter(s => s !== null);

    if (scores.length === 0) {
        return { average: 0, maxScore: 0, minScore: 0, stdDev: 0, correctRates: {}, rank: [] };
    }

    const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - average, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    const attemptedStudents = students.filter(s => grades[s.id]?.[test.id]?.score !== null && grades[s.id]?.[test.id]?.score !== undefined);
    const attemptedScores = attemptedStudents.map(s => ({
        score: grades[s.id][test.id].score,
        studentId: s.id,
        name: s.name
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

    if (test.totalQuestions > 0 && totalAttempted > 0) {
        for (let i = 1; i <= test.totalQuestions; i++) {
            let correctCount = 0;
            attemptedStudents.forEach(student => {
                const status = grades[student.id]?.[test.id]?.correctCount?.[i.toString()];
                if (status === '맞음' || status === '고침') {
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
            const score = grades[student.id]?.[test.id]?.score;
            if (score !== undefined && score !== null) {
                totalScore += Number(score);
                count++;
            }
        });
        averages[test.id] = count > 0 ? (totalScore / count) : 0;
    });
    return averages;
};

export const getTestStatistics = (classTests = [], classStudents = [], grades = {}, classAverages = {}) => {
    const stats = {};
    classTests.forEach(test => {
        stats[test.id] = computeTestStatisticsInternal(test, classStudents, grades, classAverages);
    });
    return stats;
};

export const computeTestStatistics = computeTestStatisticsInternal;