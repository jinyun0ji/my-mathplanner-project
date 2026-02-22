// src/utils/parentPhone.js

const digitsOnly = (v) => String(v || '').replace(/[^\d]/g, '');

export const last4 = (v) => {
  const d = digitsOnly(v);
  return d ? d.slice(-4) : '';
};

const pickPhoneFromParentDoc = (p) => {
  if (!p) return '';
  return (
    p.parentPhone ||
    p.phone ||
    p.phoneNumber ||
    p.mobile ||
    p.mobilePhone ||
    p.contactPhone ||
    p.contact?.phone ||
    p.contact?.mobile ||
    ''
  );
};

const pickParentPhoneFromStudentDoc = (s) => {
  if (!s) return '';
  return (
    s.parentPhone ||
    s.parentPhoneNumber ||
    s.parentMobile ||
    s.parentTel ||
    s.guardianPhone ||
    s.guardianPhoneNumber ||
    s.contactParentPhone ||
    s.contact?.parentPhone ||
    s.contact?.guardianPhone ||
    ''
  );
};

export const buildStudentParentPhoneLast4Map = (students = [], parents = []) => {
  const map = {};

  // ✅ 1순위: 학생 문서의 parentPhone 직접 사용
  (students || []).forEach((s) => {
    const sid = s?.id ? String(s.id) : '';
    if (!sid) return;
    const v = last4(pickParentPhoneFromStudentDoc(s));
    if (v) map[sid] = v;
  });

  const byParentDocId = new Map();
  const byParentAuthUid = new Map();

  (parents || []).forEach((p) => {
    const docId = p?.id ? String(p.id) : '';
    const authUid = p?.authUid ? String(p.authUid) : '';
    if (docId) byParentDocId.set(docId, p);
    if (authUid) byParentAuthUid.set(authUid, p);
  });

  // 2순위: parentAuthUid / parentId 연결
  (students || []).forEach((s) => {
    const sid = s?.id ? String(s.id) : '';
    if (!sid) return;
    if (map[sid]) return;

    const parentKeyCandidates = [
      s.parentAuthUid,
      s.parentUid,
      s.parentId,
      s.parentDocId,
      s.parentUserId,
      s.parentUserUid,
    ]
      .filter(Boolean)
      .map(String);

    let parent = null;
    for (const k of parentKeyCandidates) {
      parent = byParentAuthUid.get(k) || byParentDocId.get(k) || null;
      if (parent) break;
    }

    if (parent) {
      const v = last4(pickPhoneFromParentDoc(parent));
      if (v) map[sid] = v;
    }
  });

  // 3순위: parent 문서의 studentIds 역참조
  (parents || []).forEach((p) => {
    const ids = Array.isArray(p?.studentIds) ? p.studentIds : [];
    if (ids.length === 0) return;

    const v = last4(pickPhoneFromParentDoc(p));
    if (!v) return;

    ids.map(String).forEach((sid) => {
      if (!sid) return;
      if (!map[sid]) map[sid] = v;
    });
  });

  return map;
};

export const formatStudentNameWithParentLast4 = (
  student,
  parentLast4Map = {},
  fallback = '----'
) => {
  const name = student?.name || '';
  const direct = last4(pickParentPhoneFromStudentDoc(student));
  const mapped = parentLast4Map[String(student?.id || '')] || '';
  const v = direct || mapped || '';
  return `${name} (${v || fallback})`;
};