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

const clinicValue = (record, keys) => {
    for (const key of keys) {
        const value = record?.[key];
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return '';
};

const clinicDate = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const CANCELLED_CLINIC_STATUSES = new Set([
    'cancelled', 'canceled', 'cancel', '취소', '예약취소', '예약 취소',
]);
const COMPLETED_CLINIC_STATUSES = new Set([
    'attended', 'completed', 'complete', 'done', 'present', '참석', '완료', '참석 완료',
    // ClinicManagement treats no-show as a finalized attendance outcome and exposes its report.
    'no-show', 'no_show', 'noshow', 'missed', 'absent', '미참석',
]);

export const resolveStudentClinicDate = (record) => clinicValue(record, [
    'effectiveDate', 'date', 'clinicDate', 'reservationDate', 'scheduledAt', 'startAt', 'createdAt',
]);

export const normalizeStudentClinicRow = (record, sourceType) => {
    const effectiveDate = resolveStudentClinicDate(record);
    const effectiveStatus = String(clinicValue(record, ['status', 'clinicStatus', 'attendanceStatus', 'result']) || '').trim();
    return {
        ...record,
        id: String(record?.id || ''),
        studentId: record?.studentId || record?.studentDocId || record?.studentUid || '',
        sourceType,
        effectiveDate,
        effectiveStatus,
        effectiveTime: clinicValue(record, ['plannedTime', 'timeSlot', 'time', 'checkIn', 'startAt']),
        effectiveStaffName: clinicValue(record, ['tutorName', 'tutor', 'assistantName', 'assistant', 'teacherName', 'teacher', 'updatedByName', 'createdByName']),
        effectiveComment: clinicValue(record, ['clinicComment', 'comment', 'content', 'note', 'memo']),
    };
};

const linkedReservationIds = (record) => [
    record?.reservationId,
    record?.sourceReservationId,
    record?.clinicReservationId,
    record?.sourceCollection === 'clinicReservations' ? record?.sourceDocId : '',
].filter(Boolean).map(String);

export const buildStudentClinicRows = ({ clinicLogs = [], clinicReservations = [], now = new Date() }) => {
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const reservationsById = new Map(clinicReservations.map((item) => [String(item?.id || ''), item]));
    const linkedIds = new Set(clinicLogs.flatMap(linkedReservationIds));

    const logs = clinicLogs.map((item) => normalizeStudentClinicRow(item, 'clinicLog'));
    const reservations = clinicReservations.flatMap((item) => {
        const id = String(item?.id || '');
        const status = String(clinicValue(item, ['status', 'clinicStatus', 'attendanceStatus', 'result']) || '').trim().toLowerCase();
        if (CANCELLED_CLINIC_STATUSES.has(status) || linkedIds.has(id)) return [];
        // A reservation is history after its scheduled day. Explicit attendance outcomes remain
        // history even if malformed data carries a future date; future pending bookings do not.
        const date = clinicDate(resolveStudentClinicDate(item));
        if (!COMPLETED_CLINIC_STATUSES.has(status) && (!date || date > endOfToday)) return [];
        return [normalizeStudentClinicRow(item, 'clinicReservation')];
    });

    const seen = new Set();
    return [...logs, ...reservations]
        .filter((row) => {
            // Same document id is only a duplicate across the two source collections. Within a
            // collection ids are unique, and no date/time heuristic is used to merge real visits.
            const key = `${row.sourceType}:${row.id}`;
            const crossSourceKey = `document:${row.id}`;
            if (seen.has(key) || (reservationsById.has(row.id) && row.sourceType === 'clinicReservation' && seen.has(crossSourceKey))) return false;
            seen.add(key);
            seen.add(crossSourceKey);
            return true;
        })
        .sort((a, b) => {
            const timeDifference = (clinicDate(b.effectiveDate)?.getTime() || 0) - (clinicDate(a.effectiveDate)?.getTime() || 0);
            if (timeDifference) return timeDifference;
            return String(b.effectiveTime || '').localeCompare(String(a.effectiveTime || ''));
        });
};

// Printing must snapshot only the rows the clinic tab has loaded. Keeping this pure also makes it
// impossible for print preparation to trigger a clinicLogs/clinicReservations read by itself.
export const buildStudentClinicPrintRows = (screenClinicRows = []) => [...screenClinicRows];

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
