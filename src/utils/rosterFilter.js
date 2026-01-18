export const toDateSafe = (v) => {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
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

export const isActiveStudentOnDate = (student, classId, targetDate) => {
  if (!student || !classId) return true;
  const st = student?.classStatusMap?.[classId];
  if (!st) return true;

  const status = String(st.status || '');
  if (status !== '퇴원') return true;

  const endYmd = ymd(st.endedAt);
  const tYmd = ymd(targetDate);
  if (!endYmd || !tYmd) return true;

  return tYmd <= endYmd;
};

export const filterRosterByWithdrawDate = (students, classId, targetDate) => {
  const list = Array.isArray(students) ? students : [];
  return list.filter((s) => isActiveStudentOnDate(s, classId, targetDate));
};