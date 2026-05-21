const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({ credential: applicationDefault() });

const db = getFirestore();

async function backfillAnnouncements() {
    const snap = await db.collection('announcements').get();
    console.log(`[backfill] found ${snap.size} announcement documents`);

    let updated = 0;
    for (const doc of snap.docs) {
        const data = doc.data() || {};
        const targetClasses = Array.isArray(data.targetClasses) ? data.targetClasses : [];
        const targetStudents = Array.isArray(data.targetStudents) ? data.targetStudents : [];
        const hasClassTargets = targetClasses.length > 0;

        const inferredIsPublic = data.isPublic === undefined
            ? !hasClassTargets && targetStudents.length === 0
            : data.isPublic;

        const needsIsPublic = data.isPublic !== inferredIsPublic;

        if (!needsIsPublic) continue;

        await doc.ref.set({ isPublic: inferredIsPublic }, { merge: true });
        updated += 1;
        console.log(`[backfill] updated ${doc.id} -> isPublic=${inferredIsPublic}`);
    }

    console.log(`[backfill] completed. updated ${updated} docs.`);
}

backfillAnnouncements().catch((err) => {
    console.error('[backfill] failed', err);
    process.exit(1);
});