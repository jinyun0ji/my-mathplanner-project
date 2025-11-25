import React, { useState, useEffect, useCallback } from 'react';

// --- 데이터 샘플 ---
const initialStudents = [
  { id: 1, name: '김민준', school: '대한고등학교', grade: 2, phone: '010-1234-5678', parentPhone: '010-8765-4321', status: '재원생', registeredDate: '2025-03-05', classes: [1], paymentStatus: '완납', bookReceived: true },
  { id: 2, name: '이서연', school: '민국고등학교', grade: 2, phone: '010-2345-6789', parentPhone: '010-7654-3210', status: '재원생', registeredDate: '2025-03-05', classes: [2], paymentStatus: '미납', bookReceived: false },
  { id: 3, name: '박하준', school: '사랑고등학교', grade: 2, phone: '010-3456-7890', parentPhone: '010-6543-2109', status: '상담생', registeredDate: '2025-02-15', classes: [], paymentStatus: '해당없음', bookReceived: false },
  { id: 4, name: '최지우', school: '대한고등학교', grade: 2, phone: '010-4567-8901', parentPhone: '010-5432-1098', status: '재원생', registeredDate: '2025-03-20', classes: [1], paymentStatus: '완납', bookReceived: true },
  { id: 5, name: '정다은', school: '대한국제고', grade: 1, phone: '010-5678-9012', parentPhone: '010-4321-0987', status: '재원생', registeredDate: '2025-09-01', classes: [3], paymentStatus: '완납', bookReceived: true },
  { id: 6, name: '윤채원', school: '대한고등학교', grade: 2, phone: '010-6789-0123', parentPhone: '010-3210-9876', status: '재원생', registeredDate: '2025-08-01', classes: [1], paymentStatus: '완납', bookReceived: false },
  { id: 7, name: '홍길동', school: '상문고등학교', grade: 2, phone: '010-2002-0220', parentPhone: '010-2200-0022', status: '퇴원생', registeredDate: '2025-01-01', classes: [3], paymentStatus: '완납', bookReceived: true },
];

const initialClasses = [
    { id: 1, name: '고2 A1반', teacher: '채수용', students: [1, 6, 4], grade: 2, schoolType: '고등학교', startDate: '2025-11-01', endDate: '2025-12-31', schedule: { days: ['월', '수'], time: '19:00~21:00' } },
    { id: 2, name: '고2 A2반', teacher: '채수용', students: [2], grade: 2, schoolType: '고등학교', startDate: '2025-11-05', endDate: '2025-12-31', schedule: { days: ['화', '목'], time: '19:00~21:00' } },
    { id: 3, name: '고1 국제고반', teacher: '이선생', students: [5], grade: 1, schoolType: '고등학교', startDate: '2025-10-01', endDate: '2025-12-31', schedule: { days: ['금'], time: '17:00~20:00' } },
];

const initialLessonLogs = [
    { id: 1, classId: 1, date: '2025-11-04', progress: '다항식의 연산 P.12 ~ P.18', videoUrl: 'https://www.youtube.com/embed/mWkuigsWe4A?si=WxFCjABqFDJSLnYy', materialUrl: '/path/to/material1.pdf' },
    { id: 2, classId: 2, date: '2025-11-05', progress: '집합의 개념 및 포함 관계', videoUrl: '', materialUrl: '' },
    { id: 3, classId: 1, date: '2025-11-06', progress: '나머지 정리', videoUrl: '', materialUrl: '' },
    { id: 4, classId: 1, date: '2025-11-11', progress: '인수분해', videoUrl: '', materialUrl: '' },
    { id: 5, classId: 1, date: '2025-11-13', progress: '복소수', videoUrl: '', materialUrl: '' },
];

const initialAttendanceLogs = [
    // 2025-11-04 고2 A1반 출결 기록
    { id: 101, classId: 1, date: '2025-11-04', studentId: 1, status: '출석' },
    { id: 102, classId: 1, date: '2025-11-04', studentId: 6, status: '결석' },
    { id: 103, classId: 1, date: '2025-11-04', studentId: 4, status: '출석' },
    
    // 2025-11-05 고2 A2반 출결 기록
    { id: 104, classId: 2, date: '2025-11-05', studentId: 2, status: '지각' },
    
    // 2025-11-25 (현재 날짜) 고2 A1반 출결 기록 (미리 저장된 기록은 없음)
];

const initialStudentMemos = {
    1: '김민준 학생은 꼼꼼하지만, 서술형에서 자주 감점됨. 학부모님께 매주 피드백 전달 완료.',
    4: '최지우 학생은 7월에 수학 상 심화반으로 이동 예정. 선행 진도 체크 필요.',
};


const initialHomeworkAssignments = [
    { id: 1, classId: 1, date: '2025-06-26', content: 'RPM P.10 ~ P.15', students: [1, 4, 6] },
    { id: 2, classId: 2, date: '2025-06-27', content: '개념원리 P.20 ~ P.25', students: [2] },
];

const initialHomeworkResults = {
    // 학생 ID: { 과제 ID: { status: 'A'|'B'|'C'|'미제출', score: '8/10' } }
    1: { 1: { status: 'A', score: '10/10' } }, // 김민준
    4: { 1: { status: 'B', score: '8/10' } },  // 최지우
    6: { 1: { status: '미제출', score: '0/10' } }, // 윤채원
    2: { 2: { status: 'C', score: '5/10' } }, // 이서연
};


const initialPayments = [
    { studentId: 1, studentName: '김민준', books: [{name: '수학(상) RPM', price: 15000, status: '완납'}, {name: '블랙라벨 수학(상)', price: 17000, status: '완납'}], total: 32000, received: true },
    { studentId: 2, studentName: '이서연', books: [{name: '개념원리 수학I', price: 18000, status: '미납'}], total: 18000, received: false },
];

const initialWorkLogs = [
    {id: 1, author: '김선생', date: '2025-06-27', content: '박하준 학생 상담 완료. 7월부터 수강 희망.'},
    {id: 2, author: '이선생', date: '2025-06-26', content: '중2 심화 A반 교재 재고 확인 필요. 3부 부족.'},
];

const initialTests = [
    { id: 101, name: 'Test 1 (06/15)', maxScore: 100, classId: 1 },
    { id: 102, name: 'Test 2 (07/01)', maxScore: 100, classId: 1 },
    { id: 201, name: 'Test A (06/20)', maxScore: 100, classId: 2 },
];

const initialGrades = {
    1: { 101: 85, 102: 92 }, // 김민준
    6: { 101: 78, 102: 88 }, // 윤채원
    4: { 101: 95, 102: 95 }, // 최지우
    2: { 201: 75 }, // 이서연
    5: {}, // 정다은
};


// --- 아이콘 컴포넌트 ---
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
    fileText: <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></>,
    messageSquare: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>,
    graduationCap: <><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3.33 1.67 6.67 1.67 10 0v-5"/></>,
    wallet: <><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5h-2.43a2 2 0 0 1-1.94-1.51L15 9H5a2 2 0 0 0-2 2Z"/></>,
    barChart: <path d="M12 20V10M18 20V4M6 20v-6"/>,
    clipboardCheck: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M10 12L12 14L18 8"/></>,
    bookOpen: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>,
    calendar: <><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></>, 
  };
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{icons[name]}</svg>;
};

// --- 유틸리티 함수 ---

/**
 * 클래스 스케줄과 개강일을 기반으로 수업 회차 목록을 계산합니다.
 */
