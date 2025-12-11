import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './output.css'; 
import { 
    getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, setLogLevel
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

import { 
    initialStudents, initialClasses, initialLessonLogs, initialAttendanceLogs, 
    initialStudentMemos, initialHomeworkAssignments, initialHomeworkResults, 
    initialTests, initialGrades, initialVideoProgress, initialClinicLogs, 
    initialWorkLogs, initialAnnouncements, initialPayments 
} from './api/initialData'; 
import { 
    calculateClassSessions, calculateGradeComparison, 
    calculateHomeworkStats 
} from './utils/helpers'; 

import LoginPage from './pages/LoginPage';
import Sidebar from './layout/Sidebar';
import Header from './layout/Header';
import NotificationPanel from './layout/NotificationPanel';
import MessengerPanel from './layout/MessengerPanel'; 
import Home from './pages/Home';
import StudentManagement from './pages/StudentManagement';
import StudentDetail from './pages/StudentDetail';
import LessonManagement from './pages/LessonManagement';
import AttendanceManagement from './pages/AttendanceManagement';
import HomeworkManagement from './pages/HomeworkManagement';
import GradeManagement from './pages/GradeManagement';
import ClinicManagement from './pages/ClinicManagement';
import InternalCommunication from './pages/InternalCommunication';
import PaymentManagement from './pages/PaymentManagement';


const firebaseConfig = typeof window.__firebase_config !== 'undefined' ? JSON.parse(window.__firebase_config) : {};
const initialAuthToken = typeof window.__initial_auth_token !== 'undefined' ? window.__initial_auth_token : null; 

let db = null; 
let auth = null; 

try {
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);
    auth = getAuth(firebaseApp);
    setLogLevel('error');
} catch (error) {
    console.error("Firebase initialization error. Using local mock data only:", error);
}

const PageContent = (props) => {
    const { page, selectedStudentId } = props;

    if (page === 'students' && selectedStudentId !== null) {
        return <StudentDetail {...props} studentId={selectedStudentId} />;
    }

    switch (page) {
        case 'home': return <Home />;
        case 'lessons': return <LessonManagement {...props} />;
        case 'attendance': return <AttendanceManagement {...props} />;
        case 'students': return <StudentManagement {...props} />;
        case 'grades': return <GradeManagement {...props} />;
        case 'homework': return <HomeworkManagement {...props} />; 
        case 'clinic': return <ClinicManagement {...props} />;
        case 'communication': return <InternalCommunication {...props} />;
        case 'payment': return <PaymentManagement {...props} />;
        default: return <Home />;
    }
};

// ✅ [추가] 학생용 레이아웃 임시 컴포넌트 (나중에 별도 파일로 분리 예정)
const StudentLayout = ({ studentId, onLogout, students }) => {
    const student = students.find(s => s.id === studentId);
    return (
        <div className="flex flex-col h-screen bg-white">
            <header className="bg-indigo-600 text-white p-4 flex justify-between items-center shadow-md">
                <h1 className="text-lg font-bold">내 공부 플래너</h1>
                <button onClick={onLogout} className="text-sm bg-indigo-800 px-3 py-1 rounded">로그아웃</button>
            </header>
            <main className="flex-1 p-6 overflow-y-auto">
                <h2 className="text-2xl font-bold mb-4">안녕하세요, {student ? student.name : '학생'}님!</h2>
                <div className="grid grid-cols-1 gap-4">
                    <div className="p-6 bg-blue-50 rounded-xl border border-blue-100">
                        <h3 className="font-bold text-blue-900 mb-2">오늘의 수업</h3>
                        <p className="text-gray-600">등록된 수업 일정이 없습니다.</p>
                    </div>
                    <div className="p-6 bg-green-50 rounded-xl border border-green-100">
                        <h3 className="font-bold text-green-900 mb-2">최근 성적</h3>
                         <p className="text-gray-600">확인할 성적표가 있습니다.</p>
                    </div>
                </div>
            </main>
            {/* 하단 탭바 (앱 스타일) */}
            <nav className="bg-white border-t border-gray-200 flex justify-around p-3 text-xs text-gray-500">
                <button className="flex flex-col items-center text-indigo-600 font-bold">
                    <span>🏠</span><span>홈</span>
                </button>
                <button className="flex flex-col items-center">
                    <span>📅</span><span>출결</span>
                </button>
                <button className="flex flex-col items-center">
                    <span>📝</span><span>과제</span>
                </button>
                <button className="flex flex-col items-center">
                    <span>📊</span><span>성적</span>
                </button>
            </nav>
        </div>
    );
};

