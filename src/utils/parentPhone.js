const digitsOnly = (v) => String(v || '').replace(/[^\d]/g, '');
const last4 = (v) => {
  const d = digitsOnly(v);
  return d ? d.slice(-4) : '';
};

const pickPhone = (p) => {
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

const getStudentKeyCandidates = (s) => {
  const out = [];
  if (!s) return out;
  if (s.id) out.push(String(s.id));
  if (s.uid) out.push(String(s.uid));
  if (s.authUid) out.push(String(s.authUid));
  return Array.from(new Set(out.filter(Boolean)));
};

const setMapForStudent = (map, student, v) => {
  if (!v) return;
  const keys = getStudentKeyCandidates(student);
  keys.forEach((k) => {
    if (!k) return;
    map[k] = v;
  });
};

// ✅ 학생 배열(students), 학부모 배열(parents)로
//    "어떤 키로 조회해도" last4가 나오도록 맵을 만든다.
//    - studentDocId / student.uid / student.authUid 모두 같은 값으로 매핑
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

  // student를 id/uid/authUid 어떤 키로도 찾을 수 있게 인덱스 구축
  const studentByAnyKey = new Map();
  (students || []).forEach((s) => {
    getStudentKeyCandidates(s).forEach((k) => {
      if (!studentByAnyKey.has(k)) studentByAnyKey.set(k, s);
    });
  });

  // 1) 학생 문서에 부모 연결 키가 있는 케이스(정방향)
  (students || []).forEach((s) => {
    const parentKeyCandidates = [
      s?.parentAuthUid,
      s?.parentUid,
      s?.parentId,
      s?.parentDocId,
      s?.parentUserId,
      s?.parentUserUid,
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
      if (v) setMapForStudent(map, s, v);
    }
  });

  // 2) 학부모 문서가 studentIds 배열을 들고있는 케이스(역방향)
  (parents || []).forEach((p) => {
    const ids = Array.isArray(p?.studentIds) ? p.studentIds : [];
    if (ids.length === 0) return;
    const v = last4(pickPhone(p));
    if (!v) return;

    ids.map(String).forEach((rawKey) => {
      if (!rawKey) return;

      // rawKey가 studentDocId일 수도, student.authUid일 수도 있으니 둘 다 커버
      if (!map[rawKey]) map[rawKey] = v;

      const st = studentByAnyKey.get(rawKey) || null;
      if (st) setMapForStudent(map, st, v);
    });
  });

  return map;
};

export const formatStudentNameWithParentLast4 = (student, parentLast4Map = {}, fallback = '----') => {
  const name = student?.name || '';
  const keys = getStudentKeyCandidates(student);

  const found =
    keys.map((k) => parentLast4Map[String(k)] || '').find(Boolean) || '';

  return `${name} (${found || fallback})`;
};