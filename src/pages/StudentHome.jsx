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

    // 1. 내 정보 및 내 수업 필터링
    const student = students.find(s => s.id === studentId);
    const myClasses = classes.filter(c => c.students.includes(studentId));

    // 2. 데이터 가공 (과제, 성적 통계)
    // ✅ [수정] 인자 순서 변경: (studentId, data...)
    const myHomeworkStats = useMemo(() => 
        calculateHomeworkStats(studentId, homeworkAssignments, homeworkResults), 
    [studentId, homeworkAssignments, homeworkResults]);

    // ✅ [수정] 인자 순서 변경: (studentId, classes, tests, grades)
    const myGradeComparison = useMemo(() => 
        calculateGradeComparison(studentId, classes, tests, grades), 
    [studentId, classes, tests, grades]);

    const pendingHomeworkCount = myHomeworkStats.filter(h => h.status !== '완료').length;

    // 3. 하단 네비게이션 아이템 설정
    const navItems = [
        { id: 'home', icon: 'home', label: '홈' },
        { id: 'schedule', icon: 'calendar', label: '일정' },
        { id: 'homework', icon: 'clipboardCheck', label: '과제' }, // 아이콘 이름 수정 (clipboard -> clipboardCheck)
        { id: 'grades', icon: 'barChart', label: '성적' },
        { id: 'menu', icon: 'menu', label: '메뉴' },
    ];

    return (
        <div className="bg-gray-50 min-h-screen pb-20 max-w-md mx-auto relative shadow-2xl overflow-hidden flex flex-col">
            
            {/* 메인 컨텐츠 영역 */}
            <main className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                {selectedClassId ? (
                    // 강의실 뷰 (수업 선택 시)
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
                    // 탭별 화면 (평소)
                    <div className="animate-fade-in">
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
                <div className="fixed bottom-0 max-w-md w-full bg-white border-t border-gray-100 flex justify-around items-center py-2 px-2 z-40 pb-safe">
                    {navItems.map(item => (
                        <button 
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`flex flex-col items-center p-2 rounded-xl transition-all duration-200 w-16 ${
                                activeTab === item.id 
                                ? 'text-indigo-600' 
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            <div className={`mb-1 transition-transform duration-200 ${activeTab === item.id ? '-translate-y-1' : ''}`}>
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
            )}

            {/* 학생용 메신저 (우측 하단 플로팅) */}
            <StudentMessenger 
                studentId={studentId}
                teacherName="채수용 선생님"
                messages={messages}
                onSendMessage={onSendMessage}
            />
        </div>
    );
}