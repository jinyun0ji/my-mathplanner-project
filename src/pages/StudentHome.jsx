// src/pages/StudentHome.jsx
import React, { useState, useMemo } from 'react';
import { Icon, calculateHomeworkStats, calculateGradeComparison } from '../utils/helpers'; 

export default function StudentHome({ studentId, students, classes, homeworkAssignments, homeworkResults, attendanceLogs, tests, grades, onLogout }) {
    const [activeTab, setActiveTab] = useState('home');

    const student = students.find(s => s.id === studentId);
    
    // 학생의 클래스 목록
    const myClasses = classes.filter(c => student?.classes.includes(c.id));

    // 과제 통계 계산
    const myHomeworkStats = useMemo(() => 
        calculateHomeworkStats(studentId, homeworkAssignments, homeworkResults), 
    [studentId, homeworkAssignments, homeworkResults]);

    const pendingHomeworkCount = myHomeworkStats.filter(h => h.status !== '완료').length;

    // 성적 비교 데이터 계산
    const myGradeComparison = useMemo(() => 
        calculateGradeComparison(studentId, classes, tests, grades),
    [studentId, classes, tests, grades]);

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

    // --- [2] 시간표/출결 탭 ---
    const ScheduleTab = () => {
        const [viewType, setViewType] = useState('weekly'); 
        const [selectedDate, setSelectedDate] = useState(new Date());
        const [currentDate, setCurrentDate] = useState(new Date());

        const formatDate = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        const renderScheduleList = () => {
            const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][selectedDate.getDay()];
            const dailyClasses = myClasses.filter(cls => cls.schedule.days.includes(dayOfWeek));

            if (dailyClasses.length === 0) {
                return (
                    <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                        <p className="font-bold text-gray-500 mb-1">{selectedDate.getMonth()+1}월 {selectedDate.getDate()}일 ({dayOfWeek})</p>
                        예정된 수업이 없습니다.
                    </div>
                );
            }

            return dailyClasses.map((cls) => {
                 const log = attendanceLogs ? attendanceLogs.find(l => l.studentId === studentId && l.classId === cls.id && l.date === formatDate(selectedDate)) : null;

                 return (
                     <div key={cls.id} className="relative pl-6 border-l-2 border-indigo-200 py-2 ml-2">
                         <div className={`absolute -left-[9px] top-3 w-4 h-4 rounded-full ring-4 ring-indigo-50 
                            ${log?.status === '출석' ? 'bg-green-500' : log?.status === '지각' ? 'bg-yellow-400' : log?.status === '결석' ? 'bg-red-500' : 'bg-indigo-500'}
                         `}></div>
                         <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                             <div className="flex justify-between mb-2">
                                 <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded">
                                    {dayOfWeek}요일 수업
                                 </span>
                                 <span className="text-xs text-gray-400 font-medium">{cls.schedule.time}</span>
                             </div>
                             <h4 className="font-bold text-gray-800 text-lg">{cls.name}</h4>
                             <div className="flex justify-between items-end mt-2">
                                 <p className="text-sm text-gray-500 flex items-center gap-1">
                                    <Icon name="users" className="w-4 h-4" />
                                    {cls.teacher} 선생님
                                 </p>
                                 {log && (
                                     <span className={`text-xs font-bold px-2 py-1 rounded
                                        ${log.status === '출석' ? 'bg-green-100 text-green-700' : 
                                          log.status === '지각' ? 'bg-yellow-100 text-yellow-700' : 
                                          'bg-red-100 text-red-700'}
                                     `}>
                                         {log.status}
                                     </span>
                                 )}
                             </div>
                         </div>
                     </div>
                 );
            });
        };

        // --- 주간 뷰 ---
        const WeeklyView = () => {
            const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
            
            // selectedDate가 포함된 주의 일요일 계산
            const baseDate = new Date(selectedDate);
            const baseDay = baseDate.getDay();
            const sunday = new Date(baseDate);
            sunday.setDate(baseDate.getDate() - baseDay);

            // 주간 이동 핸들러
            const prevWeek = () => {
                const newDate = new Date(selectedDate);
                newDate.setDate(selectedDate.getDate() - 7);
                setSelectedDate(newDate);
            };

            const nextWeek = () => {
                const newDate = new Date(selectedDate);
                newDate.setDate(selectedDate.getDate() + 7);
                setSelectedDate(newDate);
            };

            return (
                <div className="space-y-6 animate-fade-in-up">
                    {/* ✅ 주간 네비게이션 헤더 추가 */}
                    <div className="flex items-center justify-between px-2">
                        <button onClick={prevWeek} className="p-2 bg-white rounded-full shadow-sm text-gray-400 hover:text-indigo-600">
                            <Icon name="arrow-left" className="w-5 h-5" />
                        </button>
                        <span className="font-bold text-gray-700">
                            {sunday.getMonth() + 1}월 {Math.ceil(sunday.getDate() / 7)}주차
                        </span>
                        <button onClick={nextWeek} className="p-2 bg-white rounded-full shadow-sm text-gray-400 hover:text-indigo-600 transform rotate-180">
                            <Icon name="arrow-left" className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex justify-between bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                        {weekDays.map((day, index) => {
                            const date = new Date(sunday);
                            date.setDate(sunday.getDate() + index);
                            
                            const isSelected = formatDate(date) === formatDate(selectedDate);
                            const isToday = formatDate(date) === formatDate(new Date());

                            return (
                                <button 
                                    key={day} 
                                    onClick={() => setSelectedDate(date)} 
                                    className={`flex flex-col items-center p-2 rounded-xl flex-1 transition-all
                                        ${isSelected ? 'bg-indigo-600 text-white shadow-md scale-105' : 'hover:bg-gray-50'}
                                        ${!isSelected && isToday ? 'text-indigo-600 font-bold' : ''}
                                        ${!isSelected && !isToday ? 'text-gray-400' : ''}
                                    `}
                                >
                                    <span className="text-xs mb-1">{day}</span>
                                    <span className="font-bold text-lg">{date.getDate()}</span> 
                                </button>
                            );
                        })}
                    </div>

                    <div className="space-y-4">
                        {renderScheduleList()}
                    </div>
                </div>
            );
        };

        // --- 월간 뷰 ---
        const MonthlyView = () => {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const firstDayOfMonth = new Date(year, month, 1);
            const lastDayOfMonth = new Date(year, month + 1, 0);
            const startDayOfWeek = firstDayOfMonth.getDay(); 
            const daysInMonth = lastDayOfMonth.getDate();

            const calendarDays = [];
            for (let i = 0; i < startDayOfWeek; i++) calendarDays.push(null);
            for (let i = 1; i <= daysInMonth; i++) calendarDays.push(new Date(year, month, i));

            const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
            const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

            return (
                <div className="animate-fade-in-up">
                    <div className="bg-white rounded-3xl shadow-lg p-6 border border-gray-100 mb-6">
                        <div className="flex justify-between items-center mb-6">
                            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><Icon name="arrow-left" className="w-5 h-5" /></button>
                            <h3 className="text-lg font-bold text-gray-800">{year}년 {month + 1}월</h3>
                            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transform rotate-180"><Icon name="arrow-left" className="w-5 h-5" /></button>
                        </div>
                        <div className="grid grid-cols-7 mb-2 text-center">
                            {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                                <div key={day} className={`text-xs font-bold ${i === 0 ? 'text-red-400' : 'text-gray-400'}`}>{day}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-y-4 gap-x-1">
                            {calendarDays.map((date, index) => {
                                if (!date) return <div key={index}></div>;
                                const isSelected = selectedDate && formatDate(date) === formatDate(selectedDate);
                                const isToday = formatDate(date) === formatDate(new Date());

                                return (
                                    <div key={index} className="flex flex-col items-center cursor-pointer" onClick={() => setSelectedDate(date)}>
                                        <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-md scale-110' : ''} ${!isSelected && isToday ? 'text-indigo-600 font-bold bg-indigo-50' : ''} ${!isSelected && !isToday ? 'text-gray-700 hover:bg-gray-50' : ''}`}>
                                            {date.getDate()}
                                        </div>
                                        {/* 수업 있음 표시 (점) */}
                                        <div className="h-1.5 mt-1 w-1.5 rounded-full bg-gray-100"></div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="space-y-4">
                        {renderScheduleList()}
                    </div>
                </div>
            );
        };

        return (
            <div className="pb-20">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">나의 일정</h2>
                    <div className="bg-white p-1 rounded-xl border border-gray-100 shadow-sm flex">
                        <button onClick={() => setViewType('weekly')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewType === 'weekly' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>주간</button>
                        <button onClick={() => { setViewType('monthly'); setCurrentDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewType === 'monthly' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>월간</button>
                    </div>
                </div>
                {viewType === 'weekly' ? <WeeklyView /> : <MonthlyView />}
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
                            <span className={`text-xs font-bold px-2 py-1 rounded ${hw.status === '완료' ? 'bg-green-100 text-green-700' : hw.status === '미시작' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{hw.status}</span>
                            <span className="text-xs text-gray-400">{hw.date} 마감</span>
                        </div>
                        <h4 className="font-bold text-gray-800 mb-1">{hw.content}</h4>
                        <p className="text-sm text-gray-500 mb-4">{hw.book} (총 {hw.totalQuestions}문제)</p>
                        <div className="w-full bg-gray-100 rounded-full h-2 mb-2"><div className="bg-indigo-500 h-2 rounded-full transition-all duration-500" style={{ width: `${hw.completionRate}%` }}></div></div>
                        <div className="flex justify-between text-xs text-gray-500"><span>진행률 {hw.completionRate}%</span><span>{hw.completedCount} / {hw.totalQuestions} 완료</span></div>
                    </div>
                )) : (<div className="flex flex-col items-center justify-center py-20 text-gray-400"><Icon name="clipboardCheck" className="w-12 h-12 mb-2 opacity-50" /><p>등록된 과제가 없습니다.</p></div>)}
            </div>
        </div>
    );

    // --- [NEW] 성적 리포트 탭 ---
    const GradesTab = () => (
        <div className="space-y-6 animate-fade-in-up pb-20">
            <h2 className="text-2xl font-bold text-gray-800">성적 리포트</h2>
            
            {myGradeComparison.length > 0 ? myGradeComparison.map((item, idx) => (
                <div key={idx} className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded mb-2 inline-block">{item.className}</span>
                            <h3 className="text-xl font-bold text-gray-800">{item.testName}</h3>
                        </div>
                        <div className="text-right">
                            <span className="text-3xl font-bold text-indigo-600">{item.studentScore}</span>
                            <span className="text-gray-400 text-sm"> / {item.maxScore}</span>
                        </div>
                    </div>

                    {/* 그래프 */}
                    <div className="space-y-3 mb-6">
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="font-bold text-gray-600">나의 점수</span>
                                <span className="text-gray-500">{item.studentScore}점</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3">
                                <div className="bg-indigo-500 h-3 rounded-full" style={{ width: `${(item.studentScore / item.maxScore) * 100}%` }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="font-bold text-gray-400">반 평균</span>
                                <span className="text-gray-400">{item.classAverage}점</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3">
                                <div className="bg-gray-400 h-3 rounded-full" style={{ width: `${(item.classAverage / item.maxScore) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>

                    {/* 분석 코멘트 (간단 버전) */}
                    <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-600">
                        {item.isAboveAverage ? (
                            <p className="flex items-center gap-2">
                                <span className="text-green-500 font-bold">Great!</span> 
                                평균보다 <span className="font-bold">{item.scoreDifference}점</span> 높아요. 잘하고 있어요! 🎉
                            </p>
                        ) : (
                            <p className="flex items-center gap-2">
                                <span className="text-indigo-500 font-bold">Cheer Up!</span>
                                평균까지 <span className="font-bold">{Math.abs(item.scoreDifference)}점</span> 남았어요. 조금만 더 힘내요! 🔥
                            </p>
                        )}
                    </div>
                </div>
            )) : (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Icon name="barChart" className="w-16 h-16 mb-4 opacity-30 text-indigo-200" />
                    <p className="font-medium">등록된 성적 데이터가 없습니다.</p>
                </div>
            )}
        </div>
    );

    // --- [4] 메뉴 탭 ---
    const MenuTab = () => (
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-800">메뉴</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button className="w-full p-4 flex items-center justify-between border-b border-gray-50 hover:bg-gray-50"><div className="flex items-center gap-3"><div className="bg-gray-100 p-2 rounded-lg"><Icon name="user" className="w-5 h-5 text-gray-600" /></div><span className="font-medium text-gray-700">내 정보 수정</span></div><Icon name="chevronRight" className="w-4 h-4 text-gray-400" /></button>
                <button className="w-full p-4 flex items-center justify-between border-b border-gray-50 hover:bg-gray-50"><div className="flex items-center gap-3"><div className="bg-gray-100 p-2 rounded-lg"><Icon name="bell" className="w-5 h-5 text-gray-600" /></div><span className="font-medium text-gray-700">알림 설정</span></div><Icon name="chevronRight" className="w-4 h-4 text-gray-400" /></button>
            </div>
            <button onClick={onLogout} className="w-full bg-red-50 text-red-600 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"><Icon name="logOut" className="w-5 h-5" />로그아웃</button>
        </div>
    );

    return (
        <div className="flex flex-col h-screen bg-gray-50 max-w-md mx-auto shadow-2xl relative overflow-hidden">
            <header className="bg-white px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm/50">
                <h1 className="text-lg font-extrabold text-indigo-900 tracking-tight">채수용 수학</h1>
                <button className="relative p-1"><Icon name="bell" className="w-6 h-6 text-gray-600" /><span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span></button>
            </header>

            <main className="flex-1 overflow-y-auto p-6 pb-28 scrollbar-hide bg-gray-50">
                {activeTab === 'home' && <DashboardTab />}
                {activeTab === 'schedule' && <ScheduleTab />}
                {activeTab === 'homework' && <HomeworkTab />}
                {activeTab === 'grades' && <GradesTab />} 
                {activeTab === 'menu' && <MenuTab />}
            </main>

            <nav className="bg-white border-t border-gray-100 absolute bottom-0 w-full px-6 py-2 pb-6 flex justify-between items-center rounded-t-3xl shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-30">
                <NavButton icon="home" label="홈" isActive={activeTab === 'home'} onClick={() => setActiveTab('home')} />
                <NavButton icon="calendar" label="출결" isActive={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')} />
                <div className="relative -top-8">
                    <button className="bg-indigo-600 p-4 rounded-full shadow-lg shadow-indigo-300 text-white transform transition-transform active:scale-95 hover:bg-indigo-700 ring-4 ring-gray-50">
                        <Icon name="plus" className="w-7 h-7" />
                    </button>
                </div>
                <NavButton icon="fileText" label="과제" isActive={activeTab === 'homework'} onClick={() => setActiveTab('homework')} />
                <NavButton icon="barChart" label="성적" isActive={activeTab === 'grades'} onClick={() => setActiveTab('grades')} /> 
                <NavButton icon="menu" label="메뉴" isActive={activeTab === 'menu'} onClick={() => setActiveTab('menu')} />
            </nav>
        </div>
    );
}

const NavButton = ({ icon, label, isActive, onClick }) => (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 w-14 transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
        <div className={`transition-all duration-300 ${isActive ? '-translate-y-1' : ''}`}><Icon name={icon} className={`w-6 h-6 ${isActive ? 'fill-current opacity-20' : ''} stroke-2`} /></div>
        <span className={`text-[10px] font-bold transition-opacity ${isActive ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
    </button>
);