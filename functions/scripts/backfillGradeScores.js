const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

const isCorrect = (v) =>
  v === true || v === 1 || v === '1' || v === 'O' || v === '맞음' || v === '고침';

const computeWeightedScore = (resultMap, test) => {
  if (!resultMap || typeof resultMap !== 'object') return null;
  const entries = Object.entries(resultMap);
  if (entries.length === 0) return null;

  const qs = Array.isArray(test?.questionScores) ? test.questionScores : null;
  const fallback =
    Number.isFinite(test?.maxScore) &&
    Number.isFinite(test?.totalQuestions) &&
    test.totalQuestions > 0
      ? test.maxScore / test.totalQuestions
      : 0;

  let total = 0;
  for (const [qNum, v] of entries) {
    if (!isCorrect(v)) continue;
    const idx = Number(qNum) - 1;
    const points = qs && Number.isFinite(Number(qs[idx])) ? Number(qs[idx]) : fallback;
    total += points;
  }
  return total;
};

const getTestById = (() => {
  const cache = new Map();
  return async (testId) => {
    if (!testId) return null;
    if (cache.has(testId)) return cache.get(testId);
    const snapshot = await db.collection('tests').doc(testId).get();
    const data = snapshot.exists ? { id: testId, ...snapshot.data() } : null;
    cache.set(testId, data);
    return data;
  };
})();

async function backfill() {
  const gradesSnap = await db.collection('grades').get();
  console.log(`Found ${gradesSnap.size} grade documents.`);

  let batch = db.batch();
  let writes = 0;
  const commitBatch = async () => {
    if (writes === 0) return;
    await batch.commit();
    batch = db.batch();
    writes = 0;
  };

  for (const gradeDoc of gradesSnap.docs) {
    const data = gradeDoc.data();
    const correctCount = data.correctCount;
    const hasResult =
      correctCount && typeof correctCount === 'object' && Object.keys(correctCount).length > 0;

    let score = null;
    let totalScore = null;
    let attempted = false;
    let normalizedCorrectCount = {};

    if (hasResult) {
      const test = await getTestById(data.testId);
      const computedScore = computeWeightedScore(correctCount, test);
      score = computedScore;
      totalScore = computedScore;
      attempted = true;
      normalizedCorrectCount = correctCount;
    }

    batch.update(gradeDoc.ref, {
      score,
      totalScore,
      attempted,
      correctCount: normalizedCorrectCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    writes += 1;

    if (writes >= 450) {
      await commitBatch();
    }
  }

  await commitBatch();
  console.log('Backfill completed.');
}

backfill()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });