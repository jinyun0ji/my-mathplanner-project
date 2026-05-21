const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp({ credential: applicationDefault() });

const db = getFirestore();
const shouldWrite = process.argv.includes('--write');

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean).map((v) => String(v))));
}

function buildAudienceKeys(data) {
  const isPublic = data?.isPublic === true;
  const targetClasses = uniqueStrings(data?.targetClasses);
  const targetAuthUids = uniqueStrings(data?.targetAuthUids);
  const targetStudents = uniqueStrings(data?.targetStudents);

  if (isPublic) return ['public'];

  return uniqueStrings([
    ...targetClasses.map((id) => `class:${id}`),
    ...targetAuthUids.map((id) => `auth:${id}`),
    ...targetStudents.map((id) => `student:${id}`),
  ]);
}

async function backfillAnnouncementAudienceKeys() {
  const snap = await db.collection('announcements').get();
  console.log(`[audienceKeys backfill] found ${snap.size} announcement documents`);
  console.log(`[audienceKeys backfill] mode: ${shouldWrite ? 'WRITE' : 'DRY-RUN'}`);

  let touched = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const audienceKeys = buildAudienceKeys(data);
    const targetClasses = uniqueStrings(data?.targetClasses);

    const payload = {
      audienceKeys,
      targetClassIds: targetClasses,
      audienceKeysBackfilledAt: FieldValue.serverTimestamp(),
    };

    touched += 1;
    console.log(`[audienceKeys backfill] ${doc.id}`, payload);

    if (shouldWrite) {
      await doc.ref.set(payload, { merge: true });
    }
  }

  console.log(`[audienceKeys backfill] completed. ${shouldWrite ? 'updated' : 'would update'} ${touched} docs.`);
}

backfillAnnouncementAudienceKeys().catch((err) => {
  console.error('[audienceKeys backfill] failed', err);
  process.exit(1);
});