// src/api/initialData.js

// --- 데이터 샘플 ---
export const initialStudents = [
  // books: 학생별 보유 교재 목록 추가 
  { id: 1, name: '김민준', school: '대한고등학교', grade: 2, phone: '010-1234-5678', parentPhone: '010-8765-4321', status: '재원생', registeredDate: '2025-03-05', classes: [1], paymentStatus: '완납', bookReceived: true, books: ['수학(상) RPM', '블랙라벨 수학(상)'], clinicTime: '14:00' },
  { id: 2, name: '이서연', school: '민국고등학교', grade: 2, phone: '010-2345-6789', parentPhone: '010-7654-3210', status: '재원생', registeredDate: '2025-03-05', classes: [2], paymentStatus: '미납', bookReceived: false, books: ['개념원리 수학I'], clinicTime: '15:30' },
  { id: 3, name: '박하준', school: '사랑고등학교', grade: 2, phone: '010-3456-7890', parentPhone: '010-6543-2109', status: '상담생', registeredDate: '2025-02-15', classes: [], paymentStatus: '해당없음', bookReceived: false, books: [], clinicTime: null },
  { id: 4, name: '최지우', school: '대한고등학교', grade: 2, phone: '010-4567-8901', parentPhone: '010-5432-1098', status: '재원생', registeredDate: '2025-03-20', classes: [1], paymentStatus: '완납', bookReceived: true, books: ['수학(상) RPM'] },
  { id: 5, name: '정다은', school: '대한국제고', grade: 1, phone: '010-5678-9012', parentPhone: '010-4321-0987', status: '재원생', registeredDate: '2025-09-01', classes: [3], paymentStatus: '완납', bookReceived: true, books: ['고1 정석'] },
  { id: 6, name: '윤채원', school: '대한고등학교', grade: 2, phone: '010-6789-0123', parentPhone: '010-3210-9876', status: '재원생', registeredDate: '2025-08-01', classes: [1], paymentStatus: '완납', bookReceived: false, books: ['수학(상) RPM'] },
  { id: 7, name: '홍길동', school: '상문고등학교', grade: 2, phone: '010-2002-0220', parentPhone: '010-2200-0022', status: '퇴원생', registeredDate: '2025-01-01', classes: [3], paymentStatus: '완납', bookReceived: true, books: [] },
];

export const initialClasses = [
    // A1반: 월, 금 / 시작일 11/01 (금)
    { id: 1, name: '고2 A1반', teacher: '채수용', students: [1, 6, 4], grade: 2, schoolType: '고등학교', startDate: '2025-11-01', endDate: '2025-12-31', schedule: { days: ['월', '금'], time: '19:00~21:00' } },
    // A2반: 화, 목 / 시작일 11/05 (화)
    { id: 2, name: '고2 A2반', teacher: '채수용', students: [2], grade: 2, schoolType: '고등학교', startDate: '2025-11-05', endDate: '2025-12-31', schedule: { days: ['화', '목'], time: '19:00~21:00' } },
    { id: 3, name: '고1 국제고반', teacher: '이선생', students: [5], grade: 1, schoolType: '고등학교', startDate: '2025-10-01', endDate: '2025-12-31', schedule: { days: ['금'], time: '17:00~20:00' } },
];

export const initialLessonLogs = [
    // progress 필드에 예약 시간 필드 추가: scheduleTime
    { id: 1, classId: 1, date: '2025-11-03', progress: '다항식의 연산 P.12 ~ P.18', iframeCode: '<iframe width="560" height="315" src="https://www.youtube.com/embed/PLPVxWCrXqY?si=RRo3fyyC4Vj44iZp" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>', materialUrl: '수업자료_1103.pdf', scheduleTime: '2025-11-03T21:30' }, 
    { id: 2, classId: 2, date: '2025-11-04', progress: '집합의 개념 및 포함 관계', iframeCode: '', materialUrl: '수업자료_1104.pdf', scheduleTime: '2025-11-04T21:30' }, 
    { id: 3, classId: 1, date: '2025-11-07', progress: '나머지 정리', iframeCode: '', materialUrl: '', scheduleTime: '2025-11-07T21:30' }, 
    { id: 4, classId: 1, date: '2025-11-10', progress: '인수분해', iframeCode: '', materialUrl: '', scheduleTime: '2025-11-10T21:30' }, 
    { id: 5, classId: 1, date: '2025-11-14', progress: '복소수', iframeCode: '', materialUrl: '', scheduleTime: '2025-11-14T21:30' }, 
];

export const initialAttendanceLogs = [
    // 수정된 수업일에 맞게 조정
    { id: 101, classId: 1, date: '2025-11-03', studentId: 1, status: '출석' },
    { id: 102, classId: 1, date: '2025-11-03', studentId: 6, status: '결석' },
    { id: 103, classId: 1, date: '2025-11-03', studentId: 4, status: '출석' },
    { id: 104, classId: 2, date: '2025-11-04', studentId: 2, status: '지각' },
    { id: 105, classId: 1, date: '2025-11-07', studentId: 6, status: '동영상보강' }, 
];

export const initialStudentMemos = {
    1: '김민준 학생은 꼼꼼하지만, 서술형에서 자주 감점됨. 학부모님께 매주 피드백 전달 완료.',
    4: '최지우 학생은 7월에 수학 상 심화반으로 이동 예정. 선행 진도 체크 필요.',
};


