// src/pages/StudentHome.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { 
    DashboardTab, ClassTab, ScheduleTab, LearningTab, MenuTab, 
    BoardTab 
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
    const [activeTab, setActiveTab] = useState('home');
    
    // ✅ [추가] 학습관리 탭 내부의 서브 탭을 제어하기 위한 상태
    const [initialLearningTab, setInitialLearningTab] = useState('homework');

    const [selectedClassId, setSelectedClassId] = useState(null);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [visibleNotices, setVisibleNotices] = useState([]); 
    const [hasNewNotifications, setHasNewNotifications] = useState(false);
    const [targetMemo, setTargetMemo] = useState(null);

    // ... (기존 useEffect 로직 동일) ...
    useEffect(() => {
        let newNotices = [...notices];
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const myUpcomingClinics = clinicLogs?.filter(log => log.studentId === studentId && log.date >= todayStr && !log.checkOut) || [];
        
        const myNotices = notices.filter(n => 
            !n.targetStudents || n.targetStudents.length === 0 || n.targetStudents.includes(studentId)
        );
        let combinedNotices = [...myNotices];

        if (myUpcomingClinics.length > 0) {
            myUpcomingClinics.forEach(clinic => {
                const noticeId = `clinic-notice-${clinic.id}`;
                if (!combinedNotices.find(n => n.id === noticeId)) {
                    combinedNotices.unshift({
                        id: noticeId, title: '📅 클리닉 예약 알림',
                        content: `${clinic.date} ${clinic.checkIn}에 학습 클리닉이 예약되어 있습니다.<br/>늦지 않게 참석해주세요!`,
                        author: '알림봇', date: todayStr, isPinned: false
                    });
                }
            });
        }
        setVisibleNotices(combinedNotices);
        if (combinedNotices.length > visibleNotices.length) setHasNewNotifications(true);
    }, [notices, clinicLogs, studentId]);

    const handleOpenNotification = () => { setIsNotificationOpen(true); setHasNewNotifications(false); };
    const handleLinkToBoard = () => { setActiveTab('board'); setIsNotificationOpen(false); };
    const handleDeleteNotice = (id) => { setVisibleNotices(prev => prev.filter(n => n.id !== id)); };

    const student = students.find(s => s.id === studentId);
    const myClasses = classes.filter(c => c.students.includes(studentId));
    const myHomeworkStats = useMemo(() => calculateHomeworkStats(studentId, homeworkAssignments, homeworkResults), [studentId, homeworkAssignments, homeworkResults]);
    const myGradeComparison = useMemo(() => calculateGradeComparison(studentId, classes, tests, grades), [studentId, classes, tests, grades]);
    const pendingHomeworkCount = myHomeworkStats.filter(h => h.status !== '완료').length;

    const handleNavigateToMemo = (classId, lessonId, time) => {
        setSelectedClassId(classId);
        setTargetMemo({ lessonId, time });
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

            <main className="flex-1 w-full max-w-md mx-auto p-4 pb-24 overflow-y-auto custom-scrollbar md:max-w-7xl">
                {selectedClassId ? (
                    <ClassroomView 
                        classes={classes} lessonLogs={lessonLogs} attendanceLogs={attendanceLogs} studentId={studentId}
                        selectedClassId={selectedClassId} setSelectedClassId={setSelectedClassId}
                        videoProgress={videoProgress} onSaveVideoProgress={onSaveVideoProgress}
                        videoBookmarks={videoBookmarks} onSaveBookmark={onSaveBookmark}
                        onVideoModalChange={setIsVideoModalOpen}
                        targetMemo={targetMemo}
                        onClearTargetMemo={() => setTargetMemo(null)}
                        homeworkAssignments={homeworkAssignments}
                        homeworkResults={homeworkResults}
                        tests={tests}
                        grades={grades}
                        // ✅ [수정] 탭 이동 시 서브 탭도 같이 지정
                        onNavigateToTab={(tab, subTab = 'homework') => {
                            setSelectedClassId(null);
                            setActiveTab(tab);
                            if (tab === 'learning') {
                                setInitialLearningTab(subTab);
                            }
                        }}
                    />
                ) : (
                    <div className="animate-fade-in space-y-4">
                        {activeTab === 'home' && (
                            <DashboardTab 
                                student={student} myClasses={myClasses} pendingHomeworkCount={pendingHomeworkCount} 
                                attendanceLogs={attendanceLogs} clinicLogs={clinicLogs} homeworkStats={myHomeworkStats} notices={visibleNotices}
                                setActiveTab={setActiveTab}
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
                                // ✅ [추가] 초기 서브 탭 전달
                                initialTab={initialLearningTab} 
                            />
                        )}
                        {activeTab === 'board' && <BoardTab notices={visibleNotices} />}
                        {activeTab === 'menu' && (
                            <MenuTab 
                                student={student} onUpdateStudent={onUpdateStudent} onLogout={onLogout}
                                videoBookmarks={videoBookmarks} lessonLogs={lessonLogs} onLinkToMemo={handleNavigateToMemo} notices={visibleNotices}
                                setActiveTab={setActiveTab}
                            />
                        )}
                    </div>
                )}
            </main>

            {!selectedClassId && (
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
            
            {/* ... (알림 버튼, 메신저 등 기존 코드 유지) ... */}
            <div className={`fixed bottom-20 right-4 z-[60] transition-all duration-300 ${isVideoModalOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <button onClick={handleOpenNotification} className="bg-white text-brand-main border border-brand-main/20 p-3 rounded-full shadow-lg hover:bg-gray-50 active:scale-90 flex items-center justify-center relative"><NotificationsIcon style={{ fontSize: 24 }} />{hasNewNotifications && <span className="absolute top-2 right-2.5 w-2 h-2 bg-brand-red rounded-full ring-1 ring-white"></span>}</button>
            </div>
            <StudentMessenger studentId={studentId} teacherName="채수용 선생님" messages={messages} onSendMessage={onSendMessage} isHidden={isVideoModalOpen} bottomPosition="bottom-36" />
            <StudentNotifications isOpen={isNotificationOpen} onClose={() => setIsNotificationOpen(false)} notices={visibleNotices} onDelete={handleDeleteNotice} onNoticeClick={handleLinkToBoard} />
        </div>
    );
}