import React, { useState, useMemo } from 'react';
import { Icon } from '../../utils/helpers';

export default function ParentClassroomView({ 
    classes, lessonLogs, attendanceLogs, studentId, 
    selectedClassId, setSelectedClassId,
    videoProgress, 
    homeworkAssignments, homeworkResults,
    tests, grades,
    onNavigateToTab,
    onOpenReport,
    activeStudentName
}) {
    const selectedClass = classes.find(c => c.id === selectedClassId);
    
    // 날짜 역순 정렬
    const sortedLogs = useMemo(() => {
        return lessonLogs
            .filter(log => log.classId === selectedClassId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [lessonLogs, selectedClassId]);

    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
    const [expandedMaterialLogId, setExpandedMaterialLogId] = useState(null);

    // --- [1] 통계 및 상태 상세 계산 ---
    const stats = useMemo(() => {
        // 1. 출결 (최근 4회 기준)
        const myAttendance = attendanceLogs
            .filter(log => log.classId === selectedClassId && log.studentId === studentId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const recent4 = myAttendance.slice(0, 4);
        const recentPresentCount = recent4.filter(l => ['출석', '동영상보강'].includes(l.status)).length;
        const totalRecent = recent4.length || 1; // 0나누기 방지
        const attendanceRate = (recentPresentCount / totalRecent) * 100;
        
        let attendanceStatus = 'normal'; // normal, warning, danger
        if (attendanceRate < 50) attendanceStatus = 'danger';
        else if (attendanceRate < 80) attendanceStatus = 'warning';

        // 2. 과제 (누적 미제출)
        const classHomeworks = homeworkAssignments.filter(h => h.classId === selectedClassId);
        const unsubmittedCount = classHomeworks.filter(h => {
             const result = homeworkResults?.[studentId]?.[h.id];
             return !result || Object.keys(result).length === 0;
        }).length;

        // 3. 성적 추이
        let gradeTrend = '데이터 부족';
        let gradeDiff = '';
        if (tests && grades) {
            const classTests = tests.filter(t => t.classId === selectedClassId).sort((a, b) => new Date(a.date) - new Date(b.date));
            const myScores = classTests.map(t => grades[studentId]?.[t.id]?.score).filter(s => s !== undefined && s !== null);
            
            if (myScores.length >= 2) {
                const latest = myScores[myScores.length - 1];
                const prev = myScores[myScores.length - 2];
                const diff = latest - prev;
                if (diff > 0) { gradeTrend = '상승 중'; gradeDiff = `지난 시험 대비 +${diff}점`; }
                else if (diff < 0) { gradeTrend = '하락 주의'; gradeDiff = `지난 시험 대비 ${diff}점`; }
                else { gradeTrend = '유지 중'; gradeDiff = '지난 시험과 동일'; }
            } else if (myScores.length === 1) {
                gradeTrend = '기록 시작';
                gradeDiff = '첫 시험 응시';
            }
        }

        // 4. [New] 확인 필요 항목 (Action Items)
        const attentionItems = [];
        // 미수강 영상 (최근 3개 수업 중)
        sortedLogs.slice(0, 3).forEach(log => {
            const prog = videoProgress?.[studentId]?.[log.id]?.percent || 0;
            if (prog < 100) {
                attentionItems.push({ 
                    type: 'video', 
                    id: log.id, 
                    title: `[미수강] ${log.date.slice(5)} 수업 영상`, 
                    desc: '복습이 완료되지 않았습니다.' 
                });
            }
        });
        // 미제출 과제
        if (unsubmittedCount > 0) {
            attentionItems.push({ type: 'homework', title: `미제출 과제 ${unsubmittedCount}건`, desc: '기한 내 제출하지 않은 과제가 있습니다.' });
        }

        return {
            attendance: { status: attendanceStatus, recentPresent: recentPresentCount, recentTotal: recent4.length },
            homework: { unsubmitted: unsubmittedCount },
            grade: { trend: gradeTrend, diff: gradeDiff },
            attentionItems
        };
    }, [attendanceLogs, selectedClassId, studentId, homeworkAssignments, homeworkResults, sortedLogs, tests, grades, videoProgress]);

    const toggleMaterials = (e, logId) => {
        e.stopPropagation();
        setExpandedMaterialLogId(prev => prev === logId ? null : logId);
    };

    // --- [3] 수업 기록 리스트 아이템 ---
    const renderLogItem = (log) => {
        const prog = videoProgress?.[studentId]?.[log.id]?.percent || 0;
        const hasMaterials = log.materials && log.materials.length > 0;
        const isMaterialsExpanded = expandedMaterialLogId === log.id;
        
        // 상태 뱃지 결정
        let statusBadge;
        if (prog >= 100) statusBadge = null; // 정상은 굳이 표시 안함 (심플함 유지)
        else if (prog > 0) statusBadge = <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">학습 중</span>;
        else statusBadge = <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">미수강</span>;

        return (
            <div 
                key={log.id} 
                onClick={() => onOpenReport && onOpenReport(log.id)} // ✅ [수정] 클릭 시 리포트 열기
                className="group bg-white border border-gray-100 rounded-xl p-4 mb-3 shadow-sm hover:border-indigo-200 transition-all cursor-pointer active:scale-[0.98]"
            >
                <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-gray-400">{log.date}</span>
                            {statusBadge}
                        </div>
                        <h4 className="text-base font-bold text-gray-900 truncate mb-1">{log.progress}</h4>
                        <div className="flex items-center text-xs text-gray-400 mt-2">
                            <span>터치하여 리포트 확인</span>
                            <Icon name="chevronRight" className="w-3 h-3 ml-1" />
                        </div>
                    </div>

                    {hasMaterials && (
                        <button 
                            onClick={(e) => toggleMaterials(e, log.id)}
                            className={`ml-3 p-2 rounded-lg transition-colors flex-shrink-0 ${isMaterialsExpanded ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                        >
                            <Icon name="fileText" className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* 자료 확장 영역 */}
                {isMaterialsExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-50 animate-fade-in-down">
                        <div className="space-y-2">
                            {log.materials.map((mat, idx) => (
                                <a 
                                    key={idx} 
                                    href={mat.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                                >
                                    <Icon name="download" className="w-4 h-4 text-gray-400" />
                                    <span className="text-xs font-medium text-gray-700 truncate">{mat.name}</span>
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
            {/* 헤더 */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedClassId(null)} className="p-2 bg-white border border-gray-200 rounded-xl text-gray-600 active:bg-gray-100 transition-colors shadow-sm">
                        <Icon name="chevronLeft" className="w-5 h-5" /> 
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">{selectedClass?.name}</h2>
                        <p className="text-xs text-gray-500">{selectedClass?.schedule.days.join(', ')} {selectedClass?.schedule.time}</p>
                    </div>
                </div>
                <button
                    type="button"
                    disabled
                    className="text-xs font-semibold text-gray-400 border border-gray-200 px-3 py-1.5 rounded-full cursor-not-allowed"
                >
                    {activeStudentName ? `${activeStudentName} (전환 준비 중)` : '자녀 전환 준비 중'}
                </button>
            </div>

            {/* [A] 상단 상태 요약 (3단 레이아웃) */}
            <div className="grid grid-cols-3 gap-3">
                {/* 1. 출결 */}
                <div className={`p-4 rounded-2xl shadow-sm border flex flex-col items-center justify-center text-center
                    ${stats.attendance.status === 'danger' ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
                    <div className={`p-2 rounded-full mb-2 ${stats.attendance.status === 'danger' ? 'bg-red-100 text-red-600' : 'bg-gray-50 text-gray-600'}`}>
                        <Icon name="user" className="w-5 h-5" />
                    </div>
                    <span className="text-xs text-gray-500 font-bold mb-0.5">최근 4회 출결</span>
                    <span className={`text-sm font-extrabold ${stats.attendance.status === 'danger' ? 'text-red-600' : 'text-gray-900'}`}>
                        {stats.attendance.recentPresent} / {stats.attendance.recentTotal} 
                        <span className="text-[10px] ml-1 font-normal opacity-70">
                            {stats.attendance.status === 'normal' ? '정상' : '주의'}
                        </span>
                    </span>
                </div>

                {/* 2. 과제 (클릭 시 이동) */}
                <div 
                    onClick={() => onNavigateToTab && onNavigateToTab('learning', 'homework')} 
                    className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform"
                >
                    <div className="bg-blue-50 p-2 rounded-full mb-2 text-blue-600"><Icon name="fileText" className="w-5 h-5" /></div>
                    <span className="text-xs text-gray-500 font-bold mb-0.5">미제출 과제</span>
                    <span className={`text-sm font-extrabold ${stats.homework.unsubmitted > 0 ? 'text-red-500' : 'text-gray-900'}`}>
                        {stats.homework.unsubmitted}건
                    </span>
                </div>

                {/* 3. 성적 */}
                <div 
                    onClick={() => onNavigateToTab && onNavigateToTab('learning', 'grades')} 
                    className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform"
                >
                    <div className="bg-purple-50 p-2 rounded-full mb-2 text-purple-600"><Icon name="trendingUp" className="w-5 h-5" /></div>
                    <span className="text-xs text-gray-500 font-bold mb-0.5">최근 성적</span>
                    <span className="text-sm font-extrabold text-indigo-600">{stats.grade.trend}</span>
                    <span className="text-[9px] text-gray-400 mt-0.5">{stats.grade.diff}</span>
                </div>
            </div>

            {/* [B] 중단: 확인 필요 알림 (조건부 렌더링) */}
            {stats.attentionItems.length > 0 && (
                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 animate-fade-in">
                    <h3 className="text-sm font-bold text-orange-800 mb-2 flex items-center gap-1">
                        <Icon name="alertCircle" className="w-4 h-4" /> 확인이 필요해요
                    </h3>
                    <div className="space-y-2">
                        {stats.attentionItems.map((item, idx) => (
                            <div key={idx} className="bg-white/60 rounded-lg p-2.5 flex items-start gap-3">
                                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0"></span>
                                <div>
                                    <p className="text-xs font-bold text-gray-800">{item.title}</p>
                                    <p className="text-[10px] text-gray-500">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* [C] 하단: 수업 기록 요약 리스트 */}
            <div>
                <div className="flex justify-between items-end mb-3 px-1">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Icon name="list" className="w-5 h-5 text-indigo-600" />
                        최근 수업 기록
                    </h3>
                    {!isHistoryExpanded && sortedLogs.length > 3 && (
                        <button onClick={() => setIsHistoryExpanded(true)} className="text-xs text-gray-500 underline active:text-gray-800">
                            전체보기
                        </button>
                    )}
                </div>

                <div className="space-y-2">
                    {(isHistoryExpanded ? sortedLogs : sortedLogs.slice(0, 3)).map(log => renderLogItem(log))}
                    
                    {sortedLogs.length === 0 && (
                        <div className="p-10 text-center text-gray-400 text-sm bg-white rounded-2xl border border-dashed border-gray-200">
                            기록된 수업이 없습니다.
                        </div>
                    )}
                </div>

                {isHistoryExpanded && (
                    <button 
                        onClick={() => setIsHistoryExpanded(false)}
                        className="w-full py-3 mt-4 text-xs font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        접기
                    </button>
                )}
            </div>
        </div>
    );
}