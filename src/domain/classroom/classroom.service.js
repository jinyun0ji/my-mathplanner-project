export const buildClassroomStats = ({
    attendanceLogs = [],
    selectedClassId = null,
    studentId = null,
    homeworkAssignments = [],
    homeworkResults = {},
    tests = [],
    grades = {}
}) => {
    const myAttendance = attendanceLogs.filter(log => log.classId === selectedClassId && log.studentId === studentId);
    const presentCount = myAttendance.filter(l => ['출석', '동영상보강'].includes(l.status)).length;
    const lateCount = myAttendance.filter(l => l.status === '지각').length;
    const absentCount = myAttendance.filter(l => l.status === '결석').length;
    const totalAttendance = myAttendance.length;

    const classHomeworks = homeworkAssignments.filter(h => h.classId === selectedClassId);
    const unsubmittedCount = classHomeworks.filter(h => {
        const result = homeworkResults?.[studentId]?.[h.id];
        return !result || Object.keys(result).length === 0;
    }).length;

    let unresolvedCount = 0;
    classHomeworks.forEach(hw => {
        const result = homeworkResults?.[studentId]?.[hw.id];
        if (result) unresolvedCount += Object.values(result).filter(status => status === '틀림').length;
    });

    let gradeTrend = 'initial';
    if (tests && grades) {
        const classTests = tests.filter(t => t.classId === selectedClassId).sort((a, b) => new Date(a.date) - new Date(b.date));
        const myScores = classTests.map(t => grades[studentId]?.[t.id]?.score).filter(s => s !== undefined && s !== null);

        if (myScores.length >= 2) {
            const latest = myScores[myScores.length - 1];
            const prev = myScores[myScores.length - 2];
            if (latest > prev) gradeTrend = 'up';
            else if (latest < prev) gradeTrend = 'down';
            else gradeTrend = 'same';
        } else if (myScores.length === 1) {
            gradeTrend = 'initial';
        }
    }

    return {
        attendance: { present: presentCount, late: lateCount, absent: absentCount, total: totalAttendance, logs: myAttendance },
        homework: { unresolved: unresolvedCount, unsubmitted: unsubmittedCount },
        grade: { trend: gradeTrend }
    };
};