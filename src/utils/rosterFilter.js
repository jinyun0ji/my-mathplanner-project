export const toDateSafe = (v) => {
  if (!v) return null;
  // Firestore Timestamp
  if (typeof v?.toDate === 'function') return v.toDate();
  // JS Date
  if (v instanceof Date) return v;

  // 문자열/숫자(YYYY-MM-DD 등)
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const ymd = (v) => {
  const d = toDateSafe(v);
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ✅ classStatusMap에서 classId 키를 "안전하게" 찾는다 (문자/숫자 혼재 대응)
const getClassStatusEntry = (student, classId) => {
  const map = student?.classStatusMap;
  if (!map || !classId) return null;

  // 1) 먼저 원래 키로 조회
  if (map[classId]) return map[classId];

  // 2) 문자열로 강제해서 조회
  const key = String(classId);
  if (map[key]) return map[key];

  // 3) map 키를 순회해서 String 비교로 찾기(최후 수단)
  const foundKey = Object.keys(map).find((k) => String(k) === key);
  return foundKey ? map[foundKey] : null;
};

// ✅ 종료일 후보 필드들을 모두 지원(데이터 혼재 대비)
const getEndedAtAny = (st) => {
  return st?.endedAt ?? st?.withdrawnAt ?? st?.endDate ?? st?.endedDate ?? null;
};

// ✅ status 문자열이 '전반(중도퇴원)' 처럼 와도 잡히도록 includes 검사
const isEndedStatus = (rawStatus) => {
  const s = String(rawStatus || '').trim();
  if (!s) return false;
  return s.includes('퇴원') || s.includes('전반') || s.includes('종강');
};

/**
 * ✅ 핵심 판단:
 * - status가 퇴원/전반/종강(또는 그 문구가 포함된 문자열)이면 "종료 처리"
 * - endedAt(또는 대체 필드)가 있고
 * - targetDate가 endedAt "이후"(>)면 제외
 * - endedAt 당일(==)은 포함
 */

export const isActiveStudentOnDate = (student, classId, targetDate) => {
  if (!student || !classId) return true;

  const st = getClassStatusEntry(student, classId);
  if (!st) return true;

  if (!isEndedStatus(st.status)) return true;

  const endYmd = ymd(getEndedAtAny(st));
  const tYmd = ymd(targetDate);

  // 날짜 정보가 없으면 일단 포함(데이터 누락 대비)
  if (!endYmd || !tYmd) return true;

  // "퇴원일 이후"만 제외 => targetDate > endedAt 이면 비활성
  return tYmd <= endYmd;
};

export const filterRosterByWithdrawDate = (students, classId, targetDate) => {
  const list = Array.isArray(students) ? students : [];
  return list.filter((s) => isActiveStudentOnDate(s, classId, targetDate));
};