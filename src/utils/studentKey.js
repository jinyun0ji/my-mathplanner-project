export const getStudentKeyCandidates = (obj) => {
  if (!obj) return [];
  const keys = [
    obj.studentId,
    obj.studentUid,
    obj.studentDocId,
    obj.authUid,
    obj.uid,
    obj.id,
  ]
    .filter(Boolean)
    .map(String);

  // 중복 제거
  return Array.from(new Set(keys));
};

export const getStudentCandidatesFromStudent = (student) => {
  if (!student) return [];
  const keys = [
    student.id,
    student.authUid,
    ...(Array.isArray(student.classIds) ? [] : []),
  ]
    .filter(Boolean)
    .map(String);
  return Array.from(new Set(keys));
};

export const isSameStudentByAnyKey = (rowLike, studentLike) => {
  const a = getStudentKeyCandidates(rowLike);
  const b = getStudentCandidatesFromStudent(studentLike);
  if (a.length === 0 || b.length === 0) return false;
  return a.some((x) => b.includes(String(x)));
};

export const normalizeStudentIdOnRow = (row, authUidToDocIdMap = null) => {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };

  // 1) studentId가 비어있으면 studentUid/studentDocId/authUid에서 채운다
  if (!out.studentId) out.studentId = out.studentUid || out.studentDocId || out.authUid || null;

  // 2) authUid가 있는데 studentId가 docId여야 하는 화면이라면 맵으로 변환
  //    (선택: 필요할 때만 사용)
  if (authUidToDocIdMap && out.studentId && authUidToDocIdMap.has(out.studentId)) {
    out.studentId = authUidToDocIdMap.get(out.studentId);
  }

  return out;
};