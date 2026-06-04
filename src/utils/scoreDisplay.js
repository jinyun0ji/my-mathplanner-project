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

  if ('score' in recordOrValue) return recordOrValue.score;
  if ('result' in recordOrValue) return recordOrValue.result;
  if ('totalScore' in recordOrValue) return recordOrValue.totalScore;
  if ('studentScore' in recordOrValue) return recordOrValue.studentScore;
  if ('value' in recordOrValue) return recordOrValue.value;
  return null;
};

export const isAbsentScore = (recordOrValue) => {
  if (recordOrValue && typeof recordOrValue === 'object' && !(recordOrValue instanceof Date)) {
    if (recordOrValue.attempted === false) return true;

    const values = [
      recordOrValue.score,
      recordOrValue.result,
      recordOrValue.totalScore,
      recordOrValue.studentScore,
      recordOrValue.value,
    ];

    const hasPresentValue = values.some((value) => value !== undefined && !isScoreEmptyText(value));
    if (hasPresentValue) return false;
    return values.some((value) => isScoreEmptyText(value));
  }

  return isScoreEmptyText(recordOrValue);
};

export const formatNumberOneDecimal = (value, fallback = '-') => {
  const num = toFiniteScoreNumber(value);
  if (num === null) return fallback;
  return num.toFixed(1);
};

export const formatStudentScore = (recordOrValue, options = {}) => {
  const { absentLabel = '미응시', includeUnit = true } = options;
  if (isAbsentScore(recordOrValue)) return absentLabel;

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

export const formatSessionTestScore = (gradeRecord, test = {}) => {
  const maxScore = test?.maxScore ?? test?.totalScore ?? test?.classMax ?? null;
  const maxLabel = formatScoreStat(maxScore, { fallback: '', includeUnit: true });

  if (isAbsentScore(gradeRecord)) {
    return maxLabel ? `미응시 / ${maxLabel}` : '미응시';
  }

  const scoreLabel = formatStudentScore(gradeRecord, { includeUnit: true });
  if (scoreLabel === '미응시') return maxLabel ? `미응시 / ${maxLabel}` : '미응시';
  return maxLabel ? `${scoreLabel} / ${maxLabel}` : scoreLabel;
};
