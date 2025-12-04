import React, { useState, useEffect, useCallback, useRef } from 'react';

// --- 데이터 샘플 ---
// 2025년 11월 달력 확인: 11/1(금), 11/3(월), 11/4(화), 11/5(수), 11/6(목), 11/7(금), 11/10(월), 11/11(화)...
const initialStudents = [
  // books: 학생별 보유 교재 목록 추가 
  { id: 1, name: '김민준', school: '대한고등학교', grade: 2, phone: '010-1234-5678', parentPhone: '010-8765-4321', status: '재원생', registeredDate: '2025-03-05', classes: [1], paymentStatus: '완납', bookReceived: true, books: ['수학(상) RPM', '블랙라벨 수학(상)'], clinicTime: '14:00' },
  { id: 2, name: '이서연', school: '민국고등학교', grade: 2, phone: '010-2345-6789', parentPhone: '010-7654-3210', status: '재원생', registeredDate: '2025-03-05', classes: [2], paymentStatus: '미납', bookReceived: false, books: ['개념원리 수학I'], clinicTime: '15:30' },
  { id: 3, name: '박하준', school: '사랑고등학교', grade: 2, phone: '010-3456-7890', parentPhone: '010-6543-2109', status: '상담생', registeredDate: '2025-02-15', classes: [], paymentStatus: '해당없음', bookReceived: false, books: [], clinicTime: null },
  { id: 4, name: '최지우', school: '대한고등학교', grade: 2, phone: '010-4567-8901', parentPhone: '010-5432-1098', status: '재원생', registeredDate: '2025-03-20', classes: [1], paymentStatus: '완납', bookReceived: true, books: ['수학(상) RPM'] },
  { id: 5, name: '정다은', school: '대한국제고', grade: 1, phone: '010-5678-9012', parentPhone: '010-4321-0987', status: '재원생', registeredDate: '2025-09-01', classes: [3], paymentStatus: '완납', bookReceived: true, books: ['고1 정석'] },
  { id: 6, name: '윤채원', school: '대한고등학교', grade: 2, phone: '010-6789-0123', parentPhone: '010-3210-9876', status: '재원생', registeredDate: '2025-08-01', classes: [1], paymentStatus: '완납', bookReceived: false, books: ['수학(상) RPM'] },
  { id: 7, name: '홍길동', school: '상문고등학교', grade: 2, phone: '010-2002-0220', parentPhone: '010-2200-0022', status: '퇴원생', registeredDate: '2025-01-01', classes: [3], paymentStatus: '완납', bookReceived: true, books: [] },
];

const initialClasses = [
    // A1반: 월, 금 / 시작일 11/01 (금)
    { id: 1, name: '고2 A1반', teacher: '채수용', students: [1, 6, 4], grade: 2, schoolType: '고등학교', startDate: '2025-11-01', endDate: '2025-12-31', schedule: { days: ['월', '금'], time: '19:00~21:00' } },
    // A2반: 화, 목 / 시작일 11/05 (화)
    { id: 2, name: '고2 A2반', teacher: '채수용', students: [2], grade: 2, schoolType: '고등학교', startDate: '2025-11-05', endDate: '2025-12-31', schedule: { days: ['화', '목'], time: '19:00~21:00' } },
    { id: 3, name: '고1 국제고반', teacher: '이선생', students: [5], grade: 1, schoolType: '고등학교', startDate: '2025-10-01', endDate: '2025-12-31', schedule: { days: ['금'], time: '17:00~20:00' } },
];

const initialLessonLogs = [
    // progress 필드에 예약 시간 필드 추가: scheduleTime
    { id: 1, classId: 1, date: '2025-11-03', progress: '다항식의 연산 P.12 ~ P.18', iframeCode: '<iframe width="560" height="315" src="https://www.youtube.com/embed/mWkuigsWe4A" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>', materialUrl: '수업자료_1103.pdf', scheduleTime: '2025-11-03T21:30' }, 
    { id: 2, classId: 2, date: '2025-11-04', progress: '집합의 개념 및 포함 관계', iframeCode: '', materialUrl: '수업자료_1104.pdf', scheduleTime: '2025-11-04T21:30' }, 
    { id: 3, classId: 1, date: '2025-11-07', progress: '나머지 정리', iframeCode: '', materialUrl: '', scheduleTime: '2025-11-07T21:30' }, 
    { id: 4, classId: 1, date: '2025-11-10', progress: '인수분해', iframeCode: '', materialUrl: '', scheduleTime: '2025-11-10T21:30' }, 
    { id: 5, classId: 1, date: '2025-11-14', progress: '복소수', iframeCode: '', materialUrl: '', scheduleTime: '2025-11-14T21:30' }, 
];

const initialAttendanceLogs = [
    // 수정된 수업일에 맞게 조정
    { id: 101, classId: 1, date: '2025-11-03', studentId: 1, status: '출석' },
    { id: 102, classId: 1, date: '2025-11-03', studentId: 6, status: '결석' },
    { id: 103, classId: 1, date: '2025-11-03', studentId: 4, status: '출석' },
    { id: 104, classId: 2, date: '2025-11-04', studentId: 2, status: '지각' },
    { id: 105, classId: 1, date: '2025-11-07', studentId: 6, status: '동영상보강' }, 
];

const initialStudentMemos = {
    1: '김민준 학생은 꼼꼼하지만, 서술형에서 자주 감점됨. 학부모님께 매주 피드백 전달 완료.',
    4: '최지우 학생은 7월에 수학 상 심화반으로 이동 예정. 선행 진도 체크 필요.',
};


const initialHomeworkAssignments = [
    { id: 1, classId: 1, date: '2025-11-03', content: 'RPM P.10 ~ P.15', students: [1, 4, 6], startQuestion: 1, endQuestion: 30, totalQuestions: 30, isAssignmentDate: true, book: '수학(상) RPM' },
    { id: 2, classId: 2, date: '2025-11-04', content: '개념원리 P.20 ~ P.25', students: [2], startQuestion: 5, endQuestion: 24, totalQuestions: 20, isAssignmentDate: true, book: '개념원리 수학I' },
];

const initialHomeworkResults = {
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


const initialPayments = [
    { studentId: 1, studentName: '김민준', books: [{name: '수학(상) RPM', price: 15000, status: '완납'}, {name: '블랙라벨 수학(상)', price: 17000, status: '완납'}], total: 32000, received: true },
    { studentId: 2, studentName: '이서연', books: [{name: '개념원리 수학I', price: 18000, status: '미납'}], total: 18000, received: false },
];

const initialWorkLogs = [
    {id: 1, author: '김선생', date: '2025-11-20', content: '중2 심화 A반 교재 재고 확인 필요. 3부 부족.', isEdit: false},
    {id: 2, author: '채수용', date: '2025-11-22', content: '박하준 학생 상담 완료. 7월부터 수강 희망.', isEdit: false},
];

const initialAnnouncements = [
    // targetClasses, targetStudents 필드 추가 (특정 대상에게만 노출되는 모의 기능)
    {id: 1, author: '채수용', date: '2025-11-28', title: '12월 정규 수업 시간표 안내', content: '12월 1일부터 적용되는 정규 수업 시간표를 확인해주세요.<br><br><b>[첨부 파일]</b> 시간표_최종.pdf', isPinned: true, scheduleTime: '2025-11-28T09:00', attachments: ['시간표_최종.pdf'], targetClasses: [], targetStudents: []},
    {id: 2, author: '관리자', date: '2025-11-25', title: '학부모 간담회 안내', content: '학부모님들의 많은 참석 부탁드립니다.', isPinned: false, scheduleTime: '2025-11-25T14:00', attachments: [], targetClasses: [1, 2], targetStudents: []},
];

const initialTests = [
    { id: 101, name: 'Test 1 (11/15)', maxScore: 100, classId: 1, totalQuestions: 20, questionScore: 5, date: '2025-11-15' }, 
    { id: 102, name: 'Test 2 (12/01)', maxScore: 100, classId: 1, totalQuestions: 25, questionScore: 4, date: '2025-12-01' },
    { id: 201, name: 'Test A (11/20)', maxScore: 100, classId: 2, totalQuestions: 10, questionScore: 10, date: '2025-11-20' },
];

const initialGrades = {
    1: { 101: { score: 85, correctCount: 17 }, 102: { score: 92, correctCount: 23 } }, 
    6: { 101: { score: 78, correctCount: 15.6 }, 102: { score: 88, correctCount: 22 } }, 
    4: { 101: { score: 95, correctCount: 19 }, 102: { score: 95, correctCount: 23.75 } }, 
    2: { 201: { score: 75, correctCount: 7.5 } }, 
    5: {}, 
};

const initialVideoProgress = {
    1: { 1: 85 }, 
    4: { 1: 100 }, 
    6: { 3: 50 } 
};

const initialClinicLogs = [
    { id: 1, date: '2025-11-29', studentId: 1, studentName: '김민준', checkIn: '14:00', checkOut: '16:30', tutor: '조교A', comment: '미적분 질문 해결 완료. 다음 클리닉 시간 예약함.' },
    { id: 2, date: '2025-11-29', studentId: 4, studentName: '최지우', checkIn: '15:30', checkOut: '17:00', tutor: '조교B', comment: '수학(상) 오답노트 작성 지도. 복소수 파트 이해 부족 확인.' },
];

// --- 유틸리티 및 아이콘 컴포넌트 ---
const Icon = ({ name, className }) => {
  const icons = {
    dashboard: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    school: <><path d="M14 22v-4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v4"/><path d="M18 10a2 2 0 0 0-2-2h-1"/><path d="M12 2h6v6"/><path d="M2 10V5a2 2 0 0 1 2-2h4v6z"/><path d="M6 18v-4"/><path d="M10 18v-4"/></>,
    logOut: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></>,
    plus: <><path d="M5 12h14"/><path d="M12 5v14"/></>,
    search: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>,
    edit: <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>,
    trash: <><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
    x: <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
    fileText: <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y1="9"/></>,
    messageSquare: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>,
    graduationCap: <><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3.33 1.67 6.67 1.67 10 0v-5"/></>,
    wallet: <><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5h-2.43a2 2 0 0 1-1.94-1.51L15 9H5a2 2 0 0 0-2 2Z"/></>,
    barChart: <><path d="M12 20V10M18 20V4M6 20v-6"/></>,
    clipboardCheck: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M10 12L12 14L18 8"/></>,
    bookOpen: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>,
    calendar: <><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></>, 
    chevronDown: <path d="m6 9 6 6 6-6"/>,
    chevronUp: <path d="m18 15-6-6-6 6"/>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></>,
    send: <path d="m22 2-7 20-4-9-9-4 20-7Z"/>,
    pin: <path d="M12 17v-4h4l-4-9V2h-4v2l4 9h-4v4h-2v2h12v-2z"/>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    // 🚨 알림 아이콘 추가
    bell: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.424-3.535A12 12 0 0012 3c-4.707 0-9.155 1.34-12 3.861M12 3c-4.707 0-9.155 1.34-12 3.861m12 10.221v3.375c0 .375-.375.75-.75.75H12c-.375 0-.75-.375-.75-.75v-3.375m-4.5 0h9m-9 0h9" /></svg>,
    monitor: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 14.25v-2.75a3 3 0 00-3-3h-2.25M15.75 14.25l-2.75 2.75m2.75-2.75l-2.75-2.75m1.5-12.25H7.5A2.25 2.25 0 005.25 4.5v15a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25V9M12 11.25h.008v.008H12V11.25zM12 14.25h.008v.008H12V14.25zM12 17.25h.008v.008H12V17.25z" /></svg>,
  };
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{icons[name]}</svg>;
};

/**
 * 클래스 스케줄과 개강일을 기반으로 수업 회차 목록을 계산합니다.
 */
const calculateClassSessions = (cls) => {
    if (!cls || !cls.startDate || !cls.schedule || cls.schedule.days.length === 0) return [];

    const parts = cls.startDate.split('-');
    const start = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
    
    const today = new Date();
    const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())); 
    
    const sessions = [];
    let sessionCount = 1;

    const dayMap = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
    const scheduledDays = cls.schedule.days.map(day => dayMap[day]).filter(d => d !== undefined);
    
    let currentDate = new Date(start);

    while (currentDate <= end) {
        if (scheduledDays.includes(currentDate.getUTCDay())) {
            sessions.push({
                session: sessionCount++,
                date: currentDate.toISOString().slice(0, 10)
            });
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return sessions;
};

// --- 모달 컴포넌트 ---

const Modal = ({ children, isOpen, onClose, title, maxWidth = 'max-w-2xl' }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-xl shadow-2xl w-full ${maxWidth} p-6 relative`}>
                <h3 className="text-lg font-bold mb-4 border-b pb-2">{title}</h3> 
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
                    <Icon name="x" className="w-5 h-5" /> 
                </button>
                {children}
            </div>
        </div>
    );
};

const MemoModal = ({ isOpen, onClose, onSave, studentId, initialContent, studentName }) => {
    const [content, setContent] = useState(initialContent || '');

    useEffect(() => {
        setContent(initialContent || '');
    }, [initialContent]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(studentId, content);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${studentName} 학생 메모`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="학생에 대한 중요한 코멘트나 상담 내용을 입력하세요."
                    rows="6"
                    className="p-3 border text-sm rounded-lg w-full focus:ring-blue-500 focus:border-blue-500"
                />
                <button type="submit" className="w-full bg-blue-600 text-white text-sm font-bold py-2 rounded-lg hover:bg-blue-700">
                    메모 저장
                </button>
            </form>
        </Modal>
    );
}

