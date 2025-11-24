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
    { id: 1, name: '고2 A1반', teacher: '채수용', students: [1, 6, 4], grade: 2, schoolType: '고등학교' },
    { id: 2, name: '고2 A2반', teacher: '채수용', students: [2], grade: 2, schoolType: '고등학교' },
    { id: 3, name: '고1 국제고반', teacher: '이선생', students: [5], grade: 1, schoolType: '고등학교' },
];

const initialLessonLogs = [
    { id: 1, classId: 1, date: '2025-06-26', progress: '다항식의 연산 P.12 ~ P.18', videoUrl: 'https://www.youtube.com/embed/mWkuigsWe4A?si=WxFCjABqFDJSLnYy', materialUrl: '/path/to/material1.pdf' },
    { id: 2, classId: 2, date: '2025-06-27', progress: '집합의 개념 및 포함 관계', videoUrl: '', materialUrl: '' },
];

const initialAttendanceLogs = [
    // 2025-06-26 출결 기록
    { id: 101, classId: 1, date: '2025-06-26', studentId: 1, status: '출석' },
    { id: 102, classId: 1, date: '2025-06-26', studentId: 6, status: '결석' },
    { id: 103, classId: 1, date: '2025-06-26', studentId: 4, status: '출석' },
    
    // 2025-06-27 출결 기록
    { id: 104, classId: 2, date: '2025-06-27', studentId: 2, status: '지각' },
    
    // 2025-11-24 출결 기록 (초기값)
    { id: 201, classId: 1, date: '2025-11-24', studentId: 1, status: '출석' },
    { id: 202, classId: 1, date: '2025-11-24', studentId: 6, status: '지각' },
    { id: 203, classId: 1, date: '2025-11-24', studentId: 4, status: '동영상보강' },
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
    bookOpen: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></> 
  };
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{icons[name]}</svg>;
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

// 메모 수정 모달 (새로 추가)
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

