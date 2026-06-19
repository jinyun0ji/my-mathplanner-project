const admin = require('firebase-admin');
const { calculateClassTestStats } = require('../classTestStats');

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const dryRun = !process.argv.includes('--write');

async function backfillClassTestStats() {
    const testsSnapshot = await db.collection('tests').get();
    console.log(`[classTestStats] ${dryRun ? 'dry run' : 'write'}: ${testsSnapshot.size} tests`);

    for (const testSnapshot of testsSnapshot.docs) {
        const testId = testSnapshot.id;
        const classId = testSnapshot.data()?.classId;
        if (!classId) {
            console.warn('[classTestStats] skipped test without classId', { testId });
            continue;
        }

        const gradesSnapshot = await db.collection('grades').where('testId', '==', testId).get();
        const stats = calculateClassTestStats(gradesSnapshot.docs.map((snapshot) => snapshot.data()));
        const payload = {
            classId,
            testId,
            ...stats,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        console.log('[classTestStats]', {
            testId,
            classId,
            submittedCount: stats.submittedCount,
            absentCount: stats.absentCount,
            average: stats.average,
            maxScore: stats.maxScore,
        });
        if (!dryRun) {
            await db.collection('classTestStats').doc(`${classId}_${testId}`).set(payload, { merge: true });
        }
    }
}

backfillClassTestStats()
    .then(() => {
        console.log('[classTestStats] backfill completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('[classTestStats] backfill failed', error);
        process.exit(1);
    });
