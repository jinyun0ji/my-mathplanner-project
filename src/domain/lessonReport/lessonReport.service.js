import { getTotalScore } from '../grade/grade.service';
import {
    computeHomeworkProgress,
    getAssignmentQuestionNumbers,
    normalizeHomeworkResultMapForDisplay,
    resolveHomeworkAssignmentTitle,
} from '../homework/homework.service';
import { formatRoundedPercent } from '../../utils/numberFormat';
import {
    buildTestDisplayLines,
    buildTestStatParts,
    formatScoreStat,
    getTestStatsForDisplay,
    isAbsentGradeRecord,
    pickScoreValue,
    toFiniteScoreNumber,
} from '../../utils/scoreDisplay';

export const LESSON_REPORT_STATUS = {
    DRAFT: 'draft',
    SENT: 'sent',
};

export const LESSON_REPORT_SEND_STATUS = {
    DRAFT: 'draft',
    SCHEDULED: 'scheduled',
    SENT: 'sent',
};

export const buildLessonReportId = ({ studentId, classId, lessonDate }) => {
    const s = String(studentId || '').trim();
    const c = String(classId || '').trim();
    const d = String(lessonDate || '').trim();
    if (!s || !c || !d) return '';
    return `${s}_${c}_${d}`;
};

const toYmd = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value.slice(0, 10);
    if (typeof value?.toDate === 'function') return value.toDate().toISOString().slice(0, 10);
    try { return new Date(value).toISOString().slice(0, 10); } catch { return ''; }
};

const toKoreanDateTag = (value) => {
    const ymd = toYmd(value);
    if (!ymd) return '';
    const [year, month, day] = ymd.split('-').map((part) => Number(part));
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return '';
    return `[${month}월 ${day}일]`;
};

const normalizeResult = (result) => {
    if (!result) return null;
    if (typeof result === 'number') return { completionRate: result };
    if (typeof result === 'string') {
        const numeric = Number(result.replace('%', ''));
        if (Number.isFinite(numeric)) return { completionRate: numeric };
        return { status: result };
    }
    return result;
};

