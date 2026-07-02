// src/pages/StudentHome.jsx
import React, {useState, useMemo, useEffect, useCallback} from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';
import {
    DashboardTab, ClassTab, ScheduleTab, LearningTab, MenuTab,
    BoardTab
} from '../components/StudentTabs';
import ClassroomView from './student/ClassroomView';
import StudentMessengerPage from './student/StudentMessengerPage';
import StudentHeader from '../components/StudentHeader';
import {
    Icon,
    calculateHomeworkStats,
    calculateGradeComparison,
} from '../utils/helpers';
import { sortClassesByStatus, getViewerVisibleClassIds } from '../utils/classStatus';
import { getViewerTodayClassItems, toLocalYmd } from '../utils/viewerTodaySchedule';
import NotificationsIcon from '@mui/icons-material/Notifications';
import useNotifications from '../notifications/useNotifications';
import NotificationList from '../notifications/NotificationList';
import openNotification from '../notifications/openNotification';
import { markAllNotificationsRead, markNotificationRead } from '../notifications/notificationReadActions';
import { FEATURES } from '../config/features';
import { auth, db } from '../firebase/client';
import FormulaBookView from '../components/Student/formulaBook/FormulaBookView';

const normalizeClassStatus = (value) => {
    if (value === 'withdrawn') return '퇴원';
    if (value === 'active') return '진행중';
    if (value === '재원') return '진행중';
    return value;
};

const isWithdrawnStatus = (value) => {
    const normalized = normalizeClassStatus(value);
    return ['퇴원', '중도퇴원', '전반', '전반퇴원'].includes(normalized);
};

const toDayStartMs = (value) => {
    const date = value ? new Date(value) : new Date();
    const time = Number.isNaN(date.getTime()) ? new Date() : date;
    return new Date(time.getFullYear(), time.getMonth(), time.getDate()).getTime();
};

const getItemClassId = (item) => (
    item?.classId
    || item?.classDocId
    || item?.classID
    || item?.class?.id
    || item?.class?.classId
    || item?.class?.docId
    || item?.class?.classDocId
    || item?.classRef
    || item?.class?.ref
    || ''
);

const getItemDateRaw = (item) => (
    item?.date
    || item?.lessonDate
    || item?.startAt
    || item?.scheduledAt
    || item?.createdAt
    || null
);



const shouldHideTodayItemByExit = (item, exitMap) => {
    const classId = String(getItemClassId(item) || '');
    const classCode = String(item?.classCode || item?.classKey || item?.code || '');
    if (!classId && !classCode) return false;

    const exit = exitMap?.[classId] || (classCode ? exitMap?.[classCode] : null);
    if (!exit) return false;
    if (!isWithdrawnStatus(exit.status)) return false;
    if (!exit.exitAtMs) return true;

    const itemDayMs = toDayStartMs(getItemDateRaw(item) || new Date());
    const exitDayMs = toDayStartMs(exit.exitAtMs);
    return itemDayMs >= exitDayMs;
};

const buildChildClassExitMap = (child) => {
    if (!child) return {};
    if (child.classExitMap && typeof child.classExitMap === 'object') return child.classExitMap;

    const list =
        (Array.isArray(child?.classStatuses) && child.classStatuses)
        || (Array.isArray(child?.enrollments) && child.enrollments)
        || (Array.isArray(child?.classEnrollments) && child.classEnrollments)
        || (Array.isArray(child?.classesMeta) && child.classesMeta)
        || (Array.isArray(child?.classes) && child.classes)
        || [];

    const mapLike =
        child?.classStatusMap
        || child?.studentClassStatusMap
        || child?.enrollmentMap
        || null;

    const listFromMap = [];
    if (mapLike && typeof mapLike === 'object') {
        for (const [key, value] of Object.entries(mapLike)) {
            if (value && typeof value === 'object') listFromMap.push({ classId: key, ...value });
            else listFromMap.push({ classId: key, status: value });
        }
    }

    const merged = [...list, ...listFromMap];

    const toMs = (value) => {
        if (!value) return null;
        if (typeof value?.toDate === 'function') return value.toDate().getTime();
        if (value instanceof Date) return value.getTime();
        if (typeof value === 'number') return value;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.getTime();
    };

    const map = {};
    for (const item of merged) {
        const rawDocId =
            item?.classDocId
            || item?.classDocumentId
            || item?.classRefId
            || item?.docId
            || item?.id
            || null;

        const rawCode =
            item?.classId
            || item?.classCode
            || item?.code
            || item?.classKey
            || null;

        const status = String(item?.status || item?.classStatus || '').trim();

        const raw =
            item?.withdrawAt
            || item?.withdrawDate
            || item?.leftAt
            || item?.leftDate
            || item?.exitedAt
            || item?.exitDate
            || item?.endedAt
            || item?.updatedAt
            || null;

        const entry = { status, exitAtMs: toMs(raw) };

        if (rawDocId) map[String(rawDocId)] = entry;
        if (rawCode) map[String(rawCode)] = entry;

        const fallback = String(rawDocId || rawCode || '');
        if (fallback) map[fallback] = entry;
    }
    return map;
};


