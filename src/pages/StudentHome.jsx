// src/pages/StudentHome.jsx
import React, { useState, useMemo, useEffect } from 'react';
// ✅ [핵심] StudentTabs에서 필요한 컴포넌트들을 정확히 가져옵니다.
import { 
    DashboardTab, 
    ClassTab,      // 강의실 목록 (새로 추가됨)
    ScheduleTab, 
    LearningTab,   // 학습관리 (새로 추가됨: 과제/성적/클리닉 통합)
    MenuTab 
} from '../components/StudentTabs';

import ClassroomView from './student/ClassroomView';
import StudentMessenger from '../components/StudentMessenger';
import StudentHeader from '../components/StudentHeader';
import StudentNotifications from '../components/StudentNotifications';
import { Icon, calculateHomeworkStats, calculateGradeComparison } from '../utils/helpers';
import NotificationsIcon from '@mui/icons-material/Notifications';

export default function StudentHome({ 
    studentId, students, classes, homeworkAssignments, homeworkResults, 
    attendanceLogs, lessonLogs, notices, tests, grades, 
    videoProgress, onSaveVideoProgress, videoBookmarks, onSaveBookmark,
    externalSchedules, onSaveExternalSchedule, onDeleteExternalSchedule,
    clinicLogs, onUpdateStudent, 
    onLogout, messages, onSendMessage
}) {
    // 탭 상태 관리 (기본값: 'home')
    const [activeTab, setActiveTab] = useState('home');
    const [selectedClassId, setSelectedClassId] = useState(null);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    
    // 알림 관련 상태
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [visibleNotices, setVisibleNotices] = useState(notices); 
    const [hasNewNotifications, setHasNewNotifications] = useState(false);
    
    // 강의실 바로가기용 (메모 등에서 사용)
    const [targetMemo, setTargetMemo] = useState(null);

    // 클리닉 알림 자동 생성 로직
    useEffect(() => {
        let newNotices = [...notices];
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const myUpcomingClinics = clinicLogs?.filter(log => log.studentId === studentId && log.date >= todayStr && !log.checkOut) || [];

        if (myUpcomingClinics.length > 0) {
            myUpcomingClinics.forEach(clinic => {
                const noticeId = `clinic-notice-${clinic.id}`;
                if (!newNotices.find(n => n.id === noticeId)) {
                    newNotices.unshift({
                        id: noticeId,
                        title: '📅 클리닉 예약 알림',
                        content: `${clinic.date} ${clinic.checkIn}에 학습 클리닉이 예약되어 있습니다.<br/>늦지 않게 참석해주세요!`,
                        author: '알림봇',
                        date: todayStr,
                        isPinned: false
                    });
                }
            });
        }
        setVisibleNotices(newNotices);
        if (newNotices.length > notices.length || notices.length > 0) setHasNewNotifications(true);
    }, [notices, clinicLogs, studentId]);

    const handleOpenNotification = () => { setIsNotificationOpen(true); setHasNewNotifications(false); };
    const handleLinkToBoard = () => { setActiveTab('menu'); setIsNotificationOpen(false); }; // 게시판은 메뉴 탭 안에 있음
    const handleDeleteNotice = (id) => { setVisibleNotices(prev => prev.filter(n => n.id !== id)); };

    // 데이터 가공
    const student = students.find(s => s.id === studentId);
    const myClasses = classes.filter(c => c.students.includes(studentId));
    const myHomeworkStats = useMemo(() => calculateHomeworkStats(studentId, homeworkAssignments, homeworkResults), [studentId, homeworkAssignments, homeworkResults]);
    const myGradeComparison = useMemo(() => calculateGradeComparison(studentId, classes, tests, grades), [studentId, classes, tests, grades]);
    const pendingHomeworkCount = myHomeworkStats.filter(h => h.status !== '완료').length;

    const handleNavigateToMemo = (classId, lessonId, time) => {
        setSelectedClassId(classId);
        setTargetMemo({ lessonId, time });
    };

    // 하단 탭 아이템 정의 (5개)
    const navItems = [
        { id: 'home', icon: 'home', label: '홈' },
        { id: 'class', icon: 'fileText', label: '클래스' },
        { id: 'schedule', icon: 'calendar', label: '일정' },
        { id: 'learning', icon: 'clipboardCheck', label: '학습관리' },
        { id: 'menu', icon: 'menu', label: '전체메뉴' },
    ];

    return (
        <div className="bg-brand-bg min-h-screen flex flex-col relative font-sans">
            <StudentHeader onLogout={onLogout} />

            <main className="flex-1 w-full max-w-md mx-auto p-4 pb-24 overflow-y-auto custom-scrollbar md:max-w-7xl">
                {/* 강의실(영상 시청) 모드일 때 */}
                {selectedClassId ? (
                    <ClassroomView 
                        classes={classes} lessonLogs={lessonLogs} attendanceLogs={attendanceLogs} studentId={studentId}
                        selectedClassId={selectedClassId} setSelectedClassId={setSelectedClassId}
                        videoProgress={videoProgress} onSaveVideoProgress={onSaveVideoProgress}
                        videoBookmarks={videoBookmarks} onSaveBookmark={onSaveBookmark}
                        onVideoModalChange={setIsVideoModalOpen}
                        targetMemo={targetMemo}
                        onClearTargetMemo={() => setTargetMemo(null)}
                    />
                ) : (
                    // 일반 탭 모드일 때
                    <div className="animate-fade-in space-y-4">
                        {/* 1. 홈 (대시보드) */}
                        {activeTab === 'home' && (
                            <DashboardTab 
                                student={student} 
                                myClasses={myClasses} 
                                pendingHomeworkCount={pendingHomeworkCount} 
                                attendanceLogs={attendanceLogs}
                                clinicLogs={clinicLogs}
                                homeworkStats={myHomeworkStats}
                                notices={visibleNotices}
                                setActiveTab={setActiveTab}
                            />
                        )}

                        {/* 2. 클래스 (강의 목록) */}
                        {activeTab === 'class' && (
                            <ClassTab 
                                myClasses={myClasses} 
                                setSelectedClassId={setSelectedClassId} 
                            />
                        )}

                        {/* 3. 일정 */}
                        {activeTab === 'schedule' && (
                            <ScheduleTab 
                                myClasses={myClasses} 
                                externalSchedules={externalSchedules} 
                                attendanceLogs={attendanceLogs} 
                                studentId={studentId} 
                                onSaveExternalSchedule={onSaveExternalSchedule} 
                                onDeleteExternalSchedule={onDeleteExternalSchedule} 
                                clinicLogs={clinicLogs} 
                            />
                        )}

                        {/* 4. 학습관리 (과제 + 성적 + 클리닉) */}
                        {activeTab === 'learning' && (
                            <LearningTab 
                                studentId={studentId}
                                myHomeworkStats={myHomeworkStats}
                                myGradeComparison={myGradeComparison}
                                clinicLogs={clinicLogs}
                            />
                        )}

                        {/* 5. 메뉴 (더보기 + 게시판) */}
                        {activeTab === 'menu' && (
                            <MenuTab 
                                student={student} 
                                onUpdateStudent={onUpdateStudent} 
                                onLogout={onLogout}
                                videoBookmarks={videoBookmarks}
                                lessonLogs={lessonLogs}
                                onLinkToMemo={handleNavigateToMemo}
                                notices={visibleNotices}
                            />
                        )}
                    </div>
                )}
            </main>

            {/* 하단 탭바 (Bottom Navigation) */}
            {!selectedClassId && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
                    <div className="max-w-md mx-auto flex justify-around items-center h-[60px] md:max-w-7xl">
                        {navItems.map(item => (
                            <button 
                                key={item.id} 
                                onClick={() => setActiveTab(item.id)} 
                                className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 active:scale-95 ${
                                    activeTab === item.id ? 'text-brand-main' : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                <div className={`mb-1 transition-transform duration-200 ${activeTab === item.id ? '-translate-y-0.5' : ''}`}>
                                    <Icon 
                                        name={item.icon} 
                                        className={`w-6 h-6 ${activeTab === item.id ? 'fill-current' : ''}`} 
                                        strokeWidth={activeTab === item.id ? 2.5 : 2} 
                                    />
                                </div>
                                <span className={`text-[10px] ${activeTab === item.id ? 'font-bold' : 'font-medium'}`}>
                                    {item.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 알림 버튼 (우측 하단 플로팅) */}
            <div className={`fixed bottom-20 right-4 z-[60] transition-all duration-300 ${isVideoModalOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <button 
                    onClick={handleOpenNotification} 
                    className="bg-white text-brand-main border border-brand-main/20 p-3 rounded-full shadow-lg hover:bg-gray-50 active:scale-90 flex items-center justify-center relative"
                >
                    <NotificationsIcon style={{ fontSize: 24 }} />
                    {hasNewNotifications && <span className="absolute top-2 right-2.5 w-2 h-2 bg-brand-red rounded-full ring-1 ring-white"></span>}
                </button>
            </div>

            <StudentMessenger studentId={studentId} teacherName="채수용 선생님" messages={messages} onSendMessage={onSendMessage} isHidden={isVideoModalOpen} bottomPosition="bottom-36" />
            <StudentNotifications isOpen={isNotificationOpen} onClose={() => setIsNotificationOpen(false)} notices={visibleNotices} onDelete={handleDeleteNotice} onNoticeClick={handleLinkToBoard} />
        </div>
    );
}