// src/pages/ParentHome.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { 
    DashboardTab, ClassTab, ScheduleTab, LearningTab, MenuTab, 
    BoardTab 
} from '../components/StudentTabs';
import ParentClassroomView from './parent/ParentClassroomView';
import StudentHeader from '../components/StudentHeader';
import StudentNotifications from '../components/StudentNotifications'; // ✅ [추가]
import StudentMessenger from '../components/StudentMessenger'; // ✅ [추가]
import { Icon, calculateHomeworkStats, calculateGradeComparison } from '../utils/helpers';
import NotificationsIcon from '@mui/icons-material/Notifications'; // ✅ [추가]

export default function ParentHome({ 
    studentId, students, classes, homeworkAssignments, homeworkResults, 
    attendanceLogs, lessonLogs, notices, tests, grades, 
    videoProgress, clinicLogs, onLogout,
    externalSchedules, onSaveExternalSchedule, onDeleteExternalSchedule, // ✅ [추가] 일정 연동용 props
    messages, onSendMessage // ✅ [추가] 메신저용 props
}) {
    const [activeTab, setActiveTab] = useState('home');
    const [selectedClassId, setSelectedClassId] = useState(null);
    const [initialLearningTab, setInitialLearningTab] = useState('homework');
    
    // ✅ [추가] 알림 관련 상태
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [visibleNotices, setVisibleNotices] = useState([]); 
    const [hasNewNotifications, setHasNewNotifications] = useState(false);

    const student = students.find(s => s.id === studentId);
    const myClasses = classes.filter(c => c.students.includes(studentId));
    
    const myHomeworkStats = useMemo(() => calculateHomeworkStats(studentId, homeworkAssignments, homeworkResults), [studentId, homeworkAssignments, homeworkResults]);
    const myGradeComparison = useMemo(() => calculateGradeComparison(studentId, classes, tests, grades), [studentId, classes, tests, grades]);
    const pendingHomeworkCount = myHomeworkStats.filter(h => h.status !== '완료').length;

    // ✅ [추가] 알림 로직 (학생용과 동일)
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
                        id: noticeId, title: '📅 자녀 클리닉 예약 알림',
                        content: `${clinic.date} ${clinic.checkIn}에 자녀분의 학습 클리닉이 예약되어 있습니다.`,
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


    const navItems = [
        { id: 'home', icon: 'home', label: '홈' },
        { id: 'class', icon: 'fileText', label: '자녀 강의실' }, // 텍스트 변경
        { id: 'schedule', icon: 'calendar', label: '수업일정' },
        { id: 'learning', icon: 'clipboardCheck', label: '학습리포트' }, // 텍스트 변경
        { id: 'menu', icon: 'menu', label: '전체메뉴' },
    ];

    return (
        <div className="bg-gray-50 min-h-screen flex flex-col relative font-sans">
            <div className="bg-indigo-900 text-white p-2 text-center text-xs font-bold">
                학부모 모드 (자녀: {student.name})
            </div>
            <StudentHeader onLogout={onLogout} />

            <main className="flex-1 w-full max-w-md mx-auto p-4 pb-24 overflow-y-auto custom-scrollbar md:max-w-7xl">
                {selectedClassId ? (
                    <ParentClassroomView 
                        classes={classes} lessonLogs={lessonLogs} attendanceLogs={attendanceLogs} studentId={studentId}
                        selectedClassId={selectedClassId} setSelectedClassId={setSelectedClassId}
                        videoProgress={videoProgress}
                        homeworkAssignments={homeworkAssignments}
                        homeworkResults={homeworkResults}
                        tests={tests}
                        grades={grades}
                        onNavigateToTab={(tab, subTab = 'homework') => {
                            setSelectedClassId(null);
                            setActiveTab(tab);
                            if (tab === 'learning') setInitialLearningTab(subTab);
                        }}
                    />
                ) : (
                    <div className="animate-fade-in space-y-4">
                        {activeTab === 'home' && (
                            <DashboardTab 
                                student={student} myClasses={myClasses} pendingHomeworkCount={pendingHomeworkCount} 
                                attendanceLogs={attendanceLogs} clinicLogs={clinicLogs} homeworkStats={myHomeworkStats} notices={visibleNotices}
                                setActiveTab={setActiveTab}
                                externalSchedules={externalSchedules}
                                isParent={true} // ✅ [추가] 학부모 모드 플래그
                            />
                        )}
                        {activeTab === 'class' && <ClassTab myClasses={myClasses} setSelectedClassId={setSelectedClassId} />}
                        {activeTab === 'schedule' && (
                            <ScheduleTab 
                                myClasses={myClasses} attendanceLogs={attendanceLogs} clinicLogs={clinicLogs} studentId={studentId} 
                                // ✅ [수정] 일정 수정 함수 연결 (학생과 연동됨)
                                externalSchedules={externalSchedules}
                                onSaveExternalSchedule={onSaveExternalSchedule} 
                                onDeleteExternalSchedule={onDeleteExternalSchedule}
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
                                student={student} onUpdateStudent={() => {}} onLogout={onLogout}
                                videoBookmarks={{}} lessonLogs={[]} onLinkToMemo={() => {}} notices={visibleNotices}
                                setActiveTab={setActiveTab}
                                isParent={true} // ✅ [추가] 학부모 모드 플래그 (메뉴 제어용)
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
            
            {/* ✅ [추가] 알림 버튼 및 메신저 */}
            <div className={`fixed bottom-20 right-4 z-[60] transition-all duration-300`}>
                <button onClick={handleOpenNotification} className="bg-white text-indigo-900 border border-indigo-200 p-3 rounded-full shadow-lg hover:bg-gray-50 active:scale-90 flex items-center justify-center relative"><NotificationsIcon style={{ fontSize: 24 }} />{hasNewNotifications && <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-1 ring-white"></span>}</button>
            </div>
            <StudentMessenger studentId={studentId} teacherName="채수용 선생님" messages={messages} onSendMessage={onSendMessage} bottomPosition="bottom-36" />
            <StudentNotifications isOpen={isNotificationOpen} onClose={() => setIsNotificationOpen(false)} notices={visibleNotices} onDelete={handleDeleteNotice} onNoticeClick={handleLinkToBoard} />
        </div>
    );
}