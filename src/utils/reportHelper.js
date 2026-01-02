// src/utils/reportHelper.js
import { calculateHomeworkStats } from './helpers';

// [데이터 어댑터] Raw Data -> SessionReport Interface 변환
export const generateSessionReport = (sessionId, studentId, contextData) => {
    const {
        lessonLogs,
        attendanceLogs,
        homeworkAssignments,
        homeworkResults,
        tests,
        grades,
        classes = [],
        students = []
    } = contextData;

    // 1. 기본 수업 정보 (LessonLog)
    const lesson = lessonLogs.find(l => l.id === sessionId);
    if (!lesson) return null;

    // 2. 출결 (Attendance)
    const attendLog = attendanceLogs.find(l =>
        l.classId === lesson.classId &&
        l.date === lesson.date &&
        l.studentId === studentId
    );
    const attendanceStatus = attendLog ? attendLog.status : "기록 없음";

    // 3. 과제 (Homework)
    const relatedHomeworks = homeworkAssignments.filter(h =>
        h.classId === lesson.classId &&
        (h.date === lesson.date || h.deadline === lesson.date)
    );

    let homeworkStatus = "과제 없음";
    let homeworkDesc = null;
    let homeworkDueDate = null;

    if (relatedHomeworks.length > 0) {
        const stats = calculateHomeworkStats(
            studentId,
            relatedHomeworks,
            homeworkResults,
            { students }
        );

        const isAllDone = stats.every(h => h.status === '완료');
        const isAnyPending = stats.some(h => h.status === '진행 중' || h.status === '미시작');

        homeworkStatus = isAllDone
            ? "완료"
            : (isAnyPending ? "일부 미완" : "미제출");

        const nextHw = relatedHomeworks[0];
        homeworkDesc = nextHw.content;
        homeworkDueDate = nextHw.deadline;
    }

    // 4. 테스트 (Test)
    const dailyTest = tests.find(
        t => t.classId === lesson.classId && t.date === lesson.date
    );

    let testScoreValue = "테스트 없음";
    if (dailyTest) {
        const grade = grades[studentId]?.[dailyTest.id];
        testScoreValue = grade ? `${grade.score}점` : "미응시";
    }

    // 5. 수업 요약
    const lessonSummary = lesson.progress
        ? [lesson.progress, "관련 필수 예제 풀이", "복습 테스트 풀이"]
        : ["수업 내용 기록 없음"];

    // 6. 학습 코멘트 (🔥 핵심 수정)
    const gradeComment = grades[studentId]?.[dailyTest?.id]?.comment || null;

    let learningComment = null;

    if (attendanceStatus === '결석') {
        learningComment = "결석으로 인해 수업에 참여하지 못했습니다.";
    } else if (attendanceStatus === '지각') {
        learningComment =
            gradeComment || "지각했으나 수업에는 성실히 참여했습니다.";
    } else if (attendanceStatus === '출석') {
        learningComment =
            gradeComment || "특이사항 없이 성실하게 수업에 참여하였습니다.";
    } else {
        // 기록 없음
        learningComment = "출결 기록이 없습니다.";
    }

    const parentNote = attendanceStatus === '지각'
        ? "오늘 조금 늦었지만 수업 집중도는 좋았습니다."
        : null;

    // 최종 Report 객체 반환
    return {
        sessionId: lesson.id,
        classId: lesson.classId,
        date: lesson.date,
        className:
            classes.find(c => String(c.id) === String(lesson.classId))?.name
            || "고1 수학(상) 정규반",

        attendance: attendanceStatus,
        homeworkStatus,
        progressTopic: lesson.progress,
        testScore: testScoreValue,

        lessonSummary,
        learningComment,

        homework: homeworkDesc ? {
            description: homeworkDesc,
            dueDate: homeworkDueDate
        } : null,

        parentNote
    };
};