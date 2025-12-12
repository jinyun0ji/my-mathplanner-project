// src/components/StudentTabs.jsx
import React, { useState } from 'react';
import { createPortal } from 'react-dom'; // ✅ [추가] Portal 사용을 위해 import
import { Icon, getWeekOfMonthISO, calculateDurationMinutes, formatDuration } from '../utils/helpers';

// ----------------------------------------------------------------------
// 1. 대시보드 탭 (기존 유지)
// ----------------------------------------------------------------------
export const DashboardTab = ({ student, myClasses, setActiveTab, pendingHomeworkCount, setSelectedClassId }) => (
    <div className="space-y-6 animate-fade-in-up">
        {/* 상단 카드 */}
        <div className="bg-gradient-to-br from-brand-dark to-brand-main rounded-3xl p-6 md:p-8 text-white shadow-brand relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 bg-white/10 w-32 h-32 rounded-full blur-2xl group-hover:bg-white/20 transition-all"></div>
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-brand-light text-sm mb-1 font-semibold">오늘도 힘내세요! 💪</p>
                    <h2 className="text-3xl md:text-4xl font-extrabold">{student.name}님</h2>
                </div>
                <div className="bg-white/20 p-2 rounded-full backdrop-blur-md">
                    <Icon name="user" className="w-6 h-6 text-white" />
                </div>
            </div>
            
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-colors">
                    <p className="text-xs text-brand-light mb-1 font-medium">이번 달 출석률</p>
                    <div className="flex items-end gap-1">
                        <span className="text-2xl font-bold">95</span>
                        <span className="text-sm pb-1">%</span>
                    </div>
                </div>
                <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-colors cursor-pointer" onClick={() => setActiveTab('homework')}>
                    <p className="text-xs text-brand-light mb-1 font-medium">남은 과제</p>
                     <div className="flex items-end gap-1">
                        <span className="text-2xl font-bold">{pendingHomeworkCount}</span>
                        <span className="text-sm pb-1">개</span>
                    </div>
                </div>
            </div>
        </div>

        {/* 수강 강좌 리스트 */}
        <div>
            <h3 className="text-lg font-bold text-brand-black mb-4 px-1 flex items-center gap-2">
                <span className="w-1 h-6 bg-brand-main rounded-full"></span>
                수강 강좌
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myClasses.map(cls => (
                    <div 
                        key={cls.id} 
                        onClick={() => setSelectedClassId(cls.id)} 
                        className="bg-white p-5 rounded-2xl border border-brand-gray/30 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-brand hover:border-brand-main/30 hover:-translate-y-1 transition-all"
                    >
                        <div className="flex gap-4 items-center">
                            <div className="bg-brand-light/30 w-12 h-12 rounded-xl flex items-center justify-center text-brand-main font-bold text-lg shrink-0">
                                {cls.name.charAt(0)}
                            </div>
                            <div>
                                <h4 className="font-bold text-brand-black text-lg truncate pr-2">{cls.name}</h4>
                                <p className="text-xs text-brand-gray mt-1 flex items-center gap-1 font-medium">
                                    <Icon name="users" className="w-3 h-3" /> 채수용 선생님
                                </p>
                            </div>
                        </div>
                        <div className="text-brand-main bg-brand-light/20 p-2 rounded-full shrink-0">
                            <Icon name="chevronRight" className="w-5 h-5" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// ----------------------------------------------------------------------
// 2. 시간표 탭 (클리닉 연동 수정)
// ----------------------------------------------------------------------
export const ScheduleTab = ({ 
    myClasses, 
    externalSchedules, 
    attendanceLogs, 
    clinicLogs, 
    studentId, 
    onSaveExternalSchedule, 
    onDeleteExternalSchedule 
}) => {
    const [viewType, setViewType] = useState('weekly'); 
    const [selectedDate, setSelectedDate] = useState(new Date());
    
    // 모달 상태
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [newSchedule, setNewSchedule] = useState({
        academyName: '', courseName: '', instructor: '', startDate: '', endDate: '', days: [], startTime: '', endTime: ''
    });

    // 삭제 모달 상태
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [targetScheduleForDelete, setTargetScheduleForDelete] = useState(null);

    // 날짜 포맷 (로컬 기준 YYYY-MM-DD)
    const formatDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // 오늘 날짜 문자열
    const todayStr = formatDate(new Date());

    // --- 핸들러 ---
    const handleOpenAddModal = () => {
        setNewSchedule({ 
            academyName: '', courseName: '', instructor: '', 
            startDate: todayStr, endDate: '', days: [], startTime: '', endTime: '' 
        });
        setIsEditMode(false);
        setEditingId(null);
        setIsScheduleModalOpen(true);
    };

    const handleEditClick = (e, schedule) => {
        e.stopPropagation();
        setNewSchedule({
            academyName: schedule.academyName,
            courseName: schedule.courseName,
            instructor: schedule.instructor || '',
            startDate: schedule.startDate,
            endDate: schedule.endDate || '',
            days: schedule.days || [],
            startTime: schedule.startTime,
            endTime: schedule.endTime || ''
        });
        setIsEditMode(true);
        setEditingId(schedule.scheduleId);
        setIsScheduleModalOpen(true);
    };

    const handleSaveSubmit = () => {
        if (!newSchedule.academyName || !newSchedule.courseName || !newSchedule.startDate || newSchedule.days.length === 0 || !newSchedule.startTime) {
            alert('필수 정보를 모두 입력해주세요.');
            return;
        }
        onSaveExternalSchedule({
            id: isEditMode ? editingId : null,
            studentId,
            ...newSchedule,
            time: `${newSchedule.startTime}~${newSchedule.endTime || ''}`
        });
        setIsScheduleModalOpen(false);
    };

    const handleDeleteClick = (e, schedule) => {
        e.stopPropagation();
        setTargetScheduleForDelete(schedule);
        setIsDeleteModalOpen(true);
    };

    const executeDelete = (mode) => {
        if (!targetScheduleForDelete) return;
        const targetDate = formatDate(selectedDate);
        onDeleteExternalSchedule(targetScheduleForDelete.scheduleId, mode, targetDate);
        setIsDeleteModalOpen(false);
        setTargetScheduleForDelete(null);
    };

    const toggleDay = (day) => {
        setNewSchedule(prev => {
            const newDays = prev.days.includes(day) 
                ? prev.days.filter(d => d !== day) 
                : [...prev.days, day];
            const dayOrder = { '월':1, '화':2, '수':3, '목':4, '금':5, '토':6, '일':7 };
            newDays.sort((a, b) => dayOrder[a] - dayOrder[b]);
            return { ...prev, days: newDays };
        });
    };

    // --- 주간/월간 계산 로직 ---
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    const baseDate = new Date(selectedDate);
    const baseDay = baseDate.getDay();
    const sunday = new Date(baseDate);
    sunday.setDate(baseDate.getDate() - baseDay);
    const { month: weekMonth, week: weekNum } = getWeekOfMonthISO(sunday);

    const prevWeek = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 7); setSelectedDate(d); };
    const nextWeek = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 7); setSelectedDate(d); };

    // 월간 데이터 계산
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDayOfWeek = firstDayOfMonth.getDay();
    const calendarDays = Array(startDayOfWeek).fill(null).concat([...Array(daysInMonth).keys()].map(i => new Date(year, month, i + 1)));

    const prevMonth = () => setSelectedDate(new Date(year, month - 1, 1));
    const nextMonth = () => setSelectedDate(new Date(year, month + 1, 1));

    // --- 일정 렌더링 (리스트) ---
    const renderSchedules = () => {
        const dayOfWeek = weekDays[selectedDate.getDay()];
        const dateStr = formatDate(selectedDate);

        // 1. 수학 학원
        const dailyClasses = myClasses.filter(cls => cls.schedule.days.includes(dayOfWeek)).map(cls => ({
            id: `math-${cls.id}`, type: 'math', name: cls.name, teacher: '채수용', time: cls.schedule.time, scheduleId: cls.id
        }));

        // 2. 타학원
        const myExternal = externalSchedules ? externalSchedules.filter(s => {
            const isValidStudent = s.studentId === studentId;
            const isDayMatch = s.days && s.days.includes(dayOfWeek);
            const isDateInRange = selectedDate >= new Date(s.startDate) && (!s.endDate || selectedDate <= new Date(s.endDate));
            const isExcluded = s.excludedDates && s.excludedDates.includes(dateStr);
            return isValidStudent && isDayMatch && isDateInRange && !isExcluded;
        }) : [];
        const dailyExternal = myExternal.map(s => ({
            id: `ext-${s.id}`, type: 'external', name: s.academyName, teacher: s.courseName, time: `${s.startTime}~${s.endTime}`, scheduleId: s.id, ...s 
        }));

        // 3. 클리닉
        const myClinics = clinicLogs ? clinicLogs.filter(log => log.studentId === studentId && log.date === dateStr).map(log => ({
            id: `clinic-${log.id}`, type: 'clinic', name: '학습 클리닉', teacher: log.tutor || '담당 선생님', time: log.checkIn ? `${log.checkIn}~${log.checkOut || ''}` : '시간 미정', status: log.checkOut ? '완료' : '예약됨', scheduleId: log.id
        })) : [];

        const allSchedules = [...dailyClasses, ...dailyExternal, ...myClinics].sort((a, b) => (a.time.split('~')[0] || '00:00').localeCompare(b.time.split('~')[0] || '00:00'));

        if (allSchedules.length === 0) {
            return (
                <div className="text-center py-20 text-brand-gray bg-white rounded-2xl border border-dashed border-brand-gray/50">
                    <p className="font-bold text-brand-gray mb-1">{selectedDate.getMonth()+1}월 {selectedDate.getDate()}일 ({dayOfWeek})</p>
                    일정이 없습니다.
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {allSchedules.map((item) => {
                    let log = null;
                    let borderColor = 'border-brand-main/30';
                    let dotColor = 'bg-brand-main';
                    let typeLabel = '수학 학원';
                    let typeClass = 'text-brand-main bg-brand-light/30';

                    if (item.type === 'math') {
                        log = attendanceLogs ? attendanceLogs.find(l => l.studentId === studentId && l.classId === item.scheduleId && l.date === dateStr) : null;
                        if(log?.status === '출석') dotColor = 'bg-green-500';
                        else if(log?.status === '지각') dotColor = 'bg-yellow-400';
                        else if(log?.status === '결석') dotColor = 'bg-brand-red';
                    } else if (item.type === 'external') {
                        borderColor = 'border-brand-light';
                        dotColor = 'bg-brand-light';
                        typeLabel = item.teacher;
                        typeClass = 'text-brand-gray bg-brand-bg';
                    } else if (item.type === 'clinic') {
                        borderColor = 'border-teal-200';
                        dotColor = item.status === '완료' ? 'bg-teal-500' : 'bg-teal-300';
                        typeLabel = '클리닉';
                        typeClass = 'text-teal-600 bg-teal-50';
                    }
                    
                    return (
                        <div key={item.id} className={`relative pl-6 border-l-2 py-2 ml-2 ${borderColor}`}>
                            <div className={`absolute -left-[9px] top-3 w-4 h-4 rounded-full ring-4 ring-white ${dotColor}`}></div>
                            
                            <div 
                                onClick={(e) => item.type === 'external' ? handleEditClick(e, item) : null}
                                className={`bg-white p-5 rounded-2xl shadow-sm border border-brand-gray/30 relative group h-full flex flex-col justify-between transition-all hover:shadow-md ${item.type === 'external' ? 'cursor-pointer hover:border-brand-main/50' : ''}`}
                            >
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${typeClass}`}>{typeLabel}</span>
                                        <span className="text-xs text-brand-gray font-medium">{item.time}</span>
                                    </div>
                                    <h4 className="font-bold text-brand-black text-lg mb-2">{item.name}</h4>
                                </div>
                                <div className="flex justify-between items-end">
                                    {item.type === 'math' ? (
                                        <>
                                            <p className="text-sm text-brand-gray flex items-center gap-1"><Icon name="users" className="w-4 h-4" /> 채수용 선생님</p>
                                            {log && (<span className={`text-xs font-bold px-2 py-1 rounded ${log.status === '출석' ? 'bg-green-100 text-green-700' : log.status === '지각' ? 'bg-yellow-100 text-yellow-700' : 'bg-brand-red/10 text-brand-red'}`}>{log.status}</span>)}
                                        </>
                                    ) : item.type === 'clinic' ? (
                                        <>
                                            <p className="text-sm text-brand-gray flex items-center gap-1"><Icon name="user" className="w-4 h-4" /> {item.teacher}</p>
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${item.status === '완료' ? 'bg-teal-100 text-teal-700' : 'bg-teal-50 text-teal-600 border border-teal-200'}`}>
                                                {item.status}
                                            </span>
                                        </>
                                    ) : (
                                        <div className="w-full flex justify-end gap-3">
                                            <span className="text-xs text-brand-main opacity-0 group-hover:opacity-100 transition-opacity">클릭하여 수정</span>
                                            <button 
                                                onClick={(e) => handleDeleteClick(e, item)} 
                                                className="text-xs text-brand-gray hover:text-brand-red underline"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // --- 달력 헬퍼 ---
    const getDayInfo = (date) => {
        if (!date) return { hasClass: false, status: null, hasExternal: false, hasClinic: false };
        const dateStr = formatDate(date);
        const dayOfWeek = weekDays[date.getDay()];
        
        const dayClasses = myClasses.filter(cls => cls.schedule.days.includes(dayOfWeek));
        
        const myExternal = externalSchedules ? externalSchedules.filter(s => {
            const isValidStudent = s.studentId === studentId;
            const isDayMatch = s.days && s.days.includes(dayOfWeek);
            const isDateInRange = date >= new Date(s.startDate) && (!s.endDate || date <= new Date(s.endDate));
            const isExcluded = s.excludedDates && s.excludedDates.includes(dateStr);
            return isValidStudent && isDayMatch && isDateInRange && !isExcluded;
        }) : [];

        const myClinics = clinicLogs ? clinicLogs.filter(log => log.studentId === studentId && log.date === dateStr) : [];

        const logs = attendanceLogs ? attendanceLogs.filter(log => log.studentId === studentId && log.date === dateStr) : [];
        let status = null;
        if (logs.length > 0) {
            if (logs.some(l => l.status === '결석')) status = '결석';
            else if (logs.some(l => l.status === '지각')) status = '지각';
            else status = '출석';
        }
        return { hasClass: (dayClasses.length > 0), status, hasExternal: myExternal.length > 0, hasClinic: myClinics.length > 0 };
    };

    const WeeklyView = () => {
        return (
            <div className="space-y-6 animate-fade-in-up">
                <div className="flex items-center justify-between px-2 mb-2">
                    <button onClick={prevWeek} className="p-2 bg-white rounded-full shadow-sm text-brand-gray hover:text-brand-main hover:bg-brand-bg"><Icon name="arrow-left" className="w-5 h-5" /></button>
                    <span className="font-bold text-brand-black text-lg">{weekMonth}월 {weekNum}주차</span>
                    <button onClick={nextWeek} className="p-2 bg-white rounded-full shadow-sm text-brand-gray hover:text-brand-main hover:bg-brand-bg transform rotate-180"><Icon name="arrow-left" className="w-5 h-5" /></button>
                </div>
                {/* ✅ 주간 달력 - 일정 점 표시 추가 */}
                <div className="flex justify-between bg-white p-1.5 rounded-2xl shadow-sm border border-brand-gray/30 overflow-x-auto">
                    {weekDays.map((day, index) => {
                        const date = new Date(sunday);
                        date.setDate(sunday.getDate() + index);
                        const isSelected = formatDate(date) === formatDate(selectedDate);
                        const isToday = formatDate(date) === todayStr;
                        
                        // 날짜별 일정 정보 조회
                        const { hasClass, status, hasExternal, hasClinic } = getDayInfo(date);

                        return (
                            <button 
                                key={day} 
                                onClick={() => setSelectedDate(date)} 
                                className={`flex flex-col items-center p-1 rounded-xl flex-1 transition-all min-w-[32px] relative ${isSelected ? 'bg-brand-main text-white shadow-brand scale-105' : 'hover:bg-brand-bg'} ${!isSelected && isToday ? 'text-brand-main font-bold' : ''} ${!isSelected && !isToday ? 'text-brand-gray' : ''}`}
                            >
                                <span className="text-[10px] mb-0.5">{day}</span>
                                <span className={`font-bold ${isSelected ? 'text-base' : 'text-sm'}`}>{date.getDate()}</span>
                                
                                {/* ✅ 일정 점(Dot) 표시 */}
                                <div className="flex gap-0.5 mt-1 h-1.5 items-center">
                                    {/* 수업: 출결 상태에 따른 색상 */}
                                    {(hasClass || status) && (
                                        <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : (status === '출석' ? 'bg-green-500' : status === '지각' ? 'bg-yellow-400' : status === '결석' ? 'bg-brand-red' : 'bg-brand-gray')}`}></div>
                                    )}
                                    {/* 타학원 */}
                                    {hasExternal && (
                                        <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-brand-light'}`}></div>
                                    )}
                                    {/* 클리닉 */}
                                    {hasClinic && (
                                        <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-teal-400'}`}></div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="space-y-4">{renderSchedules()}</div>
            </div>
        );
    };

    const MonthlyView = () => {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const startEmptyDays = firstDay.getDay();
        const lastDay = new Date(year, month + 1, 0).getDate();
        const calendarDays = Array(startEmptyDays).fill(null).concat([...Array(lastDay).keys()].map(i => new Date(year, month, i + 1)));

        const prevMonth = () => setSelectedDate(new Date(year, month - 1, 1));
        const nextMonth = () => setSelectedDate(new Date(year, month + 1, 1));

        return (
            <div className="animate-fade-in-up">
                <div className="bg-white rounded-3xl shadow-lg p-6 border border-brand-gray/30 mb-6 max-w-2xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <button onClick={prevMonth} className="p-2 hover:bg-brand-bg rounded-full text-brand-gray"><Icon name="arrow-left" className="w-5 h-5" /></button>
                        <h3 className="text-lg font-bold text-brand-black">{year}년 {month + 1}월</h3>
                        <button onClick={nextMonth} className="p-2 hover:bg-brand-bg rounded-full text-brand-gray transform rotate-180"><Icon name="arrow-left" className="w-5 h-5" /></button>
                    </div>
                    <div className="grid grid-cols-7 mb-2 text-center">
                        {weekDays.map((day, i) => (<div key={day} className={`text-xs font-bold ${i === 0 ? 'text-brand-red' : 'text-brand-gray'}`}>{day}</div>))}
                    </div>
                    <div className="grid grid-cols-7 gap-y-4 gap-x-1">
                        {calendarDays.map((date, index) => {
                            if (!date) return <div key={index}></div>;
                            const { hasClass, status, hasExternal, hasClinic } = getDayInfo(date);
                            const isSelected = formatDate(date) === formatDate(selectedDate);
                            const isToday = formatDate(date) === todayStr;
                            return (
                                <div key={index} className="flex flex-col items-center cursor-pointer group" onClick={() => setSelectedDate(date)}>
                                    <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all ${isSelected ? 'bg-brand-main text-white shadow-brand scale-110' : ''} ${!isSelected && isToday ? 'text-brand-main font-bold bg-brand-light/30' : ''} ${!isSelected && !isToday ? 'text-brand-black group-hover:bg-brand-bg' : ''}`}>{date.getDate()}</div>
                                    <div className="h-1.5 mt-1 flex gap-0.5 min-h-[6px]">
                                        {status === '출석' && <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>}
                                        {status === '지각' && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>}
                                        {status === '결석' && <div className="w-1.5 h-1.5 rounded-full bg-brand-red"></div>}
                                        {!status && hasClass && <div className="w-1.5 h-1.5 rounded-full bg-brand-gray"></div>}
                                        {hasExternal && <div className="w-1.5 h-1.5 rounded-full bg-brand-light"></div>}
                                        {hasClinic && <div className="w-1.5 h-1.5 rounded-full bg-teal-400"></div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="space-y-4">{renderSchedules()}</div>
            </div>
        );
    };

    return (
        <div className="pb-20 relative">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-brand-black">나의 일정</h2>
                <div className="flex gap-2">
                    <button onClick={handleOpenAddModal} className="bg-brand-main hover:bg-brand-dark text-white px-3 py-0 h-[32px] rounded-xl text-xs font-bold flex items-center gap-1 shadow-md transition-all active:scale-95"><Icon name="plus" className="w-4 h-4" /> 일정 추가</button>
                    <div className="bg-white p-1 rounded-xl border border-brand-gray/30 shadow-sm flex h-[32px] items-center">
                        <button onClick={() => setViewType('weekly')} className={`px-3 py-0 h-full flex items-center rounded-lg text-xs font-bold transition-all ${viewType === 'weekly' ? 'bg-brand-main text-white shadow-md' : 'text-brand-gray hover:text-brand-black'}`}>주간</button>
                        <button onClick={() => { setViewType('monthly'); setSelectedDate(new Date()); }} className={`px-3 py-0 h-full flex items-center rounded-lg text-xs font-bold transition-all ${viewType === 'monthly' ? 'bg-brand-main text-white shadow-md' : 'text-brand-gray hover:text-brand-black'}`}>월간</button>
                    </div>
                </div>
            </div>

            {viewType === 'weekly' ? <WeeklyView /> : <MonthlyView />}
            
            {/* 일정 등록/수정 모달 */}
            {isScheduleModalOpen && createPortal(
                <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsScheduleModalOpen(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-brand-black mb-4">타학원 일정 {isEditMode ? '수정' : '등록'}</h3>
                        <div className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar px-1">
                            <div><label className="block text-xs font-bold text-brand-gray mb-1">학원명 *</label><input type="text" value={newSchedule.academyName} onChange={e => setNewSchedule({...newSchedule, academyName: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none" placeholder="예: 정상어학원"/></div>
                            <div><label className="block text-xs font-bold text-brand-gray mb-1">강의명 *</label><input type="text" value={newSchedule.courseName} onChange={e => setNewSchedule({...newSchedule, courseName: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none" placeholder="예: TOP반 영어"/></div>
                            <div><label className="block text-xs font-bold text-brand-gray mb-1">강사</label><input type="text" value={newSchedule.instructor} onChange={e => setNewSchedule({...newSchedule, instructor: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none" placeholder="예: Julie 선생님"/></div>
                            <div className="flex gap-2"><div className="flex-1"><label className="block text-xs font-bold text-brand-gray mb-1">개강일 *</label><input type="date" value={newSchedule.startDate} onChange={e => setNewSchedule({...newSchedule, startDate: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none"/></div><div className="flex-1"><label className="block text-xs font-bold text-brand-gray mb-1">종강일</label><input type="date" value={newSchedule.endDate} onChange={e => setNewSchedule({...newSchedule, endDate: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none"/></div></div>
                            <div>
                                <label className="block text-xs font-bold text-brand-gray mb-1">수업 요일 *</label>
                                <div className="flex gap-1 justify-between">
                                    {['월','화','수','목','금','토','일'].map(d => (
                                        <button key={d} onClick={() => toggleDay(d)} className={`w-8 h-8 rounded-full text-xs font-bold transition-colors ${newSchedule.days.includes(d) ? 'bg-brand-main text-white' : 'bg-brand-bg text-brand-gray hover:bg-brand-gray/30'}`}>{d}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2"><div className="flex-1"><label className="block text-xs font-bold text-brand-gray mb-1">시작 시간 *</label><input type="time" value={newSchedule.startTime} onChange={e => setNewSchedule({...newSchedule, startTime: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none"/></div><div className="flex-1"><label className="block text-xs font-bold text-brand-gray mb-1">종료 시간</label><input type="time" value={newSchedule.endTime} onChange={e => setNewSchedule({...newSchedule, endTime: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none"/></div></div>
                            <button onClick={handleSaveSubmit} className="w-full bg-brand-main hover:bg-brand-dark text-white font-bold py-3 rounded-xl mt-2 transition-colors">
                                {isEditMode ? '수정 완료' : '등록하기'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* 삭제 옵션 모달 */}
            {isDeleteModalOpen && createPortal(
                <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-xs p-6 shadow-2xl animate-fade-in-up text-center" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-12 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-red">
                            <Icon name="trash" className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-brand-black mb-2">반복 일정 삭제</h3>
                        <p className="text-sm text-brand-gray mb-6">
                            이 일정을 어떻게 삭제하시겠습니까?
                        </p>
                        <div className="space-y-2">
                            <button 
                                onClick={() => executeDelete('instance')} 
                                className="w-full bg-white border border-brand-gray/30 text-brand-black hover:bg-brand-bg font-bold py-3 rounded-xl text-sm transition-colors"
                            >
                                이 일정만 삭제
                            </button>
                            <button 
                                onClick={() => executeDelete('future')} 
                                className="w-full bg-white border border-brand-gray/30 text-brand-black hover:bg-brand-bg font-bold py-3 rounded-xl text-sm transition-colors"
                            >
                                이 일정 및 향후 일정 삭제
                            </button>
                            <button 
                                onClick={() => executeDelete('all')} 
                                className="w-full bg-brand-red text-white hover:bg-red-600 font-bold py-3 rounded-xl text-sm transition-colors"
                            >
                                전체 삭제
                            </button>
                        </div>
                        <button 
                            onClick={() => setIsDeleteModalOpen(false)} 
                            className="mt-4 text-xs text-brand-gray hover:text-brand-black underline"
                        >
                            취소
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

// ... (HomeworkTab, GradesTab, MenuTab는 기존과 동일하게 유지 - 코드 중복 방지를 위해 생략) ...
export const HomeworkTab = ({ myHomeworkStats }) => {
    // (이전 코드와 동일)
    const [selectedHwId, setSelectedHwId] = useState(null); 
    const toggleDetails = (id) => setSelectedHwId(selectedHwId === id ? null : id);

    return (
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-brand-black">과제함</h2>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <button className="px-4 py-2 bg-brand-main text-white rounded-full text-sm font-bold whitespace-nowrap shadow-md">전체</button>
                <button className="px-4 py-2 bg-white text-brand-gray border border-brand-gray/30 rounded-full text-sm font-medium whitespace-nowrap hover:bg-brand-bg">진행 중</button>
                <button className="px-4 py-2 bg-white text-brand-gray border border-brand-gray/30 rounded-full text-sm font-medium whitespace-nowrap hover:bg-brand-bg">완료됨</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {myHomeworkStats.length > 0 ? myHomeworkStats.map(hw => (
                    <div key={hw.id} onClick={() => toggleDetails(hw.id)} className={`bg-white p-5 rounded-2xl shadow-sm border border-brand-gray/30 transition-all cursor-pointer hover:shadow-lg ${selectedHwId === hw.id ? 'ring-2 ring-brand-main' : 'hover:border-brand-main/30'}`}>
                        <div className="flex justify-between items-start mb-3">
                            <span className={`text-xs font-bold px-2 py-1 rounded ${hw.status === '완료' ? 'bg-green-100 text-green-700' : hw.status === '미시작' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{hw.status}</span>
                            <span className="text-xs text-brand-gray">{hw.date} 마감</span>
                        </div>
                        <h4 className="font-bold text-brand-black mb-1 truncate">{hw.content}</h4>
                        <p className="text-sm text-brand-gray mb-4 truncate">{hw.book} (총 {hw.totalQuestions}문제)</p>
                        <div className="w-full bg-brand-bg rounded-full h-2 mb-2"><div className="bg-brand-main h-2 rounded-full transition-all duration-500" style={{ width: `${hw.completionRate}%` }}></div></div>
                        <div className="flex justify-between text-xs text-brand-gray"><span>진행률 {hw.completionRate}%</span><span>{hw.completedCount} / {hw.totalQuestions} 완료</span></div>
                        
                        {selectedHwId === hw.id && (
                            <div className="mt-4 pt-4 border-t border-brand-gray/20 animate-fade-in-down">
                                <div className="flex justify-around mb-4 text-center">
                                    <div><p className="text-xs text-brand-gray">맞음</p><p className="font-bold text-green-600">{hw.completedCount}</p></div>
                                    <div><p className="text-xs text-brand-gray">틀림</p><p className="font-bold text-brand-red">{hw.incorrectCount}</p></div>
                                    <div><p className="text-xs text-brand-gray">남음</p><p className="font-bold text-brand-black">{hw.uncheckedCount}</p></div>
                                </div>
                                {hw.incorrectQuestionList && hw.incorrectQuestionList.length > 0 ? (
                                    <div className="bg-brand-red/10 p-3 rounded-xl">
                                        <p className="text-xs font-bold text-brand-red mb-2 flex items-center gap-1"><Icon name="alertCircle" className="w-3 h-3" /> 오답 노트</p>
                                        <div className="flex flex-wrap gap-2">{hw.incorrectQuestionList.map(q => (<span key={q} className="bg-white text-brand-red text-xs font-bold px-2 py-1 rounded border border-brand-red/20 shadow-sm">{q}번</span>))}</div>
                                    </div>
                                ) : (<p className="text-center text-xs text-brand-gray mt-2">오답이 없습니다. 훌륭해요! 🎉</p>)}
                            </div>
                        )}
                    </div>
                )) : (<div className="col-span-full flex flex-col items-center justify-center py-20 text-brand-gray"><Icon name="clipboardCheck" className="w-12 h-12 mb-2 opacity-50" /><p>등록된 과제가 없습니다.</p></div>)}
            </div>
        </div>
    );
};

export const GradesTab = ({ myGradeComparison }) => {
    const [mode, setMode] = useState('list'); 
    const [selectedTestId, setSelectedTestId] = useState(null); 
    const sortedGrades = [...myGradeComparison].sort((a, b) => new Date(a.testDate) - new Date(b.testDate));
    const toggleTestDetails = (id) => setSelectedTestId(selectedTestId === id ? null : id);

    return (
        <div className="space-y-4 animate-fade-in-up pb-20">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-bold text-brand-black">성적 리포트</h2>
                <div className="bg-white p-1 rounded-xl border border-brand-gray/30 shadow-sm flex">
                    <button onClick={() => setMode('list')} className={`p-2 rounded-lg transition-all ${mode === 'list' ? 'bg-brand-main text-white shadow-md' : 'text-brand-gray hover:text-brand-black'}`}><Icon name="list" className="w-5 h-5" /></button>
                    <button onClick={() => setMode('analysis')} className={`p-2 rounded-lg transition-all ${mode === 'analysis' ? 'bg-brand-main text-white shadow-md' : 'text-brand-gray hover:text-brand-black'}`}><Icon name="trend" className="w-5 h-5" /></button>
                </div>
            </div>
            {myGradeComparison.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-brand-gray"><Icon name="barChart" className="w-12 h-12 mb-4 opacity-30 text-brand-light" /><p className="font-medium text-sm">등록된 성적 데이터가 없습니다.</p></div>
            ) : mode === 'list' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {myGradeComparison.map((item, idx) => (
                        <div key={idx} onClick={() => toggleTestDetails(item.testId)} className={`bg-white p-5 rounded-2xl shadow-md border border-brand-gray/30 cursor-pointer transition-all hover:shadow-lg ${selectedTestId === item.testId ? 'ring-2 ring-brand-main' : 'hover:border-brand-main/30'}`}>
                            <div className="flex justify-between items-start mb-3">
                                <div><span className="text-xs text-brand-gray font-medium block mb-0.5">{item.testDate}</span><h3 className="text-lg font-bold text-brand-black flex items-center gap-2">{item.testName}<span className="text-[10px] text-brand-main bg-brand-light/30 px-1.5 py-0.5 rounded border border-brand-light">{item.className}</span></h3></div>
                                <div className="text-right"><span className="text-2xl font-bold text-brand-main">{item.studentScore}</span><span className="text-brand-gray text-xs"> / {item.maxScore}</span></div>
                            </div>
                            <div className="space-y-2 mb-3">
                                <div><div className="w-full bg-brand-bg rounded-full h-2"><div className="bg-brand-main h-2 rounded-full relative" style={{ width: `${(item.studentScore / item.maxScore) * 100}%` }}></div></div><div className="flex justify-between text-[10px] mt-1 text-brand-gray"><span>내 점수: {item.studentScore}</span><span>평균: {item.classAverage}</span></div><div className="w-full bg-brand-bg rounded-full h-1 mt-1"><div className="bg-brand-gray h-1 rounded-full opacity-50" style={{ width: `${(item.classAverage / item.maxScore) * 100}%` }}></div></div></div>
                            </div>
                            <div className="bg-brand-bg p-3 rounded-xl text-xs text-brand-black mb-2">
                                {item.isAboveAverage ? (<p>🎉 평균보다 <span className="font-bold text-green-600">{item.scoreDifference}점</span> 높아요!</p>) : (<p>🔥 평균까지 <span className="font-bold text-brand-main">{Math.abs(item.scoreDifference)}점</span>! 힘내요!</p>)}
                            </div>
                            {selectedTestId === item.testId && (
                                <div className="mt-4 pt-4 border-t border-brand-gray/20 animate-fade-in-down">
                                    <h4 className="text-sm font-bold text-brand-black mb-3">문항별 상세 분석</h4>
                                    <div className="grid grid-cols-5 gap-2 text-center text-[10px] font-bold text-brand-gray bg-brand-bg p-2 rounded-t-lg"><span>번호</span><span>결과</span><span>배점</span><span>유형</span><span>난이도</span></div>
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                        {item.questions.map((q, qIdx) => (
                                            <div key={qIdx} className="grid grid-cols-5 gap-2 text-center text-xs p-2 border-b border-brand-gray/20 last:border-0 hover:bg-brand-bg">
                                                <span className="font-medium text-brand-black">{q.no}</span>
                                                <span className={`${q.status === '맞음' ? 'text-green-600' : q.status === '틀림' ? 'text-brand-red' : 'text-yellow-600'}`}>{q.status === '맞음' ? 'O' : q.status === '틀림' ? 'X' : '△'}</span>
                                                <span className="text-brand-gray">{q.score}</span><span className="text-brand-gray">{q.type}</span><span className={`${q.difficulty === '상' ? 'text-brand-red' : q.difficulty === '중' ? 'text-yellow-600' : 'text-green-500'}`}>{q.difficulty}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white p-6 rounded-3xl shadow-lg border border-brand-gray/30 max-w-4xl mx-auto">
                    <h3 className="text-lg font-bold text-brand-black mb-6">성적 변화 추이</h3>
                    <div className="h-64 relative flex items-end justify-between px-2 gap-2">
                        <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none"><polyline points={sortedGrades.map((d, i) => "").join(' ')} fill="none" stroke="#475FE9" strokeWidth="3" /></svg>
                        {sortedGrades.map((item, idx) => (
                            <div key={idx} className="flex-1 flex flex-col justify-end items-center group relative h-full">
                                <div className="mb-2 text-xs font-bold text-brand-main">{item.studentScore}</div>
                                <div className="w-full max-w-[40px] bg-brand-light/30 rounded-t-lg relative transition-all group-hover:bg-brand-light" style={{ height: `${item.studentScore}%` }}><div className="absolute top-0 w-full h-1 bg-brand-main rounded-t-lg"></div></div>
                                <div className="mt-2 text-[10px] text-brand-gray rotate-45 origin-left translate-y-2 whitespace-nowrap overflow-visible">{item.testName.split(' ')[0]}</div>
                                <div className="absolute bottom-full mb-2 bg-brand-dark text-white text-xs p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-32 text-center">{item.testName}<br/><span className="text-brand-gray">{item.testDate}</span></div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-8 pt-4 border-t border-brand-gray/20"><div className="flex justify-between text-sm text-brand-gray"><span>평균 점수</span><span className="font-bold text-brand-main">{(sortedGrades.reduce((acc, cur) => acc + cur.studentScore, 0) / sortedGrades.length).toFixed(1)}점</span></div><div className="flex justify-between text-sm text-brand-gray mt-1"><span>최고 점수</span><span className="font-bold text-green-600">{Math.max(...sortedGrades.map(s => s.studentScore))}점</span></div></div>
                </div>
            )}
        </div>
    );
};
export const MenuTab = ({ onLogout }) => (
    <div className="space-y-6 animate-fade-in-up max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-brand-black">메뉴</h2>
        <div className="bg-white rounded-2xl shadow-sm border border-brand-gray/30 overflow-hidden">
            <button className="w-full p-4 flex items-center justify-between border-b border-brand-bg hover:bg-brand-bg"><div className="flex items-center gap-3"><div className="bg-brand-bg p-2 rounded-lg"><Icon name="user" className="w-5 h-5 text-brand-gray" /></div><span className="font-medium text-brand-black">내 정보 수정</span></div><Icon name="chevronRight" className="w-4 h-4 text-brand-gray" /></button>
            <button className="w-full p-4 flex items-center justify-between border-b border-brand-bg hover:bg-brand-bg"><div className="flex items-center gap-3"><div className="bg-brand-bg p-2 rounded-lg"><Icon name="bell" className="w-5 h-5 text-brand-gray" /></div><span className="font-medium text-brand-black">알림 설정</span></div><Icon name="chevronRight" className="w-4 h-4 text-brand-gray" /></button>
        </div>
        <button onClick={onLogout} className="w-full bg-brand-red/10 text-brand-red p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-brand-red/20 transition-colors"><Icon name="logOut" className="w-5 h-5" />로그아웃</button>
    </div>
);

// 6. 게시판 탭 (수정됨)
export const BoardTab = ({ notices }) => {
    const [selectedNotice, setSelectedNotice] = useState(null);

    const pinnedNotices = notices.filter(n => n.isPinned);
    const allNotices = [...notices].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className="space-y-6 animate-fade-in-up pb-20">
            <div className="flex justify-between items-end px-1">
                <h2 className="text-2xl font-bold text-brand-black">게시판</h2>
                <span className="text-xs text-brand-gray mb-1">총 {allNotices.length}개의 글</span>
            </div>

            {/* 1. 상단 필독 게시글 */}
            {pinnedNotices.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-brand-red flex items-center gap-1 px-1">
                        <Icon name="pin" className="w-4 h-4" /> 중요 공지
                    </h3>
                    
                    <div className="flex overflow-x-auto gap-4 pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
                        {pinnedNotices.map((notice) => (
                            <div 
                                key={notice.id}
                                onClick={() => setSelectedNotice(notice)}
                                className="snap-center shrink-0 w-[85%] md:w-[320px] bg-brand-light/20 border border-brand-light/50 p-5 rounded-2xl shadow-sm hover:shadow-md flex flex-col justify-between h-40 cursor-pointer transition-transform active:scale-[0.98]"
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="bg-brand-red text-white text-xs px-2 py-0.5 rounded font-bold shadow-sm flex items-center gap-1">
                                            <Icon name="alert" className="w-3 h-3" /> 필독
                                        </span>
                                        <span className="text-xs text-brand-dark/70 font-medium">{notice.date}</span>
                                    </div>
                                    <h4 className="font-bold text-lg text-brand-dark leading-tight line-clamp-2 mt-2">{notice.title}</h4>
                                </div>
                                <div className="flex justify-between items-end">
                                    <span className="text-xs text-brand-dark/70 font-bold bg-white/50 px-2 py-1 rounded">
                                        작성자: {notice.author}
                                    </span>
                                    <div className="bg-white/50 p-1.5 rounded-full text-brand-main">
                                        <Icon name="chevronRight" className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 2. 전체 게시글 (리스트) */}
            <div className="space-y-3">
                <h3 className="text-sm font-bold text-brand-black px-1">전체 글</h3>
                <div className="space-y-3">
                    {allNotices.length > 0 ? allNotices.map((notice) => (
                        <div 
                            key={notice.id} 
                            onClick={() => setSelectedNotice(notice)}
                            className="bg-white p-4 rounded-2xl border border-brand-gray/20 shadow-sm flex justify-between items-center cursor-pointer hover:bg-brand-bg transition-colors active:scale-[0.99]"
                        >
                            <div className="flex-1 min-w-0 pr-4">
                                <div className="flex items-center gap-2 mb-1">
                                    {notice.isPinned && <Icon name="pin" className="w-3 h-3 text-brand-red shrink-0" />}
                                    <h4 className={`text-sm font-bold truncate ${notice.isPinned ? 'text-brand-black' : 'text-brand-black'}`}>
                                        {notice.title}
                                    </h4>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-brand-gray">
                                    <span>{notice.author}</span>
                                    <span className="w-0.5 h-2 bg-brand-gray/30"></span>
                                    <span>{notice.date}</span>
                                </div>
                            </div>
                            <Icon name="chevronRight" className="w-4 h-4 text-brand-gray/50 shrink-0" />
                        </div>
                    )) : (
                        <div className="text-center py-10 text-brand-gray bg-white rounded-2xl border border-dashed border-brand-gray/30">
                            등록된 게시글이 없습니다.
                        </div>
                    )}
                </div>
            </div>

            {/* 3. 게시글 상세 모달 - Portal 사용 */}
            {selectedNotice && createPortal(
                <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedNotice(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-fade-in-up max-h-[80vh] overflow-y-auto custom-scrollbar relative" onClick={e => e.stopPropagation()}>
                        <button 
                            onClick={() => setSelectedNotice(null)}
                            className="absolute top-4 right-4 p-2 text-brand-gray hover:text-brand-black rounded-full hover:bg-brand-bg"
                        >
                            <Icon name="x" className="w-6 h-6" />
                        </button>

                        <div className="mb-4 pr-8">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold text-white bg-brand-main px-2 py-1 rounded-full">
                                    {selectedNotice.author}
                                </span>
                                <span className="text-xs text-brand-gray">
                                    {selectedNotice.date}
                                </span>
                            </div>
                            <h3 className="text-xl font-bold text-brand-black leading-tight">
                                {selectedNotice.title}
                            </h3>
                        </div>

                        <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed border-t border-brand-gray/20 pt-4 min-h-[100px]">
                            <div dangerouslySetInnerHTML={{ __html: selectedNotice.content }} />
                        </div>

                        {selectedNotice.attachments && selectedNotice.attachments.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-brand-gray/20">
                                <p className="text-xs font-bold text-brand-gray mb-2">첨부파일</p>
                                <div className="flex flex-wrap gap-2">
                                    {selectedNotice.attachments.map((file, idx) => (
                                        <button key={idx} className="flex items-center gap-2 bg-brand-bg px-3 py-2 rounded-lg text-sm text-brand-main hover:bg-brand-main/10 transition-colors">
                                            <Icon name="fileText" className="w-4 h-4" />
                                            {file}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>,
                document.body // ✅ document.body에 직접 렌더링
            )}
        </div>
    );
};

// 7. [신규] 클리닉 탭
export const ClinicTab = ({ studentId, clinicLogs = [] }) => { // ✅ [수정] 기본값 = [] 추가
    // 1. 내 클리닉 필터링 (이제 clinicLogs가 없어도 빈 배열이므로 에러 안 남)
    const myClinics = clinicLogs.filter(log => log.studentId === studentId);
    
    // 2. 예약된 일정 (미래) & 완료된 기록 (과거) 분류
    const now = new Date();
    const upcoming = myClinics.filter(log => new Date(log.date + 'T' + log.checkIn) >= now || !log.checkOut).sort((a, b) => new Date(a.date) - new Date(b.date));
    const history = myClinics.filter(log => log.checkOut && new Date(log.date + 'T' + log.checkIn) < now).sort((a, b) => new Date(b.date) - new Date(a.date));

    // 3. 통계 계산 (총 공부 시간 vs 평균)
    const myTotalMinutes = history.reduce((acc, log) => acc + calculateDurationMinutes(log.checkIn, log.checkOut), 0);
    
    // (모의) 반 평균 계산
    const allTotalMinutes = clinicLogs.reduce((acc, log) => log.checkOut ? acc + calculateDurationMinutes(log.checkIn, log.checkOut) : acc, 0);
    const avgMinutes = clinicLogs.length > 0 ? Math.round(allTotalMinutes / 3) : 0; 

    // 비율 계산
    const maxVal = Math.max(myTotalMinutes, avgMinutes, 60); 
    const myPercent = Math.min((myTotalMinutes / maxVal) * 100, 100);
    const avgPercent = Math.min((avgMinutes / maxVal) * 100, 100);

    return (
        <div className="space-y-6 animate-fade-in-up pb-20">
            <h2 className="text-2xl font-bold text-brand-black px-1">학습 클리닉</h2>

            {/* 1. 학습 시간 분석 카드 */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-brand-gray/30">
                <h3 className="text-lg font-bold text-brand-black mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-teal-500 rounded-full"></span>
                    이번 달 학습 시간
                </h3>
                
                <div className="space-y-4">
                    {/* 내 시간 */}
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="font-bold text-brand-black">나의 학습</span>
                            <span className="text-teal-600 font-bold">{formatDuration(myTotalMinutes)}</span>
                        </div>
                        <div className="w-full bg-brand-bg rounded-full h-3">
                            <div className="bg-teal-500 h-3 rounded-full transition-all duration-1000" style={{ width: `${myPercent}%` }}></div>
                        </div>
                    </div>

                    {/* 반 평균 */}
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-brand-gray">반 평균</span>
                            <span className="text-brand-gray">{formatDuration(avgMinutes)}</span>
                        </div>
                        <div className="w-full bg-brand-bg rounded-full h-3">
                            <div className="bg-brand-gray/40 h-3 rounded-full transition-all duration-1000" style={{ width: `${avgPercent}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. 예약된 클리닉 (Upcoming) */}
            <div className="space-y-3">
                <h3 className="text-sm font-bold text-brand-black px-1 flex items-center gap-1">
                    <Icon name="clock" className="w-4 h-4 text-teal-500" /> 예약된 일정
                </h3>
                {upcoming.length > 0 ? upcoming.map(log => (
                    <div key={log.id} className="bg-white p-5 rounded-2xl shadow-sm border border-teal-100 flex justify-between items-center">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">예약됨</span>
                                <span className="text-xs text-brand-gray">{log.date}</span>
                            </div>
                            <h4 className="font-bold text-brand-black text-lg">{log.checkIn} 입실 예정</h4>
                            <p className="text-xs text-brand-gray mt-1 flex items-center gap-1">
                                <Icon name="user" className="w-3 h-3" /> {log.tutor || '담당 선생님'}
                            </p>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-8 text-brand-gray bg-white rounded-2xl border border-dashed border-brand-gray/30 text-sm">
                        예약된 클리닉이 없습니다.
                    </div>
                )}
            </div>

            {/* 3. 지난 기록 (History) */}
            <div className="space-y-3">
                <h3 className="text-sm font-bold text-brand-black px-1">지난 기록</h3>
                {history.length > 0 ? history.map(log => (
                    <div key={log.id} className="bg-white p-4 rounded-2xl border border-brand-gray/20 flex justify-between items-center">
                        <div>
                            <div className="text-xs text-brand-gray mb-1">{log.date}</div>
                            <div className="font-bold text-brand-black flex items-center gap-2">
                                <span>{log.checkIn} ~ {log.checkOut}</span>
                                <span className="text-xs font-normal text-brand-gray bg-brand-bg px-1.5 py-0.5 rounded">
                                    {formatDuration(calculateDurationMinutes(log.checkIn, log.checkOut))}
                                </span>
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-brand-bg flex items-center justify-center text-teal-500">
                            <Icon name="check" className="w-5 h-5" />
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-8 text-brand-gray bg-white rounded-2xl border border-dashed border-brand-gray/30 text-sm">
                        완료된 기록이 없습니다.
                    </div>
                )}
            </div>
        </div>
    );
};