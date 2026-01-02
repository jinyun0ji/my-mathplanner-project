// functions/classTestStatsTrigger.js
// grades -> classTestStats (avg/max/min/stdDev + per-question correctRates + rank)
// - 미응시(점수 null/undefined, 또는 답안 없음)는 통계에서 제외
// - rank는 studentDocId(ullo...) 기준으로 저장 (프론트 매칭용)

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const chunkArray = (arr, size = 10) => {
  const out = [];
  for (let i = 0; i < (arr || []).length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const isCorrect = (v) => {
  return (
    v === true ||
    v === 1 ||
    v === '1' ||
    v === 'O' ||
    v === 'o' ||
    v === '맞음' ||
    v === '고침' ||
    v === '정답' ||
    v === 'correct'
  );
};

const safeNum = (v) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const toInt = (v, fallback = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

// grade에서 학생 키를 꺼낼 때: 가능한 한 studentDocId(ullo...)를 사용
const pickStudentDocId = (grade) => {
  // 신규 필드가 있다면 우선
  if (grade && typeof grade.studentDocId === 'string' && grade.studentDocId) return grade.studentDocId;

  // 기존 프로젝트에서 grade.authUid에 studentDocId가 들어가는 케이스가 많음
  if (grade && typeof grade.authUid === 'string' && grade.authUid) return grade.authUid;

  // 혹시 남아있는 레거시
  if (grade && typeof grade.studentUid === 'string' && grade.studentUid) return grade.studentUid;
  if (grade && typeof grade.studentId === 'string' && grade.studentId) return grade.studentId;

  return null;
};

// 시험 배점 배열(문항별 점수) 만들기
const getQuestionScores = (test) => {
  const totalQuestions = toInt(test?.totalQuestions, 0);
  const maxScore = safeNum(test?.maxScore) ?? 100;

  if (Array.isArray(test?.questionScores) && test.questionScores.length >= totalQuestions) {
    // questionScores는 0-based array로 가정
    return test.questionScores.map((x) => safeNum(x) ?? 0);
  }

  // fallback: maxScore / totalQuestions
  if (totalQuestions > 0) {
    const each = maxScore / totalQuestions;
    return Array.from({ length: totalQuestions }).map(() => each);
  }

  return [];
};

// grade에서 점수 구하기(우선순위: totalScore -> score -> 배점합산 계산)
const getScore = (grade, test, questionScores) => {
  const t = safeNum(grade?.totalScore);
  if (t !== null) return t;

  const s = safeNum(grade?.score);
  if (s !== null) return s;

  // correctCount 기반 배점 합산
  const correctCount = grade?.correctCount;
  if (!correctCount || typeof correctCount !== 'object') return null;

  const totalQuestions = toInt(test?.totalQuestions, 0);
  if (totalQuestions <= 0) return null;

  let sum = 0;
  for (let i = 1; i <= totalQuestions; i++) {
    const key = String(i);
    const v = correctCount[key];
    if (isCorrect(v)) sum += safeNum(questionScores[i - 1]) ?? 0;
  }

  // 합산 결과가 0일 수도 있으니 null로 취급하면 안 됨
  return Number.isFinite(sum) ? sum : null;
};

// grade가 “시도함(채점 대상)”인지 판단
const hasAttempted = (grade, test, questionScores) => {
  const score = getScore(grade, test, questionScores);
  if (score === null) return false;

  // 추가 안전장치: correctCount가 비어있는 경우를 미시도로 볼지 결정
  // 점수가 있으면 attempted로 본다.
  return true;
};

// 통계 계산
const calcStats = (scores) => {
  const n = scores.length;
  if (n === 0) {
    return { count: 0, average: null, maxScore: null, minScore: null, stdDev: null };
  }

  let sum = 0;
  let max = -Infinity;
  let min = Infinity;

  for (const x of scores) {
    sum += x;
    if (x > max) max = x;
    if (x < min) min = x;
  }

  const avg = sum / n;

  // population std dev
  let varSum = 0;
  for (const x of scores) {
    const d = x - avg;
    varSum += d * d;
  }
  const stdDev = Math.sqrt(varSum / n);

  // UI에서 쓰기 편하게 소수 1자리로
  const round1 = (v) => (v === null ? null : Math.round(v * 10) / 10);

  return {
    count: n,
    average: round1(avg),
    maxScore: round1(max),
    minScore: round1(min),
    stdDev: round1(stdDev),
  };
};

exports.onGradesWriteUpdateClassTestStats = functions
  .region('us-central1')
  .firestore.document('grades/{gradeId}')
  .onWrite(async (change, context) => {
    const after = change.after.exists ? (change.after.data() || {}) : null;
    const before = change.before.exists ? (change.before.data() || {}) : null;

    const testId = (after && after.testId) || (before && before.testId) || null;
    if (!testId) {
      console.warn('[classTestStatsTrigger] no testId', { gradeId: context.params.gradeId });
      return null;
    }

    const testSnap = await db.collection('tests').doc(testId).get();
    if (!testSnap.exists) {
      console.warn('[classTestStatsTrigger] test not found', { testId });
      return null;
    }

    const test = testSnap.data() || {};
    const classId = test.classId || null;
    if (!classId) {
      console.warn('[classTestStatsTrigger] test has no classId', { testId });
      return null;
    }

    const classSnap = await db.collection('classes').doc(classId).get();
    if (!classSnap.exists) {
      console.warn('[classTestStatsTrigger] class not found', { classId, testId });
      return null;
    }

    const classData = classSnap.data() || {};
    const students = Array.isArray(classData.students) ? classData.students.filter(Boolean) : [];
    if (students.length === 0) {
      console.warn('[classTestStatsTrigger] class has no students', { classId, testId });
      // 학생이 없으면 빈 stats라도 남겨두는게 낫다
    }

    const questionScores = getQuestionScores(test);
    const totalQuestions = toInt(test.totalQuestions, questionScores.length);

    // grades 수집 (testId 고정 + 학생 in 쿼리)
    const chunks = chunkArray(students, 10);
    const docs = new Map(); // docId -> grade data

    // 1) authUid 필드에 studentDocId가 들어있는 케이스
    for (const ids of chunks) {
      if (ids.length === 0) continue;
      const snap = await db
        .collection('grades')
        .where('testId', '==', testId)
        .where('authUid', 'in', ids)
        .get();

      snap.docs.forEach((d) => docs.set(d.id, { id: d.id, ...d.data() }));
    }

    // 2) studentDocId 필드를 쓰는 케이스(있을 때만 추가 커버)
    for (const ids of chunks) {
      if (ids.length === 0) continue;
      const snap = await db
        .collection('grades')
        .where('testId', '==', testId)
        .where('studentDocId', 'in', ids)
        .get();

      snap.docs.forEach((d) => docs.set(d.id, { id: d.id, ...d.data() }));
    }

    const grades = Array.from(docs.values());

    // attempted grades만 필터 + 점수 계산
    const attempted = [];
    const scoreList = [];

    // 문항별 정답률 계산용
    const correctCounts = Array.from({ length: totalQuestions }).map(() => 0);
    const attemptCounts = Array.from({ length: totalQuestions }).map(() => 0);

    for (const g of grades) {
      if (!hasAttempted(g, test, questionScores)) continue;

      const studentDocId = pickStudentDocId(g);
      if (!studentDocId) continue;

      const score = getScore(g, test, questionScores);
      if (score === null) continue;

      attempted.push({ studentId: studentDocId, score, grade: g });
      scoreList.push(score);

      // 문항별 정오답 집계 (attempted만 분모로 사용)
      const cc = g.correctCount && typeof g.correctCount === 'object' ? g.correctCount : null;
      if (cc && totalQuestions > 0) {
        for (let i = 1; i <= totalQuestions; i++) {
          const key = String(i);
          if (!(key in cc)) continue; // 해당 문항 데이터가 없으면 분모에 포함하지 않음(보수적으로)
          attemptCounts[i - 1] += 1;
          if (isCorrect(cc[key])) correctCounts[i - 1] += 1;
        }
      }
    }

    const attemptedCount = attempted.length;

    // stats
    const baseStats = calcStats(scoreList);

    // correctRates: 0..1
    const correctRates = {};
    for (let i = 1; i <= totalQuestions; i++) {
      const denom = attemptCounts[i - 1] || 0;
      const numer = correctCounts[i - 1] || 0;
      correctRates[String(i)] = denom > 0 ? Math.round((numer / denom) * 1000) / 1000 : 0; // 소수 3자리
    }

    // rank (dense rank)
    attempted.sort((a, b) => b.score - a.score);

    let lastScore = null;
    let currentRank = 0;

    const rank = attempted.map((item, index) => {
      if (lastScore === null || item.score < lastScore) {
        currentRank = index + 1;
        lastScore = item.score;
      }
      return { studentId: item.studentId, score: item.score, rank: currentRank };
    });

    const docId = `${classId}_${testId}`;
    await db
      .collection('classTestStats')
      .doc(docId)
      .set(
        {
          classId,
          testId,

          // attempted only
          attemptedCount,

          // summary stats
          average: baseStats.average,
          maxScore: baseStats.maxScore,
          minScore: baseStats.minScore,
          stdDev: baseStats.stdDev,

          // per-question
          correctRates,

          // ranking
          rank,

          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    console.log('[classTestStatsTrigger] updated', {
      classId,
      testId,
      docId,
      attemptedCount,
      gradesFetched: grades.length,
    });

    return null;
  });