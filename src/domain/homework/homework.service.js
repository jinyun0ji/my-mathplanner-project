export const getClassAssignments = (assignments = [], classId) => {
    if (!classId) return [];

    return assignments
        .filter(a => a.classId === classId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
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

export const applyHomeworkProgressCap = (progressPercent = 0, resultData) => {
    const safeProgress = Number.isFinite(progressPercent) ? progressPercent : 0;
    if (safeProgress >= 100 && hasWrongRemaining(resultData)) return 99;
    return safeProgress;
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

        let correct = 0;
        let incorrect = 0;
        let corrected = 0;

        Object.values(result).forEach(status => {
            if (status === '맞음') correct++;
            if (status === '틀림') incorrect++;
            if (status === '고침') corrected++;
        });

        const completionCount = correct + corrected + incorrect;
        const unchecked = total - completionCount;
        const completionRate = applyHomeworkProgressCap(
            Math.round((completionCount / total) * 100) || 0,
            result
        );

        return {
            studentId: student.id,
            studentName: student.name,
            total,
            correct,
            incorrect,
            corrected,
            unchecked,
            completionRate,
            isCompleted: unchecked === 0,
            resultMap: result,
        };
    });
};