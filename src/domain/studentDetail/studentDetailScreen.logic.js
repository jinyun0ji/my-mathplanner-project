import { resolveGradeDisplay, resolveGradeTestId } from '../grade/grade.service';
import {
    buildHomeworkQuestionStats,
    getHomeworkCompletionLabel,
    normalizeHomeworkResultMapForDisplay,
    resolveHomeworkAssignmentId,
    resolveHomeworkAssignmentTitle,
    resolveHomeworkQuestionSummary,
} from '../homework/homework.service';

// These are the pre-print screen joins, kept separate from the print resolver.
export const buildStudentGradeRows = ({ grades, testMap, classMap, classTestStats, getClassId, isClosedClass, resolveClassTestStats }) => (
    grades.flatMap((grade) => {
        const test = testMap.get(String(resolveGradeTestId(grade)));
        if (!test) return [];
        const classDoc = classMap.get(getClassId(test));
        if (!classDoc || classDoc.active === false || isClosedClass(classDoc)) return [];
        const stats = resolveClassTestStats(test, classTestStats);
        return [{
            ...grade,
            test,
            classDoc,
            ...resolveGradeDisplay({ grade, test, classDoc }),
            classAverage: stats?.average ?? test?.average ?? null,
            highestScore: stats?.maxScore ?? test?.maxScore ?? null,
            submittedCount: stats?.submittedCount ?? null,
        }];
    })
);

export const buildStudentHomeworkRows = ({ homeworkResults, assignmentMap, studentId }) => (
    homeworkResults.flatMap((result) => {
        const assignmentId = String(resolveHomeworkAssignmentId(result));
        const assignment = assignmentMap.get(assignmentId);
        if (!assignment) return [];
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
            results: normalizeHomeworkResultMapForDisplay(result, questionNumbers, { assignmentId, studentId }),
        }];
    })
);

export const fetchStudentPageCore = async ({ pairs, cursors = {}, pageSize, fetchPair, mergeRows, sortRows }) => {
    const bufferedRows = Array.isArray(cursors.__buffer) ? cursors.__buffer : [];
    if (bufferedRows.length >= pageSize) {
        return {
            rows: bufferedRows.slice(0, pageSize),
            cursors: { ...cursors, __buffer: bufferedRows.slice(pageSize) },
            hasMore: true,
        };
    }
    const results = await Promise.all(pairs.map(async ([field, value]) => {
        const cursorKey = `${field}:${value}`;
        if (cursors[cursorKey] === null) return { cursorKey, docs: [], cursor: null, hasMore: false };
        return { cursorKey, ...await fetchPair({ field, value, cursor: cursors[cursorKey] }) };
    }));
    const nextCursors = { ...cursors };
    results.forEach((result) => { nextCursors[result.cursorKey] = result.hasMore ? result.cursor : null; });
    const mergedRows = sortRows(mergeRows([bufferedRows, ...results.map((result) => result.docs)]));
    nextCursors.__buffer = mergedRows.slice(pageSize);
    return {
        rows: mergedRows.slice(0, pageSize),
        cursors: nextCursors,
        hasMore: nextCursors.__buffer.length > 0 || results.some((result) => result.hasMore),
    };
};
