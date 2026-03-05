// src/pages/StudentHome.jsx
import React, {useState, useMemo, useEffect, useCallback} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    collection,
    query,
    where,
    getDocs,
    writeBatch,
    doc,
    serverTimestamp,
} from 'firebase/firestore';
import {
    DashboardTab, ClassTab, ScheduleTab, LearningTab, MenuTab,
    BoardTab
} from '../components/StudentTabs';
import ClassroomView from './student/ClassroomView';
import StudentHeader from '../components/StudentHeader';
import { Icon, calculateHomeworkStats, calculateGradeComparison, isClosedForClass } from '../utils/helpers';
import { sortClassesByStatus } from '../utils/classStatus';
import NotificationsIcon from '@mui/icons-material/Notifications';
import useNotifications from '../notifications/useNotifications';
import NotificationList from '../notifications/NotificationList';
import openNotification from '../notifications/openNotification';
import { db } from '../firebase/client';
import { FEATURES } from '../config/features';

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



const isClassActiveForToday = (cls, student) => {
    if (!cls) return false;

    const classStatus = String(cls.status || '').trim();
    if (['종강', '전반', '퇴원', '종료', 'ended', 'inactive'].includes(classStatus)) return false;

    const map = student?.classStatusMap || student?.classStatuses || {};
    const entry = map?.[String(cls.id)] || null;
    const entryStatus = String(entry?.status || '').trim();
    if (['종강', '전반', '퇴원'].includes(entryStatus)) return false;

    const toYmd = (v) => {
        if (!v) return null;
        if (typeof v === 'string') return v.slice(0, 10);
        if (typeof v?.toDate === 'function') return v.toDate().toISOString().slice(0, 10);
        try { return new Date(v).toISOString().slice(0, 10); } catch { return null; }
    };

    const today = new Date().toISOString().slice(0, 10);
    const endedYmd = toYmd(entry?.endedAt || entry?.endDate || cls.endedAt || cls.endDate);
    if (endedYmd && endedYmd <= today) return false;

    return true;
};

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

