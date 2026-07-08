const ABSENT_SCORE_TEXT_VALUES = new Set(['', '미응시', '미입력']);

export const isScoreEmptyText = (value) => (
  value === null
  || value === undefined
  || (typeof value === 'string' && ABSENT_SCORE_TEXT_VALUES.has(value.trim()))
);

export const toFiniteScoreNumber = (value) => {
  if (isScoreEmptyText(value)) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const pickScoreValue = (recordOrValue) => {
  if (!recordOrValue || typeof recordOrValue !== 'object' || recordOrValue instanceof Date) {
    return recordOrValue;
  }

  const scoreKeys = ['score', 'totalScore', 'result', 'studentScore', 'value'];
  const existingValues = scoreKeys
    .filter((key) => key in recordOrValue)
    .map((key) => recordOrValue[key]);
  const presentValue = existingValues.find((value) => !isScoreEmptyText(value));
  return presentValue !== undefined ? presentValue : (existingValues[0] ?? null);
};

export const isAbsentGradeRecord = (recordOrValue) => {
  if (recordOrValue && typeof recordOrValue === 'object' && !(recordOrValue instanceof Date)) {
    if (recordOrValue.attempted === false) return true;

    const checkedValues = [
      recordOrValue.result,
      recordOrValue.score,
      recordOrValue.totalScore,
    ];

    const hasCheckedField = checkedValues.some((value) => value !== undefined);
    const checkedFieldsAreAbsent = hasCheckedField
      ? checkedValues
        .filter((value) => value !== undefined)
        .every((value) => isScoreEmptyText(value))
      : true;

    if (!checkedFieldsAreAbsent) return false;

    const fallbackValues = [
      recordOrValue.studentScore,
      recordOrValue.value,
    ];
    const hasFallbackScore = fallbackValues.some((value) => value !== undefined && !isScoreEmptyText(value));
    return !hasFallbackScore;
  }

  return isScoreEmptyText(recordOrValue);
};

export const isAbsentScore = isAbsentGradeRecord;

export const formatNumberOneDecimal = (value, fallback = '-') => {
  const num = toFiniteScoreNumber(value);
  if (num === null) return fallback;
  return num.toFixed(1);
};

export const formatStudentScore = (recordOrValue, options = {}) => {
  const { absentLabel = '미응시', includeUnit = true } = options;
  if (isAbsentGradeRecord(recordOrValue)) return absentLabel;

  const score = toFiniteScoreNumber(pickScoreValue(recordOrValue));
  if (score === null) return absentLabel;

  const label = score.toFixed(1);
  return includeUnit ? `${label}점` : label;
};

export const formatScoreStat = (value, options = {}) => {
  const { fallback = '통계 준비 중', includeUnit = false } = options;
  const label = formatNumberOneDecimal(value, fallback);
  if (label === fallback) return label;
  return includeUnit ? `${label}점` : label;
};

const firstFiniteScore = (...values) => {
  for (const value of values) {
    const score = toFiniteScoreNumber(value);
    if (score !== null) return score;
  }
  return null;
};

export const getTestStatsForDisplay = (test = {}, classTestStats = {}, gradeRecord = {}) => {
  const stats = classTestStats?.[`${test?.classId}_${test?.id}`] || classTestStats?.[test?.id] || null;

  return {
    average: firstFiniteScore(
      gradeRecord?.average,
      gradeRecord?.classAverage,
      stats?.average,
      test?.average,
      test?.classAverage,
    ),
    highest: firstFiniteScore(
      stats?.maxScore,
      stats?.highestScore,
      stats?.classMax,
      test?.classMax,
      test?.highestScore,
      test?.highScore,
    ),
    submittedCount: firstFiniteScore(stats?.submittedCount, stats?.attemptedCount, stats?.count),
    perfect: firstFiniteScore(
      test?.maxScore,
      test?.totalScore,
      test?.perfectScore,
    ),
  };
};

export const buildTestStatParts = (stats = {}, options = {}) => {
  const { includeUnit = true } = options;
  return [
    ['평균', stats.average, includeUnit],
    ['최고', stats.highest, includeUnit],
    ['응시자', stats.submittedCount, false],
    ['만점', stats.perfect, includeUnit],
  ]
    .map(([label, value, partIncludesUnit]) => {
      const formatted = formatScoreStat(value, { fallback: '', includeUnit: partIncludesUnit });
      return formatted ? `${label} ${formatted}` : '';
    })
    .filter(Boolean);
};

export const formatTestStatsInline = (stats = {}, options = {}) => (
  buildTestStatParts(stats, options).join(' · ')
);

export const buildTestDisplayLines = ({ title, gradeRecord, stats = {} }) => ([
  title,
  `학생: ${formatStudentScore(gradeRecord, { includeUnit: true })}`,
  ...buildTestStatParts(stats, { includeUnit: true }).map((part) => part.replace(' ', ': ')),
]);

export const formatSessionTestScore = (gradeRecord, test = {}, classTestStats = {}) => {
  const stats = getTestStatsForDisplay(test, classTestStats);
  const scoreLabel = formatStudentScore(gradeRecord, { includeUnit: true });
  const statParts = buildTestStatParts(stats, { includeUnit: true });
  return [scoreLabel, ...statParts].join(' · ');
};
