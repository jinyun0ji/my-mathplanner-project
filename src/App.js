import React, { useState, useEffect, useCallback, useRef } from 'react';

// --- 데이터 샘플 ---
// 2025년 11월 달력 확인: 11/1(금), 11/3(월), 11/4(화), 11/5(수), 11/6(목), 11/7(금), 11/10(월), 11/11(화)...
const initialStudents = [
  // books: 학생별 보유 교재 목록 추가 
  { id: 1, name: '김민준', school: '대한고등학교', grade: 2, phone: '010-1234-5678', parentPhone: '010-8765-4321', status: '재원생', registeredDate: '2025-03-05', classes: [1], paymentStatus: '완납', bookReceived: true, books: ['수학(상) RPM', '블랙라벨 수학(상)'] },
  { id: 2, name: '이서연', school: '민국고등학교', grade: 2, phone: '010-2345-6789', parentPhone: '010-7654-3210', status: '재원생', registeredDate: '2025-03-05', classes: [2], paymentStatus: '미납', bookReceived: false, books: ['개념원리 수학I'] },
  { id: 3, name: '박하준', school: '사랑고등학교', grade: 2, phone: '010-3456-7890', parentPhone: '010-6543-2109', status: '상담생', registeredDate: '2025-02-15', classes: [], paymentStatus: '해당없음', bookReceived: false, books: [] },
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
    // 정규 수업일 (월: 11/3, 11/10, 11/17... / 금: 11/1, 11/7, 11/14...) 에 맞게 재조정
    { id: 1, classId: 1, date: '2025-11-03', progress: '다항식의 연산 P.12 ~ P.18', iframeCode: '<iframe width="560" height="315" src="https://www.youtube.com/embed/mWkuigsWe4A" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>', materialUrl: '수업자료_1103.pdf' }, 
    { id: 2, classId: 2, date: '2025-11-04', progress: '집합의 개념 및 포함 관계', iframeCode: '', materialUrl: '수업자료_1104.pdf' }, // A2반 화요일 수업일 (11/4 화요일 맞음)
    { id: 3, classId: 1, date: '2025-11-07', progress: '나머지 정리', iframeCode: '', materialUrl: '' }, // A1반 금요일 수업일 (11/7 금요일 맞음)
    { id: 4, classId: 1, date: '2025-11-10', progress: '인수분해', iframeCode: '', materialUrl: '' }, // A1반 월요일 수업일 (11/10 월요일 맞음)
    { id: 5, classId: 1, date: '2025-11-14', progress: '복소수', iframeCode: '', materialUrl: '' }, // A1반 금요일 수업일 (11/14 금요일 맞음)
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
    { id: 1, classId: 1, date: '2025-11-03', content: 'RPM P.10 ~ P.15', students: [1, 4, 6], totalQuestions: 30, isAssignmentDate: true, book: '수학(상) RPM' },
    { id: 2, classId: 2, date: '2025-11-04', content: '개념원리 P.20 ~ P.25', students: [2], totalQuestions: 20, isAssignmentDate: true, book: '개념원리 수학I' },
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
    2: { 2: { "1": "맞음", "2": "틀림", "3": "맞음", "4": "고침", "5": "맞음" } }, 
};


const initialPayments = [
    { studentId: 1, studentName: '김민준', books: [{name: '수학(상) RPM', price: 15000, status: '완납'}, {name: '블랙라벨 수학(상)', price: 17000, status: '완납'}], total: 32000, received: true },
    { studentId: 2, studentName: '이서연', books: [{name: '개념원리 수학I', price: 18000, status: '미납'}], total: 18000, received: false },
];

const initialWorkLogs = [
    {id: 1, author: '김선생', date: '2025-06-27', content: '박하준 학생 상담 완료. 7월부터 수강 희망.'},
    {id: 2, author: '이선생', date: '2025-06-26', content: '중2 심화 A반 교재 재고 확인 필요. 3부 부족.'},
];