const ClassFormModal = ({ isOpen, onClose, onSave, classToEdit = null }) => {
    const isEdit = !!classToEdit;
    const defaultDate = new Date().toISOString().slice(0, 10);
    
    const [formData, setFormData] = useState({
        name: classToEdit?.name || '',
        teacher: classToEdit?.teacher || '채수용', 
        startDate: classToEdit?.startDate || defaultDate,
        endDate: classToEdit?.endDate || defaultDate,
        days: classToEdit?.schedule?.days || [],
        time: classToEdit?.schedule?.time || '19:00~21:00', 
        memo: classToEdit?.memo || '',
    });
    
    useEffect(() => {
        setFormData({
            name: classToEdit?.name || '',
            teacher: classToEdit?.teacher || '채수용', 
            startDate: classToEdit?.startDate || defaultDate,
            endDate: classToEdit?.endDate || defaultDate,
            days: classToEdit?.schedule?.days || [],
            time: classToEdit?.schedule?.time || '19:00~21:00', 
            memo: classToEdit?.memo || '',
        });
    }, [classToEdit]);

    const WEEK_DAYS = ['월', '화', '수', '목', '금', '토', '일'];

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDayToggle = (day) => {
        setFormData(prev => ({
            ...prev,
            days: prev.days.includes(day)
                ? prev.days.filter(d => d !== day)
                : [...prev.days, day].sort((a, b) => WEEK_DAYS.indexOf(a) - WEEK_DAYS.indexOf(b))
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name || formData.days.length === 0) {
            alert("클래스명과 최소 하나 이상의 요일을 선택해야 합니다.");
            return;
        }

        const classData = {
            id: isEdit ? classToEdit.id : Date.now(),
            name: formData.name,
            teacher: formData.teacher,
            startDate: formData.startDate,
            endDate: formData.endDate,
            schedule: { days: formData.days, time: formData.time },
            memo: formData.memo,
            students: isEdit ? classToEdit.students : [], 
            schoolType: classToEdit?.schoolType || '고등학교', 
            grade: classToEdit?.grade || 1, 
        };

        onSave(classData, isEdit);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `${classToEdit.name} 클래스 정보 수정` : "새 클래스 추가"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input 
                    type="text" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleChange} 
                    placeholder="클래스명 (예: 고2 심화 B반)" 
                    required 
                    className="p-2 border text-sm rounded w-full" 
                    autoComplete="off" 
                />
                
                <div className="grid grid-cols-2 gap-4">
                    <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} placeholder="개강일" required className="p-2 border text-sm rounded w-full" />
                    <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} placeholder="종강일" required className="p-2 border text-sm rounded w-full" />
                </div>
                <input type="text" name="time" value={formData.time} onChange={handleChange} placeholder="수업 시간 (예: 19:00~21:00)" required className="p-2 border text-sm rounded w-full" />
                
                {/* 반복 요일 선택 */}
                <div className="border p-3 rounded-lg">
                    <label className="block font-semibold mb-2 text-sm">반복 요일 선택:</label>
                    <div className="flex flex-wrap gap-2">
                        {WEEK_DAYS.map(day => (
                            <button
                                key={day}
                                type="button"
                                onClick={() => handleDayToggle(day)}
                                className={`px-3 py-1 text-xs rounded-full font-semibold transition-all duration-150 ${
                                    formData.days.includes(day) ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                {day}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-red-500 mt-2">* 휴강/보강일은 별도 메모에 기록해주세요.</p>
                </div>

                <textarea
                    name="memo"
                    value={formData.memo}
                    onChange={handleChange}
                    placeholder="클래스 관련 특이사항 (휴강/보강 일정 등)"
                    rows="3"
                    className="p-2 border text-sm rounded w-full"
                />

                <button type="submit" className="w-full bg-green-600 text-white text-sm font-bold py-2 rounded-lg hover:bg-green-700">
                    {isEdit ? '클래스 정보 수정' : '클래스 개설'}
                </button>
            </form>
        </Modal>
    );
};

// 수업 일지 등록/수정 모달 
const LessonLogFormModal = ({ isOpen, onClose, onSave, classId, log = null, classes, calculateClassSessions, defaultDate = null, students, logNotification }) => {
    const isEdit = !!log;
    const selectedClass = classes.find(c => c.id === classId);
    const sessions = selectedClass ? calculateClassSessions(selectedClass) : [];

    // 현재 시간을 ISO 8601 형식의 YYYY-MM-DDThh:mm으로 변환
    const now = new Date();
    const defaultDateTime = now.toISOString().slice(0, 16);
    
    const [formData, setFormData] = useState({
        date: log?.date || defaultDate || new Date().toISOString().slice(0, 10),
        progress: log?.progress || '',
        iframeCode: log?.iframeCode || '', 
        materialFileName: log?.materialUrl || '', 
        scheduleTime: log?.scheduleTime || defaultDateTime, // 🚨 예약 시간 필드 추가
    });
    
    // defaultDate가 변경될 때마다 폼 상태 업데이트
    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            date: log?.date || defaultDate || new Date().toISOString().slice(0, 10),
            progress: log?.progress || '',
            iframeCode: log?.iframeCode || '', 
            materialFileName: log?.materialUrl || '',
            scheduleTime: log?.scheduleTime || defaultDateTime, // 🚨 예약 시간 필드 업데이트
        }));
    }, [log, defaultDate]);


    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    // 파일 업로드 핸들러 (모의)
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData(prev => ({
                ...prev,
                materialFileName: file.name
            }));
            alert(`[${file.name}] 파일이 성공적으로 모의 업로드되었습니다. (실제 서버 저장 필요)`);
        }
    }


    const handleSubmit = (e) => {
        e.preventDefault();
        
        // --- 수업 날짜 유효성 검사 ---
        const isScheduledDay = sessions.some(s => s.date === formData.date);
        
        if (!isScheduledDay) {
            const confirm = window.confirm(
                `선택된 날짜(${formData.date})는 ${selectedClass.name}의 정규 수업일이 아닙니다.\n그래도 수업 일지를 등록하시겠습니까? (휴강/보강일 경우 '확인'을 눌러주세요)`
            );
            if (!confirm) {
                return;
            }
        }
        // ------------------------------------
        
        const dataToSave = {
            id: isEdit ? log.id : Date.now(),
            classId,
            date: formData.date,
            progress: formData.progress,
            iframeCode: formData.iframeCode, 
            materialUrl: formData.materialFileName, 
            scheduleTime: formData.scheduleTime, // 🚨 예약 시간 저장
        };

        onSave(dataToSave, isEdit);
        
        // 🚨 수업 일지 자동 알림 기능 
        if (selectedClass) {
            const studentNames = selectedClass.students
                                        .map(sId => students.find(s => s.id === sId)?.name)
                                        .filter(name => name)
                                        .join(', ');
            
            const action = isEdit ? '수정' : '등록';
            const alertTime = new Date(formData.scheduleTime).toLocaleString('ko-KR', { timeStyle: 'short', dateStyle: 'short' });
            const message = `[${selectedClass.name}] ${dataToSave.date.slice(5)} 수업 일지 ${action} 완료`;
            const details = `알림 예약 시간: ${alertTime}. 진도: ${dataToSave.progress}. 학생 (${studentNames}) 및 학부모에게 발송 예정. (모의)`;
            
            logNotification('lesson_log', message, details); // 알림 로깅
        }
        
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `${formData.date} 수업 일지 수정` : '새 수업 일지 등록'}>
            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                <input type="date" name="date" value={formData.date} onChange={handleChange} required className="p-2 border rounded w-full" />
                
                {/* 🚨 알림 예약 시간 필드 */}
                <div className="space-y-1">
                    <label className='block text-gray-700 font-semibold text-xs'>알림 발송 예약 시간:</label>
                    <input 
                        type="datetime-local" 
                        name="scheduleTime"
                        value={formData.scheduleTime} 
                        onChange={handleChange} 
                        required 
                        className="p-2 border rounded w-full"
                    />
                    <p className='text-xs text-gray-500'>* 이 시간에 학생/학부모에게 알림이 발송됩니다.</p>
                </div>
                
                <input type="text" name="progress" value={formData.progress} onChange={handleChange} placeholder="수업 진도 (예: 다항식의 연산 P.12 ~ P.18)" required className="p-2 border rounded w-full" />
                
                <textarea 
                    name="iframeCode" 
                    value={formData.iframeCode} 
                    onChange={handleChange} 
                    placeholder="YouTube 공유 임베드 <iframe> 코드를 붙여넣으세요. (선택 사항)" 
                    rows="3"
                    className="p-2 border rounded w-full" 
                />
                
                {/* 파일 업로드 필드 */}
                <div className="flex items-center space-x-2 border p-2 rounded-lg bg-gray-50">
                    <label htmlFor="materialFile" className="cursor-pointer flex items-center bg-gray-200 p-2 rounded-lg hover:bg-gray-300">
                        <Icon name="upload" className="w-4 h-4 mr-1"/> 수업 자료 첨부
                    </label>
                    <input 
                        type="file" 
                        id="materialFile" 
                        onChange={handleFileChange} 
                        className="hidden" 
                        accept=".pdf, .hwp, .doc, .docx"
                    />
                    <span className="text-xs text-gray-600 truncate flex-1">
                        {formData.materialFileName || "선택된 파일 없음"}
                    </span>
                </div>

                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700">
                    {isEdit ? '일지 수정' : '일지 등록 및 알림 발송'}
                </button>
            </form>
        </Modal>
    );
};

// 🚨 학생 등록/수정 모달: 교재 관련 필드 제거
const StudentFormModal = ({ isOpen, onClose, student = null, allClasses, onSave }) => {
    const isEdit = !!student;
    
    const [formData, setFormData] = useState({
        name: student?.name || '',
        school: student?.school || '',
        grade: student?.grade || 1,
        phone: student?.phone || '',
        parentPhone: student?.parentPhone || '',
        status: student?.status || '상담생',
        classes: student?.classes || [],
    });

    useEffect(() => {
        setFormData({
            name: student?.name || '',
            school: student?.school || '',
            grade: student?.grade || 1,
            phone: student?.phone || '',
            parentPhone: student?.parentPhone || '',
            status: student?.status || '상담생',
            classes: student?.classes || [],
        });
    }, [student]);


    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleClassChange = (e) => {
        const value = Number(e.target.value);
        setFormData(prev => ({
            ...prev,
            classes: prev.classes.includes(value)
                ? prev.classes.filter(id => id !== value)
                : [...prev.classes, value],
        }));
    };
    
    const handleSubmit = (e) => {
        e.preventDefault();
        const dataToSave = { ...formData };
        
        // Note: books 필드는 BookManagement에서만 관리되도록 여기서 제거
        onSave(dataToSave, isEdit ? student.id : null);
        onClose();
    };

    const statusOptions = ['재원생', '상담생', '퇴원생'];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `${student.name} 학생 정보 수정` : '새 학생 등록'} maxWidth='max-w-md'> 
            <form onSubmit={handleSubmit} className="space-y-4 text-sm"> 
                
                {/* 교재 관련 섹션 삭제, 기본 정보만 남김 */}
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="이름" required className="p-2 border rounded w-full" />
                <div className="grid grid-cols-2 gap-4">
                    <input type="text" name="school" value={formData.school} onChange={handleChange} placeholder="학교" required className="p-2 border rounded w-full" />
                    <input type="number" name="grade" value={formData.grade} onChange={handleChange} placeholder="학년" min="1" max="6" required className="p-2 border rounded w-full" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="학생 연락처 (010-xxxx-xxxx)" className="p-2 border rounded w-full" />
                    <input type="tel" name="parentPhone" value={formData.parentPhone} onChange={handleChange} placeholder="학부모 연락처 (010-xxxx-xxxx)" className="p-2 border rounded w-full" />
                </div>
                <select name="status" value={formData.status} onChange={handleChange} className="p-2 border rounded w-full">
                    {statusOptions.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
                <div className="border p-3 rounded-lg">
                    <label className="block font-semibold mb-2">수강 강좌:</label>
                    <div className="flex flex-wrap gap-3">
                        {allClasses.map(cls => (
                            <label key={cls.id} className="flex items-center space-x-2">
                                <input type="checkbox" value={cls.id} checked={formData.classes.includes(cls.id)} onChange={handleClassChange} className="form-checkbox text-blue-500" />
                                <span>{cls.name}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700">
                    {isEdit ? '정보 수정' : '학생 등록'}
                </button>
            </form>
        </Modal>
    );
};


const HomeworkAssignmentModal = ({ isOpen, onClose, onSave, classId, assignment = null, students, selectedClass }) => {
    const isEdit = !!assignment;
    const initialStudentIds = isEdit ? assignment.students : (selectedClass?.students || []);
    
    const [content, setContent] = useState(assignment?.content || '');
    const [date, setDate] = useState(assignment?.date || new Date().toISOString().slice(0, 10));
    const [startQuestion, setStartQuestion] = useState(assignment?.startQuestion || 1); 
    const [endQuestion, setEndQuestion] = useState(assignment?.endQuestion || 20); 
    
    const [selectedStudents, setSelectedStudents] = useState(initialStudentIds); 
    const [selectedBook, setSelectedBook] = useState(assignment?.book || ''); 

    // 클래스의 재원생 목록
    const classStudents = students.filter(s => s.status === '재원생' && selectedClass?.students.includes(s.id)) || [];
    
    // 클래스에 있는 모든 학생이 보유한 교재 목록 (중복 제거)
    const availableBooks = Array.from(new Set(
        classStudents.flatMap(s => s.books)
    )).sort();

    // 총 문항 수 계산
    const totalQuestions = (Number(endQuestion) >= Number(startQuestion)) ? 
                           (Number(endQuestion) - Number(startQuestion) + 1) : 0;


    useEffect(() => {
        setContent(assignment?.content || '');
        setDate(assignment?.date || new Date().toISOString().slice(0, 10));
        setStartQuestion(assignment?.startQuestion || 1);
        setEndQuestion(assignment?.endQuestion || 20);
        setSelectedStudents(initialStudentIds);
        setSelectedBook(assignment?.book || (availableBooks.length > 0 ? availableBooks[0] : '')); 
    }, [assignment, selectedClass, students]);
    
    // 학생 선택/해제 핸들러
    const handleStudentToggle = (studentId) => {
        setSelectedStudents(prev => 
            prev.includes(studentId) 
                ? prev.filter(id => id !== studentId) 
                : [...prev, studentId]
        );
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (content.trim() === '') return;
        if (totalQuestions <= 0) {
            alert("끝 문항 번호는 시작 문항 번호보다 크거나 같아야 합니다.");
            return;
        }
        if (selectedStudents.length === 0) {
            alert("과제를 할당할 학생을 한 명 이상 선택해야 합니다.");
            return;
        }
        if (!selectedBook) {
            alert("과제에 사용할 교재를 선택해주세요.");
            return;
        }

        onSave({
            id: isEdit ? assignment.id : Date.now(),
            classId,
            date,
            content,
            startQuestion: Number(startQuestion), 
            endQuestion: Number(endQuestion),     
            totalQuestions: totalQuestions,
            students: selectedStudents, 
            isAssignmentDate: true,
            book: selectedBook, 
        }, isEdit);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? '과제 수정' : '새 과제 등록'} maxWidth='max-w-3xl'>
            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                <div className='grid grid-cols-2 gap-4'>
                    <div>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="p-2 border rounded w-full" />
                        
                        {/* 교재 선택 필드 */}
                        <select 
                            value={selectedBook} 
                            onChange={e => setSelectedBook(e.target.value)}
                            required
                            className='p-2 border rounded w-full mt-2 bg-white'
                        >
                            <option value="" disabled>-- 교재 선택 --</option>
                            {availableBooks.map(book => (
                                <option key={book} value={book}>{book}</option>
                            ))}
                        </select>
                        
                        {/* 문항 범위 입력 */}
                        <div className='grid grid-cols-2 gap-2 mt-2'>
                            <input 
                                type="number"
                                value={startQuestion}
                                onChange={e => setStartQuestion(e.target.value)}
                                placeholder="시작 문항 번호"
                                required
                                min="1"
                                className="p-2 border rounded w-full" 
                            />
                            <input 
                                type="number"
                                value={endQuestion}
                                onChange={e => setEndQuestion(e.target.value)}
                                placeholder="끝 문항 번호"
                                required
                                min={startQuestion}
                                className="p-2 border rounded w-full" 
                            />
                        </div>
                        <p className={`text-xs mt-1 ${totalQuestions <= 0 ? 'text-red-500' : 'text-gray-500'}`}>
                            총 문항 수: {totalQuestions}개
                        </p>
                         <textarea 
                            value={content} 
                            onChange={e => setContent(e.target.value)} 
                            placeholder="과제 내용 (예: P.10 ~ P.15)" 
                            required 
                            rows="4"
                            className="p-2 border rounded w-full mt-2" 
                        />
                    </div>
                    
                    {/* 학생 선택 섹션 */}
                    <div className="border p-3 rounded-lg bg-gray-50">
                        <label className="block font-semibold mb-2">과제 할당 학생 ({selectedStudents.length}명):</label>
                        <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                            {classStudents.map(s => (
                                <label key={s.id} className="flex items-center space-x-2 text-xs bg-white p-2 rounded border">
                                    <input 
                                        type="checkbox" 
                                        value={s.id} 
                                        checked={selectedStudents.includes(s.id)} 
                                        onChange={() => handleStudentToggle(s.id)} 
                                        className="form-checkbox text-blue-500" 
                                    />
                                    <span>{s.name}</span>
                                    {/* 학생의 보유 교재와 선택 교재가 다르면 경고 */}
                                    {!s.books.includes(selectedBook) && selectedBook && (
                                        <span className='text-red-500 text-xs ml-auto' title={`선택한 교재(${selectedBook})를 보유하지 않음`}>⚠️ 교재 미보유</span>
                                    )}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700">
                    {isEdit ? '과제 수정' : '과제 등록'}
                </button>
            </form>
        </Modal>
    );
};

const TestFormModal = ({ isOpen, onClose, onSave, classId, test = null, classes, calculateClassSessions }) => {
    const isEdit = !!test;
    const selectedClass = classes.find(c => c.id === classId);
    const sessions = selectedClass ? calculateClassSessions(selectedClass) : [];
    
    const [name, setName] = useState(test?.name || '');
    const [date, setDate] = useState(test?.date || new Date().toISOString().slice(0, 10)); 
    const [maxScore, setMaxScore] = useState(test?.maxScore || 100);
    const [totalQuestions, setTotalQuestions] = useState(test?.totalQuestions || 20); 
    const [questionScore, setQuestionScore] = useState(test?.questionScore || 5); 
    const [dateError, setDateError] = useState('');

    useEffect(() => {
        setName(test?.name || '');
        setDate(test?.date || new Date().toISOString().slice(0, 10));
        setMaxScore(test?.maxScore || 100);
        setTotalQuestions(test?.totalQuestions || 20);
        setQuestionScore(test?.questionScore || 5);
        setDateError('');
    }, [test]);
    
    useEffect(() => {
        const calculatedScore = Number(totalQuestions) * Number(questionScore);
        if (calculatedScore > 0) {
            setMaxScore(calculatedScore);
        }
    }, [totalQuestions, questionScore]);

    const handleDateChange = (e) => {
        const newDate = e.target.value;
        setDate(newDate);
        
        // 정규 수업일 유효성 검사
        const isScheduledDay = sessions.some(s => s.date === newDate);
        if (!isScheduledDay) {
            setDateError('선택된 날짜는 이 클래스의 정규 수업일이 아닙니다.');
        } else {
            setDateError('');
        }
    };


    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!name.trim()) { alert("테스트 이름을 입력해주세요."); return; }
        if (Number(totalQuestions) <= 0 || Number(questionScore) <= 0) {
             alert("문항 수와 문항당 배점은 1 이상이어야 합니다.");
             return;
        }
        
        if (dateError) {
             const confirm = window.confirm(dateError + "\n정규 수업일이 아닌 날에 테스트를 등록하시겠습니까?");
             if (!confirm) return;
        }

        onSave({
            id: isEdit ? test.id : Date.now(),
            name,
            date, 
            maxScore: Number(maxScore),
            classId,
            totalQuestions: Number(totalQuestions),
            questionScore: Number(questionScore),
        }, isEdit);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? '테스트 정보 수정' : '새 테스트 생성'}>
            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="테스트 이름 (예: 7월 정기고사)" required className="p-2 border rounded w-full" />
                
                {/* 날짜 입력 필드 */}
                <div className="space-y-1">
                    <input type="date" value={date} onChange={handleDateChange} required className={`p-2 border rounded w-full ${dateError ? 'border-red-500' : 'border-gray-300'}`} />
                    {dateError && <p className='text-xs text-red-500'>{dateError}</p>}
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-gray-700 mb-1">총 문항 수:</label>
                        <input type="number" value={totalQuestions} onChange={e => setTotalQuestions(e.target.value)} placeholder="문항 수" required min="1" className="p-2 border rounded w-full" />
                    </div>
                    <div>
                        <label className="block text-gray-700 mb-1">문항당 배점:</label>
                        <input type="number" value={questionScore} onChange={e => setQuestionScore(e.target.value)} placeholder="배점" required min="1" className="p-2 border rounded w-full" />
                    </div>
                    <div>
                        <label className="block text-gray-700 mb-1">만점 (자동 계산):</label>
                        <input type="number" value={maxScore} readOnly className="p-2 border rounded w-full bg-gray-100 font-bold" />
                    </div>
                </div>

                <button type="submit" className="w-full bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-700">
                    {isEdit ? '테스트 수정' : '테스트 생성'}
                </button>
            </form>
        </Modal>
    );
}

const AnnouncementModal = ({ isOpen, onClose, onSave, announcementToEdit = null, allStudents, allClasses }) => {
    const isEdit = !!announcementToEdit;

    const [formData, setFormData] = useState({
        title: announcementToEdit?.title || '',
        content: announcementToEdit?.content.replace(/<br>/g, '\n') || '',
        scheduleTime: announcementToEdit?.scheduleTime || new Date().toISOString().slice(0, 16),
        attachments: announcementToEdit?.attachments || [],
        targetClasses: announcementToEdit?.targetClasses || [],
        targetStudents: announcementToEdit?.targetStudents || [],
        newAttachment: null,
    });
    
    useEffect(() => {
        if (announcementToEdit) {
            setFormData({
                title: announcementToEdit.title || '',
                content: announcementToEdit.content.replace(/<br>/g, '\n') || '',
                scheduleTime: announcementToEdit.scheduleTime || new Date().toISOString().slice(0, 16),
                attachments: announcementToEdit.attachments || [],
                targetClasses: announcementToEdit.targetClasses || [],
                targetStudents: announcementToEdit.targetStudents || [],
                newAttachment: null,
            });
        }
    }, [announcementToEdit]);

    
    // 파일 첨부 핸들러
    const handleFileChange = (e) => {
        const files = Array.from(e.target.files).map(file => file.name);
        setFormData(prev => ({
            ...prev,
            attachments: [...prev.attachments, ...files]
        }));
        e.target.value = null; // 파일 초기화
    }
    
    const handleRemoveAttachment = (name) => {
        setFormData(prev => ({
            ...prev,
            attachments: prev.attachments.filter(attName => attName !== name)
        }));
    }
    
    const handleTargetChange = (type, id) => {
        const numId = Number(id);
        setFormData(prev => ({
            ...prev,
            [type]: prev[type].includes(numId)
                ? prev[type].filter(item => item !== numId)
                : [...prev[type], numId],
        }));
    };
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.title.trim() || !formData.content.trim()) {
            alert('제목과 내용을 모두 입력해주세요.');
            return;
        }
        
        onSave({ 
            id: isEdit ? announcementToEdit.id : Date.now(),
            title: formData.title, 
            content: formData.content.replace(/\n/g, '<br>'), // HTML 줄바꿈으로 변환 (모의 에디터)
            attachments: formData.attachments,
            scheduleTime: formData.scheduleTime,
            targetClasses: formData.targetClasses,
            targetStudents: formData.targetStudents,
            isPinned: announcementToEdit?.isPinned || false, // 수정 시 고정 상태 유지
        }, isEdit);
        onClose();
    };
    
    // 대상 학생 필터링 및 검색 기능 추가
    const [studentSearchTerm, setStudentSearchTerm] = useState('');
    const [studentFilterClassId, setStudentFilterClassId] = useState('');

    const filteredStudents = allStudents.filter(s => s.status === '재원생')
        .filter(s => s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()))
        .filter(s => !studentFilterClassId || s.classes.includes(Number(studentFilterClassId)));

    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? '공지사항 수정' : "새 공지사항 작성"} maxWidth="max-w-xl">
            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                <input 
                    type="text" 
                    name="title"
                    value={formData.title} 
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} 
                    placeholder="제목 (예: 12월 정규 수업 일정 안내)"
                    required
                    className="p-2 border rounded w-full"
                />
                <textarea
                    name="content"
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))} 
                    placeholder="공지 내용을 입력하세요. (HTML 태그 사용 가능: <br>, <b>, <img> 등)"
                    rows="6"
                    required
                    className="p-2 border rounded w-full"
                />
                
                {/* 예약 및 첨부 섹션 */}
                <div className='border p-3 rounded-lg space-y-3 bg-gray-50'>
                    <div className='flex items-center space-x-3'>
                        <label className='font-semibold'>게시 예약 시간:</label>
                        <input 
                            type="datetime-local" 
                            value={formData.scheduleTime}
                            onChange={(e) => setFormData(prev => ({ ...prev, scheduleTime: e.target.value }))}
                            required
                            className='p-1 border rounded'
                        />
                    </div>
                    
                    {/* 첨부 파일 */}
                    <div className='space-y-2'>
                        <div className="flex items-center space-x-2">
                            <label htmlFor="announcementFile" className="cursor-pointer flex items-center bg-gray-200 p-1.5 rounded-lg hover:bg-gray-300 text-xs font-semibold">
                                <Icon name="upload" className="w-4 h-4 mr-1"/> 파일 첨부 ({formData.attachments.length}개)
                            </label>
                            <input 
                                type="file" 
                                id="announcementFile" 
                                multiple
                                onChange={handleFileChange} 
                                className="hidden" 
                                accept=".pdf, .hwp, .doc, .docx, .png, .jpg, .jpeg"
                            />
                        </div>
                        <div className='max-h-16 overflow-y-auto'>
                             {formData.attachments.map((att, index) => (
                                 <div key={index} className='flex justify-between items-center text-xs text-gray-700 bg-white p-1 rounded border mb-1'>
                                     <span className='truncate'>{att}</span>
                                     <button type="button" onClick={() => handleRemoveAttachment(att)} className='text-red-500 ml-2'>
                                         <Icon name="x" className='w-3 h-3'/>
                                     </button>
                                 </div>
                             ))}
                        </div>
                    </div>
                </div>
                
                {/* 대상 클래스/학생 선택 */}
                <div className='grid grid-cols-2 gap-4 border p-3 rounded-lg'>
                    <div>
                        <label className='block font-semibold mb-2'>대상 클래스:</label>
                        <div className='space-y-1 max-h-28 overflow-y-auto pr-1 text-xs'>
                             {allClasses.map(cls => (
                                <label key={cls.id} className="flex items-center space-x-2">
                                    <input type="checkbox" value={cls.id} checked={formData.targetClasses.includes(cls.id)} onChange={(e) => handleTargetChange('targetClasses', e.target.value)} className="form-checkbox text-blue-500" />
                                    <span>{cls.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                     <div>
                        <label className='block font-semibold mb-2'>대상 학생 (필터링 가능):</label>
                        <div className='flex space-x-2 mb-2'>
                            <input
                                type="text"
                                placeholder="학생 이름 검색"
                                value={studentSearchTerm}
                                onChange={(e) => setStudentSearchTerm(e.target.value)}
                                className='p-1 border rounded text-xs w-1/2'
                            />
                            <select
                                value={studentFilterClassId}
                                onChange={(e) => setStudentFilterClassId(e.target.value)}
                                className='p-1 border rounded text-xs w-1/2'
                            >
                                <option value="">클래스 필터</option>
                                {allClasses.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                            </select>
                        </div>
                        
                        <div className='space-y-1 max-h-28 overflow-y-auto pr-1 text-xs border p-1 rounded'>
                            {filteredStudents.length === 0 ? (
                                <p className='text-gray-500'>검색 결과 없음</p>
                            ) : (
                                filteredStudents.map(s => (
                                    <label key={s.id} className="flex items-center space-x-2">
                                        <input type="checkbox" value={s.id} checked={formData.targetStudents.includes(s.id)} onChange={(e) => handleTargetChange('targetStudents', e.target.value)} className="form-checkbox text-blue-500" />
                                        <span>{s.name} ({s.school})</span>
                                    </label>
                                ))
                            )}
                        </div>
                        <p className='text-xs text-gray-500 mt-2'>* 특정 클래스를 지정하지 않으면, 지정된 학생에게만 노출됩니다.</p>
                    </div>
                </div>


                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center">
                    {isEdit ? '공지사항 수정 및 업데이트' : '공지사항 등록 및 알림 발송'}
                    <Icon name="send" className="w-4 h-4 ml-2"/>
                </button>
            </form>
        </Modal>
    )
}

// 🚨 클리닉 로그 모달: 학생 정보 상세화
const ClinicLogModal = ({ isOpen, onClose, onSave, logToEdit = null, students, defaultDate, classes }) => {
    const isEdit = !!logToEdit;
    
    const [formData, setFormData] = useState({
        date: logToEdit?.date || defaultDate,
        studentId: logToEdit?.studentId || (students.find(s => s.status === '재원생')?.id || ''),
        checkIn: logToEdit?.checkIn || '14:00',
        checkOut: logToEdit?.checkOut || '17:00',
        comment: logToEdit?.comment || '',
        tutor: '조교A', 
    });

    useEffect(() => {
        if (logToEdit) {
            setFormData({
                date: logToEdit.date,
                studentId: logToEdit.studentId,
                checkIn: logToEdit.checkIn,
                checkOut: logToEdit.checkOut,
                comment: logToEdit.comment,
                tutor: logToEdit.tutor,
            });
        } else {
             setFormData(prev => ({
                 ...prev,
                 date: defaultDate,
                 studentId: students.find(s => s.status === '재원생')?.id || '',
                 comment: '',
             }));
        }
    }, [logToEdit, defaultDate, students]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'studentId' ? Number(value) : value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.studentId || !formData.comment.trim()) {
            alert("학생과 코멘트는 필수 입력 사항입니다.");
            return;
        }

        onSave({ ...formData, id: logToEdit?.id }, isEdit);
        onClose();
    };
    
    const availableStudents = students.filter(s => s.status === '재원생');
    
    const getStudentDisplayInfo = (student) => {
        const classNames = student.classes.map(id => classes.find(c => c.id === id)?.name).filter(Boolean).join(', ');
        const phoneSuffix = student.phone.slice(-4);
        return `${student.name} (${classNames || '강좌 없음'} / ****${phoneSuffix})`;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? '클리닉 기록 수정' : '새 클리닉 기록 작성'}>
            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                <input type="date" name="date" value={formData.date} onChange={handleChange} required className="p-2 border rounded w-full" />
                
                <select name="studentId" value={formData.studentId} onChange={handleChange} required className="p-2 border rounded w-full">
                    <option value="" disabled>-- 학생 선택 (이름 / 강좌 / 번호 뒷 4자리) --</option>
                    {availableStudents.map(s => <option key={s.id} value={s.id}>{getStudentDisplayInfo(s)}</option>)}
                </select>
                
                <div className='grid grid-cols-2 gap-4'>
                    <div>
                        <label className='block text-gray-700 mb-1'>등원 시간</label>
                        <input type="time" name="checkIn" value={formData.checkIn} onChange={handleChange} required className="p-2 border rounded w-full" />
                    </div>
                    <div>
                        <label className='block text-gray-700 mb-1'>하원 시간</label>
                        <input type="time" name="checkOut" value={formData.checkOut} onChange={handleChange} required className="p-2 border rounded w-full" />
                    </div>
                </div>

                <textarea
                    name="comment"
                    value={formData.comment}
                    onChange={handleChange}
                    placeholder="클리닉 코멘트 (학습 내용, 지도 방식 등)"
                    rows="4"
                    required
                    className="p-2 border rounded w-full"
                />
                <p className='text-xs text-gray-500'>담당 조교: {formData.tutor}</p>

                <button type="submit" className="w-full bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-700">
                    {isEdit ? '기록 수정' : '기록 추가'}
                </button>
            </form>
        </Modal>
    );
};


// --- 메인 앱 컴포넌트: 모든 상태와 CRUD 로직을 관리하는 중앙 허브 ---
export default function App() { 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [page, setPage] = useState('lessons'); 
  const [selectedStudentId, setSelectedStudentId] = useState(null); 
  const [notifications, setNotifications] = useState([]); 

  // --- 중앙 상태 관리 ---
  const [students, setStudents] = useState(initialStudents);
  const [classes, setClasses] = useState(initialClasses);
  const [lessonLogs, setLessonLogs] = useState(initialLessonLogs);
  const [attendanceLogs, setAttendanceLogs] = useState(initialAttendanceLogs); 
  const [homeworkAssignments, setHomeworkAssignments] = useState(initialHomeworkAssignments); 
  const [homeworkResults, setHomeworkResults] = useState(initialHomeworkResults); 
  const [tests, setTests] = useState(initialTests);
  const [grades, setGrades] = useState(initialGrades);
  const [studentMemos, setStudentMemos] = useState(initialStudentMemos); 
  const [videoProgress, setVideoProgress] = useState(initialVideoProgress); 
  const [announcements, setAnnouncements] = useState(initialAnnouncements); 
  const [clinicLogs, setClinicLogs] = useState(initialClinicLogs); 
  const [workLogs, setWorkLogs] = useState(initialWorkLogs); 
  
  const nextStudentId = students.reduce((max, s) => Math.max(max, s.id), 0) + 1; 

  // 알림 로깅 함수
    const logNotification = (type, message, details) => {
        setNotifications(prev => [{ id: Date.now(), type, message, details, timestamp: new Date().toLocaleTimeString('ko-KR') }, ...prev]);
    };

  // --- CRUD 함수: 클래스 관리 (유지) ---
  const handleSaveClass = (classData, isEdit) => {
    if (isEdit) {
        setClasses(prev => prev.map(c => c.id === classData.id ? classData : c));
        alert(`클래스 "${classData.name}" 정보가 수정되었습니다!`);
    } else {
        const newClass = { 
            ...classData, 
            id: Date.now(), 
            schoolType: '고등학교', 
            grade: 1, 
            students: [], 
        };
        setClasses(prev => [...prev, newClass]);
        alert(`클래스 "${newClass.name}"가 개설되었습니다!`);
    }
  };


  // --- CRUD 함수: 학생 관리 (유지) ---
  const getClassesNames = useCallback((classIds) => classIds.map(id => classes.find(c => c.id === id)?.name || '').join(', '), [classes]);
  
  const handleSaveStudent = (newStudentData, idToUpdate) => {
    if (idToUpdate) {
        const oldStudent = students.find(s => s.id === idToUpdate);
        
        // Note: newStudentData는 StudentFormModal에서 교재 필드가 제거되었으므로,
        // 기존 학생의 books 필드는 그대로 유지됨 (나머지 필드만 업데이트)
        setStudents(prev => prev.map(s => s.id === idToUpdate ? { ...s, ...newStudentData, books: s.books } : s));
        
        // --- 클래스 상태 업데이트 로직 ---
        setClasses(prevClasses => prevClasses.map(cls => {
            const isNowInClass = newStudentData.classes.includes(cls.id);
            const isNowActive = newStudentData.status === '재원생';
            
            let currentStudents = cls.students.filter(sid => sid !== idToUpdate); 

            if (isNowInClass && isNowActive) {
                 if (!currentStudents.includes(idToUpdate)) {
                     currentStudents.push(idToUpdate);
                 }
            }
            
            if (currentStudents.length === cls.students.length && currentStudents.every((sid, i) => sid === cls.students[i])) {
                return cls;
            }

            return { ...cls, students: currentStudents.sort((a, b) => a - b) };
        }));

    } else {
        const newStudent = { 
            ...newStudentData, 
            id: nextStudentId, 
            registeredDate: new Date().toISOString().slice(0, 10), 
            paymentStatus: '해당없음', 
            bookReceived: false,
            books: [], // 신규 등록 시 books 필드는 빈 배열로 초기화
        };
        setStudents(prev => [...prev, newStudent]);
        setGrades(prev => ({ ...prev, [newStudent.id]: {} }));

        if (newStudent.status === '재원생') {
            setClasses(prevClasses => prevClasses.map(cls => 
                newStudent.classes.includes(cls.id) 
                    ? { ...cls, students: [...cls.students, newStudent.id] }
                    : cls
            ));
        }
    }
  };

  const handleDeleteStudent = (id) => {
    if (window.confirm('학생을 정말 삭제하시겠습니까? 관련 데이터가 모두 사라집니다.')) {
        setStudents(prev => prev.filter(s => s.id !== id));
        setGrades(prev => { 
            const newGrades = { ...prev }; 
            delete newGrades[id]; 
            return newGrades; 
        });
        setClasses(prevClasses => prevClasses.map(cls => ({
            ...cls,
            students: cls.students.filter(sid => sid !== id)
        })));
        setStudentMemos(prev => { 
            const newMemos = { ...prev };
            delete newMemos[id];
            return newMemos;
        })
    }
  };
  
  // --- CRUD 함수: 메모 관리 (유지) ---
  const handleSaveMemo = (studentId, content) => {
      setStudentMemos(prev => ({
          ...prev,
          [studentId]: content
      }));
  };

  // --- CRUD 함수: 수업 일지 관리 (유지) ---
  const handleSaveLessonLog = (logData, isEdit) => {
    if (isEdit) {
        setLessonLogs(prev => prev.map(log => log.id === logData.id ? logData : log));
    } else {
        setLessonLogs(prev => [logData, ...prev]);
    }
  };

  const handleDeleteLessonLog = (logId) => {
    if (window.confirm('해당 수업 일지를 삭제하시겠습니까?')) {
        setLessonLogs(prev => prev.filter(log => log.id !== logId));
    }
  }
  
  // --- CRUD 함수: 출석 관리 (유지) ---
  const handleSaveAttendance = (attendanceRecords) => {
    setAttendanceLogs(prevLogs => {
        let newLogs = [...prevLogs];
        attendanceRecords.forEach(record => {
            const existingIndex = newLogs.findIndex(
                log => log.classId === record.classId && log.date === record.date && log.studentId === record.studentId
            );

            if (record.status === '미체크') {
                if (existingIndex !== -1) {
                    newLogs.splice(existingIndex, 1); 
                }
            } else {
                if (existingIndex !== -1) {
                    newLogs[existingIndex] = { ...newLogs[existingIndex], status: record.status };
                } else {
                    newLogs.push({ ...record, id: Date.now() + Math.random() });
                }
            }
        });
        return newLogs;
    });
  };

  // --- CRUD 함수: 과제 관리 (유지) ---
  const handleSaveHomeworkAssignment = (assignmentData, isEdit) => {
    if (isEdit) {
        setHomeworkAssignments(prev => prev.map(a => a.id === assignmentData.id ? { ...a, ...assignmentData } : a));
    } else {
        // totalQuestions은 startQuestion과 endQuestion으로 계산
        const calculatedTotalQuestions = Number(assignmentData.endQuestion) - Number(assignmentData.startQuestion) + 1;

        const newAssignment = { 
            ...assignmentData, 
            id: Date.now(), 
            students: assignmentData.students, 
            totalQuestions: calculatedTotalQuestions,
            isAssignmentDate: true,
            book: assignmentData.book || '교재 정보 없음', 
            startQuestion: Number(assignmentData.startQuestion),
            endQuestion: Number(assignmentData.endQuestion),
        }; 
        setHomeworkAssignments(prev => [newAssignment, ...prev]);
    }
  };

  const handleDeleteHomeworkAssignment = (assignmentId) => {
    if (window.confirm('해당 과제를 삭제하시겠습니까? 관련 결과 데이터도 함께 사라집니다.')) {
        setHomeworkAssignments(prev => prev.filter(a => a.id !== assignmentId));
        setHomeworkResults(prevResults => {
            const newResults = { ...prevResults };
            for (const studentId in newResults) {
                delete newResults[studentId][assignmentId];
            }
            return newResults;
        });
    }
  };
  
  // 과제 결과 상세 기록 (문항별 상태 맵)
  const handleUpdateHomeworkResult = (studentId, assignmentId, questionId, status) => {
    setHomeworkResults(prevResults => {
        const studentResults = prevResults[studentId] || {};
        const assignmentResults = studentResults[assignmentId] || {};
        
        let newAssignmentResults;
        if (status === '미체크') {
            newAssignmentResults = { ...assignmentResults };
            delete newAssignmentResults[questionId];
        } else {
            newAssignmentResults = { ...assignmentResults, [questionId]: status };
        }
        
        return {
            ...prevResults,
            [studentId]: {
                ...studentResults,
                [assignmentId]: newAssignmentResults
            }
        };
    });
  };

  // --- CRUD 함수: 성적 및 테스트 관리 (유지) ---
  const handleSaveTest = (testData, isEdit) => {
    if (isEdit) {
        setTests(prev => prev.map(t => t.id === testData.id ? testData : t));
    } else {
        setTests(prev => [...prev, testData]);
    }
  };

  const handleDeleteTest = (testId) => {
    if (window.confirm('해당 테스트를 삭제하시겠습니까? 관련 성적 데이터도 함께 삭제됩니다.')) {
        setTests(prev => prev.filter(t => t.id !== testId));
        
        setGrades(prevGrades => {
            const newGrades = {};
            for (const studentId in prevGrades) {
                const studentGrades = { ...prevGrades[studentId] };
                delete studentGrades[testId];
                newGrades[studentId] = studentGrades;
            }
            return newGrades;
        });
    }
  };

  // 맞은 문항수를 받아 점수를 계산하여 저장
  const handleUpdateGrade = (studentId, testId, correctCount) => {
    const testInfo = tests.find(t => t.id === testId);
    let finalScore = '';
    
    if (testInfo && correctCount !== '') {
        const scorePerQuestion = testInfo.questionScore;
        // 최종 점수 계산
        finalScore = (Number(correctCount) * scorePerQuestion); 
        if (finalScore > testInfo.maxScore) {
             finalScore = testInfo.maxScore;
        }
        finalScore = finalScore.toFixed(2); 
    } else {
        correctCount = '';
    }

    setGrades(prevGrades => ({
        ...prevGrades,
        [studentId]: {
            ...prevGrades[studentId],
            [testId]: {
                score: finalScore === '' ? undefined : Number(finalScore),
                correctCount: correctCount === '' ? undefined : Number(correctCount),
            }
        }
    }));
  };
  
  // --- CRUD 함수: 공지사항 관리 (유지) ---
  const handleSaveAnnouncement = (announcementData, isEdit) => {
      if (isEdit) {
           setAnnouncements(prev => prev.map(ann => ann.id === announcementData.id ? announcementData : ann));
           alert(`[${announcementData.title}] 공지사항이 수정되었습니다.`);
      } else {
          const newAnnounce = {
              id: Date.now(),
              author: '채수용', // 현재 로그인 사용자 (모의)
              date: new Date().toISOString().slice(0, 10),
              isPinned: false,
              attachments: [],
              ...announcementData
          };
           setAnnouncements(prev => [newAnnounce, ...prev]);
           alert(`[${newAnnounce.title}] 공지사항이 등록되었으며, 예약 시간(${new Date(newAnnounce.scheduleTime).toLocaleString('ko-KR')})에 맞춰 학생/학부모에게 알림이 발송될 예정입니다. (모의)`);
      }
  }

  // --- CRUD 함수: 근무 일지 관리 (유지) ---
  const handleSaveWorkLog = (logData, isEdit) => {
      if (isEdit) {
          setWorkLogs(prev => prev.map(log => log.id === logData.id ? logData : log));
      } else {
          const newLog = { ...logData, id: Date.now(), author: '채수용', date: new Date().toISOString().slice(0, 10) };
          setWorkLogs(prev => [newLog, ...prev]);
      }
  };
  const handleDeleteWorkLog = (id) => {
      if (window.confirm('근무 일지를 정말 삭제하시겠습니까?')) {
          setWorkLogs(prev => prev.filter(log => log.id !== id));
      }
  }


  // --- CRUD 함수: 클리닉 로그 관리 (유지) ---
  const handleSaveClinicLog = (logData, isEdit) => {
    if (isEdit) {
        setClinicLogs(prev => prev.map(log => log.id === logData.id ? logData : log));
    } else {
        const student = students.find(s => s.id === logData.studentId);
        const newLog = { 
            ...logData, 
            id: Date.now(), 
            tutor: '조교A', // 현재 로그인된 조교 이름 (모의)
            studentName: student ? student.name : 'Unknown Student',
            date: logData.date || new Date().toISOString().slice(0, 10),
        };
        setClinicLogs(prev => [newLog, ...prev]);
    }
  };
  const handleDeleteClinicLog = (id) => {
      if (window.confirm('클리닉 기록을 정말 삭제하시겠습니까?')) { 
          setClinicLogs(prev => prev.filter(log => log.id !== id));
      }
  }
  

  if (!isLoggedIn) return <LoginPage onLogin={() => setIsLoggedIn(true)} />;

  // 페이지 전환 로직 업데이트 (학생 관리 메뉴 클릭 시, selectedStudentId 초기화)
  const handlePageChange = (newPage, studentId = null) => {
       if (newPage === 'students' && studentId === null) {
            setSelectedStudentId(null); 
        } else {
            setSelectedStudentId(studentId);
        }
        setPage(newPage);
  }
  
  const managementProps = {
    students, classes, lessonLogs, attendanceLogs, workLogs, clinicLogs, 
    homeworkAssignments, homeworkResults, tests, grades, studentMemos, videoProgress, announcements, 
    setAnnouncements, 
    getClassesNames,
    handleSaveStudent, handleDeleteStudent,
    handleSaveClass, 
    handleSaveLessonLog, handleDeleteLessonLog,
    handleSaveAttendance,
    handleSaveHomeworkAssignment, handleDeleteHomeworkAssignment, handleUpdateHomeworkResult,
    handleSaveTest, handleDeleteTest, handleUpdateGrade,
    handleSaveMemo, 
    handleSaveAnnouncement, handleSaveWorkLog, handleDeleteWorkLog, 
    handleSaveClinicLog, handleDeleteClinicLog, 
    calculateClassSessions,
    selectedStudentId,
    handlePageChange, 
    logNotification, 
    notifications, 
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-base"> 
      {/* 사이드바: handlePageChange를 setPage로 전달하여 학생 관리 메뉴 클릭 시 목록으로 돌아가도록 처리 */}
      <Sidebar page={page} setPage={(newPage) => handlePageChange(newPage, null)} onLogout={() => setIsLoggedIn(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header page={page} />
        <main id="main-content" className="overflow-x-hidden overflow-y-auto bg-gray-100 p-6 min-w-0">
          <PageContent page={page} {...managementProps} />
        </main>
      </div>
      {/* 알림 패널 추가 */}
      <NotificationPanel notifications={notifications} />
    </div>
  );
}

// --- Notification Panel Component (새로 추가) ---
const NotificationPanel = ({ notifications }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (notifications.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 w-80">
            {/* 알림 토글 버튼 */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-center p-3 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition"
            >
                <Icon name="bell" className="w-6 h-6" />
                {notifications.length > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-yellow-400 rounded-full">{notifications.length}</span>
                )}
            </button>

            {/* 알림 목록 */}
            {isOpen && (
                <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden max-h-96">
                    <div className="p-3 bg-gray-50 border-b">
                        <h5 className="font-bold text-gray-800">시스템 알림 ({notifications.length})</h5>
                    </div>
                    <ul className="divide-y divide-gray-100 overflow-y-auto">
                        {notifications.slice(0, 5).map((n) => (
                            <li key={n.id} className="p-3 text-sm hover:bg-gray-50">
                                <p className="font-semibold">{n.message}</p>
                                <p className="text-xs text-gray-500 mt-1">{n.details}</p>
                                <span className="text-xs text-gray-400 block mt-1">{n.timestamp}</span>
                            </li>
                        ))}
                        {notifications.length > 5 && (
                            <li className="p-3 text-xs text-center text-gray-500 cursor-pointer hover:bg-gray-100">
                                더 많은 알림 보기...
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};
// --- 레이아웃 및 페이지 컴포넌트 ---
const LoginPage = ({ onLogin }) => { 
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const handleLogin = (e) => {
      e.preventDefault();
      if (id === 'admin' && password === '1234') onLogin();
      else setError('아이디 또는 비밀번호가 올바르지 않습니다.');
    };
    return (
      <div className="flex items-center justify-center h-screen bg-gray-200">
        <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-lg">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800">매쓰-플래너</h1> 
            <p className="mt-2 text-sm text-gray-600">직원용 로그인</p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <input id="id" name="id" type="text" required className="w-full px-4 py-3 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="아이디" value={id} onChange={(e) => setId(e.target.value)} /> 
              <input id="password" name="password" type="password" required className="w-full px-4 py-3 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} /> 
            </div>
            {error && <p className="text-xs text-red-500 text-center">{error}</p>} 
            <button type="submit" className="w-full py-3 px-4 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none">로그인</button> 
          </form>
        </div>
      </div>
    );
  };

const Sidebar = ({ page, setPage, onLogout }) => {
    const navItems = [
        { id: 'home', name: '홈', icon: 'dashboard', isParent: false },
        { id: 'students', name: '학생 관리', icon: 'users', isParent: false },
        { 
            id: 'class_management', 
            name: '클래스 관리', 
            icon: 'school', 
            isParent: true,
            subItems: [
                { id: 'lessons', name: '수업 관리', icon: 'bookOpen' }, 
                { id: 'attendance', name: '출석 관리', icon: 'clipboardCheck' },
                { id: 'homework', name: '과제 관리', icon: 'fileText' },
                { id: 'grades', name: '성적 관리', icon: 'barChart' },
            ]
        },
        { id: 'clinics', name: '클리닉 관리', icon: 'clock', isParent: false}, 
        { id: 'payment', name: '수납 관리', icon: 'wallet', isParent: false },
        { id: 'notes', name: '오답노트 & 교재', icon: 'fileText', isParent: false }, 
        { id: 'internal', name: '내부 소통', icon: 'messageSquare', isParent: false },
    ];
      
    const isSubPageActive = (parentItem) => parentItem.subItems && parentItem.subItems.some(sub => sub.id === page);
    
    return (
        <div className="w-64 bg-white text-gray-800 flex flex-col shadow-lg flex-shrink-0">
          <div className="h-20 flex items-center justify-center border-b"><h1 className="text-xl font-bold text-blue-600">Math-Planner</h1></div> 
          <nav className="flex-1 px-4 py-4 space-y-2 text-base"> 
            {navItems.map(item => (
              <React.Fragment key={item.id}>
                <div className={`relative ${item.isParent ? 'group overflow-hidden' : ''}`}> 
                  <button 
                      onClick={() => {
                          if (item.id === page) {
                               setPage('home');
                               setTimeout(() => setPage(item.id), 50); 
                          } else {
                               setPage(item.isParent ? (item.subItems[0]?.id || item.id) : item.id)
                          }
                      }}
                      className={`w-full flex items-center px-4 py-2 text-left text-base rounded-lg transition-all duration-200 ${page === item.id || isSubPageActive(item) ? 'bg-blue-500 text-white shadow-md' : 'text-gray-600 hover:bg-blue-100 hover:text-blue-600'}`}
                  > 
                    <Icon name={item.icon} className="w-5 h-5 mr-3" /><span>{item.name}</span> 
                  </button>
                  
                  {item.isParent && (
                      <div className={`
                          pl-8 space-y-1 transition-all duration-500 ease-in-out
                          ${isSubPageActive(item) ? 'max-h-60 mt-1' : 'max-h-0'} 
                          group-hover:max-h-60 group-hover:mt-1
                      `}>
                          {item.subItems.map(subItem => (
                              <button 
                                  key={subItem.id} 
                                  onClick={() => setPage(subItem.id)} 
                                  className={`w-full flex items-center px-4 py-1 text-left text-sm rounded-lg transition-all duration-200 ${page === subItem.id ? 'bg-blue-300 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                              > 
                                <span>{subItem.name}</span>
                              </button>
                          ))}
                      </div>
                  )}
                </div>
              </React.Fragment>
            ))}
          </nav>
          <div className="px-4 py-4 border-t">
            <button onClick={onLogout} className="w-full flex items-center px-4 py-2 text-left text-base text-gray-600 hover:bg-red-100 hover:text-red-600 rounded-lg transition-all duration-200"> 
              <Icon name="logOut" className="w-5 h-5 mr-3" /><span>로그아웃</span> 
            </button>
          </div>
        </div>
    );
};

