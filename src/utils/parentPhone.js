export const normalizePhone = (v) => String(v || '').replace(/[^\d]/g, '');

export const phoneLast4 = (v) => {
  const digits = normalizePhone(v);
  if (!digits) return '';
  return digits.slice(-4);
};

export const buildStudentParentPhoneLast4Map = (students = [], parents = []) => {
  const map = {};

  const parentByAuthUid = new Map(
    parents.map(p => [String(p?.authUid || p?.id || ''), p]).filter(([k]) => k)
  );

  // parent.studentIds -> parent
  const parentsByStudentId = new Map();
  parents.forEach(p => {
    const sids = Array.isArray(p?.studentIds) ? p.studentIds : [];
    sids.forEach(sid => {
      if (!sid) return;
      if (!parentsByStudentId.has(String(sid))) parentsByStudentId.set(String(sid), p);
    });
  });

  students.forEach(s => {
    const sid = String(s?.id || '');
    if (!sid) return;

    let parent = null;
    const pAuth = s?.parentAuthUid ? String(s.parentAuthUid) : '';
    if (pAuth && parentByAuthUid.has(pAuth)) parent = parentByAuthUid.get(pAuth);

    if (!parent && parentsByStudentId.has(sid)) parent = parentsByStudentId.get(sid);

    const last4 = phoneLast4(parent?.phone || parent?.phoneNumber || parent?.mobile || '');
    map[sid] = last4 || '';
  });

  return map;
};

export const formatStudentNameWithParentLast4 = (student, parentLast4Map = {}) => {
  const name = student?.name || '';
  const last4 = parentLast4Map[String(student?.id || '')] || '';
  return last4 ? `${name} (${last4})` : name;
};