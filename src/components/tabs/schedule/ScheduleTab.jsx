import React, { useState } from 'react';
import { Icon, getWeekOfMonth } from '../../../utils/helpers';
import ModalPortal from '../../common/ModalPortal';
import { useParentContext } from '../../../parent';

export default function ScheduleTab({
    myClasses, externalSchedules, attendanceLogs, clinicLogs, studentId,
    onSaveExternalSchedule, onDeleteExternalSchedule
}) {
    const { activeStudentId } = useParentContext();
    const resolvedStudentId = studentId ?? activeStudentId;

    const [viewType, setViewType] = useState('weekly');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const todayStr = new Date().toISOString().split('T')[0];
    const [newSchedule, setNewSchedule] = useState({
        academyName: '',
        courseName: '',
        instructor: '',
        startDate: todayStr,
        endDate: '',
        days: [],
        startTime: '',
        endTime: ''
    });

    const normalizeDays = (days) => {
        if (!days) return [];
        if (Array.isArray(days)) {
            return days
            .map((d) => (typeof d === 'string' ? d.trim() : ''))
            .map((d) => d.replace('요일', ''))   // "월요일" -> "월"
            .filter(Boolean);
        }
        if (typeof days === 'string') {
            return days
            .split(/[,\s/]+/)                   // "월, 수" / "월 수" / "월/수"
            .map((d) => d.trim())
            .map((d) => d.replace('요일', ''))
            .filter(Boolean);
        }
        return [];
    };


    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [targetScheduleForDelete, setTargetScheduleForDelete] = useState(null);

    const formatDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const startOfDay = (d) => {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
    };

    // ✅ "YYYY-MM-DD"를 로컬 날짜로 파싱 (UTC 밀림 방지)
    const parseLocalYmd = (value) => {
        if (!value || typeof value !== 'string') return null;
        const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return null;
        const [, y, mo, da] = m;
        return startOfDay(new Date(Number(y), Number(mo) - 1, Number(da)));
    };

    const isDateInRange = (dateObj, startDateStr, endDateStr) => {
        const day = startOfDay(dateObj);
        const start = parseLocalYmd(startDateStr);
        const end = parseLocalYmd(endDateStr);

        if (start && day < start) return false;
        if (end && day > end) return false;
        return true;
    };

    const normalizeId = (v) => (v === null || v === undefined ? '' : String(v));

    const handleOpenAddModal = () => {
        setNewSchedule({
            academyName: '',
            courseName: '',
            instructor: '',
            startDate: todayStr,
            endDate: '',
            days: [],
            startTime: '',
            endTime: ''
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
        if (
            !newSchedule.academyName ||
            !newSchedule.courseName ||
            !newSchedule.startDate ||
            newSchedule.days.length === 0 ||
            !newSchedule.startTime
        ) {
            alert('필수 정보를 모두 입력해주세요.');
            return;
        }
        if (!resolvedStudentId) {
            alert('학생 정보를 불러오는 중입니다.');
            return;
        }

        onSaveExternalSchedule({
            id: isEditMode ? editingId : null,
            studentId: resolvedStudentId,
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
        onDeleteExternalSchedule(targetScheduleForDelete.scheduleId, mode, formatDate(selectedDate));
        setIsDeleteModalOpen(false);
        setTargetScheduleForDelete(null);
    };

    const toggleDay = (day) => {
        setNewSchedule(prev => {
            const newDays = prev.days.includes(day)
                ? prev.days.filter(d => d !== day)
                : [...prev.days, day];

            const dayOrder = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
            newDays.sort((a, b) => dayOrder[a] - dayOrder[b]);

            return { ...prev, days: newDays };
        });
    };

    const KOR_DAYS = ['월','화','수','목','금','토','일'];

    const extractDays = (raw) => {
        if (!raw) return [];
        if (Array.isArray(raw)) {
            return raw
            .map(v => (typeof v === 'string' ? v.trim().replace('요일','') : ''))
            .filter(v => KOR_DAYS.includes(v));
        }
        if (typeof raw === 'string') {
            const cleaned = raw.replaceAll('요일', ' ');
            const found = KOR_DAYS.filter(d => cleaned.includes(d));
            return Array.from(new Set(found));
        }
        if (typeof raw === 'object') {
            return extractDays(raw.days || raw.weekDays || raw.weekdays || raw.dayOfWeek);
        }
        return [];
    };

    const extractTimeFromString = (s) => {
        if (typeof s !== 'string') return '';
        // "18:00-22:00" / "18:00~22:00" 둘 다 허용
        const m = s.match(/(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/);
        if (!m) return '';
        return `${m[1]}~${m[2]}`;
    };

    const resolveClassSchedule = (cls) => {
        const raw = cls?.schedule; // map일 수도, string일 수도, 없을 수도
        const days = extractDays((raw && typeof raw === 'object') ? raw.days : raw);
        const time =
            (raw && typeof raw === 'object' && typeof raw.time === 'string' ? raw.time : '') ||
            (typeof cls?.scheduleTime === 'string' ? cls.scheduleTime : '') ||
            (typeof cls?.time === 'string' ? cls.time : '') ||
            extractTimeFromString(typeof raw === 'string' ? raw : '') ||
            '';

        return { days, time }; 
    };

    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

    const baseDate = new Date(selectedDate);
    const sunday = new Date(baseDate);
    sunday.setDate(baseDate.getDate() - baseDate.getDay());
    const { month: weekMonth, week: weekNum } = getWeekOfMonth(sunday);

    const prevWeek = () => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() - 7);
        setSelectedDate(d);
    };

    const nextWeek = () => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + 7);
        setSelectedDate(d);
    };

    const prevMonth = () => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
    const nextMonth = () => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));

    const calendarDays =
        Array(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay())
            .fill(null)
            .concat(
                [...Array(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate()).keys()]
                    .map(i => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i + 1))
            );

    const safeExternalSchedules = Array.isArray(externalSchedules) ? externalSchedules : [];

    const getDayInfo = (date) => {
        if (!date) return { hasClass: false, status: null, hasExternal: false, hasClinic: false };

        const dateStr = formatDate(date);
        const dayOfWeek = weekDays[date.getDay()];

        const dayClasses = myClasses.filter(cls => resolveClassSchedule(cls).days.includes(dayOfWeek));

        // ✅ 여기 수정: 로컬 날짜 파싱 + startOfDay 비교
        const myExternal = safeExternalSchedules.filter(s => {
            if (normalizeId(s.studentId) !== normalizeId(resolvedStudentId)) return false;
            if (!Array.isArray(s.days) || !s.days.includes(dayOfWeek)) return false;

            if (!isDateInRange(date, s.startDate, s.endDate || '')) return false;

            if (Array.isArray(s.excludedDates) && s.excludedDates.includes(dateStr)) return false;
            return true;
        });

        const myClinics = clinicLogs
            ? clinicLogs.filter(log => normalizeId(log.studentId) === normalizeId(resolvedStudentId) && log.date === dateStr)
            : [];

        const logs = attendanceLogs
            ? attendanceLogs.filter(log => normalizeId(log.studentId) === normalizeId(resolvedStudentId) && log.date === dateStr)
            : [];

        let status = null;
        if (logs.length > 0) {
            if (logs.some(l => l.status === '결석')) status = '결석';
            else if (logs.some(l => l.status === '지각')) status = '지각';
            else status = '출석';
        }

        return {
            hasClass: (dayClasses.length > 0),
            status,
            hasExternal: myExternal.length > 0,
            hasClinic: myClinics.length > 0
        };
    };

    const renderSchedules = () => {
        const dayOfWeek = weekDays[selectedDate.getDay()];
        const dateStr = formatDate(selectedDate);

        const dailyClasses = myClasses
            .filter(cls => resolveClassSchedule(cls).days.includes(dayOfWeek))
            .map(cls => {
                const { time } = resolveClassSchedule(cls);
                return {
                    id: `math-${cls.id}`,
                    type: 'math',
                    name: cls.name,
                    teacher: cls.teacher,
                    time: time ? time.replace('-', '~') : '시간 미정',
                    scheduleId: cls.id,
                };
        });

        // ✅ 여기 수정: 로컬 날짜 파싱 + startOfDay 비교
        const myExternal = safeExternalSchedules.filter(s => {
            if (normalizeId(s.studentId) !== normalizeId(resolvedStudentId)) return false;
            if (!Array.isArray(s.days) || !s.days.includes(dayOfWeek)) return false;

            if (!isDateInRange(selectedDate, s.startDate, s.endDate || '')) return false;

            if (Array.isArray(s.excludedDates) && s.excludedDates.includes(dateStr)) return false;
            return true;
        });

        const dailyExternal = myExternal.map(s => ({
            id: `ext-${s.id}`,
            type: 'external',
            name: s.academyName,
            teacher: s.courseName,
            time: `${s.startTime}~${s.endTime || ''}`,
            scheduleId: s.id,
            ...s
        }));

        const myClinics = clinicLogs
            ? clinicLogs
                .filter(log => normalizeId(log.studentId) === normalizeId(resolvedStudentId) && log.date === dateStr)
                .map(log => ({
                    id: `clinic-${log.id}`,
                    type: 'clinic',
                    name: '학습 클리닉',
                    teacher: log.tutor || '담당 선생님',
                    time: log.checkIn ? `${log.checkIn}~${log.checkOut || ''}` : '시간 미정',
                    status: log.checkOut ? '완료' : '예약됨',
                    scheduleId: log.id
                }))
            : [];

        const safeStart = (t) => (typeof t === 'string' ? (t.split('~')[0] || '00:00') : '00:00');
        const allSchedules = [...dailyClasses, ...dailyExternal, ...myClinics]
            .sort((a, b) => safeStart(a.time).localeCompare(safeStart(b.time)));


        if (allSchedules.length === 0) {
            return (
                <div className="text-center py-20 text-brand-gray bg-white rounded-2xl border border-dashed border-brand-gray/50">
                    <p className="font-bold text-brand-gray mb-1">
                        {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({dayOfWeek})
                    </p>
                    일정이 없습니다.
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 gap-4">
                {allSchedules.map((item) => {
                    let log = null;
                    let borderColor = 'border-brand-main/30';
                    let dotColor = 'bg-brand-main';
                    let typeLabel = '수학 학원';
                    let typeClass = 'text-brand-main bg-brand-light/30';

                    if (item.type === 'math') {
                        log = attendanceLogs
                            ? attendanceLogs.find(l =>
                                normalizeId(l.studentId) === normalizeId(resolvedStudentId)
                                && l.classId === item.scheduleId
                                && l.date === dateStr
                            )
                            : null;

                        if (log?.status === '출석') dotColor = 'bg-green-500';
                        else if (log?.status === '지각') dotColor = 'bg-yellow-400';
                        else if (log?.status === '결석') dotColor = 'bg-brand-red';
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
                                            <p className="text-sm text-brand-gray flex items-center gap-1">
                                                <Icon name="users" className="w-4 h-4" /> {item.teacher} 선생님
                                            </p>
                                            {log && (
                                                <span className={`text-xs font-bold px-2 py-1 rounded ${log.status === '출석'
                                                    ? 'bg-green-100 text-green-700'
                                                    : log.status === '지각'
                                                        ? 'bg-yellow-100 text-yellow-700'
                                                        : 'bg-brand-red/10 text-brand-red'
                                                    }`}
                                                >
                                                    {log.status}
                                                </span>
                                            )}
                                        </>
                                    ) : item.type === 'clinic' ? (
                                        <>
                                            <p className="text-sm text-brand-gray flex items-center gap-1">
                                                <Icon name="user" className="w-4 h-4" /> {item.teacher}
                                            </p>
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${item.status === '완료'
                                                ? 'bg-teal-100 text-teal-700'
                                                : 'bg-teal-50 text-teal-600 border border-teal-200'
                                                }`}
                                            >
                                                {item.status}
                                            </span>
                                        </>
                                    ) : (
                                        <div className="w-full flex justify-end gap-3">
                                            <span className="text-xs text-brand-main opacity-0 group-hover:opacity-100 transition-opacity">
                                                수정
                                            </span>
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

    console.log('[ScheduleTab] myClasses len=', myClasses?.length, 'first schedule=', myClasses?.[0]?.schedule);

    return (
        <div className="pb-24 relative animate-fade-in-up">
            <div className="flex justify-between items-center mb-6 px-1">
                <h2 className="text-2xl font-bold text-brand-black">수업일정</h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleOpenAddModal}
                        className="bg-brand-main hover:bg-brand-dark text-white px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 shadow-md transition-all active:scale-95"
                    >
                        <Icon name="plus" className="w-4 h-4" /> 일정 추가
                    </button>
                    <div className="bg-white p-1 rounded-xl border border-brand-gray/30 shadow-sm flex h-[32px] items-center">
                        <button
                            onClick={() => setViewType('weekly')}
                            className={`px-3 py-0 h-full flex items-center rounded-lg text-xs font-bold transition-all ${viewType === 'weekly'
                                ? 'bg-brand-main text-white shadow-md'
                                : 'text-brand-gray hover:text-brand-black'
                                }`}
                        >
                            주간
                        </button>
                        <button
                            onClick={() => { setViewType('monthly'); setSelectedDate(new Date()); }}
                            className={`px-3 py-0 h-full flex items-center rounded-lg text-xs font-bold transition-all ${viewType === 'monthly'
                                ? 'bg-brand-main text-white shadow-md'
                                : 'text-brand-gray hover:text-brand-black'
                                }`}
                        >
                            월간
                        </button>
                    </div>
                </div>
            </div>

            {viewType === 'weekly' ? (
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2 mb-2">
                        <button
                            onClick={prevWeek}
                            className="p-2 bg-white rounded-full shadow-sm text-brand-gray hover:text-brand-main hover:bg-brand-bg active:bg-gray-200 transition-colors"
                        >
                            <Icon name="chevronLeft" className="w-5 h-5" />
                        </button>
                        <span className="font-bold text-brand-black text-lg">{weekMonth}월 {weekNum}주차</span>
                        <button
                            onClick={nextWeek}
                            className="p-2 bg-white rounded-full shadow-sm text-brand-gray hover:text-brand-main hover:bg-brand-bg active:bg-gray-200 transition-colors"
                        >
                            <Icon name="chevronRight" className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex justify-between bg-white p-1.5 rounded-2xl shadow-sm border border-brand-gray/30 overflow-x-auto">
                        {weekDays.map((day, index) => {
                            const date = new Date(sunday);
                            date.setDate(sunday.getDate() + index);

                            const isSelected = formatDate(date) === formatDate(selectedDate);
                            const isToday = formatDate(date) === todayStr;
                            const { hasClass, status, hasExternal, hasClinic } = getDayInfo(date);

                            return (
                                <button
                                    key={day}
                                    onClick={() => setSelectedDate(date)}
                                    className={`flex flex-col items-center p-1 rounded-xl flex-1 transition-all min-w-[32px] relative active:scale-95 ${isSelected ? 'bg-brand-main text-white shadow-brand scale-105' : 'hover:bg-brand-bg'} ${!isSelected && isToday ? 'text-brand-main font-bold' : ''} ${!isSelected && !isToday ? 'text-brand-gray' : ''}`}
                                >
                                    <span className="text-[10px] mb-0.5">{day}</span>
                                    <span className={`font-bold ${isSelected ? 'text-base' : 'text-sm'}`}>{date.getDate()}</span>
                                    <div className="flex gap-0.5 mt-1 h-1.5 items-center">
                                        {(hasClass || status) && (
                                            <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : (status === '출석' ? 'bg-green-500' : status === '지각' ? 'bg-yellow-400' : status === '결석' ? 'bg-brand-red' : 'bg-brand-gray')}`}></div>
                                        )}
                                        {hasExternal && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-brand-light'}`}></div>}
                                        {hasClinic && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-teal-400'}`}></div>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="space-y-4">{renderSchedules()}</div>
                </div>
            ) : (
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="bg-white rounded-3xl shadow-lg p-6 border border-brand-gray/30 mb-6 max-w-md mx-auto w-full md:w-1/2 flex-shrink-0 h-fit">
                        <div className="flex justify-between items-center mb-6">
                            <button onClick={prevMonth} className="p-2 hover:bg-brand-bg rounded-full text-brand-gray active:bg-gray-200">
                                <Icon name="chevronLeft" className="w-5 h-5" />
                            </button>
                            <h3 className="text-lg font-bold text-brand-black">{selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월</h3>
                            <button onClick={nextMonth} className="p-2 hover:bg-brand-bg rounded-full text-brand-gray active:bg-gray-200">
                                <Icon name="chevronRight" className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-7 mb-2 text-center">
                            {weekDays.map((day, i) => (
                                <div key={day} className={`text-xs font-bold ${i === 0 ? 'text-brand-red' : 'text-brand-gray'}`}>{day}</div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-y-4 gap-x-1">
                            {calendarDays.map((date, index) => {
                                if (!date) return <div key={index}></div>;

                                const { hasClass, status, hasExternal, hasClinic } = getDayInfo(date);
                                const isSelected = formatDate(date) === formatDate(selectedDate);
                                const isToday = formatDate(date) === todayStr;

                                return (
                                    <div
                                        key={index}
                                        className="flex flex-col items-center cursor-pointer group active:scale-90 transition-transform"
                                        onClick={() => setSelectedDate(date)}
                                    >
                                        <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all ${isSelected ? 'bg-brand-main text-white shadow-brand scale-110' : ''} ${!isSelected && isToday ? 'text-brand-main font-bold bg-brand-light/30' : ''} ${!isSelected && !isToday ? 'text-brand-black group-hover:bg-brand-bg' : ''}`}>
                                            {date.getDate()}
                                        </div>

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

                    <div className="space-y-4 w-full md:w-1/2 flex-1">{renderSchedules()}</div>
                </div>
            )}

            {/* Modal Components */}
            {isScheduleModalOpen && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsScheduleModalOpen(false)}>
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-brand-black mb-4">타학원 일정 {isEditMode ? '수정' : '등록'}</h3>

                            <div className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar px-1">
                                <div>
                                    <label className="block text-xs font-bold text-brand-gray mb-1">학원명 *</label>
                                    <input
                                        type="text"
                                        value={newSchedule.academyName}
                                        onChange={e => setNewSchedule({ ...newSchedule, academyName: e.target.value })}
                                        className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none"
                                        placeholder="예: 정상어학원"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-brand-gray mb-1">강의명 *</label>
                                    <input
                                        type="text"
                                        value={newSchedule.courseName}
                                        onChange={e => setNewSchedule({ ...newSchedule, courseName: e.target.value })}
                                        className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none"
                                        placeholder="예: TOP반 영어"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-brand-gray mb-1">강사</label>
                                    <input
                                        type="text"
                                        value={newSchedule.instructor}
                                        onChange={e => setNewSchedule({ ...newSchedule, instructor: e.target.value })}
                                        className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none"
                                        placeholder="예: Julie 선생님"
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-brand-gray mb-1">개강일 *</label>
                                        <input
                                            type="date"
                                            value={newSchedule.startDate}
                                            onChange={e => setNewSchedule({ ...newSchedule, startDate: e.target.value })}
                                            className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-brand-gray mb-1">종강일</label>
                                        <input
                                            type="date"
                                            value={newSchedule.endDate}
                                            onChange={e => setNewSchedule({ ...newSchedule, endDate: e.target.value })}
                                            className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-brand-gray mb-1">수업 요일 *</label>
                                    <div className="flex gap-1 justify-between">
                                        {['월', '화', '수', '목', '금', '토', '일'].map(d => (
                                            <button
                                                key={d}
                                                onClick={() => toggleDay(d)}
                                                className={`w-8 h-8 rounded-full text-xs font-bold transition-colors active:scale-90 ${newSchedule.days.includes(d)
                                                    ? 'bg-brand-main text-white'
                                                    : 'bg-brand-bg text-brand-gray hover:bg-brand-gray/30'
                                                    }`}
                                                type="button"
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-brand-gray mb-1">시작 시간 *</label>
                                        <input
                                            type="time"
                                            value={newSchedule.startTime}
                                            onChange={e => setNewSchedule({ ...newSchedule, startTime: e.target.value })}
                                            className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-brand-gray mb-1">종료 시간</label>
                                        <input
                                            type="time"
                                            value={newSchedule.endTime}
                                            onChange={e => setNewSchedule({ ...newSchedule, endTime: e.target.value })}
                                            className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveSubmit}
                                    className="w-full bg-brand-main hover:bg-brand-dark text-white font-bold py-3 rounded-xl mt-2 transition-colors active:scale-95"
                                    type="button"
                                >
                                    {isEditMode ? '수정 완료' : '등록하기'}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {isDeleteModalOpen && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)}>
                        <div className="bg-white rounded-2xl w-full max-w-xs p-6 shadow-2xl animate-fade-in-up text-center" onClick={e => e.stopPropagation()}>
                            <div className="w-12 h-12 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-red">
                                <Icon name="trash" className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-brand-black mb-2">반복 일정 삭제</h3>
                            <p className="text-sm text-brand-gray mb-6">이 일정을 어떻게 삭제하시겠습니까?</p>

                            <div className="space-y-2">
                                <button onClick={() => executeDelete('instance')} className="w-full bg-white border border-brand-gray/30 text-brand-black hover:bg-brand-bg font-bold py-3 rounded-xl text-sm transition-colors active:bg-gray-100" type="button">
                                    이 일정만 삭제
                                </button>
                                <button onClick={() => executeDelete('future')} className="w-full bg-white border border-brand-gray/30 text-brand-black hover:bg-brand-bg font-bold py-3 rounded-xl text-sm transition-colors active:bg-gray-100" type="button">
                                    이 일정 및 향후 일정 삭제
                                </button>
                                <button onClick={() => executeDelete('all')} className="w-full bg-brand-red text-white hover:bg-red-600 font-bold py-3 rounded-xl text-sm transition-colors active:bg-red-700" type="button">
                                    전체 삭제
                                </button>
                            </div>

                            <button onClick={() => setIsDeleteModalOpen(false)} className="mt-4 text-xs text-brand-gray hover:text-brand-black underline active:text-gray-900" type="button">
                                취소
                            </button>
                        </div>
                    </div>
                </ModalPortal>
            )}
        </div>
    );
}