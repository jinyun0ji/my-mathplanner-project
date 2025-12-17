// src/pages/ParentHome.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { 
    ScheduleTab, LearningTab, MenuTab, BoardTab 
} from '../components/StudentTabs';
import ParentClassroomView from './parent/ParentClassroomView';
import StudentHeader from '../components/StudentHeader';
import StudentNotifications from '../components/StudentNotifications';
import StudentMessenger from '../components/StudentMessenger';
import { Icon, calculateHomeworkStats, calculateGradeComparison, formatPrice } from '../utils/helpers';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { initialPayments } from '../api/initialData'; // ✅ 결제 데이터 연동

export default function ParentHome({ 
    studentId: initialStudentId, students, classes, homeworkAssignments, homeworkResults, 
    attendanceLogs, lessonLogs, notices, tests, grades, 
    videoProgress, clinicLogs, onLogout,
    externalSchedules, onSaveExternalSchedule, onDeleteExternalSchedule,
    messages, onSendMessage
}) {
    // 1. 자녀 데이터 로드 및 선택 로직
    const initialStudent = students.find(s => s.id === initialStudentId);
    // 같은 부모 연락처를 가진 학생들을 형제/자매로 간주
    const myChildren = useMemo(() => {
        if (!initialStudent) return [];
        return students.filter(s => s.parentPhone === initialStudent.parentPhone);
    }, [students, initialStudent]);

    const [activeChildId, setActiveChildId] = useState(initialStudentId);
    const activeChild = students.find(s => s.id === activeChildId) || initialStudent;

    // 2. 선택된 자녀 기준 데이터 필터링
    const myClasses = useMemo(() => classes.filter(c => c.students.includes(activeChildId)), [classes, activeChildId]);
    const myHomeworkStats = useMemo(() => calculateHomeworkStats(activeChildId, homeworkAssignments, homeworkResults), [activeChildId, homeworkAssignments, homeworkResults]);
    const myGradeComparison = useMemo(() => calculateGradeComparison(activeChildId, classes, tests, grades), [activeChildId, classes, tests, grades]);
    
    // 3. 결제 데이터 필터링 (학부모용 핵심 기능)
    const myPayments = useMemo(() => {
        return initialPayments.filter(p => p.studentId === activeChildId).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [activeChildId]);
    const unpaidPayments = myPayments.filter(p => p.status === '미납');

    // 4. 상태 관리
    const [activeTab, setActiveTab] = useState('home');
    const [selectedClassId, setSelectedClassId] = useState(null);
    const [initialLearningTab, setInitialLearningTab] = useState('homework');
    
    // 알림 관련
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [visibleNotices, setVisibleNotices] = useState([]); 
    const [hasNewNotifications, setHasNewNotifications] = useState(false);

    // 알림 로직 (자녀 변경 시 갱신)
    useEffect(() => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const myUpcomingClinics = clinicLogs?.filter(log => log.studentId === activeChildId && log.date >= todayStr && !log.checkOut) || [];
        
        const myNotices = notices.filter(n => 
            !n.targetStudents || n.targetStudents.length === 0 || n.targetStudents.includes(activeChildId)
        );
        let combinedNotices = [...myNotices];

        // 미납 알림 추가
        if (unpaidPayments.length > 0) {
            combinedNotices.unshift({
                id: `payment-alert-${activeChildId}`, title: '🚨 수업료/교재비 미납 안내',
                content: `${activeChild.name} 학생의 미납 내역이 ${unpaidPayments.length}건 있습니다. 확인 부탁드립니다.`,
                author: '행정실', date: todayStr, isPinned: true
            });
        }

        if (myUpcomingClinics.length > 0) {
            myUpcomingClinics.forEach(clinic => {
                const noticeId = `clinic-notice-${clinic.id}`;
                if (!combinedNotices.find(n => n.id === noticeId)) {
                    combinedNotices.push({
                        id: noticeId, title: '📅 자녀 클리닉 예약 알림',
                        content: `${clinic.date} ${clinic.checkIn}에 ${activeChild.name} 학생의 클리닉이 예약되어 있습니다.`,
                        author: '알림봇', date: todayStr, isPinned: false
                    });
                }
            });
        }
        setVisibleNotices(combinedNotices);
        if (combinedNotices.length > visibleNotices.length) setHasNewNotifications(true);
    }, [notices, clinicLogs, activeChildId, unpaidPayments.length, activeChild.name]);

    const handleOpenNotification = () => { setIsNotificationOpen(true); setHasNewNotifications(false); };
    const handleLinkToBoard = () => { setActiveTab('board'); setIsNotificationOpen(false); };
    const handleDeleteNotice = (id) => { setVisibleNotices(prev => prev.filter(n => n.id !== id)); };

    // 하단 네비게이션 아이템
    const navItems = [
        { id: 'home', icon: 'home', label: '홈' },
        { id: 'report', icon: 'pieChart', label: '학습리포트' }, // 자녀 강의실 + 학습 통계 통합
        { id: 'schedule', icon: 'calendar', label: '일정' },
        { id: 'payment', icon: 'creditCard', label: '결제' }, // ✅ 추가됨
        { id: 'menu', icon: 'menu', label: '전체' },
    ];

    return (
        <div className="bg-gray-50 min-h-screen flex flex-col relative font-sans">
            {/* 상단 헤더 & 자녀 선택기 */}
            <div className="bg-white sticky top-0 z-30 shadow-sm">
                <div className="bg-indigo-900 text-white px-4 py-2 flex justify-between items-center text-xs font-bold">
                    <span>학부모 모드</span>
                    <span className="opacity-80">{activeChild.school} {activeChild.grade}</span>
                </div>
                <StudentHeader />
                
                {/* 자녀 선택 탭 (자녀가 2명 이상일 때만 표시) */}
                {myChildren.length > 1 && (
                    <div className="flex px-4 border-b border-gray-100 overflow-x-auto no-scrollbar">
                        {myChildren.map(child => (
                            <button
                                key={child.id}
                                onClick={() => {
                                    setActiveChildId(child.id);
                                    setSelectedClassId(null);
                                    setActiveTab('home');
                                }}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all whitespace-nowrap border-b-2 ${
                                    activeChildId === child.id 
                                        ? 'border-indigo-600 text-indigo-900' 
                                        : 'border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                                    activeChildId === child.id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                                }`}>
                                    {child.name[0]}
                                </div>
                                {child.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <main className="flex-1 w-full max-w-md mx-auto p-4 pb-24 overflow-y-auto custom-scrollbar md:max-w-7xl">
                {selectedClassId ? (
                    <ParentClassroomView 
                        classes={classes} lessonLogs={lessonLogs} attendanceLogs={attendanceLogs} studentId={activeChildId}
                        selectedClassId={selectedClassId} setSelectedClassId={setSelectedClassId}
                        videoProgress={videoProgress}
                        homeworkAssignments={homeworkAssignments}
                        homeworkResults={homeworkResults}
                        tests={tests}
                        grades={grades}
                        onNavigateToTab={(tab, subTab = 'homework') => {
                            setSelectedClassId(null);
                            setActiveTab('report'); // 리포트 탭으로 이동
                            if (subTab) setInitialLearningTab(subTab);
                        }}
                    />
                ) : (
                    <div className="animate-fade-in space-y-4">
                        {/* 1. 홈 탭 (대시보드) */}
                        {activeTab === 'home' && (
                            <ParentDashboard 
                                child={activeChild}
                                unpaidPayments={unpaidPayments}
                                attendanceLogs={attendanceLogs}
                                myClasses={myClasses}
                                clinicLogs={clinicLogs}
                                externalSchedules={externalSchedules}
                                setActiveTab={setActiveTab}
                                notices={visibleNotices}
                            />
                        )}

                        {/* 2. 학습리포트 탭 (강의실 목록 + 상세 통계 통합) */}
                        {activeTab === 'report' && (
                            <div className="space-y-6">
                                {/* 강의실 바로가기 */}
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
                                {/* 상세 학습 탭 (기존 StudentTabs의 LearningTab 재사용) */}
                                <LearningTab 
                                    studentId={activeChildId} myHomeworkStats={myHomeworkStats} myGradeComparison={myGradeComparison} 
                                    clinicLogs={clinicLogs} students={students} classes={classes}
                                    initialTab={initialLearningTab} 
                                />
                            </div>
                        )}

                        {/* 3. 일정 탭 */}
                        {activeTab === 'schedule' && (
                            <ScheduleTab 
                                myClasses={myClasses} attendanceLogs={attendanceLogs} clinicLogs={clinicLogs} studentId={activeChildId} 
                                externalSchedules={externalSchedules}
                                onSaveExternalSchedule={onSaveExternalSchedule} 
                                onDeleteExternalSchedule={onDeleteExternalSchedule}
                            />
                        )}

                        {/* 4. 결제 탭 (신규) */}
                        {activeTab === 'payment' && (
                            <ParentPaymentTab 
                                payments={myPayments} 
                                studentName={activeChild.name}
                            />
                        )}

                        {/* 5. 전체 메뉴 */}
                        {activeTab === 'menu' && (
                            <MenuTab 
                                student={activeChild} onUpdateStudent={() => {}} onLogout={onLogout}
                                videoBookmarks={{}} lessonLogs={[]} onLinkToMemo={() => {}} notices={visibleNotices}
                                setActiveTab={setActiveTab}
                                isParent={true} 
                            />
                        )}

                        {/* 6. 공지사항 (히든 탭) */}
                        {activeTab === 'board' && <BoardTab notices={visibleNotices} />}
                    </div>
                )}
            </main>

            {/* 하단 네비게이션 */}
            {!selectedClassId && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.03)] h-[calc(60px+env(safe-area-inset-bottom))]">
                    <div className="max-w-md mx-auto flex justify-around items-center h-[60px] md:max-w-7xl">
                        {navItems.map(item => (
                            <button 
                                key={item.id} 
                                onClick={() => setActiveTab(item.id)} 
                                className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 active:scale-95 ${
                                    activeTab === item.id || (item.id === 'menu' && activeTab === 'board') ? 'text-indigo-900' : 'text-gray-400 hover:text-gray-600'
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
            
            {/* 알림 버튼 및 메신저 */}
            <div className={`fixed bottom-20 right-4 z-[60] transition-all duration-300`}>
                <button onClick={handleOpenNotification} className="bg-white text-indigo-900 border border-indigo-200 p-3 rounded-full shadow-lg hover:bg-gray-50 active:scale-90 flex items-center justify-center relative"><NotificationsIcon style={{ fontSize: 24 }} />{hasNewNotifications && <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-1 ring-white"></span>}</button>
            </div>
            <StudentMessenger studentId={activeChildId} teacherName="담당 선생님" messages={messages} onSendMessage={onSendMessage} bottomPosition="bottom-36" />
            <StudentNotifications isOpen={isNotificationOpen} onClose={() => setIsNotificationOpen(false)} notices={visibleNotices} onDelete={handleDeleteNotice} onNoticeClick={handleLinkToBoard} />
        </div>
    );
}

// --- 하위 컴포넌트들 ---

// 1. 학부모 대시보드
function ParentDashboard({ child, unpaidPayments, attendanceLogs, myClasses, clinicLogs, externalSchedules, setActiveTab, notices }) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // 출결 요약 (최근 5일)
    const recentLogs = attendanceLogs
        .filter(l => l.studentId === child.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

    return (
        <div className="space-y-6 pb-6">
             <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col relative overflow-hidden">
                <p className="text-gray-500 text-sm font-bold mb-1">학부모님, 안녕하세요!</p>
                <h2 className="text-2xl font-extrabold text-gray-900">
                    <span className="text-indigo-600">{child.name}</span> 학생의<br/>
                    오늘 학습 현황입니다.
                </h2>
            </div>

            {/* 🚨 미납 알림 (있을 때만 표시) */}
            {unpaidPayments.length > 0 && (
                <div onClick={() => setActiveTab('payment')} className="bg-red-50 border border-red-100 p-5 rounded-2xl flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-2 rounded-full text-red-500 shadow-sm">
                            <Icon name="alertCircle" className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-red-600 text-lg">미납 내역이 있습니다</h4>
                            <p className="text-xs text-red-400 font-medium">총 {unpaidPayments.length}건 / 확인 후 결제 부탁드립니다.</p>
                        </div>
                    </div>
                    <Icon name="chevronRight" className="w-5 h-5 text-red-300" />
                </div>
            )}

            {/* 출결 현황 카드 */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Icon name="user" className="w-5 h-5 text-indigo-600" /> 최근 출결
                    </h3>
                    <button onClick={() => setActiveTab('report')} className="text-xs text-gray-400 underline">더보기</button>
                </div>
                <div className="flex justify-between items-center bg-gray-50 rounded-xl p-3">
                    {recentLogs.length > 0 ? recentLogs.map((log, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-1">
                            <span className="text-[10px] text-gray-400">{log.date.slice(5)}</span>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                log.status === '출석' ? 'bg-green-100 text-green-700' :
                                log.status === '지각' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                            }`}>
                                {log.status.slice(0, 1)}
                            </div>
                        </div>
                    )) : (
                        <div className="w-full text-center text-xs text-gray-400 py-2">최근 등원 기록이 없습니다.</div>
                    )}
                </div>
            </div>

            {/* 공지사항 미니뷰 */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Icon name="bell" className="w-5 h-5 text-orange-500" /> 주요 소식
                    </h3>
                    <button onClick={() => setActiveTab('board')} className="text-xs text-gray-400 underline">전체보기</button>
                </div>
                <div className="space-y-3">
                    {notices.slice(0, 2).map(notice => (
                        <div key={notice.id} onClick={() => setActiveTab('board')} className="flex items-start gap-3 cursor-pointer">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 shrink-0"></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{notice.title}</p>
                                <p className="text-xs text-gray-400">{notice.date}</p>
                            </div>
                        </div>
                    ))}
                    {notices.length === 0 && <p className="text-xs text-gray-400 text-center py-2">새로운 소식이 없습니다.</p>}
                </div>
            </div>
        </div>
    );
}

// 2. 학부모용 결제 탭
function ParentPaymentTab({ payments, studentName }) {
    // 금액 포맷팅 (원 단위 콤마)
    const formatMoney = (amount) => amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return (
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-900 px-1">결제 내역</h2>
            
            {/* 요약 카드 */}
            <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10"></div>
                <p className="text-indigo-200 text-sm font-medium mb-1">{studentName} 학생</p>
                <div className="flex justify-between items-end">
                    <div>
                        <p className="text-xs opacity-70 mb-1">이번 달 납부 총액</p>
                        <h3 className="text-3xl font-extrabold">
                            {formatMoney(payments.filter(p => p.status === '완납' && p.date.startsWith(new Date().toISOString().slice(0, 7))).reduce((sum, p) => sum + p.amount, 0))}
                            <span className="text-lg font-medium opacity-60 ml-1">원</span>
                        </h3>
                    </div>
                </div>
            </div>

            {/* 리스트 */}
            <div className="space-y-4">
                {payments.length > 0 ? payments.map((item, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                    item.status === '완납' ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-600'
                                }`}>
                                    {item.status === '완납' ? '결제완료' : '미납'}
                                </span>
                                <span className="text-xs text-gray-400">{item.date}</span>
                            </div>
                            <h4 className="font-bold text-gray-900 text-lg">{item.bookName || `${item.month} 수강료`}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">{item.method} | {item.type}</p>
                        </div>
                        <div className="text-right">
                            <span className={`block font-bold text-lg ${item.status === '미납' ? 'text-red-600' : 'text-gray-900'}`}>
                                {formatMoney(item.amount)}원
                            </span>
                            {item.status === '미납' && (
                                <button className="mt-1 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-700 active:scale-95 transition">
                                    결제하기
                                </button>
                            )}
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                        결제 내역이 없습니다.
                    </div>
                )}
            </div>
        </div>
    );
}