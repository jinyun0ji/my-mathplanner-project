// src/App.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './output.css'; 
import { 
    getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged,
    GoogleAuthProvider, signInWithPopup 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, setLogLevel, 
    collection, query, where, orderBy, limit, onSnapshot 
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null); 
  const [userId, setUserId] = useState(null); 
  const [page, setPage] = useState('lessons'); 
  const [selectedStudentId, setSelectedStudentId] = useState(null); 
  const [notifications, setNotifications] = useState([]); 
  const [isGlobalDirty, setIsGlobalDirty] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

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

  // --- 🔥 Firestore 실시간 동기화 (비용 안전 장치 포함) ---
  useEffect(() => {
      // 학생/학부모는 로컬 데이터만 사용하고, 직원/관리자만 실시간 동기화하여 읽기 수를 줄입니다.
      const isStaff = userRole && !['student', 'parent'].includes(userRole);
      if (!isLoggedIn || !db || !isStaff) return;

      console.log("🔥 Firestore Sync Started (staff only)");
      const unsubs = [];

      // (1) 기본 컬렉션 동기화 (전체 읽기 허용: 데이터 양이 적음)
      const syncBasic = (colName, setter, orderField = null) => {
          let q = collection(db, colName);
          if (orderField) q = query(q, orderBy(orderField));
          unsubs.push(onSnapshot(q, (snap) => {
              if (!snap.empty) setter(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          }));
      };

      // (2) 로그성 데이터 동기화 (Limit 필수: 비용 폭탄 방지)
      const syncLogs = (colName, setter) => {
          // 최근 150건만 가져오도록 제한
          const q = query(collection(db, colName), orderBy('date', 'desc'), limit(150));
          unsubs.push(onSnapshot(q, (snap) => {
              if (!snap.empty) setter(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          }));
      };

      // (3) 특수 구조 데이터 동기화 (Collection -> Nested Object 변환)
      // 예: grades 컬렉션의 문서들을 { studentId: { testId: score } } 구조로 변환
      const syncMappedData = (colName, setter, keyField1, keyField2) => {
          // 최근 300건만 가져옴 (성적/결과는 많아질 수 있음)
          const q = query(collection(db, colName), limit(300)); 
          unsubs.push(onSnapshot(q, (snap) => {
              if (!snap.empty) {
                  const rawDocs = snap.docs.map(d => d.data());
                  const mapped = {};
                  rawDocs.forEach(doc => {
                      const k1 = doc[keyField1]; // studentId
                      const k2 = doc[keyField2]; // testId or assignmentId
                      if (!mapped[k1]) mapped[k1] = {};
                      mapped[k1][k2] = doc; // 전체 데이터를 저장하거나 필요한 필드만 저장
                  });
                  setter(prev => ({ ...prev, ...mapped }));
              }
          }));
      };

      // --- 실행 ---
      syncBasic('students', setStudents, 'name');
      syncBasic('classes', setClasses);
      syncBasic('tests', setTests, 'date'); // 시험은 적으므로 전체 동기화
      
      syncLogs('lessonLogs', setLessonLogs);
      syncLogs('attendanceLogs', setAttendanceLogs);
      syncLogs('clinicLogs', setClinicLogs);
      syncLogs('workLogs', setWorkLogs);
      syncLogs('announcements', setAnnouncements);
      syncLogs('homeworkAssignments', setHomeworkAssignments);
      syncLogs('payments', setPaymentLogs); // ✅ 결제 내역 동기화
      
      // 복잡한 데이터 구조 (간소화: V1에서는 일단 로컬 데이터 + 일부 동기화 가정)
      // 실제로는 DB 설계에 따라 이 부분을 더 정교하게 다듬어야 합니다.
      // 여기서는 'grades' 컬렉션이 있다고 가정하고 매핑합니다.
      syncMappedData('grades', setGrades, 'studentId', 'testId');
      syncMappedData('homeworkResults', setHomeworkResults, 'studentId', 'assignmentId');

      return () => {
          console.log("🛑 Firestore Sync Stopped");
          unsubs.forEach(u => u());
      };
  }, [isLoggedIn, userRole]);

  // --- 학생/학부모: 로그인 시 1회만 필요한 데이터 읽기 ---
  useEffect(() => {
      const isViewerRole = ['student', 'parent'].includes(userRole);
      if (!isLoggedIn || !db || !isViewerRole) return;

      let cancelled = false;
      const loadOnce = async () => {
          try {
              // 공통 유틸: 컬렉션을 한 번만 읽어서 setter에 전달
              const fetchList = async (colName, setter, q) => {
                  const snap = await getDocs(q || collection(db, colName));
                  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                  if (cancelled) return [];
                  setter(items);
                  return items;
              };

              // 1) 본인 학생 정보 + 등록된 반만 읽기
              const myStudents = await fetchList(
                  'students',
                  setStudents,
                  query(collection(db, 'students'), where('id', '==', userId), limit(1))
              );
              const myClasses = await fetchList(
                  'classes',
                  setClasses,
                  query(collection(db, 'classes'), where('students', 'array-contains', userId))
              );

              // 2) 최근 기록 위주로 제한된 조회 (읽기 비용 최소화)
              const fetchLimitedLogs = async (colName, setter, filterField) => {
                  const q = query(
                      collection(db, colName),
                      where(filterField, '==', userId),
                      orderBy('date', 'desc'),
                      limit(30)
                  );
                  await fetchList(colName, setter, q);
              };

              await fetchLimitedLogs('attendanceLogs', setAttendanceLogs, 'studentId');
              await fetchLimitedLogs('clinicLogs', setClinicLogs, 'studentId');

              // 본인이 속한 반의 수업 로그만 최근 순으로 1회 조회
              if (myClasses.length > 0) {
                  const classIds = myClasses.map(c => c.id).slice(0, 10); // in 조건 제한(10개) 준수
                  const lessonQuery = query(
                      collection(db, 'lessonLogs'),
                      where('classId', 'in', classIds),
                      orderBy('date', 'desc'),
                      limit(30)
                  );
                  await fetchList('lessonLogs', setLessonLogs, lessonQuery);
              }

              // 3) 숙제/성적은 매핑 구조 유지
              const qHomework = query(collection(db, 'homeworkResults'), where('studentId', '==', userId), limit(80));
              const homeworkSnap = await getDocs(qHomework);
              if (!cancelled) {
                  const mapped = {};
                  homeworkSnap.docs.forEach(doc => {
                      const data = doc.data();
                      const { studentId, assignmentId } = data;
                      if (!mapped[studentId]) mapped[studentId] = {};
                      mapped[studentId][assignmentId] = data;
                  });
                  setHomeworkResults(prev => ({ ...prev, ...mapped }));
              }

              const qGrades = query(collection(db, 'grades'), where('studentId', '==', userId), limit(80));
              const gradeSnap = await getDocs(qGrades);
              if (!cancelled) {
                  const mappedGrades = {};
                  gradeSnap.docs.forEach(doc => {
                      const data = doc.data();
                      const { studentId, testId } = data;
                      if (!mappedGrades[studentId]) mappedGrades[studentId] = {};
                      mappedGrades[studentId][testId] = data;
                  });
                  setGrades(prev => ({ ...prev, ...mappedGrades }));
              }

              // 4) 공지/숙제 등은 전체 공용 피드에서 최근만 노출
              await fetchList(
                  'announcements',
                  setAnnouncements,
                  query(collection(db, 'announcements'), orderBy('date', 'desc'), limit(20))
              );
              await fetchList(
                  'homeworkAssignments',
                  setHomeworkAssignments,
                  query(collection(db, 'homeworkAssignments'), orderBy('date', 'desc'), limit(20))
              );

              // 5) 영상 진도/외부 일정 등 학생 개인 데이터
              await fetchList(
                  'videoProgress',
                  setVideoProgress,
                  query(collection(db, 'videoProgress'), where('studentId', '==', userId), limit(50))
              );
              await fetchList(
                  'externalSchedules',
                  setExternalSchedules,
                  query(collection(db, 'externalSchedules'), where('studentId', '==', userId), orderBy('date', 'desc'), limit(30))
              );
          } catch (error) {
              console.error('학생/학부모 단발성 데이터 로드 실패:', error);
          }
      };

      loadOnce();
      return () => { cancelled = true; };
  }, [isLoggedIn, userRole, userId]);


  // ... (로그인, 로컬스토리지, 메시지 등 기타 로직 유지) ...
  const handleSocialLogin = (providerName) => handleLoginSuccess('student', 1);

  useEffect(() => {
      try { localStorage.setItem('videoBookmarks', JSON.stringify(videoBookmarks)); } 
      catch (e) {}
  }, [videoBookmarks]);

  const [studentMessages, setStudentMessages] = useState([
      { id: 1, channelId: 'teacher', sender: '채수용 선생님', text: '철수야, 오늘 클리닉 늦을 것 같니?', date: '2025-11-29', time: '13:50', isMe: false },
  ]);
  
  const nextStudentId = students.reduce((max, s) => Math.max(max, Number(s.id) || 0), 0) + 1; 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [isMessengerOpen, setIsMessengerOpen] = useState(false); 
  const [hasNewMessages, setHasNewMessages] = useState(true); 
  const [pendingQuickAction, setPendingQuickAction] = useState(null);

  const toggleSidebar = () => { setIsSidebarOpen(prev => !prev); if (!isSidebarOpen) { setHasNewNotifications(false); setIsMessengerOpen(false); } };
  const toggleMessenger = () => { setIsMessengerOpen(prev => !prev); if (!isMessengerOpen) { setHasNewMessages(false); setIsSidebarOpen(false); } };

  useEffect(() => {
    if (auth) {
        const unsubscribe = onAuthStateChanged(auth, (user) => { if (user) setUserId(user.uid); });
        return () => unsubscribe();
    } 
  }, []); 

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

  const handleLoginSuccess = (role, id) => { setIsLoggedIn(true); setUserRole(role); setUserId(id); if(['student','parent'].includes(role)) setSelectedStudentId(id); };

  if (!isLoggedIn) return <LoginPage onLogin={handleLoginSuccess} onSocialLogin={handleSocialLogin} />;

  // 학생/학부모 뷰
  if (userRole === 'student') return <StudentHome studentId={userId} students={students} classes={classes} homeworkAssignments={homeworkAssignments} homeworkResults={homeworkResults} attendanceLogs={attendanceLogs} lessonLogs={lessonLogs} notices={announcements} tests={tests} grades={grades} videoProgress={videoProgress} onSaveVideoProgress={handleSaveVideoProgress} videoBookmarks={videoBookmarks} onSaveBookmark={handleSaveBookmark} externalSchedules={externalSchedules} onSaveExternalSchedule={handleSaveExternalSchedule} onDeleteExternalSchedule={handleDeleteExternalSchedule} clinicLogs={clinicLogs} onUpdateStudent={handleSaveStudent} messages={studentMessages} onSendMessage={() => {}} onLogout={() => setIsLoggedIn(false)} />;
  if (userRole === 'parent') return <ParentHome studentId={userId} students={students} classes={classes} homeworkAssignments={homeworkAssignments} homeworkResults={homeworkResults} attendanceLogs={attendanceLogs} lessonLogs={lessonLogs} notices={announcements} tests={tests} grades={grades} clinicLogs={clinicLogs} videoProgress={videoProgress} onLogout={() => setIsLoggedIn(false)} externalSchedules={externalSchedules} onSaveExternalSchedule={handleSaveExternalSchedule} onDeleteExternalSchedule={handleDeleteExternalSchedule} messages={studentMessages} onSendMessage={() => {}} />;

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
    <Sidebar page={page} setPage={(p, id, r) => { handlePageChange(p, id, r); setIsMobileMenuOpen(false); }} onLogout={() => setIsLoggedIn(false)} isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
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