import {
    classifyHomeworkResultKeyMode,
    getAssignmentQuestionNumbers,
    normalizeHomeworkResultMapForDisplay,
} from './homework.service';

export const isWrongOrCorrectedAnswer = (value) => {
    return value === '틀림'
        || value === '고침'
        || value === 2
        || value === 3
        || value === '2'
        || value === '3'
        || value === false;
};

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const resolveAssignmentId = (assignment) => {
    return assignment?.id || assignment?.assignmentId || assignment?.homeworkAssignmentId || null;
};

const resolveAssignmentTitle = (assignment) => {
    return assignment?.title ?? assignment?.name ?? assignment?.content ?? '과제';
};

export const normalizeHomeworkTitleForWrongNote = (title) => {
    if (typeof title !== 'string') return '';

    return title.replace(/\s+/g, '').trim();
};

const resolveStudentName = (student) => {
    return student?.name || student?.studentName || '이름없음';
};

const isDevEnvironment = () => (
    (typeof window !== 'undefined' && typeof window.__DEV__ !== 'undefined' && window.__DEV__)
    || process.env.NODE_ENV !== 'production'
);

const unwrapResultMap = (value) => {
    if (!isPlainObject(value)) return {};

    if (isPlainObject(value.results)) {
        return value.results;
    }

    return value;
};

const findAssignmentRecord = (studentHomeworkResults, assignmentId) => {
    if (!isPlainObject(studentHomeworkResults)) return null;

    if (assignmentId && isPlainObject(studentHomeworkResults[assignmentId])) {
        return studentHomeworkResults[assignmentId];
    }

    if (
        assignmentId
        && String(studentHomeworkResults.assignmentId || studentHomeworkResults.homeworkAssignmentId || '') === String(assignmentId)
    ) {
        return studentHomeworkResults;
    }

    const nestedRecord = Object.values(studentHomeworkResults).find((candidate) => {
        if (!isPlainObject(candidate)) return false;
        const candidateAssignmentId = candidate.assignmentId || candidate.homeworkAssignmentId || candidate.id;
        return assignmentId && String(candidateAssignmentId || '') === String(assignmentId);
    });

    return nestedRecord || null;
};

const resolveStudentRecord = (homeworkResults, student, assignmentId) => {
    if (!isPlainObject(homeworkResults)) return null;

    const studentKeys = [
        student?.id,
        student?.studentId,
        student?.authUid,
        student?.studentDocId,
        student?.studentUid,
    ].filter(Boolean).map(String);

    for (const key of studentKeys) {
        const matched = findAssignmentRecord(homeworkResults[key], assignmentId);
        if (matched) return matched;
    }

    return null;
};

export const extractWrongQuestionNumbers = (resultMap, assignmentQuestionNumbers = [], options = {}) => {
    const rawMap = unwrapResultMap(resultMap);
    const normalizedMap = normalizeHomeworkResultMapForDisplay(rawMap, assignmentQuestionNumbers, options);

    return Object.entries(normalizedMap)
        .filter(([, value]) => isWrongOrCorrectedAnswer(value))
        .map(([key]) => Number(key))
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);
};

export const buildHomeworkWrongNoteText = ({
    assignment,
    students = [],
    homeworkResults = {},
    includeStudentsWithoutWrong = false,
}) => {
    const assignmentId = resolveAssignmentId(assignment);
    const assignmentTitle = normalizeHomeworkTitleForWrongNote(resolveAssignmentTitle(assignment));
    const assignmentQuestionNumbers = getAssignmentQuestionNumbers(assignment);

    return students
        .map((student) => {
            const studentName = resolveStudentName(student);
            const record = resolveStudentRecord(homeworkResults, student, assignmentId);
            const rawResultMap = unwrapResultMap(record);
            const normalizedResultMap = normalizeHomeworkResultMapForDisplay(rawResultMap, assignmentQuestionNumbers, {
                assignmentId,
                studentId: student?.id || student?.studentId || student?.authUid,
            });

            if (isDevEnvironment()) {
                console.log('[homework wrong-note debug]', {
                    studentName,
                    assignmentId,
                    rawKeys: Object.keys(rawResultMap || {}),
                    normalizedKeys: Object.keys(normalizedResultMap || {}),
                    mode: classifyHomeworkResultKeyMode(rawResultMap, assignmentQuestionNumbers),
                });
            }

            const wrongNumbers = extractWrongQuestionNumbers(normalizedResultMap, assignmentQuestionNumbers, {
                assignmentId,
                studentId: student?.id || student?.studentId || student?.authUid,
            });

            if (wrongNumbers.length === 0 && !includeStudentsWithoutWrong) {
                return null;
            }

            const suffix = wrongNumbers.length > 0 ? `,${wrongNumbers.join(',')}` : '';
            return `${studentName}_${assignmentTitle}${suffix}`;
        })
        .filter(Boolean)
        .join('\n');
};