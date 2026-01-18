import React from 'react';
import { Icon } from '../../../utils/helpers';

export default function DashboardTab({
    student,
    myClasses = [],
    attendanceLogs = [],
    clinicLogs = [],
    homeworkStats = [],
    notices = [],
    setActiveTab,
    externalSchedules = [],
    isParent = false,
    today: todayOverride,
    todayDayName: todayDayNameOverride,
    filteredTodayItems: filteredTodayItemsOverride,
}) {
    const hasStudent = Boolean(student);
    const isDev = process.env.NODE_ENV !== 'production';

    if (isDev) {
        console.debug('[DashboardTab] render', {
            hasStudent,
            myClassesLength: myClasses.length,
            attendanceLogsLength: attendanceLogs.length,
            clinicLogsLength: clinicLogs.length,
            homeworkStatsLength: homeworkStats.length,
            noticesLength: notices.length,
            externalSchedulesLength: externalSchedules.length
        });
    }

    if (!hasStudent) {
        return (
            <div className="space-y-6 pb-24 animate-fade-in-up">
                <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-200 text-center">
                    <p className="text-lg font-bold text-gray-800 mb-2">학생 정보를 불러오는 중입니다.</p>
                    <p className="text-sm text-gray-500">잠시만 기다려 주세요. 데이터가 준비되는 대로 대시보드를 보여드릴게요.</p>
                </div>
            </div>
        );
    }

    const today = todayOverride || new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const todayDayName = todayDayNameOverride || dayNames[today.getDay()];
    const studentId = student?.id;
    const filteredTodayItems = Array.isArray(filteredTodayItemsOverride) ? filteredTodayItemsOverride : [];

    const todayClasses = myClasses.filter(cls => cls.schedule.days.includes(todayDayName)).map(cls => ({
        type: 'class', name: cls.name, time: cls.schedule.time, teacher: cls.teacher, sortTime: cls.schedule.time.split('~')[0]
    }));
    const todayClinics = studentId ? clinicLogs.filter(log => log.studentId === studentId && log.date === todayStr && !log.checkOut).map(log => ({
        type: 'clinic', name: '학습 클리닉', time: `${log.checkIn} 입실`, teacher: log.tutor || '담당 선생님', sortTime: log.checkIn
    })) : [];
    const todayExternal = studentId ? externalSchedules.filter(s => s.studentId === studentId && s.days.includes(todayDayName) && todayStr >= s.startDate && (!s.endDate || todayStr <= s.endDate)).map(s => ({
        type: 'external', academyName: s.academyName, courseName: s.courseName, instructor: s.instructor, time: `${s.startTime}~${s.endTime}`, sortTime: s.startTime
    })) : [];

    const allEvents = [...todayClasses, ...todayClinics, ...todayExternal].sort((a, b) => a.sortTime.localeCompare(b.sortTime));
    const nowTimeStr = today.toTimeString().slice(0, 5); 
    let keyEvent = allEvents.find(e => { let endTime = '23:59'; if (e.time.includes('~')) endTime = e.time.split('~')[1]; return endTime >= nowTimeStr; });
    const pendingHomework = homeworkStats.filter(h => !h.isComplete);
    const studentLogs = studentId ? attendanceLogs.filter(l => l.studentId === studentId) : [];
    const attendanceRate = studentLogs.length > 0 ? Math.round((studentLogs.filter(l => ['출석','동영상보강'].includes(l.status)).length / studentLogs.length) * 100) : null;
    const momentumCards = [
        { label: '진행 중 과제', value: pendingHomework.length, accent: 'bg-gradient-to-r from-[#FF9AA2] to-[#FF4D6D]', chip: 'Homework', onClick: () => setActiveTab('learning') },
        { label: '오늘의 일정', value: allEvents.length, accent: 'bg-gradient-to-r from-[#7CD1FF] to-[#4F8DF5]', chip: 'Schedule', onClick: () => setActiveTab('schedule') },
        { label: '출석률', value: attendanceRate !== null ? `${attendanceRate}%` : '--', accent: 'bg-gradient-to-r from-[#B8F5CB] to-[#36D399]', chip: 'Attendance', onClick: () => setActiveTab('class') },
    ];

    const attendanceAlerts = !studentId ? [] : myClasses.reduce((alerts, cls) => {
        const clsLogs = attendanceLogs.filter(l => l.classId === cls.id && l.studentId === studentId);
        const recentAbsent = clsLogs.find(l => { const logDate = new Date(l.date); const diffTime = Math.abs(today - logDate); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); return l.status === '결석' && diffDays <= 7; });
        const rate = Math.round((clsLogs.filter(l => ['출석','동영상보강'].includes(l.status)).length / clsLogs.length) * 100);
        if (recentAbsent) alerts.push({ type: 'absent', class: cls.name, msg: '최근 결석이 발생했습니다.' });
        else if (rate < 80) alerts.push({ type: 'rate', class: cls.name, msg: `출석률이 낮습니다 (${rate}%)` });
        return alerts;
    }, []);

    return (
        <div className="space-y-6 pb-24 animate-fade-in-up">
            <div className="relative overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_18%_25%,rgba(56,189,248,0.24),transparent_40%),radial-gradient(circle_at_82%_20%,rgba(45,212,191,0.22),transparent_40%),linear-gradient(135deg,#0a1434,#1d4ed8,#0d9488)] p-6 shadow-brand text-white">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.3),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.25),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(255,255,255,0.2),transparent_25%)]"></div>
                <div className="relative z-10 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-white/80">{today.getMonth()+1}월 {today.getDate()}일 {todayDayName}요일</p>
                            <h2 className="text-2xl font-bold leading-tight mt-1">{isParent ? `안녕하세요, ${student.name} 학부모님!` : `반가워요, ${student.name}님! 👋`}</h2>
                            <p className="text-sm text-white/80 mt-1">오늘의 일정과 학습 현황을 한눈에 살펴보세요.</p>
                        </div>
                        <div className="hidden md:flex items-center gap-3 bg-white/10 px-4 py-3 rounded-2xl backdrop-blur-sm border border-white/20">
                            <span className="text-xs uppercase tracking-wide text-white/70">Next</span>
                            <div className="text-right">
                                <p className="text-sm font-semibold">{keyEvent ? (keyEvent.type === 'external' ? keyEvent.courseName : keyEvent.name) : '오늘 일정 없음'}</p>
                                <p className="text-xs text-white/70">{keyEvent ? keyEvent.time : '휴식도 중요해요 🙌'}</p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="rounded-2xl bg-white/15 border border-white/25 px-3 py-3">
                            <p className="text-white/70 mb-1 flex items-center gap-1"><Icon name="calendar" className="w-3.5 h-3.5 text-white/90" />오늘 수업</p>
                            <p className="text-lg font-bold">{allEvents.length}개</p>
                        </div>
                        <div className="rounded-2xl bg-white/15 border border-white/25 px-3 py-3">
                            <p className="text-white/70 mb-1 flex items-center gap-1"><Icon name="clipboardCheck" className="w-3.5 h-3.5 text-white/90" />남은 과제</p>
                            <p className="text-lg font-bold">{pendingHomework.length}개</p>
                        </div>
                        <div className="rounded-2xl bg-white/15 border border-white/25 px-3 py-3">
                            <p className="text-white/70 mb-1 flex items-center gap-1"><Icon name="activity" className="w-3.5 h-3.5 text-white/90" />출석률</p>
                            <p className="text-lg font-bold">{attendanceRate !== null ? `${attendanceRate}%` : '기록 없음'}</p>
                        </div>
                    </div>
                </div>
            </div>
            {attendanceAlerts.length > 0 && (<div className="space-y-2">{attendanceAlerts.map((alert, idx) => (<div key={idx} onClick={() => setActiveTab('class')} className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-3 cursor-pointer active:bg-red-100 transition-colors"><div className="bg-white p-1.5 rounded-full text-red-500 shadow-sm"><Icon name="alertCircle" className="w-5 h-5" /></div><div className="flex-1"><p className="text-xs text-red-500 font-bold">{alert.class}</p><p className="text-sm font-bold text-gray-800">{alert.msg}</p></div><Icon name="chevronRight" className="w-4 h-4 text-red-300" /></div>))}</div>)}
            {/* 오늘의 수업 */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Icon name="calendar" className="w-4 h-4 text-indigo-600" />
                        오늘의 수업 ({filteredTodayItems.length})
                    </h3>
                    <span className="text-xs text-gray-500">
                        {today.getMonth() + 1}월 {today.getDate()}일 ({todayDayName})
                    </span>
                </div>

                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredTodayItems.length > 0 ? (
                        filteredTodayItems.map((item, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-3 p-3 hover:bg-indigo-50 rounded-xl transition-colors border border-gray-100"
                            >
                                <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    {item.time}
                                </span>
                                <div>
                                    <div className="font-bold text-gray-900 text-sm">
                                        {item.title} {item.timeLabel ? `(${item.timeLabel})` : ''}
                                    </div>
                                    <div className="text-xs text-gray-500">{item.sub}</div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-8 text-center text-gray-400 text-xs sm:col-span-2">
                            예정된 학원 일정이 없습니다.
                        </div>
                    )}
                </div>
            </section>
            <div><div className="flex justify-between items-end mb-3 px-1"><h3 className="text-lg font-bold text-gray-800 flex items-center"><Icon name="clipboardCheck" className="w-5 h-5 mr-2 text-brand-red" />놓치면 안 돼요!</h3><button onClick={() => setActiveTab('learning')} className="text-xs text-gray-500 underline active:text-gray-800">전체보기</button></div><div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 snap-x scrollbar-hide">{homeworkStats.filter(h => !h.isComplete).length > 0 ? (homeworkStats.filter(h => !h.isComplete).map(hw => {
                const isNotStarted = (hw.checkedCount || 0) === 0;
                const isReviewing = (hw.checkedCount || 0) >= (hw.totalQuestions || 0) && (hw.incorrectCount || 0) > 0;
                const accentClass = isNotStarted ? 'bg-brand-red' : isReviewing ? 'bg-amber-500' : 'bg-brand-main';
                const badgeClass = isNotStarted ? 'bg-red-100 text-red-600' : isReviewing ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-600';
                const assignedDate = hw.assignedDate || hw.date || '';
                return (
                    <div key={hw.id} className="snap-center shrink-0 w-64 bg-white p-4 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden active:scale-95 transition-transform">
                        <div className={`absolute top-0 left-0 w-1.5 h-full ${accentClass}`}></div>
                        <div className="flex justify-between items-start mb-2 pl-2">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeClass}`}>{hw.status}</span>
                            <span className="text-[10px] text-gray-400">~{assignedDate ? assignedDate.slice(5) : ''}</span>
                        </div>
                        <h4 className="font-bold text-gray-900 text-sm mb-1 pl-2 truncate">{hw.content}</h4>
                        <p className="text-xs text-gray-500 pl-2 mb-3">{hw.book}</p>
                        <div className="pl-2">
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                                <div className="bg-brand-main h-1.5 rounded-full" style={{ width: `${hw.completionRate}%` }}></div>
                            </div>
                            <p className="text-[10px] text-right text-gray-400 mt-1">{hw.completionRate}% 달성</p>
                        </div>
                    </div>
                );
            })) : (<div className="w-full bg-white p-5 rounded-2xl border border-gray-100 text-center"><p className="text-sm text-gray-500">모든 과제를 완료했어요! 훌륭해요 👏</p></div>)}</div></div>
            <div><h3 className="text-lg font-bold text-gray-800 mb-3 px-1">📢 최근 소식</h3><div className="bg-white rounded-2xl shadow-sm border border-gray-200 divide-y divide-gray-100">{notices.slice(0, 3).map(notice => (<div key={notice.id} onClick={() => setActiveTab('board')} className="p-4 flex justify-between items-center cursor-pointer active:bg-gray-50 transition-colors"><div className="flex-1 min-w-0 mr-4"><div className="flex items-center gap-2 mb-1">{notice.isPinned && <span className="text-[10px] bg-brand-red text-white px-1 rounded">필독</span>}<h4 className="text-sm font-bold text-gray-900 truncate">{notice.title}</h4></div><p className="text-xs text-gray-400">{notice.date}</p></div><Icon name="chevronRight" className="w-4 h-4 text-gray-300" /></div>))}{notices.length === 0 && (<div className="p-4 text-center text-gray-500 text-sm">새로운 공지사항이 없습니다.</div>)}</div></div>
        </div>
    );
};