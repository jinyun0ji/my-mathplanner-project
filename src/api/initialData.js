// src/api/initialData.js

// ✅ [수정] status: '재원' -> '재원생' (코드의 필터링 조건과 일치시킴)
export const initialStudents = [
    { id: 'stu-1', name: '김민준', grade: '고1', school: '서울고', phone: '010-1111-2222', parentPhone: '010-9999-8888', status: '재원생', registeredDate: '2025-03-01', classes: [1], consultationHistory: [], books: [1, 2] },
    { id: 'stu-2', name: '이서연', grade: '중3', school: '서초중', phone: '010-3333-4444', parentPhone: '010-7777-6666', status: '재원생', registeredDate: '2025-03-05', classes: [2], consultationHistory: [], books: [3] },
    { id: 'stu-3', name: '박지훈', grade: '고2', school: '반포고', phone: '010-5555-6666', parentPhone: '010-5555-4444', status: '재원생', registeredDate: '2025-02-20', classes: [1], consultationHistory: [], books: [1] },
    { id: 'stu-4', name: '최지우', grade: '고1', school: '세화여고', phone: '010-7777-8888', parentPhone: '010-3333-2222', status: '재원생', registeredDate: '2025-04-10', classes: [1], consultationHistory: [], books: [2] },
    { id: 'stu-5', name: '정수민', grade: '중2', school: '경원중', phone: '010-9999-0000', parentPhone: '010-1111-0000', status: '휴원', registeredDate: '2025-01-15', classes: [], consultationHistory: [], books: [] },
    { id: 'stu-6', name: '강동원', grade: '고3', school: '현대고', phone: '010-1234-5678', parentPhone: '010-8765-4321', status: '재원생', registeredDate: '2025-05-01', classes: [1, 2], consultationHistory: [], books: [1, 3] },
];

// ✅ [수정] 강사 이름을 모두 '채수용'으로 통일
export const initialClasses = [
    { id: 1, name: '고1 수학(상) 정규반', teacher: '채수용', type: '정규', days: ['월', '수', '금'], students: ['stu-1', 'stu-3', 'stu-4', 'stu-6'], schedule: { days: ['월', '수', '금'], time: '18:00~20:00' }, startDate: '2025-11-01', endDate: '2025-12-31', books: [1, 2] },
    { id: 2, name: '중3 수학 심화반', teacher: '채수용', type: '특강', days: ['화', '목'], students: ['stu-2', 'stu-6'], schedule: { days: ['화', '목'], time: '19:00~21:00' }, startDate: '2025-11-01', endDate: '2025-12-31', books: [3] },
];

// ✅ [수정] 1, 2, 3회차 영상 iframeCode 업데이트
export const initialLessonLogs = [
    { 
        id: 1, classId: 1, date: '2025-11-03', progress: '다항식의 연산 (1)', assignment: 'p.10~15 문제 풀이', 
        // ✅ [수정] 단일 링크 -> 다중 자료 배열로 변경
        materials: [
            { name: '01_개념정리.pdf', url: '#' },
            { name: '01_필기노트.pdf', url: '#' },
            { name: '워크북_문제편.pdf', url: '#' }
        ],
        iframeCode: '<iframe width="560" height="315" src="https://www.youtube.com/embed/PLPVxWCrXqY?si=q8Eq2XHrQiwSQHHJ" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>' 
    },
    { 
        id: 2, classId: 1, date: '2025-11-05', progress: '다항식의 연산 (2)', assignment: 'p.16~20 문제 풀이', 
        materials: [
            { name: '02_개념정리.pdf', url: '#' },
            { name: '데일리_테스트.pdf', url: '#' }
        ],
        iframeCode: '<iframe width="560" height="315" src="https://www.youtube.com/embed/F0oh9Mmhl1w?si=_RkZ_8doDeCf1Y2s" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>' 
    },
    { 
        id: 3, classId: 1, date: '2025-11-07', progress: '나머지정리', assignment: 'p.21~25 문제 풀이', 
        materials: [], // 자료 없음
        iframeCode: '<iframe width="560" height="315" src="https://www.youtube.com/embed/XnZYxOyWD0c?si=hqvM7bBgY-cZZqLH" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>' 
    },
];

