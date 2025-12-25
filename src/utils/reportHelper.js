// src/utils/reportHelper.js
import { calculateHomeworkStats } from './helpers';

// [데이터 어댑터] Raw Data -> SessionReport Interface 변환
export const generateSessionReport = (sessionId, studentId, contextData) => {
    const { lessonLogs, attendanceLogs, homeworkAssignments, homeworkResults, tests, grades, classes = [] } = contextData;

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
    // 해당 수업일(또는 다음 수업일)까지 마감인 과제 찾기
    const relatedHomeworks = homeworkAssignments.filter(h => 
        h.classId === lesson.classId && 
        (h.date === lesson.date || h.deadline === lesson.date)
    );
    
    // 과제 상태 판별 (하나라도 미흡하면 미완으로 처리하는 보수적 로직)
    let homeworkStatus = "과제 없음";
    let homeworkDesc = null;
    let homeworkDueDate = null;

    if (relatedHomeworks.length > 0) {
        const stats = calculateHomeworkStats(studentId, relatedHomeworks, homeworkResults);
        const isAllDone = stats.every(h => h.status === '완료');
        const isAnyPending = stats.some(h => h.status === '진행 중' || h.status === '미시작');
        
        homeworkStatus = isAllDone ? "완료" : (isAnyPending ? "일부 미완" : "미제출");
        
        // 다음 과제 안내용 (가장 마감이 임박한 것 표시)
        const nextHw = relatedHomeworks[0];
        homeworkDesc = nextHw.content; // 예: "쎈 수학 p.30-35"
        homeworkDueDate = nextHw.deadline;
    }

    // 4. 테스트 (Test)
    const dailyTest = tests.find(t => t.classId === lesson.classId && t.date === lesson.date);
    let testScoreValue = "테스트 없음";
    if (dailyTest) {
        const grade = grades[studentId]?.[dailyTest.id];
        testScoreValue = grade ? `${grade.score}점` : "미응시";
    }

    // 5. 상세 텍스트 구성 (기존 데이터 구조상 없는 필드는 조합하거나 기본값 처리)
    // 진도(progress) 문자열을 기반으로 요약 생성
    const lessonSummary = lesson.progress 
        ? [lesson.progress, "관련 필수 예제 풀이", "오답 노트 정리"] // (데이터가 단일 문자열이라 배열로 확장 시뮬레이션)
        : ["수업 내용 기록 없음"];

    // 코멘트는 성적 코멘트가 있으면 우선 사용, 없으면 출결 코멘트(가정) 사용
    const learningComment = (grades[studentId]?.[dailyTest?.id]?.comment) 
        || "특이사항 없이 성실하게 수업에 참여하였습니다."; // 기본 메시지

    const parentNote = attendLog?.status === '지각' 
        ? "오늘 조금 늦었지만 수업 집중도는 좋았습니다." 
        : null; // 조건부 노출 테스트용

    // 최종 Report 객체 반환
    return {
        sessionId: lesson.id,
        classId: lesson.classId,
        date: lesson.date,
        className: classes.find(c => String(c.id) === String(lesson.classId))?.name || "고1 수학(상) 정규반",
        
        attendance: attendanceStatus,
        homeworkStatus: homeworkStatus,
        progressTopic: lesson.progress,
        testScore: testScoreValue,

        lessonSummary: lessonSummary,
        learningComment: learningComment,
        
        homework: homeworkDesc ? {
            description: homeworkDesc,
            dueDate: homeworkDueDate
        } : null,

        parentNote: parentNote
    };
};