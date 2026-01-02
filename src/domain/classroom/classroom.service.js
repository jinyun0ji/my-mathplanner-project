import { isAssignmentAssignedToStudent } from '../homework/homework.service';

export const buildClassroomStats = ({
  attendanceLogs = [],
  selectedClassId = null,
  studentDocId = null,
  studentAuthUid = null,
  homeworkAssignments = [],
  homeworkResults = {},
  tests = [],
  grades = {},
}) => {
  const myAttendance = attendanceLogs.filter(
    (log) => log.classId === selectedClassId && (log.studentId || log.studentUid) === studentDocId
  );

  // ✅ 출결로 인정할 상태: 출석/동영상보강/지각
  const COUNTED_STATUSES = new Set([
    '출석',
    '동영상보강',
    '지각',
    // (혹시 영어로 저장되는 경우 대비)
    'present',
    'video_makeup',
    'late',
    'tardy',
  ]);

  const presentCount = myAttendance.filter((l) => COUNTED_STATUSES.has(l.status)).length;
  const lateCount = myAttendance.filter((l) => l.status === '지각' || l.status === 'late' || l.status === 'tardy').length;
  const absentCount = myAttendance.filter((l) => l.status === '결석' || l.status === 'absent').length;
  const totalAttendance = myAttendance.length;

  const classHomeworks = homeworkAssignments.filter(
    (h) => h.classId === selectedClassId && isAssignmentAssignedToStudent(h, studentDocId)
  );

  const unsubmittedCount = classHomeworks.filter((h) => {
    const result = homeworkResults?.[studentAuthUid]?.[h.id];
    const resultMap = result?.results || result || {};
    return !result || Object.keys(resultMap).length === 0;
  }).length;

  let unresolvedCount = 0;
  classHomeworks.forEach((hw) => {
    const result = homeworkResults?.[studentAuthUid]?.[hw.id];
    const resultMap = result?.results || result || {};
    if (result) unresolvedCount += Object.values(resultMap).filter((status) => status === '틀림').length;
  });

  let gradeTrend = 'initial';
  if (tests && grades) {
    const classTests = tests
      .filter((t) => t.classId === selectedClassId)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // NOTE: 기존 로직 유지 (score 기반)
    const myScores = classTests
      .map((t) => grades[studentAuthUid]?.[t.id]?.score)
      .filter((s) => s !== undefined && s !== null);

    if (myScores.length >= 2) {
      const latest = myScores[myScores.length - 1];
      const prev = myScores[myScores.length - 2];
      if (latest > prev) gradeTrend = 'up';
      else if (latest < prev) gradeTrend = 'down';
      else gradeTrend = 'same';
    } else if (myScores.length === 1) {
      gradeTrend = 'initial';
    }
  }

  return {
    attendance: {
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      total: totalAttendance,
      logs: myAttendance,
    },
    homework: { unresolved: unresolvedCount, unsubmitted: unsubmittedCount },
    grade: { trend: gradeTrend },
  };
};