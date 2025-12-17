// src/pages/ParentHome.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { 
    ScheduleTab, LearningTab, MenuTab, BoardTab 
} from '../components/StudentTabs';
import ParentClassroomView from './parent/ParentClassroomView';
import StudentHeader from '../components/StudentHeader';
import StudentNotifications from '../components/StudentNotifications';
import StudentMessenger from '../components/StudentMessenger';
import { Icon, calculateHomeworkStats, calculateGradeComparison } from '../utils/helpers';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { initialPayments } from '../api/initialData';
import ParentSessionReport from './parent/ParentSessionReport'; // ✅ 신규 리포트 컴포넌트
import { generateSessionReport } from '../utils/reportHelper'; // ✅ 리포트 데이터 생성 헬퍼

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
                <div className="p-2">
                    {todaySchedules.length > 0 ? (
                        todaySchedules.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors">
                                <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">{item.time}</span>
                                <div>
                                    <div className="font-bold text-gray-900 text-sm">{item.title}</div>
                                    <div className="text-xs text-gray-500">{item.sub}</div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-8 text-center text-gray-400 text-xs">
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
    studentId: initialStudentId, students, classes, homeworkAssignments, homeworkResults, 
    attendanceLogs, lessonLogs, notices, tests, grades, 
    videoProgress, clinicLogs, onLogout,
    externalSchedules, onSaveExternalSchedule, onDeleteExternalSchedule,
    messages, onSendMessage
}) {
    // 1. 자녀 데이터 및 선택 로직
    const initialStudent = students.find(s => s.id === initialStudentId);
    const myChildren = useMemo(() => {
        if (!initialStudent) return [];
        return students.filter(s => s.parentPhone === initialStudent.parentPhone);
    }, [students, initialStudent]);

    const [activeChildId, setActiveChildId] = useState(initialStudentId);
    const activeChild = students.find(s => s.id === activeChildId) || initialStudent;

    // 2. 데이터 필터링
    const myClasses = useMemo(() => classes.filter(c => c.students.includes(activeChildId)), [classes, activeChildId]);
    const myHomeworkStats = useMemo(() => calculateHomeworkStats(activeChildId, homeworkAssignments, homeworkResults), [activeChildId, homeworkAssignments, homeworkResults]);
    const myGradeComparison = useMemo(() => calculateGradeComparison(activeChildId, classes, tests, grades), [activeChildId, classes, tests, grades]);
    const myPayments = useMemo(() => initialPayments.filter(p => p.studentId === activeChildId).sort((a, b) => new Date(b.date) - new Date(a.date)), [activeChildId]);
    const unpaidPayments = myPayments.filter(p => p.status === '미납');

    // 3. 상태 관리
    const [activeTab, setActiveTab] = useState('home');
    const [selectedClassId, setSelectedClassId] = useState(null);
    const [initialLearningTab, setInitialLearningTab] = useState('homework');
    
    // ✅ 리포트 뷰 상태
    const [selectedReportId, setSelectedReportId] = useState(null);

    // 알림 관련
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [visibleNotices, setVisibleNotices] = useState([]); 
    const [hasNewNotifications, setHasNewNotifications] = useState(false);

    useEffect(() => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        
        const myNotices = notices.filter(n => 
            !n.targetStudents || n.targetStudents.length === 0 || n.targetStudents.includes(activeChildId)
        );
        let combinedNotices = [...myNotices];

        if (unpaidPayments.length > 0) {
            combinedNotices.unshift({
                id: `payment-alert-${activeChildId}`, title: '🚨 수업료/교재비 미납 안내',
                content: `${activeChild.name} 학생의 미납 내역이 ${unpaidPayments.length}건 있습니다.`,
                author: '행정실', date: todayStr, isPinned: true
            });
        }
        setVisibleNotices(combinedNotices);
        if (combinedNotices.length > visibleNotices.length) setHasNewNotifications(true);
    }, [notices, activeChildId, unpaidPayments.length, activeChild.name]);

    // ✅ 리포트 데이터 생성 (현재 선택된 리포트 ID가 있을 때만)
    const activeReport = useMemo(() => {
        if (!selectedReportId) return null;
        // 전체 데이터를 컨텍스트로 전달
        const contextData = { lessonLogs, attendanceLogs, homeworkAssignments, homeworkResults, tests, grades };
        return generateSessionReport(selectedReportId, activeChildId, contextData);
    }, [selectedReportId, activeChildId, lessonLogs, attendanceLogs, homeworkAssignments, homeworkResults, tests, grades]);

    const navItems = [
        { id: 'home', icon: 'home', label: '홈' },
        { id: 'report', icon: 'pieChart', label: '학습리포트' },
        { id: 'schedule', icon: 'calendar', label: '일정' },
        { id: 'payment', icon: 'creditCard', label: '결제' },
        { id: 'menu', icon: 'menu', label: '전체' },
    ];

    return (
        <div className="bg-gray-50 min-h-screen flex flex-col relative font-sans">
            {/* 헤더 & 자녀 선택 */}
            <div className="bg-white sticky top-0 z-30 shadow-sm">
                <div className="bg-indigo-900 text-white px-4 py-2 flex justify-between items-center text-xs font-bold">
                    <span>학부모 전용</span>
                    <span className="opacity-80">{activeChild.school} {activeChild.grade}</span>
                </div>
                <StudentHeader />
                {myChildren.length > 1 && (
                    <div className="flex px-4 border-b border-gray-100 overflow-x-auto no-scrollbar">
                        {myChildren.map(child => (
                            <button
                                key={child.id}
                                onClick={() => { setActiveChildId(child.id); setSelectedClassId(null); setSelectedReportId(null); setActiveTab('home'); }}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all whitespace-nowrap border-b-2 ${
                                    activeChildId === child.id ? 'border-indigo-600 text-indigo-900' : 'border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${activeChildId === child.id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>{child.name[0]}</div>
                                {child.name}
                            </button>
                        ))}
                    </div>
                )}
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
                        classes={classes} lessonLogs={lessonLogs} attendanceLogs={attendanceLogs} studentId={activeChildId}
                        selectedClassId={selectedClassId} setSelectedClassId={setSelectedClassId}
                        videoProgress={videoProgress} homeworkAssignments={homeworkAssignments} homeworkResults={homeworkResults}
                        tests={tests} grades={grades}
                        onNavigateToTab={(tab, subTab = 'homework') => { setSelectedClassId(null); setActiveTab('report'); if (subTab) setInitialLearningTab(subTab); }}
                        onOpenReport={(sessionId) => setSelectedReportId(sessionId)} // ✅ 리포트 열기 핸들러
                    />
                ) : (
                    /* [라우팅 분기 3] 메인 대시보드 */
                    <div className="animate-fade-in space-y-4">
                        {activeTab === 'home' && (
                            <ParentDashboard 
                                child={activeChild} myClasses={myClasses} attendanceLogs={attendanceLogs} 
                                homeworkStats={myHomeworkStats} gradeComparison={myGradeComparison} 
                                clinicLogs={clinicLogs} unpaidPayments={unpaidPayments}
                                setActiveTab={setActiveTab} 
                            />
                        )}
                        {activeTab === 'report' && (
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <h2 className="text-xl font-bold text-gray-900 px-1">수강 중인 강의실</h2>
                                    <div className="grid grid-cols-1 gap-3">
                                        {myClasses.map(cls => (
                                            <div key={cls.id} onClick={() => setSelectedClassId(cls.id)} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all">
                                                <div className="flex gap-3 items-center">
                                                    <div className="bg-indigo-50 w-12 h-12 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-lg">{cls.name[0]}</div>
                                                    <div>
                                                        <h4 className="font-bold text-gray-900">{cls.name}</h4>
                                                        <p className="text-xs text-gray-500">{cls.teacher} 선생님 | {cls.schedule.days.join(',')} {cls.schedule.time}</p>
                                                    </div>
                                                </div>
                                                <Icon name="chevronRight" className="w-5 h-5 text-gray-300" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <LearningTab 
                                    studentId={activeChildId} myHomeworkStats={myHomeworkStats} myGradeComparison={myGradeComparison} 
                                    clinicLogs={clinicLogs} students={students} classes={classes}
                                    initialTab={initialLearningTab} isParent={true} 
                                />
                            </div>
                        )}
                        {activeTab === 'schedule' && (
                            <ScheduleTab 
                                myClasses={myClasses} attendanceLogs={attendanceLogs} clinicLogs={clinicLogs} studentId={activeChildId} 
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
            
            <div className={`fixed bottom-20 right-4 z-[60] transition-all duration-300`}>
                <button onClick={() => setIsNotificationOpen(true)} className="bg-white text-indigo-900 border border-indigo-200 p-3 rounded-full shadow-lg hover:bg-gray-50 active:scale-90 flex items-center justify-center relative"><NotificationsIcon style={{ fontSize: 24 }} />{hasNewNotifications && <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-1 ring-white"></span>}</button>
            </div>
            <StudentMessenger studentId={activeChildId} teacherName="담당 선생님" messages={messages} onSendMessage={onSendMessage} bottomPosition="bottom-36" />
            <StudentNotifications isOpen={isNotificationOpen} onClose={() => setIsNotificationOpen(false)} notices={visibleNotices} onDelete={() => {}} onNoticeClick={() => { setActiveTab('board'); setIsNotificationOpen(false); }} />
        </div>
    );
}