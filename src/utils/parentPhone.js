const digitsOnly = (v) => String(v || '').replace(/[^\d]/g, '');
const last4 = (v) => {
  const d = digitsOnly(v);
  return d ? d.slice(-4) : '';
};

const pickPhone = (p) => {
  if (!p) return '';
  // 학부모 전화 필드명 다양성 커버
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

// ✅ 학생 배열(students), 학부모 배열(parents)로
//    { [studentDocId]: "1234" } 형태 맵을 만든다
export const buildStudentParentPhoneLast4Map = (students = [], parents = []) => {
  const map = {};

  const byParentDocId = new Map();
  const byParentAuthUid = new Map();

  (parents || []).forEach((p) => {
    const docId = p?.id ? String(p.id) : '';
    const authUid = p?.authUid ? String(p.authUid) : '';
    if (docId) byParentDocId.set(docId, p);
    if (authUid) byParentAuthUid.set(authUid, p);
  });

  // 1) 학생 문서에 부모 연결 키가 있는 케이스 (권장/빠름)
  //    - parentAuthUid / parentUid / parentId / parentDocId / parentUserId 등 레거시 커버
  (students || []).forEach((s) => {
    const sid = s?.id ? String(s.id) : '';
    if (!sid) return;

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
      const v = last4(pickPhone(parent));
      if (v) map[sid] = v;
    }
  });

  // 2) 학부모 문서가 studentIds 배열을 들고있는 케이스(역방향)
  //    - map에 아직 못 채운 학생만 대상으로 채운다
  (parents || []).forEach((p) => {
    const ids = Array.isArray(p?.studentIds) ? p.studentIds : [];
    if (ids.length === 0) return;

    const v = last4(pickPhone(p));
    if (!v) return;

    ids.map(String).forEach((sid) => {
      if (!sid) return;
      if (!map[sid]) map[sid] = v;
    });
  });

  return map;
};

export const formatStudentNameWithParentLast4 = (student, parentLast4Map = {}, fallback = '----') => {
  const name = student?.name || '';
  const parentLast4 = parentLast4Map[String(student?.id || '')] || '';
  return `${name} (${parentLast4 || fallback})`;
};