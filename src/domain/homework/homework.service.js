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

export const resolveHomeworkAssignmentId = (result = {}) => (
    result.assignmentId
    || result.homeworkAssignmentId
    || result.homeworkId
    || (
        result.studentId && String(result.id || '').startsWith(`${result.studentId}_`)
            ? String(result.id).slice(String(result.studentId).length + 1)
            : (String(result.id || '').includes('_') ? String(result.id).split('_').at(-1) : '')
    )
    || ''
);

const resolveBookTitle = (book) => {
    if (!book) return '';
    if (typeof book === 'string') return book;
    if (typeof book === 'object') return book.title || book.name || book.bookName || '';
    return '';
};

export const resolveHomeworkAssignmentTitle = (assignment = {}) => (
    resolveBookTitle(assignment.book)
    || assignment.title
    || assignment.name
    || assignment.assignmentName
    || assignment.homeworkName
    || assignment.content
    || '숙제'
);

export const resolveHomeworkQuestionSummary = (assignment = {}, result = {}) => {
    const questionNumbers = getAssignmentQuestionNumbers(assignment);
    const normalized = normalizeHomeworkResultMapForDisplay(result, questionNumbers, {
        assignmentId: assignment?.id,
    });
    const values = Object.values(normalized);
    const normalize = (value) => typeof value === 'string' ? value.trim().toLowerCase() : value;
    const correctValues = new Set([true, 1, '1', 'o', '맞음', 'correct']);
    const wrongValues = new Set([false, 0, '0', 'x', '틀림', 'wrong', 'incorrect']);
    const fixedValues = new Set(['고침', 'fixed', 'revised']);
    const correct = Number(result?.correctCount) || values.filter((value) => correctValues.has(normalize(value))).length;
    const wrong = Number(result?.wrongCount) || values.filter((value) => wrongValues.has(normalize(value))).length;
    const fixed = Number(result?.fixedCount) || values.filter((value) => fixedValues.has(normalize(value))).length;
    const explicitTotal = Number(assignment?.totalQuestions ?? assignment?.questionCount ?? result?.totalQuestions);
    const total = Number.isFinite(explicitTotal) && explicitTotal >= 0
        ? explicitTotal
        : (questionNumbers.length || Object.keys(normalized).length);
    const unanswered = Math.max(0, total - correct - wrong - fixed);
    return `맞음 ${correct} / 틀림 ${wrong} / 고침 ${fixed} / 안 풂 ${unanswered}`;
};

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
        .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
};

export const resolveAssignmentType = (assignment) => {
    const type = assignment?.type || 'homework';
    return typeof type === 'string' ? type : 'homework';
};

export const resolveAssignmentTypeLabel = (assignment) => {
    const type = resolveAssignmentType(assignment);
    if (type === 'video_makeup') return '동영상 보강';
    return '숙제';
};

export const resolveAssignmentStudentIds = (assignment) => {
    if (!assignment) return [];
    const candidates = [
        assignment.assignedStudentIds,
        assignment.assignedStudentUids,
        assignment.students,
        assignment.targetStudents,
        assignment.targetStudentIds,
        assignment.studentIds,
        assignment.studentUid,
        assignment.studentId,
    ].flat().filter(Boolean);

    const authIds = [
        assignment.assignedAuthUids,
        assignment.targetAuthUids,
    ].flat().filter(Boolean);

    const merged = [...candidates, ...authIds];
    return merged.filter(Boolean);
};

const resolveResultMap = (resultData) => {
    if (!resultData || typeof resultData !== 'object') return null;
    const mapFromKey = resultData.results;
    if (mapFromKey && typeof mapFromKey === 'object' && !Array.isArray(mapFromKey)) return mapFromKey;

    const numericEntries = Object.entries(resultData).filter(([k]) => /^\d+$/.test(k));
    if (numericEntries.length > 0) return Object.fromEntries(numericEntries);

    return null;
};

