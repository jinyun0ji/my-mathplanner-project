export function canAccessLessonContent(attendance) {
  if (!attendance) return false;

  return (
    attendance.status === 'present' ||
    attendance.status === 'video_makeup'
  );
}