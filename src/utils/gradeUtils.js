const HIGH_SCHOOL_GRADE_BY_OFFSET = {
  16: '고1',
  17: '고2',
  18: '고3',
};

const BIRTH_YEAR_OFFSET_BY_GRADE = {
  고1: 16,
  고2: 17,
  고3: 18,
};

export const normalizeBirthYear = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const normalized = Number(String(value).trim());
  return Number.isInteger(normalized) && /^\d{4}$/.test(String(normalized)) ? normalized : null;
};

export const getGradeLabelFromBirthYear = (birthYear, baseDate = new Date(), fallbackGrade = '') => {
  const normalizedBirthYear = normalizeBirthYear(birthYear);
  const resolvedDate = baseDate instanceof Date ? baseDate : new Date(baseDate);
  if (normalizedBirthYear && !Number.isNaN(resolvedDate.getTime())) {
    const label = HIGH_SCHOOL_GRADE_BY_OFFSET[resolvedDate.getFullYear() - normalizedBirthYear];
    if (label) return label;
  }
  return String(fallbackGrade || '').trim() || '학년 정보 없음';
};

export const getBirthYearFromGradeLabel = (gradeLabel, baseYear = new Date().getFullYear()) => {
  const offset = BIRTH_YEAR_OFFSET_BY_GRADE[String(gradeLabel || '').trim()];
  const normalizedBaseYear = Number(baseYear);
  return offset && Number.isInteger(normalizedBaseYear) ? normalizedBaseYear - offset : null;
};

export const getStudentGradeLabel = (student, baseDate = new Date()) => (
  getGradeLabelFromBirthYear(student?.birthYear, baseDate, student?.grade)
);