export const parseQuestionRange = (input) => {
    if (typeof input !== 'string') return [];

    const values = new Set();
    input
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean)
        .forEach((token) => {
            const [left, right] = token.split(/[-~]/).map((v) => Number(v?.trim()));
            if (Number.isFinite(left) && Number.isFinite(right)) {
                const start = Math.min(left, right);
                const end = Math.max(left, right);
                for (let q = start; q <= end; q += 1) values.add(q);
                return;
            }
            const single = Number(token);
            if (Number.isFinite(single)) values.add(single);
        });

    return Array.from(values).sort((a, b) => a - b);
};

export const getAssignmentQuestionNumbers = (assignment) => {
    if (!assignment || typeof assignment !== 'object') return [];

    const rawNumbers = Array.isArray(assignment.questionNumbers) && assignment.questionNumbers.length > 0
        ? assignment.questionNumbers
        : (assignment.rangeString ? parseQuestionRange(assignment.rangeString) : []);

    const fromRaw = rawNumbers
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));

    if (fromRaw.length > 0) {
        return Array.from(new Set(fromRaw)).sort((a, b) => a - b);
    }

    const fallbackCount = Number(assignment.totalQuestions) || 0;
    return Array.from({ length: fallbackCount }, (_, i) => i + 1);
};

export const classifyHomeworkResultKeyMode = (resultMap, assignmentQuestionNumbers = []) => {
    if (!resultMap || typeof resultMap !== 'object' || Array.isArray(resultMap)) return 'raw_unknown';

    const rawKeys = Object.keys(resultMap)
        .map((key) => Number(key))
        .filter((key) => Number.isFinite(key));

    if (rawKeys.length === 0) return 'raw_unknown';

    const normalizedAssignmentNumbers = Array.isArray(assignmentQuestionNumbers)
        ? assignmentQuestionNumbers.map(Number).filter((value) => Number.isFinite(value))
        : [];

    if (normalizedAssignmentNumbers.length > 0) {
        const assignmentSet = new Set(normalizedAssignmentNumbers);
        const isSubsetOfActualNumbers = rawKeys.every((key) => assignmentSet.has(key));
        if (isSubsetOfActualNumbers) return 'actual_question_numbers';
    }

    const uniqueSortedKeys = Array.from(new Set(rawKeys)).sort((a, b) => a - b);
    const maxSequential = uniqueSortedKeys[uniqueSortedKeys.length - 1] || 0;
    const isSequentialWindow = uniqueSortedKeys.every((value) => value >= 1 && value <= normalizedAssignmentNumbers.length);
    if (isSequentialWindow && maxSequential <= normalizedAssignmentNumbers.length) {
        return 'partial_sequential';
    }

    return 'raw_unknown';
};

export const normalizeHomeworkResultMapForDisplay = (resultData, assignmentQuestionNumbers = [], options = {}) => {
    const baseMap = resolveResultMap(resultData) || {};
    const mode = classifyHomeworkResultKeyMode(baseMap, assignmentQuestionNumbers);
    const isDev = typeof window !== 'undefined' && typeof window.__DEV__ !== 'undefined'
        ? window.__DEV__
        : process.env.NODE_ENV !== 'production';

    if (mode === 'actual_question_numbers') {
        const normalizedResultMap = baseMap;
        if (isDev && baseMap !== normalizedResultMap) {
            console.log('[homework normalize applied]', {
                originalKeys: Object.keys(baseMap),
                normalizedKeys: Object.keys(normalizedResultMap),
            });
        }
        return normalizedResultMap;
    }

    if (mode === 'partial_sequential') {
        const mapped = {};
        Object.entries(baseMap).forEach(([key, value]) => {
            const sequentialIndex = Number(key) - 1;
            const mappedQuestionNumber = assignmentQuestionNumbers[sequentialIndex];
            if (!Number.isFinite(mappedQuestionNumber)) return;
            mapped[String(mappedQuestionNumber)] = value;
        });
        const normalizedResultMap = mapped;
        if (isDev && baseMap !== normalizedResultMap) {
            console.log('[homework normalize applied]', {
                originalKeys: Object.keys(baseMap),
                normalizedKeys: Object.keys(normalizedResultMap),
            });
        }
        return normalizedResultMap;
    }

    if (Object.keys(baseMap).length > 0) {
        console.warn('[homework] unknown result key mode', {
            assignmentId: options.assignmentId,
            studentId: options.studentId,
            resultKeys: Object.keys(baseMap),
        });
    }
    const normalizedResultMap = baseMap;
    if (isDev && baseMap !== normalizedResultMap) {
        console.log('[homework normalize applied]', {
            originalKeys: Object.keys(baseMap),
            normalizedKeys: Object.keys(normalizedResultMap),
        });
    }
    return normalizedResultMap;
};

