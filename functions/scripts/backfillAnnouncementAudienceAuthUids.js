const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const shouldWrite = process.argv.includes('--write');

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((v) => String(v || '').trim())
    .filter(Boolean)));
}

async function loadStudentsByClassId() {
  const out = new Map();

  const classSnap = await db.collection('classes').get();
  classSnap.docs.forEach((doc) => {
    const data = doc.data() || {};
    const classIds = uniqueStrings([doc.id, data.id, data.classId, data.classCode]);
    const studentIds = uniqueStrings(data.students);
    classIds.forEach((cid) => {
      if (!out.has(cid)) out.set(cid, new Set());
      const bucket = out.get(cid);
      studentIds.forEach((sid) => bucket.add(sid));
    });
  });

  const usersSnap = await db.collection('users').get();
  const students = [];
  const parents = [];

  usersSnap.docs.forEach((doc) => {
    const data = doc.data() || {};
    const role = String(data.role || '').toLowerCase();
    if (role === 'parent') {
      parents.push({ id: doc.id, authUid: data.authUid || data.uid, studentIds: uniqueStrings(data.studentIds) });
      return;
    }

    const classIds = uniqueStrings([data.classId, data.classDocId, ...(Array.isArray(data.classIds) ? data.classIds : [])]);
    const studentId = String(doc.id);
    students.push({ id: studentId, authUid: data.authUid || data.uid || null, classIds });
    classIds.forEach((cid) => {
      if (!out.has(cid)) out.set(cid, new Set());
      out.get(cid).add(studentId);
    });
  });

  return { studentsByClassId: out, students, parents };
}

async function run() {
  const { studentsByClassId, students, parents } = await loadStudentsByClassId();
  const studentAuthByDocId = new Map(students.map((s) => [s.id, s.authUid ? String(s.authUid) : null]));
  const parentAuthByStudentId = new Map();

  parents.forEach((p) => {
    const authUid = p.authUid ? String(p.authUid).trim() : '';
    if (!authUid) return;
    p.studentIds.forEach((sid) => {
      if (!parentAuthByStudentId.has(sid)) parentAuthByStudentId.set(sid, new Set());
      parentAuthByStudentId.get(sid).add(authUid);
    });
  });

  const snap = await db.collection('announcements').get();
  console.log(`[audienceAuthUids backfill] found ${snap.size} announcement documents`);
  console.log(`[audienceAuthUids backfill] mode: ${shouldWrite ? 'WRITE' : 'DRY-RUN'}`);

  let touched = 0;
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const isPublic = data.isPublic === true;
    const targetClasses = uniqueStrings(data.targetClasses);
    const audienceSet = new Set();

    if (!isPublic) {
      const studentDocIds = new Set();
      targetClasses.forEach((cid) => {
        (studentsByClassId.get(cid) || new Set()).forEach((sid) => studentDocIds.add(sid));
      });

      studentDocIds.forEach((sid) => {
        const studentAuth = studentAuthByDocId.get(sid);
        if (studentAuth && studentAuth.trim()) audienceSet.add(studentAuth.trim());
        (parentAuthByStudentId.get(sid) || new Set()).forEach((puid) => audienceSet.add(String(puid).trim()));
      });
    }

    const audienceAuthUids = uniqueStrings([...audienceSet]);
    const payload = {
      audienceAuthUids,
      audienceAuthUidsBackfilledAt: FieldValue.serverTimestamp(),
    };

    touched += 1;
    console.log(`[audienceAuthUids backfill] ${doc.id}`, payload);
    if (shouldWrite) await doc.ref.set(payload, { merge: true });
  }

  console.log(`[audienceAuthUids backfill] completed. ${shouldWrite ? 'updated' : 'would update'} ${touched} docs.`);
}

run().catch((err) => {
  console.error('[audienceAuthUids backfill] failed', err);
  process.exit(1);
});