const toFiniteNumber = (value) => {
    if (Number.isFinite(value)) return value;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const toCandidateStudentKeys = ({ student = null, studentId = '' }) => {
    const keys = [
        studentId,
        student?.id,
        student?.studentId,
        student?.studentDocId,
        student?.docId,
        student?.authUid,
        student?.userUid,
        student?.studentUid,
        student?.uid,
    ]
        .filter((value) => value !== null && value !== undefined)
        .map((value) => String(value).trim())
        .filter(Boolean);

    return Array.from(new Set(keys));
};

export const getGradeForLessonReportStudent = ({ student = null, studentId = '', grades = {}, testId }) => {
    if (!testId || !grades || typeof grades !== 'object') return null;

    const keys = toCandidateStudentKeys({ student, studentId });
    for (const key of keys) {
        const byKey = grades?.[key]?.[testId];
        if (byKey) return byKey;
    }

    const keySet = new Set(keys);
    for (const studentGrades of Object.values(grades)) {
        if (!studentGrades || typeof studentGrades !== 'object') continue;
        const byTest = studentGrades?.[testId];
        if (!byTest) continue;
        const refIds = [
            byTest?.studentId,
            byTest?.studentDocId,
            byTest?.authUid,
            byTest?.studentUid,
            byTest?.userUid,
            byTest?.uid,
        ]
            .filter((value) => value !== null && value !== undefined)
            .map((value) => String(value));

        if (refIds.some((refId) => keySet.has(refId))) {
            return byTest;
        }
    }

    return null;
};

const buildTestTitle = (test = {}) => {
    const dateTag = toKoreanDateTag(test?.date || test?.testDate || test?.lessonDate || test?.createdAt || test?.updatedAt);
    const rawName = String(test?.name || '시험');
    const name = dateTag && rawName.startsWith(dateTag)
        ? rawName.slice(dateTag.length).trim()
        : rawName;
    return dateTag ? `${dateTag} ${name}` : name;
};

const getHomeworkResultByStudent = ({ homeworkResults = {}, assignmentId, studentId = '', student = null }) => {
    const candidateKeys = toCandidateStudentKeys({ student, studentId });
    for (const key of candidateKeys) {
        const byCandidate = homeworkResults?.[key]?.[assignmentId];
        if (byCandidate !== undefined && byCandidate !== null) return byCandidate;
    }

    const keySet = new Set(candidateKeys);
    for (const perStudentResults of Object.values(homeworkResults || {})) {
        if (!perStudentResults || typeof perStudentResults !== 'object') continue;
        const byAssignment = perStudentResults?.[assignmentId];
        if (!byAssignment || typeof byAssignment !== 'object') continue;
        const refs = [
            byAssignment?.studentId,
            byAssignment?.studentDocId,
            byAssignment?.authUid,
            byAssignment?.studentUid,
            byAssignment?.userUid,
            byAssignment?.uid,
        ].filter(Boolean).map(String);
        if (refs.some((ref) => keySet.has(ref))) return byAssignment;
    }

    for (const result of Object.values(homeworkResults || {})) {
        if (!result || typeof result !== 'object') continue;
        if (String(result?.assignmentId || '') !== String(assignmentId || '')) continue;
        const refs = [
            result?.studentId,
            result?.studentDocId,
            result?.authUid,
            result?.studentUid,
            result?.userUid,
            result?.uid,
        ].filter(Boolean).map(String);
        if (refs.some((ref) => keySet.has(ref))) return result;
    }

    return null;
};

export const summarizeHomework = ({
    selectedHomeworkProgressIds = [],
    selectedHomeworkIds = [],
    homeworkAssignments = [],
    homeworkResults = {},
    studentId,
    student = null,
}) => {
    const targetHomeworkIds = selectedHomeworkProgressIds.length > 0
        ? selectedHomeworkProgressIds
        : selectedHomeworkIds;
    const items = targetHomeworkIds
        .map((id) => homeworkAssignments.find((hw) => String(hw.id) === String(id)))
        .filter(Boolean)
        .map((assignment) => {
            const rawResult = getHomeworkResultByStudent({
                homeworkResults,
                assignmentId: assignment.id,
                studentId,
                student,
            });
            const questionNumbers = getAssignmentQuestionNumbers(assignment);
            const normalizedMap = normalizeHomeworkResultMapForDisplay(rawResult, questionNumbers, {
                assignmentId: assignment.id,
                studentId,
            });
            const progress = computeHomeworkProgress({ results: normalizedMap }, questionNumbers);
            const completionRate = Number.isFinite(progress?.completionRate)
                ? Math.max(0, Math.min(100, progress.completionRate))
                : null;
            const fallbackNormalized = normalizeResult(rawResult);
            const fallbackRate = Number.isFinite(fallbackNormalized?.completionRate)
                ? Math.max(0, Math.min(100, fallbackNormalized.completionRate))
                : null;
            const hasResult = rawResult !== null && rawResult !== undefined;
            const resolvedRate = Number.isFinite(completionRate) && (hasResult || questionNumbers.length > 0)
                ? completionRate
                : fallbackRate;
            const completionText = Number.isFinite(resolvedRate) ? formatRoundedPercent(resolvedRate) : null;

            return {
                homeworkId: assignment.id,
                title: resolveHomeworkAssignmentTitle(assignment),
                completionRate: Number.isFinite(resolvedRate) ? Math.round(resolvedRate) : null,
                status: completionText ? null : '미제출',
                summary: completionText ? `${resolveHomeworkAssignmentTitle(assignment)} ${completionText}` : `${resolveHomeworkAssignmentTitle(assignment)} 미제출`,
            };
        });

    return {
        items,
        text: items.map((item) => item.summary),
    };
};

export const summarizeAssignedHomework = ({
    selectedAssignedHomeworkIds = [],
    selectedHomeworkIds = [],
    homeworkAssignments = [],
}) => ({
    items: (selectedAssignedHomeworkIds.length > 0 ? selectedAssignedHomeworkIds : selectedHomeworkIds)
        .map((id) => homeworkAssignments.find((hw) => String(hw.id) === String(id)))
        .filter(Boolean)
        .map((assignment) => ({
        homeworkId: assignment.id,
        title: resolveHomeworkAssignmentTitle(assignment),
        assignedDate: toYmd(assignment.assignedDate || assignment.date || assignment.createdAt),
        dueDate: toYmd(assignment.dueDate || assignment.deadline),
    })),
});

export const summarizeTests = ({ selectedTestIds = [], tests = [], grades = {}, studentId, student = null, classTestStats = {} }) => {
    const items = selectedTestIds
        .map((id) => tests.find((test) => String(test.id) === String(id)))
        .filter(Boolean)
        .map((test) => {
            const grade = getGradeForLessonReportStudent({ student, studentId, grades, testId: test.id });
            const title = buildTestTitle(test);
            const stats = getTestStatsForDisplay(test, classTestStats, grade);
            const absent = isAbsentGradeRecord(grade);
            const directScore = absent ? null : toFiniteScoreNumber(pickScoreValue(grade));
            const computedScore = directScore ?? (absent ? null : getTotalScore(grade, test));

            const questionCount = toFiniteNumber(grade?.questionCount) ?? toFiniteNumber(test?.totalQuestions);
            const correctCount = toFiniteNumber(grade?.correctCount);
            const displayLines = grade
                ? buildTestDisplayLines({ title, gradeRecord: grade, stats })
                : [
                    title,
                    '학생: 점수 미입력',
                    `평균: ${formatScoreStat(stats.average, { fallback: '통계 준비 중', includeUnit: true })}`,
                    ...buildTestStatParts({ ...stats, average: null }, { includeUnit: true }).map((part) => part.replace(' ', ': ')),
                ];

            const summary = displayLines.join('\n');

            return {
                testId: test.id,
                name: test.name || '시험',
                title,
                grade,
                attempted: grade?.attempted === true && !absent,
                score: Number.isFinite(computedScore) ? computedScore : null,
                average: stats.average,
                highestScore: stats.highest,
                maxScore: stats.perfect,
                totalQuestions: Number.isFinite(questionCount) ? questionCount : null,
                correctCount: Number.isFinite(correctCount) ? correctCount : null,
                displayLines,
                summary,
            };
        });

    return { items, text: items.map((item) => item.summary) };
};