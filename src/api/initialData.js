// src/api/initialData.js

export const initialStudents = [
    { id: 1, name: '김민준', grade: '고1', school: '서울고', phone: '010-1111-2222', parentPhone: '010-9999-8888', status: '재원', registeredDate: '2025-03-01', classes: [1], consultationHistory: [], books: [1, 2] },
    { id: 2, name: '이서연', grade: '중3', school: '서초중', phone: '010-3333-4444', parentPhone: '010-7777-6666', status: '재원', registeredDate: '2025-03-05', classes: [2], consultationHistory: [], books: [3] },
    { id: 3, name: '박지훈', grade: '고2', school: '반포고', phone: '010-5555-6666', parentPhone: '010-5555-4444', status: '재원', registeredDate: '2025-02-20', classes: [1], consultationHistory: [], books: [1] },
    { id: 4, name: '최지우', grade: '고1', school: '세화여고', phone: '010-7777-8888', parentPhone: '010-3333-2222', status: '재원', registeredDate: '2025-04-10', classes: [1], consultationHistory: [], books: [2] },
    { id: 5, name: '정수민', grade: '중2', school: '경원중', phone: '010-9999-0000', parentPhone: '010-1111-0000', status: '휴원', registeredDate: '2025-01-15', classes: [], consultationHistory: [], books: [] },
    { id: 6, name: '강동원', grade: '고3', school: '현대고', phone: '010-1234-5678', parentPhone: '010-8765-4321', status: '재원', registeredDate: '2025-05-01', classes: [1, 2], consultationHistory: [], books: [1, 3] },
];

export const initialClasses = [
    { id: 1, name: '고1 수학(상) 정규반', teacher: '김철수', type: '정규', days: ['월', '수', '금'], students: [1, 3, 4, 6], schedule: { days: ['월', '수', '금'], time: '18:00~20:00' }, startDate: '2025-11-01', endDate: '2025-12-31', books: [1, 2] },
    { id: 2, name: '중3 수학 심화반', teacher: '이영희', type: '특강', days: ['화', '목'], students: [2, 6], schedule: { days: ['화', '목'], time: '19:00~21:00' }, startDate: '2025-11-01', endDate: '2025-12-31', books: [3] },
];

export const initialLessonLogs = [
    { id: 1, classId: 1, date: '2025-11-03', progress: '다항식의 연산 (1)', assignment: 'p.10~15 문제 풀이', materialUrl: 'link_to_pdf', iframeCode: '<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ?si=abcdefg" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>' },
    { id: 2, classId: 1, date: '2025-11-05', progress: '다항식의 연산 (2)', assignment: 'p.16~20 문제 풀이', materialUrl: '', iframeCode: '' },
    { id: 3, classId: 1, date: '2025-11-07', progress: '나머지정리', assignment: 'p.21~25 문제 풀이', materialUrl: 'link_to_material', iframeCode: '' },
];

export const initialAttendanceLogs = [
    { id: 1, classId: 1, date: '2025-11-03', studentId: 1, status: '출석', time: '17:55' },
    { id: 2, classId: 1, date: '2025-11-03', studentId: 3, status: '지각', time: '18:10' },
    { id: 3, classId: 1, date: '2025-11-03', studentId: 4, status: '결석', time: '-' },
];

export const initialStudentMemos = {
    1: "수학에 흥미가 많으나 계산 실수가 잦음.",
    2: "기하 부분에 강점이 있음.",
};

export const initialHomeworkAssignments = [
    { id: 1, classId: 1, date: '2025-11-03', content: '쎈 수학 p.30-35', book: '쎈 수학(상)', totalQuestions: 20, students: [1, 3, 4, 6], deadline: '2025-11-05' },
    { id: 2, classId: 1, date: '2025-11-05', content: '일품 p.10-15', book: '일품 수학(상)', totalQuestions: 15, students: [1, 3, 4, 6], deadline: '2025-11-07' },
];

export const initialHomeworkResults = {
    1: { 
        1: { 1: '맞음', 2: '틀림', 3: '맞음', 4: '고침', 5: '맞음', 6: '틀림', 7: '맞음', 8: '맞음', 9: '맞음', 10: '틀림', 11: '맞음', 12: '맞음', 13: '맞음', 14: '고침', 15: '맞음', 16: '맞음', 17: '맞음', 18: '맞음', 19: '맞음', 20: '맞음' },
        2: { 1: '맞음', 2: '맞음', 3: '맞음', 4: '틀림', 5: '맞음' } 
    },
};

