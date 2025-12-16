// src/pages/parent/ParentClassroomView.jsx
import React, { useState, useMemo } from 'react';
import { Icon } from '../../utils/helpers';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';

export default function ParentClassroomView({ 
    classes, lessonLogs, attendanceLogs, studentId, 
    selectedClassId, setSelectedClassId,
    videoProgress, 
    homeworkAssignments, homeworkResults,
    tests, grades,
    onNavigateToTab 
}) {
    const selectedClass = classes.find(c => c.id === selectedClassId);
    
    // 날짜 역순 정렬
    const sortedLogs = useMemo(() => {
        return lessonLogs
            .filter(log => log.classId === selectedClassId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [lessonLogs, selectedClassId]);

    const [isAttendanceDetailOpen, setIsAttendanceDetailOpen] = useState(false);
    
    // 학부모용: 자료 토글 기능만 유지 (다운로드/미리보기 목적)
    const [expandedMaterialLogId, setExpandedMaterialLogId] = useState(null);

    // --- 통계 및 상태 계산 (학생용과 동일) ---
    const stats = useMemo(() => {
        const myAttendance = attendanceLogs.filter(log => log.classId === selectedClassId && log.studentId === studentId);
        const presentCount = myAttendance.filter(l => ['출석', '동영상보강'].includes(l.status)).length;
        const lateCount = myAttendance.filter(l => l.status === '지각').length;
        const absentCount = myAttendance.filter(l => l.status === '결석').length;
        const totalAttendance = myAttendance.length;
        
        const classHomeworks = homeworkAssignments.filter(h => h.classId === selectedClassId);
        const unsubmittedCount = classHomeworks.filter(h => {
             const result = homeworkResults?.[studentId]?.[h.id];
             return !result || Object.keys(result).length === 0;
        }).length;
        
        let unresolvedCount = 0;
        classHomeworks.forEach(hw => {
            const result = homeworkResults?.[studentId]?.[hw.id];
            if (result) unresolvedCount += Object.values(result).filter(status => status === '틀림').length;
        });

        let gradeTrend = 'initial';
        if (tests && grades) {
            const classTests = tests.filter(t => t.classId === selectedClassId).sort((a, b) => new Date(a.date) - new Date(b.date));
            const myScores = classTests.map(t => grades[studentId]?.[t.id]?.score).filter(s => s !== undefined && s !== null);
            
            if (myScores.length >= 2) {
                const latest = myScores[myScores.length - 1];
                const prev = myScores[myScores.length - 2];
                if (latest > prev) gradeTrend = 'up';
                else if (latest < prev) gradeTrend = 'down';
                else gradeTrend = 'same';
            } else if (myScores.length === 1) {
                gradeTrend = 'initial';
            }
        }

        return {
            attendance: { present: presentCount, late: lateCount, absent: absentCount, total: totalAttendance, logs: myAttendance },
            homework: { unresolved: unresolvedCount, unsubmitted: unsubmittedCount },
            grade: { trend: gradeTrend }
        };
    }, [attendanceLogs, selectedClassId, studentId, homeworkAssignments, homeworkResults, sortedLogs, tests, grades, videoProgress]);

    const toggleMaterials = (logId) => {
        setExpandedMaterialLogId(prev => prev === logId ? null : logId);
    };

    // --- 학부모용 렌더링 아이템 (영상 재생 X, 리포트 O) ---
    const renderLogItem = (log) => {
        const prog = videoProgress?.[studentId]?.[log.id]?.percent || 0;
        const hasMaterials = log.materials && log.materials.length > 0;
        const isMaterialsExpanded = expandedMaterialLogId === log.id;

        return (
            <div key={log.id} className="p-5 rounded-2xl border border-gray-200 bg-white mb-3 shadow-sm">
                <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{log.date}</span>
                            {prog >= 100 ? <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">학습 완료</span> : 
                             prog > 0 ? <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">학습 중</span> : 
                             <span className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">미수강</span>}
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 mb-1">{log.progress}</h4>
                        <p className="text-sm text-gray-600 mb-2">{log.assignment}</p>
                    </div>

                    <div className="flex items-center gap-3 self-center">
                        {/* ✅ [수정] 자료 다운로드 활성화 */}
                        {hasMaterials && (
                            <button 
                                onClick={(e) => toggleMaterials(e, log.id)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isMaterialsExpanded ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            >
                                <Icon name="fileText" className="w-5 h-5" />
                            </button>
                        )}
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 text-gray-300 cursor-not-allowed">
                            <Icon name="video" className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {isMaterialsExpanded && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                        <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                            <Icon name="folder" className="w-3 h-3" />
                            강의 자료 ({log.materials.length})
                        </p>
                        <div className="space-y-2">
                            {log.materials.map((mat, idx) => (
                                <a 
                                    key={idx} 
                                    href={mat.url} // ✅ [수정] 실제 링크 연결
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0 text-indigo-500 border border-gray-200">
                                        <Icon name="download" className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-medium text-gray-700 truncate flex-1">{mat.name}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="animate-fade-in-up pb-20 space-y-6 relative">
            <div className="flex items-center gap-3">
                <button onClick={() => setSelectedClassId(null)} className="p-2.5 bg-white rounded-xl text-gray-600 active:bg-gray-100 transition-colors shadow-sm">
                    <Icon name="chevronLeft" className="w-6 h-6" /> 
                </button>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedClass?.name}</h2>
                    <p className="text-xs text-gray-500">{selectedClass?.schedule.days.join(', ')} {selectedClass?.schedule.time}</p>
                </div>
            </div>

            {/* 상단 요약 카드 (학생용과 동일 디자인) */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                    <div className="bg-gray-50 p-2.5 rounded-full mb-2 text-gray-600"><Icon name="user" className="w-5 h-5" /></div>
                    <span className="text-xs text-gray-500 font-bold mb-0.5">출결 현황</span>
                    <span className="text-lg font-extrabold text-gray-900">{stats.attendance.present} <span className="text-gray-400 text-xs font-medium">/ {stats.attendance.total}</span></span>
                </div>
                <div onClick={() => onNavigateToTab && onNavigateToTab('learning', 'homework')} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform">
                    <div className="bg-blue-50 p-2.5 rounded-full mb-2 text-blue-600"><Icon name="fileText" className="w-5 h-5" /></div>
                    <span className="text-xs text-gray-500 font-bold mb-0.5">과제 관리</span>
                    <span className="text-lg font-extrabold text-gray-900">{stats.homework.unresolved} <span className="text-gray-400 text-xs font-medium">미정리</span></span>
                </div>
                <div onClick={() => onNavigateToTab && onNavigateToTab('learning', 'grades')} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform">
                    <div className="bg-purple-50 p-2.5 rounded-full mb-2 text-purple-600"><Icon name="trendingUp" className="w-5 h-5" /></div>
                    <span className="text-xs text-gray-500 font-bold mb-0.5">성적 추이</span>
                    <span className="text-lg font-extrabold text-indigo-600">상승 중</span>
                </div>
            </div>

            {/* 수업 리스트 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Icon name="list" className="w-5 h-5 text-indigo-600" />
                        수업 기록 ({sortedLogs.length})
                    </h3>
                </div>
                <div className="p-4 bg-gray-50/50">
                    {sortedLogs.length > 0 ? sortedLogs.map(log => renderLogItem(log)) : (<div className="p-10 text-center text-gray-400 text-sm">기록된 수업이 없습니다.</div>)}
                </div>
            </div>
        </div>
    );
}