const admin = require('firebase-admin');

const shouldWrite = process.argv.includes('--write');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function main() {
  const snapshot = await db.collection('homeworkAssignments').get();
  const targets = snapshot.docs.filter((doc) => {
    const data = doc.data() || {};
    return data.inspectionStatus === undefined || data.inspectionStatus === null || String(data.inspectionStatus).trim() === '';
  });

  console.log(`[backfillHomeworkInspectionStatus] mode=${shouldWrite ? 'write' : 'dry-run'} total=${snapshot.size} missing=${targets.length}`);

  if (!shouldWrite) {
    targets.slice(0, 20).forEach((doc) => console.log(`[dry-run] would update homeworkAssignments/${doc.id}`));
    if (targets.length > 20) console.log(`[dry-run] ...and ${targets.length - 20} more`);
    console.log('[dry-run] No writes performed. Re-run with --write to update documents.');
    return;
  }

  for (let index = 0; index < targets.length; index += 500) {
    const batch = db.batch();
    targets.slice(index, index + 500).forEach((doc) => {
      batch.update(doc.ref, {
        inspectionStatus: 'pending',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'backfillHomeworkInspectionStatus',
      });
    });
    await batch.commit();
    console.log(`[write] updated ${Math.min(index + 500, targets.length)}/${targets.length}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[backfillHomeworkInspectionStatus] failed', error);
    process.exit(1);
  });
