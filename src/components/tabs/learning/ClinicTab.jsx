import React from 'react';
import { Icon, calculateDurationMinutes, formatDuration } from '../../../utils/helpers';
import ClinicReportCard from './ClinicReportCard';

export default function ClinicTab({ studentId, clinicLogs = [], students = [], classes = [], isParent = false }) {
    const myClinics = clinicLogs.filter(log => log.studentId === studentId);
    const now = new Date();
    
    const upcoming = myClinics.filter(log => new Date(log.date + 'T' + log.checkIn) >= now || !log.checkOut).sort((a, b) => new Date(a.date) - new Date(b.date));
    const history = myClinics.filter(log => log.checkOut && new Date(log.date + 'T' + log.checkIn) < now).sort((a, b) => new Date(b.date) - new Date(a.date));

    // --- [학부모 모드] 렌더링 ---
    if (isParent) {
        return (
            <div className="space-y-8 animate-fade-in-up">
                {upcoming.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-gray-900 px-1 flex items-center gap-1">
                            <Icon name="clock" className="w-4 h-4 text-teal-500" /> 예약된 일정
                        </h3>
                        {upcoming.map(log => (
                            <div key={log.id} className="bg-white p-5 rounded-2xl shadow-sm border border-teal-100 flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">예약됨</span>
                                        <span className="text-xs text-gray-500">{log.date}</span>
                                    </div>
                                    <h4 className="font-bold text-gray-900 text-lg">{log.checkIn} 입실 예정</h4>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 px-1 border-b border-gray-100 pb-2">
                        클리닉 리포트 ({history.length})
                    </h3>
                    {history.length > 0 ? (
                        history.map(log => <ClinicReportCard key={log.id} log={log} />)
                    ) : (
                        <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                            <p className="text-sm">아직 작성된 리포트가 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- [학생 모드] 렌더링 ---
    const myTotalMinutes = history.reduce((acc, log) => acc + calculateDurationMinutes(log.checkIn, log.checkOut), 0);
    const myClassIds = classes.filter(c => (c.students || []).includes(studentId)).map(c => c.id);
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