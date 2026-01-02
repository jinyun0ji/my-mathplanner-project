// src/pages/ParentHome.jsx
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
    ScheduleTab, MenuTab, BoardTab
} from '../components/StudentTabs';
import ParentClassroomView from './parent/ParentClassroomView';
import StudentHeader from '../components/StudentHeader';
import { Icon, calculateHomeworkStats, calculateGradeComparison } from '../utils/helpers';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ParentSessionReport from './parent/ParentSessionReport'; // ✅ 신규 리포트 컴포넌트
import { generateSessionReport } from '../utils/reportHelper'; // ✅ 리포트 데이터 생성 헬퍼
import useNotifications from '../notifications/useNotifications';
import NotificationList from '../notifications/NotificationList';
import openNotification from '../notifications/openNotification';
import { useParentContext } from '../parent';
import { sortClassesByStatus } from '../utils/classStatus';
import { db } from '../firebase/client';

// --- [컴포넌트] 학부모 전용 대시보드 ---
const ParentDashboard = ({ 
    child, myClasses, attendanceLogs, homeworkStats, 
    gradeComparison, clinicLogs, unpaidPayments, 
    setActiveTab 
}) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const todayDayName = dayNames[today.getDay()];

    // 1. 상태 계산 로직
    const statusData = useMemo(() => {
        // [출결] 최근 4회 기준
        const recentLogs = attendanceLogs
            .filter(l => l.studentId === child.id)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 4);
        const presentCount = recentLogs.filter(l => ['출석', '동영상보강'].includes(l.status)).length;
        const attendRate = recentLogs.length > 0 ? (presentCount / recentLogs.length) * 100 : 100;
        
        let attendStatus = { color: 'bg-indigo-50 text-indigo-700 border-indigo-100', label: '정상', icon: 'check' };
        if (attendRate < 50) attendStatus = { color: 'bg-red-50 text-red-700 border-red-100', label: '주의 필요', icon: 'alertCircle' };
        else if (attendRate < 80) attendStatus = { color: 'bg-orange-50 text-orange-700 border-orange-100', label: '확인 요망', icon: 'alertCircle' };

        // [과제] 미제출 건수 기준
        const pendingCount = homeworkStats.filter(h => h.status !== '완료').length;
        let hwStatus = { color: 'bg-indigo-50 text-indigo-700 border-indigo-100', label: '양호' };
        if (pendingCount >= 5) hwStatus = { color: 'bg-red-50 text-red-700 border-red-100', label: '제출 지연' };
        else if (pendingCount >= 3) hwStatus = { color: 'bg-orange-50 text-orange-700 border-orange-100', label: '확인 필요' };

        // [성적] 직전 시험 대비 추이
        let gradeStatus = { color: 'bg-gray-50 text-gray-600 border-gray-200', label: '데이터 없음' };
        if (gradeComparison && gradeComparison.length >= 2) {
            const sorted = [...gradeComparison].sort((a, b) => new Date(a.testDate) - new Date(b.testDate));
            const latest = sorted[sorted.length - 1];
            const prev = sorted[sorted.length - 2];
            
            if (latest.studentScore > prev.studentScore) gradeStatus = { color: 'bg-blue-50 text-blue-700 border-blue-100', label: '상승세' };
            else if (latest.studentScore < prev.studentScore) gradeStatus = { color: 'bg-orange-50 text-orange-700 border-orange-100', label: '하락세' };
            else gradeStatus = { color: 'bg-gray-50 text-gray-700 border-gray-200', label: '유지' };
        }

        return { attend: attendStatus, hw: hwStatus, grade: gradeStatus };
    }, [attendanceLogs, homeworkStats, gradeComparison, child.id]);

    // 2. 오늘의 수업 요약
    const todaySchedules = [
        ...myClasses.filter(c => c.schedule.days.includes(todayDayName)).map(c => ({
            type: 'class', time: c.schedule.time, title: c.name, sub: `${c.teacher} 선생님`
        })),
        ...clinicLogs.filter(l => l.studentId === child.id && l.date === todayStr && !l.checkOut).map(l => ({
            type: 'clinic', time: l.checkIn, title: '학습 클리닉', sub: '등원 예정'
        }))
    ].sort((a, b) => a.time.localeCompare(b.time));

    // 3. 확인 필요 항목 (Action Items)
    const actionItems = [];
    if (unpaidPayments.length > 0) {
        actionItems.push({ id: 'pay', type: 'danger', text: `미납된 수업료/교재비가 ${unpaidPayments.length}건 있습니다.`, link: 'payment' });
    }
    if (statusData.attend.label !== '정상') {
        actionItems.push({ id: 'att', type: 'warning', text: '최근 출결 상태 확인이 필요합니다.', link: 'report' });
    }
    if (statusData.hw.label === '제출 지연') {
        actionItems.push({ id: 'hw', type: 'warning', text: '장기 미제출 과제가 확인되었습니다.', link: 'report' });
    }

    return (
        <div className="space-y-6 pb-6 animate-fade-in-up">
            {/* 1. 상단 상태 요약 카드 */}
            <section>
                <h3 className="text-sm font-bold text-gray-500 mb-3 px-1">학습 상태 요약</h3>
                <div className="grid grid-cols-3 gap-3">
                    <div onClick={() => setActiveTab('report')} className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center shadow-sm cursor-pointer active:scale-95 transition-all ${statusData.attend.color}`}>
                        <div className="mb-2 opacity-80"><Icon name="user" className="w-6 h-6" /></div>
                        <span className="text-xs font-medium opacity-70 mb-0.5">최근 출결</span>
                        <span className="text-lg font-extrabold">{statusData.attend.label}</span>
                    </div>
                    <div onClick={() => setActiveTab('report')} className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center shadow-sm cursor-pointer active:scale-95 transition-all ${statusData.hw.color}`}>
                        <div className="mb-2 opacity-80"><Icon name="fileText" className="w-6 h-6" /></div>
                        <span className="text-xs font-medium opacity-70 mb-0.5">과제 수행</span>
                        <span className="text-lg font-extrabold">{statusData.hw.label}</span>
                    </div>
                    <div onClick={() => setActiveTab('report')} className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center shadow-sm cursor-pointer active:scale-95 transition-all ${statusData.grade.color}`}>
                        <div className="mb-2 opacity-80"><Icon name="trendingUp" className="w-6 h-6" /></div>
                        <span className="text-xs font-medium opacity-70 mb-0.5">성적 추이</span>
                        <span className="text-lg font-extrabold">{statusData.grade.label}</span>
                    </div>
                </div>
            </section>

            {/* 2. 중단 오늘의 수업 */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Icon name="calendar" className="w-4 h-4 text-indigo-600" />
                        오늘의 수업 ({todaySchedules.length})
                    </h3>
                    <span className="text-xs text-gray-500">{today.getMonth() + 1}월 {today.getDate()}일 ({todayDayName})</span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {todaySchedules.length > 0 ? (
                        todaySchedules.map((item, idx) => (
                             <div key={idx} className="flex items-center gap-3 p-3 hover:bg-indigo-50 rounded-xl transition-colors border border-gray-100">
                                <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">{item.time}</span>
                                <div>
                                    <div className="font-bold text-gray-900 text-sm">{item.title}</div>
                                    <div className="text-xs text-gray-500">{item.sub}</div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-8 text-center text-gray-400 text-xs sm:col-span-2">
                            예정된 학원 일정이 없습니다.
                        </div>
                    )}
                </div>
            </section>

            {/* 3. 하단 확인 필요 항목 (조건부 노출) */}
            {actionItems.length > 0 && (
                <section className="animate-fade-in">
                    <h3 className="text-sm font-bold text-red-600 mb-2 px-1 flex items-center gap-1">
                        <Icon name="alertCircle" className="w-4 h-4" /> 확인이 필요합니다
                    </h3>
                    <div className="space-y-2">
                        {actionItems.map((item) => (
                            <div 
                                key={item.id} 
                                onClick={() => setActiveTab(item.link)}
                                className={`p-4 rounded-xl border flex justify-between items-center cursor-pointer shadow-sm active:scale-[0.98] transition-transform ${
                                    item.type === 'danger' ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'
                                }`}
                            >
                                <span className={`text-sm font-bold ${
                                    item.type === 'danger' ? 'text-red-700' : 'text-orange-700'
                                }`}>{item.text}</span>
                                <Icon name="chevronRight" className={`w-4 h-4 ${
                                    item.type === 'danger' ? 'text-red-300' : 'text-orange-300'
                                }`} />
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

// --- 메인 페이지 컴포넌트 ---
export default function ParentHome({
    userId, students, classes, homeworkAssignments, homeworkResults,
    attendanceLogs, lessonLogs, notices, tests, grades, classTestStats,
    videoProgress, clinicLogs, onLogout,
    externalSchedules, onSaveExternalSchedule, onDeleteExternalSchedule
}) {
    const { activeStudentId, studentIds, setActiveStudentId } = useParentContext();
    // 1. 자녀 데이터 및 선택 로직
    const initialStudent = students.find(s => s.id === activeStudentId);
    const [activeChildId, setActiveChildId] = useState(activeStudentId);
    const pendingStudentSwitchRef = useRef(null);
    const activeChild = students.find(s => s.id === activeChildId) || initialStudent;
    const activeChildName = activeChild?.name || '학생';
    const activeChildSchool = activeChild?.school || '학교 정보 없음';
    const activeChildGrade = activeChild?.grade || '학년 정보 없음';

    // 2. 데이터 필터링
    const myClasses = useMemo(() => classes.filter(c => (c.students || []).includes(activeChildId)), [classes, activeChildId]);

    // ✅ 변경: 진행중/종강 분리 + 둘 다 사용
    const { ongoing: ongoingClasses, finished: finishedClasses } = useMemo(
        () => sortClassesByStatus(myClasses),
        [myClasses],
    );

    const myHomeworkStats = useMemo(
        () => calculateHomeworkStats(
            activeChildId,
            homeworkAssignments,
            homeworkResults,
            { activeViewerAuthUid: activeChild?.authUid, studentAuthUid: activeChild?.authUid, activeStudentId: activeChildId, students },
        ),
        [activeChild?.authUid, activeChildId, homeworkAssignments, homeworkResults, students],
    );
    const myGradeComparison = useMemo(() => calculateGradeComparison(activeChildId, classes, tests, grades, classTestStats), [activeChildId, classes, tests, grades, classTestStats]);
    const isPaymentFeatureLocked = true;
    const myPayments = useMemo(() => [], []);
    const unpaidPayments = [];

    // 3. 상태 관리
    // ✅ 탭/상세 상태를 URL(querystring)에 동기화해서 "뒤로가기"가 탭 전환으로 동작하게 함
    const [searchParams, setSearchParams] = useSearchParams();

    const readTabFromUrl = () => searchParams.get('tab') || 'home';
    const readClassroomFromUrl = () => searchParams.get('classroomId');
    const readReportFromUrl = () => searchParams.get('reportId');

    const [activeTab, _setActiveTab] = useState(readTabFromUrl());
    const [selectedClassroomId, _setSelectedClassroomId] = useState(readClassroomFromUrl());
// ✅ 리포트 뷰 상태
    const [reportViewMode, setReportViewMode] = useState('overview'); // 'overview' | 'byClass'
    const [selectedClassId, setSelectedClassId] = useState(null);
    const [expandedSections, setExpandedSections] = useState({ homework: false, grades: false });
    const [selectedReportId, _setSelectedReportId] = useState(readReportFromUrl());

    // ✅ URL -> state (브라우저 뒤로/앞으로로 URL이 바뀌면 화면도 따라감)
    useEffect(() => {
        const nextTab = readTabFromUrl();
        const nextClassroomId = readClassroomFromUrl();
        const nextReportId = readReportFromUrl();

        if (nextTab !== activeTab) _setActiveTab(nextTab);
        if ((nextClassroomId || null) !== (selectedClassroomId || null)) _setSelectedClassroomId(nextClassroomId || null);
        if ((nextReportId || null) !== (selectedReportId || null)) _setSelectedReportId(nextReportId || null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // ✅ state -> URL (앱 내부 동작은 아래 래퍼 함수를 통해서만 변경)
    const setActiveTab = useCallback((tab, { replace = false } = {}) => {
        _setActiveTab(tab);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', tab);

            // 탭 이동 시, 상세 화면 파라미터 정리 (정책: report 탭이 아니면 상세 파라미터 제거)
            if (tab !== 'report') {
                next.delete('reportId');
                next.delete('classroomId');
            }
            return next;
        }, { replace });
    }, [setSearchParams]);

    const setSelectedClassroomId = useCallback((classId, { replace = false } = {}) => {
        const value = classId === null || classId === undefined || classId === '' ? null : String(classId);
        _setSelectedClassroomId(value);
        // classroom 선택은 report 탭 컨텍스트
        if (value) _setActiveTab('report');

        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (value) {
                next.set('tab', 'report');
                next.set('classroomId', value);
                next.delete('reportId');
            } else {
                next.delete('classroomId');
            }
            return next;
        }, { replace });
    }, [setSearchParams]);

    const setSelectedReportId = useCallback((reportId, { replace = false } = {}) => {
        const value = reportId === null || reportId === undefined || reportId === '' ? null : String(reportId);
        _setSelectedReportId(value);
        // report 선택은 report 탭 컨텍스트
        if (value) _setActiveTab('report');

        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (value) {
                next.set('tab', 'report');
                next.set('reportId', value);
                next.delete('classroomId');
            } else {
                next.delete('reportId');
            }
            return next;
        }, { replace });
    }, [setSearchParams]);


    const isParent = true;

    const lessonSectionRef = useRef(null);
    const clinicSectionRef = useRef(null);
    const classStatusRef = useRef(null);


    const waitForActiveStudentSwitch = useCallback((studentId) => {
        if (!studentId || studentId === activeStudentId) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            pendingStudentSwitchRef.current = { studentId, resolve };
        });
    }, [activeStudentId]);

    useEffect(() => {
        const pending = pendingStudentSwitchRef.current;
        if (!pending || pending.studentId !== activeStudentId) {
            return;
        }

        pending.resolve();
        pendingStudentSwitchRef.current = null;
    }, [activeStudentId]);

    const scrollToSection = (ref) => {
        if (ref?.current) {
            ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    useEffect(() => {
        setActiveChildId(activeStudentId);
        setSelectedClassroomId(null, { replace: true });
        setSelectedClassId(null);
        setSelectedReportId(null, { replace: true });
        setExpandedSections({ homework: false, grades: false });
        setReportViewMode('overview');
        setActiveTab('home', { replace: true });
    }, [activeStudentId]);

    useEffect(() => {
        if (activeTab === 'report') {
            setReportViewMode('overview');
            setSelectedClassId(null);
            setExpandedSections({ homework: false, grades: false });
        }
    }, [activeTab]);

    // 알림 관련
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [visibleNotices, setVisibleNotices] = useState([]); 
    const viewerUid = activeChild?.authUid || userId;
    const { notifications, hasUnread, unreadCount, lastReadAt, isLoading, isMetaLoading, setNotifications } = useNotifications(viewerUid);

    const myClinicLogs = useMemo(() => {
        if (!Array.isArray(clinicLogs) || !activeChildId) return [];
        return clinicLogs.filter((log) => log?.studentId === activeChildId);
    }, [clinicLogs, activeChildId]);

    const completedClinics = useMemo(() => {
        return myClinicLogs
            .filter((log) => log?.checkOut)
            .sort((a, b) => {
                const aDate = new Date(`${a?.date || ''}T${a?.checkOut || '00:00'}`);
                const bDate = new Date(`${b?.date || ''}T${b?.checkOut || '00:00'}`);
                return bDate - aDate;
            });
    }, [myClinicLogs]);

    useEffect(() => {
        if (!activeChild) return;
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        
        const myNotices = notices.filter(n => 
            !n.targetStudents || n.targetStudents.length === 0 || n.targetStudents.includes(activeChildId)
        );
        let combinedNotices = [...myNotices];

        if (unpaidPayments.length > 0) {
            combinedNotices.unshift({
                id: `payment-alert-${activeChildId}`, title: '🚨 수업료/교재비 미납 안내',
                content: `${activeChildName} 학생의 미납 내역이 ${unpaidPayments.length}건 있습니다.`,
                author: '행정실', date: todayStr, isPinned: true
            });
        }
        setVisibleNotices(combinedNotices);
        if (combinedNotices.length > visibleNotices.length) {
            return;
        }
    }, [notices, activeChildId, unpaidPayments.length, activeChildName, activeChild]);

    const pendingHomeworkCount = useMemo(
        () => myHomeworkStats.filter(h => h.status !== '완료').length,
        [myHomeworkStats]
    );

    const latestAttendance = useMemo(() => {
        const logs = attendanceLogs
            .filter(l => l.studentId === activeChildId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        if (!logs.length) return null;
        return { status: logs[0].status, date: logs[0].date };
    }, [attendanceLogs, activeChildId]);

    const latestGrade = useMemo(() => {
        if (!myGradeComparison || myGradeComparison.length === 0) return null;
        const sorted = [...myGradeComparison].sort((a, b) => new Date(a.testDate) - new Date(b.testDate));
        return sorted[sorted.length - 1];
    }, [myGradeComparison]);

    const nextClass = useMemo(() => {
        if (!ongoingClasses || ongoingClasses.length === 0) return null;
        const sorted = [...ongoingClasses].sort((a, b) => a.schedule.time.localeCompare(b.schedule.time));
        return sorted[0];
    }, [ongoingClasses]);

    const noticePreview = useMemo(() => visibleNotices.slice(0, 3), [visibleNotices]);

    const handleNotificationClick = async (notification) => {
        const targetStudentId = notification?.studentId;
        const canSwitchStudent = targetStudentId
            && targetStudentId !== activeStudentId
            && Array.isArray(studentIds)
            && studentIds.includes(targetStudentId);

        if (canSwitchStudent) {
            await setActiveStudentId(targetStudentId);
            await waitForActiveStudentSwitch(targetStudentId);
        }

        await openNotification({
            notification,
            onNavigate: ({ refCollection, refId }) => {
                setSelectedClassId(null);
                if (refCollection === 'lessonLogs') {
                    setSelectedReportId(refId);
                    setActiveTab('report');
                    return;
                }

                if (refCollection === 'attendanceLogs') {
                    setActiveTab('report');
                    return;
                }

                if (refCollection === 'homeworkResults') {
                    setActiveTab('report');
                    return;
                }

                if (refCollection === 'grades') {
                    setActiveTab('report');
                    return;
                }

                if (refCollection === 'chats') {
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

    const childAttendanceLogs = useMemo(() => {
        return attendanceLogs
            .filter(l => l.studentId === activeChildId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [attendanceLogs, activeChildId]);

    const myLessonLogs = useMemo(() => {
        const myClassIds = myClasses.map(c => c.id);
        return lessonLogs
            .filter(log => myClassIds.includes(log.classId))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [lessonLogs, myClasses]);

    const isValidNumber = (n) => typeof n === 'number' && Number.isFinite(n);

    const recentLessons = useMemo(() => {
        const contextData = { lessonLogs, attendanceLogs, homeworkAssignments, homeworkResults, tests, grades, classes };
        return myLessonLogs
            .map((log) => {
                const report = generateSessionReport(log.id, activeChildId, contextData);
                const classInfo = classes.find((c) => String(c.id) === String(log.classId));
                return {
                    id: log.id,
                    classId: log.classId,
                    date: log.date,
                    className: classInfo?.name || '수업',
                    teacher: classInfo?.teacher || '담당 선생님',
                    comment: report?.learningComment || report?.progressTopic || log.progress || '수업 기록을 준비 중입니다.',
                    attendance: report?.attendance || '기록 없음',
                    homeworkStatus: report?.homeworkStatus || '과제 없음',
                    testStatus: report?.testScore || '테스트 없음',
                };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);
    }, [myLessonLogs, activeChildId, lessonLogs, attendanceLogs, homeworkAssignments, homeworkResults, tests, grades, classes]);

    const classList = useMemo(() => {
        const lessonsByClass = recentLessons.reduce((acc, cur) => {
            acc[cur.classId] = acc[cur.classId] || [];
            acc[cur.classId].push(cur.date);
            return acc;
        }, {});

        const build = (cls, status) => {
            const latestLessonDate = myLessonLogs.find((log) => log.classId === cls.id)?.date || lessonsByClass[cls.id]?.[0];
            return {
                id: cls.id,
                name: cls.name,
                teacher: cls.teacher,
                status,
                latestLessonDate: latestLessonDate || '기록 없음',
            };
        };

        return [
            ...ongoingClasses.map((cls) => build(cls, 'ongoing')),
            ...finishedClasses.map((cls) => build(cls, 'finished')),
        ];
    }, [ongoingClasses, finishedClasses, recentLessons, myLessonLogs]);

    const lessonsBySelectedClass = useMemo(() => {
        if (!selectedClassId) return [];
        return recentLessons.filter((lesson) => String(lesson.classId) === String(selectedClassId));
    }, [recentLessons, selectedClassId]);

    const homeworkBySelectedClass = useMemo(() => {
        if (!selectedClassId) return [];
        return myHomeworkStats
            .filter((hw) => String(hw.classId) === String(selectedClassId))
            .map((hw) => ({
                id: hw.id,
                title: hw.content || hw.title || '과제',
                completionRate: hw.completionRate,
                status: hw.status,
                classAverage: hw.classAverage,
            }));
    }, [myHomeworkStats, selectedClassId]);

    const testsBySelectedClass = useMemo(() => {
        if (!selectedClassId) return [];
        return (tests || [])
            .filter((test) => String(test.classId) === String(selectedClassId))
            .map((test) => {
                const studentRecord = grades?.[activeChildId]?.[test.id] || {};
                const studentScore = studentRecord.score ?? studentRecord.result ?? null;
                const classAverage = test.average ?? test.classAverage;
                return {
                    id: test.id,
                    name: test.name || '시험',
                    date: test.date,
                    studentScore,
                    classAverage,
                };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [tests, grades, activeChildId, selectedClassId]);

    // ✅ 리포트 데이터 생성 (현재 선택된 리포트 ID가 있을 때만)
    const activeReport = useMemo(() => {
        if (!selectedReportId) return null;
        const contextData = { lessonLogs, attendanceLogs, homeworkAssignments, homeworkResults, tests, grades, classes };
        return generateSessionReport(selectedReportId, activeChildId, contextData);
    }, [selectedReportId, activeChildId, lessonLogs, attendanceLogs, homeworkAssignments, homeworkResults, tests, grades, classes]);

    const navItems = [
        { id: 'home', icon: 'home', label: '홈' },
        { id: 'report', icon: 'pieChart', label: '학습리포트' },
        { id: 'schedule', icon: 'calendar', label: '일정' },
        { id: 'payment', icon: 'creditCard', label: '결제' },
        { id: 'menu', icon: 'menu', label: '전체' },
    ];

    if (!activeChild) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 text-sm text-gray-500">
                학생 정보를 불러오는 중...
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen flex flex-col relative font-sans">
            {/* 헤더 & 자녀 선택 */}
            <div className="bg-white sticky top-0 z-30 shadow-sm">
                <div className="bg-[radial-gradient(circle_at_15%_30%,rgba(56,189,248,0.18),transparent_35%),linear-gradient(135deg,#0f172a,#1e3a8a)] text-white px-4 py-2 flex justify-between items-center text-xs font-bold">
                    <span>학부모 전용</span>
                    <span className="opacity-80">{activeChildSchool} {activeChildGrade}</span>
                </div>
                <StudentHeader />
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <span className="text-xs text-gray-400">현재 자녀</span>
                        <span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
                            {activeChildName}
                        </span>
                    </div>
                    <button
                        type="button"
                        disabled
                        className="text-xs font-semibold text-gray-400 border border-gray-200 px-3 py-1.5 rounded-full cursor-not-allowed"
                    >
                        자녀 전환 준비 중
                    </button>
                </div>
            </div>

            <main className="flex-1 w-full max-w-md mx-auto p-4 pb-24 overflow-y-auto custom-scrollbar md:max-w-7xl">
                {/* [라우팅 분기 1] 리포트 상세 화면 */}
                {selectedReportId ? (
                    <ParentSessionReport
                        report={activeReport}
                        onBack={() => setSelectedReportId(null)}
                    />
                ) : selectedClassroomId ? (
                    /* [라우팅 분기 2] 강의실 화면 */
                    <ParentClassroomView 
                        classes={classes} lessonLogs={lessonLogs} attendanceLogs={attendanceLogs}
                        selectedClassId={selectedClassroomId} setSelectedClassId={setSelectedClassroomId}
                        videoProgress={videoProgress} homeworkAssignments={homeworkAssignments} homeworkResults={homeworkResults}
                        tests={tests} grades={grades}
                        onNavigateToTab={() => { setSelectedClassroomId(null); setActiveTab('report'); }}
                        onOpenReport={(sessionId) => setSelectedReportId(sessionId)}
                        activeStudentName={activeChildName}
                        studentDocId={activeChildId}
                        studentAuthUid={activeChild?.authUid}
                    />
                ) : (
                    /* [라우팅 분기 3] 메인 */
                    <div className="animate-fade-in space-y-4">
                        {activeTab === 'home' && (
                            <div className="space-y-4">
                                <section className="bg-[radial-gradient(ellipse_at_18%_25%,rgba(56,189,248,0.28),transparent_40%),radial-gradient(ellipse_at_82%_20%,rgba(45,212,191,0.24),transparent_40%),linear-gradient(135deg,#0a1434,#1d4ed8,#0d9488)] text-white rounded-3xl p-6 md:p-8 shadow-lg border border-sky-900/40">
                                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                                        <div className="space-y-3">
                                            <p className="text-xs uppercase tracking-[0.2em] text-sky-200 font-semibold">학부모 홈</p>
                                            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">{activeChildName} 학습 현황</h2>
                                            <p className="text-sm text-sky-100">오늘 바로 확인해야 할 과제, 일정, 결제 정보를 한눈에 모았습니다.</p>
                                            <div className="flex flex-wrap gap-2">
                                                <span className="bg-white/10 border border-white/20 text-sky-50 px-3 py-1.5 rounded-full text-xs font-semibold">
                                                    {latestAttendance ? `최근 출결: ${latestAttendance.status} (${latestAttendance.date})` : '출결 기록 준비 중'}
                                                </span>
                                                <span className="bg-white/10 border border-white/20 text-sky-50 px-3 py-1.5 rounded-full text-xs font-semibold">
                                                    미제출 과제 {pendingHomeworkCount}건
                                                </span>
                                                <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${unpaidPayments.length > 0 ? 'bg-red-500/20 border-red-200 text-white' : 'bg-white/10 border-white/20 text-sky-50'}`}>
                                                    미납 {unpaidPayments.length}건
                                                </span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 lg:w-[360px]">
                                            <div className="bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur">
                                                <p className="text-xs text-sky-100 font-semibold mb-1">다음 수업</p>
                                                {nextClass ? (
                                                    <>
                                                        <p className="text-lg font-bold text-white">{nextClass.name}</p>
                                                        <p className="text-sm text-sky-100 mt-1">{nextClass.schedule.days.join(', ')} {nextClass.schedule.time}</p>
                                                        <p className="text-xs text-sky-100/80 mt-2">{nextClass.teacher} 선생님</p>
                                                    </>
                                                ) : (
                                                    <p className="text-sm text-sky-100">등록된 일정이 없습니다.</p>
                                                )}
                                            </div>
                                            <div className="bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur">
                                                <p className="text-xs text-sky-100 font-semibold mb-1">최근 성적</p>
                                                {latestGrade ? (
                                                    <>
                                                        <p className="text-lg font-bold text-white">{latestGrade.testName}</p>
                                                        <p className="text-sm text-sky-100 mt-1">점수 {latestGrade.studentScore}점 / 반 평균 {latestGrade.classAverage}점</p>
                                                        <p className="text-xs text-sky-100/80 mt-2">{latestGrade.testDate}</p>
                                                    </>
                                                ) : (
                                                    <p className="text-sm text-sky-100">등록된 시험 기록이 없습니다.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-6">
                                        <button onClick={() => setActiveTab('report')} className="bg-white text-sky-950 px-4 py-2 rounded-xl font-bold text-sm shadow-md hover:-translate-y-0.5 transition-transform">학습 리포트 보기</button>
                                        <button onClick={() => setActiveTab('schedule')} className="bg-blue-900/70 border border-white/20 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-800/80 transition-colors">일정 확인</button>
                                        <button onClick={() => setActiveTab('payment')} className="bg-blue-900/70 border border-white/20 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-800/80 transition-colors">결제 현황</button>
                                    </div>
                                </section>

                                <div className="grid gap-4 lg:grid-cols-3">
                                    <div className="space-y-4 lg:col-span-2">
                                        <ParentDashboard 
                                            child={activeChild} myClasses={ongoingClasses} attendanceLogs={attendanceLogs} 
                                            homeworkStats={myHomeworkStats} gradeComparison={myGradeComparison} 
                                            clinicLogs={clinicLogs} unpaidPayments={unpaidPayments}
                                            setActiveTab={setActiveTab} 
                                        />
                                    </div>
                                    <aside className="space-y-4">
                                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                    <Icon name="bell" className="w-4 h-4 text-indigo-600" />
                                                    공지사항
                                                </h3>
                                                <button onClick={() => setActiveTab('board')} className="text-xs text-indigo-600 font-semibold hover:underline">전체 보기</button>
                                            </div>
                                            <div className="space-y-2">
                                                {noticePreview.length > 0 ? noticePreview.map(notice => (
                                                    <button 
                                                        key={notice.id} 
                                                        onClick={() => setActiveTab('board')}
                                                        className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
                                                    >
                                                        <p className="text-sm font-bold text-gray-900">{notice.title}</p>
                                                        <p className="text-xs text-gray-500 mt-1">{notice.content}</p>
                                                        <p className="text-[11px] text-gray-400 mt-1">{notice.author || '채수용 수학'} • {notice.date}</p>
                                                    </button>
                                                )) : (
                                                    <p className="text-xs text-gray-500 py-2">새로운 알림이 없습니다.</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                    <Icon name="creditCard" className="w-4 h-4 text-indigo-600" />
                                                    결제 요약
                                                </h3>
                                                <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${isPaymentFeatureLocked ? 'bg-gray-100 text-gray-500 ring-1 ring-gray-200' : (unpaidPayments.length > 0 ? 'bg-red-50 text-red-700 ring-1 ring-red-100' : 'bg-green-50 text-green-700 ring-1 ring-green-100')}`}>
                                                    {isPaymentFeatureLocked ? '추후 제공 예정' : (unpaidPayments.length > 0 ? `미납 ${unpaidPayments.length}건` : '모두 납부 완료')}
                                                </span>
                                            </div>
                                            {isPaymentFeatureLocked ? (
                                                <div className="p-3 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-xs text-gray-500">
                                                    결제 기능은 모바일 앱에서 제공될 예정입니다.
                                                </div>
                                            ) : myPayments.length > 0 ? (
                                                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                                                    <p className="text-xs text-gray-500 mb-1">최근 결제</p>
                                                    <p className="text-sm font-bold text-gray-900">{myPayments[0].bookName || `${myPayments[0].month} 수강료`}</p>
                                                    <p className="text-xs text-gray-500 mt-1">{myPayments[0].date} • {myPayments[0].method}</p>
                                                    <p className="text-lg font-extrabold text-indigo-900 mt-1">{myPayments[0].amount.toLocaleString()}원</p>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-500">결제 내역이 없습니다.</p>
                                            )}
                                            <button 
                                                onClick={() => setActiveTab('payment')} 
                                                className="w-full py-2 rounded-lg text-sm font-bold bg-indigo-50 text-indigo-900 hover:bg-indigo-100 transition-colors"
                                            >
                                                결제 내역 전체 보기
                                            </button>
                                        </div>
                                    </aside>
                                </div>
                            </div>
                        )}

                        {activeTab === 'report' && (
                            <div className="space-y-6">
                                {reportViewMode === 'overview' && (
                                    <>
                                        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 md:p-6 space-y-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-[0.2em]">학습 리포트</p>
                                                    <h2 className="text-2xl font-extrabold text-gray-900">{activeChildName} 리포트 요약</h2>
                                                    <p className="text-sm text-gray-600">최근 기록 위주로 빠르게 확인하세요.</p>
                                                </div>
                                                <button
                                                    onClick={() => { setReportViewMode('byClass'); setSelectedClassId(null); setExpandedSections({ homework: false, grades: false }); }}
                                                    className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100 hover:bg-indigo-100"
                                                >
                                                    클래스별 기록 보기
                                                </button>
                                            </div>
                                        <div className="space-y-3" ref={lessonSectionRef}>
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                        <Icon name="clipboard" className="w-5 h-5 text-indigo-600" />
                                                        최근 수업 리포트
                                                    </h3>
                                                </div>
                                                <div className="space-y-3">
                                                    {recentLessons.slice(0, 5).map((lesson) => (
                                                        <div key={lesson.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-2">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="space-y-1 min-w-0">
                                                                    <p className="text-[11px] text-gray-400 font-semibold">{lesson.date} • {lesson.className}</p>
                                                                    <p className="text-sm text-gray-500">{lesson.teacher} 선생님</p>
                                                                    <p className="text-base font-bold text-gray-900 line-clamp-2">{lesson.comment}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2 mt-1">
                                                                <StatusPill icon="user" label={lesson.attendance} tone={['결석', '지각'].includes(lesson.attendance) ? 'warning' : 'info'} />
                                                                <StatusPill icon="fileText" label={lesson.homeworkStatus} tone={['미제출', '일부 미완'].includes(lesson.homeworkStatus) ? 'warning' : 'default'} />
                                                                <StatusPill icon="edit" label={lesson.testStatus} tone={lesson.testStatus === '미응시' ? 'warning' : 'default'} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {recentLessons.length === 0 && (
                                                        <div className="p-6 text-center bg-white border border-dashed border-gray-200 rounded-2xl text-sm text-gray-400">
                                                            아직 작성된 수업 리포트가 없습니다.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </section>

                                        <section ref={clinicSectionRef} className="space-y-3">
                                            <div className="flex items-center justify-between px-1">
                                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                    <Icon name="activity" className="w-5 h-5 text-indigo-600" />
                                                    클리닉 리포트
                                                </h3>
                                                <span className="text-xs text-gray-400 font-semibold">최근 {completedClinics.length}개</span>
                                            </div>
                                            <div className="space-y-3">
                                                {completedClinics.slice(0, 3).map((log) => (
                                                    <div key={`${log.date}-${log.checkIn}`} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="space-y-1">
                                                                <p className="text-[11px] text-gray-400 font-semibold">{log.date} • {log.checkIn}~{log.checkOut}</p>
                                                                <h4 className="font-bold text-gray-900 text-sm">학습 클리닉</h4>
                                                                <p className="text-xs text-gray-500">{log.teacher || '담당 선생님'}</p>
                                                            </div>
                                                            <StatusPill icon="clock" label="완료" tone="info" />
                                                        </div>
                                                        <p className="text-sm text-gray-700 leading-6">{log.note || '코멘트가 아직 작성되지 않았습니다.'}</p>
                                                    </div>
                                                ))}
                                                {completedClinics.length === 0 && (
                                                    <div className="p-6 text-center bg-white border border-dashed border-gray-200 rounded-2xl text-sm text-gray-400">
                                                        아직 클리닉 기록이 없습니다.
                                                    </div>
                                                )}
                                            </div>
                                            </section>

                                        <section ref={classStatusRef} className="space-y-3">
                                            <div className="flex items-center justify-between px-1">
                                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                    <Icon name="barChart" className="w-5 h-5 text-indigo-600" />
                                                    클래스 목록
                                                </h3>
                                                <span className="text-xs text-gray-400 font-semibold">총 {classList.length}개 반</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                                {classList.map((cls) => (
                                                    <button
                                                        key={cls.id}
                                                        onClick={() => { setReportViewMode('byClass'); setSelectedClassId(cls.id); setExpandedSections({ homework: false, grades: false }); }}
                                                        className="text-left bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3 hover:border-indigo-200 transition"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="space-y-1">
                                                                <p className="text-[11px] text-gray-400 font-semibold">{cls.latestLessonDate}</p>
                                                                <h4 className="font-bold text-gray-900">{cls.name}</h4>
                                                                <p className="text-xs text-gray-500">{cls.teacher} 선생님</p>
                                                            </div>
                                                            <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${cls.status === 'ongoing' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
                                                                {cls.status === 'ongoing' ? '진행중' : '종강'}
                                                            </span>
                                                        </div>
                                                    </button>
                                                ))}
                                                {classList.length === 0 && (
                                                    <div className="p-6 text-center bg-white border border-dashed border-gray-200 rounded-2xl text-sm text-gray-400">
                                                        등록된 반이 없습니다.
                                                    </div>
                                                )}
                                            </div>
                                        </section>
                                    </>
                                )}
                                {reportViewMode === 'byClass' && (
                                    <>
                                        {!selectedClassId && (
                                            <section className="space-y-3">
                                                <div className="flex items-center justify-between px-1">
                                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                        <Icon name="barChart" className="w-5 h-5 text-indigo-600" />
                                                        클래스별 기록 보기
                                                    </h3>
                                                    <button
                                                        onClick={() => { setReportViewMode('overview'); setExpandedSections({ homework: false, grades: false }); }}
                                                        className="text-xs text-gray-500 underline"
                                                    >
                                                        학습리포트로 돌아가기
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                                    {classList.map((cls) => (
                                                        <button
                                                            key={cls.id}
                                                            onClick={() => { setSelectedClassId(cls.id); setExpandedSections({ homework: false, grades: false }); }}
                                                            className="text-left bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3 hover:border-indigo-200 transition"
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="space-y-1">
                                                                    <p className="text-[11px] text-gray-400 font-semibold">{cls.latestLessonDate}</p>
                                                                    <h4 className="font-bold text-gray-900">{cls.name}</h4>
                                                                    <p className="text-xs text-gray-500">{cls.teacher} 선생님</p>
                                                                </div>
                                                                <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${cls.status === 'ongoing' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
                                                                    {cls.status === 'ongoing' ? '진행중' : '종강'}
                                                                </span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </section>
                                        )}

                                        {selectedClassId && (
                                            <section className="space-y-4">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => { setSelectedClassId(null); setExpandedSections({ homework: false, grades: false }); }}
                                                            className="text-xs text-gray-600 hover:underline flex items-center gap-1"
                                                        >
                                                            <Icon name="chevronLeft" className="w-4 h-4" /> 전체 반 목록으로 돌아가기
                                                        </button>
                                                        <button
                                                            onClick={() => { setReportViewMode('overview'); setSelectedClassId(null); setExpandedSections({ homework: false, grades: false }); }}
                                                            className="text-xs text-gray-400 underline"
                                                        >
                                                            학습리포트로 돌아가기
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                        <Icon name="clipboard" className="w-5 h-5 text-indigo-600" />
                                                        최근 수업 기록
                                                    </h3>
                                                    <div className="space-y-3">
                                                        {lessonsBySelectedClass.map((lesson) => (
                                                            <div key={lesson.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-2">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="space-y-1 min-w-0">
                                                                        <p className="text-[11px] text-gray-400 font-semibold">{lesson.date} • {lesson.className}</p>
                                                                        <p className="text-sm text-gray-500">{lesson.teacher} 선생님</p>
                                                                        <p className="text-base font-bold text-gray-900 line-clamp-2">{lesson.comment}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-wrap gap-2 mt-1">
                                                                    <StatusPill icon="user" label={lesson.attendance} tone={['결석', '지각'].includes(lesson.attendance) ? 'warning' : 'info'} />
                                                                    <StatusPill icon="fileText" label={lesson.homeworkStatus} tone={['미제출', '일부 미완'].includes(lesson.homeworkStatus) ? 'warning' : 'default'} />
                                                                    <StatusPill icon="edit" label={lesson.testStatus} tone={lesson.testStatus === '미응시' ? 'warning' : 'default'} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {lessonsBySelectedClass.length === 0 && (
                                                            <div className="p-6 text-center bg-white border border-dashed border-gray-200 rounded-2xl text-sm text-gray-400">
                                                                이 반의 수업 기록이 없습니다.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
                                                    <button
                                                        className="w-full flex items-center justify-between px-4 py-3 text-left"
                                                        onClick={() => setExpandedSections((prev) => ({ ...prev, homework: !prev.homework }))}
                                                    >
                                                        <span className="text-sm font-bold text-gray-900">과제 상세</span>
                                                        <Icon name={expandedSections.homework ? 'chevronUp' : 'chevronDown'} className="w-4 h-4 text-gray-500" />
                                                    </button>
                                                    {expandedSections.homework && (
                                                        <div className="divide-y divide-gray-100">
                                                            {homeworkBySelectedClass.map((hw) => {
                                                                const hasValidAverage = isValidNumber(hw.classAverage);
                                                                if (!hasValidAverage) {
                                                                    console.error('[ParentReport] homework class average missing', { classId: selectedClassId, assignmentId: hw.id });
                                                                }
                                                                return (
                                                                    <div key={hw.id} className="p-4 space-y-2">
                                                                        <div className="flex items-center justify-between">
                                                                            <div>
                                                                                <p className="text-sm font-bold text-gray-900">{hw.title}</p>
                                                                                <p className="text-xs text-gray-500">상태 {hw.status}</p>
                                                                            </div>
                                                                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">{hw.completionRate}%</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {homeworkBySelectedClass.length === 0 && (
                                                                <div className="p-4 text-sm text-gray-500">과제 기록이 없습니다.</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
                                                    <button
                                                        className="w-full flex items-center justify-between px-4 py-3 text-left"
                                                        onClick={() => setExpandedSections((prev) => ({ ...prev, grades: !prev.grades }))}
                                                    >
                                                        <span className="text-sm font-bold text-gray-900">성적 상세</span>
                                                        <Icon name={expandedSections.grades ? 'chevronUp' : 'chevronDown'} className="w-4 h-4 text-gray-500" />
                                                    </button>
                                                    {expandedSections.grades && (
                                                        <div className="divide-y divide-gray-100">
                                                            {testsBySelectedClass.map((test) => {
                                                                const hasValidAverage = isValidNumber(test.classAverage);
                                                                if (!hasValidAverage) {
                                                                    console.error('[ParentReport] test class average missing', { classId: selectedClassId, testId: test.id });
                                                                }
                                                                return (
                                                                    <div key={test.id} className="p-4 space-y-2">
                                                                        <div className="flex items-center justify-between">
                                                                            <div>
                                                                                <p className="text-sm font-bold text-gray-900">{test.name}</p>
                                                                                <p className="text-xs text-gray-500">{test.date}</p>
                                                                            </div>
                                                                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">{test.studentScore ?? '점수 없음'}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between text-xs text-gray-600">
                                                                            <span>반 평균</span>
                                                                            <span>{hasValidAverage ? `${test.classAverage}점` : '반 평균 없음'}</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {testsBySelectedClass.length === 0 && (
                                                                <div className="p-4 text-sm text-gray-500">시험 기록이 없습니다.</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </section>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === 'schedule' && (
                            <ScheduleTab 
                                myClasses={ongoingClasses} attendanceLogs={attendanceLogs} clinicLogs={clinicLogs} 
                                externalSchedules={externalSchedules} onSaveExternalSchedule={onSaveExternalSchedule} onDeleteExternalSchedule={onDeleteExternalSchedule}
                            />
                        )}

                        {activeTab === 'payment' && (
                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gray-900 px-1">결제 내역</h2>
                                <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                                    <div className="p-6 space-y-4 blur-sm select-none">
                                        <div className="h-16 rounded-xl bg-gray-100" />
                                        <div className="h-16 rounded-xl bg-gray-100" />
                                        <div className="h-16 rounded-xl bg-gray-100" />
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                                        <div className="text-center px-6">
                                            <p className="text-lg font-bold text-gray-800">결제 기능은 준비 중입니다</p>
                                            <p className="text-sm text-gray-500 mt-2">추후 모바일 앱에서 수납 기능을 제공할 예정입니다.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'menu' && (
                            <MenuTab student={activeChild} onUpdateStudent={() => {}} onLogout={onLogout} videoBookmarks={{}} lessonLogs={[]} onLinkToMemo={() => {}} notices={visibleNotices} setActiveTab={setActiveTab} isParent={true} />
                        )}
                        {activeTab === 'board' && <BoardTab notices={visibleNotices} />}
                    </div>
                )}
            </main>

            {!selectedClassId && !selectedReportId && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.03)] h-[calc(60px+env(safe-area-inset-bottom))]">
                    <div className="max-w-md mx-auto flex justify-around items-center h-[60px] md:max-w-7xl">
                        {navItems.map(item => (
                            <button 
                                key={item.id} 
                                onClick={() => setActiveTab(item.id)} 
                                className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 active:scale-95 ${activeTab === item.id || (item.id === 'menu' && activeTab === 'board') ? 'text-indigo-900' : 'text-gray-400 hover:text-gray-600'}`}
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
            
            <div className={`fixed bottom-24 right-5 z-[60] flex flex-col gap-3 items-center`}>
                <button 
                    onClick={() => setIsNotificationOpen(true)} 
                    className="bg-white text-indigo-900 border border-indigo-200 p-3 rounded-full shadow-lg hover:bg-gray-50 active:scale-90 flex items-center justify-center relative w-12 h-12"
                >
                    <NotificationsIcon style={{ fontSize: 24 }} />
                    {hasUnread && <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-1 ring-white"></span>}
                </button>
            </div>

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
        </div>
    );
}

const StatusPill = ({ icon, label, tone = 'default' }) => {
    const styles = {
        default: 'bg-gray-50 text-gray-700 border-gray-200',
        info: 'bg-indigo-50 text-indigo-700 border-indigo-100',
        warning: 'bg-orange-50 text-orange-700 border-orange-100',
        danger: 'bg-red-50 text-red-700 border-red-100'
    };
    const style = styles[tone] || styles.default;
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${style}`}>
            {icon && <Icon name={icon} className="w-3.5 h-3.5" />}
            {label}
        </span>
    );
};