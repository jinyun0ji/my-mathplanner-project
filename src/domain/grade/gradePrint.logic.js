import { buildCompetitionRanking, getTotalScore } from './grade.service';

const isCorrect = (value) => (
    value === true || value === 1 || value === '1'
    || value === 'O' || value === 'o' || value === '맞음' || value === '고침'
);

export const buildGradePrintPayload = ({ students = [], grades = {}, test, className = '-' } = {}) => {
    if (!test) return {
        classNameText: className,
        testTitle: '-',
        testDate: null,
        rankings: [],
        scores: [],
        stats: { submittedCount: 0, average: null, maxScore: null, minScore: null },
        questionStats: [],
    };

    const attemptedRows = students.map((student) => {
        const grade = grades?.[student.id]?.[test.id] || null;
        const score = grade ? getTotalScore(grade, test) : null;
        const noShow = String(grade?.score || '').trim() === '미응시';
        const attempted = Boolean(grade?.attempted === true || Number.isFinite(score)) && !noShow;
        return {
            studentId: student.id,
            studentName: student.name,
            score: Number.isFinite(score) ? Number(score) : null,
            answerMap: grade?.answers || grade?.correctCount || {},
            attempted,
        };
    }).filter((row) => row.attempted && Number.isFinite(row.score));

    const rankings = buildCompetitionRanking(attemptedRows.filter((row) => Number.isFinite(row.score)));
    const scores = rankings.map((row) => row.score);
    const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
    const questionCount = Number(test.totalQuestions)
        || (Array.isArray(test.questionScores) ? test.questionScores.length : 0);
    const questionStats = Array.from({ length: questionCount }, (_, index) => {
        const question = index + 1;
        const correctCount = attemptedRows.reduce(
            (count, row) => count + (isCorrect(row.answerMap?.[question] ?? row.answerMap?.[String(question)]) ? 1 : 0),
            0,
        );
        const pointValue = Number(test.questionScores?.[index]);
        return {
            question,
            pointValue: Number.isFinite(pointValue) ? pointValue : null,
            correctCount,
            submittedCount: attemptedRows.length,
            correctRate: attemptedRows.length ? (correctCount / attemptedRows.length) * 100 : null,
        };
    });

    const configuredMaxScore = Number(test.maxScore);
    const summedQuestionScore = Array.isArray(test.questionScores)
        ? test.questionScores.reduce((sum, value) => sum + (Number.isFinite(Number(value)) ? Number(value) : 0), 0)
        : 0;
    const possibleScore = Number.isFinite(configuredMaxScore) && configuredMaxScore > 0
        ? configuredMaxScore
        : (summedQuestionScore > 0 ? summedQuestionScore : null);

    return {
        classNameText: className,
        testTitle: test.name || test.title || '-',
        testDate: test.date || test.createdAt || test.updatedAt || null,
        rankings,
        scores,
        stats: {
            submittedCount: scores.length,
            average,
            maxScore: scores.length ? Math.max(...scores) : null,
            minScore: scores.length ? Math.min(...scores) : null,
            possibleScore,
        },
        questionStats,
    };
};