const initialAnnouncements = [
    // isPinned, scheduleTime, attachments 추가
    {id: 1, author: '채수용', date: '2025-11-28', title: '12월 정규 수업 시간표 안내', content: '12월 1일부터 적용되는 정규 수업 시간표를 확인해주세요.<br><br><b>[첨부 파일]</b> 시간표_최종.pdf', isPinned: true, scheduleTime: '2025-11-28T09:00', attachments: ['시간표_최종.pdf']},
    {id: 2, author: '관리자', date: '2025-11-25', title: '학부모 간담회 안내', content: '학부모님들의 많은 참석 부탁드립니다.', isPinned: false, scheduleTime: '2025-11-25T14:00', attachments: []},
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


// --- 아이콘 컴포넌트 (유지) ---
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
  };
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{icons[name]}</svg>;
};

// --- 유틸리티 함수 ---

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

// 모달 백드롭 
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

// 메모 수정 모달 (유지)
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

// 클래스 추가/수정 모달 (유지)
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


// 수업 일지 등록/수정 모달 (요청 1: 날짜 유효성 검사, 요청 2: materialUrl -> File Upload)
const LessonLogFormModal = ({ isOpen, onClose, onSave, classId, log = null, classes, calculateClassSessions, defaultDate = null }) => {
    const isEdit = !!log;
    const selectedClass = classes.find(c => c.id === classId);
    const sessions = selectedClass ? calculateClassSessions(selectedClass) : [];

    const [formData, setFormData] = useState({
        date: log?.date || defaultDate || new Date().toISOString().slice(0, 10),
        progress: log?.progress || '',
        iframeCode: log?.iframeCode || '', 
        materialFileName: log?.materialUrl || '', // 필드명 변경: materialUrl -> materialFileName
    });
    
    // defaultDate가 변경될 때마다 폼 상태 업데이트
    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            date: log?.date || defaultDate || new Date().toISOString().slice(0, 10),
            progress: log?.progress || '',
            iframeCode: log?.iframeCode || '', 
            materialFileName: log?.materialUrl || '',
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
            materialUrl: formData.materialFileName, // 저장 시 materialUrl (파일 이름)
        };

        onSave(dataToSave, isEdit);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `${formData.date} 수업 일지 수정` : '새 수업 일지 등록'}>
            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                <input type="date" name="date" value={formData.date} onChange={handleChange} required className="p-2 border rounded w-full" />
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
                    {isEdit ? '일지 수정' : '일지 등록'}
                </button>
            </form>
        </Modal>
    );
};

