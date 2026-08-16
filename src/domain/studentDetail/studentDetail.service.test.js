import {
    buildGradeRowsForScreen,
    buildHomeworkRowsForScreen,
    collectStudentPage,
} from './studentDetail.service';
import { isSameStudentByAnyKey } from '../../utils/studentKey';

describe('StudentDetail screen data regressions', () => {
    test.each(['studentId', 'studentUid', 'authUid'])('matches a grade stored with %s', (identityField) => {
        const student = { id: 'student-doc-id', userUid: 'participant-uid' };
        const grades = [{ id: `grade-${identityField}`, [identityField]: 'participant-uid', testId: 'test-1', score: 87 }];
        const matched = grades.filter((grade) => isSameStudentByAnyKey(grade, student));
        const rows = buildGradeRowsForScreen({
            grades: matched,
            tests: [{ id: 'test-1', classId: 'class-1', title: '8월 시험', date: '2026-08-10', average: 75, maxScore: 100 }],
            classes: [{ id: 'class-1', name: '중2 수학' }],
        });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ score: 87, classAverage: 75, highestScore: 100 });
    });

    test.each(['assignmentId', 'homeworkAssignmentId', 'homeworkId'])('builds homework row with %s alias', (assignmentField) => {
        const rows = buildHomeworkRowsForScreen({
            student: { id: 'student-doc-id', userUid: 'participant-uid' },
            results: [{ id: `result-${assignmentField}`, studentUid: 'participant-uid', [assignmentField]: 'assignment-1', results: { 1: '맞음' } }],
            assignments: [{ id: 'assignment-1', title: '일차방정식', questionNumbers: [1] }],
        });
        expect(rows).toHaveLength(1);
        expect(rows[0].assignmentTitle).toBe('일차방정식');
        expect(rows[0].results).toEqual({ 1: '맞음' });
    });

    test('paginates 9 unique clinic records as 4, 8, 9 and then stops', async () => {
        const records = Array.from({ length: 9 }, (_, index) => ({ id: `clinic-${index + 1}`, date: 9 - index }));
        const fetchPair = jest.fn(({ cursor }) => {
            const start = cursor ?? 0;
            const rows = records.slice(start, start + 4);
            return Promise.resolve({ rows, cursor: start + rows.length, hasMore: rows.length === 4 });
        });
        let cursors = {};
        let rendered = [];
        for (const expected of [4, 8, 9]) {
            const page = await collectStudentPage({
                pairs: [['studentId', 'student-doc-id']], cursors, pageSize: 4, fetchPair,
                sortRows: (rows) => [...rows].sort((a, b) => b.date - a.date),
            });
            rendered = [...rendered, ...page.rows];
            cursors = page.cursors;
            expect(new Set(rendered.map((row) => row.id)).size).toBe(expected);
            if (expected === 9) expect(page.hasMore).toBe(false);
        }
    });

    test('deduplicates clinic documents returned by multiple identity queries', async () => {
        const records = Array.from({ length: 5 }, (_, index) => ({ id: `clinic-${index + 1}`, date: 5 - index }));
        const page = await collectStudentPage({
            pairs: [['studentId', 'student-doc-id'], ['studentUid', 'participant-uid']],
            cursors: {}, pageSize: 4,
            fetchPair: ({ cursor }) => {
                const start = cursor ?? 0;
                const rows = records.slice(start, start + 4);
                return Promise.resolve({ rows, cursor: start + rows.length, hasMore: rows.length === 4 });
            },
            sortRows: (rows) => rows,
        });
        expect(page.rows.map((row) => row.id)).toEqual(['clinic-1', 'clinic-2', 'clinic-3', 'clinic-4']);
        expect(new Set(page.rows.map((row) => row.id)).size).toBe(4);
    });
});