const calculateClassSessions = (cls) => {
    if (!cls || !cls.startDate || !cls.schedule || cls.schedule.days.length === 0) return [];

    // 개강일을 'YYYY-MM-DD' 형식에서 UTC 기준으로 시작하여 Timezone 오류 방지
    const parts = cls.startDate.split('-');
    const start = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
    
    // 현재 날짜도 UTC 기준으로 설정
    const today = new Date();
    const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())); 
    
    const sessions = [];
    let sessionCount = 1;

    // 요일 문자열을 Date.getDay() 인덱스로 변환 (일=0, 월=1, ..., 토=6)
    const dayMap = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
    const scheduledDays = cls.schedule.days.map(day => dayMap[day]).filter(d => d !== undefined);
    
    let currentDate = new Date(start);

    while (currentDate <= end) {
        if (scheduledDays.includes(currentDate.getUTCDay())) { // UTC 요일 사용
            sessions.push({
                session: sessionCount++,
                // 날짜 포맷은 YYYY-MM-DD (UTC 기준)
                date: currentDate.toISOString().slice(0, 10)
            });
        }
        // 다음 날로 이동 (UTC 기준)
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return sessions;
};

// --- 모달 컴포넌트 ---

// 모달 백드롭 
const Modal = ({ children, isOpen, onClose, title }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 relative">
                <h3 className="text-xl font-bold mb-4 border-b pb-2">{title}</h3>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
                    <Icon name="x" className="w-6 h-6" />
                </button>
                {children}
            </div>
        </div>
    );
};

// 메모 수정 모달 
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
                    className="p-3 border rounded-lg w-full focus:ring-blue-500 focus:border-blue-500"
                />
                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700">
                    메모 저장
                </button>
            </form>
        </Modal>
    );
}

