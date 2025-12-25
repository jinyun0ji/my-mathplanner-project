import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import AppShell from './AppShell';
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
import {
    ROLE,
    isParentRole,
    isStudentRole,
    isAdminRole,
    isStaffRole,
    isStaffOrTeachingRole,
    isViewerGroupRole,
} from '../constants/roles';
import { db } from '../firebase/client';
import { loadStaffDataOnce, loadViewerDataOnce } from '../data/firestoreSync';
import { createLinkCode, createStaffUser } from '../admin/staffService';
import { claimStudentLinkCode } from '../parent/linkCodeService';
import { useParentContext } from '../parent';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    setDoc,
    serverTimestamp,
    updateDoc,
} from 'firebase/firestore';

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

export default function AppRoutes({ user, role, studentIds }) {
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
      studentIds: parentStudentIds,
      loading: parentLoading,
  } = useParentContext();
  const parentStudentId = isParentRole(role) ? parentActiveStudentId : null;

  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);

  const [lessonLogs, setLessonLogs] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [clinicLogs, setClinicLogs] = useState([]);
  const [workLogs, setWorkLogs] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [tests, setTests] = useState([]);
  const [homeworkAssignments, setHomeworkAssignments] = useState([]);
  const [paymentLogs, setPaymentLogs] = useState([]);
  const [externalSchedules, setExternalSchedules] = useState([]);

  const [grades, setGrades] = useState({});
  const [homeworkResults, setHomeworkResults] = useState({});
  const [studentMemos, setStudentMemos] = useState({});
  const [videoProgress, setVideoProgress] = useState({});

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [videoBookmarks, setVideoBookmarks] = useState(() => {
      try { return JSON.parse(localStorage.getItem('videoBookmarks')) || {}; }
      catch (e) { return {}; }
  });
  useEffect(() => {
      if (isAuthenticated) processedAnnouncementIdsRef.current = new Set();
  }, [isAuthenticated, userId]);

  useEffect(() => {
  if (!isAuthenticated || !role || !isStaffRole) return;
      loadStaffDataOnce({
          db,
          isLoggedIn: isAuthenticated,
          userRole: role,
          pageKey: page,
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
    }, [db, isAuthenticated, role, page, isStaffRole]);

  useEffect(() => {
      const state = { cancelled: false };
      loadViewerDataOnce({
          db,
          isLoggedIn: isAuthenticated,
          userRole: role,
          userId,
          activeStudentId: isParentRole(role) ? parentActiveStudentId : null,
          setStudents,
          setClasses,
          setLessonLogs,
          setAttendanceLogs,
          setClinicLogs,
          setHomeworkAssignments,
          setAnnouncements,
          setTests,
          setVideoProgress,
          setExternalSchedules,
          setHomeworkResults,
          setGrades,
          isCancelled: () => state.cancelled,
      });
      return () => { state.cancelled = true; };
  }, [db, isAuthenticated, role, userId, parentActiveStudentId]);

  useEffect(() => {
      try { localStorage.setItem('videoBookmarks', JSON.stringify(videoBookmarks)); }
      catch (e) {}
  }, [videoBookmarks]);

  useEffect(() => {
      const memoMap = {};
      students.forEach((student) => {
          if (student?.memo) {
              memoMap[student.id] = student.memo;
          }
      });
      setStudentMemos(memoMap);
  }, [students]);

  const [studentMessages, setStudentMessages] = useState([
      { id: 1, roomId: 'teacher-room', senderRole: 'teacher', displayName: '채수용T', text: '철수야, 오늘 클리닉 늦을 것 같니?', date: '2025-11-29', time: '13:50', isMe: false },
  ]);
  const processedAnnouncementIdsRef = useRef(new Set());

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [isMessengerOpen, setIsMessengerOpen] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(true);
  const [pendingQuickAction, setPendingQuickAction] = useState(null);

  const toggleSidebar = () => { setIsSidebarOpen(prev => !prev); if (!isSidebarOpen) { setHasNewNotifications(false); setIsMessengerOpen(false); } };
  const toggleMessenger = () => { setIsMessengerOpen(prev => !prev); if (!isMessengerOpen) { setHasNewMessages(false); setIsSidebarOpen(false); } };

  useEffect(() => {
      if (!announcements || announcements.length === 0) return;
      if (!isViewerGroupRole(role)) return;

      const processed = processedAnnouncementIdsRef.current;
      const newMessages = [];

      const announcementTargets = isParentRole(role)
          ? studentIds
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
  }, [announcements, role, userId, studentIds]);

  const logNotification = useCallback((type, message, details) => {
      setNotifications(prev => [{ id: Date.now(), type, message, details, timestamp: new Date().toLocaleTimeString('ko-KR') }, ...prev]);
      setHasNewNotifications(true);
  }, []);

  const handleSavePayment = async (paymentData) => {
      ensureFirestoreContext();
      try {
          const docRef = await addDoc(collection(db, 'payments'), {
              ...paymentData,
              createdAt: serverTimestamp(),
              createdBy: userId,
              updatedAt: serverTimestamp(),
              updatedBy: userId,
          });
          setPaymentLogs(prev => [{ ...paymentData, id: docRef.id }, ...prev]);
          logNotification('success', '결제 기록 저장', `${paymentData.studentName} 학생 결제 완료`);
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('결제 기록 저장에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };

  const handleCreateLinkCode = async ({ studentId }) => {
      const normalizedId = typeof studentId === 'string' ? studentId.trim() : '';
      if (!normalizedId) throw new Error('학생 ID를 입력해주세요.');
      return createLinkCode({ studentId: normalizedId });
  };

  const handleSaveStudent = async (data, isEdit) => {
      ensureFirestoreContext();
      try {
          const payload = {
              ...stripId(data),
              authUid: data.studentId || data.authUid || null,
          };
          const studentPayload = {
              ...payload,
              role: ROLE.STUDENT,
              active: payload.active !== false,
              classIds: payload.classes || [],
          };
          if (isEdit) {
              if (!data.id) throw new Error('학생 ID가 없습니다.');
              await updateDoc(doc(db, 'users', data.id), {
                  ...studentPayload,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setStudents(prev => prev.map(s => s.id === data.id ? { ...s, ...studentPayload } : s));
          } else {
              const docRef = await addDoc(collection(db, 'users'), {
                  ...studentPayload,
                  createdAt: serverTimestamp(),
                  createdBy: userId,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setStudents(prev => [...prev, { id: docRef.id, ...studentPayload }]);
          }
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          throw error;
      }
  };
  const handleDeleteStudent = async (id) => {
      ensureFirestoreContext();
      try {
          await deleteDoc(doc(db, 'users', id));
          setStudents(prev => prev.filter(s => s.id !== id));
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('학생 삭제에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };
  const ensureFirestoreContext = () => {
      if (!db || !userId) {
          throw new Error('DB 또는 사용자 없음');
      }
  };

  const stripId = (data) => {
      const { id, ...rest } = data;
      return rest;
  };

  const handleSaveClass = async (data, isEdit) => {
      ensureFirestoreContext();
      try {
          const payload = stripId(data);
          if (isEdit) {
              if (!data.id) throw new Error('클래스 ID가 없습니다.');
              await updateDoc(doc(db, 'classes', data.id), {
                  ...payload,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
            setClasses(prev => prev.map(c => c.id === data.id ? { ...c, ...payload } : c));
          } else {
              const docRef = await addDoc(collection(db, 'classes'), {
                  ...payload,
                  createdAt: serverTimestamp(),
                  createdBy: userId,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setClasses(prev => [...prev, { id: docRef.id, ...payload }]);
          }
          console.log('✅ 클래스 Firestore 저장 성공');
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          throw error;
      }
  };

  const handleSaveLessonLog = async (data, isEdit) => {
      ensureFirestoreContext();
      try {
          const { file, ...payloadWithoutFile } = stripId(data);
          if (isEdit) {
              if (!data.id) throw new Error('수업 일지 ID가 없습니다.');
              await updateDoc(doc(db, 'lessonLogs', data.id), {
                  ...payloadWithoutFile,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setLessonLogs(prev => prev.map(l => l.id === data.id ? { ...l, ...payloadWithoutFile } : l));
          } else {
              const docRef = await addDoc(collection(db, 'lessonLogs'), {
                  ...payloadWithoutFile,
                  createdAt: serverTimestamp(),
                  createdBy: userId,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setLessonLogs(prev => [{ id: docRef.id, ...payloadWithoutFile }, ...prev]);
          }
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          throw error;
      }
  };

  const handleDeleteLessonLog = async (id) => {
      try {
          ensureFirestoreContext();
          await deleteDoc(doc(db, 'lessonLogs', id));
          setLessonLogs(prev => prev.filter(l => l.id !== id));
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('수업 일지 삭제에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };

  const handleSaveAttendance = async (records) => {
      ensureFirestoreContext();
      try {
          const nextLogs = [...attendanceLogs];
          for (const record of records) {
              const docId = record.id || `${record.classId}_${record.studentId}_${record.date}`;
              const payload = {
                  ...record,
                  studentUid: record.studentId,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              };
              await setDoc(doc(db, 'attendanceLogs', docId), payload, { merge: true });
              const existingIndex = nextLogs.findIndex((log) => log.id === docId);
              const nextRecord = { ...record, id: docId, studentUid: record.studentId };
              if (existingIndex >= 0) {
                  nextLogs[existingIndex] = nextRecord;
              } else {
                  nextLogs.push(nextRecord);
              }
          }
          setAttendanceLogs(nextLogs);
          logNotification('success', '출결 저장', '출결 기록이 저장되었습니다.');
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('출결 저장에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };

  const handleSaveHomeworkAssignment = async (data, isEdit) => {
      ensureFirestoreContext();
      try {
          const payload = stripId(data);
          if (isEdit) {
              if (!data.id) throw new Error('과제 ID가 없습니다.');
              await updateDoc(doc(db, 'homeworkAssignments', data.id), {
                  ...payload,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setHomeworkAssignments(prev => prev.map(h => h.id === data.id ? { ...h, ...payload } : h));
          } else {
              const docRef = await addDoc(collection(db, 'homeworkAssignments'), {
                  ...payload,
                  createdAt: serverTimestamp(),
                  createdBy: userId,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setHomeworkAssignments(prev => [{ id: docRef.id, ...payload }, ...prev]);
          }
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          throw error;
      }
  };

  const handleDeleteHomeworkAssignment = async (id) => {
      try {
          ensureFirestoreContext();
          await deleteDoc(doc(db, 'homeworkAssignments', id));
          setHomeworkAssignments(prev => prev.filter(h => h.id !== id));
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('과제 삭제에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };
  const handleUpdateHomeworkResult = async (updates) => {
      ensureFirestoreContext();
      try {
          const grouped = new Map();
          updates.forEach(({ studentId, assignmentId, questionId, status }) => {
              const key = `${studentId}_${assignmentId}`;
              if (!grouped.has(key)) {
                  grouped.set(key, { studentId, assignmentId, results: {} });
              }
              grouped.get(key).results[questionId] = status;
          });

          const nextResults = { ...homeworkResults };

          for (const { studentId, assignmentId, results } of grouped.values()) {
              const existing = nextResults[studentId]?.[assignmentId] || {};
              const mergedResults = { ...existing, ...results };
              const docId = `${studentId}_${assignmentId}`;

              await setDoc(doc(db, 'homeworkResults', docId), {
                  authUid: studentId,
                  assignmentId,
                  results: mergedResults,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              }, { merge: true });

              if (!nextResults[studentId]) nextResults[studentId] = {};
              nextResults[studentId][assignmentId] = mergedResults;
          }

          setHomeworkResults(nextResults);
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('과제 채점 결과 저장에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };

  const handleSaveTest = async (data, isEdit) => {
      ensureFirestoreContext();
      try {
          const payload = stripId(data);
          if (isEdit) {
              if (!data.id) throw new Error('시험 ID가 없습니다.');
              await updateDoc(doc(db, 'tests', data.id), {
                  ...payload,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setTests(prev => prev.map(t => t.id === data.id ? { ...t, ...payload } : t));
          } else {
              const docRef = await addDoc(collection(db, 'tests'), {
                  ...payload,
                  createdAt: serverTimestamp(),
                  createdBy: userId,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setTests(prev => [...prev, { id: docRef.id, ...payload }]);
          }
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          throw error;
      }
  };

  const handleDeleteTest = async (id) => {
      try {
          ensureFirestoreContext();
          await deleteDoc(doc(db, 'tests', id));
          setTests(prev => prev.filter(t => t.id !== id));
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('시험 삭제에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };
  const handleUpdateGrade = async (studentId, testId, result, comment) => {
      ensureFirestoreContext();
      try {
          const docId = `${studentId}_${testId}`;
          const isAbsent = result === '미응시';
          const payload = {
              authUid: studentId,
              testId,
              score: isAbsent ? null : 0,
              correctCount: isAbsent ? {} : result,
              comment: comment || '',
              updatedAt: serverTimestamp(),
              updatedBy: userId,
          };
          await setDoc(doc(db, 'grades', docId), payload, { merge: true });
          setGrades(prev => ({
              ...prev,
              [studentId]: { ...prev[studentId], [testId]: payload },
          }));
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('성적 저장에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };

  const handleSaveClinicLog = async (data, isEdit) => {
      ensureFirestoreContext();
      try {
          const payload = stripId(data);
          if (isEdit) {
              if (!data.id) throw new Error('클리닉 로그 ID가 없습니다.');
              await updateDoc(doc(db, 'clinicLogs', data.id), {
                  ...payload,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setClinicLogs(prev => prev.map(l => l.id === data.id ? { ...l, ...payload } : l));
          } else {
              const docRef = await addDoc(collection(db, 'clinicLogs'), {
                  ...payload,
                  createdAt: serverTimestamp(),
                  createdBy: userId,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setClinicLogs(prev => [...prev, { id: docRef.id, ...payload }]);
          }
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('클리닉 기록 저장에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };
  const handleDeleteClinicLog = async (id) => {
      ensureFirestoreContext();
      try {
          await deleteDoc(doc(db, 'clinicLogs', id));
          setClinicLogs(prev => prev.filter(l => l.id !== id));
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('클리닉 기록 삭제에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };

  const handleSaveAnnouncement = async (data, isEdit) => {
      ensureFirestoreContext();
      try {
          const payload = stripId(data);
          if (isEdit) {
              if (!data.id) throw new Error('공지사항 ID가 없습니다.');
              await updateDoc(doc(db, 'announcements', data.id), {
                  ...payload,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setAnnouncements(prev => prev.map(a => a.id === data.id ? { ...a, ...payload } : a));
          } else {
              const docRef = await addDoc(collection(db, 'announcements'), {
                  ...payload,
                  createdAt: serverTimestamp(),
                  createdBy: userId,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setAnnouncements(prev => [{ id: docRef.id, ...payload }, ...prev]);
          }
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          throw error;
      }
  };

  const handleDeleteAnnouncement = async (id) => {
      try {
          ensureFirestoreContext();
          await deleteDoc(doc(db, 'announcements', id));
          setAnnouncements(prev => prev.filter(a => a.id !== id));
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('공지사항 삭제에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };
  const handleSaveWorkLog = async (data, isEdit) => {
      ensureFirestoreContext();
      try {
          const payload = stripId(data);
          if (isEdit) {
              if (!data.id) throw new Error('근무 일지 ID가 없습니다.');
              await updateDoc(doc(db, 'workLogs', data.id), {
                  ...payload,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setWorkLogs(prev => prev.map(l => l.id === data.id ? { ...l, ...payload } : l));
          } else {
              const docRef = await addDoc(collection(db, 'workLogs'), {
                  ...payload,
                  createdAt: serverTimestamp(),
                  createdBy: userId,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setWorkLogs(prev => [...prev, { id: docRef.id, ...payload }]);
          }
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('근무 일지 저장에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };
  const handleDeleteWorkLog = async (id) => {
      ensureFirestoreContext();
      try {
          await deleteDoc(doc(db, 'workLogs', id));
          setWorkLogs(prev => prev.filter(l => l.id !== id));
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('근무 일지 삭제에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };

  const handleSaveVideoProgress = async (sId, lId, data) => {
      ensureFirestoreContext();
      try {
          const docId = `${sId}_${lId}`;
          await setDoc(doc(db, 'videoProgress', docId), {
              authUid: sId,
              lessonId: lId,
              ...data,
              updatedAt: serverTimestamp(),
          }, { merge: true });
          setVideoProgress(prev => ({ ...prev, [sId]: { ...prev[sId], [lId]: data } }));
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
      }
  };
  const handleSaveBookmark = (sId, lId, bm) => setVideoBookmarks(prev => ({ ...prev, [sId]: { ...prev[sId], [lId]: [...(prev[sId]?.[lId] || []), bm] } }));
  const handleSaveMemo = async (sId, content) => {
      ensureFirestoreContext();
      try {
          await updateDoc(doc(db, 'users', sId), {
              memo: content,
              updatedAt: serverTimestamp(),
              updatedBy: userId,
          });
          setStudentMemos(prev => ({ ...prev, [sId]: content }));
          setStudents(prev => prev.map(s => s.id === sId ? { ...s, memo: content } : s));
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('메모 저장에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };

  const handleSaveExternalSchedule = async (data) => {
      ensureFirestoreContext();
      try {
          const payload = { ...stripId(data), authUid: data.authUid || userId };
          if (data.id) {
              await updateDoc(doc(db, 'externalSchedules', data.id), {
                  ...payload,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setExternalSchedules(prev => prev.map(s => s.id === data.id ? { ...s, ...payload } : s));
          } else {
              const docRef = await addDoc(collection(db, 'externalSchedules'), {
                  ...payload,
                  authUid: userId,
                  createdAt: serverTimestamp(),
                  createdBy: userId,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setExternalSchedules(prev => [...prev, { id: docRef.id, ...payload, authUid: userId }]);
          }
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('외부 일정 저장에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };
  const handleDeleteExternalSchedule = async (id) => {
      ensureFirestoreContext();
      try {
          await deleteDoc(doc(db, 'externalSchedules', id));
          setExternalSchedules(prev => prev.filter(s => s.id !== id));
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('외부 일정 삭제에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };

  const handleSendStudentNotification = async (sId, title, content) => {
      try {
          await handleSaveAnnouncement({ title, content, targetStudents: [sId], date: new Date().toISOString().slice(0,10), author:'알림봇' }, false);
      } catch (error) {
          alert('공지사항 전송에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };

  const handleCreateStaffUser = async ({ email, role }) => {
      const result = await createStaffUser({ email, role });
      logNotification('success', '직원 계정 생성', `${email} 계정이 생성되었습니다.`);
      return result;
  };

  const getClassesNames = useCallback((ids) => ids.map(id => classes.find(c => String(c.id) === String(id))?.name).join(', '), [classes]);

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

  if (isStudentRole(role)) return <StudentHome studentId={userId} userId={userId} students={students} classes={classes} homeworkAssignments={homeworkAssignments} homeworkResults={homeworkResults} attendanceLogs={attendanceLogs} lessonLogs={lessonLogs} notices={announcements} tests={tests} grades={grades} videoProgress={videoProgress} onSaveVideoProgress={handleSaveVideoProgress} videoBookmarks={videoBookmarks} onSaveBookmark={handleSaveBookmark} externalSchedules={externalSchedules} onSaveExternalSchedule={handleSaveExternalSchedule} onDeleteExternalSchedule={handleDeleteExternalSchedule} clinicLogs={clinicLogs} onUpdateStudent={handleSaveStudent} messages={studentMessages} onSendMessage={() => {}} onLogout={handleLogout} />;
  if (isParentRole(role)) {
      if (parentLoading) {
          return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
      }
      if (!parentStudentIds || parentStudentIds.length === 0) {
          return <OnboardingPage onSubmitLinkCode={handleClaimLinkCode} />;
      }
      if (parentStudentIds.length > 1 && !parentStudentId) {
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
    getClassesNames,
    handleSaveStudent, handleDeleteStudent, handleSaveClass, handleSaveLessonLog, handleDeleteLessonLog,
    handleSaveAttendance, handleSaveHomeworkAssignment, handleDeleteHomeworkAssignment, handleUpdateHomeworkResult,
    handleSaveTest, handleDeleteTest, handleUpdateGrade, handleSaveMemo,
    handleSaveAnnouncement, handleDeleteAnnouncement, handleSaveWorkLog, handleDeleteWorkLog, handleSaveClinicLog, handleDeleteClinicLog,
    handleSavePayment,
    calculateClassSessions, handlePageChange, logNotification, notifications,
    calculateGradeComparison, calculateHomeworkStats,
    setIsGlobalDirty, studentSearchTerm, setStudentSearchTerm, handleSendStudentNotification,
    externalSchedules, pendingQuickAction, clearPendingQuickAction: () => setPendingQuickAction(null), onQuickAction: handleQuickAction,
    onCreateStaffUser: isAdminRole(role) ? handleCreateStaffUser : null,
    onCreateLinkCode: isStaffRole(role) ? handleCreateLinkCode : null,
    userRole: role,
    userId,
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