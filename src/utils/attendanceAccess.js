// src/utils/attendanceAccess.js (또는 현재 파일 위치 그대로)

const CONTENT_ALLOWED_STATUSES = new Set([
  'present',       // 출석
  'video_makeup',  // 동영상보강
  'late',          // 지각
  'tardy',         // (혹시 기존에 tardy를 쓰는 경우 대비)
]);

export function canAccessLessonContent(attendance) {
  if (!attendance) return false;
  return CONTENT_ALLOWED_STATUSES.has(attendance.status);
}

/**
 * ✅ "출결 카운트"도 동일 기준을 쓰도록 공통 함수로 제공
 * (present/video_makeup/late 를 출결로 친다)
 */
export function isCountedAsAttendance(attendance) {
  return canAccessLessonContent(attendance);
}