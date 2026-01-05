const resolveDateString = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value?.toDate === 'function') return value.toDate().toISOString().slice(0, 10);
    try { return new Date(value).toISOString().slice(0, 10); } catch { return null; }
};

const resolveAssignedDate = (assignment) => (
    resolveDateString(assignment?.assignedDate)
    || resolveDateString(assignment?.date)
    || resolveDateString(assignment?.createdAt)
);

export const getClassAssignments = (assignments = [], classId) => {
    if (!classId) return [];

    return assignments
        .filter(a => a.classId === classId)
        .sort((a, b) => new Date(resolveAssignedDate(b) || b.date) - new Date(resolveAssignedDate(a) || a.date));
};

export const getSelectedAssignment = (assignments = [], assignmentId) => {
    return assignments.find(a => a.id === assignmentId) || null;
};

export const getClassStudents = (students = [], selectedClass) => {
    if (!selectedClass) return [];

    const classId = String(selectedClass.id);
    return students
        .filter((student) => {
            const classIds = Array.isArray(student.classIds)
                ? student.classIds
                : (student.classes || []);
            return classIds.map(String).includes(classId);
        })
        .sort((a, b) => a.name.localeCompare(b.name));
};

export const resolveAssignmentStudentIds = (assignment) => {
    if (!assignment) return [];
    const assigned = assignment.assignedStudentIds ?? assignment.students ?? [];
    return Array.isArray(assigned) ? assigned : [];
};

const resolveResultMap = (resultData) => {
    if (!resultData || typeof resultData !== 'object') return null;
    const mapFromKey = resultData.results;
    if (mapFromKey && typeof mapFromKey === 'object' && !Array.isArray(mapFromKey)) return mapFromKey;

    const numericEntries = Object.entries(resultData).filter(([k, v]) => /^\d+$/.test(k) && typeof v === 'string');
    if (numericEntries.length > 0) return Object.fromEntries(numericEntries);

    return null;
};

export const hasWrongRemaining = (resultData) => {
    if (!resultData) return false;

    const wrongRemainingCount = resultData?.wrongRemainingCount ?? resultData?.remainingWrongCount;
    if (Number.isFinite(wrongRemainingCount)) return wrongRemainingCount > 0;

    const retryLists = [resultData?.wrongProblems, resultData?.needsRetry, resultData?.retryList, resultData?.retryProblems];
    for (const list of retryLists) {
        if (Array.isArray(list)) return list.length > 0;
    }

    const resultMap = resolveResultMap(resultData);
    if (resultMap) {
        return Object.values(resultMap).some(status => ['틀림', 'wrong', 'needs_retry', 'needsRetry', 'retry'].includes(String(status)));
    }

    return false;
};

export const computeHomeworkProgress = (resultData, totalQuestions) => {
    const total = Number(totalQuestions) > 0 ? Number(totalQuestions) : 0;
    const resultMap = resolveResultMap(resultData) || {};
    const statuses = Object.values(resultMap);

    const checkedCount = statuses.filter((status) => ['맞음', '틀림', '고침'].includes(status)).length;
    const incorrectCount = statuses.filter((status) => status === '틀림').length;
    const unchecked = total > 0 ? Math.max(total - checkedCount, 0) : 0;

    let completionRate = total > 0 ? Math.round((checkedCount / total) * 100) : 0;
    if (checkedCount >= total && incorrectCount > 0) completionRate = 99;
    if (checkedCount >= total && incorrectCount === 0 && completionRate < 100) completionRate = 100;

    let status = '검사 전';
    if (checkedCount > 0 && checkedCount < total) status = '검사 진행 중';
    else if (checkedCount >= total) {
        status = incorrectCount > 0
            ? '문제 풀이를 마치고, 꼼꼼하게 오답을 정리하고 있어요 🧐'
            : '오답 확인까지 완벽하게 숙제를 마쳤어요! 💯';
    }

    return {
        completionRate,
        checkedCount,
        incorrectCount,
        uncheckedCount: unchecked,
        status,
    };
};

export const applyHomeworkProgressCap = (progressPercent = 0, resultData, totalQuestions = null) => {
    const safeProgress = Number.isFinite(progressPercent) ? progressPercent : 0;
    const progress = computeHomeworkProgress(resultData, totalQuestions);
    if (safeProgress >= 100 && (progress.incorrectCount > 0 || hasWrongRemaining(resultData))) return 99;
    return progress.completionRate || safeProgress;
};

export const isAssignmentAssignedToStudent = (assignment, studentId) => {
    if (!assignment || !studentId) return false;
    const assignedIds = resolveAssignmentStudentIds(assignment);
    if (assignedIds.length === 0) return true;
    return assignedIds.map(String).includes(String(studentId));
};

export const buildAssignmentSummary = (selectedAssignment, classStudents = [], homeworkResults = {}, localChanges = []) => {
    if (!selectedAssignment) return [];

    return classStudents.map(student => {
        const rawResult = homeworkResults[student.id]?.[selectedAssignment.id];
        const savedResult = { ...(rawResult?.results || rawResult || {}) };

        localChanges.forEach(change => {
            if (change.studentId === student.id && change.assignmentId === selectedAssignment.id) {
                if (change.status === null) delete savedResult[change.questionId];
                else savedResult[change.questionId] = change.status;
            }
        });

        const result = savedResult;
        const total = selectedAssignment.totalQuestions;

        const progress = computeHomeworkProgress(result, total);

        return {
            studentId: student.id,
            studentName: student.name,
            total,
            correct: Object.values(result).filter(status => status === '맞음').length,
            incorrect: progress.incorrectCount,
            corrected: Object.values(result).filter(status => status === '고침').length,
            unchecked: progress.uncheckedCount,
            completionRate: progress.completionRate,
            isCompleted: progress.checkedCount >= total && progress.incorrectCount === 0,
            checkedCount: progress.checkedCount,
            resultMap: result,
            status: progress.status,
        };
    });
};