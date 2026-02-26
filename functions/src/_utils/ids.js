const functions = require('firebase-functions');

const requireString = (data, key) => {
    const value = data?.[key];
    if (typeof value === 'string') return value.trim();
    if (value === undefined || value === null) return '';
    return String(value).trim();
};

const assertRequired = (missing) => {
    if (Array.isArray(missing) && missing.length > 0) {
        throw new functions.https.HttpsError('invalid-argument', '필수 값 누락', { missing });
    }
};

const normalizeStudentDocId = (data) => {
    return requireString(data, 'studentDocId') || requireString(data, 'studentId');
};

const normalizeClassId = (data) => {
    return requireString(data, 'classId') || requireString(data, 'classDocId');
};

module.exports = {
    requireString,
    assertRequired,
    normalizeStudentDocId,
    normalizeClassId,
};