const getNoticeClassIds = (notice = {}) => [
    ...(Array.isArray(notice?.targetClassIds) ? notice.targetClassIds : []),
    ...(Array.isArray(notice?.targetClasses) ? notice.targetClasses : []),
    ...(Array.isArray(notice?.classIds) ? notice.classIds : []),
    notice?.classId,
].filter(Boolean).map(String);

const getNoticeAudienceValues = (notice = {}) => [
    ...(Array.isArray(notice?.audienceAuthUids) ? notice.audienceAuthUids : []),
    ...(Array.isArray(notice?.targetAuthUids) ? notice.targetAuthUids : []),
    ...(Array.isArray(notice?.targetStudentIds) ? notice.targetStudentIds : []),
    ...(Array.isArray(notice?.targetStudents) ? notice.targetStudents : []),
    ...(Array.isArray(notice?.studentIds) ? notice.studentIds : []),
].filter(Boolean).map(String);

const isNoticeVisibleToStudent = ({ notice, studentKeys, classIds }) => {
    const audience = getNoticeAudienceValues(notice);
    if (audience.length > 0 && audience.some((value) => studentKeys.has(value))) return true;
    const noticeClassIds = getNoticeClassIds(notice);
    if (noticeClassIds.length > 0) return noticeClassIds.some((value) => classIds.has(value));
    return audience.length === 0;
};

