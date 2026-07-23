import {
  getHomeworkForCurrentLesson,
  getHomeworkForPerformanceEvaluation,
  getPreviousLessonDate,
} from './LessonReportManagement';

jest.mock('../firebase/client', () => ({ db: {} }));
jest.mock('../auth/useAuth', () => () => ({ profileDocId: 'staff-1' }));

describe('LessonReportManagement homework auto selection helpers', () => {
  const student = { id: 'student-1' };
  const lessonLogs = [
    { id: 'l1', classId: 'class-a', date: '2026-07-02' },
    { id: 'l2', classId: 'class-a', date: '2026-07-09' },
    { id: 'l3', classId: 'class-a', date: '2026-07-23' },
    { id: 'other', classId: 'class-b', date: '2026-07-16' },
  ];
  const homeworkAssignments = [
    { id: 'hw-0702', classId: 'class-a', date: '2026-07-02', targetStudents: ['student-1'] },
    { id: 'hw-0709', classId: 'class-a', date: '2026-07-09', targetStudents: ['student-1'] },
    { id: 'hw-0723', classId: 'class-a', date: '2026-07-23', targetStudents: ['student-1'] },
    { id: 'other-class', classId: 'class-b', date: '2026-07-09', targetStudents: ['student-1'] },
    { id: 'other-student', classId: 'class-a', date: '2026-07-09', targetStudents: ['student-2'] },
  ];

  test('finds the previous actual lesson date for the same class, not the previous calendar day', () => {
    expect(getPreviousLessonDate({ lessonLogs, classId: 'class-a', lessonDate: '2026-07-23' })).toBe('2026-07-09');
  });

  test('returns no performance homework for the first lesson', () => {
    expect(getHomeworkForPerformanceEvaluation({ homeworkAssignments, lessonLogs, student, classId: 'class-a', lessonDate: '2026-07-02' })).toEqual([]);
  });

  test('uses previous lesson homework for performance and current lesson homework for assigned homework', () => {
    const progressIds = getHomeworkForPerformanceEvaluation({ homeworkAssignments, lessonLogs, student, classId: 'class-a', lessonDate: '2026-07-23' }).map((item) => item.id);
    const currentIds = getHomeworkForCurrentLesson({ homeworkAssignments, student, classId: 'class-a', lessonDate: '2026-07-23' }).map((item) => item.id);

    expect(progressIds).toEqual(['hw-0709']);
    expect(currentIds).toEqual(['hw-0723']);
  });
});
