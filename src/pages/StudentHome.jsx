// src/pages/StudentHome.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { 
    DashboardTab, 
    ScheduleTab, 
    HomeworkTab, 
    GradesTab, 
    MenuTab,
    BoardTab
} from '../components/StudentTabs';
import ClassroomView from './student/ClassroomView';
import StudentMessenger from '../components/StudentMessenger';
import StudentHeader from '../components/StudentHeader';
import StudentNotifications from '../components/StudentNotifications';
import { Icon, calculateHomeworkStats, calculateGradeComparison } from '../utils/helpers';

// ✅ Google Icon import
import NotificationsIcon from '@mui/icons-material/Notifications';

export default function StudentHome({ 
    studentId, students, classes, homeworkAssignments, homeworkResults, 
    attendanceLogs, lessonLogs, notices, tests, grades, 
    videoProgress, onSaveVideoProgress, videoBookmarks, onSaveBookmark,
    externalSchedules, onSaveExternalSchedule, onDeleteExternalSchedule,
    onLogout, messages, onSendMessage
}) {
    const [activeTab, setActiveTab] = useState('home');
    const [selectedClassId, setSelectedClassId] = useState(null);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    
    // 알림 관련 상태
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [visibleNotices, setVisibleNotices] = useState(notices); 
    const [hasNewNotifications, setHasNewNotifications] = useState(false);

    useEffect(() => {
        setVisibleNotices(notices);
        if (notices.length > 0) setHasNewNotifications(true);
    }, [notices]);

    const handleOpenNotification = () => {
        setIsNotificationOpen(true);
        setHasNewNotifications(false);
    };

    const handleLinkToBoard = () => {
        setActiveTab('board');      
        setIsNotificationOpen(false); 
    };

    const handleDeleteNotice = (id) => {
        setVisibleNotices(prev => prev.filter(n => n.id !== id));
    };

    // ... (데이터 가공 로직 기존 유지)
    const student = students.find(s => s.id === studentId);
    const myClasses = classes.filter(c => c.students.includes(studentId));
    
    const myHomeworkStats = useMemo(() => 
        calculateHomeworkStats(studentId, homeworkAssignments, homeworkResults), 
    [studentId, homeworkAssignments, homeworkResults]);

    const myGradeComparison = useMemo(() => 
        calculateGradeComparison(studentId, classes, tests, grades), 
    [studentId, classes, tests, grades]);

    const pendingHomeworkCount = myHomeworkStats.filter(h => h.status !== '완료').length;

    const navItems = [
        { id: 'home', icon: 'home', label: '홈' },
        { id: 'schedule', icon: 'calendar', label: '일정' },
        { id: 'homework', icon: 'clipboardCheck', label: '과제' },
        { id: 'board', icon: 'list', label: '게시판' },
        { id: 'grades', icon: 'barChart', label: '성적' },
        { id: 'menu', icon: 'menu', label: '메뉴' },
    ];

    return (
        <div className="bg-brand-bg min-h-screen flex flex-col relative font-sans">
            
            <StudentHeader onLogout={onLogout} />

            <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 pb-24 overflow-y-auto custom-scrollbar">
                {selectedClassId ? (
                    <ClassroomView 
                        classes={classes}
                        lessonLogs={lessonLogs}
                        attendanceLogs={attendanceLogs}
                        studentId={studentId}
                        selectedClassId={selectedClassId}
                        setSelectedClassId={setSelectedClassId}
                        videoProgress={videoProgress}
                        onSaveVideoProgress={onSaveVideoProgress}
                        videoBookmarks={videoBookmarks}
                        onSaveBookmark={onSaveBookmark}
                        onVideoModalChange={setIsVideoModalOpen}
                    />
                ) : (
                    <div className="animate-fade-in space-y-6">
                        {activeTab === 'home' && (
                            <DashboardTab 
                                student={student} 
                                myClasses={myClasses} 
                                setActiveTab={setActiveTab} 
                                pendingHomeworkCount={pendingHomeworkCount}
                                setSelectedClassId={setSelectedClassId}
                            />
                        )}
                        {activeTab === 'schedule' && (
                            <ScheduleTab 
                                myClasses={myClasses} 
                                externalSchedules={externalSchedules} 
                                attendanceLogs={attendanceLogs} 
                                studentId={studentId} 
                                onSaveExternalSchedule={onSaveExternalSchedule} 
                                onDeleteExternalSchedule={onDeleteExternalSchedule} 
                            />
                        )}
                        {activeTab === 'homework' && (
                            <HomeworkTab myHomeworkStats={myHomeworkStats} />
                        )}
                        {activeTab === 'board' && (
                            <BoardTab notices={notices} />
                        )}
                        {activeTab === 'grades' && (
                            <GradesTab myGradeComparison={myGradeComparison} />
                        )}
                        {activeTab === 'menu' && (
                            <MenuTab onLogout={onLogout} />
                        )}
                    </div>
                )}
            </main>

            {!selectedClassId && (
                <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-brand-gray/20 z-40 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <div className="max-w-lg mx-auto flex justify-around items-center py-2 px-2">
                        {navItems.map(item => (
                            <button 
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`flex flex-col items-center p-2 rounded-xl transition-all duration-200 w-14 group ${
                                    activeTab === item.id 
                                    ? 'text-brand-main' 
                                    : 'text-brand-gray hover:text-brand-black'
                                }`}
                            >
                                <div className={`mb-1 transition-transform duration-200 ${activeTab === item.id ? '-translate-y-1' : 'group-hover:-translate-y-0.5'}`}>
                                    <Icon 
                                        name={item.icon} 
                                        className={`w-6 h-6 ${activeTab === item.id ? 'fill-current' : ''}`} 
                                        strokeWidth={activeTab === item.id ? 2.5 : 2}
                                    />
                                </div>
                                <span className={`text-[10px] font-medium ${activeTab === item.id ? 'opacity-100 font-bold' : 'opacity-70'}`}>
                                    {item.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className={`fixed bottom-24 right-5 z-[60] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isVideoModalOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}>
                <button 
                    onClick={handleOpenNotification}
                    className="relative bg-white text-brand-main border border-brand-gray/20 p-3.5 rounded-full shadow-lg hover:bg-gray-50 transition-transform active:scale-90 flex items-center justify-center"
                >
                    {/* ✅ [수정] Material Icon 적용 */}
                    <NotificationsIcon className="w-6 h-6" style={{ fontSize: 24 }} />
                    
                    {hasNewNotifications && (
                        <span className="absolute top-0 right-0 w-3 h-3 bg-brand-red rounded-full ring-2 ring-white"></span>
                    )}
                </button>
            </div>

            <StudentMessenger 
                studentId={studentId}
                teacherName="채수용 선생님"
                messages={messages}
                onSendMessage={onSendMessage}
                isHidden={isVideoModalOpen}
                bottomPosition="bottom-40" 
            />

            <StudentNotifications 
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
                notices={visibleNotices} 
                onDelete={handleDeleteNotice}
                onNoticeClick={handleLinkToBoard}
            />
        </div>
    );
}