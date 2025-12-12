// src/pages/StudentHome.jsx
import React, { useState, useMemo } from 'react';
import { Icon } from '../utils/helpers'; 
import { calculateHomeworkStats } from '../utils/helpers'; // 헬퍼 함수 활용

export default function StudentHome({ studentId, students, classes, homeworkAssignments, homeworkResults, onLogout }) {
    const [activeTab, setActiveTab] = useState('home');

    const student = students.find(s => s.id === studentId);
    
    // 학생의 클래스 목록
    const myClasses = classes.filter(c => student?.classes.includes(c.id));

    // 과제 통계 계산
    const myHomeworkStats = useMemo(() => 
        calculateHomeworkStats(studentId, homeworkAssignments, homeworkResults), 
    [studentId, homeworkAssignments, homeworkResults]);

    const pendingHomeworkCount = myHomeworkStats.filter(h => h.status !== '완료').length;


    // --- [1] 홈 탭 (대시보드) ---
    const DashboardTab = () => (
        <div className="space-y-6 animate-fade-in-up">
            {/* 상단 카드 */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-xl">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-indigo-200 text-sm mb-1 font-medium">오늘도 힘내세요! 💪</p>
                        <h2 className="text-3xl font-bold">{student.name}님</h2>
                    </div>
                    <div className="bg-white/20 p-2 rounded-full backdrop-blur-md">
                        <Icon name="user" className="w-6 h-6 text-white" />
                    </div>
                </div>
                <div className="mt-8 flex gap-4">
                    <div className="flex-1 bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                        <p className="text-xs text-indigo-200 mb-1">이번 달 출석률</p>
                        <div className="flex items-end gap-1">
                            <span className="text-2xl font-bold">95</span>
                            <span className="text-sm pb-1">%</span>
                        </div>
                    </div>
                    <div className="flex-1 bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10" onClick={() => setActiveTab('homework')}>
                        <p className="text-xs text-indigo-200 mb-1">남은 과제</p>
                         <div className="flex items-end gap-1">
                            <span className="text-2xl font-bold">{pendingHomeworkCount}</span>
                            <span className="text-sm pb-1">개</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 오늘의 수업 */}
            <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4 px-1 flex items-center gap-2">
                    <span className="w-1 h-6 bg-indigo-500 rounded-full"></span>
                    오늘의 수업
                </h3>
                {myClasses.length > 0 ? (
                    myClasses.map(cls => (
                        <div key={cls.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between mb-3 hover:shadow-md transition-shadow">
                            <div className="flex gap-4 items-center">
                                <div className="bg-indigo-50 w-12 h-12 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-lg">
                                    {cls.name.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 text-lg">{cls.name}</h4>
                                    <p className="text-sm text-gray-500 mt-1">16:00 - 18:00 (2시간)</p>
                                </div>
                            </div>
                            <button className="bg-gray-50 p-2 rounded-full hover:bg-gray-100">
                                <Icon name="chevronRight" className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="bg-gray-50 p-8 rounded-2xl text-center text-gray-400 border border-dashed border-gray-200">
                        오늘 예정된 수업이 없습니다. ☕️
                    </div>
                )}
            </div>

            {/* 바로가기 그리드 */}
            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={() => setActiveTab('homework')}
                    className="bg-blue-50 p-5 rounded-2xl flex flex-col items-center justify-center hover:bg-blue-100 transition-colors gap-3"
                >
                    <div className="bg-blue-100 p-3 rounded-full">
                        <Icon name="fileText" className="w-6 h-6 text-blue-600" />
                    </div>
                    <span className="font-bold text-gray-700">과제 확인</span>
                </button>
                <button 
                    onClick={() => setActiveTab('grades')} 
                    className="bg-purple-50 p-5 rounded-2xl flex flex-col items-center justify-center hover:bg-purple-100 transition-colors gap-3"
                >
                    <div className="bg-purple-100 p-3 rounded-full">
                        <Icon name="barChart" className="w-6 h-6 text-purple-600" />
                    </div>
                    <span className="font-bold text-gray-700">성적 리포트</span>
                </button>
            </div>
        </div>
    );

    // --- [2] 시간표 탭 (간단한 주간 뷰) ---
    const ScheduleTab = () => {
        const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
        const today = new Date().getDay();

        return (
            <div className="space-y-6 animate-fade-in-up">
                <h2 className="text-2xl font-bold text-gray-800">이번 주 시간표</h2>
                
                {/* 요일 헤더 */}
                <div className="flex justify-between bg-white p-2 rounded-xl shadow-sm">
                    {weekDays.map((day, index) => (
                        <div key={day} className={`flex flex-col items-center p-2 rounded-lg flex-1 ${index === today ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400'}`}>
                            <span className="text-xs mb-1">{day}</span>
                            <span className="font-bold">{new Date().getDate() + (index - today)}</span> 
                        </div>
                    ))}
                </div>

                {/* 시간표 리스트 (단순화) */}
                <div className="space-y-4">
                    {myClasses.map((cls) => (
                         <div key={cls.id} className="relative pl-6 border-l-2 border-indigo-200 py-2">
                             <div className="absolute -left-[9px] top-3 w-4 h-4 rounded-full bg-indigo-500 ring-4 ring-indigo-100"></div>
                             <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                 <div className="flex justify-between mb-1">
                                     <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded">수학</span>
                                     <span className="text-xs text-gray-400">오후 4:00</span>
                                 </div>
                                 <h4 className="font-bold text-gray-800">{cls.name}</h4>
                                 <p className="text-sm text-gray-500 mt-1">강의실: 301호</p>
                             </div>
                         </div>
                    ))}
                    {myClasses.length === 0 && (
                        <div className="text-center py-10 text-gray-400">등록된 수업이 없습니다.</div>
                    )}
                </div>
            </div>
        );
    };

    // --- [3] 과제 탭 ---
    const HomeworkTab = () => (
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-800">과제함</h2>
            
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-full text-sm font-bold whitespace-nowrap shadow-md">전체</button>
                <button className="px-4 py-2 bg-white text-gray-500 border border-gray-200 rounded-full text-sm font-medium whitespace-nowrap">진행 중</button>
                <button className="px-4 py-2 bg-white text-gray-500 border border-gray-200 rounded-full text-sm font-medium whitespace-nowrap">완료됨</button>
            </div>

            <div className="space-y-3">
                {myHomeworkStats.length > 0 ? myHomeworkStats.map(hw => (
                    <div key={hw.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start mb-3">
                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                                hw.status === '완료' ? 'bg-green-100 text-green-700' : 
                                hw.status === '미시작' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                                {hw.status}
                            </span>
                            <span className="text-xs text-gray-400">{hw.date} 마감</span>
                        </div>
                        <h4 className="font-bold text-gray-800 mb-1">{hw.content}</h4>
                        <p className="text-sm text-gray-500 mb-4">{hw.book} (총 {hw.totalQuestions}문제)</p>
                        
                        {/* 진행률 바 */}
                        <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                            <div className="bg-indigo-500 h-2 rounded-full transition-all duration-500" style={{ width: `${hw.completionRate}%` }}></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>진행률 {hw.completionRate}%</span>
                            <span>{hw.completedCount} / {hw.totalQuestions} 완료</span>
                        </div>
                    </div>
                )) : (
                     <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <Icon name="clipboardCheck" className="w-12 h-12 mb-2 opacity-50" />
                        <p>등록된 과제가 없습니다.</p>
                     </div>
                )}
            </div>
        </div>
    );

    // --- [4] 메뉴 탭 ---
    const MenuTab = () => (
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-800">메뉴</h2>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button className="w-full p-4 flex items-center justify-between border-b border-gray-50 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="bg-gray-100 p-2 rounded-lg"><Icon name="user" className="w-5 h-5 text-gray-600" /></div>
                        <span className="font-medium text-gray-700">내 정보 수정</span>
                    </div>
                    <Icon name="chevronRight" className="w-4 h-4 text-gray-400" />
                </button>
                <button className="w-full p-4 flex items-center justify-between border-b border-gray-50 hover:bg-gray-50">
                     <div className="flex items-center gap-3">
                        <div className="bg-gray-100 p-2 rounded-lg"><Icon name="bell" className="w-5 h-5 text-gray-600" /></div>
                        <span className="font-medium text-gray-700">알림 설정</span>
                    </div>
                    <Icon name="chevronRight" className="w-4 h-4 text-gray-400" />
                </button>
            </div>

            <button 
                onClick={onLogout} 
                className="w-full bg-red-50 text-red-600 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
            >
                <Icon name="logOut" className="w-5 h-5" />
                로그아웃
            </button>
        </div>
    );

    // --- 메인 렌더링 ---
    return (
        <div className="flex flex-col h-screen bg-gray-50 max-w-md mx-auto shadow-2xl relative overflow-hidden">
            {/* 상단 헤더 */}
            <header className="bg-white px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm/50">
                <h1 className="text-lg font-extrabold text-indigo-900 tracking-tight">MATH PLANNER</h1>
                <button className="relative p-1">
                    <Icon name="bell" className="w-6 h-6 text-gray-600" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
                </button>
            </header>

            {/* 메인 콘텐츠 */}
            <main className="flex-1 overflow-y-auto p-6 pb-28 scrollbar-hide bg-gray-50">
                {activeTab === 'home' && <DashboardTab />}
                {activeTab === 'schedule' && <ScheduleTab />}
                {activeTab === 'homework' && <HomeworkTab />}
                {activeTab === 'menu' && <MenuTab />}
            </main>

            {/* 하단 탭 내비게이션 */}
            <nav className="bg-white border-t border-gray-100 absolute bottom-0 w-full px-6 py-2 pb-6 flex justify-between items-center rounded-t-3xl shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-30">
                <NavButton icon="home" label="홈" isActive={activeTab === 'home'} onClick={() => setActiveTab('home')} />
                <NavButton icon="calendar" label="시간표" isActive={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')} />
                
                {/* 중앙 플로팅 버튼 (질문/상담 등) */}
                <div className="relative -top-8">
                    <button className="bg-indigo-600 p-4 rounded-full shadow-lg shadow-indigo-300 text-white transform transition-transform active:scale-95 hover:bg-indigo-700 ring-4 ring-gray-50">
                        <Icon name="plus" className="w-7 h-7" />
                    </button>
                </div>

                <NavButton icon="fileText" label="과제" isActive={activeTab === 'homework'} onClick={() => setActiveTab('homework')} />
                <NavButton icon="menu" label="메뉴" isActive={activeTab === 'menu'} onClick={() => setActiveTab('menu')} />
            </nav>
        </div>
    );
}

// 하단 탭 버튼 컴포넌트
const NavButton = ({ icon, label, isActive, onClick }) => (
    <button 
        onClick={onClick}
        className={`flex flex-col items-center gap-1 w-14 transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
    >
        <div className={`transition-all duration-300 ${isActive ? '-translate-y-1' : ''}`}>
             <Icon name={icon} className={`w-6 h-6 ${isActive ? 'fill-current opacity-20' : ''} stroke-2`} />
        </div>
        <span className={`text-[10px] font-bold transition-opacity ${isActive ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
    </button>
);