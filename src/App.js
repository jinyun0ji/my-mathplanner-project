import React, { useState, useEffect, useCallback } from 'react';

// --- 데이터 샘플 (변경 없음) ---
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
    { id: 1, classId: 1, date: '2025-06-26', progress: '다항식의 연산 P.12 ~ P.18', homework: 'RPM P.10 ~ P.15', videoUrl: 'https://www.youtube.com/embed/mWkuigsWe4A?si=WxFCjABqFDJSLnYy', materialUrl: '/path/to/material1.pdf', attendance: [{studentId: 1, status: '출석'}, {studentId: 6, status: '결석'}, {studentId: 4, status: '출석'}] },
    { id: 2, classId: 2, date: '2025-06-27', progress: '집합의 개념 및 포함 관계', homework: '개념원리 P.20 ~ P.25', videoUrl: '', materialUrl: '', attendance: [{studentId: 2, status: '지각'}] },
];

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
    // studentId: { testId: score }
    1: { 101: 85, 102: 92 }, // 김민준
    6: { 101: 78, 102: 88 }, // 윤채원
    4: { 101: 95, 102: 95 }, // 최지우
    2: { 201: 75 }, // 이서연
    5: {}, // 정다은
};


// --- 아이콘 컴포넌트 (생략 안함) ---
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

// 모달 백드롭 (변경 없음)
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

