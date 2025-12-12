// src/App.jsx
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
    initialWorkLogs, initialAnnouncements, initialPayments,
    initialExternalSchedules
} from './api/initialData'; 
import { 
    calculateClassSessions, calculateGradeComparison, 
    calculateHomeworkStats 
} from './utils/helpers'; 

import LoginPage from './pages/LoginPage';
import StudentHome from './pages/StudentHome'; 
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

export default function App() { 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null); 
  const [userId, setUserId] = useState(null); 
  
  const [page, setPage] = useState('lessons'); 
  const [selectedStudentId, setSelectedStudentId] = useState(null); 
  const [notifications, setNotifications] = useState([]); 

  const [isGlobalDirty, setIsGlobalDirty] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

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
  
  // ✅ [수정] 북마크 상태 (LocalStorage 연동)
  // 브라우저에 저장된 값이 있으면 불러오고, 없으면 빈 객체로 초기화
  const [videoBookmarks, setVideoBookmarks] = useState(() => {
      try {
          const saved = localStorage.getItem('videoBookmarks');
          return saved ? JSON.parse(saved) : {};
      } catch (e) {
          console.error("Failed to load bookmarks:", e);
          return {};
      }
  });

  // ✅ [추가] 북마크 상태가 변경될 때마다 LocalStorage에 저장
  useEffect(() => {
      try {
          localStorage.setItem('videoBookmarks', JSON.stringify(videoBookmarks));
      } catch (e) {
          console.error("Failed to save bookmarks:", e);
      }
  }, [videoBookmarks]);

  const [announcements, setAnnouncements] = useState(initialAnnouncements); 
  const [clinicLogs, setClinicLogs] = useState(initialClinicLogs); 
  const [workLogs, setWorkLogs] = useState(initialWorkLogs); 
  
  const [externalSchedules, setExternalSchedules] = useState(initialExternalSchedules);
  
  const [studentMessages, setStudentMessages] = useState([
      { id: 1, sender: '채수용 선생님', text: '철수야, 오늘 클리닉 늦을 것 같니?', date: '2025-11-29', time: '13:50', isMe: false },
      { id: 2, sender: '나', text: '네 ㅠㅠ 학교 행사가 있어서 30분 정도 늦을 것 같아요.', date: '2025-11-29', time: '13:52', isMe: true },
      { id: 3, sender: '채수용 선생님', text: '알겠어. 조심히 오렴!', date: '2025-11-29', time: '13:53', isMe: false },
  ]);
  
  const nextStudentId = students.reduce((max, s) => Math.max(max, s.id), 0) + 1; 
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(true);
  const [isMessengerOpen, setIsMessengerOpen] = useState(false); 
  const [hasNewMessages, setHasNewMessages] = useState(true); 

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
    if (!isSidebarOpen) { 
        setHasNewNotifications(false); 
        setIsMessengerOpen(false); 
    }
  };

  const toggleMessenger = () => {
    setIsMessengerOpen(prev => !prev);
    if (!isMessengerOpen) {
        setHasNewMessages(false);
        setIsSidebarOpen(false); 
    }
  };

  // ✅ [유지] 로그인 권한 확인 코드 (절대 삭제 안 함)
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
            if (user) { setUserId(user.uid); } 
        });
        return () => unsubscribe();
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

  // ... (기존 CRUD 함수들) ...
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
  
  // ✅ 비디오 진도율 저장
  const handleSaveVideoProgress = (studentId, lessonId, data) => {
      setVideoProgress(prev => {
          const studentData = prev[studentId] || {};
          const prevLessonData = studentData[lessonId] || { percent: 0, seconds: 0 };
          
          return {
              ...prev,
              [studentId]: {
                  ...studentData,
                  [lessonId]: {
                      percent: Math.max(prevLessonData.percent || 0, data.percent),
                      seconds: data.seconds 
                  }
              }
          };
      });
  };

  // ✅ 북마크 저장 함수
  const handleSaveBookmark = (studentId, lessonId, bookmark) => {
      setVideoBookmarks(prev => {
          const studentData = prev[studentId] || {};
          const lessonBookmarks = studentData[lessonId] || [];
          return {
              ...prev,
              [studentId]: {
                  ...studentData,
                  [lessonId]: [...lessonBookmarks, bookmark]
              }
          };
      });
  };

  const handleSaveExternalSchedule = (newSchedule) => {
      setExternalSchedules(prev => {
          if (newSchedule.id) {
              return prev.map(s => s.id === newSchedule.id ? { ...s, ...newSchedule } : s);
          }
          return [...prev, { ...newSchedule, id: Date.now() }];
      });
  };

  const handleDeleteExternalSchedule = (id, mode, targetDate) => {
      setExternalSchedules(prev => {
          if (mode === 'all') {
              return prev.filter(s => s.id !== id);
          }
          
          return prev.map(s => {
              if (s.id !== id) return s;

              if (mode === 'instance') {
                  return { 
                      ...s, 
                      excludedDates: [...(s.excludedDates || []), targetDate] 
                  };
              }

              if (mode === 'future') {
                   const d = new Date(targetDate);
                   d.setDate(d.getDate() - 1); 
                   return { ...s, endDate: d.toISOString().split('T')[0] };
              }
              
              return s;
          });
      });
  };

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

  const handleLoginSuccess = (role, id) => {
    setIsLoggedIn(true);
    setUserRole(role);
    setUserId(id);
    if (role === 'student') {
        setSelectedStudentId(id);
    }
  };

  // ✅ 학생 채팅 메시지 전송 핸들러
  const handleStudentSendMessage = (text) => {
      const now = new Date();
      const timeString = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      const todayDate = now.toISOString().split('T')[0];

      const newMessage = {
          id: Date.now(),
          sender: '나',
          text: text,
          date: todayDate,
          time: timeString,
          isMe: true
      };

      setStudentMessages(prev => [...prev, newMessage]);

      setTimeout(() => {
          setStudentMessages(prev => [...prev, {
              id: Date.now() + 1,
              sender: '채수용 선생님',
              text: '메시지 확인했습니다. 수업 중에 답변 드릴게요! 😊',
              date: todayDate,
              time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
              isMe: false
          }]);
      }, 1000);
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLoginSuccess} />;
  }

  // ✅ 학생 페이지 렌더링
  if (userRole === 'student') {
      return (
        <StudentHome 
            studentId={userId} 
            students={students}
            classes={classes}
            homeworkAssignments={homeworkAssignments}
            homeworkResults={homeworkResults}
            attendanceLogs={attendanceLogs}
            lessonLogs={lessonLogs}
            notices={announcements}
            tests={tests}
            grades={grades}
            
            // 영상 관련 props 전달
            videoProgress={videoProgress}
            onSaveVideoProgress={handleSaveVideoProgress}
            
            videoBookmarks={videoBookmarks} 
            onSaveBookmark={handleSaveBookmark} // ✅ [확인] 함수 전달
            
            // 일정 및 클리닉 관련
            externalSchedules={externalSchedules} 
            onSaveExternalSchedule={handleSaveExternalSchedule} 
            onDeleteExternalSchedule={handleDeleteExternalSchedule} 
            clinicLogs={clinicLogs}
            
            // 정보 수정
            onUpdateStudent={handleSaveStudent}
            
            // 채팅
            messages={studentMessages}
            onSendMessage={handleStudentSendMessage}
            
            onLogout={() => setIsLoggedIn(false)}
        />
      );
  }

  // 직원용 페이지 렌더링
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

  return (
  <div className="flex h-screen bg-gray-100 font-sans text-base relative"> 
    <Sidebar page={page} setPage={handlePageChange} onLogout={() => setIsLoggedIn(false)} />
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