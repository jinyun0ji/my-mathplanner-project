// src/pages/ParentHome.jsx
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
    ScheduleTab, MenuTab, BoardTab
} from '../components/StudentTabs';
import ParentClassroomView from './parent/ParentClassroomView';
import StudentHeader from '../components/StudentHeader';
import StudentMessenger from '../components/StudentMessenger';
import { Icon, calculateHomeworkStats, calculateGradeComparison } from '../utils/helpers';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { initialPayments } from '../api/initialData';
import ParentSessionReport from './parent/ParentSessionReport'; // ✅ 신규 리포트 컴포넌트
import { generateSessionReport } from '../utils/reportHelper'; // ✅ 리포트 데이터 생성 헬퍼
import useNotifications from '../notifications/useNotifications';
import NotificationList from '../notifications/NotificationList';
import openNotification from '../notifications/openNotification';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/client';
import { useParentContext } from '../parent';
import { getDefaultClassId, sortClassesByStatus } from '../utils/classStatus';

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
    attendanceLogs, lessonLogs, notices, tests, grades, 
    videoProgress, clinicLogs, onLogout,
    externalSchedules, onSaveExternalSchedule, onDeleteExternalSchedule,
    messages, onSendMessage
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
    const myClasses = useMemo(() => classes.filter(c => c.students.includes(activeChildId)), [classes, activeChildId]);
    const { ongoing: ongoingClasses } = useMemo(() => sortClassesByStatus(myClasses), [myClasses]);
    const myHomeworkStats = useMemo(() => calculateHomeworkStats(activeChildId, homeworkAssignments, homeworkResults), [activeChildId, homeworkAssignments, homeworkResults]);
    const myGradeComparison = useMemo(() => calculateGradeComparison(activeChildId, classes, tests, grades), [activeChildId, classes, tests, grades]);
    const myPayments = useMemo(() => initialPayments.filter(p => p.studentId === activeChildId).sort((a, b) => new Date(b.date) - new Date(a.date)), [activeChildId]);
    const unpaidPayments = myPayments.filter(p => p.status === '미납');

    // 3. 상태 관리
    const [activeTab, setActiveTab] = useState('home');
    const [selectedClassId, setSelectedClassId] = useState(null);
    const [reportFocus, setReportFocus] = useState(null);
    
    // ✅ 리포트 뷰 상태
    const [selectedReportId, setSelectedReportId] = useState(null);

    useEffect(() => {
        setReportFocus(null);
    }, [activeChildId]);

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

    useEffect(() => {
        setActiveChildId(activeStudentId);
        setSelectedClassId(null);
        setSelectedReportId(null);
        setActiveTab('home');
    }, [activeStudentId]);

    // 알림 관련
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [visibleNotices, setVisibleNotices] = useState([]); 
    const { notifications, hasUnread, unreadCount, markAllRead, lastReadAt, isLoading, isMetaLoading } = useNotifications(userId);

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
                    setReportFocus(null);
                    return;
                }

                if (refCollection === 'attendanceLogs') {
                    setActiveTab('report');
                    setReportFocus('attendance');
                    return;
                }

                if (refCollection === 'homeworkResults') {
                    setActiveTab('report');
                    setReportFocus('homework');
                    return;
                }

                if (refCollection === 'grades') {
                    setActiveTab('report');
                    setReportFocus('grade');
                    return;
                }

                if (refCollection === 'chats') {
                    setActiveTab('menu');
                }
            },
        });
        setIsNotificationOpen(false);
    };

    const handleChatOpen = async (chatId) => {
        if (!userId || !db) {
            return;
        }

        await setDoc(doc(db, 'users', userId, 'chatIndex', chatId), {
            unreadCount: 0,
            lastReadAt: serverTimestamp(),
        }, { merge: true });
    };

    const childAttendanceLogs = useMemo(() => {
        return attendanceLogs
            .filter(l => l.studentId === activeChildId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [attendanceLogs, activeChildId]);

    const attendanceSummary = useMemo(() => {
        const recent = childAttendanceLogs.slice(0, 4);
        const presentCount = recent.filter(l => ['출석', '동영상보강'].includes(l.status)).length;
        const rate = recent.length > 0 ? Math.round((presentCount / recent.length) * 100) : 100;
        const lastStatus = recent[0]?.status || '기록 없음';
        return { rate, presentCount, total: recent.length, lastStatus };
    }, [childAttendanceLogs]);

    const homeworkSummary = useMemo(() => {
        const pending = myHomeworkStats.filter(hw => hw.status !== '완료').length;
        const avgCompletion = myHomeworkStats.length > 0 
            ? Math.round(myHomeworkStats.reduce((sum, hw) => sum + (hw.completionRate || 0), 0) / myHomeworkStats.length)
            : 0;
        const nextDue = [...myHomeworkStats]
            .filter(hw => hw.status !== '완료' && hw.deadline)
            .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];

        return { pending, avgCompletion, nextDue };
    }, [myHomeworkStats]);

    const gradeSummary = useMemo(() => {
        if (!myGradeComparison || myGradeComparison.length === 0) {
            return { latest: null, diff: null, trend: '데이터 준비 중' };
        }
        const sorted = [...myGradeComparison].sort((a, b) => new Date(a.testDate) - new Date(b.testDate));
        const latest = sorted[sorted.length - 1];
        const prev = sorted[sorted.length - 2];
        const diff = prev ? latest.studentScore - prev.studentScore : null;
        let trend = '기록 시작';
        if (diff !== null) {
            trend = diff > 0 ? '상승 중' : diff < 0 ? '하락 주의' : '유지';
        }
        return { latest, diff, trend };
    }, [myGradeComparison]);

    const myLessonLogs = useMemo(() => {
        const myClassIds = myClasses.map(c => c.id);
        return lessonLogs
            .filter(log => myClassIds.includes(log.classId))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [lessonLogs, myClasses]);

    const sessionReports = useMemo(() => {
        const contextData = { lessonLogs, attendanceLogs, homeworkAssignments, homeworkResults, tests, grades, classes };
        return myLessonLogs
            .map(log => generateSessionReport(log.id, activeChildId, contextData))
            .filter(Boolean);
    }, [myLessonLogs, activeChildId, lessonLogs, attendanceLogs, homeworkAssignments, homeworkResults, tests, grades, classes]);

    const reportAlerts = useMemo(() => {
        const items = [];
        if (reportFocus === 'homework') {
            items.push({
                id: 'focus-homework',
                title: '과제 확인 요청',
                desc: '선생님이 과제 진행 상황을 확인해 달라고 남겼어요.',
                icon: 'fileText',
                tone: 'info'
            });
        }
        if (attendanceSummary.rate < 85 || ['지각', '결석'].includes(attendanceSummary.lastStatus)) {
            items.push({
                id: 'attendance',
                title: '출결 관리가 필요해요',
                desc: `최근 4회 출석률 ${attendanceSummary.rate}% (${attendanceSummary.presentCount}/${attendanceSummary.total})`,
                icon: 'user',
                tone: attendanceSummary.rate < 70 ? 'danger' : 'warning'
            });
        }
        if (homeworkSummary.pending > 0) {
            items.push({
                id: 'homework',
                title: '미완료 과제가 있어요',
                desc: `확인 필요 과제 ${homeworkSummary.pending}건`,
                icon: 'clipboard',
                tone: homeworkSummary.pending >= 3 ? 'danger' : 'warning'
            });
        }
        if (gradeSummary.diff !== null && gradeSummary.diff < 0) {
            items.push({
                id: 'grade',
                title: '성적 하락 주의',
                desc: `최근 시험 점수 ${gradeSummary.diff}점 하락`,
                icon: 'trendingDown',
                tone: 'warning'
            });
        }
        if (unpaidPayments.length > 0) {
            items.push({
                id: 'payment',
                title: '결제 안내',
                desc: `미납 내역 ${unpaidPayments.length}건이 있습니다.`,
                icon: 'creditCard',
                tone: 'warning'
            });
        }
        return items;
    }, [attendanceSummary, homeworkSummary, gradeSummary, unpaidPayments.length, reportFocus]);

    const classSummaries = useMemo(() => {
        return ongoingClasses.map(cls => {
            const latestAttendance = childAttendanceLogs.find(log => log.classId === cls.id);
            const classHomeworks = myHomeworkStats.filter(hw => hw.classId === cls.id);
            const pendingHomeworks = classHomeworks.filter(hw => hw.status !== '완료').length;
            const completionRate = classHomeworks.length > 0 
                ? Math.round(classHomeworks.reduce((sum, hw) => sum + (hw.completionRate || 0), 0) / classHomeworks.length)
                : 0;
            const classGrades = myGradeComparison.filter(g => (tests || []).find(t => t.id === g.testId)?.classId === cls.id);
            const latestScore = classGrades[0];
            const scoreDiff = classGrades.length > 1 ? classGrades[0].studentScore - classGrades[1].studentScore : null;

            return {
                ...cls,
                latestAttendance: latestAttendance?.status || '기록 없음',
                pendingHomeworks,
                completionRate,
                latestScore,
                scoreDiff
            };
        });
    }, [ongoingClasses, childAttendanceLogs, myHomeworkStats, myGradeComparison, tests]);

    const defaultReportClassId = useMemo(
        () => getDefaultClassId(ongoingClasses.length > 0 ? ongoingClasses : myClasses),
        [ongoingClasses, myClasses]
    );

    // ✅ 리포트 데이터 생성 (현재 선택된 리포트 ID가 있을 때만)
    const activeReport = useMemo(() => {
        if (!selectedReportId) return null;
        // 전체 데이터를 컨텍스트로 전달
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
                ) : selectedClassId ? (
                    /* [라우팅 분기 2] 강의실 화면 (리포트 진입 핸들러 전달) */
                    <ParentClassroomView 
                            classes={classes} lessonLogs={lessonLogs} attendanceLogs={attendanceLogs}
                            selectedClassId={selectedClassId} setSelectedClassId={setSelectedClassId}
                            videoProgress={videoProgress} homeworkAssignments={homeworkAssignments} homeworkResults={homeworkResults}
                            tests={tests} grades={grades}
                            onNavigateToTab={(tab, subTab = 'homework') => { setSelectedClassId(null); setActiveTab('report'); if (subTab) setReportFocus(subTab); }}
                            onOpenReport={(sessionId) => setSelectedReportId(sessionId)} // ✅ 리포트 열기 핸들러
                            activeStudentName={activeChildName}
                    />
                ) : (
                    /* [라우팅 분기 3] 메인 대시보드 */
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
                                                    최근 알림
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
                                                <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${unpaidPayments.length > 0 ? 'bg-red-50 text-red-700 ring-1 ring-red-100' : 'bg-green-50 text-green-700 ring-1 ring-green-100'}`}>
                                                    {unpaidPayments.length > 0 ? `미납 ${unpaidPayments.length}건` : '모두 납부 완료'}
                                                </span>
                                            </div>
                                            {myPayments.length > 0 ? (
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
                                <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 md:p-6">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div className="space-y-2">
                                            <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-[0.2em]">학습 리포트</p>
                                            <h2 className="text-2xl font-extrabold text-gray-900">부모님을 위한 {activeChildName} 리포트</h2>
                                            <p className="text-sm text-gray-600">출결, 과제, 성적을 한 화면에서 확인하고 바로 대응할 수 있도록 정리했어요.</p>
                                            {reportFocus && (
                                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                                                    <Icon name="pin" className="w-3.5 h-3.5" />
                                                    집중 확인 영역: {reportFocus === 'grades' ? '성적' : reportFocus === 'clinic' ? '클리닉' : '과제'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 w-full md:w-64">
                                            <p className="text-[11px] font-semibold text-indigo-600 mb-1">최근 출결</p>
                                            <p className="text-3xl font-extrabold text-indigo-900">{attendanceSummary.total > 0 ? `${attendanceSummary.rate}%` : '-'}</p>
                                            <p className="text-xs text-indigo-600 mt-1">
                                                {attendanceSummary.total > 0 
                                                    ? `${attendanceSummary.presentCount}/${attendanceSummary.total}회 출석 · 최근 ${attendanceSummary.lastStatus}` 
                                                    : '최근 출결 데이터가 없습니다.'}
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                <div className="grid grid-cols-3 gap-3">
                                    <ReportStatCard 
                                        icon="user" 
                                        label="출석 안정도" 
                                        value={attendanceSummary.total > 0 ? `${attendanceSummary.rate}%` : '데이터 없음'} 
                                        caption={attendanceSummary.total > 0 ? `최근 4회 중 ${attendanceSummary.presentCount}회 출석` : '최근 출결 데이터가 없습니다.'}
                                        tone={attendanceSummary.rate < 80 ? 'warning' : 'info'}
                                    />
                                    <ReportStatCard 
                                        icon="fileText" 
                                        label="과제 완료율" 
                                        value={`${homeworkSummary.avgCompletion}%`} 
                                        caption={homeworkSummary.pending > 0 ? `미완료 ${homeworkSummary.pending}건` : (homeworkSummary.nextDue ? `${homeworkSummary.nextDue.deadline} 마감` : '모두 완료')} 
                                        tone={homeworkSummary.pending > 0 ? 'warning' : 'info'} 
                                    />
                                    <ReportStatCard 
                                        icon="trendingUp" 
                                        label="최근 성적" 
                                        value={gradeSummary.latest ? `${gradeSummary.latest.studentScore}점` : '기록 준비 중'} 
                                        caption={gradeSummary.latest ? `${gradeSummary.latest.testName} · 반 평균 ${gradeSummary.latest.classAverage}점` : '시험 데이터 입력 대기'} 
                                        tone={gradeSummary.diff !== null && gradeSummary.diff < 0 ? 'warning' : 'default'} 
                                    />
                                </div>

                                {reportAlerts.length > 0 && (
                                    <section className="bg-orange-50 border border-orange-100 rounded-2xl p-4 space-y-2 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-bold text-orange-800 flex items-center gap-2">
                                                <Icon name="alertCircle" className="w-4 h-4" />
                                                부모님 확인이 필요해요
                                            </h3>
                                            <span className="text-[11px] font-semibold text-orange-600 bg-white/70 px-2 py-0.5 rounded-full border border-orange-100">{reportAlerts.length}건</span>
                                        </div>
                                        <div className="space-y-2">
                                            {reportAlerts.map(item => <ReportAlertItem key={item.id} item={item} />)}
                                        </div>
                                    </section>
                                )}

                                <section className="space-y-3">
                                    <div className="flex items-center justify-between px-1">
                                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                            <Icon name="clipboard" className="w-5 h-5 text-indigo-600" />
                                            최근 수업 리포트
                                        </h3>
                                        {myClasses.length > 0 && (
                                            <button onClick={() => setSelectedClassId(defaultReportClassId)} className="text-xs text-indigo-600 font-semibold hover:underline">
                                                반별 기록 보기
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid-cols-3 gap-3">
                                        {sessionReports.slice(0, 4).map(report => (
                                            <button 
                                                key={report.sessionId} 
                                                onClick={() => setSelectedReportId(report.sessionId)} 
                                                className="w-full text-left bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:border-indigo-200 hover:-translate-y-0.5 transition-all h-full flex flex-col gap-3"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="space-y-1 min-w-0">
                                                        <p className="text-[11px] text-gray-400 font-semibold">{report.date} • {report.className}</p>
                                                        <p className="text-base font-bold text-gray-900 line-clamp-2">{report.progressTopic || '진도 기록 없음'}</p>
                                                        <p className="text-xs text-gray-500 line-clamp-2">{report.lessonSummary?.[0]}</p>
                                                    </div>
                                                    <Icon name="chevronRight" className="w-5 h-5 text-gray-300 flex-shrink-0" />
                                                </div>
                                                <div className="flex flex-wrap gap-2 mt-auto">
                                                    <StatusPill icon="user" label={`출결 ${report.attendance}`} tone={['결석', '지각'].includes(report.attendance) ? 'danger' : 'default'} />
                                                    <StatusPill icon="fileText" label={`과제 ${report.homeworkStatus}`} tone={['미제출', '일부 미완'].includes(report.homeworkStatus) ? 'warning' : 'info'} />
                                                    <StatusPill icon="edit" label={`테스트 ${report.testScore}`} tone={report.testScore === '미응시' ? 'warning' : 'default'} />
                                                </div>
                                            </button>
                                        ))}
                                        {sessionReports.length === 0 && (
                                            <div className="p-6 text-center bg-white border border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 sm:col-span-2 xl:col-span-3">
                                                아직 기록된 리포트가 없습니다.
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <section className="space-y-3">
                                    <div className="flex items-center justify-between px-1">
                                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                            <Icon name="barChart" className="w-5 h-5 text-indigo-600" />
                                            반별 현황
                                        </h3>
                                        <span className="text-xs text-gray-400 font-semibold">진행 중 {ongoingClasses.length}개 반</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                        {classSummaries.map(cls => (
                                            <div key={cls.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="space-y-1">
                                                        <p className="text-[11px] text-gray-400 font-semibold">{cls.schedule.days.join(', ')} {cls.schedule.time}</p>
                                                        <h4 className="font-bold text-gray-900">{cls.name}</h4>
                                                         <p className="text-xs text-gray-500">{cls.teacher} 선생님</p>
                                                    </div>
                                                    <button 
                                                        onClick={() => setSelectedClassId(cls.id)} 
                                                        className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 hover:bg-indigo-100 active:scale-95 transition"
                                                    >
                                                        강의실 열기
                                                    </button>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <StatusPill icon="user" label={`출결 ${cls.latestAttendance}`} tone={['결석', '지각'].includes(cls.latestAttendance) ? 'warning' : 'info'} />
                                                    <StatusPill icon="clipboard" label={`과제 완료 ${cls.completionRate}%`} tone={cls.pendingHomeworks > 0 ? 'warning' : 'default'} />
                                                    <StatusPill 
                                                        icon="trendingUp" 
                                                        label={cls.latestScore ? `최근 ${cls.latestScore.testName} ${cls.latestScore.studentScore}점` : '테스트 대기'} 
                                                        tone={cls.scoreDiff !== null && cls.scoreDiff < 0 ? 'warning' : 'default'} 
                                                    />
                                                </div>
                                                {cls.pendingHomeworks > 0 && (
                                                    <p className="text-[11px] text-orange-600 bg-orange-50 px-3 py-2 rounded-xl border border-orange-100 font-semibold">
                                                        미완료 과제 {cls.pendingHomeworks}건이 있습니다. 제출 여부를 확인해주세요.
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                        {ongoingClasses.length === 0 && (
                                            <div className="p-6 text-center bg-white border border-dashed border-gray-200 rounded-2xl text-sm text-gray-400">
                                                등록된 반이 없습니다.
                                            </div>
                                        )}
                                    </div>
                                </section>
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
                                {myPayments.length > 0 ? myPayments.map((item, idx) => (
                                    <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.status === '완납' ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-600'}`}>{item.status === '완납' ? '결제완료' : '미납'}</span>
                                                <span className="text-xs text-gray-400">{item.date}</span>
                                            </div>
                                            <h4 className="font-bold text-gray-900 text-lg">{item.bookName || `${item.month} 수강료`}</h4>
                                            <p className="text-xs text-gray-500 mt-0.5">{item.method} | {item.type}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`block font-bold text-lg ${item.status === '미납' ? 'text-red-600' : 'text-gray-900'}`}>{item.amount.toLocaleString()}원</span>
                                            {item.status === '미납' && <button className="mt-1 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-700 active:scale-95 transition">결제하기</button>}
                                        </div>
                                    </div>
                                )) : (<div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">결제 내역이 없습니다.</div>)}
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
            
            {/* ✅ [수정] 플로팅 버튼 통합 컨테이너 */}
            <div className={`fixed bottom-24 right-5 z-[60] flex flex-col gap-3 items-center`}>
                {/* 1. 알림 버튼 */}
                <button 
                    onClick={() => setIsNotificationOpen(true)} 
                    className="bg-white text-indigo-900 border border-indigo-200 p-3 rounded-full shadow-lg hover:bg-gray-50 active:scale-90 flex items-center justify-center relative w-12 h-12"
                >
                    <NotificationsIcon style={{ fontSize: 24 }} />
                    {hasUnread && <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-1 ring-white"></span>}
                </button>

                {/* 2. 메신저 버튼 */}
                <StudentMessenger 
                    studentId={activeChildId} 
                    teacherName="채수용T" 
                    messages={messages} 
                    onSendMessage={onSendMessage} 
                    onOpenChat={handleChatOpen}
                    isFloating={false} 
                />
            </div>
            <NotificationList
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
                notifications={notifications}
                onNotificationClick={handleNotificationClick}
                onMarkAllRead={markAllRead}
                unreadCount={unreadCount}
                lastReadAt={lastReadAt}
                isLoading={isLoading || isMetaLoading}
            />
        </div>
    );
}

