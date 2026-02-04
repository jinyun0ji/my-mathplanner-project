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
import ClosureManagement from '../pages/ClosureManagement';
import InternalCommunication from '../pages/InternalCommunication';
import PaymentManagement from '../pages/PaymentManagement';
import ParentHome from '../pages/ParentHome';
import ParentStudentPicker from '../pages/parent/ParentStudentPicker';
import OnboardingPage from '../pages/OnboardingPage';
import StaffManagement from '../pages/admin/StaffManagement';
import AdminNotificationsPage from '../pages/admin/AdminNotificationsPage';
import AdminPaymentsPage from '../pages/admin/AdminPaymentsPage';
import AdminSettingsPage from '../pages/admin/AdminSettingsPage';
import InviteManagementPage from '../pages/admin/InviteManagementPage';
import AdminRoute from '../routes/AdminRoute';
import StaffOrTeachingRoute from '../routes/StaffOrTeachingRoute';
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
import { addVideoMemo, deleteVideoMemo, updateVideoMemo } from '../domain/memo/videoMemo.service';
import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    setDoc,
    serverTimestamp,
    Timestamp,
    where,
    updateDoc,
    writeBatch,
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
    closures: '/closures',
};

const ADMIN_ROUTES = new Set([
    '/admin/staff',
    '/admin/invites',
    '/admin/notifications',
    '/admin/payments',
    '/admin/settings',
    '/staff/invites',
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
    if (pageKey.startsWith('/')) return pageKey;
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
  const [parents, setParents] = useState([]);
  const [classes, setClasses] = useState([]);

  const [lessonLogs, setLessonLogs] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [clinicLogs, setClinicLogs] = useState([]);
  const [workLogs, setWorkLogs] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [tests, setTests] = useState([]);
  const [homeworkAssignments, setHomeworkAssignments] = useState([]);
  const [paymentLogs, setPaymentLogs] = useState([]);
  const [isPaymentLogsLoading, setIsPaymentLogsLoading] = useState(false);
  const [externalSchedules, setExternalSchedules] = useState([]);
  const [closures, setClosures] = useState([]);

  const [grades, setGrades] = useState({});
  const [classTestStats, setClassTestStats] = useState({});
  const [homeworkResults, setHomeworkResults] = useState({});
  const [studentMemos, setStudentMemos] = useState({});
  const [videoProgress, setVideoProgress] = useState({});
  const [videoMemos, setVideoMemos] = useState({});

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const processedAnnouncementIdsRef = useRef(new Set());

  useEffect(() => {
      if (isAuthenticated) processedAnnouncementIdsRef.current = new Set();
  }, [isAuthenticated, userId]);

  useEffect(() => {
    if (!isAuthenticated || !role || !(isAdminRole(role) || isStaffRole(role) || isStaffOrTeachingRole(role))) return;
    const shouldLoadPayments = page === 'payment';
    if (shouldLoadPayments) {
        setIsPaymentLogsLoading(true);
    }
    let isActive = true;
    loadStaffDataOnce({
        db,
        isLoggedIn: isAuthenticated,
        userRole: role,
        pageKey: page,
        setStudents: page === 'attendance' ? null : setStudents,
        setParents,
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
        setExternalSchedules,
        setClosures,
    }).finally(() => {
        if (shouldLoadPayments && isActive) {
            setIsPaymentLogsLoading(false);
        }
    });
    return () => {
        isActive = false;
    };
  }, [db, isAuthenticated, role, page]);

  // ✅✅✅ [수정] 학생(STUDENT)도 viewer 로딩을 타도록
  useEffect(() => {
    if (!isAuthenticated || !role) return;

    const shouldLoadViewerData = isViewerGroupRole(role) || isStudentRole(role);
    if (!shouldLoadViewerData) return;

    const state = { cancelled: false };

    // 학생이면 본인 uid만 대상으로 로딩
    const resolvedStudentIds = isStudentRole(role)
      ? (studentIds || [])
      : (studentIds || []);

    loadViewerDataOnce({
        db,
        isLoggedIn: isAuthenticated,
        userRole: role,
        userId,
        studentIds: resolvedStudentIds,
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
        setVideoMemos,
        setExternalSchedules,
        setHomeworkResults,
        setGrades,
        setClosures,
        setClassTestStats,
        isCancelled: () => state.cancelled,
    });

    return () => { state.cancelled = true; };
  }, [db, isAuthenticated, role, userId, parentActiveStudentId, studentIds]);

  useEffect(() => {
      const memoMap = {};
      students.forEach((student) => {
          if (student?.memo) {
              memoMap[student.id] = student.memo;
          }
      });
      setStudentMemos(memoMap);
  }, [students]);

  const calculateClassSessionsWithClosures = useCallback(
      (cls) => calculateClassSessions(cls, closures),
      [closures],
  );

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [isMessengerOpen, setIsMessengerOpen] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(true);
  const [studentMessages, setStudentMessages] = useState([]);
  const [pendingQuickAction, setPendingQuickAction] = useState(null);

  const toggleSidebar = () => { setIsSidebarOpen(prev => !prev); if (!isSidebarOpen) { setHasNewNotifications(false); setIsMessengerOpen(false); } };
  const toggleMessenger = () => { setIsMessengerOpen(prev => !prev); if (!isMessengerOpen) { setHasNewMessages(false); setIsSidebarOpen(false); } };

  useEffect(() => {
      if (!announcements || announcements.length === 0) return;
      if (!isViewerGroupRole(role)) return;

      const processed = processedAnnouncementIdsRef.current;
      const newMessages = [];

      const announcementTargetStudentIds = Array.isArray(studentIds) ? studentIds : [];
      const announcementTargetAuthUids = isParentRole(role)
          ? students
              .filter((s) => announcementTargetStudentIds.includes(s.id))
              .map((s) => s.authUid)
              .filter(Boolean)
          : userId
              ? [userId]
              : [];
              const announcementTargetClassIds = students
          .filter((s) => announcementTargetStudentIds.includes(s.id))
          .flatMap((s) => {
              if (Array.isArray(s.classes)) return s.classes;
              if (Array.isArray(s.classIds)) return s.classIds;
              return [];
          })
          .map(String);

      announcements.forEach((notice) => {
          if (!notice?.id || processed.has(notice.id)) return;
          const matchesAuthTarget = Array.isArray(notice?.targetAuthUids)
              && notice.targetAuthUids.some((uid) => announcementTargetAuthUids.includes(uid));
          const hasAuthTargets = Array.isArray(notice?.targetAuthUids) && notice.targetAuthUids.length > 0;
          const matchesStudentTarget = Array.isArray(notice?.targetStudents)
              && announcementTargetStudentIds.some((id) => notice.targetStudents.includes(id));
          const hasStudentTargets = Array.isArray(notice?.targetStudents) && notice.targetStudents.length > 0;
          const targetClasses = Array.isArray(notice?.targetClasses)
              ? notice.targetClasses.map(String)
              : [];
          const hasClassTargets = targetClasses.length > 0;
          const matchesClassTarget = hasClassTargets
              && targetClasses.some((classId) => announcementTargetClassIds.includes(classId));

          const isTargetedToUser = notice?.isPublic === true
              || (hasClassTargets
                  ? matchesClassTarget
                  : (hasAuthTargets ? matchesAuthTarget : (hasStudentTargets ? matchesStudentTarget : false)));
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
  }, [announcements, role, userId, studentIds, students]);

  const logNotification = useCallback((type, message, details) => {
      setNotifications(prev => [{ id: Date.now(), type, message, details, timestamp: new Date().toLocaleTimeString('ko-KR') }, ...prev]);
      setHasNewNotifications(true);
  }, []);

  const formatPaymentDate = (value) => {
      if (!value) return '';
      if (typeof value === 'string') return value;
      if (typeof value?.toDate === 'function') {
          return value.toDate().toISOString().slice(0, 10);
      }
      try {
          return new Date(value).toISOString().slice(0, 10);
      } catch (error) {
          return '';
      }
  };

  const normalizePaymentLog = (log) => {
      if (!log) return log;
      const base = log.studentId
          ? log
          : log.authUid
              ? { ...log, studentId: log.authUid }
              : log.studentUid
                  ? { ...log, studentId: log.studentUid }
                  : log;
      const firstItem = Array.isArray(base.items) ? base.items[0] : null;
      const itemAmount = firstItem && Number.isFinite(firstItem.price)
          ? firstItem.price * (Number(firstItem.quantity) || 1)
          : 0;
      const amount = Number.isFinite(base.amount) ? base.amount : itemAmount;
      const date = base.date || formatPaymentDate(base.createdAt);
      return {
          ...base,
          amount,
          date,
          status: base.status || 'paid',
          studentName: base.studentName || base.payerName,
          bookName: base.bookName || base.bookTitle || firstItem?.title || firstItem?.name,
      };
  };

  const normalizeClinicDateString = (value) => {
      if (!value) return '';
      if (typeof value === 'string') {
          const trimmed = value.trim();
          if (!trimmed) return '';
          const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (match) return `${match[1]}-${match[2]}-${match[3]}`;
          const parsed = new Date(trimmed);
          if (!Number.isNaN(parsed.getTime())) {
              return parsed.toISOString().slice(0, 10);
          }
          return '';
      }
      if (typeof value?.toDate === 'function') {
          return value.toDate().toISOString().slice(0, 10);
      }
      if (value instanceof Date) {
          return value.toISOString().slice(0, 10);
      }
      try {
          return new Date(value).toISOString().slice(0, 10);
      } catch (error) {
          return '';
      }
  };

  const resolveClinicEffectiveDate = (log) => {
      if (!log) return '';
      const date = normalizeClinicDateString(log.date);
      if (date) return date;
      const clinicDate = normalizeClinicDateString(log.clinicDate);
      if (clinicDate) return clinicDate;
      const createdAt = normalizeClinicDateString(log.createdAt);
      if (createdAt) return createdAt;
      return '';
  };

  const normalizeClinicLog = (log) => {
      if (!log) return log;
      return {
          ...log,
          effectiveDate: resolveClinicEffectiveDate(log),
      };
  };

  const refreshPaymentLogs = useCallback(async () => {
      ensureFirestoreContext();
      setIsPaymentLogsLoading(true);
      try {
          const paymentQuery = query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(150));
          const snapshot = await getDocs(paymentQuery);
          const logs = snapshot.docs.map((docSnap) => normalizePaymentLog({ id: docSnap.id, ...docSnap.data() }));
          setPaymentLogs(logs);
      } finally {
          setIsPaymentLogsLoading(false);
      }
  }, [db, userId]);

  const handleSavePayment = async (paymentData) => {
      ensureFirestoreContext();
      const studentId = paymentData?.studentId ? String(paymentData.studentId) : '';
      const classId = paymentData?.classId ? String(paymentData.classId) : '';
      if (!studentId || !classId) {
          alert('결제 저장에 필요한 학생/반 정보를 확인해주세요.');
          return { success: false };
      }
      try {
        const normalizedItems = Array.isArray(paymentData?.items)
              ? paymentData.items.map((item) => ({
                  bookId: item?.bookId ? String(item.bookId) : '',
                  quantity: Number.isFinite(item?.quantity) ? item.quantity : Number(item?.quantity) || 1,
                  price: Number.isFinite(item?.price) ? item.price : Number(item?.price) || 0,
                  title: item?.title || item?.name || '',
              }))
              : undefined;
          const itemsAmount = Array.isArray(normalizedItems)
              ? normalizedItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0)
              : 0;
          const amount = Number.isFinite(paymentData?.amount)
              ? paymentData.amount
              : Number(paymentData?.amount) || itemsAmount;
          const normalizedPayload = {
              ...paymentData,
              studentId,
              classId,
              amount,
              items: normalizedItems,
              status: paymentData?.status || 'paid',
              type: paymentData?.type || 'book',
              createdAt: serverTimestamp(),
              createdBy: userId,
              updatedAt: serverTimestamp(),
              updatedBy: userId,
           };
          const docRef = await addDoc(collection(db, 'payments'), normalizedPayload);
          await refreshPaymentLogs();
          logNotification('success', '결제 기록 저장', `${paymentData.studentName || '학생'} 결제 완료`);
          return { success: true, id: docRef.id };
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('결제 기록 저장에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
          return { success: false, error };
      }
  };

  const handleUpdatePayment = async (paymentId, updates) => {
      ensureFirestoreContext();
      try {
          await updateDoc(doc(db, 'payments', paymentId), {
              ...updates,
              updatedAt: serverTimestamp(),
              updatedBy: userId,
          });
          await refreshPaymentLogs();
          logNotification('success', '결제 기록 수정', '결제 정보가 업데이트되었습니다.');
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('결제 기록 수정에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };

  const handleCreateLinkCode = async ({ studentId }) => {
      const normalizedId = typeof studentId === 'string' ? studentId.trim() : '';
      if (!normalizedId) throw new Error('학생 ID를 입력해주세요.');
      return createLinkCode({ studentId: normalizedId });
  };

  const normalizeYmd = (value) => {
      if (!value) return null;
      if (typeof value === 'string') {
          const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
          return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
      }
      try {
          const date = (typeof value?.toDate === 'function') ? value.toDate() : new Date(value);
          if (Number.isNaN(date.getTime())) return null;
          return date.toISOString().slice(0, 10);
      } catch {
          return null;
      }
  };

  const resolveStudentKeysForClassArray = (student, studentDocId) => {
      const keys = new Set();
      if (studentDocId) keys.add(String(studentDocId));
      if (student?.id) keys.add(String(student.id));
      if (student?.uid) keys.add(String(student.uid));
      if (student?.authUid) keys.add(String(student.authUid));
      return Array.from(keys).filter(Boolean);
  };

  const handleSaveStudent = async (data, isEdit) => {
      ensureFirestoreContext();
      try {
          const nextClassIds = Array.isArray(data.classes) ? data.classes : [];
          const {
              endDate,
              endReason,
              ...rest
          } = stripId(data);
          const normalizedStatus = data.status === 'inactive' ? '재원생' : (data.status || '재원생');
          const payload = {
              ...rest,
              status: normalizedStatus,
              authUid: data.studentId || data.authUid || null,
          };
          const studentPayload = {
              ...payload,
              role: ROLE.STUDENT,
              active: payload.active !== false,
              classIds: nextClassIds,
              uid: data.uid || data.id || payload.authUid || null,
          };
          const buildInitialClassStatusMap = (classIds = []) => {
              const map = {};
              classIds.forEach((classId) => {
                  const key = String(classId);
                  map[key] = {
                      status: '진행중',
                      joinedAt: serverTimestamp(),
                      endedAt: null,
                      endReason: null,
                  };
              });
              return map;
          };
          if (studentPayload.role !== ROLE.STUDENT) {
              throw new Error('학생 정보만 저장할 수 있습니다.');
          }
          if (isEdit) {
              if (!data.id) throw new Error('학생 ID가 없습니다.');
              const existingStudent = students.find((student) => student.id === data.id);
              const classArrayKeys = resolveStudentKeysForClassArray(existingStudent, data.id);
              const prevClassIds = Array.isArray(existingStudent?.classIds)
                  ? existingStudent.classIds
                  : (existingStudent?.classes || []);
              const classIdsToAdd = nextClassIds.filter((id) => !prevClassIds.includes(id));
              const classIdsToRemove = prevClassIds.filter((id) => !nextClassIds.includes(id));
              const hasTransfer = classIdsToAdd.length > 0 && classIdsToRemove.length > 0;
              const resolvedEndYmd = normalizeYmd(endDate);
              const resolvedEndedAt = resolvedEndYmd
                  ? Timestamp.fromDate(new Date(`${resolvedEndYmd}T00:00:00`))
                  : serverTimestamp();
              const resolvedRemovalReason = endReason || (hasTransfer ? '전반' : '중도퇴원');
              const resolvedRemovalStatus = endReason || (hasTransfer ? '전반' : '퇴원');
              const joinedAtValue = resolvedEndYmd
                  ? Timestamp.fromDate(new Date(`${resolvedEndYmd}T00:00:00`))
                  : serverTimestamp();
              const nextClassStatusMap = {
                  ...(existingStudent?.classStatusMap || existingStudent?.classStatuses || {}),
              };
              const batch = writeBatch(db);

              classIdsToAdd.forEach((classId) => {
                  batch.update(doc(db, 'classes', classId), {
                      students: arrayUnion(String(data.id)),
                  });
                  nextClassStatusMap[String(classId)] = {
                      status: '진행중',
                      joinedAt: hasTransfer ? joinedAtValue : serverTimestamp(),
                      endedAt: null,
                      endReason: null,
                  };
              });
              classIdsToRemove.forEach((classId) => {
                  batch.update(doc(db, 'classes', classId), {
                      students: arrayRemove(...classArrayKeys),
                  });
                  nextClassStatusMap[String(classId)] = {
                      ...(nextClassStatusMap[String(classId)] || {}),
                      status: resolvedRemovalStatus,
                      endedAt: resolvedEndedAt,
                      endReason: resolvedRemovalReason,
                  };
              });
              batch.set(doc(db, 'users', data.id), {
                  ...studentPayload,
                  classStatusMap: nextClassStatusMap,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              }, { merge: true });
              await batch.commit();
              console.log('학생 Firestore 저장 완료', data.id);
              setStudents(prev => prev.map(s => s.id === data.id ? {
                  ...s,
                  ...studentPayload,
                  classStatusMap: nextClassStatusMap,
              } : s));
          } else {
              const docRef = doc(collection(db, 'users'));
              const resolvedUid = studentPayload.uid || docRef.id;
              const createdClassStatusMap = buildInitialClassStatusMap(nextClassIds);
              const batch = writeBatch(db);
              batch.set(docRef, {
                  ...studentPayload,
                  uid: resolvedUid,
                  classStatusMap: createdClassStatusMap,
                  createdAt: serverTimestamp(),
                  createdBy: userId,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              if (nextClassIds.length > 0) {
                  nextClassIds.forEach((classId) => {
                      batch.update(doc(db, 'classes', classId), {
                          students: arrayUnion(resolvedUid),
                       });
                  });
              }
              await batch.commit();
              console.log('학생 Firestore 저장 완료', docRef.id);
              setStudents(prev => [...prev, { id: docRef.id, ...studentPayload, uid: resolvedUid, classStatusMap: createdClassStatusMap }]);
          }
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          throw error;
      }
  };
  const handleDeleteStudent = async (id) => {
      ensureFirestoreContext();
      try {
        const existingStudent = students.find((student) => student.id === id);
          const prevClassIds = Array.isArray(existingStudent?.classIds)
              ? existingStudent.classIds
              : (existingStudent?.classes || []);
          if (prevClassIds.length > 0) {
              await Promise.all(
                  prevClassIds.map((classId) => updateDoc(doc(db, 'classes', classId), {
                      students: arrayRemove(existingStudent.uid || id),
                  })),
              );
          }
          await deleteDoc(doc(db, 'users', id));
          setStudents(prev => prev.filter(s => s.id !== id));
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('학생 삭제에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };
  const handleUpdateStudentClassStatus = async ({ studentId, classId, status, endDate, endReason }) => {
      ensureFirestoreContext();
      const student = students.find((s) => s.id === studentId);
      if (!student) {
          throw new Error('학생 정보를 찾을 수 없습니다.');
      }
      const classIdStr = String(classId);
      const studentKeys = resolveStudentKeysForClassArray(student, studentId);
      const primaryKey = String(studentId);
      const prevClassIds = Array.isArray(student.classIds)
          ? student.classIds.map(String)
          : (Array.isArray(student.classes) ? student.classes.map(String) : []);
      let nextClassIds = [...prevClassIds];

      const normalizedStatus = status === '재원' ? '진행중' : status;
      const resolvedStatus = normalizedStatus === '퇴원'
          ? (endReason === '전반' ? '전반' : endReason === '종강' ? '종강' : '퇴원')
          : normalizedStatus;
      const isWithdrawnStatus = ['퇴원', '전반', '종강'].includes(resolvedStatus);
      const resolvedEndedAt = endDate ? Timestamp.fromDate(new Date(endDate)) : serverTimestamp();
      const resolvedEndReason = endReason ?? null;

      const updates = {
          updatedAt: serverTimestamp(),
          updatedBy: userId,
      };

      if (isWithdrawnStatus) {
        if (nextClassIds.includes(classIdStr)) {
              nextClassIds = nextClassIds.filter((id) => id !== classIdStr);
              updates.classIds = nextClassIds;
          }
          updates.classStatusMap = {
              [classIdStr]: {
                  status: resolvedStatus,
                  endedAt: resolvedEndedAt,
                  endReason: resolvedEndReason,
              },
          };
          await updateDoc(doc(db, 'classes', classIdStr), {
              students: arrayRemove(...studentKeys),
          });
      } else if (normalizedStatus === '진행중') {
          if (!nextClassIds.includes(classIdStr)) {
              nextClassIds = [...nextClassIds, classIdStr];
              updates.classIds = nextClassIds;
          }
          updates.classStatusMap = {
              [classIdStr]: {
                  status: '진행중',
                  joinedAt: serverTimestamp(),
                  endedAt: null,
                  endReason: null,
              },
          };
          await updateDoc(doc(db, 'classes', classIdStr), {
              students: arrayUnion(primaryKey),
          });
      } else {
          throw new Error('알 수 없는 상태입니다.');
      }

      await setDoc(doc(db, 'users', studentId), updates, { merge: true });

      setStudents((prev) => prev.map((s) => {
          if (s.id !== studentId) return s;
          const nextStatuses = { ...(s.classStatusMap || s.classStatuses || {}) };
          const resolvedEndedAtState = endDate ? new Date(endDate) : new Date();
          nextStatuses[classIdStr] = {
              ...(nextStatuses[classIdStr] || {}),
              status: resolvedStatus,
              joinedAt: normalizedStatus === '진행중' ? new Date() : nextStatuses[classIdStr]?.joinedAt,
              endedAt: isWithdrawnStatus ? resolvedEndedAtState : null,
              endReason: isWithdrawnStatus ? resolvedEndReason : null,
              updatedAt: new Date(),
          };
          return {
              ...s,
              classIds: nextClassIds,
              classes: nextClassIds,
              classStatusMap: nextStatuses,
          };
      }));
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
          const normalizedStudents = Array.isArray(payload.students) ? payload.students : [];
          const payloadWithDefaults = {
              ...payload,
              students: normalizedStudents,
          };
          if (isEdit) {
              if (!data.id) throw new Error('클래스 ID가 없습니다.');
              await updateDoc(doc(db, 'classes', data.id), {
                  ...payloadWithDefaults,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
            setClasses(prev => prev.map(c => c.id === data.id ? { ...c, ...payloadWithDefaults } : c));
          } else {
              const docRef = await addDoc(collection(db, 'classes'), {
                  ...payloadWithDefaults,
                  createdAt: serverTimestamp(),
                  createdBy: userId,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setClasses(prev => [...prev, { id: docRef.id, ...payloadWithDefaults }]);
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
          const payload = { type: data?.type || 'homework', ...stripId(data) };
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
  const handleUpdateHomeworkResult = async (updates, checkedDateInput = null) => {
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

          const toDateString = (v) => {
              if (!v) return null;
              if (typeof v === 'string') return v.slice(0, 10);
              if (typeof v?.toDate === 'function') return v.toDate().toISOString().slice(0, 10);
              try { return new Date(v).toISOString().slice(0, 10); } catch { return null; }
          };

          const checkedDate = toDateString(checkedDateInput) || new Date().toISOString().slice(0, 10);

          for (const { studentId, assignmentId, results } of grouped.values()) {
              const existing = nextResults[studentId]?.[assignmentId];
              const existingMap = existing?.results || existing || {};
              const mergedResults = { ...existingMap, ...results };
              Object.keys(mergedResults).forEach((key) => {
                  if (mergedResults[key] === null || mergedResults[key] === undefined) {
                      delete mergedResults[key];
                  }
              });
              const docId = `${studentId}_${assignmentId}`;

              const existingHistory = Array.isArray(existing?.checkHistory) ? existing.checkHistory : [];
              const nextHistory = [...existingHistory, { checkedDate, checkedBy: userId }];

              await setDoc(doc(db, 'homeworkResults', docId), {
                  authUid: studentId,
                  assignmentId,
                  results: mergedResults,
                  lastCheckedDate: checkedDate,
                  checkHistory: nextHistory,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              }, { merge: true });

              if (!nextResults[studentId]) nextResults[studentId] = {};
              nextResults[studentId][assignmentId] = {
                  ...(existing && typeof existing === 'object' ? existing : {}),
                  results: mergedResults,
                  lastCheckedDate: checkedDate,
                  checkHistory: nextHistory,
                  updatedAt: new Date().toISOString(),
              };
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
          const isCorrect = (v) =>
              v === true || v === 1 || v === '1' || v === 'O' || v === '맞음' || v === '고침';

          const computeWeightedScore = (resultMap, test) => {
              if (!resultMap || typeof resultMap !== 'object') return null;
              const entries = Object.entries(resultMap);
              if (entries.length === 0) return null;

              const qs = Array.isArray(test?.questionScores) ? test.questionScores : null;
              const fallback = (Number.isFinite(test?.maxScore) && Number.isFinite(test?.totalQuestions) && test.totalQuestions > 0)
                  ? (test.maxScore / test.totalQuestions)
                  : 0;

              let total = 0;
              for (const [qNum, v] of entries) {
                  if (!isCorrect(v)) continue;
                  const idx = Number(qNum) - 1;
                  const points = (qs && Number.isFinite(Number(qs[idx])))
                      ? Number(qs[idx])
                      : fallback;
                  total += points;
              }
              return total;
          };

          const findTestById = async () => {
              const cached = tests.find(t => t.id === testId);
              if (cached) return cached;
              const snapshot = await getDoc(doc(db, 'tests', testId));
              return snapshot.exists() ? { id: testId, ...snapshot.data() } : null;
          };

          const isAbsent = result === '미응시';

          let score = null;
          let totalScore = null;
          let attempted = false;
          let correctCount = {};

          if (!isAbsent && result && typeof result === 'object') {
              const test = await findTestById();
              const computedScore = computeWeightedScore(result, test);
              if (computedScore !== null) {
                  score = computedScore;
                  totalScore = computedScore;
                  attempted = true;
                  correctCount = result;
              }
          }

          const payload = {
              authUid: studentId,
              testId,
              score,
              totalScore,
              attempted,
              correctCount: isAbsent ? null : correctCount,
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
          const { effectiveDate, ...payload } = stripId(data);
          if (isEdit) {
              if (!data.id) throw new Error('클리닉 로그 ID가 없습니다.');
              await updateDoc(doc(db, 'clinicLogs', data.id), {
                  ...payload,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              const normalized = normalizeClinicLog({ id: data.id, ...payload });
              setClinicLogs(prev => prev.map(l => l.id === data.id ? { ...l, ...normalized } : l));
          } else {
              const docRef = await addDoc(collection(db, 'clinicLogs'), {
                  ...payload,
                  createdAt: serverTimestamp(),
                  createdBy: userId,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              const normalized = normalizeClinicLog({ id: docRef.id, ...payload });
              setClinicLogs(prev => [...prev, normalized]);
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

  const normalizeAnnouncementPayload = (data) => {
      const base = stripId(data);
      const targetClassesFromPayload = Array.isArray(base.targetClasses)
          ? base.targetClasses
          : Array.isArray(base.targetClassIds)
              ? base.targetClassIds
              : [];
      const targetClasses = targetClassesFromPayload.map((id) => String(id));
      const targetStudents = Array.isArray(base.targetStudents)
          ? base.targetStudents.map((id) => String(id))
          : [];
      const isPublic = targetClasses.length === 0;

      return {
          ...base,
          targetClasses,
          targetClassIds: targetClasses,
          targetStudents,
          isPublic,
      };
  };

  const handleSaveAnnouncement = async (data, isEdit) => {
      ensureFirestoreContext();
      try {
          const payload = normalizeAnnouncementPayload(data);
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
      const createdByName = user?.displayName || user?.name || user?.email || '알 수 없음';
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
            const logDate = payload.date || new Date().toISOString().slice(0, 10);
              const docRef = await addDoc(collection(db, 'workLogs'), {
                  ...payload,
                  date: logDate,
                  createdByUid: userId,
                  createdByName,
                  createdAt: serverTimestamp(),
                  createdBy: userId,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setWorkLogs(prev => [...prev, {
                  id: docRef.id,
                  ...payload,
                  date: logDate,
                  createdByUid: userId,
                  createdByName,
              }]);
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
          console.error('[Firestore WRITE ERROR][videoProgress]', error);
          alert('수강률 저장에 실패했습니다. 권한 또는 네트워크를 확인해주세요.');
      }
  };
  const handleAddVideoMemo = async (authUid, payload) => {
      ensureFirestoreContext();
      try {
          const created = await addVideoMemo(db, authUid, payload);
          const fallbackTimestamp = new Date();
          setVideoMemos((prev) => ({
              ...prev,
              [authUid]: [
                  { ...created, updatedAt: created.updatedAt || fallbackTimestamp },
                  ...(prev?.[authUid] || []),
              ],
          }));
      } catch (error) {
          console.error('[Firestore WRITE ERROR][videoMemo:add]', error);
          alert('학습 메모 저장에 실패했습니다. 네트워크를 확인해주세요.');
      }
  };
  const handleUpdateVideoMemo = async (authUid, memoId, patch) => {
      ensureFirestoreContext();
      try {
          await updateVideoMemo(db, authUid, memoId, patch);
          setVideoMemos((prev) => {
              const list = prev?.[authUid] || [];
              return {
                  ...prev,
                  [authUid]: list.map((memo) => memo.id === memoId
                      ? {
                          ...memo,
                          ...(patch.time !== undefined ? { time: Number(patch.time) || 0 } : {}),
                          ...(patch.note !== undefined ? { note: String(patch.note || '').trim() } : {}),
                          updatedAt: patch.updatedAt || new Date(),
                      }
                      : memo),
              };
          });
      } catch (error) {
          console.error('[Firestore WRITE ERROR][videoMemo:update]', error);
          alert('학습 메모 수정에 실패했습니다. 다시 시도해주세요.');
      }
  };
  const handleDeleteVideoMemo = async (authUid, memoId) => {
      ensureFirestoreContext();
      try {
          await deleteVideoMemo(db, authUid, memoId);
          setVideoMemos((prev) => ({
              ...prev,
              [authUid]: (prev?.[authUid] || []).filter((memo) => memo.id !== memoId),
          }));
      } catch (error) {
          console.error('[Firestore WRITE ERROR][videoMemo:delete]', error);
          alert('학습 메모 삭제에 실패했습니다. 다시 시도해주세요.');
      }
  };
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

  const resolveDefaultClassIdForStudent = useCallback((studentId) => {
      if (!studentId || !Array.isArray(classes)) return null;
      const matched = classes.find((cls) => Array.isArray(cls.students)
          && cls.students.map(String).includes(String(studentId)));
      return matched?.id || null;
  }, [classes]);

  const upsertVideoMakeupAssignment = useCallback(async (externalScheduleId, schedulePayload) => {
      if (!externalScheduleId || !schedulePayload?.studentId) return;
      const targetStudents = [schedulePayload.studentId].filter(Boolean);
      const classId = schedulePayload.classId || resolveDefaultClassIdForStudent(schedulePayload.studentId) || null;

      const assignmentBase = {
          type: 'video_makeup',
          title: schedulePayload.courseName || schedulePayload.academyName || '동영상 보강',
          content: schedulePayload.note || schedulePayload.courseName || '동영상 보강',
          classId,
          targetStudents,
          assignedStudentIds: targetStudents,
          students: targetStudents,
          assignedDate: schedulePayload.startDate || schedulePayload.date || new Date().toISOString().slice(0, 10),
          totalQuestions: 0,
          video: schedulePayload.video || schedulePayload.videoMeta || null,
          source: { externalScheduleId },
      };

      const existingSnap = await getDocs(
          query(
              collection(db, 'homeworkAssignments'),
              where('source.externalScheduleId', '==', externalScheduleId),
              limit(1),
          ),
      );

      if (existingSnap.empty) {
          const docRef = await addDoc(collection(db, 'homeworkAssignments'), {
              ...assignmentBase,
              createdAt: serverTimestamp(),
              createdBy: userId,
              updatedAt: serverTimestamp(),
              updatedBy: userId,
          });
          setHomeworkAssignments((prev) => [{ id: docRef.id, ...assignmentBase }, ...prev]);
      } else {
          const targetDoc = existingSnap.docs[0];
          await updateDoc(doc(db, 'homeworkAssignments', targetDoc.id), {
              ...assignmentBase,
              updatedAt: serverTimestamp(),
              updatedBy: userId,
          });
          setHomeworkAssignments((prev) => {
              const rest = prev.filter((h) => h.id !== targetDoc.id);
              return [{ id: targetDoc.id, ...targetDoc.data(), ...assignmentBase }, ...rest];
          });
      }
  }, [classes, resolveDefaultClassIdForStudent, userId]);

  const removeVideoMakeupAssignment = useCallback(async (externalScheduleId) => {
      if (!externalScheduleId) return;
      const snap = await getDocs(
          query(
              collection(db, 'homeworkAssignments'),
              where('source.externalScheduleId', '==', externalScheduleId),
              limit(3),
          ),
      );

      const docIds = snap.docs.map((d) => d.id);
      await Promise.all(docIds.map((id) => deleteDoc(doc(db, 'homeworkAssignments', id))));
      if (docIds.length > 0) {
          setHomeworkAssignments((prev) => prev.filter((h) => !docIds.includes(h.id)));
      }
  }, []);

  const handleSaveExternalSchedule = async (data) => {
      ensureFirestoreContext();
      try {
          const payload = { ...stripId(data), authUid: data.authUid || userId };
          let scheduleId = data.id;
          if (data.id) {
              await updateDoc(doc(db, 'externalSchedules', data.id), {
                  ...payload,
                  updatedAt: serverTimestamp(),
                  updatedBy: userId,
              });
              setExternalSchedules(prev => prev.map(s => s.id === data.id ? { ...s, ...payload } : s));
              scheduleId = data.id;
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
              scheduleId = docRef.id;
          }

          if (scheduleId) {
              await upsertVideoMakeupAssignment(scheduleId, payload);
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
          await removeVideoMakeupAssignment(id);
      } catch (error) {
          console.error('[Firestore WRITE ERROR]', error);
          alert('외부 일정 삭제에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      }
  };

  const handleSendStudentNotification = async (sId, title, content) => {
      try {
          const targetStudent = students.find((s) => s.id === sId);
          const targetAuthUid = targetStudent?.authUid;
          await handleSaveAnnouncement({
              title,
              content,
              isPublic: false,
              targetStudents: [sId],
              targetAuthUids: targetAuthUid ? [targetAuthUid] : [],
              date: new Date().toISOString().slice(0,10),
              author:'알림봇'
          }, false);
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

  // ✅ B안 기준: 학생은 무조건 users 문서ID(profileDocId)로 식별
    const studentId = useMemo(() => {
        if (!isStudentRole(role)) return null;
        return Array.isArray(studentIds) && studentIds.length > 0
            ? studentIds[0]
            : null;
    }, [role, studentIds]);

    const student = useMemo(() => {
        if (!studentId) return null;
        return students.find((s) => s.id === studentId) || null;
    }, [students, studentId]);

  if (isStudentRole(role)) {
      return (
          <StudentHome
              student={student}
              studentId={studentId}
              userId={userId}
              students={students}
              classes={classes}
              homeworkAssignments={homeworkAssignments}
              homeworkResults={homeworkResults}
              attendanceLogs={attendanceLogs}
              lessonLogs={lessonLogs}
              notices={announcements}
              tests={tests}
              grades={grades}
              classTestStats={classTestStats}
              videoProgress={videoProgress}
              onSaveVideoProgress={handleSaveVideoProgress}
              videoMemos={videoMemos}
              onAddMemo={handleAddVideoMemo}
              onUpdateMemo={handleUpdateVideoMemo}
              onDeleteMemo={handleDeleteVideoMemo}
              externalSchedules={externalSchedules}
              onSaveExternalSchedule={handleSaveExternalSchedule}
              onDeleteExternalSchedule={handleDeleteExternalSchedule}
              clinicLogs={clinicLogs}
              closures={closures}
              onUpdateStudent={handleSaveStudent}
              onLogout={handleLogout}
          />
      );
  }
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
      return <ParentHome userId={userId} students={students} classes={classes} homeworkAssignments={homeworkAssignments} homeworkResults={homeworkResults} attendanceLogs={attendanceLogs} lessonLogs={lessonLogs} notices={announcements} tests={tests} grades={grades} classTestStats={classTestStats} clinicLogs={clinicLogs} videoProgress={videoProgress} onLogout={handleLogout} externalSchedules={externalSchedules} onSaveExternalSchedule={handleSaveExternalSchedule} onDeleteExternalSchedule={handleDeleteExternalSchedule} closures={closures} />;
}
  
  const managementProps = {
    students, parents, classes, lessonLogs, attendanceLogs, workLogs, clinicLogs,
    homeworkAssignments, homeworkResults, tests, grades, studentMemos, videoProgress, announcements,
    paymentLogs,
    isPaymentLogsLoading,
    getClassesNames,
    handleSaveStudent, handleDeleteStudent, handleSaveClass, handleSaveLessonLog, handleDeleteLessonLog,
    handleSaveAttendance, handleSaveHomeworkAssignment, handleDeleteHomeworkAssignment, handleUpdateHomeworkResult,
    handleSaveTest, handleDeleteTest, handleUpdateGrade, handleSaveMemo,
    handleSaveAnnouncement, handleDeleteAnnouncement, handleSaveWorkLog, handleDeleteWorkLog, handleSaveClinicLog, handleDeleteClinicLog,
    handleSavePayment, handleUpdatePayment, refreshPaymentLogs,
    calculateClassSessions, handlePageChange, logNotification, notifications,
    calculateGradeComparison, calculateHomeworkStats,
    setIsGlobalDirty, studentSearchTerm, setStudentSearchTerm, handleSendStudentNotification,
    externalSchedules, pendingQuickAction, clearPendingQuickAction: () => setPendingQuickAction(null), onQuickAction: handleQuickAction,
    onCreateStaffUser: isAdminRole(role) ? handleCreateStaffUser : null,
    onCreateLinkCode: isStaffRole(role) ? handleCreateLinkCode : null,
    handleUpdateStudentClassStatus,
    userRole: role,
    userId,
    closures,
    setClosures,
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
                path="closures"
                element={(
                    <StaffOrTeachingRoute>
                        <ClosureManagement {...managementProps} />
                    </StaffOrTeachingRoute>
                )}
            />
            <Route
                path="admin/staff"
                element={(
                    <AdminRoute>
                        <StaffManagement />
                    </AdminRoute>
                )}
            />
            <Route
                path="admin/invites"
                element={(
                    <StaffOrTeachingRoute>
                        <InviteManagementPage />
                    </StaffOrTeachingRoute>
                )}
            />
            <Route
                path="staff/invites"
                element={(
                    <StaffOrTeachingRoute>
                        <InviteManagementPage />
                    </StaffOrTeachingRoute>
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