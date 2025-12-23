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

    return students
        .filter(s => selectedClass.students.includes(s.id) && s.status === '재원생')
        .sort((a, b) => a.name.localeCompare(b.name));
};

export const buildAssignmentSummary = (selectedAssignment, classStudents = [], homeworkResults = {}, localChanges = []) => {
    if (!selectedAssignment) return [];

    return classStudents.map(student => {
        const savedResult = { ...(homeworkResults[student.id]?.[selectedAssignment.id] || {}) };

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
        const completionRate = Math.round((completionCount / total) * 100) || 0;

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