export const initialHomeworkAssignments = [
    { id: 1, classId: 1, date: '2025-11-03', content: 'RPM P.10 ~ P.15', students: [1, 4, 6], startQuestion: 1, endQuestion: 30, totalQuestions: 30, isAssignmentDate: true, book: '수학(상) RPM' },
    { id: 2, classId: 2, date: '2025-11-04', content: '개념원리 P.20 ~ P.25', students: [2], startQuestion: 5, endQuestion: 24, totalQuestions: 20, isAssignmentDate: true, book: '개념원리 수학I' },
];

export const initialHomeworkResults = {
    1: { 
        1: { 
            "1": "맞음", "2": "맞음", "3": "틀림", "4": "고침", "5": "맞음", 
            "6": "맞음", "7": "맞음", "8": "맞음", "9": "맞음", "10": "맞음",
        } 
    },
    4: { 
        1: { 
            "1": "맞음", "2": "틀림", "3": "틀림", "4": "고침", "5": "맞음", 
        } 
    },  
    6: { 1: {} }, 
    2: { 2: { "5": "맞음", "6": "틀림", "7": "맞음", "8": "고침", "9": "맞음" } }, 
};


// 🚨 수납 내역 데이터 수정: 월별 상세 납부 내역 포함
export const initialPayments = [
    { 
        studentId: 1, 
        studentName: '김민준', 
        months: {
            '2025-10': { status: '완납', amount: 300000, date: '2025-10-01' },
            '2025-11': { status: '완납', amount: 300000, date: '2025-11-01' },
            '2025-12': { status: '미납', amount: 300000, date: null }
        },
        books: [{name: '수학(상) RPM', price: 15000, status: '완납'}, {name: '블랙라벨 수학(상)', price: 17000, status: '완납'}], 
    },
    { 
        studentId: 2, 
        studentName: '이서연', 
        months: {
            '2025-11': { status: '미납', amount: 280000, date: null },
            '2025-12': { status: '미납', amount: 280000, date: null }
        },
        books: [{name: '개념원리 수학I', price: 18000, status: '미납'}], 
    },
    { 
        studentId: 4, 
        studentName: '최지우', 
        months: {
            '2025-11': { status: '완납', amount: 300000, date: '2025-11-05' },
        },
        books: [{name: '수학(상) RPM', price: 15000, status: '완납'}], 
    },
];

export const initialWorkLogs = [
    {id: 1, author: '김선생', date: '2025-11-20', content: '중2 심화 A반 교재 재고 확인 필요. 3부 부족.', isEdit: false},
    {id: 2, author: '채수용', date: '2025-11-22', content: '박하준 학생 상담 완료. 7월부터 수강 희망.', isEdit: false},
];

export const initialAnnouncements = [
    // targetClasses, targetStudents 필드 추가 (특정 대상에게만 노출되는 모의 기능)
    {id: 1, author: '채수용', date: '2025-11-28', title: '12월 정규 수업 시간표 안내', content: '12월 1일부터 적용되는 정규 수업 시간표를 확인해주세요.<br><br><b>[첨부 파일]</b> 시간표_최종.pdf', isPinned: true, scheduleTime: '2025-11-28T09:00', attachments: ['시간표_최종.pdf'], targetClasses: [], targetStudents: []},
    {id: 2, author: '관리자', date: '2025-11-25', title: '학부모 간담회 안내', content: '학부모님들의 많은 참석 부탁드립니다.', isPinned: false, scheduleTime: '2025-11-25T14:00', attachments: [], targetClasses: [1, 2], targetStudents: []},
];

// 🚨 시험 데이터 수정: questionAnalysis 필드 추가
export const initialTests = [
    { 
        id: 101, 
        name: 'Test 1 (11/15)', 
        maxScore: 100, 
        classId: 1, 
        totalQuestions: 20, 
        date: '2025-11-15', 
        questionScores: Array(20).fill(5),
        // 🚨 난이도 및 유형 분석 데이터 추가 (총 20문항)
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

// grades: { studentId: { testId: { score: number | null, correctCount: resultMapping | undefined } } }
export const initialGrades = {
    1: { 101: { score: 85, correctCount: {} }, 102: { score: 92, correctCount: {} } }, 
    6: { 101: { score: 78, correctCount: {} }, 102: { score: 88, correctCount: {} } }, 
    4: { 101: { score: 95, correctCount: {} }, 102: { score: 95, correctCount: {} } }, 
    2: { 201: { score: 75, correctCount: {} } }, 
    5: {}, 
};

export const initialVideoProgress = {
    // 1: { 1: 85 }, 
    4: { 1: 100 }, 
    6: { 3: 50 } 
};

export const initialClinicLogs = [
    { id: 1, date: '2025-11-29', studentId: 1, studentName: '김민준', checkIn: '14:00', checkOut: '16:30', tutor: '조교A', comment: '미적분 질문 해결 완료. 다음 클리닉 시간 예약함.' },
    { id: 2, date: '2025-11-29', studentId: 4, studentName: '최지우', checkIn: '15:30', checkOut: '17:00', tutor: '조교B', comment: '수학(상) 오답노트 작성 지도. 복소수 파트 이해 부족 확인.' },
];