const toneStyles = {
    default: { bg: 'bg-white', border: 'border-gray-200', text: 'text-gray-900', muted: 'text-gray-500', iconBg: 'bg-gray-100', icon: 'text-gray-600' },
    info: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-800', muted: 'text-blue-600', iconBg: 'bg-white', icon: 'text-blue-600' },
    warning: { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-800', muted: 'text-orange-600', iconBg: 'bg-white', icon: 'text-orange-600' },
    danger: { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-800', muted: 'text-red-600', iconBg: 'bg-white', icon: 'text-red-600' }
};

const ReportStatCard = ({ icon, label, value, caption, tone = 'default' }) => {
    const style = toneStyles[tone] || toneStyles.default;
    return (
        <div className={`p-4 rounded-2xl border shadow-sm ${style.bg} ${style.border}`}>
            <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${style.iconBg}`}>
                    <Icon name={icon} className={`w-5 h-5 ${style.icon}`} />
                </div>
                <span className={`text-[11px] font-bold ${style.muted}`}>최근 업데이트</span>
            </div>
            <p className={`text-xs font-semibold ${style.muted}`}>{label}</p>
            <p className={`text-2xl font-extrabold ${style.text}`}>{value}</p>
            {caption && <p className={`text-[11px] mt-1 ${style.muted}`}>{caption}</p>}
        </div>
    );
};

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

const ReportAlertItem = ({ item }) => {
    const styles = {
        info: { container: 'border-blue-100 text-blue-800', icon: 'bg-blue-50 text-blue-600' },
        warning: { container: 'border-orange-100 text-orange-800', icon: 'bg-orange-50 text-orange-600' },
        danger: { container: 'border-red-100 text-red-800', icon: 'bg-red-50 text-red-600' }
    };
    const tone = styles[item.tone] || styles.info;
    return (
        <div className={`p-3 rounded-xl border bg-white flex items-start gap-3 shadow-sm ${tone.container}`}>
            <div className={`p-2 rounded-lg ${tone.icon}`}>
                <Icon name={item.icon} className="w-4 h-4" />
            </div>
            <div>
                <p className="text-sm font-bold">{item.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
        </div>
    );
};