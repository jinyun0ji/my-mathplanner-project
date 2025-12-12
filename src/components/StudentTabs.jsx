// src/components/StudentTabs.jsx
import React, { useState } from 'react';
import { Icon, getWeekOfMonthISO } from '../utils/helpers';

// 1. 대시보드 탭 (반응형 적용)
export const DashboardTab = ({ student, myClasses, setActiveTab, pendingHomeworkCount, setSelectedClassId }) => (
    <div className="space-y-6 animate-fade-in-up">
        {/* 상단 웰컴 카드 (항상 전체 너비) */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 bg-white/10 w-32 h-32 rounded-full blur-2xl group-hover:bg-white/20 transition-all"></div>
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-indigo-200 text-sm mb-1 font-medium">오늘도 힘내세요! 💪</p>
                    <h2 className="text-3xl md:text-4xl font-bold">{student.name}님</h2>
                </div>
                <div className="bg-white/20 p-2 rounded-full backdrop-blur-md">
                    <Icon name="user" className="w-6 h-6 text-white" />
                </div>
            </div>
            
            {/* 통계 카드 (모바일: 가로 스크롤 / 태블릿 이상: Grid) */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-colors">
                    <p className="text-xs text-indigo-200 mb-1">이번 달 출석률</p>
                    <div className="flex items-end gap-1">
                        <span className="text-2xl font-bold">95</span>
                        <span className="text-sm pb-1">%</span>
                    </div>
                </div>
                <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-colors cursor-pointer" onClick={() => setActiveTab('homework')}>
                    <p className="text-xs text-indigo-200 mb-1">남은 과제</p>
                     <div className="flex items-end gap-1">
                        <span className="text-2xl font-bold">{pendingHomeworkCount}</span>
                        <span className="text-sm pb-1">개</span>
                    </div>
                </div>
            </div>
        </div>

        <div>
            <h3 className="text-lg font-bold text-gray-800 mb-4 px-1 flex items-center gap-2">
                <span className="w-1 h-6 bg-indigo-500 rounded-full"></span>
                수강 강좌
            </h3>
            {/* ✅ [수정] 반응형 Grid 적용 (모바일 1열, 태블릿 2열, PC 3열) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myClasses.map(cls => (
                    <div 
                        key={cls.id} 
                        onClick={() => setSelectedClassId(cls.id)} 
                        className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-lg hover:border-indigo-100 hover:-translate-y-1 transition-all"
                    >
                        <div className="flex gap-4 items-center">
                            <div className="bg-indigo-50 w-12 h-12 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-lg shrink-0">
                                {cls.name.charAt(0)}
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 text-lg truncate pr-2">{cls.name}</h4>
                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                    <Icon name="users" className="w-3 h-3" /> 채수용 선생님
                                </p>
                            </div>
                        </div>
                        <div className="text-indigo-600 bg-indigo-50 p-2 rounded-full shrink-0">
                            <Icon name="chevronRight" className="w-5 h-5" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// 2. 시간표 탭 (동일하게 유지하되 스타일만 반응형 고려)
export const ScheduleTab = ({ myClasses, externalSchedules, attendanceLogs, studentId, onSaveExternalSchedule, onDeleteExternalSchedule }) => {
    // ... (기존 로직 동일, useLayoutEffect 등 hook 유지) ...
    const [viewType, setViewType] = useState('weekly'); 
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [newSchedule, setNewSchedule] = useState({
        academyName: '', courseName: '', instructor: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', days: [], startTime: '', endTime: ''
    });

    // ... (헬퍼 함수들 동일) ...
    const formatDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const handleAddScheduleSubmit = () => {
        if (!newSchedule.academyName || !newSchedule.courseName || !newSchedule.startDate || newSchedule.days.length === 0 || !newSchedule.startTime) {
            alert('필수 정보를 모두 입력해주세요.');
            return;
        }
        if (onSaveExternalSchedule) {
            onSaveExternalSchedule({
                studentId,
                ...newSchedule, 
                time: `${newSchedule.startTime}~${newSchedule.endTime || ''}`
            });
        }
        setIsScheduleModalOpen(false);
        setNewSchedule({ academyName: '', courseName: '', instructor: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', days: [], startTime: '', endTime: '' });
    };
    
    const toggleDay = (day) => {
        setNewSchedule(prev => {
            const newDays = prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day];
            const dayOrder = { '월':1, '화':2, '수':3, '목':4, '금':5, '토':6, '일':7 };
            newDays.sort((a, b) => dayOrder[a] - dayOrder[b]);
            return { ...prev, days: newDays };
        });
    };

    const renderScheduleList = () => {
         // ... (기존 로직 동일) ...
         const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][selectedDate.getDay()];
         const dateStr = formatDate(selectedDate);
         
         const dailyClasses = myClasses.filter(cls => cls.schedule.days.includes(dayOfWeek)).map(cls => ({
             id: `math-${cls.id}`, type: 'math', name: cls.name, teacher: '채수용', time: cls.schedule.time, scheduleId: cls.id
         }));
         const myExternal = externalSchedules ? externalSchedules.filter(s => {
             const isValidStudent = s.studentId === studentId;
             const isDayMatch = s.days && s.days.includes(dayOfWeek);
             const isDateInRange = selectedDate >= new Date(s.startDate) && (!s.endDate || selectedDate <= new Date(s.endDate));
             return isValidStudent && isDayMatch && isDateInRange;
         }) : [];
         const dailyExternal = myExternal.map(s => ({
             id: `ext-${s.id}`, type: 'external', name: s.academyName, teacher: s.courseName, time: `${s.startTime}~${s.endTime}`, scheduleId: s.id
         }));
         const allSchedules = [...dailyClasses, ...dailyExternal].sort((a, b) => (a.time.split('~')[0] || '00:00').localeCompare(b.time.split('~')[0] || '00:00'));
 
         if (allSchedules.length === 0) {
             return (
                 <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                     <p className="font-bold text-gray-500 mb-1">{selectedDate.getMonth()+1}월 {selectedDate.getDate()}일 ({dayOfWeek})</p>
                     일정이 없습니다.
                 </div>
             );
         }
 
         // ✅ [수정] 일정 리스트도 Grid로 (PC에서 가로 배치)
         return (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                 {allSchedules.map((item) => {
                      let log = null;
                      if (item.type === 'math') {
                          log = attendanceLogs ? attendanceLogs.find(l => l.studentId === studentId && l.classId === item.scheduleId && l.date === dateStr) : null;
                      }
                      return (
                          <div key={item.id} className={`relative pl-6 border-l-2 py-2 ml-2 ${item.type === 'math' ? 'border-indigo-200' : 'border-orange-200'}`}>
                              <div className={`absolute -left-[9px] top-3 w-4 h-4 rounded-full ring-4 ${item.type === 'math' ? (log?.status === '출석' ? 'bg-green-500 ring-indigo-50' : log?.status === '지각' ? 'bg-yellow-400 ring-indigo-50' : log?.status === '결석' ? 'bg-red-500 ring-indigo-50' : 'bg-indigo-500 ring-indigo-50') : 'bg-orange-400 ring-orange-50'}`}></div>
                              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative group h-full flex flex-col justify-between hover:shadow-md transition-shadow">
                                  <div>
                                      <div className="flex justify-between mb-2">
                                          <span className={`text-xs font-bold px-2 py-1 rounded ${item.type === 'math' ? 'text-indigo-500 bg-indigo-50' : 'text-orange-500 bg-orange-50'}`}>{item.type === 'math' ? '수학 학원' : item.teacher}</span>
                                          <span className="text-xs text-gray-400 font-medium">{item.time}</span>
                                      </div>
                                      <h4 className="font-bold text-gray-800 text-lg mb-2">{item.name}</h4>
                                  </div>
                                  <div className="flex justify-between items-end">
                                      {item.type === 'math' ? (<><p className="text-sm text-gray-500 flex items-center gap-1"><Icon name="users" className="w-4 h-4" /> 채수용 선생님</p>{log && (<span className={`text-xs font-bold px-2 py-1 rounded ${log.status === '출석' ? 'bg-green-100 text-green-700' : log.status === '지각' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{log.status}</span>)}</>) : (<div className="w-full flex justify-end"><button onClick={() => { if(window.confirm('이 일정을 삭제하시겠습니까?')) onDeleteExternalSchedule(item.scheduleId); }} className="text-xs text-gray-300 hover:text-red-500 underline">삭제</button></div>)}
                                  </div>
                              </div>
                          </div>
                      );
                 })}
             </div>
         );
    };

    const WeeklyView = () => {
        const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
        const baseDate = new Date(selectedDate);
        const baseDay = baseDate.getDay();
        const sunday = new Date(baseDate);
        sunday.setDate(baseDate.getDate() - baseDay);
        const { month, week } = getWeekOfMonthISO(sunday);

        const prevWeek = () => { const newDate = new Date(selectedDate); newDate.setDate(selectedDate.getDate() - 7); setSelectedDate(newDate); };
        const nextWeek = () => { const newDate = new Date(selectedDate); newDate.setDate(selectedDate.getDate() + 7); setSelectedDate(newDate); };

        return (
            <div className="space-y-6 animate-fade-in-up">
                <div className="flex items-center justify-between px-2 mb-2">
                    <button onClick={prevWeek} className="p-2 bg-white rounded-full shadow-sm text-gray-400 hover:text-indigo-600 hover:bg-gray-50"><Icon name="arrow-left" className="w-5 h-5" /></button>
                    <span className="font-bold text-gray-700 text-lg">{month}월 {week}주차</span>
                    <button onClick={nextWeek} className="p-2 bg-white rounded-full shadow-sm text-gray-400 hover:text-indigo-600 hover:bg-gray-50 transform rotate-180"><Icon name="arrow-left" className="w-5 h-5" /></button>
                </div>
                <div className="flex justify-between bg-white p-2 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                    {weekDays.map((day, index) => {
                        const date = new Date(sunday);
                        date.setDate(sunday.getDate() + index);
                        const isSelected = formatDate(date) === formatDate(selectedDate);
                        const isToday = formatDate(date) === formatDate(new Date());
                        return (<button key={day} onClick={() => setSelectedDate(date)} className={`flex flex-col items-center p-2 rounded-xl flex-1 transition-all min-w-[40px] ${isSelected ? 'bg-indigo-600 text-white shadow-md scale-105' : 'hover:bg-gray-50'} ${!isSelected && isToday ? 'text-indigo-600 font-bold' : ''} ${!isSelected && !isToday ? 'text-gray-400' : ''}`}><span className="text-xs mb-1">{day}</span><span className="font-bold text-lg">{date.getDate()}</span></button>);
                    })}
                </div>
                <div className="space-y-4">{renderScheduleList()}</div>
            </div>
        );
    };

    const MonthlyView = () => {
        // ... (기존 월간 뷰 로직 동일) ...
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startDayOfWeek = firstDayOfMonth.getDay();
        const calendarDays = Array(startDayOfWeek).fill(null).concat([...Array(daysInMonth).keys()].map(i => new Date(year, month, i + 1)));

        const prevMonth = () => setSelectedDate(new Date(year, month - 1, 1));
        const nextMonth = () => setSelectedDate(new Date(year, month + 1, 1));

        const getDayInfo = (date) => {
            if (!date) return { hasClass: false, status: null, hasExternal: false };
            const dateStr = formatDate(date);
            const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
            
            const dayClasses = myClasses.filter(cls => cls.schedule.days.includes(dayOfWeek));
            const myExternal = externalSchedules ? externalSchedules.filter(s => {
                const isValidStudent = s.studentId === studentId;
                const isDayMatch = s.days && s.days.includes(dayOfWeek);
                const isDateInRange = date >= new Date(s.startDate) && (!s.endDate || date <= new Date(s.endDate));
                return isValidStudent && isDayMatch && isDateInRange;
            }) : [];
            const logs = attendanceLogs ? attendanceLogs.filter(log => log.studentId === studentId && log.date === dateStr) : [];
            let status = null;
            if (logs.length > 0) {
                if (logs.some(l => l.status === '결석')) status = '결석';
                else if (logs.some(l => l.status === '지각')) status = '지각';
                else status = '출석';
            }
            return { hasClass: (dayClasses.length > 0), status, hasExternal: myExternal.length > 0 };
        };

        return (
            <div className="animate-fade-in-up">
                <div className="bg-white rounded-3xl shadow-lg p-6 border border-gray-100 mb-6 max-w-2xl mx-auto">
                     {/* ... (캘린더 헤더) ... */}
                    <div className="flex justify-between items-center mb-6">
                        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><Icon name="arrow-left" className="w-5 h-5" /></button>
                        <h3 className="text-lg font-bold text-gray-800">{year}년 {month + 1}월</h3>
                        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transform rotate-180"><Icon name="arrow-left" className="w-5 h-5" /></button>
                    </div>
                    {/* ... (요일 헤더) ... */}
                    <div className="grid grid-cols-7 mb-2 text-center">
                        {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (<div key={day} className={`text-xs font-bold ${i === 0 ? 'text-red-400' : 'text-gray-400'}`}>{day}</div>))}
                    </div>
                    {/* ... (날짜 그리드) ... */}
                    <div className="grid grid-cols-7 gap-y-4 gap-x-1">
                        {calendarDays.map((date, index) => {
                            if (!date) return <div key={index}></div>;
                            const { hasClass, status, hasExternal } = getDayInfo(date);
                            const isSelected = formatDate(date) === formatDate(selectedDate);
                            const isToday = formatDate(date) === formatDate(new Date());
                            return (
                                <div key={index} className="flex flex-col items-center cursor-pointer group" onClick={() => setSelectedDate(date)}>
                                    <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-md scale-110' : ''} ${!isSelected && isToday ? 'text-indigo-600 font-bold bg-indigo-50' : ''} ${!isSelected && !isToday ? 'text-gray-700 group-hover:bg-gray-50' : ''}`}>{date.getDate()}</div>
                                    <div className="h-1.5 mt-1 flex gap-0.5 min-h-[6px]">
                                        {status === '출석' && <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>}
                                        {status === '지각' && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>}
                                        {status === '결석' && <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>}
                                        {!status && hasClass && <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>}
                                        {hasExternal && <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="space-y-4">{renderScheduleList()}</div>
            </div>
        );
    };

    return (
        <div className="pb-20 relative">
            {/* ... (헤더 버튼들) ... */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">나의 일정</h2>
                <div className="flex gap-2">
                    <button onClick={() => setIsScheduleModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-0 h-[32px] rounded-xl text-xs font-bold flex items-center gap-1 shadow-md transition-all active:scale-95"><Icon name="plus" className="w-4 h-4" /> 일정 추가</button>
                    <div className="bg-white p-1 rounded-xl border border-gray-100 shadow-sm flex h-[32px] items-center">
                        <button onClick={() => setViewType('weekly')} className={`px-3 py-0 h-full flex items-center rounded-lg text-xs font-bold transition-all ${viewType === 'weekly' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>주간</button>
                        <button onClick={() => { setViewType('monthly'); setSelectedDate(new Date()); }} className={`px-3 py-0 h-full flex items-center rounded-lg text-xs font-bold transition-all ${viewType === 'monthly' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>월간</button>
                    </div>
                </div>
            </div>
            {viewType === 'weekly' ? <WeeklyView /> : <MonthlyView />}
            
            {/* ... (모달 - 모바일 대응 유지) ... */}
            {isScheduleModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsScheduleModalOpen(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-800 mb-4">타학원 일정 등록</h3>
                        {/* ... (모달 내용 동일) ... */}
                        <div className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar px-1">
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">학원명 *</label><input type="text" value={newSchedule.academyName} onChange={e => setNewSchedule({...newSchedule, academyName: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="예: 정상어학원"/></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">강의명 *</label><input type="text" value={newSchedule.courseName} onChange={e => setNewSchedule({...newSchedule, courseName: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="예: TOP반 영어"/></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">강사</label><input type="text" value={newSchedule.instructor} onChange={e => setNewSchedule({...newSchedule, instructor: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="예: Julie 선생님"/></div>
                            <div className="flex gap-2"><div className="flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">개강일 *</label><input type="date" value={newSchedule.startDate} onChange={e => setNewSchedule({...newSchedule, startDate: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"/></div><div className="flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">종강일</label><input type="date" value={newSchedule.endDate} onChange={e => setNewSchedule({...newSchedule, endDate: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"/></div></div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">수업 요일 *</label>
                                <div className="flex gap-1 justify-between">
                                    {['월','화','수','목','금','토','일'].map(d => (
                                        <button key={d} onClick={() => toggleDay(d)} className={`w-8 h-8 rounded-full text-xs font-bold transition-colors ${newSchedule.days.includes(d) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{d}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2"><div className="flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">시작 시간 *</label><input type="time" value={newSchedule.startTime} onChange={e => setNewSchedule({...newSchedule, startTime: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"/></div><div className="flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">종료 시간</label><input type="time" value={newSchedule.endTime} onChange={e => setNewSchedule({...newSchedule, endTime: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"/></div></div>
                            <button onClick={handleAddScheduleSubmit} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl mt-2 transition-colors">등록하기</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// 3. 과제 탭 (반응형 Grid 적용)
export const HomeworkTab = ({ myHomeworkStats }) => {
    const [selectedHwId, setSelectedHwId] = useState(null); 
    const toggleDetails = (id) => setSelectedHwId(selectedHwId === id ? null : id);

    return (
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-800">과제함</h2>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {/* 필터 버튼들 유지 */}
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-full text-sm font-bold whitespace-nowrap shadow-md">전체</button>
                <button className="px-4 py-2 bg-white text-gray-500 border border-gray-200 rounded-full text-sm font-medium whitespace-nowrap hover:bg-gray-50">진행 중</button>
                <button className="px-4 py-2 bg-white text-gray-500 border border-gray-200 rounded-full text-sm font-medium whitespace-nowrap hover:bg-gray-50">완료됨</button>
            </div>
            
            {/* ✅ [수정] 반응형 Grid 적용 */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {myHomeworkStats.length > 0 ? myHomeworkStats.map(hw => (
                    <div key={hw.id} onClick={() => toggleDetails(hw.id)} className={`bg-white p-5 rounded-2xl shadow-sm border border-gray-100 transition-all cursor-pointer hover:shadow-lg ${selectedHwId === hw.id ? 'ring-2 ring-indigo-500' : 'hover:border-indigo-100'}`}>
                        <div className="flex justify-between items-start mb-3">
                            <span className={`text-xs font-bold px-2 py-1 rounded ${hw.status === '완료' ? 'bg-green-100 text-green-700' : hw.status === '미시작' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{hw.status}</span>
                            <span className="text-xs text-gray-400">{hw.date} 마감</span>
                        </div>
                        <h4 className="font-bold text-gray-800 mb-1 truncate">{hw.content}</h4>
                        <p className="text-sm text-gray-500 mb-4 truncate">{hw.book} (총 {hw.totalQuestions}문제)</p>
                        <div className="w-full bg-gray-100 rounded-full h-2 mb-2"><div className="bg-indigo-500 h-2 rounded-full transition-all duration-500" style={{ width: `${hw.completionRate}%` }}></div></div>
                        <div className="flex justify-between text-xs text-gray-500"><span>진행률 {hw.completionRate}%</span><span>{hw.completedCount} / {hw.totalQuestions} 완료</span></div>
                        
                        {/* 상세 내용 (펼침) */}
                        {selectedHwId === hw.id && (
                            <div className="mt-4 pt-4 border-t border-gray-100 animate-fade-in-down">
                                <div className="flex justify-around mb-4 text-center">
                                    <div><p className="text-xs text-gray-400">맞음</p><p className="font-bold text-green-600">{hw.completedCount}</p></div>
                                    <div><p className="text-xs text-gray-400">틀림</p><p className="font-bold text-red-600">{hw.incorrectCount}</p></div>
                                    <div><p className="text-xs text-gray-400">남음</p><p className="font-bold text-gray-600">{hw.uncheckedCount}</p></div>
                                </div>
                                {hw.incorrectQuestionList && hw.incorrectQuestionList.length > 0 ? (
                                    <div className="bg-red-50 p-3 rounded-xl">
                                        <p className="text-xs font-bold text-red-700 mb-2 flex items-center gap-1"><Icon name="alertCircle" className="w-3 h-3" /> 오답 노트</p>
                                        <div className="flex flex-wrap gap-2">{hw.incorrectQuestionList.map(q => (<span key={q} className="bg-white text-red-600 text-xs font-bold px-2 py-1 rounded border border-red-100 shadow-sm">{q}번</span>))}</div>
                                    </div>
                                ) : (<p className="text-center text-xs text-gray-400 mt-2">오답이 없습니다. 훌륭해요! 🎉</p>)}
                            </div>
                        )}
                    </div>
                )) : (<div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400"><Icon name="clipboardCheck" className="w-12 h-12 mb-2 opacity-50" /><p>등록된 과제가 없습니다.</p></div>)}
            </div>
        </div>
    );
};

// 4. 성적 탭 (반응형 Grid 적용)
export const GradesTab = ({ myGradeComparison }) => {
    const [mode, setMode] = useState('list'); 
    const [selectedTestId, setSelectedTestId] = useState(null); 
    const sortedGrades = [...myGradeComparison].sort((a, b) => new Date(a.testDate) - new Date(b.testDate));
    const toggleTestDetails = (id) => setSelectedTestId(selectedTestId === id ? null : id);

    return (
        <div className="space-y-4 animate-fade-in-up pb-20">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-bold text-gray-800">성적 리포트</h2>
                <div className="bg-white p-1 rounded-xl border border-gray-100 shadow-sm flex">
                    <button onClick={() => setMode('list')} className={`p-2 rounded-lg transition-all ${mode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}><Icon name="list" className="w-5 h-5" /></button>
                    <button onClick={() => setMode('analysis')} className={`p-2 rounded-lg transition-all ${mode === 'analysis' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}><Icon name="trend" className="w-5 h-5" /></button>
                </div>
            </div>
            {myGradeComparison.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400"><Icon name="barChart" className="w-12 h-12 mb-4 opacity-30 text-indigo-200" /><p className="font-medium text-sm">등록된 성적 데이터가 없습니다.</p></div>
            ) : mode === 'list' ? (
                // ✅ [수정] Grid 적용
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {myGradeComparison.map((item, idx) => (
                        <div key={idx} onClick={() => toggleTestDetails(item.testId)} className={`bg-white p-5 rounded-2xl shadow-md border border-gray-100 cursor-pointer transition-all hover:shadow-lg ${selectedTestId === item.testId ? 'ring-2 ring-indigo-500' : 'hover:border-indigo-100'}`}>
                            <div className="flex justify-between items-start mb-3">
                                <div><span className="text-xs text-gray-400 font-medium block mb-0.5">{item.testDate}</span><h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">{item.testName}<span className="text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{item.className}</span></h3></div>
                                <div className="text-right"><span className="text-2xl font-bold text-indigo-600">{item.studentScore}</span><span className="text-gray-400 text-xs"> / {item.maxScore}</span></div>
                            </div>
                            <div className="space-y-2 mb-3">
                                <div><div className="w-full bg-gray-100 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full relative" style={{ width: `${(item.studentScore / item.maxScore) * 100}%` }}></div></div><div className="flex justify-between text-[10px] mt-1 text-gray-400"><span>내 점수: {item.studentScore}</span><span>평균: {item.classAverage}</span></div><div className="w-full bg-gray-100 rounded-full h-1 mt-1"><div className="bg-gray-400 h-1 rounded-full opacity-50" style={{ width: `${(item.classAverage / item.maxScore) * 100}%` }}></div></div></div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-xl text-xs text-gray-600 mb-2">
                                {item.isAboveAverage ? (<p>🎉 평균보다 <span className="font-bold text-green-600">{item.scoreDifference}점</span> 높아요!</p>) : (<p>🔥 평균까지 <span className="font-bold text-indigo-600">{Math.abs(item.scoreDifference)}점</span>! 힘내요!</p>)}
                            </div>
                            {selectedTestId === item.testId && (
                                <div className="mt-4 pt-4 border-t border-gray-100 animate-fade-in-down">
                                    <h4 className="text-sm font-bold text-gray-700 mb-3">문항별 상세 분석</h4>
                                    <div className="grid grid-cols-5 gap-2 text-center text-[10px] font-bold text-gray-500 bg-gray-50 p-2 rounded-t-lg"><span>번호</span><span>결과</span><span>배점</span><span>유형</span><span>난이도</span></div>
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                        {item.questions.map((q, qIdx) => (
                                            <div key={qIdx} className="grid grid-cols-5 gap-2 text-center text-xs p-2 border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                                <span className="font-medium text-gray-600">{q.no}</span>
                                                <span className={`${q.status === '맞음' ? 'text-green-600' : q.status === '틀림' ? 'text-red-600' : 'text-yellow-600'}`}>{q.status === '맞음' ? 'O' : q.status === '틀림' ? 'X' : '△'}</span>
                                                <span className="text-gray-500">{q.score}</span><span className="text-gray-500">{q.type}</span><span className={`${q.difficulty === '상' ? 'text-red-500' : q.difficulty === '중' ? 'text-yellow-600' : 'text-green-500'}`}>{q.difficulty}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 max-w-4xl mx-auto">
                    {/* 그래프는 기존 유지 (화면 커지면 자연스럽게 늘어남) */}
                    <h3 className="text-lg font-bold text-gray-800 mb-6">성적 변화 추이</h3>
                    <div className="h-64 relative flex items-end justify-between px-2 gap-2">
                        <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none"><polyline points={sortedGrades.map((d, i) => "").join(' ')} fill="none" stroke="#4F46E5" strokeWidth="3" /></svg>
                        {sortedGrades.map((item, idx) => (
                            <div key={idx} className="flex-1 flex flex-col justify-end items-center group relative h-full">
                                <div className="mb-2 text-xs font-bold text-indigo-600">{item.studentScore}</div>
                                <div className="w-full max-w-[40px] bg-indigo-200 rounded-t-lg relative transition-all group-hover:bg-indigo-300" style={{ height: `${item.studentScore}%` }}><div className="absolute top-0 w-full h-1 bg-indigo-500 rounded-t-lg"></div></div>
                                <div className="mt-2 text-[10px] text-gray-400 rotate-45 origin-left translate-y-2 whitespace-nowrap overflow-visible">{item.testName.split(' ')[0]}</div>
                                <div className="absolute bottom-full mb-2 bg-gray-800 text-white text-xs p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-32 text-center">{item.testName}<br/><span className="text-gray-300">{item.testDate}</span></div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-8 pt-4 border-t border-gray-100"><div className="flex justify-between text-sm text-gray-600"><span>평균 점수</span><span className="font-bold text-indigo-600">{(sortedGrades.reduce((acc, cur) => acc + cur.studentScore, 0) / sortedGrades.length).toFixed(1)}점</span></div><div className="flex justify-between text-sm text-gray-600 mt-1"><span>최고 점수</span><span className="font-bold text-green-600">{Math.max(...sortedGrades.map(s => s.studentScore))}점</span></div></div>
                </div>
            )}
        </div>
    );
};

// 5. 메뉴 탭
export const MenuTab = ({ onLogout }) => (
    <div className="space-y-6 animate-fade-in-up max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-800">메뉴</h2>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button className="w-full p-4 flex items-center justify-between border-b border-gray-50 hover:bg-gray-50"><div className="flex items-center gap-3"><div className="bg-gray-100 p-2 rounded-lg"><Icon name="user" className="w-5 h-5 text-gray-600" /></div><span className="font-medium text-gray-700">내 정보 수정</span></div><Icon name="chevronRight" className="w-4 h-4 text-gray-400" /></button>
            <button className="w-full p-4 flex items-center justify-between border-b border-gray-50 hover:bg-gray-50"><div className="flex items-center gap-3"><div className="bg-gray-100 p-2 rounded-lg"><Icon name="bell" className="w-5 h-5 text-gray-600" /></div><span className="font-medium text-gray-700">알림 설정</span></div><Icon name="chevronRight" className="w-4 h-4 text-gray-400" /></button>
        </div>
        <button onClick={onLogout} className="w-full bg-red-50 text-red-600 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"><Icon name="logOut" className="w-5 h-5" />로그아웃</button>
    </div>
);