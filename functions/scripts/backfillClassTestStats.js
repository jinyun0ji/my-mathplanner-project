const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const chunkArray = (items, size = 10) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const isCorrect = (v) =>
  v === true || v === 1 || v === '1' || v === 'O' || v === '맞음' || v === '고침';

const getPerQuestionScore = (test, index) => {
  if (Array.isArray(test?.questionScores) && test.questionScores.length > index) {
    const value = Number(test.questionScores[index]);
    if (Number.isFinite(value)) return value;
  }

  if (
    Number.isFinite(test?.maxScore) &&
    Number.isFinite(test?.totalQuestions) &&
    test.totalQuestions > 0
  ) {
    return Number(test.maxScore) / Number(test.totalQuestions);
  }

  return 0;
};

const getAttemptResult = (grade, test) => {
  const answerMap = grade?.correctCount || grade?.answers;
  if (!answerMap || typeof answerMap !== 'object') {
    return { attempted: false, score: null };
  }

  const entries = Object.entries(answerMap);
  if (entries.length === 0) {
    return { attempted: false, score: null };
  }

  let score = 0;
  for (const [qNum, value] of entries) {
    if (!isCorrect(value)) continue;
    const index = Number(qNum) - 1;
    const points = getPerQuestionScore(test, Number.isFinite(index) && index >= 0 ? index : 0);
    score += points;
  }

  return { attempted: true, score };
};

const fetchGradesByField = async ({ testId, studentIds, field }) => {
  const results = [];
  const chunks = chunkArray(studentIds, 10);

  for (const chunk of chunks) {
    const snap = await db
      .collection('grades')
      .where('testId', '==', testId)
      .where(field, 'in', chunk)
      .get();

    snap.docs.forEach((doc) => {
      results.push({ id: doc.id, ...doc.data() });
    });
  }

  return results;
};

async function processTest(testDoc) {
  const test = { id: testDoc.id, ...testDoc.data() };
  const classId = test.classId;
  if (!classId) {
    return;
  }

  const classSnap = await db.collection('classes').doc(classId).get();
  if (!classSnap.exists) {
    return;
  }

  const students = Array.isArray(classSnap.data()?.students)
    ? classSnap.data().students.filter(Boolean)
    : [];

  if (students.length === 0) {
    return;
  }

  const gradeMap = new Map();
  const byAuthUid = await fetchGradesByField({ testId: test.id, studentIds: students, field: 'authUid' });
  byAuthUid.forEach((g) => gradeMap.set(g.id, g));

  const byStudentDocId = await fetchGradesByField({
    testId: test.id,
    studentIds: students,
    field: 'studentDocId',
  });
  byStudentDocId.forEach((g) => gradeMap.set(g.id, g));

  const grades = Array.from(gradeMap.values());
  if (grades.length === 0) {
    return;
  }

  const totalQuestions = Number(test?.totalQuestions) ||
    (Array.isArray(test?.questionScores) ? test.questionScores.length : 0);

  const attemptedScores = [];
  const correctCounts = {};

  grades.forEach((grade) => {
    const { attempted, score } = getAttemptResult(grade, test);
    if (!attempted || !Number.isFinite(score)) {
      return;
    }

    attemptedScores.push(score);

    if (totalQuestions > 0) {
      const answerMap = grade.correctCount || grade.answers || {};
      for (let i = 1; i <= totalQuestions; i++) {
        const value = answerMap[i.toString()];
        if (isCorrect(value)) {
          correctCounts[i] = (correctCounts[i] || 0) + 1;
        }
      }
    }
  });

  const count = attemptedScores.length;
  if (count === 0) {
    return;
  }

  const sum = attemptedScores.reduce((acc, v) => acc + v, 0);
  const average = sum / count;
  const maxScore = Math.max(...attemptedScores);
  const minScore = Math.min(...attemptedScores);
  const variance = attemptedScores.reduce((acc, v) => acc + Math.pow(v - average, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  const correctRates = {};
  if (totalQuestions > 0) {
    for (let i = 1; i <= totalQuestions; i++) {
      const correct = correctCounts[i] || 0;
      correctRates[i] = correct / count;
    }
  }

  const docId = `${classId}_${test.id}`;
  await db
    .collection('classTestStats')
    .doc(docId)
    .set(
      {
        classId,
        testId: test.id,
        count,
        average,
        maxScore,
        minScore,
        stdDev,
        correctRates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

async function backfill() {
  let testsSnap;
  try {
    testsSnap = await db.collection('tests').orderBy('createdAt', 'desc').limit(200).get();
  } catch (err) {
    console.warn('Ordering by createdAt failed, falling back to unordered fetch.', err.message);
    testsSnap = await db.collection('tests').limit(200).get();
  }

  console.log(`Processing ${testsSnap.size} recent tests...`);

  let processed = 0;
  for (const testDoc of testsSnap.docs) {
    await processTest(testDoc);
    processed += 1;
    if (processed % 20 === 0) {
      console.log(`Processed ${processed} tests...`);
    }
  }

  console.log('Backfill complete.');
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