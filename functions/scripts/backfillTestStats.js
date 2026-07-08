const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const args = process.argv.slice(2);
const dryRun = !args.includes('--write');
const getArg = (name) => {
  const hit = args.find((arg) => arg.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : '';
};
const onlyClassId = getArg('--classId');
const onlyTestId = getArg('--testId');

const toFiniteScore = (value) => {
  if (value === null || value === undefined || value === '' || value === '미응시' || value === '미입력') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const isCorrect = (value) => [true, 1, '1', 'O', 'o', '맞음', '고침', '정답', 'correct'].includes(value);
const isAbsentGrade = (grade = {}) => (
  grade.attempted === false
  || grade.isAbsent === true
  || grade.absent === true
  || ['미응시', '미입력'].includes(String(grade.result || '').trim())
  || ['미응시', '미입력'].includes(String(grade.status || '').trim())
);
const getQuestionScores = (test = {}) => {
  const totalQuestions = Number.parseInt(test.totalQuestions, 10) || 0;
  const maxScore = toFiniteScore(test.maxScore) ?? 100;
  if (Array.isArray(test.questionScores) && test.questionScores.length >= totalQuestions) {
    return test.questionScores.map((score) => toFiniteScore(score) ?? 0);
  }
  return totalQuestions > 0 ? Array.from({ length: totalQuestions }, () => maxScore / totalQuestions) : [];
};
const getGradeScore = (grade = {}, test = {}, questionScores = []) => {
  const saved = toFiniteScore(grade.totalScore) ?? toFiniteScore(grade.score) ?? toFiniteScore(grade.result);
  if (saved !== null) return saved;
  const correctCount = grade.correctCount;
  const totalQuestions = Number.parseInt(test.totalQuestions, 10) || questionScores.length;
  if (!correctCount || typeof correctCount !== 'object' || totalQuestions <= 0) return null;
  let total = 0;
  for (let i = 1; i <= totalQuestions; i += 1) {
    if (isCorrect(correctCount[String(i)])) total += questionScores[i - 1] || 0;
  }
  return Number.isFinite(total) ? total : null;
};
const round1 = (value) => (value === null ? null : Math.round(value * 10) / 10);

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
  console.log(`[testStats] ${dryRun ? 'dry-run' : 'write'} tests=${tests.length} classId=${onlyClassId || '*'} testId=${onlyTestId || '*'}`);
  for (const testDoc of tests) {
    const testId = testDoc.id;
    const test = testDoc.data() || {};
    const gradesSnap = await db.collection('grades').where('testId', '==', testId).get();
    const questionScores = getQuestionScores(test);
    const scores = gradesSnap.docs
      .map((doc) => doc.data() || {})
      .filter((grade) => !isAbsentGrade(grade))
      .map((grade) => getGradeScore(grade, test, questionScores))
      .filter((score) => score !== null);
    const submittedCount = scores.length;
    const classAverage = submittedCount ? round1(scores.reduce((sum, score) => sum + score, 0) / submittedCount) : null;
    const highestScore = submittedCount ? round1(Math.max(...scores)) : null;
    const payload = {
      classAverage,
      average: classAverage,
      highestScore,
      maxScore: highestScore,
      submittedCount,
      statsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    console.log('[testStats]', { testId, classId: test.classId || '', classAverage, highestScore, submittedCount, sourceGrades: gradesSnap.size });
    if (!dryRun) {
      await testDoc.ref.set(payload, { merge: true });
      if (test.classId) {
        await db.collection('classTestStats').doc(`${test.classId}_${testId}`).set({
          classId: test.classId,
          testId,
          average: classAverage,
          maxScore: highestScore,
          highestScore,
          submittedCount,
          attemptedCount: submittedCount,
          count: submittedCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }
  }
  console.log(`[testStats] ${dryRun ? 'dry-run completed' : 'write completed'}`);
}

main().catch((error) => {
  console.error('[testStats] failed', error);
  process.exit(1);
});