export const initialWorkLogs = [
    { id: 1, author: '채수용', date: '2025-11-28', content: '12월 시간표 확정 및 공지 완료. 교재 주문 필요.', tags: ['행정', '수업준비'] },
    { id: 2, author: '박선생', date: '2025-11-28', content: '고1 정규반 테스트 결과 입력 완료.', tags: ['수업', '성적처리'] },
];

export const initialAnnouncements = [
    {id: 1, author: '채수용', date: '2025-11-28', title: '12월 정규 수업 시간표 안내', content: '12월 1일부터 적용되는 정규 수업 시간표를 확인해주세요.<br><br><b>[첨부 파일]</b> 시간표_최종.pdf', isPinned: true, scheduleTime: '2025-11-28T09:00', attachments: ['시간표_최종.pdf'], targetClasses: [], targetStudents: []},
    {id: 2, author: '관리자', date: '2025-11-25', title: '학부모 간담회 안내', content: '학부모님들의 많은 참석 부탁드립니다.', isPinned: false, scheduleTime: '2025-11-25T14:00', attachments: [], targetClasses: [1, 2], targetStudents: []},
];

export const initialTests = [
    { 
        id: 101, 
        name: 'Test 1 (11/15)', 
        maxScore: 100, 
        classId: 1, 
        totalQuestions: 20, 
        date: '2025-11-15', 
        questionScores: Array(20).fill(5),
        questionAnalysis: Array(20).fill({ difficulty: '중', type: '개념' })
    }, 
    { 
        id: 102, 
        name: 'Test 2 (12/01)', 
        maxScore: 100, 
        classId: 1, 
        totalQuestions: 25, 
        date: '2025-12-01', 
        questionScores: Array(25).fill(4),
        questionAnalysis: Array(25).fill({ difficulty: '중', type: '응용' })
    },
    { 
        id: 201, 
        name: 'Test A (11/20)', 
        maxScore: 100, 
        classId: 2, 
        totalQuestions: 10, 
        date: '2025-11-20', 
        questionScores: Array(10).fill(10),
        questionAnalysis: Array(10).fill({ difficulty: '하', type: '개념' })
    },
];

export const initialGrades = {
    1: { 101: { score: 85, correctCount: {} }, 102: { score: 92, correctCount: {} } }, 
    6: { 101: { score: 78, correctCount: {} }, 102: { score: 88, correctCount: {} } }, 
    4: { 101: { score: 95, correctCount: {} }, 102: { score: 95, correctCount: {} } }, 
    2: { 201: { score: 75, correctCount: {} } }, 
    5: {}, 
};

export const initialVideoProgress = {
    4: { 1: { percent: 100, seconds: 0 } }, 
    6: { 3: { percent: 50, seconds: 1800 } } 
};

export const initialClinicLogs = [
    { id: 1, date: '2025-11-29', studentId: 1, studentName: '김민준', checkIn: '14:00', checkOut: '16:30', tutor: '조교A', comment: '미적분 질문 해결 완료. 다음 클리닉 시간 예약함.' },
    { id: 2, date: '2025-11-29', studentId: 4, studentName: '최지우', checkIn: '15:30', checkOut: '17:00', tutor: '조교B', comment: '수학(상) 오답노트 작성 지도. 복소수 파트 이해 부족 확인.' },
];

export const initialPayments = [
    { id: 1, studentId: 1, studentName: '김민준', amount: 350000, date: '2025-11-01', status: '완납', method: '카드', month: '11월' },
    { id: 2, studentId: 2, studentName: '이서연', amount: 300000, date: '2025-11-05', status: '미납', method: '-', month: '11월' },
];

// ✅ [수정] 타학원 스케줄 데이터 구조 변경
export const initialExternalSchedules = [
    { 
        id: 1, 
        studentId: 1, 
        academyName: '정상어학원', 
        courseName: 'TOP반 영어',
        instructor: 'Julie',
        startDate: '2025-11-01',
        endDate: '2025-12-31',
        days: ['월', '수'], 
        startTime: '16:00', 
        endTime: '18:00' 
    },
    { 
        id: 2, 
        studentId: 1, 
        academyName: '최강논술', 
        courseName: '인문논술 기초',
        instructor: '김논술',
        startDate: '2025-11-01',
        endDate: '2025-12-31',
        days: ['토'], 
        startTime: '10:00', 
        endTime: '12:00' 
    },
];