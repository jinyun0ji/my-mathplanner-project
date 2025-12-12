// src/pages/StudentHome.jsx
import React, { useState, useMemo } from 'react';
import { Icon, calculateHomeworkStats, calculateGradeComparison } from '../utils/helpers'; 
import { DashboardTab, ScheduleTab, HomeworkTab, GradesTab, MenuTab } from '../components/StudentTabs';
import ClassroomView from './student/ClassroomView';

// 하단 네비게이션 버튼 (이 파일에서만 사용)
const NavButton = ({ icon, label, isActive, onClick }) => (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 w-14 transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
        <div className={`transition-all duration-300 ${isActive ? '-translate-y-1' : ''}`}><Icon name={icon} className={`w-6 h-6 ${isActive ? 'fill-current opacity-20' : ''} stroke-2`} /></div>
        <span className={`text-[10px] font-bold transition-opacity ${isActive ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
    </button>
);

export default function StudentHome({ studentId, students, classes, homeworkAssignments, homeworkResults, attendanceLogs, lessonLogs, videoProgress, onSaveVideoProgress, videoBookmarks, onSaveBookmark, tests, grades, externalSchedules, onSaveExternalSchedule, onDeleteExternalSchedule, onLogout }) {
    const [activeTab, setActiveTab] = useState('home');
    const [selectedClassId, setSelectedClassId] = useState(null); 
    
    const student = students.find(s => s.id === studentId);
    const myClasses = classes.filter(c => student?.classes.includes(c.id));

    const myHomeworkStats = useMemo(() => calculateHomeworkStats(studentId, homeworkAssignments, homeworkResults), [studentId, homeworkAssignments, homeworkResults]);
    const pendingHomeworkCount = myHomeworkStats.filter(h => h.status !== '완료').length;
    const myGradeComparison = useMemo(() => calculateGradeComparison(studentId, classes, tests, grades), [studentId, classes, tests, grades]);

    return (
        <div className="flex flex-col h-screen bg-gray-50 max-w-md mx-auto shadow-2xl relative overflow-hidden">
            {/* 상단 헤더 */}
            <header className="bg-white px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm/50">
                <h1 className="text-lg font-extrabold text-indigo-900 tracking-tight">채수용 수학</h1>
                <button className="relative p-1"><Icon name="bell" className="w-6 h-6 text-gray-600" /><span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span></button>
            </header>

            {/* 메인 컨텐츠 영역 */}
            <main className="flex-1 overflow-y-auto p-6 pb-28 scrollbar-hide bg-gray-50">
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
                    <>
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
                            <HomeworkTab 
                                myHomeworkStats={myHomeworkStats} 
                            />
                        )}
                        {activeTab === 'grades' && (
                            <GradesTab 
                                myGradeComparison={myGradeComparison} 
                            />
                        )}
                        {activeTab === 'menu' && (
                            <MenuTab onLogout={onLogout} />
                        )}
                    </>
                )}
            </main>

            {/* 하단 네비게이션 (강의실 밖에서만 표시) */}
            {!selectedClassId && (
                <nav className="bg-white border-t border-gray-100 absolute bottom-0 w-full px-6 py-2 pb-6 flex justify-between items-center rounded-t-3xl shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-30">
                    <NavButton icon="home" label="홈" isActive={activeTab === 'home'} onClick={() => setActiveTab('home')} />
                    <NavButton icon="calendar" label="출결" isActive={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')} />
                    <div className="relative -top-8">
                        <button 
                            onClick={() => console.log('Quick Action')} // 필요 시 퀵 액션 추가
                            className="bg-indigo-600 p-4 rounded-full shadow-lg shadow-indigo-300 text-white transform transition-transform active:scale-95 hover:bg-indigo-700 ring-4 ring-gray-50"
                        >
                            <Icon name="plus" className="w-7 h-7" />
                        </button>
                    </div>
                    <NavButton icon="fileText" label="과제" isActive={activeTab === 'homework'} onClick={() => setActiveTab('homework')} />
                    <NavButton icon="barChart" label="성적" isActive={activeTab === 'grades'} onClick={() => setActiveTab('grades')} /> 
                    <NavButton icon="menu" label="메뉴" isActive={activeTab === 'menu'} onClick={() => setActiveTab('menu')} />
                </nav>
            )}
        </div>
    );
}