// 클래스 추가 모달
const AddClassModal = ({ isOpen, onClose, onSave }) => {
    const defaultDate = new Date().toISOString().slice(0, 10);
    const [formData, setFormData] = useState({
        name: '',
        teacher: '채수용', // 기본값 설정
        startDate: defaultDate,
        endDate: defaultDate,
        days: [], // 반복 요일
        time: '19:00~21:00', // 수업 시간
        memo: '',
    });

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

        const newClass = {
            name: formData.name,
            teacher: formData.teacher,
            startDate: formData.startDate,
            endDate: formData.endDate,
            schedule: { days: formData.days, time: formData.time },
            memo: formData.memo,
            students: [],
        };

        onSave(newClass);
        onClose();
        // 폼 초기화 (모달 닫힐 때 자동으로 초기화될 수도 있지만 명시적으로 처리)
        setFormData({
            name: '',
            teacher: '채수용',
            startDate: defaultDate,
            endDate: defaultDate,
            days: [],
            time: '19:00~21:00',
            memo: '',
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="새 클래스 추가">
            <form onSubmit={handleSubmit} className="space-y-4">
                <input 
                    type="text" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleChange} 
                    placeholder="클래스명 (예: 고2 심화 B반)" 
                    required 
                    className="p-2 border rounded w-full" 
                    autocomplete="off" 
                />
                
                <div className="grid grid-cols-2 gap-4">
                    <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} placeholder="개강일" required className="p-2 border rounded w-full" />
                    <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} placeholder="종강일" required className="p-2 border rounded w-full" />
                </div>
                <input type="text" name="time" value={formData.time} onChange={handleChange} placeholder="수업 시간 (예: 19:00~21:00)" required className="p-2 border rounded w-full" />
                
                {/* 반복 요일 선택 */}
                <div className="border p-3 rounded-lg">
                    <label className="block font-semibold mb-2">반복 요일 선택:</label>
                    <div className="flex flex-wrap gap-2">
                        {WEEK_DAYS.map(day => (
                            <button
                                key={day}
                                type="button"
                                onClick={() => handleDayToggle(day)}
                                className={`px-3 py-1 rounded-full text-sm font-semibold transition-all duration-150 ${
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
                    className="p-2 border rounded w-full"
                />

                <button type="submit" className="w-full bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-700">
                    클래스 개설
                </button>
            </form>
        </Modal>
    );
};

// 학생 추가/수정 모달
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
        onSave(formData, isEdit ? student.id : null);
        onClose();
    };

    const statusOptions = ['재원생', '상담생', '퇴원생'];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `${student.name} 학생 정보 수정` : '새 학생 등록'}>
            <form onSubmit={handleSubmit} className="space-y-4">
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

// 테스트 생성/수정 모달 
const TestFormModal = ({ isOpen, onClose, onSave, classId, test = null }) => {
    const isEdit = !!test;
    const [name, setName] = useState(test?.name || '');
    const [maxScore, setMaxScore] = useState(test?.maxScore || 100);
    
    useEffect(() => {
        setName(test?.name || '');
        setMaxScore(test?.maxScore || 100);
    }, [test]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            id: isEdit ? test.id : Date.now(),
            name,
            maxScore: Number(maxScore),
            classId,
        }, isEdit);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? '테스트 정보 수정' : '새 테스트 생성'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="테스트 이름 (예: 7월 정기고사)" required className="p-2 border rounded w-full" />
                <input type="number" value={maxScore} onChange={e => setMaxScore(e.target.value)} placeholder="만점" required min="1" className="p-2 border rounded w-full" />
                <button type="submit" className="w-full bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-700">
                    {isEdit ? '테스트 수정' : '테스트 생성'}
                </button>
            </form>
        </Modal>
    );
}

// 수업 일지 등록/수정 모달 
const LessonLogFormModal = ({ isOpen, onClose, onSave, classId, log = null }) => {
    const isEdit = !!log;

    const [formData, setFormData] = useState({
        date: log?.date || new Date().toISOString().slice(0, 10),
        progress: log?.progress || '',
        videoUrl: log?.videoUrl || '',
    });
    
    useEffect(() => {
        setFormData({
            date: log?.date || new Date().toISOString().slice(0, 10),
            progress: log?.progress || '',
            videoUrl: log?.videoUrl || '',
        });
    }, [log]);


    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const dataToSave = {
            id: isEdit ? log.id : Date.now(),
            classId,
            date: formData.date,
            progress: formData.progress,
            videoUrl: formData.videoUrl,
            materialUrl: log?.materialUrl || '', 
        };

        onSave(dataToSave, isEdit);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `${formData.date} 수업 일지 수정` : '새 수업 일지 등록'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input type="date" name="date" value={formData.date} onChange={handleChange} required className="p-2 border rounded w-full" />
                <input type="text" name="progress" value={formData.progress} onChange={handleChange} placeholder="수업 진도 (예: 다항식의 연산 P.12 ~ P.18)" required className="p-2 border rounded w-full" />
                <input type="url" name="videoUrl" value={formData.videoUrl} onChange={handleChange} placeholder="보충/복습 영상 URL (선택 사항)" className="p-2 border rounded w-full" />

                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700">
                    {isEdit ? '일지 수정' : '일지 등록'}
                </button>
            </form>
        </Modal>
    );
};

// 출석 기록/수정 모달 (AttendanceManagement에서 사용하지 않음)
const AttendanceFormModal = ({ isOpen, onClose, onSave, classId, students, date, initialAttendance = [] }) => {
    const ATT_OPTIONS = ['출석', '지각', '동영상보강', '결석', '미체크'];
    
    const initialAttMap = initialAttendance.reduce((acc, curr) => ({ ...acc, [curr.studentId]: curr.status }), {});

    const [attendanceMap, setAttendanceMap] = useState(initialAttMap);

    useEffect(() => {
        setAttendanceMap(initialAttMap);
    }, [date, initialAttendance, students]); 

    const handleAttendanceChange = (studentId, status) => {
        setAttendanceMap(prev => ({ ...prev, [studentId]: status }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const finalAttendance = students.map(s => ({
            classId,
            date,
            studentId: s.id,
            status: attendanceMap[s.id] || '미체크'
        }));

        onSave(finalAttendance);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${date} 출결 등록 및 수정`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="border p-3 rounded-lg max-h-80 overflow-y-auto">
                    <label className="block font-semibold mb-2">출결 체크:</label>
                    <div className="space-y-2">
                        {students.map(s => (
                            <div key={s.id} className="flex items-center justify-between p-2 border-b last:border-b-0">
                                <span className="font-medium w-24">{s.name}</span>
                                <select 
                                    value={attendanceMap[s.id] || '미체크'} 
                                    onChange={(e) => handleAttendanceChange(s.id, e.target.value)} 
                                    className="p-1 border rounded text-sm"
                                >
                                    {ATT_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700">
                    출결 기록 저장
                </button>
            </form>
        </Modal>
    );
};

// 과제 등록/수정 모달 
const HomeworkAssignmentModal = ({ isOpen, onClose, onSave, classId, assignment = null }) => {
    const isEdit = !!assignment;
    const [content, setContent] = useState(assignment?.content || '');
    const [date, setDate] = useState(assignment?.date || new Date().toISOString().slice(0, 10));

    useEffect(() => {
        setContent(assignment?.content || '');
        setDate(assignment?.date || new Date().toISOString().slice(0, 10));
    }, [assignment]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (content.trim() === '') return;

        onSave({
            id: isEdit ? assignment.id : Date.now(),
            classId,
            date,
            content,
        }, isEdit);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? '과제 수정' : '새 과제 등록'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="p-2 border rounded w-full" />
                <textarea 
                    value={content} 
                    onChange={e => setContent(e.target.value)} 
                    placeholder="과제 내용 (예: RPM P.10 ~ P.15)" 
                    required 
                    rows="3"
                    className="p-2 border rounded w-full" 
                />
                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700">
                    {isEdit ? '과제 수정' : '과제 등록'}
                </button>
            </form>
        </Modal>
    );
};


// --- 메인 앱 컴포넌트: 모든 상태와 CRUD 로직을 관리하는 중앙 허브 ---
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [page, setPage] = useState('home'); 

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
  
  // 안정화: reduce의 초기값을 0으로 설정하여 빈 배열일 때의 오류를 방지합니다.
  const nextStudentId = students.reduce((max, s) => Math.max(max, s.id), 0) + 1; 
  const nextClassId = classes.reduce((max, c) => Math.max(max, c.id), 0) + 1; 

  // --- CRUD 함수: 클래스 관리 ---
  const handleSaveClass = (newClassData) => {
    const newClass = { 
        ...newClassData, 
        id: nextClassId, 
        schoolType: '고등학교', // 임시 기본값
        grade: 1, // 임시 기본값
        students: [], 
    };
    setClasses(prev => [...prev, newClass]);
    alert(`클래스 "${newClass.name}"가 개설되었습니다!`);
  };


  // --- CRUD 함수: 학생 관리 ---
  const getClassesNames = useCallback((classIds) => classIds.map(id => classes.find(c => c.id === id)?.name || '').join(', '), [classes]);
  
  const handleSaveStudent = (newStudentData, idToUpdate) => {
    if (idToUpdate) {
        const oldStudent = students.find(s => s.id === idToUpdate);
        
        setStudents(prev => prev.map(s => s.id === idToUpdate ? { ...s, ...newStudentData } : s));
        
        setClasses(prevClasses => prevClasses.map(cls => {
            const isNowInClass = newStudentData.classes.includes(cls.id);
            const wasInClass = oldStudent.classes.includes(cls.id);

            if (isNowInClass && !wasInClass) {
                return { ...cls, students: [...cls.students, idToUpdate] };
            } else if (!isNowInClass && wasInClass) {
                return { ...cls, students: cls.students.filter(sid => sid !== idToUpdate) };
            }
            return cls;
        }));

    } else {
        const newStudent = { ...newStudentData, id: nextStudentId, registeredDate: new Date().toISOString().slice(0, 10), paymentStatus: '해당없음', bookReceived: false };
        setStudents(prev => [...prev, newStudent]);
        setGrades(prev => ({ ...prev, [newStudent.id]: {} }));

        setClasses(prevClasses => prevClasses.map(cls => 
            newStudent.classes.includes(cls.id) 
                ? { ...cls, students: [...cls.students, newStudent.id] }
                : cls
        ));
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
        setStudentMemos(prev => { // 메모 삭제
            const newMemos = { ...prev };
            delete newMemos[id];
            return newMemos;
        })
    }
  };
  
  // --- CRUD 함수: 메모 관리 ---
  const handleSaveMemo = (studentId, content) => {
      setStudentMemos(prev => ({
          ...prev,
          [studentId]: content
      }));
  };

  // --- CRUD 함수: 수업 일지 관리 ---
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
  
  // --- CRUD 함수: 출석 관리 ---
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

  // --- CRUD 함수: 과제 관리 ---
  const handleSaveHomeworkAssignment = (assignmentData, isEdit) => {
    if (isEdit) {
        setHomeworkAssignments(prev => prev.map(a => a.id === assignmentData.id ? { ...a, ...assignmentData } : a));
    } else {
        const selectedClass = classes.find(c => c.id === assignmentData.classId);
        const newAssignment = { ...assignmentData, id: Date.now(), students: selectedClass ? selectedClass.students : [] }; 
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
  
  const handleUpdateHomeworkResult = (studentId, assignmentId, status, score) => {
    setHomeworkResults(prevResults => ({
        ...prevResults,
        [studentId]: {
            ...prevResults[studentId],
            [assignmentId]: { status, score }
        }
    }));
  };

  // --- CRUD 함수: 성적 및 테스트 관리 ---
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

  const handleUpdateGrade = (studentId, testId, score) => {
    setGrades(prevGrades => ({
        ...prevGrades,
        [studentId]: {
            ...prevGrades[studentId],
            [testId]: score === '' ? undefined : Number(score)
        }
    }));
  };

  if (!isLoggedIn) return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  
  // 모든 관리 컴포넌트에 필요한 상태와 함수를 Props로 전달
  const managementProps = {
    students, classes, lessonLogs, attendanceLogs, 
    homeworkAssignments, homeworkResults, tests, grades, studentMemos, 
    getClassesNames,
    handleSaveStudent, handleDeleteStudent,
    handleSaveClass, 
    handleSaveLessonLog, handleDeleteLessonLog,
    handleSaveAttendance,
    handleSaveHomeworkAssignment, handleDeleteHomeworkAssignment, handleUpdateHomeworkResult,
    handleSaveTest, handleDeleteTest, handleUpdateGrade,
    handleSaveMemo, 
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <Sidebar page={page} setPage={setPage} onLogout={() => setIsLoggedIn(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header page={page} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
          <PageContent page={page} {...managementProps} />
        </main>
      </div>
    </div>
  );
}

// --- 레이아웃 및 페이지 컴포넌트 (생략) ---
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
          <h1 className="text-4xl font-bold text-gray-800">매쓰-플래너</h1>
          <p className="mt-2 text-gray-600">직원용 로그인</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <input id="id" name="id" type="text" required className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="아이디" value={id} onChange={(e) => setId(e.target.value)} />
            <input id="password" name="password" type="password" required className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <button type="submit" className="w-full py-3 px-4 text-lg font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none">로그인</button>
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
  
  // 현재 페이지가 하위 메뉴에 속하는지 확인하는 함수
  const isSubPageActive = (parentItem) => parentItem.subItems && parentItem.subItems.some(sub => sub.id === page);

  return (
    <div className="w-64 bg-white text-gray-800 flex flex-col shadow-lg">
      <div className="h-20 flex items-center justify-center border-b"><h1 className="text-2xl font-bold text-blue-600">Math-Planner</h1></div>
      <nav className="flex-1 px-4 py-4 space-y-2">
        {navItems.map(item => (
          <React.Fragment key={item.id}>
            {/* 부모 항목 전체에 group 클래스 적용 */}
            <div className={`relative ${item.isParent ? 'group overflow-hidden' : ''}`}> 
              {/* 상위 메뉴 버튼 */}
              <button 
                  onClick={() => setPage(item.isParent ? (item.subItems[0]?.id || item.id) : item.id)} 
                  className={`w-full flex items-center px-4 py-3 text-left text-base rounded-lg transition-all duration-200 ${page === item.id || isSubPageActive(item) ? 'bg-blue-500 text-white shadow-md' : 'text-gray-600 hover:bg-blue-100 hover:text-blue-600'}`}
              >
                <Icon name={item.icon} className="w-6 h-6 mr-4" /><span>{item.name}</span>
              </button>
              
              {/* 하위 메뉴 (Max-Height 트랜지션 적용) */}
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
                              className={`w-full flex items-center px-4 py-2 text-left text-sm rounded-lg transition-all duration-200 ${page === subItem.id ? 'bg-blue-300 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
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
        <button onClick={onLogout} className="w-full flex items-center px-4 py-3 text-left text-base text-gray-600 hover:bg-red-100 hover:text-red-600 rounded-lg transition-all duration-200">
          <Icon name="logOut" className="w-6 h-6 mr-4" /><span>로그아웃</span>
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
      <h2 className="text-3xl font-semibold text-gray-700">{title}</h2>
      <div className="flex items-center space-x-4">
        <p className="text-gray-600">채수용 선생님, 환영합니다!</p><img className="w-12 h-12 rounded-full object-cover" src="https://placehold.co/100x100/E2E8F0/4A5568?text=User" alt="User" />
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
    case 'internal': return <InternalCommunication />;
    default: return <Home />; 
  }
};

// --- 각 페이지 컴포넌트 ---
const Home = () => <div className="p-6 bg-white rounded-lg shadow-md"><h3 className="text-2xl font-semibold">홈</h3><p>학원 운영의 전반적인 현황을 한눈에 볼 수 있는 주요 정보를 요약하여 제공합니다.</p></div>;

// --- StudentManagement 컴포넌트 (생략) ---
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
    const handleCloseMemo = () => {
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
                    className="flex items-center bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition duration-200"
                >
                    <Icon name="plus" className="w-5 h-5 mr-2" /> 학생 등록
                </button>
            </div>

            {/* 검색 및 필터링 UI (유지) */}
            <div className="mb-4 flex space-x-4">
                <div className="relative flex-1">
                    <Icon name="search" className="w-5 h-5 absolute top-3 left-3 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="이름, 학교 검색" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full p-2 pl-10 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <select 
                    value={filterStatus} 
                    onChange={e => setFilterStatus(e.target.value)} 
                    className="p-2 border-2 border-gray-300 rounded-lg bg-white"
                >
                    <option value="전체">상태 (전체)</option>
                    <option value="재원생">재원생</option>
                    <option value="상담생">상담생</option>
                    <option value="퇴원생">퇴원생</option>
                </select>
            </div>

            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full text-left divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {['학생명 / 연락처', '수강 강좌', '최근 출결', '메모 / 관리'].map(h => <th key={h} className="p-4 font-semibold text-gray-600">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredStudents.map(s => {
                            const latestStatus = getLatestAttendance(s.id);

                            return (
                                <tr key={s.id} className="hover:bg-gray-50">
                                    {/* 학생명 / 연락처 */}
                                    <td className="p-4">
                                        <p className="font-bold text-gray-900">{s.name}</p>
                                        <p className="text-sm text-gray-600 mt-1">
                                            {s.phone} (학생) / {s.parentPhone} (학부모)
                                        </p>
                                    </td>
                                    {/* 수강 강좌 */}
                                    <td className="p-4 text-sm text-gray-700">
                                        {getClassesNames(s.classes)}
                                    </td>
                                    
                                    {/* 최근 출결 */}
                                    <td className="p-4">
                                        <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(latestStatus)}`}>
                                            {latestStatus}
                                        </span>
                                    </td>

                                    {/* 메모 / 관리 */}
                                    <td className="p-4 flex space-x-2 items-center">
                                        {/* 메모 버튼 */}
                                        <button onClick={() => handleOpenMemo(s)} className="text-gray-500 hover:text-gray-700 p-1" title="메모"><Icon name="fileText" className="w-5 h-5" /></button>
                                        {/* 수정 버튼 */}
                                        <button onClick={() => handleEdit(s)} className="text-blue-500 hover:text-blue-700 p-1" title="정보 수정"><Icon name="edit" className="w-5 h-5" /></button>
                                        {/* 삭제 버튼 */}
                                        <button onClick={() => handleDeleteStudent(s.id)} className="text-red-500 hover:text-red-700 p-1" title="삭제"><Icon name="trash" className="w-5 h-5" /></button>
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


// --- LessonManagement 컴포넌트 (수정 없음) ---
const LessonManagement = ({ students, classes, lessonLogs, handleSaveLessonLog, handleDeleteLessonLog, handleSaveClass }) => {
    const initialClassId = classes.length > 0 ? classes[0].id : null;
    const [selectedClassId, setSelectedClassId] = useState(initialClassId);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState(null);
    
    // 클래스 추가 모달을 위한 상태
    const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);

    // 선택된 클래스 정보 및 로그 필터링
    const selectedClass = classes.find(c => c.id === selectedClassId);
    const classLogs = lessonLogs.filter(log => log.classId === selectedClassId).sort((a, b) => new Date(b.date) - new Date(a.date));
    const classStudents = students.filter(s => selectedClass?.students.includes(s.id));

    const handleEdit = (log) => {
        setEditingLog(log);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingLog(null);
        setIsModalOpen(false);
    };

    // 새 클래스 생성 후 자동 선택
    const handleClassSaveAndSelect = (newClassData) => {
        handleSaveClass(newClassData);
        // 저장 후, 새로 추가된 클래스의 ID를 선택 상태로 설정 (가장 높은 ID를 가정)
        const newClassId = initialClasses.reduce((max, c) => Math.max(max, c.id), 0) + 1;
        setSelectedClassId(newClassId);
    };


    return (
        // 전체를 flex 컨테이너로 설정
        <div className="flex h-full min-h-[85vh] space-x-6">
            
            {/* 1. 좌측 구역: 클래스 목록 및 클래스 추가 버튼 */}
            <div className="w-80 bg-white p-4 rounded-xl shadow-lg flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    {/* 텍스트 수정: 수업 목록 -> 클래스 목록 */}
                    <h3 className="text-xl font-bold text-gray-800">클래스 목록 ({classes.length}개)</h3> 
                    
                    {/* 클래스 추가 버튼 */}
                    <button 
                        onClick={() => setIsAddClassModalOpen(true)}
                        className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition duration-150 shadow-md"
                        title="새 클래스 추가"
                    >
                        <Icon name="plus" className="w-6 h-6" />
                    </button>
                </div>

                {/* 클래스 리스트 */}
                <div className="flex-1 space-y-2 overflow-y-auto pr-2">
                    {classes.length === 0 ? (
                        <p className="text-gray-500 text-sm">등록된 클래스가 없습니다.</p>
                    ) : (
                        classes.map(c => (
                            <div 
                                key={c.id}
                                onClick={() => setSelectedClassId(c.id)}
                                className={`p-3 border rounded-lg cursor-pointer transition duration-150 
                                    ${c.id === selectedClassId 
                                        ? 'bg-blue-100 border-blue-500 font-semibold' 
                                        : 'bg-white hover:bg-gray-50'}`
                                }
                            >
                                <p className="text-sm font-bold">{c.name}</p>
                                <p className="text-xs text-gray-600">
                                    {c.schedule?.days?.join(', ') || ''} {c.schedule?.time || ''}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>
            
            {/* 2. 우측 구역: 선택된 수업의 일지 관리 (기존 LessonManagement 내용) */}
            <div className="flex-1 bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-2xl font-bold mb-6 text-gray-800">{selectedClass?.name || '수업'} 일지 관리</h3>
                
                {!selectedClassId ? (
                    <div className="flex items-center justify-center h-48 text-gray-500">
                        좌측 목록에서 관리할 수업을 선택해 주세요.
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-xl font-semibold">수업 기록 ({classStudents.length}명)</h4>
                            <button onClick={() => { setEditingLog(null); setIsModalOpen(true); }} className="flex items-center bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600">
                                <Icon name="plus" className="w-5 h-5 mr-2" /> 새 수업일지 등록
                            </button>
                        </div>
                        
                        <div className="space-y-4 max-h-[calc(85vh-150px)] overflow-y-auto pr-2">
                            {classLogs.length === 0 ? (
                                <div className="p-4 text-center text-gray-500 border rounded-lg">등록된 수업 일지가 없습니다.</div>
                            ) : (
                                classLogs.map(log => (
                                    <div key={log.id} className="p-4 border rounded-lg shadow-sm bg-gray-50 hover:shadow-md transition duration-150">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-lg text-blue-700">{log.date}</h4>
                                            <div className="flex space-x-2">
                                                <button onClick={() => handleEdit(log)} className="text-gray-500 hover:text-blue-500" title="수정"><Icon name="edit" className="w-5 h-5" /></button>
                                                <button onClick={() => handleDeleteLessonLog(log.id)} className="text-gray-500 hover:text-red-500" title="삭제"><Icon name="trash" className="w-5 h-5" /></button>
                                            </div>
                                        </div>
                                        <p><span className="font-semibold">수업 진도:</span> {log.progress}</p>
                                        {log.videoUrl && (
                                            <div className="mt-2">
                                                <p className="font-semibold">수업 영상:</p>
                                                <a href={log.videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm truncate block">{log.videoUrl}</a>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}
            </div>

            <LessonLogFormModal 
                isOpen={isModalOpen} 
                onClose={handleCloseModal} 
                onSave={handleSaveLessonLog} 
                classId={selectedClassId} 
                log={editingLog}
            />
            
            {/* 클래스 추가 모달 연결 */}
            <AddClassModal 
                isOpen={isAddClassModalOpen} 
                onClose={() => setIsAddClassModalOpen(false)} 
                onSave={handleClassSaveAndSelect}
            />
        </div>
    );
};

// --- AttendanceManagement 컴포넌트 (수정 없음) ---
const AttendanceManagement = ({ students, classes, attendanceLogs, handleSaveAttendance, studentMemos, handleSaveMemo }) => {
    const initialClassId = classes.length > 0 ? initialClasses[0].id : null;
    const [selectedClassId, setSelectedClassId] = useState(initialClassId);
    
    // 선택된 날짜 (회차 리스트에서 선택 시)
    const [selectedDate, setSelectedDate] = useState(null); 
    
    // --- 메모 모달 상태 ---
    const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
    const [memoStudent, setMemoStudent] = useState(null);
    
    // --- 임시 출결 상태 (저장 전 변경사항) ---
    const [tempAttendanceMap, setTempAttendanceMap] = useState({});

    const ATT_OPTIONS = ['출석', '지각', '동영상보강', '결석'];

    const selectedClass = classes.find(c => c.id === selectedClassId);
    const classStudents = students.filter(s => selectedClass?.students.includes(s.id)) || []; 
    
    // 현재 날짜/반의 실제 DB 기록을 맵으로 구성
    const currentAttendanceMap = attendanceLogs
        .filter(log => log.classId === selectedClassId && log.date === selectedDate)
        .reduce((acc, log) => { acc[log.studentId] = log.status; return acc; }, {});
        
    // 전체 클래스에 대한 출결 기록 맵 (테이블 뷰 용)
    const allAttendanceMap = attendanceLogs
        .filter(log => log.classId === selectedClassId)
        .reduce((acc, log) => {
            if (!acc[log.date]) acc[log.date] = {};
            acc[log.date][log.studentId] = log.status;
            return acc;
        }, {});

    // 컴포넌트 마운트 및 날짜/반 변경 시 임시 상태를 실제 기록으로 초기화
    useEffect(() => {
        setTempAttendanceMap(currentAttendanceMap);
        // 클래스 변경 시 날짜 선택 초기화
        if (selectedDate && !selectedDate) {
            setSelectedDate(null);
        }
    }, [selectedClassId, selectedDate, students, attendanceLogs]);


    // 출결 상태 토글 로직
    const handleAttendanceToggle = (studentId, toggledStatus) => {
        if (!selectedDate) {
            alert("좌측에서 수업 회차를 먼저 선택해 주세요.");
            return;
        }
        
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
    
    // 출결 수정 사항 저장 (오른쪽 상단 버튼)
    const handleSaveAttendanceChanges = () => {
        if (!selectedClassId) {
            alert("반을 먼저 선택해주세요.");
            return;
        }
        if (!selectedDate) {
             alert("수업 날짜를 선택해야 출결을 저장할 수 있습니다.");
             return;
        }
        if (isSaveDisabled) return; 

        const changesToSave = classStudents.map(s => ({
            classId: selectedClassId,
            date: selectedDate,
            studentId: s.id,
            status: tempAttendanceMap[s.id] || '미체크' 
        }));

        handleSaveAttendance(changesToSave);
        
        // 저장 후, 임시 맵을 최신 상태 (저장된 상태)로 업데이트
        const updatedCurrentMap = changesToSave
            .filter(c => c.status !== '미체크')
            .reduce((acc, c) => { acc[c.studentId] = c.status; return acc; }, {});
            
        setTempAttendanceMap(updatedCurrentMap);
        alert(`[${selectedDate}] 출결 기록이 저장되었습니다.`);
    };

    // 메모 모달 핸들러
    const handleOpenMemo = (student) => {
        setMemoStudent(student);
        setIsMemoModalOpen(true);
    }
    const handleCloseMemo = () => {
        setMemoStudent(null);
        setIsMemoModalOpen(false);
    }
    
    // 저장 필요 여부 체크
    const hasChanges = useCallback(() => {
        if (!selectedDate) return false; // 날짜를 선택하지 않은 테이블 뷰에서는 저장 버튼을 비활성화 (테이블 직접 수정 불가)
        
        const tempKeys = Object.keys(tempAttendanceMap);
        const currentKeys = Object.keys(currentAttendanceMap);
        
        if (tempKeys.length !== currentKeys.length) return true;
        
        for (const key of tempKeys) {
            if (tempAttendanceMap[key] !== currentAttendanceMap[key]) return true;
        }

        for (const id in currentAttendanceMap) {
            if (tempAttendanceMap[id] === undefined && currentAttendanceMap[id] !== '미체크') {
                return true;
            }
        }
        
        return false;
    }, [tempAttendanceMap, currentAttendanceMap, selectedDate]);
    
    const isSaveDisabled = !hasChanges();

    // 수업 회차 리스트 계산
    const sessions = calculateClassSessions(selectedClass);
    
    // --- 렌더링 유틸리티 ---
    const getStatusColor = (status) => {
        switch (status) {
            case '출석': return 'bg-green-100 text-green-700';
            case '지각': return 'bg-yellow-100 text-yellow-700';
            case '동영상보강': return 'bg-blue-100 text-blue-700';
            case '결석': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-500';
        }
    };
    const getButtonClass = (buttonStatus, studentId) => { /* ... (기존 로직 유지) ... */
        const currentStatus = tempAttendanceMap[studentId] || currentAttendanceMap[studentId] || '미체크';
        const baseClass = "px-3 py-1 rounded-lg font-semibold text-sm transition duration-150";

        if (buttonStatus === currentStatus) {
            switch (currentStatus) {
                case '출석': return `${baseClass} bg-green-500 text-white`;
                case '지각': return `${baseClass} bg-yellow-500 text-white`;
                case '동영상보강': return `${baseClass} bg-blue-500 text-white`;
                case '결석': return `${baseClass} bg-red-500 text-white`;
                default: return `${baseClass} bg-gray-500 text-white`;
            }
        }
        switch (buttonStatus) {
            case '출석': return `${baseClass} bg-green-100 text-green-700 hover:bg-green-200`;
            case '지각': return `${baseClass} bg-yellow-100 text-yellow-700 hover:bg-yellow-200`;
            case '동영상보강': return `${baseClass} bg-blue-100 text-blue-700 hover:bg-blue-200`;
            case '결석': return `${baseClass} bg-red-100 text-red-700 hover:bg-red-200`;
            default: return `${baseClass} bg-gray-100 text-gray-700 hover:bg-gray-200`;
        }
    };
    const getMemoButtonClass = (hasMemo) => { /* ... (기존 로직 유지) ... */
        const baseClass = "p-2 rounded-lg transition duration-150";
        return hasMemo 
            ? `${baseClass} bg-blue-500 text-white hover:bg-blue-600`
            : `${baseClass} bg-gray-200 text-gray-600 hover:bg-gray-300`;
    };
    
    // --- 서브 컴포넌트: 전체 출결 테이블 뷰 ---
    const AllAttendanceTable = () => {
        const sortedDates = Object.keys(allAttendanceMap).sort((a, b) => new Date(a) - new Date(b));
        const ATT_OPTIONS_ALL = [...ATT_OPTIONS, '미체크'];
        
        const handleTableChange = (studentId, date, newStatus) => {
             // 테이블 셀 클릭 시 바로 저장 함수 호출 (테이블은 임시 맵을 사용하지 않음)
             handleSaveAttendance([{ 
                classId: selectedClassId, 
                date: date, 
                studentId: studentId, 
                status: newStatus 
            }]);
        };

        return (
            <div className="overflow-x-auto overflow-y-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 sticky left-0 bg-gray-50 z-10 w-40">수강생 이름</th>
                            {sortedDates.map(date => (
                                <th key={date} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 min-w-[100px]">{date.slice(5)}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {classStudents.map(student => (
                            <tr key={student.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2 font-medium sticky left-0 bg-white hover:bg-gray-50 z-1 w-40">{student.name}</td>
                                {sortedDates.map(date => {
                                    const status = allAttendanceMap[date][student.id] || '미체크';
                                    return (
                                        <td key={date} className="px-4 py-1 text-center relative group">
                                            <select
                                                value={status}
                                                onChange={(e) => handleTableChange(student.id, date, e.target.value)}
                                                className={`w-full p-1 border rounded text-sm ${getStatusColor(status)} appearance-none`}
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
            </div>
        );
    };

    // --- 서브 컴포넌트: 회차별 카드 뷰 ---
    const SessionAttendanceCards = () => (
        <div className="space-y-3">
            {classStudents.map(s => {
                const hasMemo = !!studentMemos[s.id];

                return (
                    <div key={s.id} className="flex justify-between items-center p-4 border rounded-xl shadow-sm bg-gray-50">
                        
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center justify-center w-10 h-10 bg-gray-300 rounded-full text-gray-700">
                                <Icon name="users" className="w-5 h-5"/>
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
                                <Icon name="fileText" className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
    
    // --- 메인 렌더링 ---
    return (
        // 3단 레이아웃 (280px / 280px / Flex-1)
        <div className="flex h-full min-h-[85vh] space-x-6">
            
            {/* 좌측 패널 (280px) */}
            <div className="w-72 flex flex-col space-y-4">
                
                {/* 1. 좌측 상단: 클래스 선택 */}
                <div className="bg-white p-4 rounded-xl shadow-lg">
                    <h4 className="font-bold mb-2">클래스 선택</h4>
                    <select 
                        value={selectedClassId || ''} 
                        onChange={e => {
                            setSelectedClassId(Number(e.target.value));
                            setSelectedDate(null); // 클래스 변경 시 날짜 선택 초기화
                        }} 
                        className="p-2 border rounded-lg w-full"
                    >
                        {!selectedClassId && <option value="" disabled>클래스를 선택해주세요</option>}
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                
                {/* 2. 좌측 하단: 캘린더 및 수업 회차 리스트 */}
                <div className="bg-white p-4 rounded-xl shadow-lg flex-1 overflow-y-auto">
                    <h4 className="font-bold mb-3">수업 회차</h4>
                    
                    {!selectedClassId ? (
                         <p className="text-gray-500 text-sm">클래스를 선택해 주세요.</p>
                    ) : (
                        <div className="space-y-2">
                             {/* 캘린더 더미 */}
                            <div className="p-2 bg-gray-100 rounded-lg text-center text-sm mb-3">
                                📅 **캘린더 영역 (구현 예정)**
                                <p className="text-xs text-gray-500">수업 날짜 {sessions.length}일 표시</p>
                            </div>

                            {/* 회차 리스트 */}
                            <div className="space-y-2">
                                {sessions.map(session => {
                                    const sessionAttendance = allAttendanceMap[session.date] || {};
                                    const summary = ATT_OPTIONS.reduce((acc, status) => {
                                        const count = Object.values(sessionAttendance).filter(s => s === status).length;
                                        if (count > 0) acc.push(`${status} ${count}명`);
                                        return acc;
                                    }, []);
                                    
                                    const summaryText = summary.length > 0 ? summary.join(', ') : '미체크';

                                    return (
                                        <div
                                            key={session.date}
                                            onClick={() => setSelectedDate(session.date)}
                                            className={`p-3 border rounded-lg cursor-pointer transition duration-150 
                                                ${session.date === selectedDate 
                                                    ? 'bg-blue-500 text-white font-semibold shadow-md' 
                                                    : 'bg-white hover:bg-gray-100'}`
                                            }
                                        >
                                            <p className="text-sm font-bold">
                                                {session.session}회차 수업
                                                <span className={`${session.date === selectedDate ? 'text-blue-200' : 'text-gray-400'} ml-2 font-normal`}>
                                                    {session.date.slice(5)}
                                                </span>
                                            </p>
                                            <p className={`text-xs ${session.date === selectedDate ? 'text-blue-200' : 'text-gray-500'}`}>
                                                {summaryText}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 우측 메인 구역 (Flex-1) */}
            <div className="flex-1 bg-white p-6 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <h3 className="text-2xl font-bold text-gray-800">
                        {selectedClass ? `${selectedClass.name} 출결 기록` : '출석 기록 조회'}
                    </h3>
                    
                    {/* 저장 버튼 */}
                    {selectedDate && (
                        <button 
                            onClick={handleSaveAttendanceChanges} 
                            disabled={isSaveDisabled}
                            className={`flex items-center font-bold py-2 px-4 rounded-lg transition duration-200 
                                ${isSaveDisabled 
                                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                                }`
                            }
                        >
                            <Icon name="edit" className="w-5 h-5 mr-2" /> 출결 저장
                        </button>
                    )}
                </div>

                {!selectedClassId ? (
                    <div className="flex items-center justify-center h-48 text-gray-500 text-xl">
                        좌측 상단에서 관리할 **클래스**를 선택해 주세요.
                    </div>
                ) : (
                    selectedDate ? (
                        /* 회차(날짜) 선택 시: 카드 뷰 (개별 수정 모드) */
                         <SessionAttendanceCards />
                    ) : (
                        /* 날짜 미선택 시: 전체 출결 테이블 뷰 (일괄 조회 모드) */
                        <div className="space-y-4">
                            <p className="text-gray-600 text-sm">좌측 회차 목록에서 날짜를 선택하면 개별 수정이 가능합니다.</p>
                            <AllAttendanceTable />
                        </div>
                    )
                )}
            </div>
            
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

// --- HomeworkManagement 컴포넌트 ---
const HomeworkManagement = ({ students, classes, homeworkAssignments, homeworkResults, handleSaveHomeworkAssignment, handleDeleteHomeworkAssignment, handleUpdateHomeworkResult }) => {
    const [selectedClassId, setSelectedClassId] = useState(initialClasses[0].id);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState(null); 
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState(null);

    const selectedClass = classes.find(c => c.id === selectedClassId);
    const classAssignments = homeworkAssignments.filter(a => a.classId === selectedClassId).sort((a, b) => new Date(b.date) - new Date(a.date));
    const classStudents = students.filter(s => selectedClass?.students.includes(s.id)) || [];
    
    const RESULT_OPTIONS = ['A', 'B', 'C', '미제출'];

    const HomeworkResultTable = ({ assignment }) => {
        const studentResults = classStudents.map(s => ({
            student: s,
            result: homeworkResults[s.id]?.[assignment.id] || { status: '미제출', score: '' }
        }));
        
        const handleResultChange = (studentId, field, value) => {
            const currentResult = homeworkResults[studentId]?.[assignment.id] || { status: '미제출', score: '' };
            
            if (field === 'status') {
                 handleUpdateHomeworkResult(studentId, assignment.id, value, currentResult.score);
            } else if (field === 'score') {
                handleUpdateHomeworkResult(studentId, assignment.id, currentResult.status, value);
            }
        };

        const getStatusColor = (status) => {
            switch (status) {
                case 'A': return 'text-green-600';
                case 'B': return 'text-blue-600';
                case 'C': return 'text-yellow-600';
                case '미제출': return 'text-red-600';
                default: return 'text-gray-500';
            }
        };

        return (
            <div className="overflow-x-auto mt-4 border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase w-1/4">학생명</th>
                            <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase w-1/4">등급</th>
                            <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase w-1/4">점수/문항수</th>
                            <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase w-1/4">관리</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {studentResults.map(data => (
                            <tr key={data.student.id} className="hover:bg-gray-50">
                                <td className="p-3 font-medium">{data.student.name}</td>
                                <td className="p-3 text-center">
                                    <select 
                                        value={data.result.status} 
                                        onChange={e => handleResultChange(data.student.id, 'status', e.target.value)} 
                                        className={`p-1 border rounded text-sm font-semibold ${getStatusColor(data.result.status)}`}
                                    >
                                        {RESULT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </td>
                                <td className="p-3 text-center">
                                    <input 
                                        type="text"
                                        value={data.result.score}
                                        onChange={e => handleResultChange(data.student.id, 'score', e.target.value)}
                                        placeholder="10/10"
                                        className="w-20 p-1 border rounded text-center text-sm"
                                    />
                                </td>
                                <td className="p-3 text-center text-gray-500 text-xs">{data.result.score && data.result.score !== '' ? '저장됨' : '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg space-y-6">
            <h3 className="text-xl font-bold">과제 등록 및 결과 관리</h3>

            <div className="flex justify-between items-center border-b pb-4">
                <div className="flex space-x-4 items-center">
                    <label htmlFor="class-select" className="font-semibold">반 선택:</label>
                    <select id="class-select" value={selectedClassId} onChange={e => { setSelectedClassId(Number(e.target.value)); setSelectedAssignmentId(null); }} className="p-2 border rounded-lg">
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <button 
                    onClick={() => { setEditingAssignment(null); setIsAssignmentModalOpen(true); }} 
                    className="flex items-center bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600"
                >
                    <Icon name="plus" className="w-5 h-5 mr-2" /> 새 과제 등록
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-1 border p-4 rounded-lg bg-gray-50 max-h-96 overflow-y-auto">
                    <h4 className="font-semibold mb-3">등록된 과제 목록</h4>
                    <div className="space-y-2">
                        {classAssignments.length === 0 ? (
                            <p className="text-gray-500 text-sm">등록된 과제가 없습니다.</p>
                        ) : (
                            classAssignments.map(assignment => (
                                <div 
                                    key={assignment.id} 
                                    onClick={() => setSelectedAssignmentId(assignment.id)}
                                    className={`p-3 border rounded-lg cursor-pointer transition duration-150 ${selectedAssignmentId === assignment.id ? 'bg-blue-200 border-blue-500 shadow-md' : 'bg-white hover:bg-blue-50'}`}
                                >
                                    <p className="font-bold">{assignment.date}</p>
                                    <p className="text-sm truncate">{assignment.content}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="md:col-span-1 border p-4 rounded-lg">
                    <h4 className="font-semibold mb-3 border-b pb-2">과제 상세 및 결과 입력</h4>
                    {selectedAssignmentId ? (
                        (() => {
                            const assignment = classAssignments.find(a => a.id === selectedAssignmentId);
                            if (!assignment) return <p className="text-gray-500">과제 정보를 찾을 수 없습니다.</p>;

                            return (
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <p className="text-sm font-semibold text-gray-700">날짜: {assignment.date}</p>
                                        <div className="flex space-x-2">
                                            <button onClick={() => { setEditingAssignment(assignment); setIsAssignmentModalOpen(true); }} className="text-blue-500 hover:text-blue-700"><Icon name="edit" className="w-5 h-5" /></button>
                                            <button onClick={() => handleDeleteHomeworkAssignment(assignment.id)} className="text-red-500 hover:text-red-700"><Icon name="trash" className="w-5 h-5" /></button>
                                        </div>
                                    </div>
                                    <p className="p-3 bg-gray-100 rounded-lg whitespace-pre-wrap">{assignment.content}</p>
                                    <h5 className="font-bold mt-4 mb-2">학생별 결과 입력 ({classStudents.length}명)</h5>
                                    {classStudents.length === 0 ? (
                                         <p className="text-gray-500 text-sm mt-4">이 반에 등록된 학생이 없습니다.</p>
                                    ) : (
                                        <HomeworkResultTable assignment={assignment} />
                                    )}
                                </div>
                            );
                        })()
                    ) : (
                        <div className="flex items-center justify-center h-48 text-gray-500">
                            좌측 목록에서 과제를 선택하세요.
                        </div>
                    )}
                </div>
            </div>

            <HomeworkAssignmentModal 
                isOpen={isAssignmentModalOpen} 
                onClose={() => setIsAssignmentModalOpen(false)}
                onSave={handleSaveHomeworkAssignment}
                classId={selectedClassId}
                assignment={editingAssignment}
            />
        </div>
    );
};

// --- GradeManagement 컴포넌트 ---
const GradeManagement = ({ students, classes, tests, grades, handleSaveTest, handleDeleteTest, handleUpdateGrade }) => {
    const [selectedClassId, setSelectedClassId] = useState(initialClasses[0].id);
    const [isTestModalOpen, setIsTestModalOpen] = useState(false);
    const [editingTest, setEditingTest] = useState(null);

    const selectedClass = classes.find(c => c.id === selectedClassId);
    
    const classTests = tests.filter(t => t.classId === selectedClassId).sort((a, b) => b.id - a.id);

    const classStudents = students.filter(s => selectedClass?.students.includes(s.id));

    const calculateClassAverages = () => {
        const averages = {};
        if (classStudents.length === 0) return {};

        classTests.forEach(test => {
            let totalScore = 0;
            let studentCount = 0;
            
            classStudents.forEach(student => {
                const score = grades[student.id]?.[test.id];
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
    
    const handleGradeChange = (studentId, testId, value) => {
        if (value === '' || (/^\d*$/.test(value) && value.length <= 3)) {
            handleUpdateGrade(studentId, testId, value);
        }
    }


    return (
        <div className="flex h-[80vh] bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="w-64 border-r bg-gray-50 p-4 overflow-y-auto">
                <h4 className="font-bold text-lg mb-4 text-gray-700">클래스 선택</h4>
                <div className="space-y-2">
                    {classes.map(c => (
                        <button
                            key={c.id}
                            onClick={() => setSelectedClassId(c.id)}
                            className={`w-full text-left p-3 rounded-lg transition duration-150 ${c.id === selectedClassId ? 'bg-blue-500 text-white font-semibold shadow-md' : 'bg-white hover:bg-blue-50 text-gray-800'}`}
                        >
                            {c.name} ({c.students.length}명)
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex flex-col p-6 overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-gray-800">{selectedClass?.name || '클래스'} 성적 현황</h3>
                    <button 
                        onClick={() => { setEditingTest(null); setIsTestModalOpen(true); }} 
                        className="flex items-center bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600 transition duration-200 shadow-md"
                    >
                        <Icon name="plus" className="w-5 h-5 mr-2" /> 테스트 생성
                    </button>
                </div>
                
                {selectedClassId === null || classStudents.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-gray-500 text-xl">
                        {selectedClassId === null ? '클래스를 선택해 주세요.' : `${selectedClass.name}에 등록된 학생이 없습니다.`}
                    </div>
                ) : (
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-48 sticky left-0 bg-gray-50 z-10">학생명</th>
                                    {classTests.map(test => (
                                        <th key={test.id} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase min-w-[120px] group relative">
                                            <div className="flex flex-col items-center">
                                                <span>{test.name}</span>
                                                <span className="font-normal text-gray-400">({test.maxScore}점 만점)</span>
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
                                <tr className="bg-yellow-50 font-bold text-sm sticky top-[70px] z-5">
                                    <td className="px-6 py-3 whitespace-nowrap text-left text-yellow-800 sticky left-0 bg-yellow-50 z-10">평균</td>
                                    {classTests.map(test => (
                                        <td key={test.id} className="px-4 py-3 whitespace-nowrap text-center text-yellow-800">
                                            {classAverages[test.id]}
                                        </td>
                                    ))}
                                </tr>
                                {classStudents.map(student => (
                                    <tr key={student.id} className="hover:bg-gray-50 text-sm">
                                        <td className="px-6 py-3 whitespace-nowrap font-medium text-gray-900 sticky left-0 bg-white hover:bg-gray-50 z-1">
                                            {student.name}
                                        </td>
                                        {classTests.map(test => {
                                            const score = grades[student.id]?.[test.id] === undefined ? '' : grades[student.id]?.[test.id];
                                            return (
                                                <td key={test.id} className="px-4 py-1 whitespace-nowrap text-center">
                                                    <input
                                                        type="text" 
                                                        value={score}
                                                        onChange={(e) => handleGradeChange(student.id, test.id, e.target.value)}
                                                        className="w-16 p-1 border rounded text-center focus:ring-blue-500 focus:border-blue-500"
                                                        placeholder="-"
                                                        maxLength="3"
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <TestFormModal
                isOpen={isTestModalOpen}
                onClose={handleCloseTestModal}
                onSave={handleSaveTest}
                classId={selectedClassId}
                test={editingTest}
            />
        </div>
    );
};

// --- PaymentManagement 컴포넌트 ---
const PaymentManagement = () => { 
    const [payments] = useState(initialPayments);
    return (
         <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold mb-6">수납 관리</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50">
                        <tr>{['학생명', '교재 목록', '총액', '납부 상태', '수령 여부'].map(h => <th key={h} className="p-4 font-semibold text-gray-600">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                        {payments.map(p => (
                            <tr key={p.studentId} className="border-b hover:bg-gray-50">
                                <td className="p-4 font-medium">{p.studentName}</td>
                                <td className="p-4">{p.books.map(b => `${b.name} (${b.price.toLocaleString()}원)`).join(', ')}</td>
                                <td className="p-4 font-bold">{p.total.toLocaleString()}원</td>
                                <td className={`p-4 font-semibold ${p.books.every(b => b.status === '완납') ? 'text-green-600' : 'text-red-500'}`}>{p.books.every(b => b.status === '완납') ? '완납' : '미납'}</td>
                                <td className="p-4">{p.received ? '수령' : '미수령'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
         </div>
    )
};

// --- NotesManagement 컴포넌트 ---
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
                <div className="p-4 border rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <input type="text" placeholder="교재" className="p-2 border rounded w-full" />
                        <input type="text" placeholder="단원" className="p-2 border rounded w-full" />
                        <input type="text" placeholder="문제 번호" className="p-2 border rounded w-full" />
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full text-sm" />
                        <button className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600">등록하기</button>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 mb-2">이미지 미리보기:</p>
                        <div className="w-full h-48 border-2 border-dashed rounded-lg flex items-center justify-center bg-gray-50">
                            {problemImage ? <img src={problemImage} alt="Problem Preview" className="max-h-full max-w-full object-contain" /> : <span className="text-gray-400">이미지를 업로드하세요</span>}
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold mb-4">오답노트 자동 생성</h3>
                <div className="flex items-center space-x-4">
                     <select className="p-2 border rounded-lg">
                        <option>학생 선택</option>
                        {initialStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button className="bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600">PDF 생성</button>
                </div>
            </div>
        </div>
    )
}

// --- InternalCommunication 컴포넌트 ---
const InternalCommunication = () => { 
    const [tab, setTab] = useState('logs'); 
    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex border-b mb-4">
                <button onClick={() => setTab('logs')} className={`py-2 px-4 font-semibold ${tab === 'logs' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>근무 일지</button>
                <button onClick={() => setTab('messenger')} className={`py-2 px-4 font-semibold ${tab === 'messenger' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>메신저</button>
            </div>
            {tab === 'logs' ? <WorkLogs /> : <Messenger />}
        </div>
    )
};

// --- WorkLogs 컴포넌트 ---
const WorkLogs = () => { 
    const [logs, setLogs] = useState(initialWorkLogs);
    const [newLog, setNewLog] = useState('');
    const handleAddLog = () => {
        if (newLog.trim() === '') return;
        const logToAdd = { id: Date.now(), author: '김선생', date: new Date().toISOString().slice(0, 10), content: newLog };
        setLogs([logToAdd, ...logs]); setNewLog('');
    }
    return (
         <div>
            <div className="space-y-2 mb-4">
                <textarea value={newLog} onChange={(e) => setNewLog(e.target.value)} rows="3" placeholder="업무 인수인계 및 공지사항을 입력하세요..." className="w-full p-2 border rounded-lg"></textarea>
                <button onClick={handleAddLog} className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600">일지 작성</button>
            </div>
            <div className="space-y-4">
                {logs.map(log => (
                    <div key={log.id} className="p-4 border-l-4 border-gray-300 bg-gray-50 rounded">
                        <p>{log.content}</p><p className="text-right text-sm text-gray-500 mt-2">- {log.author}, {log.date}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

// --- Messenger 컴포넌트 ---
const Messenger = () => {
    return (
        <div className="flex h-[60vh]">
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