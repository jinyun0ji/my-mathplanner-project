import React, { useState, useEffect } from 'react';

// --- 데이터 샘플 ---
const initialStudents = [
  { id: 1, name: '김민준', school: '대한고등학교', grade: 2, phone: '010-1234-5678', parentPhone: '010-8765-4321', status: '재원생', registeredDate: '2025-03-05', classes: [1], paymentStatus: '완납', bookReceived: true },
  { id: 2, name: '이서연', school: '민국고등학교', grade: 2, phone: '010-2345-6789', parentPhone: '010-7654-3210', status: '재원생', registeredDate: '2025-03-05', classes: [2], paymentStatus: '미납', bookReceived: false },
  { id: 3, name: '박하준', school: '사랑고등학교', grade: 2, phone: '010-3456-7890', parentPhone: '010-6543-2109', status: '상담생', registeredDate: '2025-02-15', classes: [], paymentStatus: '해당없음', bookReceived: false },
  { id: 4, name: '최지우', school: '대한고등학교', grade: 2, phone: '010-4567-8901', parentPhone: '010-5432-1098', status: '재원생', registeredDate: '2025-03-20', classes: [1], paymentStatus: '완납', bookReceived: true },
  { id: 6, name: '윤채원', school: '대한고등학교', grade: 2, phone: '010-6789-0123', parentPhone: '010-3210-9876', status: '재원생', registeredDate: '2025-08-01', classes: [1], paymentStatus: '완납', bookReceived: false },
  { id: 7, name: '홍길동', school: '상문고등학교', grade: 2, phone: '010-2002-0220', parentPhone: '010-2200-0022', status: '퇴원생', registeredDate: '2025-01-01', classes: [3], paymentStatus: '완납', bookReceived: true },
];

const initialClasses = [
    { id: 1, name: '고2 A1반', teacher: '채수용', students: [1, 6, 4] }, // 학생 추가
    { id: 2, name: '고2 A2반', teacher: '채수용', students: [2] },
    { id: 3, name: '고2 상문고반', teacher: '채수용', students: [] },
];

const initialLessonLogs = [
    { id: 1, classId: 1, date: '2025-06-26', progress: '다항식의 연산 P.12 ~ P.18', homework: 'RPM P.10 ~ P.15', videoUrl: 'https://www.youtube.com/embed/mWkuigsWe4A?si=WxFCjABqFDJSLnYy', materialUrl: '/path/to/material1.pdf', attendance: [{studentId: 1, status: '출석'}, {studentId: 6, status: '결석'}] },
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

// --- 성적 관리를 위한 더미 데이터 ---
const initialTests = [
    { id: 101, name: 'Test 1 (06/15)', maxScore: 100, classId: 1 },
    { id: 102, name: 'Test 2 (07/01)', maxScore: 100, classId: 1 },
    { id: 201, name: 'Test A (06/20)', maxScore: 100, classId: 2 },
];

const initialGrades = {
    // classId 1 학생 성적
    1: { 101: 85, 102: 92 }, // 김민준
    6: { 101: 78, 102: 88 }, // 윤채원
    4: { 101: 95, 102: 95 }, // 최지우
    // classId 2 학생 성적
    2: { 201: 75 }, // 이서연
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
    barChart: <path d="M12 20V10M18 20V4M6 20v-6"/>, // 성적/통계 아이콘
    clipboardCheck: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M10 12L12 14L18 8"/></>, // 출석 체크 아이콘
    bookOpen: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></> // 수업 (Lesson) 관리 아이콘으로 변경
  };
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{icons[name]}</svg>;
};

// --- 메인 앱 컴포넌트 ---
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [page, setPage] = useState('home'); 
  if (!isLoggedIn) return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <Sidebar page={page} setPage={setPage} onLogout={() => setIsLoggedIn(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header page={page} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
          <PageContent page={page} />
        </main>
      </div>
    </div>
  );
}

// --- 레이아웃 및 페이지 라우팅 ---
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

const PageContent = ({ page }) => {
  switch (page) {
    case 'home': return <Home />;
    case 'students': return <StudentManagement />;
    case 'lessons': return <LessonManagement />; 
    case 'attendance': return <AttendanceManagement />; 
    case 'homework': return <HomeworkManagement />;   
    case 'grades': return <GradeManagement />;      
    case 'payment': return <PaymentManagement />;
    case 'notes': return <NotesManagement />;
    case 'internal': return <InternalCommunication />;
    default: return <Home />; 
  }
};

// --- 각 페이지 컴포넌트 ---
const Home = () => <div className="p-6 bg-white rounded-lg shadow-md"><h3 className="text-2xl font-semibold">홈</h3><p>학원 운영의 전반적인 현황을 한눈에 볼 수 있는 주요 정보를 요약하여 제공합니다.</p></div>;

