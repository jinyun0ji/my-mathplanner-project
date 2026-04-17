const toFiniteNumber = (value) => {
    if (Number.isFinite(value)) return value;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

export const formatRoundedPercent = (value, suffix = '%') => {
    const numeric = toFiniteNumber(value);
    if (!Number.isFinite(numeric)) return '';
    return `${Math.round(numeric)}${suffix}`;
};

export const formatRoundedScore = (value, digits = 1, suffix = '') => {
    const numeric = toFiniteNumber(value);
    if (!Number.isFinite(numeric)) return '';
    return `${numeric.toFixed(digits)}${suffix}`;
};

export const toRoundedPercentNumber = (value) => {
    const numeric = toFiniteNumber(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.round(numeric);
};