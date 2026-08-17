import { buildCompetitionRanking } from './grade.service';
import { buildGradePrintPayload } from './gradePrint.logic';

describe('grade print report resolver', () => {
    test('sorts every submitted student and uses competition ranking for ties', () => {
        expect(buildCompetitionRanking([
            { studentId: 'c', studentName: '다', score: 90 },
            { studentId: 'a', studentName: '가', score: 100 },
            { studentId: 'b', studentName: '나', score: 95 },
            { studentId: 'd', studentName: '라', score: 95 },
        ]).map(({ studentId, score, rank }) => ({ studentId, score, rank }))).toEqual([
            { studentId: 'a', score: 100, rank: 1 },
            { studentId: 'b', score: 95, rank: 2 },
            { studentId: 'd', score: 95, rank: 2 },
            { studentId: 'c', score: 90, rank: 4 },
        ]);
    });

    test('resolves scores, statistics, and real question accuracy without truncating rankings', () => {
        const students = Array.from({ length: 12 }, (_, index) => ({ id: String(index), name: `학생${index}` }));
        const grades = Object.fromEntries(students.map((student, index) => [student.id, {
            exam: { answers: { 1: index < 9 ? 1 : 2, 2: index < 6 ? 1 : 2 } },
        }]));
        const payload = buildGradePrintPayload({
            students,
            grades,
            className: 'A반',
            test: { id: 'exam', name: '정기 테스트', date: '2026-08-16', maxScore: 20, totalQuestions: 2, questionScores: [10, 10] },
        });

        expect(payload.rankings).toHaveLength(12);
        expect(payload.rankings.map((row) => row.score)).toEqual([...payload.scores].sort((a, b) => b - a));
        expect(payload.stats).toEqual({ submittedCount: 12, average: 12.5, maxScore: 20, minScore: 0, possibleScore: 20 });
        expect(payload.questionStats).toEqual([
            { question: 1, pointValue: 10, correctCount: 9, submittedCount: 12, correctRate: 75 },
            { question: 2, pointValue: 10, correctCount: 6, submittedCount: 12, correctRate: 50 },
        ]);
    });
});

describe.each([
    ['small', 8, 10],
    ['current', 12, 13],
    ['medium', 30, 20],
    ['large', 42, 40],
])('%s adaptive report dataset', (_label, studentCount, questionCount) => {
    test('preserves every attempted student and question at scale', () => {
        const students = Array.from({ length: studentCount + 1 }, (_, index) => ({ id: `s${index}`, name: `학생 ${index}` }));
        const questionScores = Array(questionCount).fill(1);
        const grades = Object.fromEntries(students.map((student, studentIndex) => {
            if (studentIndex === studentCount) return [student.id, { exam: { score: '미응시' } }];
            const correctQuestions = studentIndex === studentCount - 1 ? 0 : studentCount - studentIndex;
            const answers = Object.fromEntries(Array.from({ length: questionCount }, (_, index) => [index + 1, index < Math.min(correctQuestions, questionCount) ? 1 : 2]));
            return [student.id, { exam: { answers } }];
        }));
        const payload = buildGradePrintPayload({ students, grades, test: { id: 'exam', totalQuestions: questionCount, questionScores } });

        expect(payload.rankings).toHaveLength(studentCount);
        expect(payload.questionStats.map((row) => row.question)).toEqual(Array.from({ length: questionCount }, (_, index) => index + 1));
        expect(payload.rankings.map((row) => row.score)).toEqual([...payload.scores].sort((a, b) => b - a));
        expect(payload.rankings.at(-1).score).toBe(0);
        expect(payload.stats.submittedCount).toBe(studentCount);
        expect(payload.stats.maxScore).toBe(Math.min(studentCount, questionCount));
        expect(payload.stats.minScore).toBe(0);
        expect(payload.stats.possibleScore).toBe(questionCount);
        expect(payload.questionStats[0].correctCount).toBe(studentCount - 1);
        expect(payload.rankings.map((row) => row.rank)).toEqual(buildCompetitionRanking(payload.rankings).map((row) => row.rank));
    });
});
