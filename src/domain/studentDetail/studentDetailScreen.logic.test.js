import { isClosedClass } from '../../utils/classStatus';
import { resolveClassTestStats } from '../grade/classTestStats.service';
import {
    buildStudentGradeRows,
    buildStudentHomeworkRows,
    fetchStudentPageCore,
} from './studentDetailScreen.logic';

describe('StudentDetail normal-screen regression paths', () => {
    test('joins a grade to its real test and class', () => {
        const rows = buildStudentGradeRows({
            grades: [{ id: 'grade-1', testId: 'test-1', score: 91 }],
            testMap: new Map([['test-1', { id: 'test-1', classId: 'class-1', title: '8월 시험' }]]),
            classMap: new Map([['class-1', { id: 'class-1', name: '중2 수학' }]]),
            classTestStats: {},
            getClassId: (record) => String(record.classId || ''),
            isClosedClass,
            resolveClassTestStats,
        });

        expect(rows).toHaveLength(1);
        expect(rows[0].classDoc.name).toBe('중2 수학');
    });

    test('uses the real homework assignment title and class relationship', () => {
        const assignment = { id: 'assignment-1', title: '일차방정식', classId: 'class-1', questionNumbers: [1] };
        const rows = buildStudentHomeworkRows({
            homeworkResults: [{ id: 'result-1', homeworkAssignmentId: 'assignment-1', results: { 1: '맞음' } }],
            assignmentMap: new Map([['assignment-1', assignment]]),
            studentId: 'student-1',
        });
        const classMap = new Map([['class-1', { id: 'class-1', name: '중2 수학' }]]);

        expect(rows).toHaveLength(1);
        expect(rows[0].assignmentTitle).toBe('일차방정식');
        expect(classMap.get(rows[0].classId).name).toBe('중2 수학');
    });

    test('the screen page/load-more path renders 9 clinics as 4, 8, then 9', async () => {
        const records = Array.from({ length: 9 }, (_, index) => ({ id: `clinic-${index + 1}`, date: `2026-08-${String(9 - index).padStart(2, '0')}` }));
        const fetchPair = jest.fn(({ cursor }) => {
            const start = cursor ?? 0;
            const docs = records.slice(start, start + 4);
            return Promise.resolve({ docs, cursor: start + docs.length, hasMore: docs.length === 4 });
        });
        const mergeRows = (groups) => [...new Map(groups.flat().map((row) => [row.id, row])).values()];
        const sortRows = (rows) => [...rows].sort((a, b) => b.date.localeCompare(a.date));
        let cursors = {};
        let rendered = [];

        for (const expectedCount of [4, 8, 9]) {
            const page = await fetchStudentPageCore({
                pairs: [['studentId', 'student-1']], cursors, pageSize: 4, fetchPair, mergeRows, sortRows,
            });
            rendered = mergeRows([rendered, page.rows]);
            cursors = page.cursors;
            expect(rendered).toHaveLength(expectedCount);
            if (expectedCount === 9) expect(page.hasMore).toBe(false);
        }
    });
});
