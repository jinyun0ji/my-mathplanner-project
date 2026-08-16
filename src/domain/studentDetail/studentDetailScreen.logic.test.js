import { isClosedClass } from '../../utils/classStatus';
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { resolveClassTestStats } from '../grade/classTestStats.service';
import { CLINIC_FIELDS, DataTable } from '../../pages/StudentDetail';
import {
    buildStudentGradeRows,
    buildStudentHomeworkRows,
    buildStudentClinicRows,
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

    test('keeps a historical grade whose class is closed', () => {
        const rows = buildStudentGradeRows({
            grades: [{ id: 'grade-closed', testId: 'test-closed', score: 88 }],
            testMap: new Map([['test-closed', { id: 'test-closed', classId: 'class-closed', title: '기말고사' }]]),
            classMap: new Map([['class-closed', { id: 'class-closed', name: '종강반', status: 'closed', active: false }]]),
            classTestStats: {},
            getClassId: (record) => String(record.classId || ''),
            isClosedClass,
            resolveClassTestStats,
        });

        expect(rows).toHaveLength(1);
        expect(rows[0].classDoc.name).toBe('종강반');
    });

    test('keeps a grade with test metadata when its class document is unavailable', () => {
        const rows = buildStudentGradeRows({
            grades: [{ id: 'grade-orphan-class', testId: 'test-1', score: 77 }],
            testMap: new Map([['test-1', { id: 'test-1', classId: 'missing-class', className: '과거반' }]]),
            classMap: new Map(),
            classTestStats: {},
            getClassId: (record) => String(record.classId || ''),
            isClosedClass,
            resolveClassTestStats,
        });

        expect(rows).toHaveLength(1);
        expect(rows[0].test.className).toBe('과거반');
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

    test('assignment metadata wins over empty or legacy result metadata', () => {
        const rows = buildStudentHomeworkRows({
            homeworkResults: [{ id: 'result-1', assignmentId: 'assignment-1', title: '', classId: '', classDocId: 'legacy-class', results: { 1: '맞음' } }],
            assignmentMap: new Map([['assignment-1', { id: 'assignment-1', title: '실제 과제명', classId: 'real-class', questionNumbers: [1] }]]),
            studentId: 'student-1',
        });

        expect(rows[0]).toMatchObject({ id: 'result-1', assignmentTitle: '실제 과제명', classId: 'real-class' });
        expect(rows[0].results).toEqual({ 1: '맞음' });
    });

    test('pages mixed current and legacy clinic schemas without requiring date', async () => {
        const recordsByIdentity = {
            'studentId:student-doc': [
                { id: 'current-1', studentId: 'student-doc', date: '2026-08-09' },
                { id: 'current-2', studentId: 'student-doc', date: '2026-08-08' },
                { id: 'legacy-clinic-date', studentId: 'student-doc', clinicDate: '2026-08-07' },
            ],
            'authUid:student-auth': [
                { id: 'legacy-created-at', authUid: 'student-auth', createdAt: '2026-08-06' },
                { id: 'legacy-no-date', authUid: 'student-auth' },
            ],
            'userUid:student-auth': [
                { id: 'legacy-user-uid', userUid: 'student-auth', clinicDate: '2026-08-05' },
                { id: 'current-1', userUid: 'student-auth', date: '2026-08-09' },
            ],
        };
        const fetchPair = jest.fn(({ field, value }) => Promise.resolve({
            docs: recordsByIdentity[`${field}:${value}`] || [], cursor: null, hasMore: false,
        }));
        const mergeRows = (groups) => [...new Map(groups.flat().map((row) => [row.id, row])).values()];
        const effectiveDate = (row) => row.date || row.clinicDate || row.createdAt || '';
        const sortRows = (rows) => [...rows].sort((a, b) => effectiveDate(b).localeCompare(effectiveDate(a)));
        let cursors = {};
        let rendered = [];

        for (const expectedCount of [4, 6]) {
            const page = await fetchStudentPageCore({
                pairs: [
                    ['studentId', 'student-doc'],
                    ['authUid', 'student-auth'],
                    ['userUid', 'student-auth'],
                ],
                cursors, pageSize: 4, fetchPair, mergeRows, sortRows,
            });
            rendered = mergeRows([rendered, page.rows]);
            cursors = page.cursors;
            expect(rendered).toHaveLength(expectedCount);
            if (expectedCount === 6) expect(page.hasMore).toBe(false);
        }

        expect(fetchPair).toHaveBeenCalledTimes(3);
        expect(rendered.map((row) => row.id)).toEqual(expect.arrayContaining([
            'current-1', 'current-2', 'legacy-clinic-date', 'legacy-created-at', 'legacy-no-date', 'legacy-user-uid',
        ]));
    });

    test('the clinic table renders every row already present in screen state', () => {
        const rows = Array.from({ length: 8 }, (_, index) => ({ id: `clinic-${index + 1}`, label: `클리닉 ${index + 1}` }));
        render(<DataTable rows={rows} emptyText="없음" columns={[{ key: 'label', label: '클리닉' }]} />);

        expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(9);
        rows.forEach((row) => expect(screen.getByText(row.label)).toBeInTheDocument());
    });

    test('merges walk-in logs and historical reservations while excluding future and cancelled bookings', () => {
        const clinicLogs = Array.from({ length: 4 }, (_, index) => ({
            id: `walk-in-${index + 1}`,
            studentId: 'student-doc',
            clinicDate: `2026-08-0${index + 1}`,
            status: 'attended',
        }));
        const clinicReservations = [
            { id: 'past-pending', studentDocId: 'student-doc', date: '2026-08-10', status: 'pending' },
            { id: 'past-attended', authUid: 'student-auth', reservationDate: '2026-08-11', status: 'attended' },
            { id: 'past-no-show', studentUid: 'student-doc', scheduledAt: '2026-08-12T17:00:00Z', status: 'no-show' },
            { id: 'future', studentDocId: 'student-doc', date: '2026-08-20', status: 'pending' },
            { id: 'cancelled', studentDocId: 'student-doc', date: '2026-08-09', status: 'cancelled' },
        ];

        const rows = buildStudentClinicRows({ clinicLogs, clinicReservations, now: new Date('2026-08-16T12:00:00Z') });

        expect(rows).toHaveLength(7);
        expect(rows.map((row) => row.id)).toEqual([
            'past-no-show', 'past-attended', 'past-pending',
            'walk-in-4', 'walk-in-3', 'walk-in-2', 'walk-in-1',
        ]);
        expect(rows.map((row) => row.id)).not.toEqual(expect.arrayContaining(['future', 'cancelled']));
        expect(rows.find((row) => row.id === 'past-attended')).toMatchObject({
            studentId: 'student-auth', sourceType: 'clinicReservation', effectiveDate: '2026-08-11',
        });
    });

    test('deduplicates only explicit reservation links or cross-collection document ids', () => {
        const rows = buildStudentClinicRows({
            clinicLogs: [
                { id: 'report-1', studentId: 'student-doc', date: '2026-08-10', reservationId: 'reservation-1' },
                { id: 'same-id', studentId: 'student-doc', date: '2026-08-09' },
                { id: 'separate-visit', studentId: 'student-doc', date: '2026-08-10' },
            ],
            clinicReservations: [
                { id: 'reservation-1', studentDocId: 'student-doc', date: '2026-08-10', status: 'attended' },
                { id: 'same-id', studentDocId: 'student-doc', date: '2026-08-09', status: 'attended' },
            ],
            now: new Date('2026-08-16T12:00:00Z'),
        });

        expect(rows.map((row) => row.id)).toEqual(['report-1', 'separate-visit', 'same-id']);
        expect(rows.filter((row) => row.id === 'same-id')).toHaveLength(1);
    });

    test('queries clinic reservations through document and auth identity aliases', () => {
        expect(CLINIC_FIELDS.map(([field]) => field)).toEqual(expect.arrayContaining([
            'studentId', 'studentDocId', 'studentUid', 'authUid', 'uid', 'userUid',
        ]));
        const studentDocAliases = CLINIC_FIELDS.find(([field]) => field === 'studentDocId')[1];
        const authAliases = CLINIC_FIELDS.find(([field]) => field === 'authUid')[1];
        expect(studentDocAliases).toEqual(expect.arrayContaining(['id', 'authUid']));
        expect(authAliases).toEqual(expect.arrayContaining(['id', 'authUid', 'userUid']));
    });
});
