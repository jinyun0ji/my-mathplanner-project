import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import AppShell from './AppShell';
import {
    initialStudents, initialClasses, initialLessonLogs, initialAttendanceLogs,
    initialStudentMemos, initialHomeworkAssignments, initialHomeworkResults,
    initialTests, initialGrades, initialVideoProgress, initialClinicLogs,
    initialWorkLogs, initialAnnouncements, initialPayments,
    initialExternalSchedules
} from '../api/initialData';
import {
    calculateClassSessions, calculateGradeComparison,
    calculateHomeworkStats
} from '../utils/helpers';
import StudentHome from '../pages/StudentHome';
import Home from '../pages/Home';
import StudentManagement from '../pages/StudentManagement';
import StudentDetail from '../pages/StudentDetail';
import LessonManagement from '../pages/LessonManagement';
import AttendanceManagement from '../pages/AttendanceManagement';
import HomeworkManagement from '../pages/HomeworkManagement';
import GradeManagement from '../pages/GradeManagement';
import ClinicManagement from '../pages/ClinicManagement';
import InternalCommunication from '../pages/InternalCommunication';
import PaymentManagement from '../pages/PaymentManagement';
import ParentHome from '../pages/ParentHome';
import ParentStudentPicker from '../pages/parent/ParentStudentPicker';
import OnboardingPage from '../pages/OnboardingPage';
import StaffManagement from '../pages/admin/StaffManagement';
import AdminNotificationsPage from '../pages/admin/AdminNotificationsPage';
import AdminPaymentsPage from '../pages/admin/AdminPaymentsPage';
import AdminSettingsPage from '../pages/admin/AdminSettingsPage';
import AdminRoute from '../routes/AdminRoute';
import useAuth from '../auth/useAuth';
import { db } from '../firebase/client';
import { loadViewerDataOnce, startStaffFirestoreSync } from '../data/firestoreSync';
import { createLinkCode, createStaffUser } from '../admin/staffService';
import { claimStudentLinkCode } from '../parent/linkCodeService';
import { useParentContext } from '../parent';

const PAGE_ROUTES = {
    home: '/home',
    lessons: '/lessons',
    students: '/students',
    attendance: '/attendance',
    grades: '/grades',
    homework: '/homework',
    clinic: '/clinic',
    payment: '/payment',
    communication: '/communication',
};

const ADMIN_ROUTES = new Set([
    '/admin/staff',
    '/admin/notifications',
    '/admin/payments',
    '/admin/settings',
]);

const getPageKeyFromPath = (pathname) => {
    if (pathname.startsWith('/students/')) return 'students';
    if (ADMIN_ROUTES.has(pathname)) return pathname;
    const entry = Object.entries(PAGE_ROUTES).find(([, path]) => path === pathname);
    if (entry) return entry[0];
    return 'lessons';
};

const getPathForPage = (pageKey, studentId) => {
    if (!pageKey) return PAGE_ROUTES.lessons;
    if (pageKey.startsWith('/admin/')) return pageKey;
    if (pageKey === 'students' && studentId) return `${PAGE_ROUTES.students}/${studentId}`;
    return PAGE_ROUTES[pageKey] || PAGE_ROUTES.lessons;
};

const AppShellLayout = ({
    page,
    notifications,
    students,
    classes,
    isSidebarOpen,
    isMessengerOpen,
    hasNewNotifications,
    hasNewMessages,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    setHasNewNotifications,
    setHasNewMessages,
    toggleSidebar,
    toggleMessenger,
    handlePageChange,
    handleLogout,
}) => (
    <AppShell
        page={page}
        notifications={notifications}
        students={students}
        classes={classes}
        isSidebarOpen={isSidebarOpen}
        isMessengerOpen={isMessengerOpen}
        hasNewNotifications={hasNewNotifications}
        hasNewMessages={hasNewMessages}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        setHasNewNotifications={setHasNewNotifications}
        setHasNewMessages={setHasNewMessages}
        toggleSidebar={toggleSidebar}
        toggleMessenger={toggleMessenger}
        handlePageChange={handlePageChange}
        handleLogout={handleLogout}
    >
        <Outlet />
    </AppShell>
);