// 학생 추가/수정 모달 (수정됨: useEffect를 사용하여 student prop 변경 시 폼 데이터 초기화)
const StudentFormModal = ({ isOpen, onClose, student = null, allClasses, onSave }) => {
    const isEdit = !!student;
    
    // student prop이 변경될 때마다 form state를 초기화
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

// 테스트 생성/수정 모달 (변경 없음)
const TestFormModal = ({ isOpen, onClose, onSave, classId, test = null }) => {
    const isEdit = !!test;
    const [name, setName] = useState(test?.name || '');
    const [maxScore, setMaxScore] = useState(test?.maxScore || 100);

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

// 수업 일지 등록/수정 모달 (변경 없음)
const LessonLogFormModal = ({ isOpen, onClose, onSave, classId, students, log = null }) => {
    const isEdit = !!log;
    const initialAttendance = log?.attendance.reduce((acc, curr) => ({ ...acc, [curr.studentId]: curr.status }), {}) || {};

    const [formData, setFormData] = useState({
        date: log?.date || new Date().toISOString().slice(0, 10),
        progress: log?.progress || '',
        homework: log?.homework || '',
        videoUrl: log?.videoUrl || '',
        attendance: initialAttendance
    });
    
    useEffect(() => {
        // Log prop이 변경될 때마다 폼 상태를 업데이트
        setFormData({
            date: log?.date || new Date().toISOString().slice(0, 10),
            progress: log?.progress || '',
            homework: log?.homework || '',
            videoUrl: log?.videoUrl || '',
            attendance: log?.attendance.reduce((acc, curr) => ({ ...acc, [curr.studentId]: curr.status }), {}) || {}
        });
    }, [log]);


    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAttendanceChange = (studentId, status) => {
        setFormData(prev => ({
            ...prev,
            attendance: { ...prev.attendance, [studentId]: status }
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // attendance 배열 포맷으로 변환
        const finalAttendance = students.map(s => ({
            studentId: s.id,
            status: formData.attendance[s.id] || '미체크' // 기본값 설정
        }));

        const dataToSave = {
            id: isEdit ? log.id : Date.now(),
            classId,
            date: formData.date,
            progress: formData.progress,
            homework: formData.homework,
            videoUrl: formData.videoUrl,
            materialUrl: log?.materialUrl || '', // 자료 URL은 일단 수정 불가
            attendance: finalAttendance
        };

        onSave(dataToSave, isEdit);
        onClose();
    };

    const attendanceOptions = ['출석', '결석', '지각', '조퇴', '미체크'];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `${formData.date} 수업 일지 수정` : '새 수업 일지 등록'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input type="date" name="date" value={formData.date} onChange={handleChange} required className="p-2 border rounded w-full" />
                <input type="text" name="progress" value={formData.progress} onChange={handleChange} placeholder="수업 진도 (예: 다항식의 연산 P.12 ~ P.18)" required className="p-2 border rounded w-full" />
                <input type="text" name="homework" value={formData.homework} onChange={handleChange} placeholder="과제 내용 (예: RPM P.10 ~ P.15)" required className="p-2 border rounded w-full" />
                <input type="url" name="videoUrl" value={formData.videoUrl} onChange={handleChange} placeholder="보충/복습 영상 URL (선택 사항)" className="p-2 border rounded w-full" />

                <div className="border p-3 rounded-lg">
                    <label className="block font-semibold mb-2">출결 체크:</label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {students.map(s => (
                            <div key={s.id} className="flex items-center justify-between p-2 border-b last:border-b-0">
                                <span className="font-medium w-24">{s.name}</span>
                                <select 
                                    value={formData.attendance[s.id] || '미체크'} 
                                    onChange={(e) => handleAttendanceChange(s.id, e.target.value)} 
                                    className="p-1 border rounded text-sm"
                                >
                                    {attendanceOptions.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>

                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700">
                    {isEdit ? '일지 수정' : '일지 등록'}
                </button>
            </form>
        </Modal>
    );
};


// --- 메인 앱 컴포넌트: 모든 상태와 CRUD 로직을 관리하는 중앙 허브 (변경 없음) ---
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [page, setPage] = useState('home'); 

  // --- 중앙 상태 관리 ---
  const [students, setStudents] = useState(initialStudents);
  const [classes, setClasses] = useState(initialClasses);
  const [lessonLogs, setLessonLogs] = useState(initialLessonLogs);
  const [tests, setTests] = useState(initialTests);
  const [grades, setGrades] = useState(initialGrades);
  
  // 다음 ID를 위한 간단한 카운터
  const nextStudentId = students.reduce((max, s) => Math.max(max, s.id), 0) + 1;


  // --- CRUD 함수: 학생 관리 (변경 없음) ---
  const getClassesNames = useCallback((classIds) => classIds.map(id => classes.find(c => c.id === id)?.name || '').join(', '), [classes]);
  
  const handleSaveStudent = (newStudentData, idToUpdate) => {
    if (idToUpdate) {
        // 수정
        setStudents(prev => prev.map(s => s.id === idToUpdate ? { ...s, ...newStudentData } : s));
        
        // 클래스 멤버십 업데이트 (추가/제거된 클래스 반영)
        const oldStudent = students.find(s => s.id === idToUpdate);
        
        setClasses(prevClasses => prevClasses.map(cls => {
            const isNowInClass = newStudentData.classes.includes(cls.id);
            const wasInClass = oldStudent.classes.includes(cls.id);

            if (isNowInClass && !wasInClass) {
                // 클래스 추가
                return { ...cls, students: [...cls.students, idToUpdate] };
            } else if (!isNowInClass && wasInClass) {
                // 클래스 제거
                return { ...cls, students: cls.students.filter(sid => sid !== idToUpdate) };
            }
            return cls;
        }));

    } else {
        // 등록
        const newStudent = { ...newStudentData, id: nextStudentId, registeredDate: new Date().toISOString().slice(0, 10), paymentStatus: '해당없음', bookReceived: false };
        setStudents(prev => [...prev, newStudent]);
        setGrades(prev => ({ ...prev, [newStudent.id]: {} }));

        // 클래스 멤버십 업데이트 (새 학생 추가)
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
    }
  };

  // --- CRUD 함수: 수업 일지 관리 (변경 없음) ---
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

  // --- CRUD 함수: 성적 및 테스트 관리 (변경 없음) ---
  const handleSaveTest = (testData, isEdit) => {
    if (isEdit) {
        setTests(prev => prev.map(t => t.id === testData.id ? testData : t));
    } else {
        setTests(prev => [...prev, testData]);
        // 새 테스트가 추가되었으므로 모든 학생의 성적 객체에 빈 값으로 초기화 (선택 사항)
    }
  };

  const handleDeleteTest = (testId) => {
    if (window.confirm('해당 테스트를 삭제하시겠습니까? 관련 성적 데이터도 함께 삭제됩니다.')) {
        setTests(prev => prev.filter(t => t.id !== testId));
        
        // 관련 성적 삭제
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
    students, classes, lessonLogs, tests, grades,
    getClassesNames,
    handleSaveStudent, handleDeleteStudent,
    handleSaveLessonLog, handleDeleteLessonLog,
    handleSaveTest, handleDeleteTest, handleUpdateGrade,
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
  
  const isSubPageActive = (parentItem) => parentItem.subItems && parentItem.subItems.some(sub => sub.id === page);

  return (
    <div className="w-64 bg-white text-gray-800 flex flex-col shadow-lg">
      <div className="h-20 flex items-center justify-center border-b"><h1 className="text-2xl font-bold text-blue-600">Math-Planner</h1></div>
      <nav className="flex-1 px-4 py-4 space-y-2">
        {navItems.map(item => (
          <React.Fragment key={item.id}>
            {/* 상위 메뉴 버튼 */}
            <button 
                onClick={() => setPage(item.isParent ? (item.subItems[0]?.id || item.id) : item.id)} 
                className={`w-full flex items-center px-4 py-3 text-left text-base rounded-lg transition-all duration-200 ${page === item.id || isSubPageActive(item) ? 'bg-blue-500 text-white shadow-md' : 'text-gray-600 hover:bg-blue-100 hover:text-blue-600'}`}
            >
              <Icon name={item.icon} className="w-6 h-6 mr-4" /><span>{item.name}</span>
            </button>
            
            {/* 하위 메뉴 (클래스 관리인 경우에만 표시) */}
            {item.isParent && isSubPageActive(item) && (
                <div className="pl-8 space-y-1">
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
    case 'attendance': return <AttendanceManagement />; 
    case 'homework': return <HomeworkManagement />;   
    case 'grades': return <GradeManagement {...props} />;      
    case 'payment': return <PaymentManagement />;
    case 'notes': return <NotesManagement />;
    case 'internal': return <InternalCommunication />;
    default: return <Home />; 
  }
};

// --- 각 페이지 컴포넌트 ---
const Home = () => <div className="p-6 bg-white rounded-lg shadow-md"><h3 className="text-2xl font-semibold">홈</h3><p>학원 운영의 전반적인 현황을 한눈에 볼 수 있는 주요 정보를 요약하여 제공합니다.</p></div>;

// StudentManagement (수정됨: 연락처 표시 방식 변경)
const StudentManagement = ({ students, classes, getClassesNames, handleSaveStudent, handleDeleteStudent }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('전체');

    const handleEdit = (student) => {
        setEditingStudent(student);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingStudent(null);
        setIsModalOpen(false);
    };

    // 검색 및 필터링 로직
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
                    onClick={() => { setEditingStudent(null); setIsModalOpen(true); }} // 등록 버튼 클릭 시 editingStudent 초기화
                    className="flex items-center bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition duration-200"
                >
                    <Icon name="plus" className="w-5 h-5 mr-2" /> 학생 등록
                </button>
            </div>

            {/* 검색 및 필터링 UI */}
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
                            {['이름', '상태', '학교/학년', '수강 강좌', '연락처 (학생/학부모)', '관리'].map(h => <th key={h} className="p-4 font-semibold text-gray-600">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredStudents.map(s => (
                            <tr key={s.id} className="hover:bg-gray-50">
                                <td className="p-4 font-medium">{s.name}</td>
                                <td className={`p-4 font-semibold ${s.status === '재원생' ? 'text-green-600' : s.status === '상담생' ? 'text-blue-500' : 'text-red-500'}`}>{s.status}</td>
                                <td className="p-4">{s.school} {s.grade}학년</td>
                                <td className="p-4">{getClassesNames(s.classes)}</td>
                                {/* 연락처 표시 개선 */}
                                <td className="p-4 text-sm">
                                    <p className="font-medium">학생: {s.phone}</p>
                                    <p className="text-gray-500">학부모: {s.parentPhone}</p>
                                </td>
                                <td className="p-4 flex space-x-2">
                                    <button onClick={() => handleEdit(s)} className="text-blue-500 hover:text-blue-700" title="수정"><Icon name="edit" className="w-5 h-5" /></button>
                                    <button onClick={() => handleDeleteStudent(s.id)} className="text-red-500 hover:text-red-700" title="삭제"><Icon name="trash" className="w-5 h-5" /></button>
                                </td>
                            </tr>
                        ))}
                        {filteredStudents.length === 0 && (
                            <tr><td colSpan="6" className="p-4 text-center text-gray-500">검색 결과가 없습니다.</td></tr>
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
        </div>
    );
};

// LessonManagement (변경 없음)
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
            <h3 className="text-xl font-bold">수업 일지 관리 (강좌별 진행 기록)</h3>
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
                            <p><span className="font-semibold">과제 내용:</span> {log.homework}</p>
                            {log.videoUrl && (
                                <div className="mt-2">
                                    <p className="font-semibold">수업 영상:</p>
                                    <a href={log.videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm truncate block">{log.videoUrl}</a>
                                </div>
                            )}
                            <div className="mt-3 border-t pt-2">
                                <p className="font-semibold">출결:</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm">
                                    {log.attendance.map(att => {
                                        const student = students.find(s => s.id === att.studentId);
                                        if (!student) return null; 
                                        const color = att.status === '결석' ? 'text-red-600' : att.status === '지각' ? 'text-yellow-600' : att.status === '출석' ? 'text-green-600' : 'text-gray-500';
                                        return <span key={student.id} className={`font-medium ${color}`}>{student.name}: {att.status}</span>
                                    })}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <LessonLogFormModal 
                isOpen={isModalOpen} 
                onClose={handleCloseModal} 
                onSave={handleSaveLessonLog} 
                classId={selectedClassId} 
                students={classStudents}
                log={editingLog}
            />
        </div>
    );
};

const AttendanceManagement = () => <div className="p-6 bg-white rounded-lg shadow-md"><h3 className="text-2xl font-semibold">출석 관리</h3><p>이 페이지에서 수업별 학생의 **출석, 결석, 지각** 현황을 기록하고 조회할 수 있습니다. (수업 일지 등록 모달에 이미 출석 기능이 포함되어 있습니다.)</p></div>;

const HomeworkManagement = () => {
    const [hwResults, setHwResults] = useState({ studentId: 1, date: '2024-05-27', problems: [1,2,3,2,1,1,0,0,3,1] });
    const updateHwResult = (index, value) => {
        const newResults = [...hwResults.problems];
        newResults[index] = value;
        setHwResults({...hwResults, problems: newResults});
    }
    return (
        <div className="bg-white p-6 rounded-xl shadow-lg space-y-6">
            <h3 className="text-2xl font-semibold mb-4">과제 관리</h3>
            <div>
                <h4 className="text-xl font-bold mb-2">일일 과제 등급 입력 (A/B/C/미제출)</h4>
                 <p className="mb-4">날짜별, 학생별 과제 완성도를 A/B/C/미제출로 입력하는 UI가 여기에 표시됩니다. (구현 예정)</p>
            </div>
            <hr/>
            <div>
                <h4 className="text-xl font-bold mb-2">과제 문항별 결과 입력 (김민준 학생)</h4>
                <p className="text-sm text-gray-500 mb-3">0: 안품, 1: 맞음, 2: 틀림, 3: 고침</p>
                <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                    {hwResults.problems.map((status, index) => (
                        <div key={index} className="flex flex-col items-center p-2 border rounded">
                           <span className="font-semibold text-sm">{index + 1}번</span>
                           <select value={status} onChange={e => updateHwResult(index, Number(e.target.value))} className="mt-1 w-full text-sm p-1 rounded border">
                               <option value="0">안품</option><option value="1">맞음</option><option value="2">틀림</option><option value="3">고침</option>
                           </select>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

const GradeManagement = ({ students, classes, tests, grades, handleSaveTest, handleDeleteTest, handleUpdateGrade }) => {
    const [selectedClassId, setSelectedClassId] = useState(initialClasses[0].id);
    const [isTestModalOpen, setIsTestModalOpen] = useState(false);
    const [editingTest, setEditingTest] = useState(null);

    // 선택된 클래스 정보
    const selectedClass = classes.find(c => c.id === selectedClassId);
    
    // 선택된 클래스의 테스트 목록 (최신순)
    const classTests = tests.filter(t => t.classId === selectedClassId).sort((a, b) => b.id - a.id);

    // 선택된 클래스의 학생 목록
    const classStudents = students.filter(s => selectedClass?.students.includes(s.id));

    // 테스트별 클래스 평균 점수 계산 함수
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
        // 숫자 또는 빈 문자열만 허용
        if (value === '' || (/^\d*$/.test(value) && value.length <= 3)) {
            handleUpdateGrade(studentId, testId, value);
        }
    }


    return (
        <div className="flex h-[80vh] bg-white rounded-xl shadow-lg overflow-hidden">
            {/* 좌측: 클래스 목록 */}
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

            {/* 우측: 성적 테이블 및 기능 버튼 */}
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
                            {/* 테이블 헤더 */}
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
                                {/* 평균 행 */}
                                <tr className="bg-yellow-50 font-bold text-sm sticky top-[70px] z-5">
                                    <td className="px-6 py-3 whitespace-nowrap text-left text-yellow-800 sticky left-0 bg-yellow-50 z-10">평균</td>
                                    {classTests.map(test => (
                                        <td key={test.id} className="px-4 py-3 whitespace-nowrap text-center text-yellow-800">
                                            {classAverages[test.id]}
                                        </td>
                                    ))}
                                </tr>
                                {/* 학생 데이터 행 */}
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
                                                        type="text" // 숫자를 입력하지만, 빈 문자열 처리를 위해 text 타입 사용
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