const Header = ({ page }) => {
    const pageTitles = {
        home: '홈', students: '학생 관리', lessons: '수업 관리', attendance: '출석 관리', homework: '과제 관리', grades: '성적 관리', clinics: '클리닉 관리',
        notes: '오답노트 & 교재', payment: '수납 관리',
      };
      const title = pageTitles[page] || '클래스 관리';
      return (
        <header className="h-20 bg-white flex items-center justify-between px-6 border-b">
          <h2 className="text-2xl font-semibold text-gray-700">{title}</h2> 
          <div className="flex items-center space-x-4 text-sm"> 
            <p className="text-gray-600">채수용 선생님, 환영합니다!</p><img className="w-10 h-10 rounded-full object-cover" src="https://placehold.co/100x100/E2E8F0/4A5568?text=User" alt="User" /> 
          </div>
        </header>
      );
};

const PageContent = (props) => {
    // 학생 상세 페이지 처리
    if (props.page === 'students' && props.selectedStudentId) {
        return <StudentDetail {...props} studentId={props.selectedStudentId} />;
    }

    switch (props.page) {
        case 'home': return <Home />;
        case 'students': return <StudentManagement {...props} />;
        // lessonLogs, students, logNotification props 추가
        case 'lessons': return <LessonManagement {...props} logNotification={props.logNotification} students={props.students} lessonLogs={props.lessonLogs} />; 
        case 'attendance': return <AttendanceManagement {...props} />; 
        case 'homework': return <HomeworkManagement {...props} />; 
        case 'grades': return <GradeManagement {...props} />;      
        case 'clinics': return <ClinicManagement {...props} />; 
        case 'payment': return <PaymentManagement />;
        case 'notes': return <BookManagement {...props} />; 
        case 'internal': return <InternalCommunication {...props} />;
        default: return <Home />; 
      }
};