export default function AppRoutes({ user, role, linkedStudentUids }) {
  const navigate = useNavigate();
  const location = useLocation();
  const page = useMemo(() => getPageKeyFromPath(location.pathname), [location.pathname]);
  const [notifications, setNotifications] = useState([]);
  const [isGlobalDirty, setIsGlobalDirty] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const userId = user?.uid || null;
  const isAuthenticated = Boolean(user);
  const { logout } = useAuth();
  const {
      activeStudentId: parentActiveStudentId,
      linkedStudentUids: parentLinkedStudentUids,
      loading: parentLoading,
  } = useParentContext();
  const parentStudentId = role === 'parent' ? parentActiveStudentId : null;

  const [students, setStudents] = useState(initialStudents);
  const [classes, setClasses] = useState(initialClasses);

  const [lessonLogs, setLessonLogs] = useState(initialLessonLogs);
  const [attendanceLogs, setAttendanceLogs] = useState(initialAttendanceLogs);
  const [clinicLogs, setClinicLogs] = useState(initialClinicLogs);
  const [workLogs, setWorkLogs] = useState(initialWorkLogs);
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [tests, setTests] = useState(initialTests);
  const [homeworkAssignments, setHomeworkAssignments] = useState(initialHomeworkAssignments);
  const [paymentLogs, setPaymentLogs] = useState(initialPayments);
  const [externalSchedules, setExternalSchedules] = useState(initialExternalSchedules);

  const [grades, setGrades] = useState(initialGrades);
  const [homeworkResults, setHomeworkResults] = useState(initialHomeworkResults);
  const [studentMemos, setStudentMemos] = useState(initialStudentMemos);
  const [videoProgress, setVideoProgress] = useState(initialVideoProgress);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [videoBookmarks, setVideoBookmarks] = useState(() => {
      try { return JSON.parse(localStorage.getItem('videoBookmarks')) || {}; }
      catch (e) { return {}; }
  });
  const staffSyncUnsubscribeRef = useRef(null);
  useEffect(() => {
      if (isAuthenticated) processedAnnouncementIdsRef.current = new Set();
  }, [isAuthenticated, userId]);

  useEffect(() => {
  if (staffSyncUnsubscribeRef.current) {
          staffSyncUnsubscribeRef.current();
          staffSyncUnsubscribeRef.current = null;
      }

      const unsubscribe = startStaffFirestoreSync({
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
      });

      staffSyncUnsubscribeRef.current = unsubscribe;
      
      return () => {
          if (staffSyncUnsubscribeRef.current === unsubscribe) {
              staffSyncUnsubscribeRef.current();
              staffSyncUnsubscribeRef.current = null;
          }
      };
  }, [db, isAuthenticated, role]);

  useEffect(() => {
      const state = { cancelled: false };
      loadViewerDataOnce({
          db,
          isLoggedIn: isAuthenticated,
          userRole: role,
          studentIds: linkedStudentUids,
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
  }, [db, isAuthenticated, role, userId, linkedStudentUids]);

  useEffect(() => {
      try { localStorage.setItem('videoBookmarks', JSON.stringify(videoBookmarks)); }
      catch (e) {}
  }, [videoBookmarks]);

  const [studentMessages, setStudentMessages] = useState([
      { id: 1, roomId: 'teacher-room', senderRole: 'teacher', displayName: '채수용T', text: '철수야, 오늘 클리닉 늦을 것 같니?', date: '2025-11-29', time: '13:50', isMe: false },
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

      const announcementTargets = role === 'parent'
          ? linkedStudentUids
          : userId
              ? [userId]
              : [];

      announcements.forEach((notice) => {
          if (!notice?.id || processed.has(notice.id)) return;
          const isTargetedToUser = !notice.targetStudents || notice.targetStudents.length === 0 || announcementTargets.some((id) => notice.targetStudents.includes(id));
          if (!isTargetedToUser) return;

          const dateString = notice.date || new Date().toISOString().split('T')[0];
          const timeString = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

          newMessages.push({
              id: `notice-${notice.id}`,
              roomId: 'teacher-room',
              senderRole: 'teacher',
              displayName: notice.author || '학원 알림',
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
  }, [announcements, role, userId, linkedStudentUids]);

  const logNotification = useCallback((type, message, details) => {
      setNotifications(prev => [{ id: Date.now(), type, message, details, timestamp: new Date().toLocaleTimeString('ko-KR') }, ...prev]);
      setHasNewNotifications(true);
  }, []);

  const handleSavePayment = (paymentData) => {
      setPaymentLogs(prev => [paymentData, ...prev]);
      logNotification('success', '결제 기록 저장', `${paymentData.studentName} 학생 결제 완료`);
  };

  const handleCreateLinkCode = async ({ studentId }) => {
      const normalizedId = typeof studentId === 'string' ? studentId.trim() : '';
      if (!normalizedId) throw new Error('학생 ID를 입력해주세요.');
      return createLinkCode({ studentId: normalizedId });
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
          ...prev, [studentId]: { ...prev[studentId], [testId]: { score: 0, correctCount: result, comment } }
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

  const handleCreateStaffUser = async ({ email, role }) => {
      const result = await createStaffUser({ email, role });
      logNotification('success', '직원 계정 생성', `${email} 계정이 생성되었습니다.`);
      return result;
  };

  const getClassesNames = useCallback((ids) => ids.map(id => classes.find(c => c.id === id)?.name).join(', '), [classes]);

  const handlePageChange = (newPage, sId = null, reset = false) => {
    if (isGlobalDirty && !window.confirm('저장되지 않은 변경사항이 있습니다. 이동하시겠습니까?')) return false;
    if (reset) setStudentSearchTerm('');
    setIsGlobalDirty(false);
    const nextPath = getPathForPage(newPage, sId);
    if (location.pathname !== nextPath) {
        navigate(nextPath);
    }
    return true;
  };

  const handleQuickAction = (key) => {
      const map = { newStudent: 'students', announcement: 'communication', payment: 'payment', worklog: 'communication', attendance: 'attendance', clinic: 'clinic' };
      if (map[key]) handlePageChange(map[key]);
  };

  const handleLogout = async () => {
      await logout();
      processedAnnouncementIdsRef.current = new Set();
      navigate('/login', { replace: true });
  };

  const handleClaimLinkCode = async (code) => {
      await claimStudentLinkCode(code);
  };

  if (role === 'student') return <StudentHome studentId={userId} userId={userId} students={students} classes={classes} homeworkAssignments={homeworkAssignments} homeworkResults={homeworkResults} attendanceLogs={attendanceLogs} lessonLogs={lessonLogs} notices={announcements} tests={tests} grades={grades} videoProgress={videoProgress} onSaveVideoProgress={handleSaveVideoProgress} videoBookmarks={videoBookmarks} onSaveBookmark={handleSaveBookmark} externalSchedules={externalSchedules} onSaveExternalSchedule={handleSaveExternalSchedule} onDeleteExternalSchedule={handleDeleteExternalSchedule} clinicLogs={clinicLogs} onUpdateStudent={handleSaveStudent} messages={studentMessages} onSendMessage={() => {}} onLogout={handleLogout} />;
  if (role === 'parent') {
      if (parentLoading) {
          return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
      }
      if (!parentLinkedStudentUids || parentLinkedStudentUids.length === 0) {
          return <OnboardingPage onSubmitLinkCode={handleClaimLinkCode} />;
      }
      if (parentLinkedStudentUids.length > 1 && !parentStudentId) {
          return (
              <ParentStudentPicker
                  students={students}
              />
          );
      }
      return <ParentHome userId={userId} students={students} classes={classes} homeworkAssignments={homeworkAssignments} homeworkResults={homeworkResults} attendanceLogs={attendanceLogs} lessonLogs={lessonLogs} notices={announcements} tests={tests} grades={grades} clinicLogs={clinicLogs} videoProgress={videoProgress} onLogout={handleLogout} externalSchedules={externalSchedules} onSaveExternalSchedule={handleSaveExternalSchedule} onDeleteExternalSchedule={handleDeleteExternalSchedule} messages={studentMessages} onSendMessage={() => {}} />;
  }
  
  const managementProps = {
    students, classes, lessonLogs, attendanceLogs, workLogs, clinicLogs,
    homeworkAssignments, homeworkResults, tests, grades, studentMemos, videoProgress, announcements,
    paymentLogs,
    setAnnouncements, getClassesNames,
    handleSaveStudent, handleDeleteStudent, handleSaveClass, handleSaveLessonLog, handleDeleteLessonLog,
    handleSaveAttendance, handleSaveHomeworkAssignment, handleDeleteHomeworkAssignment, handleUpdateHomeworkResult,
    handleSaveTest, handleDeleteTest, handleUpdateGrade, handleSaveMemo,
    handleSaveAnnouncement, handleSaveWorkLog, handleDeleteWorkLog, handleSaveClinicLog, handleDeleteClinicLog,
    handleSavePayment,
    calculateClassSessions, handlePageChange, logNotification, notifications,
    calculateGradeComparison, calculateHomeworkStats,
    setIsGlobalDirty, studentSearchTerm, setStudentSearchTerm, handleSendStudentNotification,
    externalSchedules, pendingQuickAction, clearPendingQuickAction: () => setPendingQuickAction(null), onQuickAction: handleQuickAction,
    onCreateStaffUser: role === 'admin' ? handleCreateStaffUser : null,
    onCreateLinkCode: role === 'staff' ? handleCreateLinkCode : null,
    userRole: role,
  };

  return (
    <Routes>
        <Route
            element={(
                <AppShellLayout
                    page={page}
                    notifications={notifications}
                    students={students}
                    classes={classes}
                    isSidebarOpen={isSidebarOpen}
                    isMessengerOpen={isMessengerOpen}
                    hasNewNotifications={hasNewNotifications}
                    hasNewMessages={hasNewMessages}
                    isMobileMenuOpen={isMobileMenuOpen}
                    setIsMobileMenuOpen={setIsMobileMenuOpen}
                    setHasNewNotifications={setHasNewNotifications}
                    setHasNewMessages={setHasNewMessages}
                    toggleSidebar={toggleSidebar}
                    toggleMessenger={toggleMessenger}
                    handlePageChange={handlePageChange}
                    handleLogout={handleLogout}
                />
            )}
        >
            <Route index element={<Navigate to={PAGE_ROUTES.lessons} replace />} />
            <Route path="home" element={<Home onQuickAction={handleQuickAction} onCreateStaffUser={managementProps.onCreateStaffUser} onCreateLinkCode={managementProps.onCreateLinkCode} userRole={role} />} />
            <Route path="lessons" element={<LessonManagement {...managementProps} />} />
            <Route path="attendance" element={<AttendanceManagement {...managementProps} />} />
            <Route path="students" element={<StudentManagement {...managementProps} />} />
            <Route path="students/:studentId" element={<StudentDetail />} />
            <Route path="grades" element={<GradeManagement {...managementProps} />} />
            <Route path="homework" element={<HomeworkManagement {...managementProps} />} />
            <Route path="clinic" element={<ClinicManagement {...managementProps} />} />
            <Route path="communication" element={<InternalCommunication {...managementProps} />} />
            <Route path="payment" element={<PaymentManagement {...managementProps} />} />
            <Route
                path="admin/staff"
                element={(
                    <AdminRoute>
                        <StaffManagement />
                    </AdminRoute>
                )}
            />
            <Route
                path="admin/notifications"
                element={(
                    <AdminRoute>
                        <AdminNotificationsPage />
                    </AdminRoute>
                )}
            />
            <Route
                path="admin/payments"
                element={(
                    <AdminRoute>
                        <AdminPaymentsPage />
                    </AdminRoute>
                )}
            />
            <Route
                path="admin/settings"
                element={(
                    <AdminRoute>
                        <AdminSettingsPage />
                    </AdminRoute>
                )}
            />
            <Route path="*" element={<Navigate to={PAGE_ROUTES.lessons} replace />} />
        </Route>
    </Routes>
  );
}