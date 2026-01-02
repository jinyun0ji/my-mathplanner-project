// functions/scripts/migrateGradesStudentAuthUid.js
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

async function main() {
  console.log("[migrateGradesStudentAuthUid] start");

  const gradesRef = db.collection("grades");

  let last = null;
  let processed = 0;
  let updated = 0;

  while (true) {
    let q = gradesRef.orderBy(admin.firestore.FieldPath.documentId()).limit(400);
    if (last) q = q.startAfter(last);

    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();

    for (const docSnap of snap.docs) {
      const g = docSnap.data() || {};

      // 현재 네 구조에서는 g.authUid가 사실상 studentDocId(ullo...)인 케이스가 많음
      const studentDocId = g.studentDocId || g.studentId || g.authUid;
      const testId = g.testId;

      if (!studentDocId || !testId) continue;

      // users/{studentDocId}에서 진짜 authUid(7MR...) 가져오기
      const userSnap = await db.collection("users").doc(studentDocId).get();
      if (!userSnap.exists) continue;

      const user = userSnap.data() || {};
      const studentAuthUid = user.authUid || null;

      // 이미 채워져 있으면 skip
      if (g.studentAuthUid === studentAuthUid && g.studentDocId === studentDocId) {
        processed++;
        continue;
      }

      batch.update(docSnap.ref, {
        studentDocId,
        studentAuthUid,
        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      updated++;
      processed++;
    }

    await batch.commit();
    last = snap.docs[snap.docs.length - 1];

    console.log("[migrateGradesStudentAuthUid] progress", { processed, updated });
  }

  console.log("[migrateGradesStudentAuthUid] done", { processed, updated });
}

main().catch((e) => {
  console.error("[migrateGradesStudentAuthUid] FAILED", e);
  process.exit(1);
});