export default function StudentHome({
    student, studentId, userId, students, classes, homeworkAssignments, homeworkResults,
    attendanceLogs, lessonLogs, notices, tests, grades, classTestStats,
    videoProgress, onSaveVideoProgress, videoMemos, onAddMemo, onUpdateMemo, onDeleteMemo,
    externalSchedules, onSaveExternalSchedule, onDeleteExternalSchedule,
    clinicLogs, onUpdateStudent,
    closures,
    onLogout
}) {
    // ✅ URL(querystring)로 탭/상세 상태를 동기화해서 "뒤로가기"가 탭 전환/이전 화면으로 동작하게 함
    const [searchParams, setSearchParams] = useSearchParams();

    const readTabFromUrl = () => searchParams.get('tab') || 'home';
    const readSubTabFromUrl = () => searchParams.get('subTab') || 'homework';
    const readClassIdFromUrl = () => searchParams.get('classId');

    const [activeTab, _setActiveTab] = useState(readTabFromUrl());
    const [initialLearningTab, _setInitialLearningTab] = useState(readSubTabFromUrl());
    const [selectedClassId, _setSelectedClassId] = useState(readClassIdFromUrl());

    // ✅ URL -> state (브라우저 뒤로/앞으로로 URL이 바뀌면 화면도 따라감)
    useEffect(() => {
        const nextTab = readTabFromUrl();
        const nextSubTab = readSubTabFromUrl();
        const nextClassId = readClassIdFromUrl();

        if (nextTab !== activeTab) _setActiveTab(nextTab);
        if (nextSubTab !== initialLearningTab) _setInitialLearningTab(nextSubTab);
        if ((nextClassId || null) !== (selectedClassId || null)) _setSelectedClassId(nextClassId || null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // ✅ state -> URL (앱 내부 동작은 아래 래퍼 함수를 통해서만 변경)
    const setActiveTab = useCallback((tab, { replace = false } = {}) => {
        _setActiveTab(tab);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', tab);

            // learning 이외 탭으로 이동하면 subTab은 정리 (원하면 정책 변경 가능)
            if (tab !== 'learning') next.delete('subTab');

            // 탭 이동 시 classId는 유지하지 않음(클래스 화면은 별도 상태)
            if (tab !== 'class') next.delete('classId');

            return next;
        }, { replace });
    }, [setSearchParams]);

    const setInitialLearningTab = useCallback((subTab, { replace = false } = {}) => {
        const value = subTab || 'homework';
        _setInitialLearningTab(value);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', 'learning');
            next.set('subTab', value);
            next.delete('classId');
            return next;
        }, { replace });
        _setActiveTab('learning');
    }, [setSearchParams]);

    const setSelectedClassId = useCallback((classId, { replace = false } = {}) => {
        const value = classId === null || classId === undefined || classId === '' ? null : String(classId);
        _setSelectedClassId(value);

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

        if (value) _setActiveTab('class');
    }, [setSearchParams]);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [visibleNotices, setVisibleNotices] = useState([]);
    const [targetMemo, setTargetMemo] = useState(null);
    const viewerUid = student?.authUid || userId;
    const studentDocId = studentId;
    const studentAuthUid = student?.authUid || userId;
    const toYmd = (value) => {
        if (!value) return null;
        if (typeof value === 'string') return value.slice(0, 10);
        if (typeof value?.toDate === 'function') return value.toDate().toISOString().slice(0, 10);
        try {
            return new Date(value).toISOString().slice(0, 10);
        } catch (error) {
            return null;
        }
    };
    const isAfterEndDate = (dateValue, endDateValue) => {
        const date = toYmd(dateValue);
        const endDate = toYmd(endDateValue);
        if (!date || !endDate) return false;
        return date > endDate;
    };
    const isLogAfterClassEndDate = (classId, dateValue) => {
        if (!classId) return false;
        const classStatus = student?.classStatusMap?.[String(classId)] || student?.classStatuses?.[String(classId)];
        const normalizedStatus = normalizeClassStatus(classStatus?.status);
        if (!isWithdrawnStatus(normalizedStatus)) return false;
        const endValue = classStatus?.endedAt || classStatus?.endDate;
        if (!endValue) return false;
        return isAfterEndDate(dateValue, endValue);
    };
    const filteredLessonLogs = useMemo(() => {
        if (!Array.isArray(lessonLogs)) return [];
        return lessonLogs.filter((log) => !isLogAfterClassEndDate(log?.classId, log?.date));
    }, [lessonLogs, student?.classStatusMap, student?.classStatuses]);
    const filteredTests = useMemo(() => {
        if (!Array.isArray(tests)) return [];
        return tests.filter((test) => !isLogAfterClassEndDate(test?.classId, test?.date));
    }, [tests, student?.classStatusMap, student?.classStatuses]);
    const filteredHomeworkAssignments = useMemo(() => {
        if (!Array.isArray(homeworkAssignments)) return [];
        return homeworkAssignments.filter((assignment) => !isLogAfterClassEndDate(assignment?.classId, assignment?.assignedDate || assignment?.date));
    }, [homeworkAssignments, student?.classStatusMap, student?.classStatuses]);
    const myClasses = useMemo(() => {
        if (!classes || !studentId) return [];
        return classes.filter(c => (c.students || []).includes(studentId));
    }, [classes, studentId]);
    const currentStudentProfile = student;
    const studentClassExitMap = useMemo(
        () => buildChildClassExitMap(currentStudentProfile),
        [currentStudentProfile],
    );
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
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
        const visibleTodayClasses = myClasses.filter((cls) => {
            if (!cls?.id) return false;
            if (!isClassActiveForToday(cls, student)) return false;
            return true;
        });

        const todayClinics = studentId
            ? clinicLogs.filter(log => log.studentId === studentId && log.date === todayStr).map(log => ({
                type: 'clinic',
                time: log.checkIn || (typeof log?.plannedTime === 'string' ? log.plannedTime : log?.plannedTime?.start) || '99:99',
                timeLabel: formatClinicTime(log),
                title: '클리닉',
                sub: `선생님: ${buildClinicTeacher(log)} • ${buildClinicStatus(log)}`,
                date: log.date,
            }))
            : [];
        const todayExternal = studentId
            ? externalSchedules
                .filter(schedule => schedule.studentId === studentId && schedule.days.includes(todayDayName) && todayStr >= schedule.startDate && (!schedule.endDate || todayStr <= schedule.endDate))
                .map(schedule => ({
                    type: 'external',
                    time: `${schedule.startTime}~${schedule.endTime}`,
                    title: schedule.courseName || schedule.academyName || '외부 일정',
                    sub: schedule.instructor ? `${schedule.academyName} • ${schedule.instructor}` : schedule.academyName || '',
                    timeLabel: `${schedule.startTime}~${schedule.endTime}`,
                    date: todayStr,
                }))
            : [];

        return [
            ...visibleTodayClasses.filter(c => c.schedule.days.includes(todayDayName)).map(c => ({
                type: 'class',
                classId: c.id,
                classCode: c.classId || c.code || c.classCode || c.key || null,
                time: c.schedule.time,
                title: c.name,
                sub: `${c.teacher} 선생님`,
                timeLabel: c.schedule.time,
                date: todayStr,
            })),
            ...todayClinics,
            ...todayExternal,
        ].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    }, [clinicLogs, externalSchedules, myClasses, student, studentId, todayDayName, todayStr]);
    const filteredTodayItems = useMemo(() => {
        const list = Array.isArray(todayItems) ? todayItems : [];
        return list.filter((item) => {
            const classId = getItemClassId(item);
            if (classId && isClosedForClass(todayStr, classId, closures)) return false;
            return !shouldHideTodayItemByExit(item, studentClassExitMap);
        });
    }, [todayItems, studentClassExitMap, closures, todayStr]);


    const { notifications, hasUnread, unreadCount, lastReadAt, isLoading, isMetaLoading, setNotifications } = useNotifications(viewerUid);

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
        const combinedNotices = Array.isArray(notices) ? notices : [];
        setVisibleNotices(combinedNotices);
    }, [notices]);

    const handleOpenNotification = () => { setIsNotificationOpen(true); };

    const handleNavigateToMemo = (classId, lessonId, time) => {
        setSelectedClassId(classId);
        setTargetMemo({ lessonId, time });
    };

    const handleNotificationClick = async (notification) => {
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

                if (refCollection === 'chats') {
                    setSelectedClassId(null);
                    setActiveTab('menu');
                }
            },
        });
        setIsNotificationOpen(false);
    };

    const handleMarkAllRead = async () => {
        console.log('[notifications] markAllRead clicked');

        if (!viewerUid) {
            console.warn('[notifications] no viewerUid');
            return;
        }

        const q = query(
            collection(db, 'notifications', viewerUid, 'items'),
            where('isRead', '==', false)
        );

        const snap = await getDocs(q);
        console.log('[notifications] unread docs =', snap.size);

        if (snap.empty) return;

        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
            batch.update(doc(db, 'notifications', viewerUid, 'items', d.id), {
                isRead: true,
                readAt: serverTimestamp(),
            });
        });

        await batch.commit();
        console.log('[notifications] markAllRead committed');

        setNotifications((prev) =>
            prev.map((n) => ({ ...n, isRead: true, readAt: n.readAt || new Date() }))
        );
    };

    const navItems = [
        { id: 'home', icon: 'home', label: '홈' },
        { id: 'class', icon: 'fileText', label: '클래스' },
        { id: 'schedule', icon: 'calendar', label: '수업일정' },
        { id: 'learning', icon: 'clipboardCheck', label: '학습관리' },
        { id: 'menu', icon: 'menu', label: '전체메뉴' },
    ];

    return (
        <div className="bg-brand-bg min-h-screen flex flex-col relative font-sans">
            <StudentHeader onLogout={onLogout} />
            {/* <div style={{position:'fixed', top:10, right:10, zIndex:9999, background:'#fff', padding:6}}>
                activeTab: {activeTab}
            </div> */}

            <main className="flex-1 w-full max-w-md mx-auto p-4 pb-24 overflow-y-auto custom-scrollbar md:max-w-7xl">
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
                        attendanceLogs={attendanceLogs}
                        studentDocId={studentDocId}
                        studentAuthUid={studentAuthUid}
                        selectedClassId={selectedClassId}
                        setSelectedClassId={setSelectedClassId}
                        videoProgress={videoProgress}
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
                                attendanceLogs={attendanceLogs} clinicLogs={clinicLogs} homeworkStats={myHomeworkStats} notices={visibleNotices}
                                setActiveTab={setActiveTab}
                                today={today} todayDayName={todayDayName} todayItems={todayItems} filteredTodayItems={filteredTodayItems}
                                externalSchedules={externalSchedules} // ✅ [추가] 타학원 일정 데이터 전달
                            />
                        )}
                        {activeTab === 'class' && <ClassTab myClasses={myClasses} setSelectedClassId={setSelectedClassId} />}
                        {activeTab === 'schedule' && (
                            <ScheduleTab
                                myClasses={myClasses} externalSchedules={externalSchedules} attendanceLogs={attendanceLogs}
                                studentId={studentId} student={student} onSaveExternalSchedule={onSaveExternalSchedule} onDeleteExternalSchedule={onDeleteExternalSchedule} clinicLogs={clinicLogs}
                                closures={closures}
                            />
                        )}
                        {activeTab === 'learning' && (
                            <LearningTab
                                studentId={studentId} myHomeworkStats={myHomeworkStats} myGradeComparison={myGradeComparison}
                                clinicLogs={clinicLogs} students={students} classes={classes}
                                initialTab={initialLearningTab}
                            />
                        )}
                        {activeTab === 'board' && <BoardTab notices={visibleNotices} />}
                        {activeTab === 'menu' && (
                            <MenuTab 
                                student={student} onUpdateStudent={onUpdateStudent} onLogout={onLogout}
                                videoMemos={videoMemos} lessonLogs={filteredLessonLogs} onLinkToMemo={handleNavigateToMemo} notices={visibleNotices}
                                setActiveTab={setActiveTab}
                            />
                        )}
                    </div>
                )}
            </main>

            {student && !selectedClassId && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.03)] h-[calc(60px+env(safe-area-inset-bottom))]">
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
                <div className={`fixed bottom-24 right-5 z-[60] flex flex-col gap-3 items-center transition-all duration-300 ${isVideoModalOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
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