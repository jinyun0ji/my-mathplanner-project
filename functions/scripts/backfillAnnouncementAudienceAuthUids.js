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

async function loadReferenceMaps() {
  const studentsByClassId = new Map();
  const studentAuthByDocId = new Map();
  const parentAuthByStudentId = new Map();

  const classSnap = await db.collection('classes').get();
  classSnap.docs.forEach((classDoc) => {
    const data = classDoc.data() || {};
    const classKeys = uniqueStrings([classDoc.id, data.id, data.classId, data.classCode]);
    const students = uniqueStrings(data.students);
    classKeys.forEach((classId) => {
      if (!studentsByClassId.has(classId)) studentsByClassId.set(classId, new Set());
      const bucket = studentsByClassId.get(classId);
      students.forEach((studentId) => bucket.add(studentId));
    });
  });

  const usersSnap = await db.collection('users').get();
  usersSnap.docs.forEach((userDoc) => {
    const data = userDoc.data() || {};
    const role = String(data.role || '').toLowerCase();

    if (role === 'student') {
      const classIds = uniqueStrings([
        data.classId,
        data.classDocId,
        data.classCode,
        ...(Array.isArray(data.classIds) ? data.classIds : []),
      ]);
      const studentDocId = String(userDoc.id);
      const authUid = String(data.authUid || data.uid || '').trim();
      if (authUid) studentAuthByDocId.set(studentDocId, authUid);

      classIds.forEach((classId) => {
        if (!studentsByClassId.has(classId)) studentsByClassId.set(classId, new Set());
        studentsByClassId.get(classId).add(studentDocId);
      });
      return;
    }

    if (role === 'parent') {
      const parentAuthUid = String(data.authUid || data.uid || '').trim();
      if (!parentAuthUid) return;
      uniqueStrings(data.studentIds).forEach((studentDocId) => {
        if (!parentAuthByStudentId.has(studentDocId)) parentAuthByStudentId.set(studentDocId, new Set());
        parentAuthByStudentId.get(studentDocId).add(parentAuthUid);
      });
    }
  });

  return { studentsByClassId, studentAuthByDocId, parentAuthByStudentId };
}

async function run() {
  const { studentsByClassId, studentAuthByDocId, parentAuthByStudentId } = await loadReferenceMaps();
  const announcementSnap = await db.collection('announcements').get();

  console.log(`[audience backfill] announcements=${announcementSnap.size}`);
  console.log(`[audience backfill] mode=${shouldWrite ? 'WRITE' : 'DRY-RUN'}`);

  let touched = 0;
  for (const announcementDoc of announcementSnap.docs) {
    const data = announcementDoc.data() || {};
    const isPublic = data.isPublic === true;
    const normalizedClassIds = uniqueStrings(
      Array.isArray(data.targetClassIds) && data.targetClassIds.length > 0
        ? data.targetClassIds
        : data.targetClasses,
    );

    const beforeAudienceAuthUids = uniqueStrings(data.audienceAuthUids);
    const audienceSet = new Set();
    const addedParentAuthUids = new Set();
    const addedStudentAuthUids = new Set();
    const removedNonAuthIds = new Set(
      beforeAudienceAuthUids.filter((value) => !String(value || '').includes('-') && String(value || '').length < 20),
    );
    if (!isPublic) {
      const studentDocIds = new Set();
      normalizedClassIds.forEach((classId) => {
        (studentsByClassId.get(classId) || new Set()).forEach((studentDocId) => {
          studentDocIds.add(studentDocId);
        });
      });

      studentDocIds.forEach((studentDocId) => {
        const studentAuthUid = studentAuthByDocId.get(studentDocId);
        if (studentAuthUid) {
          audienceSet.add(studentAuthUid);
          addedStudentAuthUids.add(studentAuthUid);
        }
        (parentAuthByStudentId.get(studentDocId) || new Set()).forEach((parentAuthUid) => {
          audienceSet.add(parentAuthUid);
          addedParentAuthUids.add(parentAuthUid);
        });
      });
    }

    const afterAudienceAuthUids = isPublic ? [] : uniqueStrings([...audienceSet]);

    const payload = {
      targetClassIds: normalizedClassIds,
      audienceAuthUids: afterAudienceAuthUids,
      audienceBackfilledAt: FieldValue.serverTimestamp(),
    };

    touched += 1;
    console.log('[audience backfill]', {
      announcementId: announcementDoc.id,
      title: String(data.title || ''),
      beforeAudienceAuthUids,
      afterAudienceAuthUids,
      addedParentAuthUids: uniqueStrings([...addedParentAuthUids]),
      addedStudentAuthUids: uniqueStrings([...addedStudentAuthUids]),
      removedNonAuthIds: uniqueStrings([...removedNonAuthIds]),
    });
    if (shouldWrite) await announcementDoc.ref.set(payload, { merge: true });
  }

  console.log(`[audience backfill] complete. ${shouldWrite ? 'updated' : 'would update'}=${touched}`);
}

run().catch((error) => {
  console.error('[audience backfill] failed', error);
  process.exit(1);
});