const normalizeResultsByQuestions = (resultData, questionNumbers = []) => {
    const map = normalizeHomeworkResultMapForDisplay(resultData, questionNumbers);
    if (!Array.isArray(questionNumbers) || questionNumbers.length === 0) return map;
    const allowed = new Set(questionNumbers.map((q) => String(q)));
    return Object.fromEntries(Object.entries(map).filter(([key]) => allowed.has(String(key))));
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

export const computeHomeworkProgress = (resultData, questionNumbersOrTotal) => {
    const questionNumbers = Array.isArray(questionNumbersOrTotal)
        ? questionNumbersOrTotal
        : null;
    const total = questionNumbers
        ? questionNumbers.length
        : (Number(questionNumbersOrTotal) > 0 ? Number(questionNumbersOrTotal) : 0);
    const resultMap = normalizeResultsByQuestions(resultData, questionNumbers || []);
    const statuses = Object.values(resultMap);

    const checkedCount = statuses.filter((status) => ['맞음', '틀림', '고침'].includes(status)).length;
    const incorrectCount = statuses.filter((status) => status === '틀림').length;
    const unchecked = total > 0 ? Math.max(total - checkedCount, 0) : 0;

    let completionRate = total > 0 ? Math.round((checkedCount / total) * 100) : 0;
    if (checkedCount >= total && incorrectCount > 0) completionRate = 99;
    if (checkedCount >= total && incorrectCount === 0 && completionRate < 100) completionRate = 100;

    let status = '진행중';

    if (checkedCount > 0 && checkedCount < total) {
    status = '진행중';
    } else if (checkedCount >= total) {
    status = isHomeworkCompleteByCounts({ wrongCount: incorrectCount, remainingCount: unchecked }) ? '완료' : '미완료';
    }

    return {
        completionRate,
        checkedCount,
        incorrectCount,
        uncheckedCount: unchecked,
        status,
    };
};

export const getHomeworkStats = (results, questionNumbers = []) => {
    const normalized = normalizeHomeworkResultMapForDisplay(results, questionNumbers);
    const totalQuestions = Array.isArray(questionNumbers) ? questionNumbers.length : 0;
    const values = Object.values(normalized);
    const correctCount = values.filter((s) => s === '맞음').length;
    const wrongCount = values.filter((s) => s === '틀림').length;
    const fixedCount = values.filter((s) => s === '고침').length;
    const checkedCount = correctCount + wrongCount + fixedCount;
    const remainingCount = Math.max(totalQuestions - checkedCount, 0);
    const completionRate = totalQuestions > 0 ? Math.round((checkedCount / totalQuestions) * 100) : 0;
    return { correctCount, wrongCount, fixedCount, remainingCount, completionRate };
};

export const buildHomeworkQuestionStats = ({ assignment, result }) => {
    const questionNumbers = getAssignmentQuestionNumbers(assignment);
    const totalCount = questionNumbers.length;
    const normalized = normalizeHomeworkResultMapForDisplay(result, questionNumbers, {
        assignmentId: assignment?.id,
    });
    const allowed = new Set(questionNumbers.map((q) => String(q)));
    const filteredEntries = Object.entries(normalized).filter(([key]) => allowed.has(String(key)));
    const statusByQuestion = new Map(filteredEntries.map(([key, value]) => [Number(key), String(value)]));

    const correctQuestionNumbers = [];
    const wrongQuestionNumbers = [];
    const fixedQuestionNumbers = [];
    const remainingQuestionNumbers = [];

    questionNumbers.forEach((questionNumber) => {
        const status = statusByQuestion.get(Number(questionNumber));
        if (status === '맞음') correctQuestionNumbers.push(questionNumber);
        else if (status === '틀림') wrongQuestionNumbers.push(questionNumber);
        else if (status === '고침') fixedQuestionNumbers.push(questionNumber);
        else remainingQuestionNumbers.push(questionNumber);
    });

    const correctCount = correctQuestionNumbers.length;
    const wrongCount = wrongQuestionNumbers.length;
    const fixedCount = fixedQuestionNumbers.length;
    const completedCount = correctCount + wrongCount + fixedCount;
    const remainingCount = remainingQuestionNumbers.length;
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return {
        totalCount,
        completedCount,
        correctCount,
        wrongCount,
        fixedCount,
        remainingCount,
        completionRate,
        correctQuestionNumbers,
        wrongQuestionNumbers,
        fixedQuestionNumbers,
        remainingQuestionNumbers,
    };
};


export const isHomeworkCompleteByCounts = ({ wrongCount = 0, remainingCount = 0 } = {}) => {
    const wrong = Number(wrongCount) || 0;
    const remaining = Number(remainingCount) || 0;
    return wrong === 0 && remaining === 0;
};

export const getHomeworkCompletionLabel = (counts = {}) => (
    isHomeworkCompleteByCounts(counts) ? '완료' : '미완료'
);

export const applyHomeworkProgressCap = (progressPercent = 0, resultData, totalQuestions = null) => {
    const safeProgress = Number.isFinite(progressPercent) ? progressPercent : 0;
    const progress = computeHomeworkProgress(resultData, totalQuestions);
    if (safeProgress >= 100 && (progress.incorrectCount > 0 || hasWrongRemaining(resultData))) return 99;
    return progress.completionRate || safeProgress;
};

export const isAssignmentAssignedToStudent = (assignment, studentId, extraStudentKeys = []) => {
    if (!assignment || !studentId) return false;
    const assignedIds = resolveAssignmentStudentIds(assignment).map(String);
    const compareKeys = [studentId, ...extraStudentKeys].filter(Boolean).map(String);
    if (assignedIds.length === 0) return true;
    return compareKeys.some((key) => assignedIds.includes(key));
};

export const buildAssignmentSummary = (selectedAssignment, classStudents = [], homeworkResults = {}, localChanges = []) => {
    if (!selectedAssignment) return [];

    const questionNumbers = getAssignmentQuestionNumbers(selectedAssignment);

    return classStudents.map(student => {
        const rawResult = homeworkResults[student.id]?.[selectedAssignment.id];
        const savedResult = normalizeHomeworkResultMapForDisplay(rawResult, questionNumbers, {
            assignmentId: selectedAssignment.id,
            studentId: student.id,
        });
        const patchedResult = { ...(savedResult || {}) };

        localChanges.forEach(change => {
            if (change.studentId === student.id && change.assignmentId === selectedAssignment.id) {
                if (change.status === null) delete patchedResult[change.questionId];
                else patchedResult[change.questionId] = change.status;
            }
        });

        const result = normalizeResultsByQuestions(patchedResult, questionNumbers);
        const total = questionNumbers.length;

        const progress = computeHomeworkProgress(result, questionNumbers);

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
