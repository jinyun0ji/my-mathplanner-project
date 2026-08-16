export const getStudentKeyCandidates = (studentOrRowLike) => {
  if (!studentOrRowLike) return [];
  const raw = [];
  if (Array.isArray(studentOrRowLike)) {
    raw.push(...studentOrRowLike);
  } else if (typeof studentOrRowLike === 'object') {
    raw.push(
      studentOrRowLike.id,
      studentOrRowLike.docId,
      studentOrRowLike.userDocId,
      studentOrRowLike.uid,
      studentOrRowLike.authUid,
      studentOrRowLike.studentAuthUid,
      studentOrRowLike.studentId,
      studentOrRowLike.studentUid,
      studentOrRowLike.studentDocId,
      studentOrRowLike.studentDocIds,
      studentOrRowLike.studentKey,
      studentOrRowLike.userId,
      studentOrRowLike.userUid,
      studentOrRowLike.parentUid,
      studentOrRowLike.parentId,
      studentOrRowLike.parentAuthUid,
    );
  } else {
    raw.push(studentOrRowLike);
  }

  const flattened = raw.flatMap((value) => (Array.isArray(value) ? value : [value]));
  const normalized = flattened
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map((value) => String(value));
  return Array.from(new Set(normalized));
};

export const isSameStudentByAnyKey = (a, b) => {
  const aKeys = getStudentKeyCandidates(a);
  const bKeys = getStudentKeyCandidates(b);
  if (aKeys.length === 0 || bKeys.length === 0) return false;
  return aKeys.some((key) => bKeys.includes(String(key)));
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
