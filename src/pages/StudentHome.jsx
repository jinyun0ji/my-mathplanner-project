// src/pages/StudentHome.jsx
import React, { useState, useMemo } from 'react';
import { 
    DashboardTab, 
    ScheduleTab, 
    HomeworkTab, 
    GradesTab, 
    MenuTab 
} from '../components/StudentTabs';
import ClassroomView from './student/ClassroomView';
import StudentMessenger from '../components/StudentMessenger';
import StudentHeader from '../components/StudentHeader'; // ✅ 헤더 추가
import { Icon, calculateHomeworkStats, calculateGradeComparison } from '../utils/helpers';

export default function StudentHome({ 
    studentId, students, classes, homeworkAssignments, homeworkResults, 
    attendanceLogs, lessonLogs, notices, tests, grades, 
    videoProgress, onSaveVideoProgress, videoBookmarks, onSaveBookmark,
    externalSchedules, onSaveExternalSchedule, onDeleteExternalSchedule,
    onLogout, messages, onSendMessage
}) {
    const [activeTab, setActiveTab] = useState('home');
    const [selectedClassId, setSelectedClassId] = useState(null);

    // ... (데이터 가공 로직은 기존과 동일) ...
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
        { id: 'grades', icon: 'barChart', label: '성적' },
        { id: 'menu', icon: 'menu', label: '메뉴' },
    ];

    return (
        // ✅ [수정] max-w-md 제거, 전체 화면 사용
        <div className="bg-gray-50 min-h-screen flex flex-col relative font-sans">
            
            {/* ✅ [추가] 상단 고정 헤더 (채수용 수학) */}
            <StudentHeader onLogout={onLogout} />

            {/* 메인 컨텐츠 영역 */}
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

                        {activeTab === 'grades' && (
                            <GradesTab myGradeComparison={myGradeComparison} />
                        )}

                        {activeTab === 'menu' && (
                            <MenuTab onLogout={onLogout} />
                        )}
                    </div>
                )}
            </main>

            {/* 하단 네비게이션 바 */}
            {!selectedClassId && (
                <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200 z-40 pb-safe">
                    {/* ✅ [수정] 네비게이션 바를 중앙 정렬하여 넓은 화면에서도 어색하지 않게 함 */}
                    <div className="max-w-md mx-auto flex justify-around items-center py-2 px-2">
                        {navItems.map(item => (
                            <button 
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`flex flex-col items-center p-2 rounded-xl transition-all duration-200 w-16 group ${
                                    activeTab === item.id 
                                    ? 'text-indigo-600' 
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                <div className={`mb-1 transition-transform duration-200 ${activeTab === item.id ? '-translate-y-1' : 'group-hover:-translate-y-0.5'}`}>
                                    <Icon 
                                        name={item.icon} 
                                        className={`w-6 h-6 ${activeTab === item.id ? 'fill-current' : ''}`} 
                                        strokeWidth={activeTab === item.id ? 2.5 : 2}
                                    />
                                </div>
                                <span className={`text-[10px] font-medium ${activeTab === item.id ? 'opacity-100' : 'opacity-70'}`}>
                                    {item.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 메신저 (우측 하단) */}
            <StudentMessenger 
                studentId={studentId}
                teacherName="채수용 선생님"
                messages={messages}
                onSendMessage={onSendMessage}
            />
        </div>
    );
}