const StudentManagement = () => {
  const getClassesNames = (classIds) => classIds.map(id => initialClasses.find(c => c.id === id)?.name || '').join(', ');
  return (
    <div className="bg-white p-6 rounded-xl shadow-lg">
      <h3 className="text-xl font-bold mb-4">학생 전체 목록</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50">
            <tr>{['이름', '상태', '학교/학년', '학생 연락처', '학부모 연락처', '수강 강좌'].map(h => <th key={h} className="p-4 font-semibold text-gray-600">{h}</th>)}</tr>
          </thead>
          <tbody>
            {initialStudents.map(s => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="p-4 font-medium">{s.name}</td><td className="p-4">{s.status}</td><td className="p-4">{s.school} {s.grade}학년</td>
                <td className="p-4">{s.phone}</td><td className="p-4">{s.parentPhone}</td><td className="p-4">{getClassesNames(s.classes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const LessonManagement = () => {
    const [selectedClassId, setSelectedClassId] = useState(initialClasses[0].id);
    const [lessonLogs] = useState(initialLessonLogs);
    const classLogs = lessonLogs.filter(log => log.classId === selectedClassId);
    return (
        <div className="bg-white p-6 rounded-xl shadow-lg space-y-6">
            <h3 className="text-xl font-bold">수업 일지 관리 (강좌별 진행 기록)</h3>
            <div className="flex justify-between items-center">
                <div>
                    <label htmlFor="class-select" className="mr-2 font-semibold">반 선택:</label>
                    <select id="class-select" value={selectedClassId} onChange={e => setSelectedClassId(Number(e.target.value))} className="p-2 border rounded-lg">
                        {initialClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <button className="flex items-center bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600"><Icon name="plus" className="w-5 h-5 mr-2" /> 새 수업일지 등록</button>
            </div>
            <div className="space-y-4">
                {classLogs.map(log => (
                    <div key={log.id} className="p-4 border rounded-lg shadow-sm">
                        <h4 className="font-bold text-lg text-blue-700">{log.date}</h4>
                        <p><span className="font-semibold">수업 진도:</span> {log.progress}</p>
                        <p><span className="font-semibold">과제 내용:</span> {log.homework}</p>
                        {log.videoUrl && (
                             <div>
                                <p className="font-semibold mt-2">수업 영상:</p>
                                <div className="aspect-video">
                                    <iframe className="w-full h-full rounded-lg" src={log.videoUrl} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                                </div>
                            </div>
                        )}
                        <div>
                            <p className="font-semibold mt-2">출결:</p>
                            <div className="flex flex-wrap gap-4 mt-1">
                                {log.attendance.map(att => {
                                    const student = initialStudents.find(s => s.id === att.studentId);
                                    if (!student) return null; 
                                    return <span key={student.id} className="text-sm">{student.name}: {att.status}</span>
                                })}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AttendanceManagement = () => <div className="p-6 bg-white rounded-lg shadow-md"><h3 className="text-2xl font-semibold">출석 관리</h3><p>이 페이지에서 수업별 학생의 **출석, 결석, 지각** 현황을 기록하고 조회할 수 있습니다.</p></div>;

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
                 <p>날짜별, 학생별 과제 완성도를 A/B/C/미제출로 입력하는 UI가 여기에 표시됩니다.</p>
            </div>
            <hr/>
            <div>
                <h4 className="text-xl font-bold mb-2">과제 문항별 결과 입력 (김민준 학생)</h4>
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

const GradeManagement = () => {
    const [selectedClassId, setSelectedClassId] = useState(initialClasses[0].id);
    const [isCreatingTest, setIsCreatingTest] = useState(false);

    // 선택된 클래스 정보
    const selectedClass = initialClasses.find(c => c.id === selectedClassId);
    
    // 선택된 클래스의 테스트 목록
    const classTests = initialTests.filter(t => t.classId === selectedClassId);

    // 선택된 클래스의 학생 목록
    const classStudents = initialStudents.filter(s => selectedClass?.students.includes(s.id));

    // 테스트별 클래스 평균 점수 계산 함수
    const calculateClassAverages = () => {
        const averages = {};
        if (classStudents.length === 0) return {};

        classTests.forEach(test => {
            let totalScore = 0;
            let studentCount = 0;
            
            classStudents.forEach(student => {
                const score = initialGrades[student.id]?.[test.id];
                if (score !== undefined) {
                    totalScore += score;
                    studentCount++;
                }
            });

            averages[test.id] = studentCount > 0 ? (totalScore / studentCount).toFixed(1) : '-';
        });
        return averages;
    };

    const classAverages = calculateClassAverages();

    if (isCreatingTest) {
        return (
            <div className="p-6 bg-white rounded-lg shadow-md">
                <h3 className="text-2xl font-semibold">테스트 생성 (다음 단계)</h3>
                <p>여기에 테스트 이름, 만점, 문제 수 등을 입력하는 UI가 구현됩니다.</p>
                <button onClick={() => setIsCreatingTest(false)} className="mt-4 bg-gray-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600">취소</button>
            </div>
        );
    }


    return (
        <div className="flex h-[80vh] bg-white rounded-xl shadow-lg overflow-hidden">
            {/* 좌측: 클래스 목록 */}
            <div className="w-64 border-r bg-gray-50 p-4 overflow-y-auto">
                <h4 className="font-bold text-lg mb-4 text-gray-700">클래스 선택</h4>
                <div className="space-y-2">
                    {initialClasses.map(c => (
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
                        onClick={() => setIsCreatingTest(true)} 
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
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-48">학생명</th>
                                    {classTests.map(test => (
                                        <th key={test.id} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase min-w-[120px]">{test.name}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {/* 평균 행 */}
                                <tr className="bg-yellow-50 font-bold text-sm">
                                    <td className="px-6 py-3 whitespace-nowrap text-left text-yellow-800">평균</td>
                                    {classTests.map(test => (
                                        <td key={test.id} className="px-4 py-3 whitespace-nowrap text-center text-yellow-800">
                                            {classAverages[test.id]}
                                        </td>
                                    ))}
                                </tr>
                                {/* 학생 데이터 행 */}
                                {classStudents.map(student => (
                                    <tr key={student.id} className="hover:bg-gray-50 text-sm">
                                        <td className="px-6 py-3 whitespace-nowrap font-medium text-gray-900">{student.name}</td>
                                        {classTests.map(test => {
                                            const score = initialGrades[student.id]?.[test.id] || '-';
                                            return (
                                                <td key={test.id} className="px-4 py-3 whitespace-nowrap text-center">
                                                    {score}
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
