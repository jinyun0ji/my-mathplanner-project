import { getTotalScore, isAbsentGrade } from '../domain/grade/grade.service';

export function buildTestStats({ test, students = [], gradesByStudent = {} }) {
    const totalQuestions = Number(test?.totalQuestions) || 0;
    const bins = Array.from({ length: 11 }, (_, i) => ({
        label: i === 10 ? '100+' : `${i * 10}-${i * 10 + 9}`,
        count: 0,
    }));

    const attempted = [];
    let noShowCount = 0;

    students.forEach((student) => {
        const grade = gradesByStudent?.[student?.id]?.[test?.id] || null;
        if (!grade || isAbsentGrade(grade)) {
            noShowCount += 1;
            return;
        }
        const score = getTotalScore(grade, test);
        if (!Number.isFinite(score)) {
            noShowCount += 1;
            return;
        }
        attempted.push({ studentId: student.id, score, grade });
        const bucket = Math.max(0, Math.min(10, Math.floor(score / 10)));
        bins[bucket].count += 1;
    });

    const scores = attempted.map((a) => a.score);
    const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const max = scores.length ? Math.max(...scores) : null;
    const min = scores.length ? Math.min(...scores) : null;

    const questionRates = [];
    for (let i = 1; i <= totalQuestions; i += 1) {
        let correct = 0;
        attempted.forEach(({ grade }) => {
            const value = (grade.answers || grade.correctCount || {})[String(i)];
            if (value === true || value === 1 || value === '맞음' || value === '고침') correct += 1;
        });
        const attemptedCount = attempted.length;
        questionRates.push({
            question: i,
            correct,
            attempted: attemptedCount,
            rate: attemptedCount ? correct / attemptedCount : 0,
        });
    }

    return {
        attemptedCount: attempted.length,
        noShowCount,
        average,
        max,
        min,
        distribution: bins,
        questionRates,
    };
}