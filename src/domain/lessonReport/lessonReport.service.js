export const LESSON_REPORT_STATUS = {
    DRAFT: 'draft',
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

export const summarizeHomework = ({ selectedHomeworkIds = [], homeworkAssignments = [], homeworkResults = {}, studentId }) => {
    const items = selectedHomeworkIds.map((id) => homeworkAssignments.find((hw) => String(hw.id) === String(id))).filter(Boolean).map((assignment) => {
        const raw = homeworkResults?.[studentId]?.[assignment.id] || homeworkResults?.[String(studentId)]?.[assignment.id] || null;
        const normalized = normalizeResult(raw);
        const completionRate = Number.isFinite(normalized?.completionRate) ? Math.max(0, Math.min(100, Math.round(normalized.completionRate))) : null;
        const status = normalized?.status || (completionRate === 100 ? '완료' : (completionRate === null ? '미제출' : null));
        return { homeworkId: assignment.id, title: assignment.title || assignment.content || assignment.book || '숙제', completionRate, status };
    });

    return {
        items,
        text: items.map((item) => Number.isFinite(item.completionRate)
            ? `${item.title} ${item.completionRate}% 완료`
            : `${item.title} ${item.status || '진행도 미입력'}`),
    };
};

export const summarizeAssignedHomework = ({ selectedHomeworkIds = [], homeworkAssignments = [] }) => ({
    items: selectedHomeworkIds.map((id) => homeworkAssignments.find((hw) => String(hw.id) === String(id))).filter(Boolean).map((assignment) => ({
        homeworkId: assignment.id,
        title: assignment.title || assignment.content || assignment.book || '숙제',
        assignedDate: toYmd(assignment.assignedDate || assignment.date || assignment.createdAt),
        dueDate: toYmd(assignment.dueDate || assignment.deadline),
    })),
});

export const summarizeTests = ({ selectedTestIds = [], tests = [], grades = {}, studentId }) => {
    const items = selectedTestIds.map((id) => tests.find((test) => String(test.id) === String(id))).filter(Boolean).map((test) => {
        const grade = grades?.[studentId]?.[test.id] || grades?.[String(studentId)]?.[test.id] || null;
        const score = Number.isFinite(grade?.score) ? grade.score : (Number.isFinite(grade?.result) ? grade.result : null);
        const totalQuestions = Number.isFinite(grade?.questionCount) ? grade.questionCount : null;
        const correctCount = Number.isFinite(grade?.correctCount) ? grade.correctCount : null;
        const summary = Number.isFinite(score)
            ? `${test.name || '시험'} ${score}점`
            : (Number.isFinite(totalQuestions) && Number.isFinite(correctCount)
                ? `${test.name || '시험'} 응시 / ${totalQuestions}문항 중 ${correctCount}문항 정답`
                : `${test.name || '시험'} 결과 미입력`);
        return { testId: test.id, name: test.name || '시험', score, totalQuestions, correctCount, summary };
    });

    return { items, text: items.map((item) => item.summary) };
};