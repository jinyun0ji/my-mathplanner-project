import { resolveGradeDisplay, resolveGradeTestId } from '../grade/grade.service';
import {
    buildHomeworkQuestionStats,
    getHomeworkCompletionLabel,
    normalizeHomeworkResultMapForDisplay,
    resolveHomeworkAssignmentId,
    resolveHomeworkAssignmentTitle,
    resolveHomeworkQuestionSummary,
} from '../homework/homework.service';

const hasHomeworkTitleMetadata = (record = {}) => Boolean(
    record.book || record.title || record.name || record.assignmentTitle
    || record.assignmentName || record.homeworkName || record.content
);

// These are the pre-print screen joins, kept separate from the print resolver.
export const buildStudentGradeRows = ({ grades, testMap, classMap, classTestStats, getClassId, isClosedClass, resolveClassTestStats, logger }) => (
    grades.flatMap((grade) => {
        const testId = String(resolveGradeTestId(grade));
        const test = testMap.get(testId);
        const testClassId = test ? getClassId(test) : '';
        const classDoc = testClassId ? classMap.get(testClassId) : undefined;
        const included = Boolean(test);
        logger?.({
            gradeId: grade.id,
            testId,
            testFound: Boolean(test),
            testClassId,
            classFound: Boolean(classDoc),
            classActive: classDoc?.active,
            classClosed: classDoc ? isClosedClass(classDoc) : false,
            included,
            exclusionReason: included ? '' : 'test-not-found',
        });
        if (!test) return [];
        const stats = resolveClassTestStats(test, classTestStats);
        return [{
            ...grade,
            test,
            classDoc,
            ...resolveGradeDisplay({ grade, test, classDoc }),
            className: classDoc?.name || classDoc?.className || classDoc?.title
                || test.className || grade.className || '(클래스 미상)',
            classAverage: stats?.average ?? test?.average ?? null,
            highestScore: stats?.maxScore ?? test?.maxScore ?? null,
            submittedCount: stats?.submittedCount ?? null,
        }];
    })
);

export const buildStudentHomeworkRows = ({ homeworkResults, assignmentMap, studentId, logger }) => (
    homeworkResults.flatMap((result) => {
        const assignmentId = String(resolveHomeworkAssignmentId(result));
        const assignment = assignmentMap.get(assignmentId);
        if (!assignment) {
            logger?.({
                resultId: result.id,
                assignmentId,
                assignmentFound: false,
                assignment: null,
                finalRow: null,
            });
            return [];
        }
        const questionNumbers = Array.isArray(assignment.questionNumbers) ? assignment.questionNumbers : [];
        const questionStats = buildHomeworkQuestionStats({ assignment, result });
        const completionLabel = getHomeworkCompletionLabel(questionStats);
        const assignmentTitle = hasHomeworkTitleMetadata(assignment)
            ? resolveHomeworkAssignmentTitle({ ...assignment, title: assignment.title || assignment.assignmentTitle })
            : (hasHomeworkTitleMetadata(result)
                ? resolveHomeworkAssignmentTitle({ ...result, title: result.title || result.assignmentTitle })
                : '과제 정보 없음');
        const row = {
            ...result,
            ...assignment,
            id: result.id,
            assignmentId,
            assignmentTitle,
            classId: assignment.classId || assignment.classDocId || result.classId || result.classDocId || '',
            classDocId: assignment.classDocId || assignment.classId || result.classDocId || result.classId || '',
            status: completionLabel,
            completed: completionLabel === '완료',
            questionSummary: resolveHomeworkQuestionSummary(assignment, result),
            results: normalizeHomeworkResultMapForDisplay(result, questionNumbers, { assignmentId, studentId }),
        };
        logger?.({
            resultId: result.id,
            assignmentId,
            assignmentFound: true,
            assignment: {
                id: assignment.id,
                title: assignment.title,
                name: assignment.name,
                assignmentTitle: assignment.assignmentTitle,
                classId: assignment.classId,
                classDocId: assignment.classDocId,
            },
            finalRow: { assignmentTitle: row.assignmentTitle, classId: row.classId },
        });
        return [row];
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