// --- 각 페이지 컴포넌트 ---
const Home = () => <div className="p-6 bg-white rounded-lg shadow-md text-sm"><h3 className="text-xl font-semibold">홈</h3><p>학원 운영의 전반적인 현황을 한눈에 볼 수 있는 주요 정보를 요약하여 제공합니다.</p></div>; 

const StudentManagement = ({ students, classes, getClassesNames, handleSaveStudent, handleDeleteStudent, attendanceLogs, studentMemos, handleSaveMemo, handlePageChange }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('전체'); 
    
    const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
    const [memoStudent, setMemoStudent] = useState(null);

    // 학생 이름을 클릭했을 때 상세 페이지로 이동
    const handleViewDetail = (studentId) => {
         handlePageChange('students', studentId); 
    };

    const handleEdit = (student) => {
        setEditingStudent(student);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingStudent(null);
        setIsModalOpen(false);
    };

    // 메모 모달 핸들러
    const handleOpenMemo = (student) => {
        setMemoStudent(student);
        setIsMemoModalOpen(true);
    }
    const handleCloseMemo = (e) => {
        if (e) e.preventDefault();
        setMemoStudent(null);
        setIsMemoModalOpen(false);
    }

    // 가장 최근 출결 기록을 가져오는 함수
    const getLatestAttendance = (studentId) => {
        const studentLogs = attendanceLogs
            .filter(log => log.studentId === studentId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        return studentLogs.length > 0 ? studentLogs[0].status : '미체크';
    };

    const getStatusColor = (status) => {
        switch (status) {
            case '출석': return 'bg-green-100 text-green-700';
            case '지각': return 'bg-yellow-100 text-yellow-700';
            case '동영상보강': return 'bg-blue-100 text-blue-700';
            case '결석': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-500';
        }
    };


    const filteredStudents = students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              s.school.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === '전체' || s.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">학생 전체 목록 ({filteredStudents.length}명)</h3>
                <button 
                    onClick={() => { setEditingStudent(null); setIsModalOpen(true); }} 
                    className="flex items-center bg-blue-500 text-white text-sm font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition duration-200"
                > 
                    <Icon name="plus" className="w-4 h-4 mr-2" /> 학생 등록 
                </button>
            </div>

            {/* 검색 및 필터링 UI (유지) */}
            <div className="mb-4 flex space-x-4">
                <div className="relative flex-1">
                    <Icon name="search" className="w-4 h-4 absolute top-3 left-3 text-gray-400" /> 
                    <input 
                        type="text" 
                        placeholder="이름, 학교 검색" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full p-2 pl-8 border-2 text-sm border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                </div>
                <select 
                    value={filterStatus} 
                    onChange={e => setFilterStatus(e.target.value)} 
                    className="p-2 border-2 text-sm border-gray-300 rounded-lg bg-white" 
                >
                    <option value="전체">상태 (전체)</option>
                    <option value="재원생">재원생</option>
                    <option value="상담생">상담생</option>
                    <option value="퇴원생">퇴원생</option>
                </select>
            </div>

            <div className="overflow-x-auto border rounded-lg text-sm"> 
                <table className="min-w-full text-left divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {['학생명 / 연락처', '학교/학년', '수강 강좌', '최근 출결', '메모 / 관리'].map(h => <th key={h} className="p-3 font-semibold text-gray-600">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredStudents.map(s => {
                            const latestStatus = getLatestAttendance(s.id);

                            return (
                                <tr key={s.id} className="hover:bg-gray-50">
                                    {/* 학생명 / 연락처: 클릭 가능하도록 수정 */}
                                    <td className="p-3">
                                        <button 
                                            onClick={() => handleViewDetail(s.id)} 
                                            className="font-bold text-gray-900 hover:text-blue-600 hover:underline cursor-pointer"
                                            title="상세 대시보드 보기"
                                        >
                                            {s.name}
                                        </button>
                                        <p className="text-xs text-gray-600 mt-1">
                                            {s.phone} (학생) / {s.parentPhone} (학부모)
                                        </p>
                                    </td>
                                    {/* 학교/학년 추가 */}
                                    <td className="p-3 text-gray-700">
                                        {s.school} {s.grade}학년
                                    </td>
                                    {/* 수강 강좌 */}
                                    <td className="p-3 text-gray-700">
                                        {getClassesNames(s.classes)}
                                    </td>
                                    
                                    {/* 최근 출결 */}
                                    <td className="p-3">
                                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(latestStatus)}`}>
                                            {latestStatus}
                                        </span>
                                    </td>

                                    {/* 메모 / 관리 */}
                                    <td className="p-3 flex space-x-2 items-center">
                                        {/* 상세 대시보드 보기 버튼 추가 */}
                                        <button 
                                            onClick={() => handleViewDetail(s.id)} 
                                            className="text-white bg-blue-500 hover:bg-blue-600 p-1 rounded-lg" 
                                            title="상세 대시보드"
                                        >
                                            <Icon name="monitor" className="w-4 h-4" />
                                        </button>
                                        {/* 메모 버튼 */}
                                        <button onClick={() => handleOpenMemo(s)} className="text-gray-500 hover:text-gray-700 p-1" title="메모"><Icon name="fileText" className="w-4 h-4" /></button>
                                        {/* 수정 버튼 */}
                                        <button onClick={() => handleEdit(s)} className="text-blue-500 hover:text-blue-700 p-1" title="정보 수정"><Icon name="edit" className="w-4 h-4" /></button>
                                        {/* 삭제 버튼 */}
                                        <button onClick={() => handleDeleteStudent(s.id)} className="text-red-500 hover:text-red-700 p-1" title="삭제"><Icon name="trash" className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            )
                        })}
                        {filteredStudents.length === 0 && (
                            <tr><td colSpan="5" className="p-4 text-center text-gray-500">검색 결과가 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* StudentFormModal은 이제 교재 정보를 포함하지 않습니다. */}
            <StudentFormModal 
                isOpen={isModalOpen} 
                onClose={handleCloseModal} 
                student={editingStudent} 
                allClasses={classes}
                onSave={handleSaveStudent}
            />
            
            {/* 메모 모달 */}
            {memoStudent && (
                <MemoModal 
                    isOpen={isMemoModalOpen}
                    onClose={handleCloseMemo}
                    onSave={handleSaveMemo}
                    studentId={memoStudent.id}
                    studentName={memoStudent.name}
                    initialContent={studentMemos[memoStudent.id]}
                />
            )}
        </div>
    );
};


// --- VideoProgressViewer 컴포넌트 (유지) ---
const VideoProgressViewer = ({ log, students, videoProgress, attendanceLogs }) => {
    const logId = log.id;
    const [isExpanded, setIsExpanded] = useState(false); 

    // 해당 수업(log)의 출결 기록 맵
    const logAttendanceMap = attendanceLogs
        .filter(att => att.classId === log.classId && att.date === log.date)
        .reduce((acc, curr) => ({ ...acc, [curr.studentId]: curr.status }), {});
    
    return (
        <div className="mt-4 border rounded-lg bg-white">
            <button 
                onClick={() => setIsExpanded(!isExpanded)} 
                className="flex justify-between items-center w-full p-3 font-bold text-sm text-gray-700 hover:bg-gray-50 transition duration-150"
            > 
                <span>학생별 영상 수강 현황 ({students.length}명)</span>
                <Icon name={isExpanded ? "chevronUp" : "chevronDown"} className="w-4 h-4" /> 
            </button>
            
            {isExpanded && (
                <div className="p-3 border-t">
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {students.length === 0 ? (
                             <p className="text-gray-500 text-xs p-2">등록된 재원생이 없습니다.</p>
                        ) : (
                            students.map(s => {
                                const progress = videoProgress[s.id]?.[logId] || 0;
                                const status = progress === 100 ? '완료' : `${progress}% 시청`;
                                
                                const attendanceStatus = logAttendanceMap[s.id];
                                let statusIcon = null;
                                
                                if (attendanceStatus === '동영상보강') {
                                    statusIcon = <Icon name="clipboardCheck" className="w-4 h-4 ml-2 text-blue-500" title="동영상 보강 필수"/>;
                                } else if (attendanceStatus === '결석') {
                                    statusIcon = <Icon name="x" className="w-4 h-4 ml-2 text-red-500 font-bold" title="결석"/>;
                                }
                                
                                return (
                                    <div key={s.id} className="flex justify-between items-center text-xs p-2 border-b last:border-b-0">
                                        
                                        <span className="font-medium w-24 flex items-center">
                                            {s.name}
                                            {statusIcon}
                                        </span>
                                        
                                        <div className="flex-1 mx-4">
                                            <div className="w-full bg-gray-200 rounded-full h-2"> 
                                                <div 
                                                    className={`h-2 rounded-full ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                                                    style={{ width: `${progress}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                        <span className={`w-16 text-right font-semibold ${progress === 100 ? 'text-green-600' : 'text-blue-500'}`}>{status}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};


// --- ClassSelectionPanel (유지) ---
const ClassSelectionPanel = ({ classes, selectedClassId, setSelectedClassId, handleClassSave, calculateClassSessions, showSessions = true, selectedDate, handleDateNavigate, showEditButton = false, customPanelContent = null, customPanelTitle = '수업 회차' }) => {
    
    const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
    const [isEditClassModalOpen, setIsEditClassModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState(null);

    const selectedClass = classes.find(c => c.id === selectedClassId);
    const sessions = selectedClass ? calculateClassSessions(selectedClass) : [];

    const handleClassSaveAndSelect = (newClassData, isEdit) => {
        handleClassSave(newClassData, isEdit);
        if (!isEdit) {
            setSelectedClassId(newClassData.id);
        }
    };
    
    const handleOpenEdit = (cls) => {
        setEditingClass(cls);
        setIsEditClassModalOpen(true);
    };

    return (
        <div className="w-72 bg-white p-4 rounded-xl shadow-lg flex flex-col space-y-4 flex-shrink-0">
            
            {/* 1. 클래스 목록 및 추가/수정 버튼 */}
            <div className="border-b pb-3 mb-2">
                 <div className="flex justify-between items-center mb-3">
                    <h4 className="text-base font-bold text-gray-800">클래스 목록 ({classes.length}개)</h4> 
                    
                    <button 
                        onClick={() => setIsAddClassModalOpen(true)}
                        className="p-1 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition duration-150 shadow-md"
                        title="새 클래스 추가"
                    >
                        <Icon name="plus" className="w-5 h-5" />
                    </button>
                </div>
                
                <select 
                    value={selectedClassId || ''} 
                    onChange={e => setSelectedClassId(Number(e.target.value))}
                    className="p-2 border rounded-lg w-full text-sm"
                >
                    {!selectedClassId && <option value="" disabled>클래스를 선택해주세요</option>}
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                
                {selectedClass && showEditButton && (
                    <button 
                        onClick={() => handleOpenEdit(selectedClass)}
                        className="w-full mt-2 flex items-center justify-center p-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition duration-150"
                        title="클래스 정보 수정"
                    >
                        <Icon name="edit" className="w-4 h-4 mr-1" /> 정보 수정
                    </button>
                )}

            </div>
            
            {/* 2. 수업 회차 / 커스텀 리스트 */}
            <div className="flex-1 overflow-y-auto pr-2">
                <h4 className="font-bold text-base mb-3">{customPanelTitle} ({showSessions ? sessions.length : 'N'}개)</h4>
                
                {customPanelContent || (
                    showSessions ? (
                        !selectedClassId ? (
                            <p className="text-gray-500 text-sm">클래스를 선택해 주세요.</p>
                        ) : (
                            <div className="space-y-2">
                                {sessions.map(session => (
                                    <div
                                        key={session.date}
                                        onClick={() => handleDateNavigate(session.date, 'date')} 
                                        className={`p-2 border rounded-lg cursor-pointer transition duration-150 text-sm 
                                            ${session.date === selectedDate 
                                                ? 'bg-blue-500 text-white font-semibold shadow-md' 
                                                : 'bg-white hover:bg-gray-100'}`
                                        }
                                    >
                                        <p className="font-bold">
                                            {session.session}회차 
                                            <span className={`${session.date === selectedDate ? 'text-blue-200' : 'text-gray-400'} ml-2 font-normal text-xs`}>
                                                {session.date.slice(5)}
                                            </span>
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        <p className="text-gray-500 text-sm">표시할 목록이 없습니다.</p>
                    )
                )}
            </div>
            
            <ClassFormModal 
                isOpen={isAddClassModalOpen} 
                onClose={() => setIsAddClassModalOpen(false)} 
                onSave={handleClassSaveAndSelect}
                classToEdit={null}
            />
             <ClassFormModal 
                isOpen={isEditClassModalOpen} 
                onClose={() => setIsEditClassModalOpen(false)} 
                onSave={handleClassSaveAndSelect}
                classToEdit={editingClass}
            />
        </div>
    );
};


// --- LessonManagement 컴포넌트 (수정된 컴포넌트) ---
const LessonManagement = ({ students, classes, lessonLogs, handleSaveLessonLog, handleDeleteLessonLog, handleSaveClass, videoProgress, attendanceLogs, calculateClassSessions, logNotification }) => {
    const initialClassId = classes.length > 0 ? classes[0].id : null;
    const [selectedClassId, setSelectedClassId] = useState(initialClassId);
    const [selectedDate, setSelectedDate] = useState(null); 
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState(null);

    const selectedClass = classes.find(c => c.id === selectedClassId);
    
    // 예약 시간을 고려하여 표시할 로그를 필터링
    const classLogs = lessonLogs
        .filter(log => log.classId === selectedClassId)
        .filter(log => {
             // 현재 시간보다 예약 시간이 빠르거나, 예약 시간이 없는 경우만 노출 (모의)
             const isScheduled = log.scheduleTime && new Date(log.scheduleTime) > new Date();
             return !isScheduled;
        })
        .filter(log => selectedDate ? log.date === selectedDate : true)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
        
    const classStudents = students.filter(s => s.status === '재원생' && selectedClass?.students.includes(s.id));
    
    // 선택된 회차의 날짜를 찾기 위한 계산 
    const sessions = selectedClass ? calculateClassSessions(selectedClass) : [];
    const defaultDateForModal = selectedDate || (sessions.length > 0 ? sessions[sessions.length - 1].date : new Date().toISOString().slice(0, 10)); 

    const handleEdit = (log) => {
        setEditingLog(log);
        setSelectedDate(log.date); // 수정 시 날짜 동기화
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingLog(null);
        setIsModalOpen(false);
    };
    
    // 날짜/회차 클릭 핸들러 
    const handleDateNavigate = (date) => {
         if (date === selectedDate) {
             setSelectedDate(null); 
             setEditingLog(null);
             setIsModalOpen(false);
         } else {
             setSelectedDate(date); 
             const log = lessonLogs.find(l => l.classId === selectedClassId && l.date === date);
             
             if (log) {
                 setEditingLog(log); 
                 setIsModalOpen(false); 
             } else {
                 setEditingLog(null); 
                 setIsModalOpen(true); 
             }
         }
    };

    return (
        <div className="flex h-full min-h-[85vh] space-x-6">
            
            {/* 1. 좌측 구역: 클래스 목록 및 수업 회차 리스트 */}
            <ClassSelectionPanel
                classes={classes}
                selectedClassId={selectedClassId}
                setSelectedClassId={setSelectedClassId}
                handleClassSave={handleSaveClass}
                calculateClassSessions={calculateClassSessions}
                showSessions={true}
                selectedDate={selectedDate}
                handleDateNavigate={handleDateNavigate}
                showEditButton={true} 
            />
            
            {/* 2. 우측 구역: 선택된 수업의 일지 관리 */}
            <div className="flex-1 bg-white p-6 rounded-xl shadow-lg min-w-0">
                <h3 className="text-xl font-bold mb-6 text-gray-800">
                    {selectedClass?.name || '수업'} 일지 관리
                    {selectedDate && <span className='text-base font-normal text-gray-500 ml-3'> ({selectedDate.slice(5)} 수업)</span>}
                </h3>
                
                {!selectedClassId ? (
                    <div className="flex items-center justify-center h-48 text-gray-500">
                        좌측 목록에서 관리할 수업을 선택해 주세요.
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-base font-semibold">
                                {selectedDate ? '선택된 회차 기록' : `수업 기록 (${classLogs.length}개)`}
                            </h4>
                            <button 
                                onClick={() => { setEditingLog(null); setSelectedDate(null); setIsModalOpen(true); }} 
                                className="flex items-center bg-blue-500 text-white text-sm font-bold py-2 px-4 rounded-lg hover:bg-blue-600"
                            >
                                <Icon name="plus" className="w-4 h-4 mr-2" /> 새 수업일지 등록
                            </button>
                        </div>
                        
                        <div className="space-y-4 max-h-[calc(85vh-150px)] overflow-y-auto pr-2 text-sm"> 
                            {classLogs.length === 0 ? (
                                <div className="p-4 text-center text-gray-500 border rounded-lg">
                                    {selectedDate ? `${selectedDate}에 등록된 일지가 없습니다. 등록 버튼을 눌러주세요.` : '등록된 수업 일지가 없습니다.'}
                                </div>
                            ) : (
                                classLogs.map(log => (
                                    <div key={log.id} className="p-4 border rounded-lg shadow-sm bg-gray-50 hover:shadow-md transition duration-150">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-base text-blue-700">{log.date}</h4>
                                            <div className="flex space-x-2">
                                                <button onClick={() => handleEdit(log)} className="text-gray-500 hover:text-blue-500" title="수정"><Icon name="edit" className="w-4 h-4" /></button>
                                                <button onClick={() => handleDeleteLessonLog(log.id)} className="text-gray-500 hover:text-red-500" title="삭제"><Icon name="trash" className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                        <p><span className="font-semibold">수업 진도:</span> {log.progress}</p>
                                        
                                        <p className="mt-1 text-xs text-gray-600">
                                            <span className="font-semibold">알림 발송 시각:</span> {new Date(log.scheduleTime).toLocaleString('ko-KR', { timeStyle: 'short', dateStyle: 'short' })}
                                        </p>
                                        
                                        {/* 수업 자료 파일명 */}
                                        {log.materialUrl && (
                                            <p className="mt-1 text-xs"><span className="font-semibold">자료:</span> <a href="#" onClick={(e) => { e.preventDefault(); alert(`[${log.materialUrl}] 다운로드 (모의)`); }} className="text-blue-500 hover:underline">{log.materialUrl}</a></p>
                                        )}
                                        
                                        {/* iframeCode 표시 */}
                                        {log.iframeCode && (
                                            <div className="mt-2 p-3 bg-gray-100 rounded-lg text-xs text-gray-700 overflow-x-auto">
                                                <p className="font-semibold mb-1">YouTube "iframe" 코드:</p>
                                                <code className="block whitespace-pre-wrap break-all border p-1 bg-white rounded">
                                                    {log.iframeCode}
                                                </code>
                                            </div>
                                        )}
                                        
                                        {log.iframeCode && <VideoProgressViewer log={log} students={classStudents} videoProgress={videoProgress} attendanceLogs={attendanceLogs} />}
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}

            <LessonLogFormModal 
                isOpen={isModalOpen} 
                onClose={handleCloseModal} 
                onSave={handleSaveLessonLog} 
                classId={selectedClassId} 
                log={editingLog}
                classes={classes} 
                calculateClassSessions={calculateClassSessions} 
                defaultDate={defaultDateForModal} 
                students={students} 
                logNotification={logNotification} 
            />
            </div>
        </div>
    );
};


// --- AttendanceManagement 컴포넌트 (유지) ---
const AttendanceManagement = ({ students, classes, attendanceLogs, handleSaveAttendance, studentMemos, handleSaveMemo, handleSaveClass, calculateClassSessions }) => {
    const initialClassId = classes.length > 0 ? initialClasses[0].id : null;
    const [selectedClassId, setSelectedClassId] = useState(initialClassId);
    const [selectedDate, setSelectedDate] = useState(null); 
    
    // --- 메모 모달 상태 ---
    const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
    const [memoStudent, setMemoStudent] = useState(null);
    
    // --- 임시 출결 상태 ---
    const [tempAttendanceMap, setTempAttendanceMap] = useState({}); 
    const [tempTableAttendanceMap, setTempTableAttendanceMap] = useState({}); 
    
    const tableRef = useRef(null); 

    const ATT_OPTIONS = ['출석', '지각', '동영상보강', '결석'];

    const selectedClass = classes.find(c => c.id === selectedClassId);
    // '재원생' 상태인 학생만 출결 관리에 포함
    const classStudents = students.filter(s => s.status === '재원생' && selectedClass?.students.includes(s.id)) || []; 
    
    // 현재 날짜/반의 실제 DB 기록을 맵으로 구성
    const currentAttendanceMap = attendanceLogs
        .filter(log => log.classId === selectedClassId && log.date === selectedDate)
        .reduce((acc, log) => { acc[log.studentId] = log.status; return acc; }, {});
        
    // 전체 클래스에 대한 출결 기록 맵 (테이블 뷰 용 - 날짜별 학생 상태)
    const allAttendanceMap = attendanceLogs
        .filter(log => log.classId === selectedClassId)
        .reduce((acc, log) => {
            if (!acc[log.date]) acc[log.date] = {};
            acc[log.date][log.studentId] = log.status;
            return acc;
        }, {});
        
    // 컴포넌트 마운트 및 클래스/날짜 변경 시 임시 상태 초기화
    useEffect(() => {
        setTempAttendanceMap(currentAttendanceMap);
        setTempTableAttendanceMap(JSON.parse(JSON.stringify(allAttendanceMap))); 
        
        if (!selectedClassId) {
            setSelectedDate(null);
        }
    }, [selectedClassId, selectedDate, students, attendanceLogs]);

    // 출결 상태 토글 로직 (카드 뷰)
    const handleAttendanceToggle = (studentId, toggledStatus) => {
        if (!selectedDate) return;
        
        setTempAttendanceMap(prevMap => {
            const currentStatus = prevMap[studentId] || currentAttendanceMap[studentId] || '미체크';
            
            let newStatus;
            if (currentStatus === toggledStatus) {
                newStatus = '미체크'; 
            } else {
                newStatus = toggledStatus; 
            }
            
            if (newStatus === '미체크') {
                const newMap = { ...prevMap };
                delete newMap[studentId];
                return newMap;
            } else {
                return { ...prevMap, [studentId]: newStatus };
            }
        });
    };
    
    // --- 테이블 뷰 임시 상태 변경 핸들러 ---
    const handleTableAttendanceChange = (studentId, date, newStatus) => {
        setTempTableAttendanceMap(prevMap => {
            const newMap = JSON.parse(JSON.stringify(prevMap));
            if (!newMap[date]) newMap[date] = {};
            
            if (newStatus === '미체크') {
                delete newMap[date][studentId];
                if (Object.keys(newMap[date]).length === 0) {
                    delete newMap[date];
                }
            } else {
                newMap[date][studentId] = newStatus;
            }
            return newMap;
        });
    };

    // 출결 수정 사항 저장 (카드 뷰)
    const handleSaveAttendanceChanges = () => {
        if (!selectedClassId || !selectedDate || isCardSaveDisabled) return;

        const changesToSave = classStudents.map(s => ({
            classId: selectedClassId,
            date: selectedDate,
            studentId: s.id,
            status: tempAttendanceMap[s.id] || currentAttendanceMap[s.id] || '미체크'
        }));

        handleSaveAttendance(changesToSave);
        
        const updatedCurrentMap = changesToSave
            .filter(c => c.status !== '미체크')
            .reduce((acc, c) => { acc[c.studentId] = c.status; return acc; }, {});
            
        setTempAttendanceMap(updatedCurrentMap); 
        alert(`[${selectedDate}] 출결 기록이 저장되었습니다.`);
    };
    
    // 출결 수정 사항 저장 (테이블 뷰)
    const handleSaveTableChanges = () => {
        if (!selectedClassId || isTableSaveDisabled) return;
        
        const allChanges = [];
        const sessions = calculateClassSessions(selectedClass);
        const allSessionDates = sessions.map(s => s.date);
        
        // 변경 사항 수집 로직 (기존 로직 유지)
        allSessionDates.forEach(date => {
            classStudents.forEach(student => {
                const tempStatus = tempTableAttendanceMap[date] ? (tempTableAttendanceMap[date][student.id] || '미체크') : '미체크';
                const currentStatus = allAttendanceMap[date] ? (allAttendanceMap[date][student.id] || '미체크') : '미체크';
                
                if (tempStatus !== currentStatus) {
                     allChanges.push({
                        classId: selectedClassId,
                        date: date,
                        studentId: student.id,
                        status: tempStatus
                    });
                }
            });
        });
        
        if (allChanges.length === 0) return;
        
        handleSaveAttendance(allChanges); // 일괄 저장
        
        // 저장 후, 임시 맵을 현재 기록 맵과 동기화
        const updatedAllAttendanceMap = JSON.parse(JSON.stringify(allAttendanceMap)); 
        allChanges.forEach(change => {
            if (!updatedAllAttendanceMap[change.date]) updatedAllAttendanceMap[change.date] = {};
            if (change.status === '미체크') {
                delete updatedAllAttendanceMap[change.date][change.studentId];
                if (Object.keys(updatedAllAttendanceMap[change.date]).length === 0) {
                    delete updatedAllAttendanceMap[change.date];
                }
            } else {
                updatedAllAttendanceMap[change.date][change.studentId] = change.status;
            }
        });
        setTempTableAttendanceMap(updatedAllAttendanceMap); 
        alert("누적 출결 기록이 저장되었습니다.");
    }

    // 메모 모달 핸들러 (유지)
    const handleOpenMemo = (student) => {
        setMemoStudent(student);
        setIsMemoModalOpen(true);
    }
    const handleCloseMemo = () => {
        setMemoStudent(null);
        setIsMemoModalOpen(false);
    }
    
    // --- 저장 필요 여부 체크 (유지) ---
    const isCardSaveDisabled = (() => {
        if (!selectedDate) return true; 
        const allStudentIds = classStudents.map(s => s.id);
        
        for (const id of allStudentIds) {
            const tempStatus = tempAttendanceMap[id] || (currentAttendanceMap[id] ? currentAttendanceMap[id] : '미체크');
            const currentStatus = currentAttendanceMap[id] || '미체크';
            if (tempStatus !== currentStatus) return false; 
        }
        return true; 
    })();

    const isTableSaveDisabled = (() => {
        if (selectedDate) return true; 
        return JSON.stringify(tempTableAttendanceMap) === JSON.stringify(allAttendanceMap);
    })();
    
    
    // 중앙 내비게이션 핸들러 (경고 팝업 포함)
    const handleNavigate = (newDateOrClassId, type) => {
        const isDirty = (selectedDate && !isCardSaveDisabled) || (!selectedDate && !isTableSaveDisabled);
        
        if (isDirty) {
            const confirm = window.confirm("저장되지 않은 출결 수정 사항이 있습니다. 변경 사항을 버리고 페이지를 이동하시겠습니까?");
            if (!confirm) { return; }
        }
        
        if (type === 'date') {
            if (newDateOrClassId === selectedDate) { setSelectedDate(null); } 
            else { setSelectedDate(newDateOrClassId); }
        } else if (type === 'class') {
            setSelectedClassId(newDateOrClassId);
            setSelectedDate(null);
        }
    };

    const sessions = calculateClassSessions(selectedClass);
    
    const getStatusColor = (status) => { 
        switch (status) {
            case '출석': return 'bg-green-100 text-green-700';
            case '지각': return 'bg-yellow-100 text-yellow-700';
            case '동영상보강': return 'bg-blue-100 text-blue-700';
            case '결석': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-500';
        }
    };
    const getButtonClass = (buttonStatus, studentId) => { 
        const currentStatus = tempAttendanceMap[studentId] || currentAttendanceMap[studentId] || '미체크'; 
        const baseClass = "px-3 py-1 text-xs rounded-lg font-bold transition duration-150 shadow-sm"; 

        if (buttonStatus === currentStatus) {
            switch (currentStatus) {
                case '출석': return `${baseClass} bg-green-600 text-white shadow-lg shadow-green-200/50`;
                case '지각': return `${baseClass} bg-yellow-600 text-white shadow-lg shadow-yellow-200/50`;
                case '동영상보강': return `${baseClass} bg-blue-600 text-white shadow-lg shadow-blue-200/50`;
                case '결석': return `${baseClass} bg-red-600 text-white shadow-lg shadow-red-200/50`;
                default: return `${baseClass} bg-gray-500 text-white`;
            }
        }
        switch (buttonStatus) {
            case '출석': return `${baseClass} bg-green-100 text-green-700 hover:bg-green-200 hover:shadow-md`;
            case '지각': return `${baseClass} bg-yellow-100 text-yellow-700 hover:bg-yellow-200 hover:shadow-md`;
            case '동영상보강': return `${baseClass} bg-blue-100 text-blue-700 hover:bg-blue-200 hover:shadow-md`;
            case '결석': return `${baseClass} bg-red-100 text-red-700 hover:bg-red-200 hover:shadow-md`;
            default: return `${baseClass} bg-gray-100 text-gray-700 hover:bg-gray-200`;
        }
    };
    const getMemoButtonClass = (hasMemo) => { 
        const baseClass = "p-1 rounded-lg transition duration-150"; 
        return hasMemo 
            ? `${baseClass} bg-blue-500 text-white hover:bg-blue-600`
            : `${baseClass} bg-gray-200 text-gray-600 hover:bg-gray-300`;
    };
    
    // --- 서브 컴포넌트: 전체 출결 테이블 뷰 ---
    const AllAttendanceTable = () => {
        const allSessionDates = sessions.map(s => s.date);
        const ATT_OPTIONS_ALL = [...ATT_OPTIONS, '미체크'];
        
        const handleTableChange = (studentId, date, newStatus) => {
             handleTableAttendanceChange(studentId, date, newStatus);
        };

        return (
            <div className="overflow-x-visible border rounded-lg max-w-full"> 
                <table className="divide-y divide-gray-200 text-sm"> 
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase sticky left-0 top-0 bg-gray-50 z-30 min-w-[150px] border-r">수강생 이름</th> 
                            {allSessionDates.map((date, index) => (
                                <th key={date} className="px-3 py-2 text-center text-xs font-semibold text-gray-600 min-w-[90px] sticky top-0 bg-gray-50 z-10">
                                    {index + 1}회차<br/>
                                    <span className='font-normal text-gray-400'>{date.slice(5)}</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {classStudents.map(student => (
                            <tr key={student.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2 font-medium sticky left-0 bg-white hover:bg-gray-50 z-20 min-w-[150px] text-left border-r">{student.name}</td> 
                                {allSessionDates.map(date => {
                                    const status = tempTableAttendanceMap[date] ? (tempTableAttendanceMap[date][student.id] || '미체크') : (allAttendanceMap[date] ? (allAttendanceMap[date][student.id] || '미체크') : '미체크');
                                    
                                    return (
                                        <td key={date} className="px-1 py-1 text-center relative group z-10">
                                            <select
                                                value={status}
                                                onChange={(e) => handleTableChange(student.id, date, e.target.value)}
                                                className={`w-full p-1 border rounded text-xs ${getStatusColor(status)} appearance-none text-center`}
                                            >
                                                {ATT_OPTIONS_ALL.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className={`text-xs p-2 ${!isTableSaveDisabled ? 'text-red-500' : 'text-gray-500'}`}>
                    * 테이블에서 출결 상태를 변경하면 {!isTableSaveDisabled ? '저장해야 반영됩니다.' : '저장할 수 있습니다.'}
                </p>
            </div>
        );
    };

    // --- 서브 컴포넌트: 회차별 카드 뷰 ---
    const SessionAttendanceCards = () => (
        <div className="space-y-3 text-sm max-h-[calc(85vh-200px)] overflow-y-auto"> 
            {classStudents.map(s => {
                const hasMemo = !!studentMemos[s.id];

                return (
                    <div key={s.id} className="flex justify-between items-center p-4 border rounded-xl shadow-sm bg-gray-50">
                        
                        <div className="flex items-center space-x-3"> 
                            <div className="flex items-center justify-center w-8 h-8 bg-gray-300 rounded-full text-gray-700"> 
                                <Icon name="users" className="w-4 h-4"/> 
                            </div>
                            
                            <div>
                                <p className="font-bold text-gray-900">{s.name}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    학생: {s.phone} / 학부모: {s.parentPhone}
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                            
                            {ATT_OPTIONS.map(status => (
                                <button 
                                    key={status}
                                    onClick={() => handleAttendanceToggle(s.id, status)}
                                    className={getButtonClass(status, s.id)} 
                                >
                                    {status}
                                </button>
                            ))}
                            
                            <button 
                                onClick={() => handleOpenMemo(s)}
                                className={getMemoButtonClass(hasMemo)}
                                title={hasMemo ? "메모 작성됨" : "메모 작성"}
                            >
                                <Icon name="fileText" className="w-4 h-4" /> 
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
    
    // --- 메인 렌더링 ---
    return (
        <div className="flex h-full min-h-[85vh] space-x-6">
            
            <div className="w-72 flex flex-col space-y-4 flex-shrink-0">
                <ClassSelectionPanel
                    classes={classes}
                    selectedClassId={selectedClassId}
                    setSelectedClassId={(id) => handleNavigate(id, 'class')} 
                    handleClassSave={handleSaveClass}
                    calculateClassSessions={calculateClassSessions}
                    showSessions={true}
                    selectedDate={selectedDate}
                    handleDateNavigate={(date) => handleNavigate(date, 'date')} 
                />
            </div>

            <div className="flex-1 bg-white p-6 rounded-xl shadow-lg min-w-0 overflow-hidden">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <h3 className="text-xl font-bold text-gray-800">
                        {selectedClass ? `${selectedClass.name} 출결 기록` : '출석 기록 조회'}
                        {selectedDate && <span className='text-base font-normal text-gray-500 ml-3'> ({selectedDate.slice(5)})</span>}
                    </h3>
                    
                    {(selectedDate && (
                        <button 
                            onClick={handleSaveAttendanceChanges} 
                            disabled={isCardSaveDisabled}
                            className={`flex items-center text-sm font-bold py-2 px-4 rounded-lg transition duration-200 
                                ${isCardSaveDisabled 
                                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                                }`
                            }
                        >
                            <Icon name="edit" className="w-4 h-4 mr-2" /> 출결 저장
                        </button>
                    )) || (!selectedDate && (
                        <button 
                            onClick={handleSaveTableChanges} 
                            disabled={isTableSaveDisabled}
                            className={`flex items-center text-sm font-bold py-2 px-4 rounded-lg transition duration-200 
                                ${isTableSaveDisabled 
                                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                    : 'bg-green-600 text-white hover:bg-green-700 shadow-md'
                                }`
                            }
                        >
                            <Icon name="edit" className="w-4 h-4 mr-2" /> 전체 테이블 저장
                        </button>
                    ))}
                </div>

                {!selectedClassId ? (
                    <div className="flex items-center justify-center h-48 text-gray-500 text-base">
                        좌측 상단에서 관리할 **클래스**를 선택해 주세요.
                    </div>
                ) : (
                    selectedDate ? (
                         <SessionAttendanceCards />
                    ) : (
                        <div ref={tableRef} className="space-y-4 max-h-[calc(85vh-150px)] overflow-y-auto pr-2"> 
                            <p className="text-gray-600 text-sm">좌측 회차 목록에서 날짜를 선택하면 개별 수정이 가능합니다.</p>
                            <AllAttendanceTable />
                        </div>
                    )
                )}
            </div>
            
            {memoStudent && (
                <MemoModal 
                    isOpen={isMemoModalOpen}
                    onClose={handleCloseMemo}
                    onSave={handleSaveMemo}
                    studentId={memoStudent.id}
                    studentName={memoStudent.name}
                    initialContent={studentMemos[memoStudent.id]}
                />
            )}
        </div>
    );
};


// --- HomeworkManagement 컴포넌트 (유지) ---
const HomeworkManagement = ({ students, classes, homeworkAssignments, homeworkResults, handleSaveHomeworkAssignment, handleDeleteHomeworkAssignment, handleUpdateHomeworkResult, handleSaveClass, calculateClassSessions }) => {
    const initialClassId = classes.length > 0 ? classes[0].id : null;
    const [selectedClassId, setSelectedClassId] = useState(initialClassId);
    const [selectedDate, setSelectedDate] = useState(null); 
    const [selectedAssignment, setSelectedAssignment] = useState(null); 
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState(null);

    const selectedClass = classes.find(c => c.id === selectedClassId);
    
    // 선택된 클래스의 과제 목록 (날짜 최신순)
    const classAssignments = homeworkAssignments
        .filter(a => a.classId === selectedClassId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
        
    // '재원생' 상태인 학생만 과제 관리에 포함
    const classStudents = students.filter(s => s.status === '재원생' && selectedClass?.students.includes(s.id)) || [];

    const sessions = calculateClassSessions(selectedClass);
    
    // 과제 등록일 (N회차) -> 검사일 (N+1회차) 찾기
    const findAssignmentCheckDate = (assignmentDate) => {
        const assignmentSessionIndex = sessions.findIndex(s => s.date === assignmentDate);
        if (assignmentSessionIndex === -1) return null; // 등록일이 수업 날짜가 아님

        const nextSession = sessions[assignmentSessionIndex + 1];
        return nextSession ? nextSession.date : null;
    }
    
    // 과제 등록일 클릭 핸들러 (N회차)
    const handleAssignmentNavigate = (assignment) => {
        const checkDate = findAssignmentCheckDate(assignment.date); // N+1회차 날짜
        
        if (!checkDate) {
            alert("다음 수업 일정을 찾을 수 없어 과제 검사 화면을 표시할 수 없습니다.");
            return;
        }

        setSelectedDate(checkDate);
        setSelectedAssignment(assignment);
    }
    
    // 회차 클릭 핸들러 
    const handleDateNavigate = (date) => {
        // 이 날짜가 과제 검사일(N+1회차)인지 확인 -> 검사일이면 해당 과제(N회차) 찾기
        const sessionIndex = sessions.findIndex(s => s.date === date);
        if (sessionIndex > 0) { // 첫 회차는 검사일이 될 수 없음
            const assignmentDate = sessions[sessionIndex - 1].date; // N-1 회차 날짜 (과제 등록일)
            const assignment = classAssignments.find(a => a.date === assignmentDate);
            
            if (date === selectedDate) {
                setSelectedDate(null);
                setSelectedAssignment(null);
            } else if (assignment) {
                setSelectedDate(date); // 검사일로 설정
                setSelectedAssignment(assignment);
            } else {
                 setSelectedDate(date); // 날짜만 선택하고 해당 회차에 검사할 과제는 없음을 표시
                 setSelectedAssignment(null);
            }
        } else if (sessionIndex === 0 && date === selectedDate) {
            setSelectedDate(null);
            setSelectedAssignment(null);
        } else if (sessionIndex === 0) {
            alert("첫 회차 수업에는 이전 과제 검사 기능이 없습니다.");
        } else {
            setSelectedDate(null);
            setSelectedAssignment(null);
        }
    }


    // 문항별 과제 결과 입력 테이블 (유지)
    const HomeworkResultTable = ({ assignment }) => {
        const tableRef = useRef(null);
        const totalQuestions = assignment.totalQuestions;
        const assignmentId = assignment.id;
        // 문항 ID 목록 (startQuestion, startQuestion+1, ..., endQuestion)
        const questionIds = Array.from({ length: assignment.endQuestion - assignment.startQuestion + 1 }, (_, i) => 
            String(assignment.startQuestion + i)
        ); 
        
        const RESULT_OPTIONS = ['맞음', '틀림', '고침', '미체크'];
        
        // **getSummaryCounts 함수 정의:** 
        const getSummaryCounts = (results) => {
            const counts = { '맞음': 0, '틀림': 0, '고침': 0, '미체크': 0 };
            questionIds.forEach(id => {
                const status = results[id] || '미체크';
                counts[status]++;
            });
            return counts;
        }
        
        // 현재 DB 상태를 Deep Clone하여 임시 상태로 사용
        const initialResultsMap = classStudents.reduce((acc, s) => {
            acc[s.id] = JSON.parse(JSON.stringify(homeworkResults[s.id]?.[assignmentId] || {}));
            return acc;
        }, {});
        
        const [tempResults, setTempResults] = useState(initialResultsMap);
        const [isDirty, setIsDirty] = useState(false);
        const [activeCell, setActiveCell] = useState(null); // { studentId, qId }

        useEffect(() => {
            // 외부 props 변경 시 초기화
            setTempResults(initialResultsMap);
            setIsDirty(false);
            setActiveCell(null);
        }, [assignmentId, homeworkResults, classStudents.length]);

        // 변경 사항 감지 로직
        useEffect(() => {
            const currentJson = JSON.stringify(initialResultsMap);
            const tempJson = JSON.stringify(tempResults);
            setIsDirty(currentJson !== tempJson);
        }, [tempResults, initialResultsMap]);

        const getStatusColor = (status) => {
            switch (status) {
                case '맞음': return 'bg-green-100 text-green-700';
                case '틀림': return 'bg-red-100 text-red-700';
                case '고침': return 'bg-blue-100 text-blue-700';
                case '미체크': return 'bg-gray-100 text-gray-500';
                default: return 'bg-gray-100 text-gray-500';
            }
        };

        const updateTempResult = useCallback((studentId, qId, status) => {
            setTempResults(prev => {
                const newStudentResults = { ...prev[studentId] };
                if (status === '미체크' || status === '') {
                    delete newStudentResults[qId];
                } else {
                    newStudentResults[qId] = status;
                }
                return { ...prev, [studentId]: newStudentResults };
            });
        }, []);


        const handleKeyDown = useCallback((e, studentId, qId) => {
            const map = { '1': '맞음', '2': '틀림', '3': '고침' };
            const statusToSet = map[e.key];
            
            // 학생 목록과 문항 ID 목록
            const studentsInTable = classStudents.filter(s => assignment.students.includes(s.id));
            const studentIds = studentsInTable.map(s => s.id);
            const qIndex = questionIds.indexOf(qId);
            const sIndex = studentIds.indexOf(studentId);


            if (statusToSet) {
                e.preventDefault(); 
                updateTempResult(studentId, qId, statusToSet);
                
                // 다음 셀로 포커스 이동 (가로)
                if (qIndex < totalQuestions - 1) {
                    const nextQId = questionIds[qIndex + 1];
                    const nextCell = document.getElementById(`cell-${studentId}-${nextQId}`);
                    nextCell?.focus();
                } else if (sIndex < studentsInTable.length - 1) {
                    // 줄 끝이면 다음 학생의 첫 번째 문항으로 이동
                    const nextStudentId = studentIds[sIndex + 1];
                    const nextCell = document.getElementById(`cell-${nextStudentId}-${questionIds[0]}`);
                    nextCell?.focus();
                }

            } else if (e.key === '0' || e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                updateTempResult(studentId, qId, '미체크');
            } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
                // Tab 또는 오른쪽 화살표: 다음 문항으로 이동 (브라우저 기본 동작 사용)
            } else if (e.key === 'ArrowLeft' || (e.shiftKey && e.key === 'Tab')) {
                // Shift+Tab 또는 왼쪽 화살표: 이전 문항으로 이동 (브라우저 기본 동작 사용)
            } else if (e.key === 'ArrowDown' && sIndex < studentsInTable.length - 1) {
                 // 아래 화살표: 다음 학생의 같은 문항으로 이동
                e.preventDefault();
                const nextStudentId = studentIds[sIndex + 1];
                const nextCell = document.getElementById(`cell-${nextStudentId}-${qId}`);
                nextCell?.focus();
            } else if (e.key === 'ArrowUp' && sIndex > 0) {
                 // 위 화살표: 이전 학생의 같은 문항으로 이동
                e.preventDefault();
                const prevStudentId = studentIds[sIndex - 1];
                const prevCell = document.getElementById(`cell-${prevStudentId}-${qId}`);
                prevCell?.focus();
            }
        }, [updateTempResult, questionIds, totalQuestions, classStudents, assignment.students]);
        
        const handleSave = () => {
            if (!isDirty) return;
            
            // 변경 사항을 취합하여 DB 저장 함수 호출
            classStudents.forEach(s => {
                questionIds.forEach(qId => {
                    const status = tempResults[s.id]?.[qId] || '미체크';
                    const initialStatus = initialResultsMap[s.id]?.[qId] || '미체 체크';
                    
                    if (status !== initialStatus) {
                         handleUpdateHomeworkResult(s.id, assignmentId, qId, status);
                    }
                });
            });
            
            setIsDirty(false);
            alert("과제 검사 결과가 저장되었습니다.");
        };

        // 완성율 계산
        const calculateCompletion = (results) => {
            const summary = getSummaryCounts(results);
            const checkedCount = totalQuestions - summary['미체크'];
            return Math.round((checkedCount / totalQuestions) * 100);
        }


        return (
            <div className="overflow-x-auto">
                <div className='flex justify-between items-center mb-3'>
                    <p className='text-xs text-gray-600'>* 문항 셀 선택 후 **1(맞음), 2(틀림), 3(고침), 0/Del(미체크)**로 빠르게 입력 가능합니다.</p>
                    <button 
                        onClick={handleSave} 
                        disabled={!isDirty} 
                        className={`text-xs font-bold py-1 px-3 rounded-lg transition duration-200 ${isDirty ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}
                    >
                        <Icon name='edit' className='w-4 h-4 inline mr-1'/> 결과 저장
                    </button>
                </div>
                
                <div className='border rounded-lg' ref={tableRef}>
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-2 text-left text-xs font-semibold text-gray-600 uppercase w-32 sticky left-0 bg-gray-50 z-20 border-r">학생명 (완성율)</th>
                                {questionIds.map(id => (
                                    <th key={id} className="p-1 text-center text-xs font-semibold text-gray-600 min-w-[50px]">{id}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {classStudents.map(student => {
                                // 과제가 할당된 학생만 표시 
                                if (!assignment.students.includes(student.id)) return null; 
                                
                                const completionRate = calculateCompletion(tempResults[student.id]);
                                
                                return (
                                    <tr key={student.id} className="hover:bg-gray-50">
                                        <td className="p-2 font-medium sticky left-0 bg-white hover:bg-gray-50 z-1 text-left border-r min-w-[120px]">
                                            {student.name}
                                            <span className={`ml-2 text-xs font-bold ${completionRate === 100 ? 'text-green-600' : completionRate > 50 ? 'text-blue-600' : 'text-red-500'}`}>
                                                ({completionRate}%)
                                            </span>
                                        </td>
                                        
                                        {questionIds.map(qId => {
                                            const status = tempResults[student.id]?.[qId] || '미체크';
                                            return (
                                                <td key={qId} className="p-1 text-center">
                                                    <div
                                                        id={`cell-${student.id}-${qId}`}
                                                        tabIndex="0" // 키보드 포커스 가능하게
                                                        className={`w-12 h-6 mx-auto border rounded text-xs flex items-center justify-center cursor-pointer font-bold outline-none ring-2 ring-transparent transition-all duration-100 ${getStatusColor(status)} ${activeCell?.studentId === student.id && activeCell?.qId === qId ? 'ring-blue-500' : ''}`}
                                                        onKeyDown={(e) => handleKeyDown(e, student.id, qId)}
                                                        onClick={() => setActiveCell({ studentId: student.id, qId })}
                                                        onFocus={() => setActiveCell({ studentId: student.id, qId })}
                                                        onBlur={() => setActiveCell(null)}
                                                        title={`키보드: ${status === '맞음' ? '1' : status === '틀림' ? '2' : status === '고침' ? '3' : '0/1/2/3'}`}
                                                    >
                                                        {status.slice(0, 1)}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-[85vh] space-x-6">
            
            {/* 1. 좌측 구역: 클래스 목록 및 수업 회차 리스트 (과제 등록일/검사일 논리 사용) */}
            <ClassSelectionPanel
                classes={classes}
                selectedClassId={selectedClassId}
                setSelectedClassId={setSelectedClassId}
                handleClassSave={handleSaveClass}
                calculateClassSessions={calculateClassSessions}
                showSessions={true}
                selectedDate={selectedDate} // 검사일
                handleDateNavigate={handleDateNavigate}
            />

            {/* 2. 우측 메인 구역 */}
            <div className="flex-1 bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold mb-6 text-gray-800">
                    {selectedClass?.name || '클래스'} 과제 관리
                    {selectedDate && <span className='text-base font-normal text-gray-500 ml-3'> (검사일: {selectedDate.slice(5)})</span>}
                </h3>
                
                 <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <h4 className="text-base font-semibold">
                        {selectedAssignment ? `[${selectedAssignment.date.slice(5)} 등록] 과제 검사 입력` : '등록된 과제 목록'}
                    </h4>
                    <button 
                        onClick={() => { setEditingAssignment(null); setIsAssignmentModalOpen(true); }} 
                        className="flex items-center bg-green-500 text-white text-sm font-bold py-2 px-4 rounded-lg hover:bg-green-600"
                    >
                        <Icon name="plus" className="w-4 h-4 mr-2" /> 새 과제 등록
                    </button>
                </div>

                {!selectedClassId ? (
                     <div className="flex items-center justify-center h-48 text-gray-500 text-base">
                        좌측 목록에서 관리할 **클래스**를 선택해 주세요.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {/* 과제 목록 / 상세 정보 */}
                        <div className="md:col-span-1 border p-4 rounded-lg bg-gray-50 max-h-[calc(85vh-200px)] overflow-y-auto">
                            <h5 className="font-semibold mb-3 text-sm">등록된 과제 ({classAssignments.length}개)</h5>
                            <div className="space-y-2 text-sm">
                                {classAssignments.length === 0 ? (
                                    <p className="text-gray-500 text-sm">등록된 과제가 없습니다.</p>
                                ) : (
                                    classAssignments.map(assignment => {
                                        const checkDate = findAssignmentCheckDate(assignment.date);
                                        return (
                                            <div 
                                                key={assignment.id} 
                                                onClick={() => handleAssignmentNavigate(assignment)}
                                                className={`p-3 border rounded-lg cursor-pointer transition duration-150 ${selectedAssignment?.id === assignment.id ? 'bg-blue-200 border-blue-500 shadow-md' : 'bg-white hover:bg-blue-50'}`}
                                            >
                                                <p className="font-bold">{assignment.date} 등록 (검사일: {checkDate ? checkDate.slice(5) : '미정'})</p>
                                                <p className="text-xs truncate">교재: {assignment.book} / 문항: {assignment.startQuestion}~{assignment.endQuestion} ({assignment.totalQuestions}개)</p>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>

                        {/* 과제 결과 입력 화면 */}
                        <div className="md:col-span-1 border p-4 rounded-lg max-h-[calc(85vh-200px)] overflow-y-auto">
                            {selectedAssignment ? (
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <p className="text-sm font-semibold text-gray-700">과제: {selectedAssignment.content}</p>
                                        <div className="flex space-x-2">
                                            <button onClick={() => { setEditingAssignment(selectedAssignment); setIsAssignmentModalOpen(true); }} className="text-blue-500 hover:text-blue-700" title="수정"><Icon name="edit" className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteHomeworkAssignment(selectedAssignment.id)} className="text-red-500 hover:text-red-700" title="삭제"><Icon name="trash" className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    <p className="text-xs font-bold text-gray-600 mb-4">문항 범위: {selectedAssignment.startQuestion}~{selectedAssignment.endQuestion} (총 {selectedAssignment.totalQuestions}개)</p>
                                    
                                    <h5 className="font-bold mt-4 mb-2 text-sm">문항별 결과 입력 ({selectedAssignment.students.length}명)</h5>
                                    
                                    <HomeworkResultTable assignment={selectedAssignment} />
                                    
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-48 text-gray-500 text-base">
                                    좌측 회차를 클릭하거나, 과제 목록에서 과제를 선택하세요.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <HomeworkAssignmentModal 
                isOpen={isAssignmentModalOpen} 
                onClose={() => setIsAssignmentModalOpen(false)}
                onSave={handleSaveHomeworkAssignment}
                classId={selectedClassId}
                assignment={editingAssignment}
                students={students}
                selectedClass={selectedClass}
            />
        </div>
    );
};


// --- GradeManagement 컴포넌트 (유지) ---
const GradeManagement = ({ students, classes, tests, grades, handleSaveTest, handleDeleteTest, handleUpdateGrade, handleSaveClass, calculateClassSessions }) => {
    const initialClassId = classes.length > 0 ? classes[0].id : null;
    const [selectedClassId, setSelectedClassId] = useState(initialClassId);
    const [selectedDate, setSelectedDate] = useState(null); 
    const [isTestModalOpen, setIsTestModalOpen] = useState(false);
    const [editingTest, setEditingTest] = useState(null);
    const [selectedTest, setSelectedTest] = useState(null); 

    const selectedClass = classes.find(c => c.id === selectedClassId);
    
    // 테스트 목록 (날짜 최신순)
    const classTests = tests
        .filter(t => t.classId === selectedClassId)
        .sort((a, b) => {
            // 날짜 필드를 사용하여 정렬
            const dateA = a.date;
            const dateB = b.date;
            if (dateA && dateB) {
                return new Date(dateB) - new Date(dateA);
            }
            return b.id - a.id;
        });

    // '재원생' 상태인 학생만 성적 관리에 포함
    const classStudents = students.filter(s => s.status === '재원생' && selectedClass?.students.includes(s.id));

    const calculateClassAverages = () => {
        const averages = {};
        if (classStudents.length === 0) return {};
        classTests.forEach(test => {
            let totalScore = 0;
            let studentCount = 0;
            classStudents.forEach(student => {
                const score = grades[student.id]?.[test.id]?.score;
                if (score !== undefined && score !== null && score !== '') {
                    totalScore += Number(score);
                    studentCount++;
                }
            });
            averages[test.id] = studentCount > 0 ? (totalScore / studentCount).toFixed(1) : '-';
        });
        return averages;
    };

    const classAverages = calculateClassAverages();
    
    const handleEditTest = (test) => {
        setEditingTest(test);
        setIsTestModalOpen(true);
    }
    
    const handleCloseTestModal = () => {
        setEditingTest(null);
        setIsTestModalOpen(false);
    }
    
    const handleCorrectCountChange = (studentId, testId, value) => {
        // 숫자, 소수점, 빈 문자열만 허용 (부분 점수 가능성을 위해)
        if (value === '' || /^\d*\.?\d*$/.test(value)) {
             handleUpdateGrade(studentId, testId, value);
        }
    }
    
    // 테스트 클릭 핸들러
    const handleTestNavigate = (test) => {
        if (selectedTest?.id === test.id) {
            setSelectedDate(null);
            setSelectedTest(null);
        } else {
            setSelectedDate(test.date);
            setSelectedTest(test);
        }
    }
    
    
    // --- 전체 성적표 (Full Grade Table) ---
    const FullGradeTable = () => (
        <div className="overflow-x-auto border rounded-lg max-h-[calc(85vh-200px)]">
             <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-48 sticky left-0 bg-gray-50 z-20 border-r">학생명</th>
                        {classTests.map(test => (
                            <th key={test.id} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase min-w-[120px] group relative">
                                <div className="flex flex-col items-center">
                                    <span>{test.name}</span>
                                    <span className="font-normal text-gray-400">({test.maxScore}점, {test.totalQuestions}문항)</span>
                                </div>
                                <div className="absolute top-0 right-0 flex opacity-0 group-hover:opacity-100 transition duration-150">
                                    <button onClick={() => handleEditTest(test)} className="p-1 text-blue-500 hover:text-blue-700 bg-gray-50 rounded-full" title="수정"><Icon name="edit" className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteTest(test.id)} className="p-1 text-red-500 hover:text-red-700 bg-gray-50 rounded-full" title="삭제"><Icon name="trash" className="w-4 h-4" /></button>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {/* 평균 행 고정 및 그림자 제거 */}
                    <tr className="bg-yellow-50 font-bold text-xs sticky top-0 z-10"> 
                        <td className="px-6 py-2 whitespace-nowrap text-left text-yellow-800 sticky left-0 bg-yellow-50 z-11 border-r">평균</td>
                        {classTests.map(test => (
                            <td key={test.id} className="px-4 py-2 whitespace-nowrap text-center text-yellow-800">
                                {classAverages[test.id]}
                            </td>
                        ))}
                    </tr>
                    {classStudents.map(student => (
                        <tr key={student.id} className="hover:bg-gray-50 text-xs">
                            <td className="px-6 py-2 whitespace-nowrap font-medium text-gray-900 sticky left-0 bg-white hover:bg-gray-50 z-1 border-r">
                                {student.name}
                            </td>
                            {classTests.map(test => {
                                const scoreData = grades[student.id]?.[test.id] || {};
                                const score = scoreData.score === undefined ? '' : scoreData.score;
                                const correctCount = scoreData.correctCount === undefined ? '' : scoreData.correctCount;
                                
                                return (
                                    <td key={test.id} className="px-2 py-1 whitespace-nowrap text-center">
                                        <div className="flex flex-col items-center">
                                            {/* 맞은 문항 입력 필드 */}
                                            <input
                                                type="text" 
                                                value={correctCount}
                                                onChange={(e) => handleCorrectCountChange(student.id, test.id, e.target.value)}
                                                className="w-16 p-1 border rounded text-center focus:ring-blue-500 focus:border-blue-500 font-bold"
                                                placeholder="-"
                                                maxLength="3"
                                            />
                                            {/* 점수 표시 (자동 계산) */}
                                            <span className="text-gray-500 mt-0.5">({score === '' ? '-' : score}점)</span>
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
    
    // --- 개별 성적 입력 (Individual Grade Input) ---
    const IndividualGradeInput = ({ test }) => {
         const studentsWithGrade = classStudents.map(student => ({
            student,
            grade: grades[student.id]?.[test.id] || { score: '', correctCount: '' }
         }));
         
         return (
             <div className="space-y-4 max-h-[calc(85vh-150px)] overflow-y-auto pr-2">
                 <div className="p-3 bg-gray-100 rounded-lg text-sm">
                     <p className="font-bold">{test.name}</p>
                     <p className="text-xs text-gray-700">만점: {test.maxScore}점 / 총 문항 수: {test.totalQuestions}개 / 문항당 배점: {test.questionScore}점</p>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4 text-sm">
                     {studentsWithGrade.map(({ student, grade }) => (
                         <div key={student.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                             <span className="font-semibold w-24">{student.name}</span>
                             <div className="flex items-center space-x-2">
                                 <input
                                    type="text" 
                                    min="0"
                                    max={test.totalQuestions}
                                    value={grade.correctCount}
                                    onChange={(e) => handleCorrectCountChange(student.id, test.id, e.target.value)}
                                    className="w-16 p-1 border rounded text-center font-bold"
                                    placeholder="0"
                                />
                                 <span className="text-gray-600">/ {test.totalQuestions} 문항</span>
                                 <span className="font-bold text-blue-600">({grade.score === '' ? '-' : grade.score}점)</span>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
         );
    }
    
    // 테스트 목록을 커스텀 패널로 정의
    const TestListPanel = () => (
        <div className="space-y-2 flex-1 overflow-y-auto pr-2 text-sm">
            {classTests.length === 0 ? (
                <p className="text-gray-500 text-sm">등록된 테스트가 없습니다.</p>
            ) : (
                classTests.map(test => (
                    <div
                        key={test.id}
                        onClick={() => handleTestNavigate(test)} 
                        className={`p-2 border rounded-lg cursor-pointer transition duration-150 
                            ${selectedTest?.id === test.id 
                                ? 'bg-blue-500 text-white font-semibold shadow-md' 
                                : 'bg-white hover:bg-gray-100'}`
                        }
                    >
                        <p className="font-bold">{test.name}</p>
                        <p className={`text-xs ${selectedTest?.id === test.id ? 'text-blue-200' : 'text-gray-500'}`}>
                            {test.maxScore}점 ({test.totalQuestions}문항)
                        </p>
                    </div>
                ))
            )}
        </div>
    );

    return (
        <div className="flex h-full min-h-[85vh] space-x-6">
            
            {/* 1. 좌측 클래스 선택 패널 + 테스트 목록 */}
            <ClassSelectionPanel
                classes={classes}
                selectedClassId={selectedClassId}
                setSelectedClassId={setSelectedClassId}
                handleClassSave={handleSaveClass}
                calculateClassSessions={calculateClassSessions}
                showSessions={false} 
                customPanelContent={<TestListPanel />}
                customPanelTitle='등록된 테스트'
            />
            
            {/* 2. 우측 메인 구역 (Flex-1) */}
            <div className="flex-1 bg-white p-6 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <h3 className="text-xl font-bold text-gray-800">
                        {selectedTest ? `${selectedTest.name} 성적 입력` : `${selectedClass?.name || '클래스'} 전체 성적표`}
                    </h3>
                    <button 
                        onClick={() => { setEditingTest(null); setIsTestModalOpen(true); }} 
                        className="flex items-center bg-green-500 text-white text-sm font-bold py-2 px-4 rounded-lg hover:bg-green-600 transition duration-200 shadow-md"
                    >
                        <Icon name="plus" className="w-4 h-4 mr-2" /> 테스트 생성
                    </button>
                </div>
                
                {selectedClassId === null || classStudents.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-gray-500 text-base">
                        {selectedClassId === null ? '클래스를 선택해 주세요.' : `${selectedClass.name}에 등록된 재원생이 없습니다.`}
                    </div>
                ) : (
                    selectedTest ? (
                        <IndividualGradeInput test={selectedTest} />
                    ) : (
                        <FullGradeTable />
                    )
                )}
            </div>

            <TestFormModal
                isOpen={isTestModalOpen}
                onClose={handleCloseTestModal}
                onSave={handleSaveTest}
                classId={selectedClassId}
                test={editingTest}
                classes={classes}
                calculateClassSessions={calculateClassSessions}
            />
        </div>
    );
};


// --- PaymentManagement 컴포넌트 (유지) ---
const PaymentManagement = () => { 
    const [payments] = useState(initialPayments);
    return (
         <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold mb-6">수납 관리</h3>
            <div className="overflow-x-auto text-sm"> 
                <table className="w-full text-left">
                    <thead className="bg-gray-50">
                        <tr>{['학생명', '교재 목록', '총액', '납부 상태', '수령 여부'].map(h => <th key={h} className="p-3 font-semibold text-gray-600">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                        {payments.map(p => (
                            <tr key={p.studentId} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-medium">{p.studentName}</td>
                                <td className="p-3">{p.books.map(b => `${b.name} (${b.price.toLocaleString()}원)`).join(', ')}</td>
                                <td className="p-3 font-bold">{p.total.toLocaleString()}원</td>
                                <td className={`p-3 font-semibold ${p.books.every(b => b.status === '완납') ? 'text-green-600' : 'text-red-500'}`}>{p.books.every(b => b.status === '완납') ? '완납' : '미납'}</td>
                                <td className="p-3">{p.received ? '수령' : '미수령'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
         </div>
    )
};

// --- BookManagement 컴포넌트 (유지) ---
const BookManagement = ({ students, handleSaveStudent, classes }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [editingStudent, setEditingStudent] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // 이 페이지에서는 학생을 추가/수정할 때 books 필드만 수정하는 별도의 모달이 필요하지만,
    // 재사용성을 위해 StudentFormModal을 기반으로 교재 필드만 노출하는 임시 모달 생성 (App.js 외부라 코드는 StudentFormModal을 대신함)
    // 실제로는 별도의 BookEditModal이 필요하나, 현재는 학생 관리에서 가져온 StudentFormModal을 재사용하며 학생의 전체 정보를 업데이트함.
    
    // StudentFormModal이 교재 정보를 관리하지 않게 되었으므로,
    // 이 페이지에서는 인라인 편집 또는 별도의 모달이 필요합니다. 
    // 임시로 학생 추가 모달을 **BookManagement용으로 수정하지 않고,** 학생 목록만 보여주도록 유지합니다.
    
    // **개선된 StudentFormModal을 사용하지 않으므로, 아래 로직은 교재 정보 수정 기능이 없는 상태입니다.** 
    // 실제로는 이 곳에서 교재만 수정할 수 있는 간소화된 모달을 사용해야 합니다.
    
    const filteredStudents = students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              s.school.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              s.books.some(book => book.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesSearch;
    });
    
    // **NOTE: StudentManagement에서 사용하던 StudentFormModal은 교재 관리가 불가능하므로, 
    // 여기서는 교재 정보 수정을 위해 임시로 기존 학생 정보를 메모리에 복사하여 보여주는 식으로 구현합니다.**
    
    const handleEdit = (student) => {
        // 실제로는 교재만 수정할 수 있는 별도의 BookEditModal이 필요함.
        // 여기서는 임시로 학생 전체 수정 모달을 사용하며, 교재 필드는 StudentFormModal에서 제거되었음을 전제합니다.
        // (즉, 여기서 편집 버튼을 눌러도 교재는 수정 불가능. 별도의 BookEditModal 구현 필요.)
        setEditingStudent(student);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingStudent(null);
        setIsModalOpen(false);
    };
    
    // --- BookEditModal 대체 임시 컴포넌트 ---
    const TempBookEditModal = ({ isOpen, onClose, student, onSave, classes }) => {
        const [books, setBooks] = useState(student?.books || []);
        const [newBook, setNewBook] = useState('');
        
        useEffect(() => {
            setBooks(student?.books || []);
        }, [student]);

        const handleAddBook = () => {
             if (newBook.trim()) {
                setBooks(prev => [...prev, newBook.trim()]);
                setNewBook('');
            }
        };
        
        const handleRemoveBook = (bookToRemove) => {
            setBooks(prev => prev.filter(book => book !== bookToRemove));
        };
        
        const handleSave = () => {
            // books 필드만 업데이트하여 App.js의 handleSaveStudent 호출
            onSave({ ...student, books: books }, student.id);
            onClose();
        };

        return (
            <Modal isOpen={isOpen} onClose={onClose} title={`${student?.name} 학생 교재 관리`} maxWidth='max-w-md'>
                 <div className="space-y-4">
                     <div className="border p-3 rounded-lg bg-gray-50">
                        <label className="block font-semibold mb-2 text-sm">보유 교재 목록:</label>
                        <div className='flex mb-2'>
                            <input 
                                type="text" 
                                value={newBook}
                                onChange={(e) => setNewBook(e.target.value)}
                                placeholder="새 교재명 입력"
                                className="p-2 border rounded-l w-full text-sm"
                            />
                            <button type="button" onClick={handleAddBook} className="bg-gray-300 p-2 rounded-r hover:bg-gray-400 font-bold text-xs">추가</button>
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                            {books.length === 0 ? (
                                <p className="text-xs text-gray-500">등록된 교재가 없습니다.</p>
                            ) : (
                                books.map((book, index) => (
                                    <div key={index} className="flex justify-between items-center bg-white p-2 rounded border text-xs">
                                        <span className='truncate'>{book}</span>
                                        <button type="button" onClick={() => handleRemoveBook(book)} className="text-red-500 hover:text-red-700 ml-2">
                                            <Icon name="x" className="w-3 h-3"/>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    <button onClick={handleSave} className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 mt-4">
                        교재 정보 저장
                    </button>
                 </div>
            </Modal>
        )
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg min-h-[85vh]">
            <h3 className="text-xl font-bold mb-6 border-b pb-2">교재 정보 관리</h3>
            
            <div className="mb-4 flex space-x-4">
                <div className="relative flex-1">
                    <Icon name="search" className="w-4 h-4 absolute top-3 left-3 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="학생 이름, 교재명 검색" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full p-2 pl-8 border-2 text-sm border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="overflow-x-auto border rounded-lg text-sm">
                <table className="min-w-full text-left divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-3 font-semibold text-gray-600">학생명</th>
                            <th className="p-3 font-semibold text-gray-600">학교/학년</th>
                            <th className="p-3 font-semibold text-gray-600">보유 교재 목록</th>
                            <th className="p-3 font-semibold text-gray-600">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredStudents.map(s => (
                            <tr key={s.id} className="hover:bg-gray-50">
                                <td className="p-3 font-bold">{s.name}</td>
                                <td className="p-3">{s.school} {s.grade}학년</td>
                                <td className="p-3">
                                    <div className='flex flex-wrap gap-1'>
                                        {s.books.map((book, index) => (
                                            <span key={index} className='px-2 py-0.5 bg-gray-200 text-xs rounded-full'>{book}</span>
                                        ))}
                                    </div>
                                </td>
                                <td className="p-3">
                                    <button onClick={() => handleEdit(s)} className="text-blue-500 hover:text-blue-700 p-1" title="교재 수정">
                                        <Icon name="edit" className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {/* 임시 교재 수정 모달 사용 */}
            {editingStudent && (
                <TempBookEditModal 
                    isOpen={isModalOpen} 
                    onClose={handleCloseModal} 
                    student={editingStudent} 
                    onSave={handleSaveStudent}
                    classes={classes} // 학생 정보에 강좌 정보가 필요할 수 있으므로 전달
                />
            )}
        </div>
    );
}

// --- ClinicManagement 컴포넌트 (유지) ---
const ClinicManagement = ({ students, clinicLogs, handleSaveClinicLog, handleDeleteClinicLog, classes }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState(null);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));

    const studentsMap = students.reduce((acc, s) => { acc[s.id] = s; return acc; }, {});

    const filteredLogs = clinicLogs
        .filter(log => log.date === filterDate)
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
        
    // 클리닉 신청 학생 명단 (등원 예정 시간이 있는 재원생)
    const scheduledStudents = students
        .filter(s => s.status === '재원생' && s.clinicTime)
        .sort((a, b) => a.clinicTime.localeCompare(b.clinicTime));

    const handleEdit = (log) => {
        setEditingLog(log);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingLog(null);
        setIsModalOpen(false);
    };

    const handleLogSave = (logData, isEdit) => {
        handleSaveClinicLog(logData, isEdit);
        handleCloseModal();
    };

    return (
        <div className="flex h-full min-h-[85vh] space-x-6">
            
            {/* 1. 좌측: 클리닉 신청 학생 명단 (2025-11-29 기준) */}
            <div className="w-72 bg-white p-4 rounded-xl shadow-lg flex flex-col space-y-4 flex-shrink-0">
                 <h4 className="font-bold text-base border-b pb-2">클리닉 신청 명단</h4>
                 <div className='flex items-center text-sm text-gray-600'><Icon name='calendar' className='w-4 h-4 mr-1'/> {filterDate} 기준</div>
                 
                 <div className='flex-1 overflow-y-auto pr-2 space-y-2 text-sm'>
                      {scheduledStudents.length === 0 ? (
                           <p className='text-gray-500 text-sm'>신청 학생이 없습니다.</p>
                      ) : (
                           scheduledStudents.map(s => {
                               const isInLog = filteredLogs.some(log => log.studentId === s.id);
                                return (
                                     <div key={s.id} className={`p-2 border rounded-lg ${isInLog ? 'bg-green-100' : 'bg-gray-100'}`}>
                                          <p className='font-bold'>{s.name}</p>
                                          <p className='text-xs text-gray-600'>예정: {s.clinicTime} | 상태: {isInLog ? '기록 완료' : '대기'}</p>
                                     </div>
                                );
                           })
                      )}
                 </div>
            </div>

            {/* 2. 우측: 클리닉 기록 입력/조회 */}
            <div className="flex-1 bg-white p-6 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h3 className="text-xl font-bold">클리닉 기록 입력 ({filterDate})</h3>
                    <div className='flex space-x-3 items-center'>
                        <input 
                            type='date' 
                            value={filterDate} 
                            onChange={e => setFilterDate(e.target.value)} 
                            className='p-2 border rounded-lg text-sm'
                        />
                        <button 
                            onClick={() => { setEditingLog(null); setIsModalOpen(true); }} 
                            className="flex items-center bg-blue-500 text-white text-sm font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition duration-200"
                        >
                            <Icon name="plus" className="w-4 h-4 mr-2" /> 기록 추가
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto border rounded-lg text-sm">
                    <table className="min-w-full text-left divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {['학생명', '등원 시간', '하원 시간', '담당 조교', '코멘트', '관리'].map(h => <th key={h} className="p-3 font-semibold text-gray-600">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredLogs.length === 0 ? (
                                <tr><td colSpan="6" className="p-4 text-center text-gray-500">{filterDate}에 등록된 클리닉 기록이 없습니다.</td></tr>
                            ) : (
                                filteredLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-gray-50">
                                        <td className="p-3 font-bold">{log.studentName}</td>
                                        <td className="p-3">{log.checkIn}</td>
                                        <td className="p-3">{log.checkOut}</td>
                                        <td className="p-3">{log.tutor}</td>
                                        <td className="p-3 max-w-xs truncate">{log.comment}</td>
                                        <td className="p-3 flex space-x-2">
                                            <button onClick={() => handleEdit(log)} className="text-blue-500 hover:text-blue-700 p-1" title="수정"><Icon name="edit" className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteClinicLog(log.id)} className="text-red-500 hover:text-red-700 p-1" title="삭제"><Icon name="trash" className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                
                <ClinicLogModal 
                    isOpen={isModalOpen} 
                    onClose={handleCloseModal} 
                    onSave={handleLogSave}
                    logToEdit={editingLog}
                    students={students}
                    defaultDate={filterDate}
                    classes={classes} // 🚨 강좌 정보 전달
                />
            </div>
        </div>
    );
};


// --- InternalCommunication 컴포넌트 (유지) ---
const InternalCommunication = ({ announcements, handleSaveAnnouncement, setAnnouncements, students, classes, workLogs, handleSaveWorkLog, handleDeleteWorkLog }) => { 
    const [tab, setTab] = useState('announcement'); 
    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex border-b mb-4">
                <button onClick={() => setTab('announcement')} className={`py-2 px-4 font-semibold text-sm ${tab === 'announcement' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>공지사항</button>
                <button onClick={() => setTab('logs')} className={`py-2 px-4 font-semibold text-sm ${tab === 'logs' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>근무 일지</button>
                <button onClick={() => setTab('messenger')} className={`py-2 px-4 font-semibold text-sm ${tab === 'messenger' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>메신저</button>
            </div>
            {tab === 'announcement' ? <Announcement 
                                            announcements={announcements} 
                                            handleSaveAnnouncement={handleSaveAnnouncement} 
                                            setAnnouncements={setAnnouncements}
                                            allClasses={classes}
                                            allStudents={students} 
                                        /> : 
             (tab === 'logs' ? <WorkLogs logs={workLogs} handleSaveLog={handleSaveWorkLog} handleDeleteLog={handleDeleteWorkLog} /> : <Messenger />)}
        </div>
    )
};

// --- Announcement 컴포넌트 (유지) ---
const Announcement = ({ announcements, handleSaveAnnouncement, setAnnouncements, allClasses, allStudents }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState(null);

    const [allAnnouncements, setAllAnnouncements] = useState(announcements);

    useEffect(() => {
        // 예약 시간이 지난 공지사항만 표시 (모의)
        const now = new Date();
        const filtered = announcements.filter(ann => !ann.scheduleTime || new Date(ann.scheduleTime) <= now);
        
        // 고정된 글을 맨 위로 정렬
        filtered.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.date) - new Date(a.date); // 최신순
        });
        
        setAllAnnouncements(filtered);
    }, [announcements]);
    
    const handleTogglePin = (id) => {
        // App.js의 setAnnouncements를 호출하여 전역 상태 업데이트
        setAnnouncements(prev => {
            const updated = prev.map(ann => 
                ann.id === id ? { ...ann, isPinned: !ann.isPinned } : ann
            );
            return updated;
        });
    }
    
    const handleEdit = (announcement) => {
        setEditingAnnouncement(announcement);
        setIsModalOpen(true);
    }
    
    const getClassNames = (ids) => ids.map(id => allClasses.find(c => c.id === id)?.name || '').join(', ');
    const getStudentNames = (ids) => ids.map(id => allStudents.find(s => s.id === id)?.name || '').join(', ');
    
    return (
        <div className='space-y-4'>
            <div className='flex justify-end'>
                <button 
                    onClick={() => { setEditingAnnouncement(null); setIsModalOpen(true); }}
                    className="flex items-center bg-blue-500 text-white text-sm font-bold py-2 px-4 rounded-lg hover:bg-blue-600"
                >
                    <Icon name="plus" className="w-4 h-4 mr-2" /> 새 공지 작성
                </button>
            </div>
            
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {allAnnouncements.length === 0 ? (
                    <p className="text-gray-500 text-sm p-4 border rounded-lg text-center">등록된 공지사항이 없습니다.</p>
                ) : (
                    allAnnouncements.map(ann => (
                        <div 
                            key={ann.id} 
                            className={`p-4 border rounded-lg shadow-sm transition duration-150 ${ann.isPinned ? 'bg-yellow-50 border-yellow-400' : 'bg-gray-50 hover:shadow-md'}`}
                        >
                            <div className='flex justify-between items-start'>
                                <h4 className="font-bold text-base text-gray-800 flex items-center">
                                    {ann.isPinned && <Icon name="pin" className="w-4 h-4 mr-2 text-red-500" title="고정된 공지"/>}
                                    {ann.title}
                                </h4>
                                <div className='flex items-center space-x-2'>
                                    <button onClick={() => handleEdit(ann)} className='p-1 rounded-full text-gray-500 hover:text-blue-500 hover:bg-gray-200' title="수정">
                                        <Icon name="edit" className="w-4 h-4"/>
                                    </button>
                                    <button onClick={() => handleTogglePin(ann.id)} className={`p-1 rounded-full ${ann.isPinned ? 'text-red-500 bg-red-100 hover:bg-red-200' : 'text-gray-500 hover:bg-gray-200'}`} title={ann.isPinned ? '고정 해제' : '최상위 고정'}>
                                        <Icon name="pin" className="w-4 h-4"/>
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                작성자: {ann.author} | 게시일: {new Date(ann.scheduleTime).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                                {new Date(ann.scheduleTime) > new Date() && <span className='ml-2 text-blue-600 font-bold'>(예약됨)</span>}
                            </p>
                            
                             <p className="text-xs text-gray-600 mt-2">
                                <span className='font-semibold'>대상: </span>
                                {ann.targetClasses?.length > 0 ? `[클래스] ${getClassNames(ann.targetClasses)}` : '[전체 공지]'}
                                {ann.targetStudents?.length > 0 && ` / [학생] ${getStudentNames(ann.targetStudents)}`}
                            </p>
                            
                            {/* dangerouslySetInnerHTML로 HTML 렌더링 (모의 에디터) */}
                            <div 
                                className="mt-3 text-sm border-t pt-2"
                                dangerouslySetInnerHTML={{ __html: ann.content }} 
                            />
                            
                            {/* 첨부 파일 목록 */}
                            {ann.attachments?.length > 0 && (
                                <div className='mt-2 text-xs text-gray-600'>
                                    <span className='font-semibold'>첨부 파일:</span> {ann.attachments.join(', ')}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
            
            <AnnouncementModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)} 
                onSave={handleSaveAnnouncement}
                announcementToEdit={editingAnnouncement}
                allClasses={allClasses}
                allStudents={allStudents}
            />
        </div>
    )
}

// --- WorkLogs 컴포넌트 (유지) ---
const WorkLogs = ({ logs, handleSaveLog, handleDeleteLog }) => { 
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState(null);
    const [newLogContent, setNewLogContent] = useState('');

    const handleOpenEdit = (log) => {
        setEditingLog(log);
        setNewLogContent(log.content);
        setIsModalOpen(true);
    }
    
    const handleAddOrUpdateLog = () => {
        if (newLogContent.trim() === '') return;
        
        if (editingLog) {
            handleSaveLog({ ...editingLog, content: newLogContent }, true);
        } else {
            handleSaveLog({ content: newLogContent }, false);
        }
        setEditingLog(null);
        setNewLogContent('');
        setIsModalOpen(false);
    }

    return (
         <div className="text-sm space-y-4">
             <div className='flex justify-between items-center'>
                <h4 className="font-bold text-base">전체 근무 일지</h4>
                 <button onClick={() => { setEditingLog(null); setNewLogContent(''); setIsModalOpen(true); }} className="flex items-center bg-blue-500 text-white text-sm font-bold py-2 px-4 rounded-lg hover:bg-blue-600">
                    <Icon name="plus" className="w-4 h-4 mr-2" /> 새 일지 작성
                </button>
             </div>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {logs.map(log => (
                    <div key={log.id} className="p-4 border-l-4 border-gray-300 bg-gray-50 rounded">
                        <div className='flex justify-between items-start'>
                             <p className='whitespace-pre-wrap'>{log.content}</p>
                             <div className='flex space-x-1 ml-4'>
                                 <button onClick={() => handleOpenEdit(log)} className="text-gray-500 hover:text-blue-500 p-1" title="수정"><Icon name="edit" className="w-4 h-4" /></button>
                                 <button onClick={() => handleDeleteLog(log.id)} className="text-gray-500 hover:text-red-500 p-1" title="삭제"><Icon name="trash" className="w-4 h-4" /></button>
                             </div>
                        </div>
                        <p className="text-right text-xs text-gray-500 mt-2">- {log.author}, {log.date}</p>
                    </div>
                ))}
            </div>

             <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingLog ? '근무 일지 수정' : '새 근무 일지 작성'} maxWidth='max-w-md'>
                <textarea 
                    value={newLogContent} 
                    onChange={(e) => setNewLogContent(e.target.value)} 
                    rows="6" 
                    placeholder="업무 인수인계 및 공지사항을 입력하세요..." 
                    className="w-full p-2 border rounded-lg text-sm"
                ></textarea>
                <button onClick={handleAddOrUpdateLog} className="w-full bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-700 mt-4">
                    {editingLog ? '일지 수정 완료' : '일지 작성'}
                </button>
             </Modal>
        </div>
    )
}

// --- Messenger 컴포넌트 (유지) ---
const Messenger = () => {
    return (
        <div className="flex h-[60vh] text-sm">
            <div className="w-1/3 border-r pr-4">
                <h4 className="font-bold mb-2">대화 상대</h4>
                <ul>
                    {initialStudents.map(s => <li key={s.id} className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer">{s.name} ({s.status})</li>)}
                </ul>
            </div>
            <div className="w-2/3 pl-4 flex flex-col">
                <div className="flex-1 border rounded-lg p-4 mb-2 bg-gray-50">
                    <p className="text-gray-500">김민준 학생과의 대화 내용이 여기에 표시됩니다.</p>
                </div>
                <div className="flex">
                    <input type="text" placeholder="메시지 입력..." className="flex-1 p-2 border rounded-l-lg" />
                    <button className="bg-blue-500 text-white px-4 rounded-r-lg">전송</button>
                </div>
            </div>
        </div>
    )
};


// --- StudentDetail Helper Functions ---
const calculateGradeComparison = (studentId, classes, tests, grades) => {
    const comparison = [];

    classes.forEach(cls => {
        if (!cls.students.includes(studentId)) return; 

        const classTests = tests.filter(t => t.classId === cls.id);
        if (classTests.length === 0) return;

        classTests.forEach(test => {
            const studentScore = grades[studentId]?.[test.id]?.score;
            if (studentScore === undefined) return;

            // 클래스 평균 계산
            let totalClassScore = 0;
            let classStudentCount = 0;
            cls.students.forEach(sId => {
                const score = grades[sId]?.[test.id]?.score;
                if (score !== undefined) {
                    totalClassScore += Number(score);
                    classStudentCount++;
                }
            });
            const classAverage = classStudentCount > 0 ? (totalClassScore / classStudentCount).toFixed(1) : 0;
            
            comparison.push({
                className: cls.name,
                testName: test.name,
                maxScore: test.maxScore,
                studentScore: Number(studentScore),
                classAverage: Number(classAverage),
                isAboveAverage: Number(studentScore) > Number(classAverage),
                scoreDifference: (Number(studentScore) - Number(classAverage)).toFixed(1)
            });
        });
    });

    return comparison;
};

const calculateHomeworkStats = (studentId, homeworkAssignments, homeworkResults) => {
    const studentAssignments = homeworkAssignments.filter(a => a.students.includes(studentId));
    
    return studentAssignments.map(a => {
        const results = homeworkResults[studentId]?.[a.id] || {};
        const totalQuestions = a.totalQuestions;
        
        let completedCount = 0; 
        let incorrectCount = 0; 
        let uncheckedCount = totalQuestions;
        
        if (Object.keys(results).length > 0) {
            uncheckedCount = 0; 
            Object.values(results).forEach(status => {
                if (status === '맞음' || status === '고침') {
                    completedCount++;
                }
                if (status === '틀림') {
                    incorrectCount++;
                }
            });
            uncheckedCount = totalQuestions - completedCount - incorrectCount;
            if (uncheckedCount < 0) uncheckedCount = 0;
        }


        const completionRate = Math.round(((completedCount + incorrectCount) / totalQuestions) * 100);

        return {
            id: a.id,
            date: a.date,
            content: a.content,
            book: a.book,
            totalQuestions,
            completedCount,
            incorrectCount,
            uncheckedCount,
            completionRate,
            status: completionRate === 100 ? '완료' : (completionRate > 0 ? '진행 중' : '미시작')
        };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
};


// --- StudentDetail Component ---
const StudentDetail = ({ studentId, students, classes, studentMemos, grades, tests, homeworkAssignments, homeworkResults, handlePageChange }) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return <div className="p-6 text-red-500">학생 정보를 찾을 수 없습니다.</div>;

    const studentMemo = studentMemos[studentId] || '등록된 메모가 없습니다.';
    const classInfo = student.classes.map(id => classes.find(c => c.id === id));
    
    const gradeComparison = calculateGradeComparison(studentId, classes, tests, grades);
    const homeworkStats = calculateHomeworkStats(studentId, homeworkAssignments, homeworkResults);

    const getStatusColor = (status) => {
        switch (status) {
            case '재원생': return 'bg-green-100 text-green-700';
            case '상담생': return 'bg-yellow-100 text-yellow-700';
            case '퇴원생': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-500';
        }
    };
    
    // 종합 통계 계산
    const totalAssignments = homeworkStats.length;
    const completedAssignments = homeworkStats.filter(s => s.completionRate === 100).length;
    
    // 평균 과제 완성율
    const avgCompletionRate = totalAssignments > 0 
        ? (homeworkStats.reduce((sum, s) => sum + s.completionRate, 0) / totalAssignments).toFixed(0)
        : 0;

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="text-2xl font-bold flex items-center">
                    <Icon name="graduationCap" className="w-6 h-6 mr-3 text-blue-600"/>
                    {student.name} 학생 대시보드
                </h3>
                {/* 목록으로 돌아가기 버튼 */}
                <button 
                    onClick={() => handlePageChange('students', null)} 
                    className="flex items-center text-sm font-bold py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 transition duration-200"
                >
                    <Icon name="x" className="w-4 h-4 mr-2" /> 목록으로 돌아가기
                </button>
            </div>

            {/* 1. 학생 기본 정보 및 요약 */}
            <div className="grid grid-cols-3 gap-6 mb-8 text-sm">
                {/* 정보 요약 카드 */}
                <div className="col-span-1 space-y-3 p-4 border rounded-lg bg-gray-50">
                    <p className="font-bold text-lg text-blue-600">{student.name}</p>
                    <p>상태: <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(student.status)}`}>{student.status}</span></p>
                    <p>학교: {student.school} {student.grade}학년</p>
                    <p>연락처: {student.phone} / {student.parentPhone} (학부모)</p>
                    <p>등록일: {student.registeredDate}</p>
                </div>
                
                {/* 수강 강좌 카드 */}
                <div className="col-span-2 p-4 border rounded-lg bg-white shadow-sm">
                    <h4 className="font-bold mb-2 border-b pb-1 text-gray-700">수강 강좌 정보</h4>
                    <div className='space-y-1 text-xs'>
                        {classInfo.map(cls => cls ? (
                            <p key={cls.id} className='p-1 bg-gray-100 rounded'>
                                <span className='font-semibold'>{cls.name}</span> ({cls.teacher} 선생님) | 
                                시간: {cls.schedule.days.join(', ')} {cls.schedule.time}
                            </p>
                        ) : null)}
                    </div>
                    
                    <h4 className="font-bold mt-4 mb-2 border-b pb-1 text-gray-700">보유 교재</h4>
                    <div className='flex flex-wrap gap-1'>
                        {student.books.length > 0 ? student.books.map((book, index) => (
                            <span key={index} className='px-2 py-0.5 bg-blue-100 text-xs text-blue-800 rounded-full font-medium'>{book}</span>
                        )) : <span className='text-gray-500 text-xs'>등록된 교재가 없습니다.</span>}
                    </div>
                </div>
            </div>

            {/* 2. 교사 메모 */}
            <div className="mb-8 p-4 border rounded-lg shadow-md bg-white">
                <h4 className="font-bold mb-2 text-lg text-gray-800 flex items-center"><Icon name="fileText" className="w-5 h-5 mr-2"/> 교사 메모</h4>
                <div className="p-3 bg-gray-50 border rounded-lg whitespace-pre-wrap text-sm text-gray-700">
                    {studentMemo}
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
                 {/* 3. 성적 현황 (클래스 평균 대비) */}
                <div className="p-4 border rounded-lg shadow-md bg-white">
                    <h4 className="font-bold mb-4 text-lg text-gray-800 flex items-center"><Icon name="barChart" className="w-5 h-5 mr-2"/> 최근 성적 현황</h4>
                    
                    <div className="space-y-3 text-sm max-h-80 overflow-y-auto">
                        {gradeComparison.length === 0 ? (
                            <p className="text-gray-500">등록된 테스트 결과가 없습니다.</p>
                        ) : (
                            gradeComparison.map((g, index) => (
                                <div key={index} className="p-3 border rounded-lg shadow-sm">
                                    <p className="font-bold text-gray-800">[{g.className}] {g.testName} ({g.maxScore}점 만점)</p>
                                    <div className='flex justify-between items-center mt-1 text-xs'>
                                        <span className={`font-bold ${g.isAboveAverage ? 'text-green-600' : 'text-red-500'}`}>
                                            학생 점수: {g.studentScore}점
                                        </span>
                                        <span className='text-gray-600'>반 평균: {g.classAverage}점</span>
                                        <span className={`font-bold ${g.isAboveAverage ? 'text-green-500' : 'text-red-500'}`}>
                                            ({g.scoreDifference}점 차)
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                        {/* 학생 점수 바 (만점 대비) */}
                                        <div 
                                            className={`h-2 rounded-full ${g.studentScore >= g.maxScore * 0.9 ? 'bg-blue-600' : g.studentScore >= g.maxScore * 0.7 ? 'bg-blue-400' : 'bg-red-400'}`}
                                            style={{ width: `${(g.studentScore / g.maxScore) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 4. 과제 완성도 현황 */}
                 <div className="p-4 border rounded-lg shadow-md bg-white">
                    <h4 className="font-bold mb-4 text-lg text-gray-800 flex items-center"><Icon name="clipboardCheck" className="w-5 h-5 mr-2"/> 과제 완성도</h4>
                    <p className={`mb-3 text-sm font-bold ${avgCompletionRate > 80 ? 'text-green-600' : 'text-red-500'}`}>
                        총 과제 {totalAssignments}개 중 완료 {completedAssignments}개 | 평균 완성율: {avgCompletionRate}%
                    </p>

                    <div className="space-y-3 text-xs max-h-80 overflow-y-auto">
                         {homeworkStats.length === 0 ? (
                            <p className="text-gray-500">할당된 과제가 없습니다.</p>
                        ) : (
                            homeworkStats.map(h => (
                                <div key={h.id} className="p-3 border rounded-lg bg-gray-50">
                                    <p className='font-bold'>{h.date} | {h.book}</p>
                                    <p className='text-gray-700 mt-1 truncate'>{h.content}</p>
                                    <div className='flex justify-between items-center mt-1'>
                                        <span className={`font-bold ${h.completionRate === 100 ? 'text-green-600' : 'text-blue-500'}`}>{h.completionRate}%</span>
                                        <span className='text-gray-600'>맞음/고침: {h.completedCount}, 틀림: {h.incorrectCount}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                         {/* 완성율 바 */}
                                        <div 
                                            className={`h-2 rounded-full ${h.completionRate === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                            style={{ width: `${h.completionRate}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};