export default function StudentHome({
    student, studentId, userId, students, classes, homeworkAssignments, homeworkResults,
    attendanceLogs, lessonLogs, notices, tests, grades, classTestStats,
    videoProgress, onSaveVideoProgress, videoMemos, onAddMemo, onUpdateMemo, onDeleteMemo,
    externalSchedules, onSaveExternalSchedule, onDeleteExternalSchedule,
    clinicLogs, onUpdateStudent,
    closures,
    lessonReports = [],
    onLogout,
    masterView = false,
    masterViewStudentId = '',
    masterViewStudentAuthUid = '',
    readOnly = false,
    embedded = false,
}) {
    // ✅ URL(querystring)로 탭/상세 상태를 동기화해서 "뒤로가기"가 탭 전환/이전 화면으로 동작하게 함
    const [searchParams, setSearchParams] = useSearchParams();

    const readTabFromUrl = () => {
        if (['formula', 'book'].includes(searchParams.get('mode'))) return 'class';
        const tab = searchParams.get('tab') || 'home';
        return tab === 'report' ? 'class' : tab;
    };
    const readSubTabFromUrl = () => searchParams.get('subTab') || 'homework';
    const readClassIdFromUrl = () => searchParams.get('classId');
    const readClassroomModeFromUrl = () => ['formula', 'book'].includes(searchParams.get('mode')) ? 'formula' : 'class';

    const [activeTab, _setActiveTab] = useState(readTabFromUrl());
    const [initialLearningTab, _setInitialLearningTab] = useState(readSubTabFromUrl());
    const [selectedClassId, _setSelectedClassId] = useState(readClassIdFromUrl());
    const [classroomMode, _setClassroomMode] = useState(readClassroomModeFromUrl());

    // ✅ URL -> state (브라우저 뒤로/앞으로로 URL이 바뀌면 화면도 따라감)
    useEffect(() => {
        const nextTab = readTabFromUrl();
        const nextSubTab = readSubTabFromUrl();
        const nextClassId = readClassIdFromUrl();
        const nextClassroomMode = readClassroomModeFromUrl();

        if (nextTab !== activeTab) _setActiveTab(nextTab);
        if (nextSubTab !== initialLearningTab) _setInitialLearningTab(nextSubTab);
        if ((nextClassId || null) !== (selectedClassId || null)) _setSelectedClassId(nextClassId || null);
        if (nextClassroomMode !== classroomMode) _setClassroomMode(nextClassroomMode);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // ✅ state -> URL (앱 내부 동작은 아래 래퍼 함수를 통해서만 변경)
    const setActiveTab = useCallback((tab, { replace = false } = {}) => {
        _setActiveTab(tab);
        if (embedded) return;
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', tab);

            // learning 이외 탭으로 이동하면 subTab은 정리 (원하면 정책 변경 가능)
            if (tab !== 'learning') next.delete('subTab');

            // 탭 이동 시 classId는 유지하지 않음(클래스 화면은 별도 상태)
            if (tab !== 'class') next.delete('classId');
            if (tab !== 'class') {
                next.delete('mode');
                next.delete('conceptId');
                _setClassroomMode('class');
            }

            return next;
        }, { replace });
    }, [setSearchParams, embedded]);
    const setClassroomMode = useCallback((mode, { replace = false } = {}) => {
        const value = mode === 'formula' ? 'formula' : 'class';
        _setClassroomMode(value);
        _setActiveTab('class');
        _setSelectedClassId(null);
        if (embedded) return;
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', 'class');
            next.delete('classId');
            next.delete('subTab');
            if (value === 'formula') next.set('mode', 'book');
            else {
                next.delete('mode');
                next.delete('conceptId');
            }
            return next;
        }, { replace });
    }, [setSearchParams, embedded]);

    const setInitialLearningTab = useCallback((subTab, { replace = false } = {}) => {
        const value = subTab || 'homework';
        _setInitialLearningTab(value);
        _setActiveTab('learning');
        if (embedded) return;
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', 'learning');
            next.set('subTab', value);
            next.delete('classId');
            return next;
        }, { replace });
    }, [setSearchParams, embedded]);

    const setSelectedClassId = useCallback((classId, { replace = false } = {}) => {
        const value = classId === null || classId === undefined || classId === '' ? null : String(classId);
        _setSelectedClassId(value);
        if (value) _setActiveTab('class');
        if (value) _setClassroomMode('class');
        if (embedded) return;

        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (value) {
                next.set('tab', 'class');
                next.set('classId', value);
                next.delete('subTab');
            } else {
                next.delete('classId');
            }
            return next;
        }, { replace });

    }, [setSearchParams, embedded]);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [visibleNotices, setVisibleNotices] = useState([]);
    const [targetMemo, setTargetMemo] = useState(null);
    const [isMessengerPage, setIsMessengerPage] = useState(false);
    const [linkedUserDocId, setLinkedUserDocId] = useState('');
    const [initialMessengerRoomId, setInitialMessengerRoomId] = useState('');
    const isMasterPreview = Boolean(masterView);
    const authUid = auth.currentUser?.uid || '';
    useEffect(() => {
        if (!authUid || !db) {
            setLinkedUserDocId('');
            return undefined;
        }
        let isMounted = true;
        getDoc(doc(db, 'userAuthIndex', authUid))
            .then((snapshot) => {
                if (!isMounted) return;
                const userDocId = snapshot.exists() ? snapshot.data()?.userDocId : '';
                setLinkedUserDocId(userDocId ? String(userDocId).trim() : '');
            })
            .catch((error) => {
                if (!isMounted) return;
                console.warn('[student auth index] failed to load linked student doc id', error);
                setLinkedUserDocId('');
            });
        return () => { isMounted = false; };
    }, [authUid]);
    const linkedStudentDocId = linkedUserDocId;
    const notificationViewerUid = isMasterPreview
        ? (masterViewStudentId || student?.id || studentId || masterViewStudentAuthUid || student?.authUid || userId || '')
        : (linkedStudentDocId || student?.id || studentId || student?.authUid || authUid || userId || '');
    const viewerUid = notificationViewerUid;
    const studentDocId = isMasterPreview ? (masterViewStudentId || studentId) : studentId;
    const studentAuthUid = isMasterPreview ? (masterViewStudentAuthUid || student?.authUid || userId) : (student?.authUid || userId);
    const showMasterViewUnavailable = useCallback((featureName) => {
        window.alert(`마스터뷰에서는 ${featureName}을(를) 사용할 수 없습니다.`);
    }, []);
    const rawMyClasses = useMemo(() => {
        if (!Array.isArray(classes) || !studentId) return [];
        const addClassIdFromItem = (targetSet, item) => {
            if (!item) return;
            if (typeof item === 'string') {
                targetSet.add(String(item));
                return;
            }
            if (typeof item !== 'object') return;
            [item.id, item.classId, item.classDocId, item.classDocumentId, item.classRefId, item.docId, item.classCode, item.code, item.classKey]
                .filter(Boolean)
                .forEach((value) => targetSet.add(String(value)));
        };
        const studentClassIds = new Set();
        [
            ...(Array.isArray(student?.classIds) ? student.classIds : []),
            ...(Array.isArray(student?.classes) ? student.classes : []),
            ...(Array.isArray(student?.classStatuses) ? student.classStatuses : []),
            ...(Array.isArray(student?.enrollments) ? student.enrollments : []),
            ...(Array.isArray(student?.classEnrollments) ? student.classEnrollments : []),
            ...(Array.isArray(student?.classesMeta) ? student.classesMeta : []),
        ].forEach((item) => addClassIdFromItem(studentClassIds, item));
        [student?.classStatusMap, student?.studentClassStatusMap, student?.enrollmentMap].forEach((mapLike) => {
            if (!mapLike || typeof mapLike !== 'object') return;
            Object.entries(mapLike).forEach(([key, value]) => {
                if (key) studentClassIds.add(String(key));
                addClassIdFromItem(studentClassIds, value);
            });
        });

        const studentKeys = new Set([studentId, student?.id, student?.studentId, student?.authUid, userId].filter(Boolean).map(String));
        return classes.filter((c) => {
            const classKeys = [c?.id, c?.classId, c?.classDocId, c?.docId, c?.code, c?.classCode, c?.key].filter(Boolean).map(String);
            const rosterKeys = [
                ...(Array.isArray(c?.students) ? c.students : []),
                ...(Array.isArray(c?.studentIds) ? c.studentIds : []),
                ...(Array.isArray(c?.studentDocIds) ? c.studentDocIds : []),
                ...(Array.isArray(c?.studentAuthUids) ? c.studentAuthUids : []),
            ].map(String);
            return classKeys.some((classId) => studentClassIds.has(classId)) || rosterKeys.some((key) => studentKeys.has(key));
        });
    }, [classes, student, studentId, userId]);
    const visibleClassIds = useMemo(() => getViewerVisibleClassIds(rawMyClasses, student), [rawMyClasses, student]);
    const visibleClassIdSet = useMemo(() => new Set(visibleClassIds), [visibleClassIds]);
    const myClasses = useMemo(
        () => rawMyClasses.filter((cls) => visibleClassIdSet.has(String(cls?.id || cls?.classId || ''))),
        [rawMyClasses, visibleClassIdSet],
    );
    const isVisibleClassItem = useCallback((item) => {
        const classId = String(getItemClassId(item) || '');
        return Boolean(classId && visibleClassIdSet.has(classId));
    }, [visibleClassIdSet]);
    const filteredLessonLogs = useMemo(() => {
        if (!Array.isArray(lessonLogs)) return [];
        return lessonLogs.filter((log) => isVisibleClassItem(log));
    }, [lessonLogs, isVisibleClassItem]);
    const filteredTests = useMemo(() => {
        if (!Array.isArray(tests)) return [];
        return tests.filter((test) => isVisibleClassItem(test));
    }, [tests, isVisibleClassItem]);
    const filteredHomeworkAssignments = useMemo(() => {
        if (!Array.isArray(homeworkAssignments)) return [];
        return homeworkAssignments.filter((assignment) => isVisibleClassItem(assignment));
    }, [homeworkAssignments, isVisibleClassItem]);
    const filteredAttendanceLogs = useMemo(() => {
        if (!Array.isArray(attendanceLogs)) return [];
        return attendanceLogs.filter((log) => isVisibleClassItem(log));
    }, [attendanceLogs, isVisibleClassItem]);
    const filteredVideoProgress = useMemo(() => {
        if (!Array.isArray(videoProgress)) return videoProgress;
        return videoProgress.filter((item) => isVisibleClassItem(item));
    }, [videoProgress, isVisibleClassItem]);
    const currentStudentProfile = student;
    const studentClassExitMap = useMemo(
        () => buildChildClassExitMap(currentStudentProfile),
        [currentStudentProfile],
    );
    const today = new Date();
    const todayStr = toLocalYmd(today);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const todayDayName = dayNames[today.getDay()];
    const buildClinicTeacher = (log) => log?.tutorName || log?.tutor || log?.teacherName || log?.teacher || '-';
    const formatClinicTime = (log) => {
        const plannedStart = typeof log?.plannedTime === 'string' ? log.plannedTime : log?.plannedTime?.start;
        const plannedEnd = typeof log?.plannedTime === 'string' ? '' : log?.plannedTime?.end;
        const start = log?.checkIn || plannedStart || '';
        const end = log?.checkOut || plannedEnd || '';
        if (start && end) return `${start} ~ ${end}`;
        if (start) return `${start} 예정`;
        return '시간 미정';
    };
    const buildClinicStatus = (log) => {
        if (log?.checkOut) return '완료';
        if (log?.checkIn || log?.plannedTime) return '예약됨';
        return '예정';
    };
    const todayItems = useMemo(() => {
        const todayClinics = studentId
            ? (Array.isArray(clinicLogs) ? clinicLogs : []).filter(log => log.studentId === studentId && log.date === todayStr).map(log => ({
                type: 'clinic',
                time: log.checkIn || (typeof log?.plannedTime === 'string' ? log.plannedTime : log?.plannedTime?.start) || '99:99',
                timeLabel: formatClinicTime(log),
                title: '클리닉',
                sub: `선생님: ${buildClinicTeacher(log)} • ${buildClinicStatus(log)}`,
                date: log.date,
            }))
            : [];
        const todayExternal = studentId
            ? (Array.isArray(externalSchedules) ? externalSchedules : [])
                .filter(schedule => schedule.studentId === studentId && Array.isArray(schedule.days) && schedule.days.includes(todayDayName) && todayStr >= schedule.startDate && (!schedule.endDate || todayStr <= schedule.endDate))
                .map(schedule => ({
                    type: 'external',
                    time: schedule.startTime || '99:99',
                    title: schedule.courseName || schedule.academyName || '외부 일정',
                    sub: schedule.instructor ? `${schedule.academyName} • ${schedule.instructor}` : schedule.academyName || '',
                    timeLabel: schedule.startTime && schedule.endTime ? `${schedule.startTime}~${schedule.endTime}` : (schedule.startTime || '시간 미정'),
                    date: todayStr,
                }))
            : [];

        const todaysClasses = getViewerTodayClassItems({
            classes: myClasses,
            date: today,
            dateStr: todayStr,
            closures,
            visibleClassIds,
            isClassRetiredOnDate: (classId, dateValue) => shouldHideTodayItemByExit({ classId, date: dateValue }, studentClassExitMap),
        });

        const merged = [
            ...todaysClasses,
            ...todayClinics,
            ...todayExternal,
        ].sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
        console.log('[student][today] home count', { count: merged.length, classCount: todaysClasses.length, todayStr, visibleClassIds });
        return merged;
    }, [clinicLogs, externalSchedules, myClasses, studentId, today, todayDayName, todayStr, closures, visibleClassIds, studentClassExitMap]);
    const filteredTodayItems = useMemo(() => {
        const list = Array.isArray(todayItems) ? todayItems : [];
        return list.filter((item) => !shouldHideTodayItemByExit(item, studentClassExitMap));
    }, [todayItems, studentClassExitMap]);

    useEffect(() => {
        console.log('[notifications uid]', {
            role: 'student',
            authUid,
            linkedUserDocId: linkedStudentDocId,
            studentId: student?.id || studentId || '',
            studentAuthUid: student?.authUid || '',
            notificationViewerUid,
        });
    }, [authUid, linkedStudentDocId, student?.id, student?.authUid, studentId, notificationViewerUid]);

    const { notifications, hasUnread, unreadCount, lastReadAt, isLoading, isMetaLoading, setNotifications } = useNotifications(notificationViewerUid);

    const { ongoing: ongoingClasses } = useMemo(() => {
        const sorted = sortClassesByStatus(myClasses);
        return { ongoing: sorted?.ongoing || [] };
    }, [myClasses]);

    const myHomeworkStats = useMemo(() => {
        if (!studentId) return [];
        return calculateHomeworkStats(
            studentId,
            filteredHomeworkAssignments || [],
            homeworkResults || [],
            { activeViewerAuthUid: userId, studentAuthUid: student?.authUid, userId, students },
        );
    }, [studentId, filteredHomeworkAssignments, homeworkResults, student?.authUid, students, userId]);

    const myGradeComparison = useMemo(() => {
        if (!studentId) return [];
        return calculateGradeComparison(studentId, classes || [], filteredTests || [], grades || {}, classTestStats || {});
    }, [studentId, classes, filteredTests, grades, classTestStats]);

    const pendingHomeworkCount = useMemo(
        () => myHomeworkStats.filter(h => !h.isComplete).length,
        [myHomeworkStats]
    );

    useEffect(() => {
        const studentKeys = new Set([studentId, student?.id, student?.studentId, student?.authUid, student?.uid, userId].filter(Boolean).map(String));
        const classIds = new Set(visibleClassIds.map(String));
        const combinedNotices = (Array.isArray(notices) ? notices : [])
            .filter((notice) => isNoticeVisibleToStudent({ notice, studentKeys, classIds }));
        setVisibleNotices(combinedNotices);
    }, [notices, student, studentId, userId, visibleClassIds]);

    const handleOpenNotification = () => {
        if (isMasterPreview || readOnly) {
            showMasterViewUnavailable('알림');
            return;
        }
        setIsNotificationOpen(true);
    };
    const handleOpenMessages = () => {
        if (isMasterPreview || readOnly) {
            showMasterViewUnavailable('메신저');
            return;
        }
        setIsMessengerPage(true);
    };

    const handleNavigateToMemo = (classId, lessonId, time) => {
        setSelectedClassId(classId);
        setTargetMemo({ lessonId, time });
    };

    const handleNotificationClick = async (notification) => {
        if (!notification) return;
        const refCollectionForLog = notification?.refCollection || (typeof notification?.ref === 'string' ? notification.ref.split('/').filter(Boolean)[0] : '');
        const refIdForLog = notification?.refId || (typeof notification?.ref === 'string' ? notification.ref.split('/').filter(Boolean)[1] : '');
        const roomIdForLog = notification?.roomId || notification?.chatRoomId || notification?.payload?.roomId || (['chatRooms', 'chats'].includes(refCollectionForLog) ? refIdForLog : '');
        console.log('[notification click]', { notificationId: notification.id, refCollection: refCollectionForLog, refId: refIdForLog, roomId: roomIdForLog });
        if (!isMasterPreview && !readOnly) {
            try {
                await markNotificationRead({ viewerUid, notificationId: notification.id, setNotifications });
            } catch (error) {
                console.error('[student][notifications] mark single read failed', error);
            }
        }
        await openNotification({
            notification,
            onNavigate: ({ refCollection, refId, data }) => {
                if (refCollection === 'lessonLogs' && data?.classId) {
                    setSelectedClassId(data.classId);
                    setTargetMemo({ lessonId: refId, time: data?.date || null });
                    return;
                }

                if (['homeworkResults', 'grades', 'attendanceLogs'].includes(refCollection)) {
                    setSelectedClassId(null);
                    setInitialLearningTab('homework');
                    return;
                }

                if (refCollection === 'chats' || refCollection === 'chatRooms') {
                    if (isMasterPreview || readOnly) return;
                    const roomId = notification?.roomId || notification?.chatRoomId || notification?.payload?.roomId || refId;
                    setInitialMessengerRoomId(roomId ? String(roomId) : '');
                    setSelectedClassId(null);
                    setActiveTab('menu');
                    setIsMessengerPage(true);
                }
            },
        });
        setIsNotificationOpen(false);
    };

    const handleMarkAllRead = async () => {
        console.log('[notifications] markAllRead clicked');

        if (isMasterPreview || readOnly) {
            showMasterViewUnavailable('알림 읽음 처리');
            return;
        }

        if (!viewerUid) {
            console.warn('[notifications] no viewerUid');
            return;
        }

        try {
            const result = await markAllNotificationsRead({ viewerUid, setNotifications });
            console.log('[student][notifications] markAllRead success', { viewerUid, updated: result?.data?.updated ?? null });
        } catch (error) {
            console.error('[student][notifications] markAllRead failed', error);
        }
    };



    const sentLessonReports = useMemo(() => (Array.isArray(lessonReports) ? lessonReports : [])
        .filter((report) => report?.status === 'sent' && String(report?.studentId || '') === String(studentId || '') && isVisibleClassItem(report))
        .map((report) => ({ ...report, className: classes.find((c) => String(c.id) === String(report.classId))?.name || report.classId }))
        .sort((a, b) => String(b.lessonDate || '').localeCompare(String(a.lessonDate || ''))), [lessonReports, studentId, isVisibleClassItem, classes]);

    const navItems = [
        { id: 'home', icon: 'home', label: '홈' },
        { id: 'class', icon: 'fileText', label: '강의실' },
        { id: 'learning', icon: 'clipboardCheck', label: '학습관리' },
        { id: 'schedule', icon: 'calendar', label: '일정' },
        { id: 'menu', icon: 'menu', label: '전체' },
    ];

    if (isMessengerPage) {
        return (
            <StudentMessengerPage
                studentId={studentId}
                student={student}
                notificationViewerUid={notificationViewerUid}
                initialRoomId={initialMessengerRoomId}
                notifications={notifications}
                setNotifications={setNotifications}
                onBack={() => setIsMessengerPage(false)}
            />
        );
    }

    return (
        <div className={`mobile-screen bg-gray-50 flex flex-col relative font-sans ${embedded ? 'h-full min-h-0' : 'min-h-screen'}`}>
            <StudentHeader student={student} onOpenNotifications={handleOpenNotification} onOpenMessages={handleOpenMessages} hasUnread={hasUnread} />
            {/* <div style={{position:'fixed', top:10, right:10, zIndex:9999, background:'#fff', padding:6}}>
                activeTab: {activeTab}
            </div> */}

            <main className={`flex-1 w-full max-w-md mx-auto p-4 overflow-y-auto custom-scrollbar md:max-w-7xl ${embedded ? 'min-h-0 pb-4' : 'pb-24'}`}>
                {!student ? (
                    <div className="p-6 text-center text-gray-500">
                        학생 정보를 불러오는 중이거나
                        <br />
                        계정이 아직 학원에 연결되지 않았습니다.
                        <br />
                        관리자에게 문의해주세요.
                    </div>
                ) : selectedClassId ? (
                    <ClassroomView
                        classes={classes}
                        lessonLogs={filteredLessonLogs}
                        attendanceLogs={filteredAttendanceLogs}
                        studentDocId={studentDocId}
                        studentAuthUid={studentAuthUid}
                        selectedClassId={selectedClassId}
                        setSelectedClassId={setSelectedClassId}
                        videoProgress={filteredVideoProgress}
                        onSaveVideoProgress={onSaveVideoProgress}
                        videoMemos={videoMemos}
                        onAddMemo={onAddMemo}
                        onUpdateMemo={onUpdateMemo}
                        onDeleteMemo={onDeleteMemo}
                        onVideoModalChange={setIsVideoModalOpen}
                        targetMemo={targetMemo}
                        onClearTargetMemo={() => setTargetMemo(null)}
                        homeworkAssignments={filteredHomeworkAssignments}
                        homeworkResults={homeworkResults}
                        tests={filteredTests}
                        grades={grades}
                        onNavigateToTab={(tab, subTab = 'homework') => {
                            setSelectedClassId(null);
                            if (tab === 'learning') {
                                setInitialLearningTab(subTab);
                            } else {
                                setActiveTab(tab);
                            }
                        }}
                    />
                ) : (
                    <div className="animate-fade-in space-y-4">
                        {activeTab === 'home' && (
                            <DashboardTab
                                student={student} myClasses={ongoingClasses} pendingHomeworkCount={pendingHomeworkCount}
                                attendanceLogs={filteredAttendanceLogs} clinicLogs={clinicLogs} homeworkStats={myHomeworkStats} notices={visibleNotices}
                                setActiveTab={setActiveTab}
                                today={today} todayDayName={todayDayName} todayItems={todayItems} filteredTodayItems={filteredTodayItems}
                                externalSchedules={externalSchedules} // ✅ [추가] 타학원 일정 데이터 전달
                            />
                        )}
                        {activeTab === 'class' && (
                            <section className="space-y-4">
                                <div className="grid grid-cols-2 rounded-xl bg-gray-200/70 p-1" aria-label="강의실 보기 선택">
                                    <button
                                        type="button"
                                        onClick={() => setClassroomMode('class')}
                                        className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                                            classroomMode === 'class' ? 'bg-white text-[#455fab] shadow-sm' : 'text-gray-500'
                                        }`}
                                    >
                                        클래스
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setClassroomMode('formula')}
                                        className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                                            classroomMode === 'formula' ? 'bg-white text-[#455fab] shadow-sm' : 'text-gray-500'
                                        }`}
                                    >
                                        공식집
                                    </button>
                                </div>
                                {classroomMode === 'class' ? (
                                    <ClassTab myClasses={myClasses} setSelectedClassId={setSelectedClassId} />
                                ) : (
                                    <FormulaBookView
                                        initialConceptId={searchParams.get('conceptId') || ''}
                                    />
                                )}
                            </section>
                        )}
                        {activeTab === 'schedule' && (
                            <ScheduleTab
                                myClasses={myClasses} externalSchedules={externalSchedules} attendanceLogs={filteredAttendanceLogs}
                                studentId={studentId} student={student} onSaveExternalSchedule={onSaveExternalSchedule} onDeleteExternalSchedule={onDeleteExternalSchedule} clinicLogs={clinicLogs}
                                closures={closures}
                            />
                        )}
                        {activeTab === 'learning' && (
                            <LearningTab
                                studentId={studentId} myHomeworkStats={myHomeworkStats} myGradeComparison={myGradeComparison}
                                clinicLogs={clinicLogs} students={students} classes={myClasses}
                                visibleClasses={myClasses}
                                initialTab={initialLearningTab}
                                attendanceLogs={filteredAttendanceLogs}
                                student={student}
                                tests={filteredTests}
                                grades={grades}
                                classTestStats={classTestStats}
                                lessonReports={sentLessonReports}
                            />
                        )}
                        {activeTab === 'board' && <BoardTab notices={visibleNotices} />}
                        {activeTab === 'menu' && (
                            <MenuTab 
                                student={student} onUpdateStudent={onUpdateStudent} onLogout={onLogout}
                                videoMemos={videoMemos} lessonLogs={filteredLessonLogs} onLinkToMemo={handleNavigateToMemo} notices={visibleNotices}
                                onOpenNotifications={handleOpenNotification}
                                onOpenMessages={handleOpenMessages}
                                onOpenFormulaBook={() => setClassroomMode('formula')}
                                studentAuthUid={studentAuthUid}
                                myClasses={ongoingClasses}
                            />
                        )}
                    </div>
                )}
            </main>

            {student && !selectedClassId && (
                <div className={`${embedded ? 'sticky bottom-0' : 'fixed bottom-0 left-0 right-0'} bg-white border-t border-gray-200 z-40 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.03)] h-[calc(60px+env(safe-area-inset-bottom))]`}>
                    <div className="max-w-md mx-auto flex justify-around items-center h-[60px] md:max-w-7xl">
                        {navItems.map(item => (
                            <button 
                                key={item.id} 
                                onClick={() => setActiveTab(item.id)} 
                                className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 active:scale-95 active:bg-gray-50 ${
                                    activeTab === item.id || (item.id === 'menu' && activeTab === 'board') ? 'text-brand-main' : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                <div className={`mb-1 transition-transform duration-200 ${activeTab === item.id ? '-translate-y-0.5' : ''}`}>
                                    <Icon name={item.icon} className={`w-6 h-6 ${activeTab === item.id ? 'fill-current' : ''}`} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                                </div>
                                <span className={`text-[10px] ${activeTab === item.id ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            
            {/* ✅ [수정] 플로팅 버튼 통합 컨테이너 */}
            {FEATURES.ENABLE_FLOATING_NOTIFICATIONS_FOR_VIEWERS && (
                <div className={`${embedded ? 'absolute bottom-24 right-5' : 'fixed bottom-24 right-5'} z-[60] flex flex-col gap-3 items-center transition-all duration-300 ${isVideoModalOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    {/* 1. 알림 버튼 */}
                    <button
                        onClick={handleOpenNotification}
                        className="bg-white text-brand-main border border-brand-main/20 p-3 rounded-full shadow-lg hover:bg-gray-50 active:scale-90 flex items-center justify-center relative w-12 h-12"
                    >
                        <NotificationsIcon style={{ fontSize: 24 }} />
                        {hasUnread && <span className="absolute top-2 right-2.5 w-2 h-2 bg-brand-red rounded-full ring-1 ring-white"></span>}
                    </button>
                </div>
            )}
            {student && (
                <NotificationList
                    isOpen={isNotificationOpen}
                    onClose={() => setIsNotificationOpen(false)}
                    notifications={notifications}
                    onNotificationClick={handleNotificationClick}
                    onMarkAllRead={handleMarkAllRead}
                    unreadCount={unreadCount}
                    lastReadAt={lastReadAt}
                    isLoading={isLoading || isMetaLoading}
                />
            )}
        </div>
    );
}

// changed: hide ended classes in today’s lessons