// 학생 추가/수정 모달 (요청 3: books 필드 추가 및 관리)
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
        books: student?.books || [], // 요청 3: 교재 목록 추가
        newBook: '', // 임시 입력 필드
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
            books: student?.books || [],
            newBook: '',
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
    
    // 요청 3: 교재 추가/삭제
    const handleAddBook = (e) => {
        e.preventDefault();
        if (formData.newBook.trim()) {
            setFormData(prev => ({
                ...prev,
                books: [...prev.books, prev.newBook.trim()],
                newBook: ''
            }));
        }
    };
    
    const handleRemoveBook = (bookToRemove) => {
        setFormData(prev => ({
            ...prev,
            books: prev.books.filter(book => book !== bookToRemove)
        }));
    }

    const handleSubmit = (e) => {
        e.preventDefault();
        const dataToSave = { ...formData };
        delete dataToSave.newBook; // 임시 필드는 저장하지 않음
        onSave(dataToSave, isEdit ? student.id : null);
        onClose();
    };

    const statusOptions = ['재원생', '상담생', '퇴원생'];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `${student.name} 학생 정보 수정` : '새 학생 등록'} maxWidth='max-w-3xl'>
            <form onSubmit={handleSubmit} className="space-y-4 text-sm"> 
                <div className="grid grid-cols-2 gap-4">
                    <div className='space-y-4'>
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
                    </div>
                    
                    {/* 요청 3: 교재 관리 섹션 */}
                    <div className='space-y-4'>
                        <div className="border p-3 rounded-lg bg-gray-50">
                            <label className="block font-semibold mb-2">보유 교재 관리:</label>
                            <div className='flex mb-2'>
                                <input 
                                    type="text" 
                                    name="newBook"
                                    value={formData.newBook}
                                    onChange={handleChange}
                                    placeholder="새 교재명 입력"
                                    className="p-2 border rounded-l w-full"
                                />
                                <button type="button" onClick={handleAddBook} className="bg-gray-300 p-2 rounded-r hover:bg-gray-400 font-bold text-xs">추가</button>
                            </div>
                            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                                {formData.books.length === 0 ? (
                                    <p className="text-xs text-gray-500">등록된 교재가 없습니다.</p>
                                ) : (
                                    formData.books.map((book, index) => (
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
                    </div>
                </div>

                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700">
                    {isEdit ? '정보 수정' : '학생 등록'}
                </button>
            </form>
        </Modal>
    );
};


// 과제 등록/수정 모달 (요청 3: 교재 선택 필드 추가)
const HomeworkAssignmentModal = ({ isOpen, onClose, onSave, classId, assignment = null, students, selectedClass }) => {
    const isEdit = !!assignment;
    const initialStudentIds = isEdit ? assignment.students : (selectedClass?.students || []);
    
    const [content, setContent] = useState(assignment?.content || '');
    const [date, setDate] = useState(assignment?.date || new Date().toISOString().slice(0, 10));
    const [totalQuestions, setTotalQuestions] = useState(assignment?.totalQuestions || 20); 
    const [selectedStudents, setSelectedStudents] = useState(initialStudentIds); 
    const [selectedBook, setSelectedBook] = useState(assignment?.book || ''); // 요청 3: 교재 선택 필드

    // 클래스의 재원생 목록
    const classStudents = students.filter(s => s.status === '재원생' && selectedClass?.students.includes(s.id)) || [];
    
    // 클래스에 있는 모든 학생이 보유한 교재 목록 (중복 제거)
    const availableBooks = Array.from(new Set(
        classStudents.flatMap(s => s.books)
    )).sort();


    useEffect(() => {
        setContent(assignment?.content || '');
        setDate(assignment?.date || new Date().toISOString().slice(0, 10));
        setTotalQuestions(assignment?.totalQuestions || 20);
        setSelectedStudents(initialStudentIds);
        setSelectedBook(assignment?.book || (availableBooks.length > 0 ? availableBooks[0] : '')); // 기본값 설정
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
        if (Number(totalQuestions) <= 0) {
            alert("총 문항 수는 1 이상이어야 합니다.");
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
            totalQuestions: Number(totalQuestions),
            students: selectedStudents, 
            isAssignmentDate: true,
            book: selectedBook, // 교재 정보 저장
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
                        
                        <input 
                            type="number"
                            value={totalQuestions}
                            onChange={e => setTotalQuestions(e.target.value)}
                            placeholder="총 문항 수"
                            required
                            min="1"
                            className="p-2 border rounded w-full mt-2" 
                        />
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

// 테스트 생성/수정 모달 (요청 4: 날짜 입력, 정규 수업일 유효성 검사)
const TestFormModal = ({ isOpen, onClose, onSave, classId, test = null, classes, calculateClassSessions }) => {
    const isEdit = !!test;
    const selectedClass = classes.find(c => c.id === classId);
    const sessions = selectedClass ? calculateClassSessions(selectedClass) : [];
    
    const [name, setName] = useState(test?.name || '');
    const [date, setDate] = useState(test?.date || new Date().toISOString().slice(0, 10)); // 날짜 필드 추가
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
            date, // 날짜 저장
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

// 공지사항 모달 (요청 6)
const AnnouncementModal = ({ isOpen, onClose, onSave }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [scheduleTime, setScheduleTime] = useState(new Date().toISOString().slice(0, 16)); // YYYY-MM-DDThh:mm
    
    // 파일 첨부 핸들러
    const handleFileChange = (e) => {
        const files = Array.from(e.target.files).map(file => ({
            name: file.name,
            size: file.size,
            type: file.type
        }));
        setAttachments(prev => [...prev, ...files]);
        e.target.value = null; // 파일 초기화
    }
    
    const handleRemoveAttachment = (name) => {
        setAttachments(prev => prev.filter(att => att.name !== name));
    }
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) {
            alert('제목과 내용을 모두 입력해주세요.');
            return;
        }
        
        onSave({ 
            title, 
            content: content.replace(/\n/g, '<br>'), // HTML 줄바꿈으로 변환 (모의 에디터)
            attachments: attachments.map(a => a.name),
            scheduleTime,
        });
        setTitle('');
        setContent('');
        setAttachments([]);
        setScheduleTime(new Date().toISOString().slice(0, 16));
        onClose();
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="새 공지사항 작성" maxWidth="max-w-xl">
            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                <input 
                    type="text" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    placeholder="제목 (예: 12월 정규 수업 일정 안내)"
                    required
                    className="p-2 border rounded w-full"
                />
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
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
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            required
                            className='p-1 border rounded'
                        />
                    </div>
                    
                    {/* 첨부 파일 */}
                    <div className='space-y-2'>
                        <div className="flex items-center space-x-2">
                            <label htmlFor="announcementFile" className="cursor-pointer flex items-center bg-gray-200 p-1.5 rounded-lg hover:bg-gray-300 text-xs font-semibold">
                                <Icon name="upload" className="w-4 h-4 mr-1"/> 파일 첨부 (문서/PDF/사진)
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
                             {attachments.map((att, index) => (
                                 <div key={index} className='flex justify-between items-center text-xs text-gray-700 bg-white p-1 rounded border mb-1'>
                                     <span className='truncate'>{att.name}</span>
                                     <button type="button" onClick={() => handleRemoveAttachment(att.name)} className='text-red-500 ml-2'>
                                         <Icon name="x" className='w-3 h-3'/>
                                     </button>
                                 </div>
                             ))}
                        </div>
                    </div>
                </div>

                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center">
                    공지사항 등록 및 알림 발송
                    <Icon name="send" className="w-4 h-4 ml-2"/>
                </button>
            </form>
        </Modal>
    )
}


// --- 메인 앱 컴포넌트: 모든 상태와 CRUD 로직을 관리하는 중앙 허브 ---
export default function App() { // export default로 수정
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [page, setPage] = useState('lessons'); 

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
  const [announcements, setAnnouncements] = useState(initialAnnouncements); // 요청 6: 공지사항 상태

  
  const nextStudentId = students.reduce((max, s) => Math.max(max, s.id), 0) + 1; 

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


  // --- CRUD 함수: 학생 관리 (요청 3: books 저장 로직 반영) ---
  const getClassesNames = useCallback((classIds) => classIds.map(id => classes.find(c => c.id === id)?.name || '').join(', '), [classes]);
  
  const handleSaveStudent = (newStudentData, idToUpdate) => {
    if (idToUpdate) {
        const oldStudent = students.find(s => s.id === idToUpdate);
        
        // books 필드를 포함하여 학생 데이터 업데이트
        setStudents(prev => prev.map(s => s.id === idToUpdate ? { ...s, ...newStudentData } : s));
        
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
            bookReceived: false 
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

  // --- CRUD 함수: 과제 관리 (요청 3: book 저장 반영) ---
  const handleSaveHomeworkAssignment = (assignmentData, isEdit) => {
    if (isEdit) {
        setHomeworkAssignments(prev => prev.map(a => a.id === assignmentData.id ? { ...a, ...assignmentData } : a));
    } else {
        const newAssignment = { 
            ...assignmentData, 
            id: Date.now(), 
            students: assignmentData.students, 
            totalQuestions: assignmentData.totalQuestions || 20, 
            isAssignmentDate: true,
            book: assignmentData.book || '교재 정보 없음', // 교재 정보 저장
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
  
  // 요청 4: 과제 결과 상세 기록 (문항별 상태 맵)
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

  // --- CRUD 함수: 성적 및 테스트 관리 (요청 5: 자동 채점 로직 반영) ---
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
        // 요청 5: 최종 점수 계산
        finalScore = (Number(correctCount) * scorePerQuestion); 
        // 만점을 초과할 경우 만점으로 설정 (선택 사항)
        if (finalScore > testInfo.maxScore) {
             finalScore = testInfo.maxScore;
        }
        finalScore = finalScore.toFixed(2); // 소수점 둘째 자리까지 점수 계산
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
  
  // --- CRUD 함수: 공지사항 관리 (요청 6) ---
  const handleSaveAnnouncement = (announcementData) => {
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


  if (!isLoggedIn) return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  
  // 모든 관리 컴포넌트에 필요한 상태와 함수를 Props로 전달
  const managementProps = {
    students, classes, lessonLogs, attendanceLogs, 
    homeworkAssignments, homeworkResults, tests, grades, studentMemos, videoProgress, announcements, 
    getClassesNames,
    handleSaveStudent, handleDeleteStudent,
    handleSaveClass, 
    handleSaveLessonLog, handleDeleteLessonLog,
    handleSaveAttendance,
    handleSaveHomeworkAssignment, handleDeleteHomeworkAssignment, handleUpdateHomeworkResult,
    handleSaveTest, handleDeleteTest, handleUpdateGrade,
    handleSaveMemo, 
    handleSaveAnnouncement, 
    calculateClassSessions, 
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-base"> 
      <Sidebar page={page} setPage={setPage} onLogout={() => setIsLoggedIn(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header page={page} />
        <main id="main-content" className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
          <PageContent page={page} {...managementProps} />
        </main>
      </div>
    </div>
  );
}

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
        { id: 'payment', name: '수납 관리', icon: 'wallet', isParent: false },
        { id: 'notes', name: '오답노트 & 자료', icon: 'fileText', isParent: false },
        { id: 'internal', name: '내부 소통', icon: 'messageSquare', isParent: false },
    ];
      
    const isSubPageActive = (parentItem) => parentItem.subItems && parentItem.subItems.some(sub => sub.id === page);
    
    // Sidebar 글자 크기 조정 (text-base)
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
        home: '홈', students: '학생 관리', lessons: '수업 관리', attendance: '출석 관리', homework: '과제 관리', grades: '성적 관리', payment: '수납 관리',
        notes: '오답노트 & 자료 관리', internal: '내부 소통',
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
    switch (props.page) {
        case 'home': return <Home />;
        case 'students': return <StudentManagement {...props} />;
        case 'lessons': return <LessonManagement {...props} />; 
        case 'attendance': return <AttendanceManagement {...props} />; 
        case 'homework': return <HomeworkManagement {...props} />; 
        case 'grades': return <GradeManagement {...props} />;      
        case 'payment': return <PaymentManagement />;
        case 'notes': return <NotesManagement />;
        case 'internal': return <InternalCommunication {...props} />;
        default: return <Home />; 
      }
};

// --- 각 페이지 컴포넌트 ---
const Home = () => <div className="p-6 bg-white rounded-lg shadow-md text-sm"><h3 className="text-xl font-semibold">홈</h3><p>학원 운영의 전반적인 현황을 한눈에 볼 수 있는 주요 정보를 요약하여 제공합니다.</p></div>; 

const StudentManagement = ({ students, classes, getClassesNames, handleSaveStudent, handleDeleteStudent, attendanceLogs, studentMemos, handleSaveMemo }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('전체'); 
    
    const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
    const [memoStudent, setMemoStudent] = useState(null);

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
                            {['학생명 / 연락처', '수강 강좌', '최근 출결', '메모 / 관리'].map(h => <th key={h} className="p-3 font-semibold text-gray-600">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredStudents.map(s => {
                            const latestStatus = getLatestAttendance(s.id);

                            return (
                                <tr key={s.id} className="hover:bg-gray-50">
                                    {/* 학생명 / 연락처 */}
                                    <td className="p-3">
                                        <p className="font-bold text-gray-900">{s.name}</p>
                                        <p className="text-xs text-gray-600 mt-1">
                                            {s.phone} (학생) / {s.parentPhone} (학부모)
                                        </p>
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
                            <tr><td colSpan="4" className="p-4 text-center text-gray-500">검색 결과가 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

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
const LessonManagement = ({ students, classes, lessonLogs, handleSaveLessonLog, handleDeleteLessonLog, handleSaveClass, videoProgress, attendanceLogs, calculateClassSessions }) => {
    const initialClassId = classes.length > 0 ? classes[0].id : null;
    const [selectedClassId, setSelectedClassId] = useState(initialClassId);
    const [selectedDate, setSelectedDate] = useState(null); 
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState(null);

    const selectedClass = classes.find(c => c.id === selectedClassId);
    
    const classLogs = lessonLogs
        .filter(log => log.classId === selectedClassId)
        .filter(log => selectedDate ? log.date === selectedDate : true)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
        
    const classStudents = students.filter(s => s.status === '재원생' && selectedClass?.students.includes(s.id));
    
    // 선택된 회차의 날짜를 찾기 위한 계산 (요청 1)
    const sessions = selectedClass ? calculateClassSessions(selectedClass) : [];
    // 모달의 기본 날짜는 현재 선택된 날짜이거나, 회차가 있다면 가장 최근 회차의 날짜
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
    
    // 날짜/회차 클릭 핸들러 (요청 1, 3: 날짜 통일)
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
            <div className="flex-1 bg-white p-6 rounded-xl shadow-lg">
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
            />
            </div>
        </div>
    );
};


// --- AttendanceManagement 컴포넌트 (요청 2: 카드 오버플로우 해결) ---
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
    
    // --- 서브 컴포넌트: 전체 출결 테이블 뷰 (요청 4: 스크롤 및 Sticky 조정) ---
    const AllAttendanceTable = () => {
        const allSessionDates = sessions.map(s => s.date);
        const ATT_OPTIONS_ALL = [...ATT_OPTIONS, '미체크'];
        
        const handleTableChange = (studentId, date, newStatus) => {
             handleTableAttendanceChange(studentId, date, newStatus);
        };

        return (
            <div className="overflow-x-auto border rounded-lg max-w-full"> 
                <table className="divide-y divide-gray-200 text-sm" style={{minWidth: `${150 + allSessionDates.length * 100}px`}}> 
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 sticky left-0 bg-gray-50 z-20 min-w-[150px] border-r">수강생 이름</th> 
                            {allSessionDates.map((date, index) => (
                                <th key={date} className="px-3 py-2 text-center text-xs font-semibold text-gray-600 min-w-[90px]">
                                    {index + 1}회차<br/>
                                    <span className='font-normal text-gray-400'>{date.slice(5)}</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {classStudents.map(student => (
                            <tr key={student.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2 font-medium sticky left-0 bg-white hover:bg-gray-50 z-10 min-w-[150px] text-left border-r">{student.name}</td> 
                                {allSessionDates.map(date => {
                                    const status = tempTableAttendanceMap[date] ? (tempTableAttendanceMap[date][student.id] || '미체크') : (allAttendanceMap[date] ? (allAttendanceMap[date][student.id] || '미체크') : '미체크');
                                    
                                    return (
                                        <td key={date} className="px-1 py-1 text-center relative group">
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

    // --- 서브 컴포넌트: 회차별 카드 뷰 (요청 2: 최대 높이 지정) ---
    const SessionAttendanceCards = () => (
        <div className="space-y-3 text-sm max-h-[calc(85vh-200px)] overflow-y-auto"> {/* 요청 2: 스크롤 영역 지정 */}
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

            <div className="flex-1 bg-white p-6 rounded-xl shadow-lg">
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
                        <div ref={tableRef} className="space-y-4"> 
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


// --- HomeworkManagement 컴포넌트 (수정된 컴포넌트) ---
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
    
    // 회차 클릭 핸들러 (요청 3: 회차 패널에서 호출 시)
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


    // 요청 4: 문항별 과제 결과 입력 테이블 (키보드 입력 로직 추가)
    const HomeworkResultTable = ({ assignment }) => {
        const tableRef = useRef(null);
        const totalQuestions = assignment.totalQuestions;
        const assignmentId = assignment.id;
        const questionIds = Array.from({ length: totalQuestions }, (_, i) => String(i + 1)); 
        const RESULT_OPTIONS = ['맞음', '틀림', '고침', '미체크'];
        
        // **getSummaryCounts 함수 정의:** (오류 해결)
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
                e.preventDefault(); // 기본 동작(스크롤) 방지
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
                                <th className="p-2 text-left text-xs font-semibold text-gray-600 uppercase w-32 sticky left-0 bg-gray-50 z-20 border-r">학생명 (결과)</th>
                                {questionIds.map(id => (
                                    <th key={id} className="p-1 text-center text-xs font-semibold text-gray-600 min-w-[50px]">{id}번</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {classStudents.map(student => {
                                // 과제가 할당된 학생만 표시 (요청 5 반영)
                                if (!assignment.students.includes(student.id)) return null; 
                                
                                const summary = getSummaryCounts(tempResults[student.id]);
                                
                                return (
                                    <tr key={student.id} className="hover:bg-gray-50">
                                        <td className="p-2 font-medium sticky left-0 bg-white hover:bg-gray-50 z-1 text-left border-r min-w-[120px]">
                                            {student.name}
                                            <p className='text-xs font-normal text-gray-500 mt-0.5'>맞: {summary['맞음']}, 틀: {summary['틀림']}, 고: {summary['고침']}</p>
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
                                                <p className="text-xs truncate">교재: {assignment.book} / 할당 학생: {assignment.students.length}명 / {assignment.content}</p>
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
                                    <p className="text-xs font-bold text-gray-600 mb-4">총 문항 수: {selectedAssignment.totalQuestions}개</p>
                                    
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


// --- GradeManagement 컴포넌트 (수정된 컴포넌트) ---
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
    
    // 요청 6: 테스트 목록을 커스텀 패널로 정의
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

// --- NotesManagement 컴포넌트 (유지) ---
const NotesManagement = () => { 
    const [problemImage, setProblemImage] = useState(null);
    const handleImageUpload = (e) => {
        if (e.target.files && e.target.files[0]) {
            setProblemImage(URL.createObjectURL(e.target.files[0]));
        }
    }
    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold mb-4">문제 은행 등록</h3>
                <div className="p-4 border rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                        <input type="text" placeholder="교재" className="p-2 border rounded w-full" />
                        <input type="text" placeholder="단원" className="p-2 border rounded w-full" />
                        <input type="text" placeholder="문제 번호" className="p-2 border rounded w-full" />
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full text-xs" />
                        <button className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600">등록하기</button>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 mb-2">이미지 미리보기:</p>
                        <div className="w-full h-48 border-2 border-dashed rounded-lg flex items-center justify-center bg-gray-50">
                            {problemImage ? <img src={problemImage} alt="Problem Preview" className="max-h-full max-w-full object-contain" /> : <span className="text-gray-400 text-sm">이미지를 업로드하세요</span>}
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold mb-4">오답노트 자동 생성</h3>
                <div className="flex items-center space-x-4 text-sm">
                     <select className="p-2 border rounded-lg">
                        <option>학생 선택</option>
                        {initialStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button className="bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600">PDF 생성</button>
                </div>
            </div>
        </div>
    )
};

// --- InternalCommunication 컴포넌트 (요청 6: 공지사항 탭 추가) ---
const InternalCommunication = ({ announcements, handleSaveAnnouncement }) => { 
    const [tab, setTab] = useState('announcement'); // 초기 탭 변경
    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex border-b mb-4">
                <button onClick={() => setTab('announcement')} className={`py-2 px-4 font-semibold text-sm ${tab === 'announcement' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>공지사항</button>
                <button onClick={() => setTab('logs')} className={`py-2 px-4 font-semibold text-sm ${tab === 'logs' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>근무 일지</button>
                <button onClick={() => setTab('messenger')} className={`py-2 px-4 font-semibold text-sm ${tab === 'messenger' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>메신저</button>
            </div>
            {tab === 'announcement' ? <Announcement announcements={announcements} handleSaveAnnouncement={handleSaveAnnouncement} /> : 
             (tab === 'logs' ? <WorkLogs /> : <Messenger />)}
        </div>
    )
};

// --- Announcement 컴포넌트 (요청 6) ---
const Announcement = ({ announcements, handleSaveAnnouncement }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
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
        setAllAnnouncements(prev => {
            const updated = prev.map(ann => 
                ann.id === id ? { ...ann, isPinned: !ann.isPinned } : ann
            );
            // 상태 업데이트 후 재정렬 로직 호출
            const now = new Date();
            updated.sort((a, b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return new Date(b.date) - new Date(a.date); // 최신순
            });
            return updated;
        });
    }
    
    return (
        <div className='space-y-4'>
            <div className='flex justify-end'>
                <button 
                    onClick={() => setIsModalOpen(true)}
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
                                    <button onClick={() => handleTogglePin(ann.id)} className={`p-1 rounded-full ${ann.isPinned ? 'text-red-500 bg-red-100 hover:bg-red-200' : 'text-gray-500 hover:bg-gray-200'}`} title={ann.isPinned ? '고정 해제' : '최상위 고정'}>
                                        <Icon name="pin" className="w-4 h-4"/>
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                작성자: {ann.author} | 게시일: {new Date(ann.scheduleTime).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                                {new Date(ann.scheduleTime) > new Date() && <span className='ml-2 text-blue-600 font-bold'>(예약됨)</span>}
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
                onClose={() => setIsModalOpen(false)} // 오타 수정
                onSave={handleSaveAnnouncement}
            />
        </div>
    )
}

// --- WorkLogs 컴포넌트 (유지) ---
const WorkLogs = () => { 
    const [logs, setLogs] = useState(initialWorkLogs);
    const [newLog, setNewLog] = useState('');
    const handleAddLog = () => {
        if (newLog.trim() === '') return;
        const logToAdd = { id: Date.now(), author: '김선생', date: new Date().toISOString().slice(0, 10), content: newLog };
        setLogs([logToAdd, ...logs]); setNewLog('');
    }
    return (
         <div className="text-sm">
            <div className="space-y-2 mb-4">
                <textarea value={newLog} onChange={(e) => setNewLog(e.target.value)} rows="3" placeholder="업무 인수인계 및 공지사항을 입력하세요..." className="w-full p-2 border rounded-lg"></textarea>
                <button onClick={handleAddLog} className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600">일지 작성</button>
            </div>
            <div className="space-y-4">
                {logs.map(log => (
                    <div key={log.id} className="p-4 border-l-4 border-gray-300 bg-gray-50 rounded">
                        <p>{log.content}</p><p className="text-right text-xs text-gray-500 mt-2">- {log.author}, {log.date}</p>
                    </div>
                ))}
            </div>
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