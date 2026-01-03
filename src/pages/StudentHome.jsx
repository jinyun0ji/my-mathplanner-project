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
import { Icon, calculateHomeworkStats, calculateGradeComparison } from '../utils/helpers';
import { sortClassesByStatus } from '../utils/classStatus';
import NotificationsIcon from '@mui/icons-material/Notifications';
import useNotifications from '../notifications/useNotifications';
import NotificationList from '../notifications/NotificationList';
import openNotification from '../notifications/openNotification';
import { db } from '../firebase/client';

export default function StudentHome({
    student, studentId, userId, students, classes, homeworkAssignments, homeworkResults,
    attendanceLogs, lessonLogs, notices, tests, grades, classTestStats,
    videoProgress, onSaveVideoProgress, videoMemos, onAddMemo, onUpdateMemo, onDeleteMemo,
    externalSchedules, onSaveExternalSchedule, onDeleteExternalSchedule,
    clinicLogs, onUpdateStudent,
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
    const { notifications, hasUnread, unreadCount, lastReadAt, isLoading, isMetaLoading, setNotifications } = useNotifications(viewerUid);

    useEffect(() => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        const isTargetedToMe = (notice) => {
            const matchesAuth = studentAuthUid && Array.isArray(notice?.targetAuthUids)
                && notice.targetAuthUids.includes(studentAuthUid);
            const matchesLegacy = Array.isArray(notice?.targetStudents) && notice.targetStudents.includes(studentId);
            return matchesAuth || matchesLegacy;
        };
        
        const myNotices = notices.filter((n) => {
            const isPublicNotice = n?.isPublic === true;
            return isPublicNotice || isTargetedToMe(n);
        });
        const publicNotices = myNotices.filter((n) => n?.isPublic === true);
        const targetedNotices = myNotices.filter((n) => !n?.isPublic && isTargetedToMe(n));
        let combinedNotices = [...publicNotices, ...targetedNotices];
        setVisibleNotices(combinedNotices);
        if (combinedNotices.length > visibleNotices.length) {
            return;
        }
    }, [notices, studentId, studentAuthUid, visibleNotices.length]);

    const handleOpenNotification = () => { setIsNotificationOpen(true); };

    const myClasses = useMemo(() => {
        if (!classes || !studentId) return [];
        return classes.filter(c => (c.students || []).includes(studentId));
    }, [classes, studentId]);

    const { ongoing: ongoingClasses } = useMemo(() => {
        const sorted = sortClassesByStatus(myClasses);
        return { ongoing: sorted?.ongoing || [] };
    }, [myClasses]);

    const myHomeworkStats = useMemo(() => {
        if (!studentId) return [];
        return calculateHomeworkStats(
            studentId,
            homeworkAssignments || [],
            homeworkResults || [],
            { activeViewerAuthUid: userId, studentAuthUid: student?.authUid, userId, students },
        );
    }, [studentId, homeworkAssignments, homeworkResults, student?.authUid, students, userId]);

    const myGradeComparison = useMemo(() => {
        if (!studentId) return [];
        return calculateGradeComparison(studentId, classes || [], tests || [], grades || {}, classTestStats || {});
    }, [studentId, classes, tests, grades, classTestStats]);

    const pendingHomeworkCount = useMemo(
        () => myHomeworkStats.filter(h => h.status !== '완료').length,
        [myHomeworkStats]
    );

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
                        lessonLogs={lessonLogs}
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
                        homeworkAssignments={homeworkAssignments}
                        homeworkResults={homeworkResults}
                        tests={tests}
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
                                externalSchedules={externalSchedules} // ✅ [추가] 타학원 일정 데이터 전달
                            />
                        )}
                        {activeTab === 'class' && <ClassTab myClasses={myClasses} setSelectedClassId={setSelectedClassId} />}
                        {activeTab === 'schedule' && (
                            <ScheduleTab
                                myClasses={myClasses} externalSchedules={externalSchedules} attendanceLogs={attendanceLogs}
                                studentId={studentId} onSaveExternalSchedule={onSaveExternalSchedule} onDeleteExternalSchedule={onDeleteExternalSchedule} clinicLogs={clinicLogs}
                            />
                        )}
                        {activeTab === 'learning' && (
                            <LearningTab
                                studentId={studentId} myHomeworkStats={myHomeworkStats} myGradeComparison={myGradeComparison}
                                clinicLogs={clinicLogs} students={students} classes={classes}
                                initialTab={initialLearningTab}
                            />
                        )}
                        {activeTab === 'board' && <BoardTab notices={visibleNotices.filter((n) => n?.isPublic === true)} />}
                        {activeTab === 'menu' && (
                            <MenuTab 
                                student={student} onUpdateStudent={onUpdateStudent} onLogout={onLogout}
                                videoMemos={videoMemos} lessonLogs={lessonLogs} onLinkToMemo={handleNavigateToMemo} notices={visibleNotices}
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