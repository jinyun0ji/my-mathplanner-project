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
    p.parentContactPhone ||
    p.guardianPhone ||
    p.guardian?.phone ||
    ''
  );
};

// 내부 helper: map에 여러 키로 동일 값 주입
const put = (map, keys, value) => {
  const v = String(value || '');
  if (!v) return;
  (keys || [])
    .filter(Boolean)
    .map((k) => String(k))
    .forEach((k) => {
      if (!k) return;
      if (!map[k]) map[k] = v;
    });
};

/**
 * ✅ 학생 배열(students), 학부모 배열(parents)로
 *    { [학생식별자]: "1234" } 형태 맵을 만든다
 *
 * "학생식별자"는 아래를 모두 포함하도록 만든다:
 * - student.id (학생 users 문서 id)
 * - student.authUid (학생 auth uid)
 * - student.uid / student.studentUid / student.studentId (레거시)
 */
export const buildStudentParentPhoneLast4Map = (students = [], parents = []) => {
  const map = {};

  // parent 인덱스(문서id / authUid 모두)
  const byParentDocId = new Map();
  const byParentAuthUid = new Map();

  (parents || []).forEach((p) => {
    const docId = p?.id ? String(p.id) : '';
    const authUid = p?.authUid ? String(p.authUid) : '';
    if (docId) byParentDocId.set(docId, p);
    if (authUid) byParentAuthUid.set(authUid, p);
  });

  // 1) 학생 문서에 부모 연결 키가 있는 케이스
  (students || []).forEach((s) => {
    const sid = s?.id ? String(s.id) : '';
    const sAuth = s?.authUid ? String(s.authUid) : '';
    const sUid = s?.uid ? String(s.uid) : '';
    const sStudentUid = s?.studentUid ? String(s.studentUid) : '';
    const sStudentId = s?.studentId ? String(s.studentId) : '';

    const parentKeyCandidates = [
      s.parentAuthUid,
      s.parentUid,
      s.parentId,
      s.parentDocId,
      s.parentUserId,
      s.parentUserUid,
      s.parentAuthId,
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
      if (v) {
        put(map, [sid, sAuth, sUid, sStudentUid, sStudentId].filter(Boolean), v);
      }
    }
  });

  // 2) 학부모 문서가 학생 배열을 들고있는 케이스(역방향)
  (parents || []).forEach((p) => {
    const v = last4(pickPhone(p));
    if (!v) return;

    // 학부모 문서에서 학생 연결 키가 다양한 경우를 커버
    const candidateArrays = [
      p.studentIds,          // 학생 docId 배열 (가장 흔함)
      p.students,            // 레거시
      p.childIds,
      p.childrenIds,
      p.studentDocIds,
      p.studentUids,         // (혹시) 학생 authUid/uid 배열
      p.childUids,
      p.childrenUids,
      p.studentAuthUids,
      p.childAuthUids,
    ];

    candidateArrays.forEach((arr) => {
      const ids = Array.isArray(arr) ? arr : [];
      ids
        .filter(Boolean)
        .map(String)
        .forEach((key) => {
          if (!key) return;
          if (!map[key]) map[key] = v;
        });
    });
  });

  return map;
};

/**
 * ✅ 화면에 표시할 문자열
 * - student.id로 실패하면 student.authUid/uid 등으로도 재시도
 */
export const formatStudentNameWithParentLast4 = (student, parentLast4Map = {}, fallback = '----') => {
  const name = student?.name || '';
  
  const keys = [
    student?.id,
    student?.authUid,
    student?.uid,
    student?.studentUid,
    student?.studentId,
  ]
    .filter(Boolean)
    .map(String);

  let v = '';
  for (const k of keys) {
    v = parentLast4Map[k] || '';
    if (v) break;
  }

  return `${name} (${v || fallback})`;
};