// 출석 기록/수정 모달 (기존 모달 유지 - AttendanceManagement에서 사용은 안함)
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
  const [studentMemos, setStudentMemos] = useState(initialStudentMemos); // **새 상태: 학생 메모**
  
  // 안정화: reduce의 초기값을 0으로 설정하여 빈 배열일 때의 오류를 방지합니다.
  const nextStudentId = students.reduce((max, s) => Math.max(max, s.id), 0) + 1; 


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
  
  // --- CRUD 함수: 메모 관리 (새로 추가) ---
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
  
  // --- CRUD 함수: 출석 관리 (수정됨: 일괄 업데이트 로직) ---
  const handleSaveAttendance = (attendanceRecords) => {
    setAttendanceLogs(prevLogs => {
        let newLogs = [...prevLogs];
        attendanceRecords.forEach(record => {
            const existingIndex = newLogs.findIndex(
                log => log.classId === record.classId && log.date === record.date && log.studentId === record.studentId
            );

            // 미체크 상태인 경우 기존 로그를 삭제하거나 업데이트하지 않음
            if (record.status === '미체크') {
                if (existingIndex !== -1) {
                    // 기존 로그가 미체크로 변경되면 삭제 (불필요한 로그 방지)
                    newLogs.splice(existingIndex, 1); 
                }
            } else {
                // 출석, 지각, 보강, 결석 상태인 경우 저장/업데이트
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
    homeworkAssignments, homeworkResults, tests, grades, studentMemos, // studentMemos 추가
    getClassesNames,
    handleSaveStudent, handleDeleteStudent,
    handleSaveLessonLog, handleDeleteLessonLog,
    handleSaveAttendance,
    handleSaveHomeworkAssignment, handleDeleteHomeworkAssignment, handleUpdateHomeworkResult,
    handleSaveTest, handleDeleteTest, handleUpdateGrade,
    handleSaveMemo, // handleSaveMemo 추가
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

// --- 레이아웃 및 페이지 라우팅 (변경 없음) ---
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

// --- StudentManagement 컴포넌트: 학생 목록 UI 개선 및 최근 출결, 메모 기능 추가 ---
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

const LessonManagement = ({ students, classes, lessonLogs, handleSaveLessonLog, handleDeleteLessonLog }) => {
    const [selectedClassId, setSelectedClassId] = useState(initialClasses[0].id);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState(null);

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

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg space-y-6">
            <h3 className="text-xl font-bold">수업 일지 관리 (날짜, 진도, 영상)</h3>
            <div className="flex justify-between items-center">
                <div>
                    <label htmlFor="class-select" className="mr-2 font-semibold">반 선택:</label>
                    <select id="class-select" value={selectedClassId} onChange={e => setSelectedClassId(Number(e.target.value))} className="p-2 border rounded-lg">
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <span className="ml-4 text-gray-600">({classStudents.length}명)</span>
                </div>
                <button onClick={() => { setEditingLog(null); setIsModalOpen(true); }} className="flex items-center bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600">
                    <Icon name="plus" className="w-5 h-5 mr-2" /> 새 수업일지 등록
                </button>
            </div>
            <div className="space-y-4">
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

            <LessonLogFormModal 
                isOpen={isModalOpen} 
                onClose={handleCloseModal} 
                onSave={handleSaveLessonLog} 
                classId={selectedClassId} 
                log={editingLog}
            />
        </div>
    );
};

// --- AttendanceManagement 컴포넌트: 최종 출결 UI 및 토글 기능 구현 ---
const AttendanceManagement = ({ students, classes, attendanceLogs, handleSaveAttendance, studentMemos, handleSaveMemo }) => {
    // 안정화: classes 배열이 비어있지 않다면 첫 번째 클래스의 id를 기본값으로, 그렇지 않으면 null
    const [selectedClassId, setSelectedClassId] = useState(classes.length > 0 ? initialClasses[0].id : null);
    const [selectedDate, setSelectedDate] = useState('2025-11-24'); 
    
    // --- 메모 모달 상태 ---
    const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
    const [memoStudent, setMemoStudent] = useState(null);
    
    // --- 임시 출결 상태 (저장 전 변경사항) ---
    // { studentId: status, ... }
    const [tempAttendanceMap, setTempAttendanceMap] = useState({});

    const ATT_OPTIONS = ['출석', '지각', '동영상보강', '결석'];

    // 클래스가 선택되지 않았을 경우, 혹은 클래스 데이터가 없을 경우 안전하게 처리
    const selectedClass = classes.find(c => c.id === selectedClassId);
    const classStudents = students.filter(s => selectedClass?.students.includes(s.id)) || []; 
    
    // 현재 날짜/반의 실제 DB 기록을 맵으로 구성
    const currentAttendanceMap = attendanceLogs
        .filter(log => log.classId === selectedClassId && log.date === selectedDate)
        .reduce((acc, log) => { acc[log.studentId] = log.status; return acc; }, {});

    // 컴포넌트 마운트 및 날짜/반 변경 시 임시 상태를 실제 기록으로 초기화
    useEffect(() => {
        setTempAttendanceMap(currentAttendanceMap);
    }, [selectedClassId, selectedDate, students, attendanceLogs]);

    // **새로운 로직:** 저장할 내용이 있는지 확인
    const hasChanges = useCallback(() => {
        // 1. 현재 학생 목록을 기준으로 체크
        const studentIds = classStudents.map(s => s.id);
        
        // 2. tempAttendanceMap과 currentAttendanceMap을 비교
        for (const id of studentIds) {
            const tempStatus = tempAttendanceMap[id] || '미체크';
            const currentStatus = currentAttendanceMap[id] || '미체크';
            
            if (tempStatus !== currentStatus) {
                return true; // 변경 사항 발견
            }
        }
        
        // 3. 임시 맵에 있지만 현재 학생 목록에 없는 (혹은 미체크로 변경되어야 할) 항목 확인
        // 이 로직은 위 2번에서 '미체크'로 비교하므로 충분함
        
        // **중요:** 미체크 항목은 tempAttendanceMap에서 제거되므로,
        // tempMap에 없는 항목이 currentMap에 있다면, 그 항목은 '삭제(미체크)'로 변경된 것이므로 수정 사항임.
        for (const id in currentAttendanceMap) {
            if (tempAttendanceMap[id] === undefined && currentAttendanceMap[id] !== '미체크') {
                return true;
            }
        }
        
        // 위 로직을 단순화하여, 두 객체를 문자열로 비교하는 것이 더 안전하고 간결함 (성능보다는 안정성 우선)
        // 실제로는 handleSaveAttendanceChanges에서 처리할 최종 배열을 생성하여 비교하는 것이 가장 정확하지만,
        // 여기서는 임시 맵과 현재 맵의 상태를 비교하는 것으로 충분합니다.
        
        // 객체 길이와 내용이 동일한지 확인 (keysets 비교)
        const tempKeys = Object.keys(tempAttendanceMap);
        const currentKeys = Object.keys(currentAttendanceMap);
        
        if (tempKeys.length !== currentKeys.length) return true;
        
        for (const key of tempKeys) {
            if (tempAttendanceMap[key] !== currentAttendanceMap[key]) return true;
        }

        return false;
    }, [tempAttendanceMap, currentAttendanceMap, classStudents]);
    
    const isSaveDisabled = !hasChanges();


    // 출결 상태 토글 로직
    const handleAttendanceToggle = (studentId, toggledStatus) => {
        setTempAttendanceMap(prevMap => {
            // 현재 임시 맵의 상태 또는 기존 저장 상태를 가져옴
            const currentStatus = prevMap[studentId] || currentAttendanceMap[studentId] || '미체크';
            
            let newStatus;
            if (currentStatus === toggledStatus) {
                // 이미 선택된 상태를 다시 클릭하면 '미체크'로 토글
                newStatus = '미체크';
            } else {
                // 다른 상태를 클릭하면 해당 상태로 변경
                newStatus = toggledStatus;
            }
            
            // 미체크인 경우 맵에서 키를 제거 (저장 로직에서 미체크는 로그를 삭제하므로)
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
        if (isSaveDisabled) return; // 변경 사항이 없으면 저장하지 않음

        if (!selectedClassId) {
            alert("반을 먼저 선택해주세요.");
            return;
        }

        const changesToSave = classStudents.map(s => ({
            classId: selectedClassId,
            date: selectedDate,
            studentId: s.id,
            // 임시 맵에 있으면 그 값을 사용, 없으면 미체크 (로그 삭제 또는 미생성)
            status: tempAttendanceMap[s.id] || '미체크' 
        }));

        handleSaveAttendance(changesToSave);
        // 저장 후, 임시 맵을 현재 기록 맵으로 다시 동기화하여 버튼 상태를 '저장됨'으로 변경
        setTempAttendanceMap(currentAttendanceMap); 
        alert("출결 기록이 저장되었습니다.");
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

    const getButtonClass = (buttonStatus, studentId) => {
        const currentStatus = tempAttendanceMap[studentId] || currentAttendanceMap[studentId] || '미체크';
        const baseClass = "px-3 py-1 rounded-lg font-semibold text-sm transition duration-150";

        if (buttonStatus === currentStatus) {
            // 활성화 상태
            switch (currentStatus) {
                case '출석': return `${baseClass} bg-green-500 text-white`;
                case '지각': return `${baseClass} bg-yellow-500 text-white`;
                case '동영상보강': return `${baseClass} bg-blue-500 text-white`;
                case '결석': return `${baseClass} bg-red-500 text-white`;
                default: return `${baseClass} bg-gray-500 text-white`;
            }
        }
        // 비활성화 상태
        switch (buttonStatus) {
            case '출석': return `${baseClass} bg-green-100 text-green-700 hover:bg-green-200`;
            case '지각': return `${baseClass} bg-yellow-100 text-yellow-700 hover:bg-yellow-200`;
            case '동영상보강': return `${baseClass} bg-blue-100 text-blue-700 hover:bg-blue-200`;
            case '결석': return `${baseClass} bg-red-100 text-red-700 hover:bg-red-200`;
            default: return `${baseClass} bg-gray-100 text-gray-700 hover:bg-gray-200`;
        }
    };
    
    // 메모 버튼 스타일
    const getMemoButtonClass = (hasMemo) => {
        const baseClass = "p-2 rounded-lg transition duration-150";
        return hasMemo 
            ? `${baseClass} bg-blue-500 text-white hover:bg-blue-600`
            : `${baseClass} bg-gray-200 text-gray-600 hover:bg-gray-300`;
    };


    return (
        <div className="bg-white p-6 rounded-xl shadow-lg space-y-6">
            <h3 className="text-xl font-bold">출석 관리 및 기록</h3>
            <div className="flex justify-between items-center border-b pb-4">
                <div className="flex space-x-4 items-center">
                    <label htmlFor="class-select" className="font-semibold">반 선택:</label>
                    <select 
                        id="class-select" 
                        value={selectedClassId || ''} 
                        onChange={e => setSelectedClassId(Number(e.target.value))} 
                        className="p-2 border rounded-lg"
                    >
                        {!selectedClassId && <option value="" disabled>반을 선택해주세요</option>}
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="p-2 border rounded-lg" />
                </div>
                
                {/* 수정: "출결 저장" 버튼 이름 및 색상 변경 */}
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
            </div>

            <div className="space-y-3">
                {classStudents.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 border rounded-lg">선택된 반에 학생이 없거나, 반이 선택되지 않았습니다.</div>
                ) : (
                    classStudents.map(s => {
                        const hasMemo = !!studentMemos[s.id];

                        return (
                            <div key={s.id} className="flex justify-between items-center p-4 border rounded-xl shadow-sm bg-gray-50">
                                
                                {/* 좌측 영역: 학생 정보 */}
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
                                
                                {/* 우측 영역: 출결 버튼 및 메모 (오른쪽 정렬) */}
                                <div className="flex items-center space-x-2">
                                    
                                    {/* 출결 버튼 그룹 (토글 기능 적용) */}
                                    {ATT_OPTIONS.map(status => (
                                        <button 
                                            key={status}
                                            onClick={() => handleAttendanceToggle(s.id, status)}
                                            className={getButtonClass(status, s.id)}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                    
                                    {/* 메모 버튼 (구현 완료) */}
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
                    })
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
            
            {/* 기존 AttendanceFormModal은 사용하지 않지만, 컴포넌트 정의는 유지함 */}
        </div>
    );
};

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