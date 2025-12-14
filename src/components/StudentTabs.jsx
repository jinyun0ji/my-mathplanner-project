// src/components/StudentTabs.jsx
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, getWeekOfMonthISO, calculateDurationMinutes, formatDuration, formatTime } from '../utils/helpers';
import CampaignIcon from '@mui/icons-material/Campaign'; 
import NoteAltIcon from '@mui/icons-material/NoteAlt'; 
import TuneIcon from '@mui/icons-material/Tune'; 

const ModalPortal = ({ children }) => {
    const el = document.getElementById('modal-root') || document.body;
    return createPortal(children, el);
};

// 1. DashboardTab (수정: 출결 경고 추가)
export const DashboardTab = ({ student, myClasses, attendanceLogs, clinicLogs, homeworkStats, notices, setActiveTab }) => {
    const today = new Date();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const todayDayName = dayNames[today.getDay()];
    const todayStr = today.toISOString().split('T')[0];
    const todayClasses = myClasses.filter(cls => cls.schedule.days.includes(todayDayName));
    const todayClinics = clinicLogs.filter(log => log.studentId === student.id && log.date === todayStr && !log.checkOut);

    // ✅ [New] 출결 경고 로직
    // 1) 최근 7일 이내 '결석' 기록이 있는지 확인
    // 2) 혹은 전체 출석률이 80% 미만인지 확인
    const attendanceAlerts = myClasses.map(cls => {
        const clsLogs = attendanceLogs.filter(l => l.classId === cls.id && l.studentId === student.id);
        if (clsLogs.length === 0) return null;

        const absentCount = clsLogs.filter(l => l.status === '결석').length;
        const recentAbsent = clsLogs.find(l => {
            const logDate = new Date(l.date);
            const diffTime = Math.abs(today - logDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            return l.status === '결석' && diffDays <= 7;
        });

        const rate = Math.round((clsLogs.filter(l => ['출석','동영상보강'].includes(l.status)).length / clsLogs.length) * 100);

        if (recentAbsent) return { type: 'absent', class: cls.name, msg: '최근 결석이 발생했습니다.' };
        if (rate < 80) return { type: 'rate', class: cls.name, msg: `출석률이 낮습니다 (${rate}%)` };
        return null;
    }).filter(Boolean);

    return (
        <div className="space-y-6 pb-6 animate-fade-in-up">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex justify-between items-center relative overflow-hidden">
                <div className="relative z-10"><p className="text-gray-500 text-sm font-medium mb-1">{today.getMonth()+1}월 {today.getDate()}일 {todayDayName}요일</p><h2 className="text-2xl font-bold text-gray-900">반가워요, <span className="text-brand-main">{student.name}</span>님! 👋</h2></div><div className="w-12 h-12 bg-brand-bg rounded-full flex items-center justify-center text-2xl relative z-10">🎓</div>
            </div>

            {/* ✅ [New] 출결 경고 배너 */}
            {attendanceAlerts.length > 0 && (
                <div className="space-y-2">
                    {attendanceAlerts.map((alert, idx) => (
                        <div key={idx} onClick={() => setActiveTab('class')} className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-3 cursor-pointer">
                            <div className="bg-white p-1.5 rounded-full text-red-500 shadow-sm"><Icon name="alertCircle" className="w-5 h-5" /></div>
                            <div className="flex-1">
                                <p className="text-xs text-red-500 font-bold">{alert.class}</p>
                                <p className="text-sm font-bold text-gray-800">{alert.msg}</p>
                            </div>
                            <Icon name="chevronRight" className="w-4 h-4 text-red-300" />
                        </div>
                    ))}
                </div>
            )}

            <div>
                <h3 className="text-lg font-bold text-gray-800 mb-3 px-1 flex items-center"><Icon name="calendar" className="w-5 h-5 mr-2 text-brand-main" />오늘의 일정</h3>
                {todayClasses.length === 0 && todayClinics.length === 0 ? (
                    <div className="bg-white p-6 rounded-2xl border border-dashed border-gray-300 text-center text-gray-500 text-sm">오늘 예정된 수업이나 클리닉이 없어요. <br/>자율 학습을 해보는 건 어때요? 🔥</div>
                ) : (
                    <div className="space-y-3">
                        {todayClasses.map(cls => (
                            <div key={cls.id} className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 flex justify-between items-center">
                                <div><span className="text-xs font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-200 mb-2 inline-block">정규 수업</span><h4 className="font-bold text-indigo-900 text-lg">{cls.name}</h4><p className="text-sm text-indigo-700 mt-0.5">{cls.schedule.time} | {cls.teacher} 선생님</p></div><Icon name="chevronRight" className="text-indigo-400" />
                            </div>
                        ))}
                        {todayClinics.map(clinic => (
                            <div key={clinic.id} className="bg-teal-50 p-5 rounded-2xl border border-teal-100 flex justify-between items-center">
                                <div><span className="text-xs font-bold text-teal-600 bg-white px-2 py-0.5 rounded border border-teal-200 mb-2 inline-block">클리닉</span><h4 className="font-bold text-teal-900 text-lg">학습 클리닉</h4><p className="text-sm text-teal-700 mt-0.5">{clinic.checkIn} 입실 예정</p></div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div><div className="flex justify-between items-end mb-3 px-1"><h3 className="text-lg font-bold text-gray-800 flex items-center"><Icon name="clipboardCheck" className="w-5 h-5 mr-2 text-brand-red" />놓치면 안 돼요!</h3><button onClick={() => setActiveTab('learning')} className="text-xs text-gray-500 underline">전체보기</button></div><div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 snap-x scrollbar-hide">{homeworkStats.filter(h => h.status !== '완료').length > 0 ? (homeworkStats.filter(h => h.status !== '완료').map(hw => (<div key={hw.id} className="snap-center shrink-0 w-64 bg-white p-4 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden"><div className={`absolute top-0 left-0 w-1.5 h-full ${hw.status === '미시작' ? 'bg-brand-red' : 'bg-brand-main'}`}></div><div className="flex justify-between items-start mb-2 pl-2"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${hw.status === '미시작' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{hw.status}</span><span className="text-[10px] text-gray-400">~{hw.date.slice(5)}</span></div><h4 className="font-bold text-gray-900 text-sm mb-1 pl-2 truncate">{hw.content}</h4><p className="text-xs text-gray-500 pl-2 mb-3">{hw.book}</p><div className="pl-2"><div className="w-full bg-gray-100 rounded-full h-1.5"><div className="bg-brand-main h-1.5 rounded-full" style={{ width: `${hw.completionRate}%` }}></div></div><p className="text-[10px] text-right text-gray-400 mt-1">{hw.completionRate}% 달성</p></div></div>))) : (<div className="w-full bg-white p-5 rounded-2xl border border-gray-100 text-center"><p className="text-sm text-gray-500">모든 과제를 완료했어요! 훌륭해요 👏</p></div>)}</div></div>
            <div><h3 className="text-lg font-bold text-gray-800 mb-3 px-1">📢 최근 소식</h3><div className="bg-white rounded-2xl shadow-sm border border-gray-200 divide-y divide-gray-100">{notices.slice(0, 3).map(notice => (<div key={notice.id} onClick={() => setActiveTab('board')} className="p-4 flex justify-between items-center cursor-pointer active:bg-gray-50"><div className="flex-1 min-w-0 mr-4"><div className="flex items-center gap-2 mb-1">{notice.isPinned && <span className="text-[10px] bg-brand-red text-white px-1 rounded">필독</span>}<h4 className="text-sm font-bold text-gray-900 truncate">{notice.title}</h4></div><p className="text-xs text-gray-400">{notice.date}</p></div><Icon name="chevronRight" className="w-4 h-4 text-gray-300" /></div>))}{notices.length === 0 && (<div className="p-4 text-center text-gray-500 text-sm">새로운 공지사항이 없습니다.</div>)}</div></div>
        </div>
    );
};

// 2. ClassTab
export const ClassTab = ({ myClasses, setSelectedClassId }) => (
    <div className="space-y-6 animate-fade-in-up pb-10">
        <h2 className="text-2xl font-bold text-gray-900 px-1">나의 강의실</h2>
        <div className="grid grid-cols-1 gap-4">
            {myClasses.map(cls => (
                <div key={cls.id} onClick={() => setSelectedClassId(cls.id)} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform">
                    <div className="flex gap-4 items-center"><div className="bg-brand-light/20 w-14 h-14 rounded-2xl flex items-center justify-center text-brand-main font-bold text-xl shrink-0">{cls.name.charAt(0)}</div><div><h4 className="font-bold text-gray-900 text-lg mb-1">{cls.name}</h4><p className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded-md inline-flex items-center gap-1"><Icon name="users" className="w-3 h-3" /> {cls.teacher} 선생님</p><p className="text-xs text-gray-400 mt-1 ml-0.5">{cls.schedule.days.join(', ')} {cls.schedule.time}</p></div></div><div className="text-gray-300"><Icon name="chevronRight" className="w-6 h-6" /></div>
                </div>
            ))}
        </div>
    </div>
);

// 3. LearningTab
export const LearningTab = ({ studentId, myHomeworkStats, myGradeComparison, clinicLogs, students, classes }) => {
    const [subTab, setSubTab] = useState('homework'); 
    return (
        <div className="animate-fade-in-up h-full flex flex-col pb-10">
            <h2 className="text-2xl font-bold text-gray-900 px-1 mb-4">학습 관리</h2>
            <div className="flex p-1 bg-gray-100 rounded-xl mb-6">
                <button onClick={() => setSubTab('homework')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${subTab === 'homework' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>과제</button>
                <button onClick={() => setSubTab('grades')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${subTab === 'grades' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>성적</button>
                <button onClick={() => setSubTab('clinic')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${subTab === 'clinic' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>클리닉</button>
            </div>
            <div className="flex-1">
                {subTab === 'homework' && <HomeworkTab myHomeworkStats={myHomeworkStats} />}
                {subTab === 'grades' && <GradesTab myGradeComparison={myGradeComparison} />}
                {subTab === 'clinic' && <ClinicTab studentId={studentId} clinicLogs={clinicLogs} students={students} classes={classes} />}
            </div>
        </div>
    );
};

// 4. ScheduleTab
export const ScheduleTab = ({ 
    myClasses, externalSchedules, attendanceLogs, clinicLogs, studentId, 
    onSaveExternalSchedule, onDeleteExternalSchedule 
}) => {
    const [viewType, setViewType] = useState('weekly'); 
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const todayStr = new Date().toISOString().split('T')[0];
    const [newSchedule, setNewSchedule] = useState({ academyName: '', courseName: '', instructor: '', startDate: todayStr, endDate: '', days: [], startTime: '', endTime: '' });
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [targetScheduleForDelete, setTargetScheduleForDelete] = useState(null);

    const formatDate = (date) => { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; };
    const handleOpenAddModal = () => { setNewSchedule({ academyName: '', courseName: '', instructor: '', startDate: todayStr, endDate: '', days: [], startTime: '', endTime: '' }); setIsEditMode(false); setEditingId(null); setIsScheduleModalOpen(true); };
    const handleEditClick = (e, schedule) => { e.stopPropagation(); setNewSchedule({ academyName: schedule.academyName, courseName: schedule.courseName, instructor: schedule.instructor || '', startDate: schedule.startDate, endDate: schedule.endDate || '', days: schedule.days || [], startTime: schedule.startTime, endTime: schedule.endTime || '' }); setIsEditMode(true); setEditingId(schedule.scheduleId); setIsScheduleModalOpen(true); };
    const handleSaveSubmit = () => { if (!newSchedule.academyName || !newSchedule.courseName || !newSchedule.startDate || newSchedule.days.length === 0 || !newSchedule.startTime) { alert('필수 정보를 모두 입력해주세요.'); return; } onSaveExternalSchedule({ id: isEditMode ? editingId : null, studentId, ...newSchedule, time: `${newSchedule.startTime}~${newSchedule.endTime || ''}` }); setIsScheduleModalOpen(false); };
    const handleDeleteClick = (e, schedule) => { e.stopPropagation(); setTargetScheduleForDelete(schedule); setIsDeleteModalOpen(true); };
    const executeDelete = (mode) => { if (!targetScheduleForDelete) return; onDeleteExternalSchedule(targetScheduleForDelete.scheduleId, mode, formatDate(selectedDate)); setIsDeleteModalOpen(false); setTargetScheduleForDelete(null); };
    const toggleDay = (day) => { setNewSchedule(prev => { const newDays = prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day]; const dayOrder = { '월':1, '화':2, '수':3, '목':4, '금':5, '토':6, '일':7 }; newDays.sort((a, b) => dayOrder[a] - dayOrder[b]); return { ...prev, days: newDays }; }); };

    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    const baseDate = new Date(selectedDate);
    const sunday = new Date(baseDate); sunday.setDate(baseDate.getDate() - baseDate.getDay());
    const { month: weekMonth, week: weekNum } = getWeekOfMonthISO(sunday);
    const prevWeek = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 7); setSelectedDate(d); };
    const nextWeek = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 7); setSelectedDate(d); };
    const prevMonth = () => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
    const nextMonth = () => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
    const calendarDays = Array(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay()).fill(null).concat([...Array(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate()).keys()].map(i => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i + 1)));

    const getDayInfo = (date) => {
        if (!date) return { hasClass: false, status: null, hasExternal: false, hasClinic: false };
        const dateStr = formatDate(date);
        const dayOfWeek = weekDays[date.getDay()];
        const dayClasses = myClasses.filter(cls => cls.schedule.days.includes(dayOfWeek));
        const myExternal = externalSchedules ? externalSchedules.filter(s => s.studentId === studentId && s.days && s.days.includes(dayOfWeek) && date >= new Date(s.startDate) && (!s.endDate || date <= new Date(s.endDate)) && (!s.excludedDates || !s.excludedDates.includes(dateStr))) : [];
        const myClinics = clinicLogs ? clinicLogs.filter(log => log.studentId === studentId && log.date === dateStr) : [];
        const logs = attendanceLogs ? attendanceLogs.filter(log => log.studentId === studentId && log.date === dateStr) : [];
        let status = null; if (logs.length > 0) { if (logs.some(l => l.status === '결석')) status = '결석'; else if (logs.some(l => l.status === '지각')) status = '지각'; else status = '출석'; }
        return { hasClass: (dayClasses.length > 0), status, hasExternal: myExternal.length > 0, hasClinic: myClinics.length > 0 };
    };

    const renderSchedules = () => {
        const dayOfWeek = weekDays[selectedDate.getDay()];
        const dateStr = formatDate(selectedDate);
        const dailyClasses = myClasses.filter(cls => cls.schedule.days.includes(dayOfWeek)).map(cls => ({ id: `math-${cls.id}`, type: 'math', name: cls.name, teacher: cls.teacher, time: cls.schedule.time, scheduleId: cls.id }));
        const myExternal = externalSchedules ? externalSchedules.filter(s => s.studentId === studentId && s.days && s.days.includes(dayOfWeek) && selectedDate >= new Date(s.startDate) && (!s.endDate || selectedDate <= new Date(s.endDate)) && (!s.excludedDates || !s.excludedDates.includes(dateStr))) : [];
        const dailyExternal = myExternal.map(s => ({ id: `ext-${s.id}`, type: 'external', name: s.academyName, teacher: s.courseName, time: `${s.startTime}~${s.endTime}`, scheduleId: s.id, ...s }));
        const myClinics = clinicLogs ? clinicLogs.filter(log => log.studentId === studentId && log.date === dateStr).map(log => ({ id: `clinic-${log.id}`, type: 'clinic', name: '학습 클리닉', teacher: log.tutor || '담당 선생님', time: log.checkIn ? `${log.checkIn}~${log.checkOut || ''}` : '시간 미정', status: log.checkOut ? '완료' : '예약됨', scheduleId: log.id })) : [];
        const allSchedules = [...dailyClasses, ...dailyExternal, ...myClinics].sort((a, b) => (a.time.split('~')[0] || '00:00').localeCompare(b.time.split('~')[0] || '00:00'));

        if (allSchedules.length === 0) return (<div className="text-center py-20 text-brand-gray bg-white rounded-2xl border border-dashed border-brand-gray/50"><p className="font-bold text-brand-gray mb-1">{selectedDate.getMonth()+1}월 {selectedDate.getDate()}일 ({dayOfWeek})</p>일정이 없습니다.</div>);

        return (
            <div className="grid grid-cols-1 gap-4">{allSchedules.map((item) => {
                let log = null, borderColor = 'border-brand-main/30', dotColor = 'bg-brand-main', typeLabel = '수학 학원', typeClass = 'text-brand-main bg-brand-light/30';
                if (item.type === 'math') { log = attendanceLogs ? attendanceLogs.find(l => l.studentId === studentId && l.classId === item.scheduleId && l.date === dateStr) : null; if(log?.status === '출석') dotColor = 'bg-green-500'; else if(log?.status === '지각') dotColor = 'bg-yellow-400'; else if(log?.status === '결석') dotColor = 'bg-brand-red'; } else if (item.type === 'external') { borderColor = 'border-brand-light'; dotColor = 'bg-brand-light'; typeLabel = item.teacher; typeClass = 'text-brand-gray bg-brand-bg'; } else if (item.type === 'clinic') { borderColor = 'border-teal-200'; dotColor = item.status === '완료' ? 'bg-teal-500' : 'bg-teal-300'; typeLabel = '클리닉'; typeClass = 'text-teal-600 bg-teal-50'; }
                return (<div key={item.id} className={`relative pl-6 border-l-2 py-2 ml-2 ${borderColor}`}><div className={`absolute -left-[9px] top-3 w-4 h-4 rounded-full ring-4 ring-white ${dotColor}`}></div><div onClick={(e) => item.type === 'external' ? handleEditClick(e, item) : null} className={`bg-white p-5 rounded-2xl shadow-sm border border-brand-gray/30 relative group h-full flex flex-col justify-between transition-all hover:shadow-md ${item.type === 'external' ? 'cursor-pointer hover:border-brand-main/50' : ''}`}><div><div className="flex justify-between mb-2"><span className={`text-xs font-bold px-2 py-1 rounded ${typeClass}`}>{typeLabel}</span><span className="text-xs text-brand-gray font-medium">{item.time}</span></div><h4 className="font-bold text-brand-black text-lg mb-2">{item.name}</h4></div><div className="flex justify-between items-end">{item.type === 'math' ? (<><p className="text-sm text-brand-gray flex items-center gap-1"><Icon name="users" className="w-4 h-4" /> {item.teacher} 선생님</p>{log && (<span className={`text-xs font-bold px-2 py-1 rounded ${log.status === '출석' ? 'bg-green-100 text-green-700' : log.status === '지각' ? 'bg-yellow-100 text-yellow-700' : 'bg-brand-red/10 text-brand-red'}`}>{log.status}</span>)}</>) : item.type === 'clinic' ? (<><p className="text-sm text-brand-gray flex items-center gap-1"><Icon name="user" className="w-4 h-4" /> {item.teacher}</p><span className={`text-xs font-bold px-2 py-1 rounded ${item.status === '완료' ? 'bg-teal-100 text-teal-700' : 'bg-teal-50 text-teal-600 border border-teal-200'}`}>{item.status}</span></>) : (<div className="w-full flex justify-end gap-3"><span className="text-xs text-brand-main opacity-0 group-hover:opacity-100 transition-opacity">수정</span><button onClick={(e) => handleDeleteClick(e, item)} className="text-xs text-brand-gray hover:text-brand-red underline">삭제</button></div>)}</div></div></div>);
            })}</div>
        );
    };

    return (
        <div className="pb-10 relative animate-fade-in-up">
            <div className="flex justify-between items-center mb-6 px-1"><h2 className="text-2xl font-bold text-brand-black">나의 일정</h2><div className="flex gap-2"><button onClick={handleOpenAddModal} className="bg-brand-main hover:bg-brand-dark text-white px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 shadow-md transition-all active:scale-95"><Icon name="plus" className="w-4 h-4" /> 일정 추가</button><div className="bg-white p-1 rounded-xl border border-brand-gray/30 shadow-sm flex h-[32px] items-center"><button onClick={() => setViewType('weekly')} className={`px-3 py-0 h-full flex items-center rounded-lg text-xs font-bold transition-all ${viewType === 'weekly' ? 'bg-brand-main text-white shadow-md' : 'text-brand-gray hover:text-brand-black'}`}>주간</button><button onClick={() => { setViewType('monthly'); setSelectedDate(new Date()); }} className={`px-3 py-0 h-full flex items-center rounded-lg text-xs font-bold transition-all ${viewType === 'monthly' ? 'bg-brand-main text-white shadow-md' : 'text-brand-gray hover:text-brand-black'}`}>월간</button></div></div></div>
            {viewType === 'weekly' ? (<div className="space-y-6"><div className="flex items-center justify-between px-2 mb-2"><button onClick={prevWeek} className="p-2 bg-white rounded-full shadow-sm text-brand-gray hover:text-brand-main hover:bg-brand-bg"><Icon name="chevronLeft" className="w-5 h-5" /></button><span className="font-bold text-brand-black text-lg">{weekMonth}월 {weekNum}주차</span><button onClick={nextWeek} className="p-2 bg-white rounded-full shadow-sm text-brand-gray hover:text-brand-main hover:bg-brand-bg"><Icon name="chevronRight" className="w-5 h-5" /></button></div><div className="flex justify-between bg-white p-1.5 rounded-2xl shadow-sm border border-brand-gray/30 overflow-x-auto">{weekDays.map((day, index) => { const date = new Date(sunday); date.setDate(sunday.getDate() + index); const isSelected = formatDate(date) === formatDate(selectedDate); const isToday = formatDate(date) === todayStr; const { hasClass, status, hasExternal, hasClinic } = getDayInfo(date); return (<button key={day} onClick={() => setSelectedDate(date)} className={`flex flex-col items-center p-1 rounded-xl flex-1 transition-all min-w-[32px] relative ${isSelected ? 'bg-brand-main text-white shadow-brand scale-105' : 'hover:bg-brand-bg'} ${!isSelected && isToday ? 'text-brand-main font-bold' : ''} ${!isSelected && !isToday ? 'text-brand-gray' : ''}`}><span className="text-[10px] mb-0.5">{day}</span><span className={`font-bold ${isSelected ? 'text-base' : 'text-sm'}`}>{date.getDate()}</span><div className="flex gap-0.5 mt-1 h-1.5 items-center">{(hasClass || status) && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : (status === '출석' ? 'bg-green-500' : status === '지각' ? 'bg-yellow-400' : status === '결석' ? 'bg-brand-red' : 'bg-brand-gray')}`}></div>}{hasExternal && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-brand-light'}`}></div>}{hasClinic && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-teal-400'}`}></div>}</div></button>); })}</div><div className="space-y-4">{renderSchedules()}</div></div>) : (<div className="flex flex-col md:flex-row gap-6"><div className="bg-white rounded-3xl shadow-lg p-6 border border-brand-gray/30 mb-6 max-w-md mx-auto w-full md:w-1/2 flex-shrink-0 h-fit"><div className="flex justify-between items-center mb-6"><button onClick={prevMonth} className="p-2 hover:bg-brand-bg rounded-full text-brand-gray"><Icon name="chevronLeft" className="w-5 h-5" /></button><h3 className="text-lg font-bold text-brand-black">{selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월</h3><button onClick={nextMonth} className="p-2 hover:bg-brand-bg rounded-full text-brand-gray"><Icon name="chevronRight" className="w-5 h-5" /></button></div><div className="grid grid-cols-7 mb-2 text-center">{weekDays.map((day, i) => (<div key={day} className={`text-xs font-bold ${i === 0 ? 'text-brand-red' : 'text-brand-gray'}`}>{day}</div>))}</div><div className="grid grid-cols-7 gap-y-4 gap-x-1">{calendarDays.map((date, index) => { if (!date) return <div key={index}></div>; const { hasClass, status, hasExternal, hasClinic } = getDayInfo(date); const isSelected = formatDate(date) === formatDate(selectedDate); const isToday = formatDate(date) === todayStr; return (<div key={index} className="flex flex-col items-center cursor-pointer group" onClick={() => setSelectedDate(date)}><div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all ${isSelected ? 'bg-brand-main text-white shadow-brand scale-110' : ''} ${!isSelected && isToday ? 'text-brand-main font-bold bg-brand-light/30' : ''} ${!isSelected && !isToday ? 'text-brand-black group-hover:bg-brand-bg' : ''}`}>{date.getDate()}</div><div className="h-1.5 mt-1 flex gap-0.5 min-h-[6px]">{status === '출석' && <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>}{status === '지각' && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>}{status === '결석' && <div className="w-1.5 h-1.5 rounded-full bg-brand-red"></div>}{!status && hasClass && <div className="w-1.5 h-1.5 rounded-full bg-brand-gray"></div>}{hasExternal && <div className="w-1.5 h-1.5 rounded-full bg-brand-light"></div>}{hasClinic && <div className="w-1.5 h-1.5 rounded-full bg-teal-400"></div>}</div></div>); })}</div></div><div className="space-y-4 w-full md:w-1/2 flex-1">{renderSchedules()}</div></div>)}
            {isScheduleModalOpen && <ModalPortal><div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsScheduleModalOpen(false)}><div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}><h3 className="text-lg font-bold text-brand-black mb-4">타학원 일정 {isEditMode ? '수정' : '등록'}</h3><div className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar px-1"><div><label className="block text-xs font-bold text-brand-gray mb-1">학원명 *</label><input type="text" value={newSchedule.academyName} onChange={e => setNewSchedule({...newSchedule, academyName: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none" placeholder="예: 정상어학원"/></div><div><label className="block text-xs font-bold text-brand-gray mb-1">강의명 *</label><input type="text" value={newSchedule.courseName} onChange={e => setNewSchedule({...newSchedule, courseName: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none" placeholder="예: TOP반 영어"/></div><div><label className="block text-xs font-bold text-brand-gray mb-1">강사</label><input type="text" value={newSchedule.instructor} onChange={e => setNewSchedule({...newSchedule, instructor: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none" placeholder="예: Julie 선생님"/></div><div className="flex gap-2"><div className="flex-1"><label className="block text-xs font-bold text-brand-gray mb-1">개강일 *</label><input type="date" value={newSchedule.startDate} onChange={e => setNewSchedule({...newSchedule, startDate: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none"/></div><div className="flex-1"><label className="block text-xs font-bold text-brand-gray mb-1">종강일</label><input type="date" value={newSchedule.endDate} onChange={e => setNewSchedule({...newSchedule, endDate: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none"/></div></div><div><label className="block text-xs font-bold text-brand-gray mb-1">수업 요일 *</label><div className="flex gap-1 justify-between">{['월','화','수','목','금','토','일'].map(d => (<button key={d} onClick={() => toggleDay(d)} className={`w-8 h-8 rounded-full text-xs font-bold transition-colors ${newSchedule.days.includes(d) ? 'bg-brand-main text-white' : 'bg-brand-bg text-brand-gray hover:bg-brand-gray/30'}`}>{d}</button>))}</div></div><div className="flex gap-2"><div className="flex-1"><label className="block text-xs font-bold text-brand-gray mb-1">시작 시간 *</label><input type="time" value={newSchedule.startTime} onChange={e => setNewSchedule({...newSchedule, startTime: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none"/></div><div className="flex-1"><label className="block text-xs font-bold text-brand-gray mb-1">종료 시간</label><input type="time" value={newSchedule.endTime} onChange={e => setNewSchedule({...newSchedule, endTime: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none"/></div></div><button onClick={handleSaveSubmit} className="w-full bg-brand-main hover:bg-brand-dark text-white font-bold py-3 rounded-xl mt-2 transition-colors">{isEditMode ? '수정 완료' : '등록하기'}</button></div></div></div></ModalPortal>}
            {isDeleteModalOpen && <ModalPortal><div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)}><div className="bg-white rounded-2xl w-full max-w-xs p-6 shadow-2xl animate-fade-in-up text-center" onClick={e => e.stopPropagation()}><div className="w-12 h-12 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-red"><Icon name="trash" className="w-6 h-6" /></div><h3 className="text-lg font-bold text-brand-black mb-2">반복 일정 삭제</h3><p className="text-sm text-brand-gray mb-6">이 일정을 어떻게 삭제하시겠습니까?</p><div className="space-y-2"><button onClick={() => executeDelete('instance')} className="w-full bg-white border border-brand-gray/30 text-brand-black hover:bg-brand-bg font-bold py-3 rounded-xl text-sm transition-colors">이 일정만 삭제</button><button onClick={() => executeDelete('future')} className="w-full bg-white border border-brand-gray/30 text-brand-black hover:bg-brand-bg font-bold py-3 rounded-xl text-sm transition-colors">이 일정 및 향후 일정 삭제</button><button onClick={() => executeDelete('all')} className="w-full bg-brand-red text-white hover:bg-red-600 font-bold py-3 rounded-xl text-sm transition-colors">전체 삭제</button></div><button onClick={() => setIsDeleteModalOpen(false)} className="mt-4 text-xs text-brand-gray hover:text-brand-black underline">취소</button></div></div></ModalPortal>}
        </div>
    );
};

// 5. MenuTab
export const MenuTab = ({ student, onUpdateStudent, onLogout, videoBookmarks, lessonLogs, onLinkToMemo, notices, setActiveTab }) => { // ✅ setActiveTab prop 추가
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isMemosOpen, setIsMemosOpen] = useState(false); 
    const [editData, setEditData] = useState({ school: '', grade: '', phone: '' });
    const [notifications, setNotifications] = useState({ all: true, post: true, homework: true, clinic: true, class_update: true });

    const handleOpenProfile = () => { if (student) setEditData({ school: student.school || '', grade: student.grade || '', phone: student.phone || '' }); setIsProfileOpen(true); };
    const handleSaveProfile = () => {
        if (!editData.school || !editData.grade || !editData.phone) { alert('모든 정보를 입력해주세요.'); return; }
        let normalizedSchool = editData.school.trim();
        if (normalizedSchool.endsWith('고등학교')) normalizedSchool = normalizedSchool.replace('고등학교', '고');
        onUpdateStudent({ ...student, ...editData, school: normalizedSchool }, true);
        setIsProfileOpen(false); alert('정보가 수정되었습니다.');
    };
    const toggleNotification = (key) => { setNotifications(prev => { if (key === 'all') { const newValue = !prev.all; return { all: newValue, post: newValue, homework: newValue, clinic: newValue, class_update: newValue }; } const newSettings = { ...prev, [key]: !prev[key] }; if (!newSettings[key]) newSettings.all = false; else if (newSettings.post && newSettings.homework && newSettings.clinic && newSettings.class_update) newSettings.all = true; return newSettings; }); };

    const getMyMemos = () => {
        if (!student || !videoBookmarks || !videoBookmarks[student.id]) return [];
        const myBookmarks = videoBookmarks[student.id];
        const allMemos = [];
        Object.keys(myBookmarks).forEach(lessonId => {
            const lessonIdNum = parseInt(lessonId, 10);
            const lesson = lessonLogs?.find(l => l.id === lessonIdNum);
            const bookmarks = myBookmarks[lessonId];
            if (lesson && bookmarks && bookmarks.length > 0) {
                bookmarks.forEach(bm => {
                    allMemos.push({ ...bm, lessonTitle: lesson.progress, lessonDate: lesson.date, classId: lesson.classId, lessonId: lessonIdNum });
                });
            }
        });
        return allMemos.sort((a, b) => b.id - a.id);
    };
    const myMemos = getMyMemos();

    return (
        <div className="space-y-6 animate-fade-in-up pb-10">
            <h2 className="text-2xl font-bold text-gray-900 px-1">더보기</h2>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4"><div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center text-2xl">😎</div><div><h3 className="text-lg font-bold text-gray-900">{student.name}</h3><p className="text-sm text-gray-500">{student.school} | 고{student.grade}</p></div><button onClick={handleOpenProfile} className="ml-auto text-xs bg-gray-100 px-3 py-1.5 rounded-lg text-gray-600 font-bold">수정</button></div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {/* ✅ [수정] 게시판 버튼: 모달 대신 탭 이동 */}
                <button onClick={() => { if(setActiveTab) setActiveTab('board'); }} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3"><div className="bg-brand-light/20 p-2 rounded-lg text-brand-main"><CampaignIcon className="w-5 h-5" /></div><span className="font-bold text-gray-800">공지사항 / 게시판</span></div><Icon name="chevronRight" className="w-4 h-4 text-gray-300" />
                </button>
                <button onClick={() => setIsMemosOpen(true)} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"><div className="flex items-center gap-3"><div className="bg-yellow-50 p-2 rounded-lg text-yellow-600"><NoteAltIcon className="w-5 h-5" /></div><span className="font-bold text-gray-800">나의 학습 메모</span></div><Icon name="chevronRight" className="w-4 h-4 text-gray-300" /></button>
                <button onClick={() => setIsSettingsOpen(true)} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"><div className="flex items-center gap-3"><div className="bg-gray-50 p-2 rounded-lg text-gray-500"><TuneIcon className="w-5 h-5" /></div><span className="font-bold text-gray-800">알림 설정</span></div><Icon name="chevronRight" className="w-4 h-4 text-gray-300" /></button>
            </div>
            <button onClick={onLogout} className="w-full py-4 text-gray-400 text-sm font-medium underline">로그아웃</button>
            {isProfileOpen && <ModalPortal><div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsProfileOpen(false)}><div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-brand-black">내 정보 수정</h3><button onClick={() => setIsProfileOpen(false)} className="text-brand-gray hover:text-brand-black"><Icon name="x" className="w-6 h-6" /></button></div><div className="space-y-4"><div><label className="block text-xs font-bold text-brand-gray mb-1">이름</label><input type="text" value={student?.name || ''} disabled className="w-full bg-brand-bg/50 border border-brand-gray/30 rounded-lg px-3 py-2 text-sm text-brand-gray cursor-not-allowed" /></div><div><label className="block text-xs font-bold text-brand-gray mb-1">학교</label><input type="text" value={editData.school} onChange={(e) => setEditData({...editData, school: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none" placeholder="예: 서울고" /><p className="text-[10px] text-brand-gray mt-1 ml-1">* '고등학교'는 자동으로 '고'로 저장됩니다.</p></div><div><label className="block text-xs font-bold text-brand-gray mb-1">학년</label><select value={editData.grade} onChange={(e) => setEditData({...editData, grade: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none appearance-none bg-white"><option value="" disabled>학년을 선택하세요</option><option value="고1">고1</option><option value="고2">고2</option><option value="고3">고3</option></select></div><div><label className="block text-xs font-bold text-brand-gray mb-1">전화번호</label><input type="text" value={editData.phone} onChange={(e) => setEditData({...editData, phone: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none" placeholder="010-0000-0000" /></div><button onClick={handleSaveProfile} className="w-full bg-brand-main hover:bg-brand-dark text-white font-bold py-3 rounded-xl mt-4 transition-colors">저장하기</button></div></div></div></ModalPortal>}
            {isSettingsOpen && <ModalPortal><div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}><div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-brand-black">알림 설정</h3><button onClick={() => setIsSettingsOpen(false)} className="text-brand-gray hover:text-brand-black"><Icon name="x" className="w-6 h-6" /></button></div><div className="space-y-4"><div className="flex items-center justify-between py-2 border-b border-brand-gray/10"><span className="font-bold text-brand-black">전체 알림</span><button onClick={() => toggleNotification('all')} className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${notifications.all ? 'bg-brand-main' : 'bg-brand-gray/30'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${notifications.all ? 'translate-x-6' : 'translate-x-0'}`} /></button></div><div className="space-y-3 pt-2"><div className="flex items-center justify-between"><span className="text-sm text-brand-black">게시글(공지사항) 알림</span><button onClick={() => toggleNotification('post')} className={`w-10 h-5 rounded-full p-0.5 transition-colors ${notifications.post ? 'bg-brand-main' : 'bg-brand-gray/30'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${notifications.post ? 'translate-x-5' : 'translate-x-0'}`} /></button></div><div className="flex items-center justify-between"><span className="text-sm text-brand-black">과제 마감 알림</span><button onClick={() => toggleNotification('homework')} className={`w-10 h-5 rounded-full p-0.5 transition-colors ${notifications.homework ? 'bg-brand-main' : 'bg-brand-gray/30'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${notifications.homework ? 'translate-x-5' : 'translate-x-0'}`} /></button></div><div className="flex items-center justify-between"><span className="text-sm text-brand-black">클리닉 예약 알림</span><button onClick={() => toggleNotification('clinic')} className={`w-10 h-5 rounded-full p-0.5 transition-colors ${notifications.clinic ? 'bg-brand-main' : 'bg-brand-gray/30'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${notifications.clinic ? 'translate-x-5' : 'translate-x-0'}`} /></button></div><div className="flex items-center justify-between"><span className="text-sm text-brand-black">수업 후 자료/성적 알림</span><button onClick={() => toggleNotification('class_update')} className={`w-10 h-5 rounded-full p-0.5 transition-colors ${notifications.class_update ? 'bg-brand-main' : 'bg-brand-gray/30'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${notifications.class_update ? 'translate-x-5' : 'translate-x-0'}`} /></button></div></div></div></div></div></ModalPortal>}
            {isMemosOpen && <ModalPortal><div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsMemosOpen(false)}><div className="bg-white rounded-2xl w-full max-w-lg p-0 shadow-2xl animate-fade-in-up overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center p-5 border-b border-brand-gray/20"><h3 className="text-lg font-bold text-brand-black flex items-center gap-2"><NoteAltIcon className="text-brand-main" /> 나의 학습 메모</h3><button onClick={() => setIsMemosOpen(false)} className="text-brand-gray hover:text-brand-black"><Icon name="x" className="w-6 h-6" /></button></div><div className="overflow-y-auto p-5 space-y-3 custom-scrollbar">{myMemos.length > 0 ? myMemos.map(memo => (<div key={memo.id} onClick={() => { setIsMemosOpen(false); onLinkToMemo(memo.classId, memo.lessonId, memo.time); }} className="bg-brand-bg/50 p-4 rounded-xl cursor-pointer hover:bg-brand-bg transition-colors border border-transparent hover:border-brand-main/30 group"><div className="flex justify-between items-start mb-2"><div><h4 className="font-bold text-sm text-brand-black">{memo.lessonTitle}</h4><p className="text-xs text-brand-gray mt-0.5">{memo.lessonDate}</p></div><span className="text-xs font-mono font-bold text-brand-main bg-white px-2 py-1 rounded border border-brand-gray/20">{formatTime(memo.time)}</span></div><p className="text-sm text-brand-dark/80 line-clamp-2">{memo.note}</p><div className="text-right mt-2 text-xs text-brand-main opacity-0 group-hover:opacity-100 transition-opacity">강의 보러가기 &rarr;</div></div>)) : (<div className="text-center py-10 text-brand-gray text-sm">저장된 메모가 없습니다.<br/>강의 수강 중 중요한 부분에 메모를 남겨보세요.</div>)}</div></div></div></ModalPortal>}
        </div>
    );
};

// 6. HomeworkTab
export const HomeworkTab = ({ myHomeworkStats }) => {
    const [selectedHwId, setSelectedHwId] = useState(null); 
    const toggleDetails = (id) => setSelectedHwId(selectedHwId === id ? null : id);

    return (
        <div className="space-y-4">
             {myHomeworkStats.length === 0 && <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-2xl border border-dashed border-gray-200">등록된 과제가 없습니다.</div>}
             {myHomeworkStats.map(hw => (
                 <div key={hw.id} onClick={() => toggleDetails(hw.id)} className={`bg-white p-5 rounded-2xl shadow-sm border border-gray-100 transition-all cursor-pointer ${selectedHwId === hw.id ? 'ring-2 ring-indigo-500' : ''}`}>
                     <div className="flex justify-between items-start mb-2"><span className={`text-xs font-bold px-2 py-0.5 rounded ${hw.status === '완료' ? 'bg-green-100 text-green-700' : hw.status === '미시작' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{hw.status}</span><span className="text-xs text-gray-400">~{hw.date.slice(5)}</span></div><h4 className="font-bold text-gray-900 mb-1">{hw.content}</h4><p className="text-xs text-gray-500 mb-4">{hw.book} (총 {hw.totalQuestions}문제)</p><div className="w-full bg-gray-100 rounded-full h-1.5 mb-2"><div className="bg-brand-main h-1.5 rounded-full transition-all" style={{ width: `${hw.completionRate}%` }}></div></div>
                     {selectedHwId === hw.id && (<div className="mt-4 pt-4 border-t border-gray-100 animate-fade-in-down"><div className="flex justify-around mb-4 text-center"><div><p className="text-xs text-gray-500">맞음</p><p className="font-bold text-green-600">{hw.completedCount}</p></div><div><p className="text-xs text-gray-500">틀림</p><p className="font-bold text-red-500">{hw.incorrectCount}</p></div><div><p className="text-xs text-gray-500">남음</p><p className="font-bold text-gray-800">{hw.uncheckedCount}</p></div></div>{hw.incorrectQuestionList && hw.incorrectQuestionList.length > 0 ? (<div className="bg-red-50 p-3 rounded-xl"><p className="text-xs font-bold text-red-600 mb-2">오답 노트</p><div className="flex flex-wrap gap-2">{hw.incorrectQuestionList.map(q => (<span key={q} className="bg-white text-red-600 text-xs font-bold px-2 py-1 rounded border border-red-100">{q}번</span>))}</div></div>) : (<p className="text-center text-xs text-gray-400 mt-2">오답이 없습니다. 훌륭해요! 🎉</p>)}</div>)}
                 </div>
             ))}
        </div>
    );
};

// ✅ [수정] GradesTab (신규 디자인: 리스트 -> 전체화면 상세)
export const GradesTab = ({ myGradeComparison }) => {
    const [selectedGrade, setSelectedGrade] = useState(null);

    // Detail View (Full Screen Overlay)
    if (selectedGrade) {
        return (
            <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col animate-fade-in-up">
                {/* Header */}
                <div className="flex-none h-14 flex items-center gap-3 px-4 border-b border-gray-200 bg-white shadow-sm">
                    <button onClick={() => setSelectedGrade(null)} className="p-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200">
                        <Icon name="chevronLeft" className="w-5 h-5" />
                    </button>
                    <h2 className="text-base font-bold text-gray-900 truncate">성적 상세 분석</h2>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    {/* Summary Section */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6 text-center">
                        <span className="text-sm text-gray-500 font-bold bg-gray-100 px-2 py-1 rounded mb-2 inline-block">{selectedGrade.testDate} 시행</span>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedGrade.testName}</h3>
                        <div className="py-4">
                            <span className="text-5xl font-extrabold text-indigo-600">{selectedGrade.studentScore}</span>
                            <span className="text-gray-400 text-xl font-medium"> / {selectedGrade.maxScore}</span>
                        </div>
                        <div className="flex justify-center gap-2">
                            <span className={`text-sm font-bold px-3 py-1 rounded-full ${selectedGrade.isAboveAverage ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                {selectedGrade.isAboveAverage ? '▲' : '▼'} 평균보다 {Math.abs(selectedGrade.scoreDifference)}점 {selectedGrade.isAboveAverage ? '높음' : '낮음'}
                            </span>
                        </div>
                    </div>

                    {/* Question Analysis Section */}
                    <QuestionAnalysisList questions={selectedGrade.questions} />
                </div>
            </div>
        );
    }

    // List View (Card)
    return (
        <div className="space-y-4 pb-20">
            {myGradeComparison.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-2xl border border-dashed border-gray-200">
                    등록된 성적이 없습니다.
                </div>
            ) : (
                myGradeComparison.map((item, idx) => (
                    <div 
                        key={idx} 
                        onClick={() => setSelectedGrade(item)} 
                        className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-all hover:border-indigo-200"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                    {item.className}
                                </span>
                                <span className="text-xs text-gray-400">{item.testDate}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 leading-tight mb-1">{item.testName}</h3>
                                <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                                    {/* ✅ [수정] 아이콘 이름 정확히 매핑 */}
                                    {item.isAboveAverage ? <Icon name="trendingUp" className="w-3 h-3 text-green-500" /> : <Icon name="trendingDown" className="w-3 h-3 text-red-500" />}
                                    평균 {item.classAverage}점
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-extrabold text-indigo-900">{item.studentScore}</span>
                                <span className="text-xs text-gray-400 font-medium">점</span>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

// ✅ [추가] Helper Component for Detail View
const QuestionAnalysisList = ({ questions }) => {
    const [filter, setFilter] = useState('all'); // all, wrong, hard

    const filtered = questions.filter(q => {
        if (filter === 'wrong') return q.status !== '맞음'; // 틀림, 고침 등
        if (filter === 'hard') return q.difficulty === '상';
        return true;
    });

    return (
        <div>
            {/* Filter Tabs */}
            <div className="flex p-1 bg-gray-100 rounded-xl mb-4">
                {['all', 'wrong', 'hard'].map(type => (
                    <button
                        key={type}
                        onClick={() => setFilter(type)}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                            filter === type ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                        }`}
                    >
                        {type === 'all' ? '전체 문항' : type === 'wrong' ? '오답만' : '고난도'}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="space-y-3">
                {filtered.length > 0 ? filtered.map((q, i) => (
                    <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded">
                                    {q.no}번
                                </span>
                                <span className={`text-xs font-bold px-2 py-1 rounded flex items-center gap-1 ${
                                    q.status === '맞음' ? 'bg-green-50 text-green-600' :
                                    q.status === '고침' ? 'bg-yellow-50 text-yellow-600' :
                                    'bg-red-50 text-red-600'
                                }`}>
                                    {q.status === '맞음' ? <Icon name="check" className="w-3 h-3" /> : 
                                     q.status === '틀림' ? <Icon name="x" className="w-3 h-3" /> : 
                                     <Icon name="alertCircle" className="w-3 h-3" />}
                                    {q.status}
                                </span>
                            </div>
                            <span className="text-sm font-bold text-gray-900">{q.score}점</span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                            <div className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                난이도: <span className={`font-bold ${q.difficulty === '상' ? 'text-red-500' : q.difficulty === '중' ? 'text-yellow-600' : 'text-green-500'}`}>{q.difficulty}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                유형: {q.type}
                            </div>
                            <div className="flex items-center gap-1 ml-auto">
                                정답률 <span className="font-bold text-indigo-600">{q.itemAccuracy}%</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-2">
                            <button className="flex items-center justify-center gap-1 py-2 rounded-lg bg-gray-50 text-gray-600 text-xs font-bold hover:bg-gray-100 transition-colors">
                                <Icon name="pen" className="w-3 h-3" /> 다시 풀기
                            </button>
                            <button className="flex items-center justify-center gap-1 py-2 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-colors">
                                <Icon name="play" className="w-3 h-3" /> 해설 강의
                            </button>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-8 text-gray-400 text-xs">
                        해당하는 문항이 없습니다.
                    </div>
                )}
            </div>
        </div>
    );
};

// 8. ClinicTab
export const ClinicTab = ({ studentId, clinicLogs = [], students = [], classes = [] }) => {
    const myClinics = clinicLogs.filter(log => log.studentId === studentId);
    const now = new Date();
    const upcoming = myClinics.filter(log => new Date(log.date + 'T' + log.checkIn) >= now || !log.checkOut).sort((a, b) => new Date(a.date) - new Date(b.date));
    const history = myClinics.filter(log => log.checkOut && new Date(log.date + 'T' + log.checkIn) < now).sort((a, b) => new Date(b.date) - new Date(a.date));
    const myTotalMinutes = history.reduce((acc, log) => acc + calculateDurationMinutes(log.checkIn, log.checkOut), 0);

    const myClassIds = classes.filter(c => c.students.includes(studentId)).map(c => c.id);
    const peerStudentIds = students.filter(s => s.id !== studentId && s.classes.some(cid => myClassIds.includes(cid))).map(s => s.id);
    const peerLogs = clinicLogs.filter(log => peerStudentIds.includes(log.studentId) && log.checkOut);
    const peerTotalMinutes = peerLogs.reduce((acc, log) => acc + calculateDurationMinutes(log.checkIn, log.checkOut), 0);
    const peerCount = peerStudentIds.length;
    const averageMinutes = peerCount > 0 ? Math.round((peerTotalMinutes + myTotalMinutes) / (peerCount + 1)) : myTotalMinutes;

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">이번 달 학습 시간</h3>
                <div className="flex items-end gap-2 mb-2"><span className="text-3xl font-extrabold text-teal-600">{formatDuration(myTotalMinutes)}</span><span className="text-sm text-gray-400 mb-1.5">/ 누적</span></div>
                <div className="space-y-3 pt-2 border-t border-gray-100">
                    <div className="flex justify-between text-xs text-gray-500 mb-1"><span>나의 시간</span><span>반 평균 ({formatDuration(averageMinutes)})</span></div>
                    <div className="w-full bg-gray-100 rounded-full h-2 relative">
                        <div className="absolute top-0 bottom-0 bg-gray-300 w-1 z-10" style={{ left: `${Math.min((averageMinutes / Math.max(averageMinutes, myTotalMinutes, 60)) * 100, 100)}%` }}></div>
                        <div className="bg-teal-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${Math.min((myTotalMinutes / Math.max(averageMinutes, myTotalMinutes, 60)) * 100, 100)}%` }}></div>
                    </div>
                    <p className="text-xs text-center text-gray-400 mt-1">{myTotalMinutes >= averageMinutes ? "훌륭해요! 반 평균보다 더 많이 공부했네요 👍" : "분발하세요! 반 평균보다 조금 부족해요 🔥"}</p>
                </div>
            </div>
            <div className="space-y-3"><h3 className="text-sm font-bold text-gray-900 px-1 flex items-center gap-1"><Icon name="clock" className="w-4 h-4 text-teal-500" /> 예약된 일정</h3>{upcoming.length > 0 ? upcoming.map(log => (<div key={log.id} className="bg-white p-5 rounded-2xl shadow-sm border border-teal-100 flex justify-between items-center"><div><div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">예약됨</span><span className="text-xs text-gray-500">{log.date}</span></div><h4 className="font-bold text-gray-900 text-lg">{log.checkIn} 입실 예정</h4><p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Icon name="user" className="w-3 h-3" /> {log.tutor || '담당 선생님'}</p></div></div>)) : (<div className="text-center py-8 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200 text-sm">예약된 클리닉이 없습니다.</div>)}</div>
            <div className="space-y-3"><h3 className="text-sm font-bold text-gray-900 px-1">지난 기록</h3>{history.length > 0 ? history.map(log => (<div key={log.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center"><div><div className="text-xs text-gray-500 mb-1">{log.date}</div><div className="font-bold text-gray-900 flex items-center gap-2"><span>{log.checkIn} ~ {log.checkOut}</span><span className="text-xs font-normal text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">{formatDuration(calculateDurationMinutes(log.checkIn, log.checkOut))}</span></div></div><div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-teal-500"><Icon name="check" className="w-5 h-5" /></div></div>)) : (<div className="text-center py-8 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200 text-sm">완료된 기록이 없습니다.</div>)}</div>
        </div>
    );
};

// 9. BoardTab
export const BoardTab = ({ notices }) => {
    const [selectedNotice, setSelectedNotice] = useState(null);
    const pinnedNotices = notices.filter(n => n.isPinned);
    const allNotices = [...notices].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className="space-y-6 pb-20">
            {pinnedNotices.length > 0 && (<div className="space-y-3"><h3 className="text-sm font-bold text-red-500 flex items-center gap-1 px-1"><CampaignIcon className="w-5 h-5" /> 중요 공지</h3><div className="space-y-3">{pinnedNotices.map((notice) => (<div key={notice.id} onClick={() => setSelectedNotice(notice)} className="bg-red-50 border border-red-100 p-4 rounded-xl shadow-sm flex flex-col justify-between cursor-pointer"><div><div className="flex justify-between items-start mb-2"><span className="bg-white text-red-500 text-[10px] px-2 py-0.5 rounded font-bold border border-red-200 shadow-sm flex items-center gap-1">필독</span><span className="text-xs text-red-400 font-medium">{notice.date}</span></div><h4 className="font-bold text-lg text-gray-900 leading-tight line-clamp-2 mt-1">{notice.title}</h4></div></div>))}</div></div>)}
            <div className="space-y-3"><h3 className="text-sm font-bold text-gray-900 px-1">전체 글</h3><div className="space-y-3">{allNotices.length > 0 ? allNotices.map((notice) => (<div key={notice.id} onClick={() => setSelectedNotice(notice)} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center cursor-pointer active:bg-gray-50 transition-colors"><div className="flex-1 min-w-0 pr-4"><div className="flex items-center gap-2 mb-1">{notice.isPinned && <CampaignIcon className="w-4 h-4 text-red-500 shrink-0" />}<h4 className="text-sm font-bold truncate text-gray-900">{notice.title}</h4></div><div className="flex items-center gap-2 text-xs text-gray-400"><span>{notice.author}</span><span className="w-0.5 h-2 bg-gray-300"></span><span>{notice.date}</span></div></div><Icon name="chevronRight" className="w-4 h-4 text-gray-300 shrink-0" /></div>)) : (<div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">등록된 게시글이 없습니다.</div>)}</div></div>
            {selectedNotice && <ModalPortal><div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedNotice(null)}><div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-fade-in-up max-h-[80vh] overflow-y-auto custom-scrollbar relative" onClick={e => e.stopPropagation()}><button onClick={() => setSelectedNotice(null)} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-900 rounded-full hover:bg-gray-100"><Icon name="x" className="w-6 h-6" /></button><div className="mb-4 pr-8"><div className="flex items-center gap-2 mb-2"><span className="text-xs font-bold text-white bg-brand-main px-2 py-1 rounded-full">{selectedNotice.author}</span><span className="text-xs text-gray-500">{selectedNotice.date}</span></div><h3 className="text-xl font-bold text-gray-900 leading-tight">{selectedNotice.title}</h3></div><div className="prose prose-sm max-w-none text-gray-800 leading-relaxed border-t border-gray-100 pt-4 min-h-[100px]"><div dangerouslySetInnerHTML={{ __html: selectedNotice.content }} /></div>{selectedNotice.attachments && selectedNotice.attachments.length > 0 && (<div className="mt-6 pt-4 border-t border-gray-100"><p className="text-xs font-bold text-gray-500 mb-2">첨부파일</p><div className="flex flex-wrap gap-2">{selectedNotice.attachments.map((file, idx) => (<button key={idx} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg text-sm text-brand-main hover:bg-gray-100 transition-colors"><Icon name="fileText" className="w-4 h-4" />{file}</button>))}</div></div>)}</div></div></ModalPortal>}
        </div>
    );
};