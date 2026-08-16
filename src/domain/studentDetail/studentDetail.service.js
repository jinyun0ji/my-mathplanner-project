import { resolveGradeDisplay, resolveGradeTestId } from '../grade/grade.service';
import {
    buildHomeworkQuestionStats,
    getHomeworkCompletionLabel,
    normalizeHomeworkResultMapForDisplay,
    resolveHomeworkAssignmentId,
    resolveHomeworkAssignmentTitle,
    resolveHomeworkQuestionSummary,
} from '../homework/homework.service';
import { isSameStudentByAnyKey } from '../../utils/studentKey';

export const STUDENT_IDENTITY_FIELDS = [
    'id', 'docId', 'userDocId', 'studentId', 'authUid', 'uid', 'userUid', 'studentUid', 'studentAuthUid',
];

export const getStudentIdentityKeys = (student = {}) => [...new Set(
    STUDENT_IDENTITY_FIELDS.map((field) => student?.[field]).filter(Boolean).map(String),
)];

export const getAssignmentIdentityKeys = (assignment = {}) => [...new Set([
    assignment.id,
    assignment.assignmentId,
    assignment.homeworkAssignmentId,
    assignment.homeworkId,
].filter(Boolean).map(String))];

export const createAssignmentMap = (assignments = []) => {
    const map = new Map();
    assignments.forEach((assignment) => {
        getAssignmentIdentityKeys(assignment).forEach((key) => map.set(key, assignment));
    });
    return map;
};

export const buildGradeRowsForScreen = ({ grades = [], tests = [], classes = [], resolveStats = () => null }) => {
    const testMap = new Map(tests.flatMap((test) => [
        test.id, test.testId, test.examId, test.assessmentId, test.testDocId,
    ].filter(Boolean).map((key) => [String(key), test])));
    const classMap = new Map(classes.flatMap((classDoc) => [
        classDoc.id, classDoc.classId, classDoc.classDocId,
    ].filter(Boolean).map((key) => [String(key), classDoc])));

    return grades.flatMap((grade) => {
        const test = testMap.get(String(resolveGradeTestId(grade)));
        if (!test) return [];
        const classId = test.classId || test.classUid || test.classDocId || test.class?.id || '';
        const classDoc = classMap.get(String(classId));
        const stats = resolveStats(test);
        return [{
            ...grade,
            test,
            classDoc,
            ...resolveGradeDisplay({ grade, test, classDoc }),
            classAverage: stats?.average ?? test?.average ?? null,
            highestScore: stats?.maxScore ?? test?.maxScore ?? null,
            submittedCount: stats?.submittedCount ?? null,
        }];
    });
};

export const buildHomeworkRowsForScreen = ({ results = [], assignments = [], student = {} }) => {
    const assignmentMap = createAssignmentMap(assignments);
    return results.filter((result) => isSameStudentByAnyKey(result, student)).flatMap((result) => {
        const assignmentId = String(resolveHomeworkAssignmentId(result));
        const assignment = assignmentMap.get(assignmentId) || {
            id: assignmentId,
            title: result.assignmentTitle || result.homeworkTitle || result.title || '(과제 정보 없음)',
            questionNumbers: Object.keys(result.results || {}).filter((key) => /^\d+$/.test(key)).map(Number),
            assignedDate: result.assignedDate || result.date || result.createdAt,
            classId: result.classId || result.classDocId,
        };
        const questionNumbers = Array.isArray(assignment.questionNumbers) ? assignment.questionNumbers : [];
        const questionStats = buildHomeworkQuestionStats({ assignment, result });
        const completionLabel = getHomeworkCompletionLabel(questionStats);
        return [{
            ...assignment,
            ...result,
            assignmentTitle: resolveHomeworkAssignmentTitle(assignment),
            status: completionLabel,
            completed: completionLabel === '완료',
            questionSummary: resolveHomeworkQuestionSummary(assignment, result),
            results: normalizeHomeworkResultMapForDisplay(result, questionNumbers, { assignmentId, studentId: student.id }),
        }];
    });
};

// Each identity query owns its cursor. __buffer contains unique, not-yet-rendered rows,
// while __seen prevents a document returned through another alias from being appended twice.
export const collectStudentPage = async ({ pairs, cursors = {}, pageSize, fetchPair, sortRows }) => {
    const nextCursors = { ...cursors };
    const seen = new Set(Array.isArray(cursors.__seen) ? cursors.__seen.map(String) : []);
    let buffer = Array.isArray(cursors.__buffer) ? cursors.__buffer : [];
    buffer.forEach((row) => row?.id && seen.add(String(row.id)));

    while (buffer.length < pageSize) {
        const activePairs = pairs.filter(([field, value]) => nextCursors[`${field}:${value}`] !== null);
        if (!activePairs.length) break;
        const pages = await Promise.all(activePairs.map(async ([field, value]) => {
            const cursorKey = `${field}:${value}`;
            const page = await fetchPair({ field, value, cursor: nextCursors[cursorKey] });
            return { cursorKey, ...page };
        }));
        let advanced = false;
        pages.forEach(({ cursorKey, rows = [], cursor = null, hasMore = false }) => {
            nextCursors[cursorKey] = hasMore ? cursor : null;
            if (rows.length) advanced = true;
            rows.forEach((row) => {
                const id = String(row?.id || '');
                if (!id || seen.has(id)) return;
                seen.add(id);
                buffer.push(row);
            });
        });
        if (!advanced) break;
    }
    buffer = sortRows(buffer);
    const rows = buffer.slice(0, pageSize);
    nextCursors.__buffer = buffer.slice(pageSize);
    nextCursors.__seen = [...seen];
    return {
        rows,
        cursors: nextCursors,
        hasMore: nextCursors.__buffer.length > 0 || pairs.some(([field, value]) => nextCursors[`${field}:${value}`] !== null),
    };
};
