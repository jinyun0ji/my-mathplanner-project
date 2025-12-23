// src/App.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './output.css';

import { 
    initialStudents, initialClasses, initialLessonLogs, initialAttendanceLogs, 
    initialStudentMemos, initialHomeworkAssignments, initialHomeworkResults, 
    initialTests, initialGrades, initialVideoProgress, initialClinicLogs, 
    initialWorkLogs, initialAnnouncements, initialPayments,
    initialExternalSchedules
} from './api/initialData'; 
import { 
    calculateClassSessions, calculateGradeComparison, 
    calculateHomeworkStats, Icon
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
import ParentHome from './pages/ParentHome';
import OnboardingPage from './pages/OnboardingPage';
import useAuth from './auth/useAuth';
import { signInWithEmail, signInWithGoogle, signOutUser } from './auth/authService';
import { db } from './firebase/client';
import { loadViewerDataOnce, startStaffFirestoreSync } from './data/firestoreSync';

const PageContent = (props) => {
    const { page, selectedStudentId } = props;
    if (page === 'students' && selectedStudentId !== null) return <StudentDetail {...props} studentId={selectedStudentId} />;
    switch (page) {
        case 'home': return <Home onQuickAction={props.onQuickAction} />;
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
  const { user, role, loading } = useAuth();
  const [page, setPage] = useState('lessons');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isGlobalDirty, setIsGlobalDirty] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const userId = user?.uid || null;
  const isAuthenticated = Boolean(user);

  // --- 중앙 상태 관리 (Firestore 동기화 대상) ---
  const [students, setStudents] = useState(initialStudents);
  const [classes, setClasses] = useState(initialClasses);
  
  // 1. 단순 리스트 형태 데이터
  const [lessonLogs, setLessonLogs] = useState(initialLessonLogs);
  const [attendanceLogs, setAttendanceLogs] = useState(initialAttendanceLogs); 
  const [clinicLogs, setClinicLogs] = useState(initialClinicLogs); 
  const [workLogs, setWorkLogs] = useState(initialWorkLogs); 
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [tests, setTests] = useState(initialTests);
  const [homeworkAssignments, setHomeworkAssignments] = useState(initialHomeworkAssignments);
  const [paymentLogs, setPaymentLogs] = useState(initialPayments); // ✅ 결제 내역 추가
  const [externalSchedules, setExternalSchedules] = useState(initialExternalSchedules);

  // 2. 객체 형태 데이터 (매핑 필요)
  const [grades, setGrades] = useState(initialGrades);
  const [homeworkResults, setHomeworkResults] = useState(initialHomeworkResults);
  const [studentMemos, setStudentMemos] = useState(initialStudentMemos);
  const [videoProgress, setVideoProgress] = useState(initialVideoProgress);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [videoBookmarks, setVideoBookmarks] = useState(() => {
      try { return JSON.parse(localStorage.getItem('videoBookmarks')) || {}; }
      catch (e) { return {}; }
  });

  useEffect(() => {
      if (!isAuthenticated) {
          setSelectedStudentId(null);
          return;
      }
      if (['student', 'parent'].includes(role)) setSelectedStudentId(userId);
  }, [isAuthenticated, role, userId]);

  useEffect(() => {
      if (isAuthenticated) processedAnnouncementIdsRef.current = new Set();
  }, [isAuthenticated, userId]);

  // --- 🔥 Firestore 실시간 동기화 (비용 안전 장치 포함) ---
  useEffect(() => startStaffFirestoreSync({
      db,
      isLoggedIn: isAuthenticated,
      userRole: role,
      setStudents,
      setClasses,
      setTests,
      setLessonLogs,
      setAttendanceLogs,
      setClinicLogs,
      setWorkLogs,
      setAnnouncements,
      setHomeworkAssignments,
      setPaymentLogs,
      setGrades,
      setHomeworkResults,
  }), [db, isAuthenticated, role]);

  // --- 학생/학부모: 로그인 시 1회만 필요한 데이터 읽기 ---
  useEffect(() => {
      const state = { cancelled: false };
      loadViewerDataOnce({
          db,
          isLoggedIn: isAuthenticated,
          userRole: role,
          userId,
          setStudents,
          setClasses,
          setLessonLogs,
          setAttendanceLogs,
          setClinicLogs,
          setHomeworkAssignments,
          setAnnouncements,
          setVideoProgress,
          setExternalSchedules,
          setHomeworkResults,
          setGrades,
          isCancelled: () => state.cancelled,
      });
      return () => { state.cancelled = true; };
  }, [db, isAuthenticated, role, userId]);


  const handleEmailLogin = async (email, password) => {
      await signInWithEmail(email, password);
  };

  const handleSocialLogin = async (providerName) => {
      if (providerName === 'google') return signInWithGoogle();
      if (providerName === 'kakao' || providerName === 'naver') {
          alert('다음 단계에서 연결될 예정입니다.');
          return;
      }
      throw new Error('지원되지 않는 소셜 로그인입니다.');
  }

  useEffect(() => {
      try { localStorage.setItem('videoBookmarks', JSON.stringify(videoBookmarks)); } 
      catch (e) {}
  }, [videoBookmarks]);

  const [studentMessages, setStudentMessages] = useState([
      { id: 1, channelId: 'teacher', sender: '채수용 선생님', text: '철수야, 오늘 클리닉 늦을 것 같니?', date: '2025-11-29', time: '13:50', isMe: false },
  ]);
  const processedAnnouncementIdsRef = useRef(new Set());
  
  const nextStudentId = students.reduce((max, s) => Math.max(max, Number(s.id) || 0), 0) + 1; 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [isMessengerOpen, setIsMessengerOpen] = useState(false); 
  const [hasNewMessages, setHasNewMessages] = useState(true); 
  const [pendingQuickAction, setPendingQuickAction] = useState(null);

  const toggleSidebar = () => { setIsSidebarOpen(prev => !prev); if (!isSidebarOpen) { setHasNewNotifications(false); setIsMessengerOpen(false); } };
  const toggleMessenger = () => { setIsMessengerOpen(prev => !prev); if (!isMessengerOpen) { setHasNewMessages(false); setIsSidebarOpen(false); } };

  useEffect(() => {
      if (!announcements || announcements.length === 0) return;
      if (!['student', 'parent'].includes(role)) return;

      const processed = processedAnnouncementIdsRef.current;
      const newMessages = [];

      announcements.forEach((notice) => {
          if (!notice?.id || processed.has(notice.id)) return;
          const isTargetedToUser = !notice.targetStudents || notice.targetStudents.length === 0 || notice.targetStudents.includes(userId);
          if (!isTargetedToUser) return;

          const dateString = notice.date || new Date().toISOString().split('T')[0];
          const timeString = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

          newMessages.push({
              id: `notice-${notice.id}`,
              channelId: 'teacher',
              sender: notice.author || '학원 알림',
              text: notice.content || notice.title,
              date: dateString,
              time: timeString,
              isMe: false,
          });

          processed.add(notice.id);
      });

      if (newMessages.length > 0) {
          setStudentMessages((prev) => [...prev, ...newMessages]);
          setHasNewMessages(true);
      }
  }, [announcements, role, userId]);

  const logNotification = useCallback((type, message, details) => {
      setNotifications(prev => [{ id: Date.now(), type, message, details, timestamp: new Date().toLocaleTimeString('ko-KR') }, ...prev]);
      setHasNewNotifications(true);
  }, []);

  // --- 핸들러 함수들 (DB 연동 시 여기서 API 호출 필요) ---
  const handleSavePayment = (paymentData) => {
      setPaymentLogs(prev => [paymentData, ...prev]);
      logNotification('success', '결제 기록 저장', `${paymentData.studentName} 학생 결제 완료`);
  };

  const handleSaveStudent = (data, isEdit) => { /* ... 기존 로직 ... */ setStudents(prev => isEdit ? prev.map(s => s.id === data.id ? {...s, ...data} : s) : [...prev, {...data, id: nextStudentId}]); };
  const handleDeleteStudent = (id) => setStudents(prev => prev.filter(s => s.id !== id));
  const handleSaveClass = (data, isEdit) => setClasses(prev => isEdit ? prev.map(c => c.id === data.id ? {...c, ...data} : c) : [...prev, {...data, id: Date.now()}]);
  
  const handleSaveLessonLog = (data, isEdit) => setLessonLogs(prev => isEdit ? prev.map(l => l.id === data.id ? {...l, ...data} : l) : [...prev, {...data, id: Date.now()}]);
  const handleDeleteLessonLog = (id) => setLessonLogs(prev => prev.filter(l => l.id !== id));
  
  const handleSaveAttendance = (records) => {
      setAttendanceLogs(prev => {
          const newLogs = [...prev];
          records.forEach(r => {
              const idx = newLogs.findIndex(l => l.studentId === r.studentId && l.date === r.date && l.classId === r.classId);
              if(idx > -1) newLogs[idx] = r; else newLogs.push({...r, id: Date.now()});
          });
          return newLogs;
      });
      logNotification('success', '출결 저장', '출결 기록이 저장되었습니다.');
  };

  const handleSaveHomeworkAssignment = (data, isEdit) => setHomeworkAssignments(prev => isEdit ? prev.map(a => a.id === data.id ? {...a, ...data} : a) : [...prev, {...data, id: Date.now()}]);
  const handleDeleteHomeworkAssignment = (id) => setHomeworkAssignments(prev => prev.filter(a => a.id !== id));
  const handleUpdateHomeworkResult = (updates) => {
      setHomeworkResults(prev => {
          const next = { ...prev };
          updates.forEach(({studentId, assignmentId, questionId, status}) => {
              if(!next[studentId]) next[studentId] = {};
              if(!next[studentId][assignmentId]) next[studentId][assignmentId] = {};
              next[studentId][assignmentId][questionId] = status;
          });
          return next;
      });
  };

  const handleSaveTest = (data, isEdit) => setTests(prev => isEdit ? prev.map(t => t.id === data.id ? {...t, ...data} : t) : [...prev, {...data, id: Date.now()}]);
  const handleDeleteTest = (id) => setTests(prev => prev.filter(t => t.id !== id));
  const handleUpdateGrade = (studentId, testId, result, comment) => {
      setGrades(prev => ({
          ...prev, [studentId]: { ...prev[studentId], [testId]: { score: 0, correctCount: result, comment } } // 점수 계산 로직은 생략(UI에서 처리)
      }));
  };

  const handleSaveClinicLog = (data, isEdit) => setClinicLogs(prev => isEdit ? prev.map(l => l.id === data.id ? {...l, ...data} : l) : [...prev, {...data, id: Date.now()}]);
  const handleDeleteClinicLog = (id) => setClinicLogs(prev => prev.filter(l => l.id !== id));
  
  const handleSaveAnnouncement = (data, isEdit) => setAnnouncements(prev => isEdit ? prev.map(a => a.id === data.id ? {...a, ...data} : a) : [...prev, {...data, id: Date.now()}]);
  const handleSaveWorkLog = (data, isEdit) => setWorkLogs(prev => isEdit ? prev.map(l => l.id === data.id ? {...l, ...data} : l) : [...prev, {...data, id: Date.now()}]);
  const handleDeleteWorkLog = (id) => setWorkLogs(prev => prev.filter(l => l.id !== id));

  const handleSaveVideoProgress = (sId, lId, data) => setVideoProgress(prev => ({ ...prev, [sId]: { ...prev[sId], [lId]: data } }));
  const handleSaveBookmark = (sId, lId, bm) => setVideoBookmarks(prev => ({ ...prev, [sId]: { ...prev[sId], [lId]: [...(prev[sId]?.[lId] || []), bm] } }));
  const handleSaveMemo = (sId, content) => setStudentMemos(prev => ({ ...prev, [sId]: content }));
  
  const handleSaveExternalSchedule = (data) => setExternalSchedules(prev => data.id ? prev.map(s => s.id === data.id ? {...s, ...data} : s) : [...prev, {...data, id: Date.now()}]);
  const handleDeleteExternalSchedule = (id) => setExternalSchedules(prev => prev.filter(s => s.id !== id));
  
  const handleSendStudentNotification = (sId, title, content) => handleSaveAnnouncement({ title, content, targetStudents: [sId], date: new Date().toISOString().slice(0,10), author:'알림봇' }, false);

  const getClassesNames = useCallback((ids) => ids.map(id => classes.find(c => c.id === id)?.name).join(', '), [classes]);

  const handlePageChange = (newPage, sId = null, reset = false) => {
    if (isGlobalDirty && !window.confirm('저장되지 않은 변경사항이 있습니다. 이동하시겠습니까?')) return false;
    if (reset) setStudentSearchTerm('');
    setSelectedStudentId(sId);
    setPage(newPage);
    setIsGlobalDirty(false);
    return true;
  };

  const handleQuickAction = (key) => {
      const map = { newStudent: 'students', announcement: 'communication', payment: 'payment', worklog: 'communication', attendance: 'attendance', clinic: 'clinic' };
      if (map[key]) handlePageChange(map[key]);
  };

  const handleLogout = async () => {
      await signOutUser();
      setSelectedStudentId(null);
      processedAnnouncementIdsRef.current = new Set();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  if (!isAuthenticated) return <LoginPage onEmailLogin={handleEmailLogin} onSocialLogin={handleSocialLogin} />;
  if (role === 'pending') return <OnboardingPage />;

  // 학생/학부모 뷰
  if (role === 'student') return <StudentHome studentId={userId} students={students} classes={classes} homeworkAssignments={homeworkAssignments} homeworkResults={homeworkResults} attendanceLogs={attendanceLogs} lessonLogs={lessonLogs} notices={announcements} tests={tests} grades={grades} videoProgress={videoProgress} onSaveVideoProgress={handleSaveVideoProgress} videoBookmarks={videoBookmarks} onSaveBookmark={handleSaveBookmark} externalSchedules={externalSchedules} onSaveExternalSchedule={handleSaveExternalSchedule} onDeleteExternalSchedule={handleDeleteExternalSchedule} clinicLogs={clinicLogs} onUpdateStudent={handleSaveStudent} messages={studentMessages} onSendMessage={() => {}} onLogout={handleLogout} />;
  if (role === 'parent') return <ParentHome studentId={userId} students={students} classes={classes} homeworkAssignments={homeworkAssignments} homeworkResults={homeworkResults} attendanceLogs={attendanceLogs} lessonLogs={lessonLogs} notices={announcements} tests={tests} grades={grades} clinicLogs={clinicLogs} videoProgress={videoProgress} onLogout={handleLogout} externalSchedules={externalSchedules} onSaveExternalSchedule={handleSaveExternalSchedule} onDeleteExternalSchedule={handleDeleteExternalSchedule} messages={studentMessages} onSendMessage={() => {}} />;
  
  // 관리자(직원) 뷰 Props
  const managementProps = {
    students, classes, lessonLogs, attendanceLogs, workLogs, clinicLogs, 
    homeworkAssignments, homeworkResults, tests, grades, studentMemos, videoProgress, announcements, 
    paymentLogs, // ✅ 추가됨
    setAnnouncements, getClassesNames,
    handleSaveStudent, handleDeleteStudent, handleSaveClass, handleSaveLessonLog, handleDeleteLessonLog,
    handleSaveAttendance, handleSaveHomeworkAssignment, handleDeleteHomeworkAssignment, handleUpdateHomeworkResult,
    handleSaveTest, handleDeleteTest, handleUpdateGrade, handleSaveMemo, 
    handleSaveAnnouncement, handleSaveWorkLog, handleDeleteWorkLog, handleSaveClinicLog, handleDeleteClinicLog, 
    handleSavePayment, // ✅ 추가됨
    calculateClassSessions, selectedStudentId, handlePageChange, logNotification, notifications, 
    calculateGradeComparison, calculateHomeworkStats,
    setIsGlobalDirty, studentSearchTerm, setStudentSearchTerm, handleSendStudentNotification,
    externalSchedules, pendingQuickAction, clearPendingQuickAction: () => setPendingQuickAction(null), onQuickAction: handleQuickAction
  };

  return (
  <div className="flex h-screen bg-gray-100 font-sans text-base relative"> 
    <div className="md:hidden fixed top-3 left-4 z-40">
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-white rounded-lg shadow-md text-indigo-900 hover:bg-gray-50 border border-gray-100"><Icon name="menu" className="w-6 h-6" /></button>
    </div>
    <Sidebar page={page} setPage={(p, id, r) => { handlePageChange(p, id, r); setIsMobileMenuOpen(false); }} onLogout={handleLogout} isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
        {isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>}
    <div className={`flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-300 md:ml-64 ${isSidebarOpen || isMessengerOpen ? 'mr-80' : 'mr-0'}`}>
      <Header page={page} />
      <main id="main-content" className="overflow-x-hidden overflow-y-auto bg-gray-100 p-4 md:p-6 min-w-0">
        <PageContent page={page} {...managementProps} />
      </main>
    </div>
    <NotificationPanel notifications={notifications} isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} hasNewNotifications={hasNewNotifications} setHasNewNotifications={setHasNewNotifications} />
    <MessengerPanel isMessengerOpen={isMessengerOpen} toggleMessenger={toggleMessenger} hasNewMessages={hasNewMessages} setHasNewMessages={setHasNewMessages} isSidebarOpen={isSidebarOpen} students={students} classes={classes} />
  </div>
  );
}