export const initialAttendanceLogs = [
    { id: 1, classId: 1, date: '2025-11-03', studentId: 'stu-1', status: '출석', time: '17:55' },
    { id: 2, classId: 1, date: '2025-11-03', studentId: 'stu-3', status: '지각', time: '18:10' },
    { id: 3, classId: 1, date: '2025-11-03', studentId: 'stu-4', status: '결석', time: '-' },
];

export const initialStudentMemos = {
    'stu-1': "수학에 흥미가 많으나 계산 실수가 잦음.",
    'stu-2': "기하 부분에 강점이 있음.",
};

export const initialHomeworkAssignments = [
    { id: 1, classId: 1, date: '2025-11-03', content: '쎈 수학 p.30-35', book: '쎈 수학(상)', totalQuestions: 20, students: ['stu-1', 'stu-3', 'stu-4', 'stu-6'], deadline: '2025-11-05' },
    { id: 2, classId: 1, date: '2025-11-05', content: '일품 p.10-15', book: '일품 수학(상)', totalQuestions: 15, students: ['stu-1', 'stu-3', 'stu-4', 'stu-6'], deadline: '2025-11-07' },
];

export const initialHomeworkResults = {
    'stu-1': { 
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

// ✅ [수정] 성적 데이터 상세 입력 (문항별 채점 결과 추가)
export const initialGrades = {
    // 1번 학생 (김민준)
    'stu-1': {
        // Test 101 (20문항, 5점씩, 85점 -> 3개 틀림)
        101: { 
            score: 85, 
            correctCount: {
                1: '맞음', 2: '맞음', 3: '틀림', 4: '맞음', 5: '맞음',
                6: '맞음', 7: '맞음', 8: '틀림', 9: '맞음', 10: '맞음',
                11: '맞음', 12: '맞음', 13: '맞음', 14: '맞음', 15: '틀림',
                16: '맞음', 17: '맞음', 18: '맞음', 19: '맞음', 20: '맞음'
            } 
        }, 
        // Test 102 (25문항, 4점씩, 92점 -> 2개 틀림)
        102: { 
            score: 92, 
            correctCount: {
                1: '맞음', 2: '맞음', 3: '맞음', 4: '맞음', 5: '맞음',
                6: '맞음', 7: '틀림', 8: '맞음', 9: '맞음', 10: '맞음',
                11: '맞음', 12: '맞음', 13: '맞음', 14: '맞음', 15: '맞음',
                16: '맞음', 17: '맞음', 18: '맞음', 19: '틀림', 20: '맞음',
                21: '맞음', 22: '맞음', 23: '맞음', 24: '맞음', 25: '맞음'
            } 
        } 
    }, 
    // 6번 학생 (데이터 보강)
    'stu-6': {
        101: { score: 78, correctCount: {} }, 
        102: { score: 88, correctCount: {} } 
    }, 
    // 4번 학생
    'stu-4': {
        101: { score: 95, correctCount: {} }, 
        102: { score: 95, correctCount: {} } 
    }, 
    // 2번 학생
    'stu-2': {
        201: { score: 75, correctCount: {} } 
    }, 
    // 5번 학생 (미응시)
    'stu-5': {}, 
};

export const initialVideoProgress = {
    'stu-4': { 1: { percent: 100, seconds: 0 } }, 
    'stu-6': { 3: { percent: 50, seconds: 1800 } } 
};

export const initialClinicLogs = [
    { id: 1, date: '2025-11-29', studentId: 'stu-1', studentName: '김민준', checkIn: '14:00', checkOut: '16:30', tutor: '조교A', comment: '미적분 질문 해결 완료. 다음 클리닉 시간 예약함.' },
    { id: 2, date: '2025-11-29', studentId: 'stu-4', studentName: '최지우', checkIn: '15:30', checkOut: '17:00', tutor: '조교B', comment: '수학(상) 오답노트 작성 지도. 복소수 파트 이해 부족 확인.' },
];

export const initialPayments = [
    { id: 1, studentId: 'stu-1', studentName: '김민준', amount: 350000, date: '2025-11-01', status: '완납', method: '카드', month: '11월' },
    { id: 2, studentId: 'stu-2', studentName: '이서연', amount: 300000, date: '2025-11-05', status: '미납', method: '-', month: '11월' },
];

// ✅ [수정] 타학원 스케줄 데이터 구조 변경
export const initialExternalSchedules = [
    { 
        id: 1, 
        studentId: 'stu-1', 
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
        studentId: 'stu-1', 
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