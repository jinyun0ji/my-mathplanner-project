const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const args = process.argv.slice(2);
const dryRun = !args.includes('--write');
const getArg = (name) => {
  const hit = args.find((arg) => arg.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : '';
};
const onlyTestId = getArg('--testId');
const onlyClassId = getArg('--classId');

const toFiniteScore = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const getQuestionScoresTotal = (test = {}) => {
  if (!Array.isArray(test.questionScores) || test.questionScores.length === 0) return null;
  const scores = test.questionScores.map(toFiniteScore);
  if (scores.some((score) => score === null)) return null;
  return scores.reduce((sum, score) => sum + score, 0);
};

const resolveRepairMaxScore = (test = {}) => {
  const totalScore = toFiniteScore(test.totalScore);
  if (totalScore !== null) return { value: totalScore, source: 'totalScore' };

  const perfectScore = toFiniteScore(test.perfectScore);
  if (perfectScore !== null) return { value: perfectScore, source: 'perfectScore' };

  const questionScoresTotal = getQuestionScoresTotal(test);
  if (questionScoresTotal !== null) return { value: questionScoresTotal, source: 'questionScores' };

  return { value: null, source: '' };
};

async function loadTests() {
  if (onlyTestId) {
    const snap = await db.collection('tests').doc(onlyTestId).get();
    return snap.exists ? [snap] : [];
  }
  const query = onlyClassId ? db.collection('tests').where('classId', '==', onlyClassId) : db.collection('tests');
  const snap = await query.get();
  return snap.docs;
}

async function main() {
  const tests = await loadTests();
  let repaired = 0;
  let skipped = 0;
  console.log(`[repairTestMaxScore] ${dryRun ? 'dry-run' : 'write'} tests=${tests.length} classId=${onlyClassId || '*'} testId=${onlyTestId || '*'}`);

  for (const testDoc of tests) {
    const test = testDoc.data() || {};
    const currentMaxScore = toFiniteScore(test.maxScore);
    const { value, source } = resolveRepairMaxScore(test);

    if (value === null) {
      skipped += 1;
      console.log('[repairTestMaxScore] needs manual review', {
        testId: testDoc.id,
        classId: test.classId || '',
        currentMaxScore,
        totalQuestions: test.totalQuestions ?? null,
        reason: 'No totalScore/perfectScore/questionScores. If totalQuestions exists, maxScore may already be a highest-score value and is not auto-repaired.',
      });
      continue;
    }

    if (currentMaxScore === value) {
      skipped += 1;
      continue;
    }

    repaired += 1;
    console.log('[repairTestMaxScore] repair candidate', {
      testId: testDoc.id,
      classId: test.classId || '',
      from: currentMaxScore,
      to: value,
      source,
    });

    if (!dryRun) {
      await testDoc.ref.set({
        maxScore: value,
        maxScoreRepairedAt: admin.firestore.FieldValue.serverTimestamp(),
        maxScoreRepairSource: source,
      }, { merge: true });
    }
  }

  console.log(`[repairTestMaxScore] complete repaired=${repaired} skipped=${skipped}`);
}

main().catch((error) => {
  console.error('[repairTestMaxScore] failed', error);
  process.exit(1);
});