export default function App() { 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [page, setPage] = useState('lessons'); 
  const [selectedStudentId, setSelectedStudentId] = useState(null); 
  const [notifications, setNotifications] = useState([]); 
  const [userId, setUserId] = useState(null); 

  const [isGlobalDirty, setIsGlobalDirty] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

  // --- 중앙 상태 관리 (임시 데이터) ---
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
  
  // ✅ 사이드바(알림) 및 메신저 상태 관리
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(true);
  
  const [isMessengerOpen, setIsMessengerOpen] = useState(false); 
  const [hasNewMessages, setHasNewMessages] = useState(true); 

  // 알림 토글 (메신저가 열려있으면 닫음)
  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
    if (!isSidebarOpen) { 
        setHasNewNotifications(false); 
        setIsMessengerOpen(false); // 메신저 닫기
    }
  };

  // 메신저 토글 (알림이 열려있으면 닫음)
  const toggleMessenger = () => {
    setIsMessengerOpen(prev => !prev);
    if (!isMessengerOpen) {
        setHasNewMessages(false);
        setIsSidebarOpen(false); // 알림 닫기
    }
  };

  useEffect(() => {
    if (auth) {
        const handleAuth = async () => {
            try {
                if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken);
                else await signInAnonymously(auth);
            } catch (e) {
                console.error("Firebase Auth sign-in failed:", e);
            }
        };
        handleAuth();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) { setUserId(user.uid); setIsLoggedIn(true); } 
            else { setUserId(null); setIsLoggedIn(true); }
        });
        return () => unsubscribe();
    } else {
        setIsLoggedIn(true);
        setUserId('mock-user');
    }
  }, []); 

  useEffect(() => {
    const handleBeforeUnload = (e) => {
        if (isGlobalDirty) {
            e.preventDefault();
            e.returnValue = ''; 
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isGlobalDirty]);

    const logNotification = useCallback((type, message, details) => {
        setNotifications(prev => [{ id: Date.now(), type, message, details, timestamp: new Date().toLocaleTimeString('ko-KR') }, ...prev]);
    }, []);

  // ... (CRUD 함수들은 기존과 동일하므로 생략하지 않고 전체 코드 유지) ...
  const handleSaveClass = (classData, isEdit) => {
    setClasses(prev => isEdit ? prev.map(c => c.id === classData.id ? { ...c, ...classData } : c) : [...prev, { ...classData, id: prev.reduce((max, c) => Math.max(max, c.id), 0) + 1, students: [] }]);
    if(!isEdit) logNotification('success', '클래스 등록 성공', `${classData.name} 클래스가 새로 등록되었습니다.`);
  };

  const getClassesNames = useCallback((classIds) => classIds.map(id => classes.find(c => c.id === id)?.name || '').join(', '), [classes]);
  
  const handleSaveStudent = (newStudentData, isEdit) => {
    setStudents(prev => {
        if (isEdit) {
            logNotification('success', '학생 정보 수정 완료', `${newStudentData.name} 학생 정보가 업데이트되었습니다.`);
            return prev.map(s => s.id === newStudentData.id ? { ...s, ...newStudentData } : s);
        }
        const newStudent = { ...newStudentData, id: nextStudentId, registeredDate: new Date().toISOString().slice(0, 10), books: [] };
        logNotification('success', '학생 등록 완료', `${newStudent.name} 학생이 새로 등록되었습니다.`);
        return [...prev, newStudent];
    });

    setClasses(prev => prev.map(cls => {
        const isSelected = newStudentData.classes.includes(cls.id);
        const isMember = cls.students.includes(newStudentData.id);
        if (isSelected && !isMember) return { ...cls, students: [...cls.students, newStudentData.id] };
        else if (!isSelected && isMember) return { ...cls, students: cls.students.filter(id => id !== newStudentData.id) };
        return cls;
    }));
  };

  const handleDeleteStudent = (id) => {
    setStudents(prev => prev.filter(s => s.id !== id));
    setClasses(prev => prev.map(cls => ({ ...cls, students: cls.students.filter(sId => sId !== id) })));
  };
  
  const handleSaveMemo = (studentId, content) => setStudentMemos(prev => ({ ...prev, [studentId]: content }));

  const handleSaveLessonLog = (logData, isEdit) => {
    setLessonLogs(prev => isEdit ? prev.map(log => log.id === logData.id ? { ...log, ...logData } : log) : [...prev, { ...logData, id: prev.reduce((max, log) => Math.max(max, log.id), 0) + 1 }]);
  };
  const handleDeleteLessonLog = (logId) => setLessonLogs(prev => prev.filter(log => log.id !== logId));
  
  const handleSaveAttendance = (attendanceRecords) => {
    setAttendanceLogs(prev => {
        const newLogs = [...prev];
        attendanceRecords.forEach(record => {
            const existingIndex = newLogs.findIndex(log => log.classId === record.classId && log.date === record.date && log.studentId === record.studentId);
            if (existingIndex > -1) newLogs[existingIndex] = record;
            else newLogs.push({ ...record, id: newLogs.reduce((max, l) => Math.max(max, l.id || 0), 0) + 1 });
        });
        return newLogs;
    });
    logNotification('success', '출결 기록 저장', `총 ${attendanceRecords.length}건의 출결 기록이 업데이트되었습니다.`);
  };

  const handleSaveHomeworkAssignment = (assignmentData, isEdit) => {
    setHomeworkAssignments(prev => isEdit ? prev.map(a => a.id === assignmentData.id ? { ...a, ...assignmentData } : a) : [...prev, { ...assignmentData, id: prev.reduce((max, a) => Math.max(max, a.id), 0) + 1 }]);
  };
  const handleDeleteHomeworkAssignment = (assignmentId) => setHomeworkAssignments(prev => prev.filter(a => a.id !== assignmentId));
  
  const handleUpdateHomeworkResult = (updates) => {
    setHomeworkResults(prev => {
        const newResults = { ...prev };
        updates.forEach(({ studentId, assignmentId, questionId, status }) => {
            if (!newResults[studentId]) newResults[studentId] = {};
            if (!newResults[studentId][assignmentId]) newResults[studentId][assignmentId] = {};
            if (status) newResults[studentId][assignmentId][questionId] = status;
            else delete newResults[studentId][assignmentId][questionId];
            if (Object.keys(newResults[studentId][assignmentId]).length === 0) delete newResults[studentId][assignmentId];
        });
        return newResults;
    });
  };

  const handleSaveTest = (testData, isEdit) => {
    setTests(prev => isEdit ? prev.map(t => t.id === testData.id ? { ...t, ...testData } : t) : [...prev, { ...testData, id: prev.reduce((max, t) => Math.max(max, t.id), 0) + 1 }]);
  };

  const handleDeleteTest = (testId) => {
    setTests(prev => prev.filter(t => t.id !== testId));
    setGrades(prev => {
        const newGrades = {};
        for (const studentId in prev) {
            const studentGrades = { ...prev[studentId] };
            delete studentGrades[testId];
            newGrades[studentId] = studentGrades;
        }
        return newGrades;
    });
  };

  const handleUpdateGrade = (studentId, testId, resultMapping, comment = '') => { 
    const test = tests.find(t => t.id === testId);
    if (!test) return;
    let totalScore = 0;
    if (resultMapping === '미응시') totalScore = null; 
    else if (resultMapping) {
        Object.keys(resultMapping).forEach(qNum => {
            if (resultMapping[qNum] === '맞음' || resultMapping[qNum] === '고침') totalScore += (test.questionScores[Number(qNum) - 1] || 0);
        });
    }

    setGrades(prev => ({
        ...prev,
        [studentId]: {
            ...prev[studentId],
            [testId]: { score: totalScore, correctCount: resultMapping, comment: comment }
        }
    }));
    logNotification('info', '성적 저장', `${students.find(s => s.id === studentId)?.name || '학생'}의 성적(${test.name})이 저장되었습니다.`);
  };
  
  const handleSaveAnnouncement = (announcementData, isEdit) => {
    setAnnouncements(prev => isEdit ? prev.map(a => a.id === announcementData.id ? { ...a, ...announcementData } : a) : [...prev, { ...announcementData, id: prev.reduce((max, a) => Math.max(max, a.id), 0) + 1, author: '관리자', date: new Date().toISOString().slice(0, 10) }]);
  }

  const handleSaveWorkLog = (logData, isEdit) => {
    setWorkLogs(prev => isEdit ? prev.map(log => log.id === logData.id ? { ...log, ...logData } : log) : [...prev, { ...logData, id: prev.reduce((max, l) => Math.max(max, l.id), 0) + 1, author: '채수용', date: new Date().toISOString().slice(0, 10) }]);
  };
  const handleDeleteWorkLog = (id) => setWorkLogs(prev => prev.filter(log => log.id !== id));

  const handleSaveClinicLog = (logData, isEdit) => {
    setClinicLogs(prev => isEdit ? prev.map(log => log.id === logData.id ? { ...log, ...logData } : log) : [...prev, { ...logData, id: prev.reduce((max, l) => Math.max(max, l.id), 0) + 1 }]);
  };
  const handleDeleteClinicLog = (id) => setClinicLogs(prev => prev.filter(log => log.id !== id));
  
  if (!isLoggedIn) return <LoginPage onLogin={() => setIsLoggedIn(true)} />;

  const handlePageChange = (newPage, studentId = null, resetSearch = false) => {
       if (isGlobalDirty) {
           if (!window.confirm('저장되지 않은 변경사항이 있습니다. 정말 이동하시겠습니까?\n(이동 시 변경사항은 사라집니다)')) {
               return; 
           }
           setIsGlobalDirty(false); 
       }

       if (newPage === 'students' && studentId === null) {
           setSelectedStudentId(null);
           if (resetSearch) {
               setStudentSearchTerm('');
           }
       } else {
           setSelectedStudentId(studentId);
       }
       setPage(newPage);
  }
  
  const managementProps = {
    students, classes, lessonLogs, attendanceLogs, workLogs, clinicLogs, 
    homeworkAssignments, homeworkResults, tests, grades, studentMemos, videoProgress, announcements, 
    setAnnouncements, getClassesNames,
    handleSaveStudent, handleDeleteStudent, handleSaveClass, handleSaveLessonLog, handleDeleteLessonLog,
    handleSaveAttendance, handleSaveHomeworkAssignment, handleDeleteHomeworkAssignment, handleUpdateHomeworkResult,
    handleSaveTest, handleDeleteTest, handleUpdateGrade, handleSaveMemo, 
    handleSaveAnnouncement, handleSaveWorkLog, handleDeleteWorkLog, handleSaveClinicLog, handleDeleteClinicLog, 
    calculateClassSessions, selectedStudentId, handlePageChange, logNotification, notifications, 
    calculateGradeComparison, calculateHomeworkStats,
    setIsGlobalDirty,
    studentSearchTerm, setStudentSearchTerm 
  };

  // ✅ [수정] 로그인 핸들러 수정
  const handleLoginSuccess = (role, id) => {
      setIsLoggedIn(true);
      setUserRole(role);
      setUserId(id);
      
      // 학생으로 로그인 시, 선택된 학생 ID를 본인으로 설정
      if (role === 'student') {
          setSelectedStudentId(id);
      }
  };

  // ✅ [수정] 조건부 렌더링
  if (!isLoggedIn) {
      return <LoginPage onLogin={handleLoginSuccess} />;
  }

  // 1. 학생인 경우 학생용 레이아웃 렌더링
  if (userRole === 'student') {
      return <StudentLayout studentId={userId} onLogout={() => setIsLoggedIn(false)} students={students} />;
  }
  
  // 2. 학부모인 경우 (일단 학생용과 동일하게 처리하거나 추후 분리)
  if (userRole === 'parent') {
      return <div className="p-10 text-center">학부모용 페이지 준비중입니다. <button onClick={() => setIsLoggedIn(false)} className="text-blue-500 underline">로그아웃</button></div>;
  }

  // 3. 직원은 기존 레이아웃(Sidebar + Header + Main) 유지
  return (
  <div className="flex h-screen bg-gray-100 font-sans text-base relative"> 
    <Sidebar page={page} setPage={handlePageChange} onLogout={() => setIsLoggedIn(false)} />
    {/* ... (기존 직원용 JSX 그대로 유지) ... */}
     <div className={`flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-300 ease-in-out ${isSidebarOpen || isMessengerOpen ? 'mr-80' : 'mr-0'}`}>
      <Header page={page} />
      <main id="main-content" className="overflow-x-hidden overflow-y-auto bg-gray-100 p-6 min-w-0">
        <PageContent page={page} {...managementProps} />
      </main>
    </div>
    
    <NotificationPanel 
      notifications={notifications} 
      isSidebarOpen={isSidebarOpen} 
      toggleSidebar={toggleSidebar} 
      hasNewNotifications={hasNewNotifications} 
      setHasNewNotifications={setHasNewNotifications} 
    />

    <MessengerPanel 
      isMessengerOpen={isMessengerOpen}
      toggleMessenger={toggleMessenger}
      hasNewMessages={hasNewMessages}
      setHasNewMessages={setHasNewMessages}
      isSidebarOpen={isSidebarOpen} 
      students={students} 
      classes={classes} 
    />
  </div>
  );
}