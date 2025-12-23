// src/pages/student/ClassroomView.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Icon, formatTime } from '../../utils/helpers';
import YouTubePlayer from '../../components/YouTubePlayer';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
import { calculateVideoProgress, getCurrentLessonByDate, getSortedLessonLogs, normalizeLessonVideos } from '../../domain/lesson/lesson.service';
import { buildClassroomStats } from '../../domain/classroom/classroom.service';

export default function ClassroomView({ 
    classes, lessonLogs, attendanceLogs, studentId, 
    selectedClassId, setSelectedClassId,
    videoProgress, onSaveVideoProgress,
    videoBookmarks, onSaveBookmark,
    onVideoModalChange, 
    targetMemo, onClearTargetMemo,
    homeworkAssignments, homeworkResults,
    tests, grades,
    onNavigateToTab 
}) {
    const selectedClass = classes.find(c => c.id === selectedClassId);
    
    const sortedLogs = useMemo(
        () => getSortedLessonLogs(lessonLogs, selectedClassId),
        [lessonLogs, selectedClassId]
    );

    const [viewMode, setViewMode] = useState('list');
    const [currentLesson, setCurrentLesson] = useState(null);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const playerRef = useRef(null);
    const [isAttendanceDetailOpen, setIsAttendanceDetailOpen] = useState(false);
    const [isVideoListOpen, setIsVideoListOpen] = useState(false);
    
    // 자료 리스트 펼침 상태 관리
    const [expandedMaterialLogId, setExpandedMaterialLogId] = useState(null);

    useEffect(() => {
        if (targetMemo && targetMemo.lessonId) {
            const target = getCurrentLessonByDate(sortedLogs, null, targetMemo.lessonId);
            if (target) {
                setCurrentLesson(target);
                setViewMode('player');
            }
        }
    }, [targetMemo, sortedLogs]);

    useEffect(() => {
        if (onVideoModalChange) {
            onVideoModalChange(viewMode === 'player');
        }
    }, [viewMode, onVideoModalChange]);

    const [bookmarkNote, setBookmarkNote] = useState('');
    const [isListOpen, setIsListOpen] = useState(false); 

    // --- 통계 및 상태 계산 ---
    const stats = useMemo(
        () => buildClassroomStats({
            attendanceLogs,
            selectedClassId,
            studentId,
            homeworkAssignments,
            homeworkResults,
            tests,
            grades,
        }),
        [attendanceLogs, selectedClassId, studentId, homeworkAssignments, homeworkResults, tests, grades]
    );

    const handleAddBookmark = () => {
        if (!playerRef.current || !bookmarkNote.trim() || !currentLesson) return;
        const currentTime = playerRef.current.getCurrentTime();
        const newBookmark = { id: Date.now(), time: currentTime, note: bookmarkNote };
        onSaveBookmark(studentId, currentLesson.id, newBookmark);
        setBookmarkNote('');
    };

    const handleSeekToBookmark = (time) => {
        if (playerRef.current) playerRef.current.seekTo(time);
    };

    const handleWatchedTick = (addedSeconds, currentTime, duration) => {
        if (!currentLesson || duration <= 0) return;
        const prevData = calculateVideoProgress(videoProgress, studentId, currentLesson.id);
        const newAccumulated = (prevData.accumulated || 0) + addedSeconds;
        const newPercent = Math.min(100, Math.floor((newAccumulated / duration) * 100));
        onSaveVideoProgress(studentId, currentLesson.id, {
            percent: newPercent, seconds: currentTime, accumulated: newAccumulated
        });
    };

    const myBookmarks = videoBookmarks?.[studentId]?.[currentLesson?.id] || [];
    const progressData = calculateVideoProgress(videoProgress, studentId, currentLesson?.id);

    const lessonVideos = useMemo(() => normalizeLessonVideos(currentLesson), [currentLesson]);
    const hasLessonVideos = lessonVideos.length > 0;

    useEffect(() => {
        setSelectedVideo(lessonVideos[0] || null);
        setIsVideoListOpen(false);
    }, [lessonVideos]);

    const currentVideoId = selectedVideo?.videoId;

    const toggleMaterials = (e, logId) => {
        e.stopPropagation(); 
        setExpandedMaterialLogId(prev => prev === logId ? null : logId);
    };

    const playVideo = (log) => {
        setCurrentLesson(log);
        if (viewMode === 'list') setViewMode('player');
    };

    const renderLogItem = (log) => {
        const { percent: prog } = calculateVideoProgress(videoProgress, studentId, log.id);
        const isSelected = currentLesson?.id === log.id;
        const hasMaterials = log.materials && log.materials.length > 0;
        const isMaterialsExpanded = expandedMaterialLogId === log.id;

        return (
            <div 
                key={log.id} 
                className={`p-4 rounded-xl transition-all border ${
                    isSelected 
                        ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                        : 'bg-white border-gray-100 hover:bg-gray-50'
                }`}
            >
                <div className="flex justify-between items-start">
                    <div 
                        className="flex-1 min-w-0 pr-4 cursor-pointer"
                        onClick={() => playVideo(log)}
                    >
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{log.date}</span>
                            {prog >= 100 && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">완료</span>}
                            {prog > 0 && prog < 100 && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{prog}%</span>}
                        </div>
                        <h4 className={`text-base font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-gray-800'}`}>{log.progress}</h4>
                        <p className="text-xs text-gray-500 mt-1 truncate mb-2">{log.assignment}</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {hasMaterials && (
                            <button 
                                onClick={(e) => toggleMaterials(e, log.id)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                    isMaterialsExpanded 
                                        ? 'bg-gray-200 text-gray-800' 
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                                title="강의 자료"
                            >
                                {/* ✅ [수정] 자료 아이콘은 그대로 유지 */}
                                <Icon name="fileText" className="w-4 h-4" />
                            </button>
                        )}
                        <button 
                            onClick={() => playVideo(log)}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-50 text-gray-300'}`}
                        >
                            <PlayCircleFilledWhiteIcon className="w-7 h-7" />
                        </button>
                    </div>
                </div>

                {isMaterialsExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-200/60 animate-fade-in-down">
                        <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                            <Icon name="folder" className="w-3 h-3" />
                            강의 자료 ({log.materials.length})
                        </p>
                        <div className="space-y-2">
                            {log.materials.map((mat, idx) => (
                                <a 
                                    key={idx} 
                                    href={mat.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 active:bg-gray-200 transition-colors"
                                    onClick={(e) => e.stopPropagation()} 
                                >
                                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 text-red-500">
                                        {/* ✅ [수정] 다운로드 아이콘 사용 */}
                                        <Icon name="download" className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-medium text-gray-700 truncate flex-1">{mat.name}</span>
                                    <Icon name="chevronRight" className="w-4 h-4 text-gray-400" />
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (viewMode === 'list') {
        return (
            <div className="animate-fade-in-up pb-20 space-y-6 relative">
                <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedClassId(null)} className="p-2 bg-white rounded-xl text-gray-600 hover:bg-gray-100 transition-colors shadow-sm active:scale-95">
                        <Icon name="chevronLeft" className="w-6 h-6" /> 
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{selectedClass?.name}</h2>
                        <p className="text-xs text-gray-500">{selectedClass?.schedule.days.join(', ')} {selectedClass?.schedule.time}</p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <button onClick={() => setIsAttendanceDetailOpen(true)} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center active:scale-95 transition-transform">
                        <div className="bg-gray-50 p-2 rounded-full mb-2 text-gray-500"><Icon name="user" className="w-5 h-5" /></div>
                        <span className="text-xs text-gray-500 font-bold mb-0.5">내 출결</span>
                        <span className="text-lg font-extrabold text-gray-900">{stats.attendance.present} <span className="text-gray-400 text-xs font-medium">/ {stats.attendance.total}</span></span>
                        {(stats.attendance.absent > 0 || stats.attendance.late > 0) ? <span className="text-[10px] text-orange-600 font-bold mt-1">결석 {stats.attendance.absent} · 지각 {stats.attendance.late}</span> : null}
                    </button>
                    <button onClick={() => onNavigateToTab && onNavigateToTab('learning')} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center active:scale-95 transition-transform">
                        <div className="bg-blue-50 p-2 rounded-full mb-2 text-blue-600"><Icon name="fileText" className="w-5 h-5" /></div>
                        <span className="text-xs text-gray-500 font-bold mb-0.5">오답 관리</span>
                        {stats.homework.unsubmitted > 0 ? (<><span className="text-sm font-extrabold text-orange-600">과제 미제출</span><span className="text-[10px] text-orange-500 font-bold mt-1">{stats.homework.unsubmitted}회차</span></>) : stats.homework.unresolved > 0 ? (<><span className="text-sm font-extrabold text-gray-800">미정리 오답</span><span className="text-[10px] text-orange-500 font-bold mt-1">{stats.homework.unresolved}문항</span></>) : (<><span className="text-sm font-extrabold text-gray-800">오답 정리</span><span className="text-[10px] text-green-600 font-bold mt-1">완료</span></>)}
                    </button>
                    {/* 성적 */}
                    <button 
                        // ✅ [수정] 성적 카드 클릭 -> 성적 탭('grades')으로 이동
                        onClick={() => onNavigateToTab && onNavigateToTab('learning', 'grades')} 
                        className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center active:scale-95 transition-transform"
                    >
                        <div className="bg-purple-50 p-2 rounded-full mb-2 text-purple-600"><Icon name="trendingUp" className="w-5 h-5" /></div>
                        <span className="text-xs text-gray-500 font-bold mb-0.5">성적 상태</span>
                        {stats.grade.trend === 'initial' ? <span className="text-sm font-bold text-gray-600">분석 중</span> : <span className={`text-lg font-extrabold ${stats.grade.trend === 'up' ? 'text-indigo-600' : stats.grade.trend === 'down' ? 'text-orange-600' : 'text-gray-700'}`}>{stats.grade.trend === 'up' ? '상승 중' : stats.grade.trend === 'down' ? '관리 필요' : '유지'}</span>}
                        <span className="text-[10px] text-gray-400 mt-1">최근 3회 기준</span>
                    </button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        {/* ✅ [수정] 복습 영상 아이콘: list -> video */}
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Icon name="video" className="w-5 h-5 text-indigo-600" />복습 영상 ({sortedLogs.length})</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {sortedLogs.length > 0 ? sortedLogs.map(log => renderLogItem(log)) : (<div className="p-10 text-center text-gray-400 text-sm">등록된 강의가 없습니다.</div>)}
                    </div>
                </div>

                {isAttendanceDetailOpen && (
                    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsAttendanceDetailOpen(false)}>
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in-up max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900">출결 상세 기록</h3>
                                <button onClick={() => setIsAttendanceDetailOpen(false)} className="p-2 -mr-2 text-gray-400 hover:text-gray-600"><Icon name="x" className="w-6 h-6" /></button>
                            </div>
                            <div className="overflow-y-auto flex-1 custom-scrollbar space-y-2">
                                {stats.attendance.logs.length > 0 ? (
                                    stats.attendance.logs.sort((a,b) => new Date(b.date) - new Date(a.date)).map(log => (
                                        <div key={log.id} className="flex justify-between items-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                                            <span className="text-sm font-medium text-gray-600">{log.date}</span>
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${log.status === '출석' ? 'bg-green-100 text-green-700' : log.status === '지각' ? 'bg-yellow-100 text-yellow-700' : log.status === '동영상보강' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{log.status}</span>
                                        </div>
                                    ))
                                ) : (<div className="text-center py-10 text-gray-400 text-sm">기록된 출결이 없습니다.</div>)}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // 2. 플레이어 뷰
    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-fade-in-up">
            <div className="flex-none h-14 flex items-center gap-3 px-4 border-b border-gray-200 bg-white shadow-sm z-20">
                <button onClick={() => { setViewMode('list'); onClearTargetMemo(); }} className="p-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors active:scale-95"><Icon name="chevronLeft" className="w-5 h-5" /></button>
                <div className="flex-1 min-w-0"><h2 className="text-base font-bold text-gray-900 truncate"><span className="text-indigo-600 mr-2">[{currentLesson?.date}]</span>{currentLesson?.progress}</h2></div>
            </div>

            <div className={`flex-1 flex flex-col lg:flex-row overflow-hidden ${hasLessonVideos ? 'bg-black' : 'bg-white'}`}>
                {hasLessonVideos && (
                    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 lg:border-r lg:border-gray-200 relative">
                        <div className="flex-1 min-h-0 bg-black flex flex-col">
                            <div className="flex-1 flex items-center justify-center w-full">
                                {currentVideoId ? (
                                    <div className="w-full h-full max-w-full max-h-full aspect-video flex items-center justify-center"><YouTubePlayer ref={playerRef} videoId={currentVideoId} initialSeconds={targetMemo?.time || progressData.seconds} onWatchedTick={handleWatchedTick} /></div>
                                ) : (<div className="flex flex-col items-center justify-center text-gray-500"><Icon name="monitor" className="w-12 h-12 mb-2 opacity-50" /><p>재생할 영상이 없습니다.</p></div>)}
                            </div>

                        {lessonVideos.length > 1 && (
                                <div className="bg-gray-900 border-t border-gray-800">
                                    <div className="px-4 py-3 flex items-center justify-between text-gray-100">
                                        <div>
                                            <p className="text-[11px] uppercase tracking-wide text-gray-400">영상 선택</p>
                                            <p className="text-sm font-bold">{selectedVideo?.title || '영상 선택'}</p>
                                        </div>
                                        <button
                                            onClick={() => setIsVideoListOpen(!isVideoListOpen)}
                                            className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 active:bg-gray-600 transition-colors"
                                        >
                                            {isVideoListOpen ? '목록 닫기' : `영상 ${lessonVideos.length}개`}
                                            <Icon name={isVideoListOpen ? 'chevronDown' : 'chevronUp'} className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {isVideoListOpen && (
                                        <div className="bg-black/70 divide-y divide-gray-800">
                                            {lessonVideos.map(video => (
                                                <button
                                                    key={video.id}
                                                    onClick={() => setSelectedVideo(video)}
                                                    className={`w-full text-left px-4 py-3 flex items-center justify-between text-sm transition-colors ${selectedVideo?.id === video.id ? 'bg-gray-800 text-white' : 'text-gray-200 hover:bg-gray-800/70'}`}
                                                >
                                                    <span className="truncate pr-3">{video.title}</span>
                                                    {selectedVideo?.id === video.id ? (
                                                        <span className="text-[10px] font-bold text-green-400">재생 중</span>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-400">선택</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    <div className="bg-white border-b border-gray-200 shrink-0 z-10">
                            <div className="px-4 py-3 flex justify-between items-center">
                                <div className="bg-gray-900 px-4 py-1.5 rounded-full flex items-center gap-3 shadow-sm border border-gray-200"><span className="text-xs text-gray-300 font-medium">내 수강률</span><div className="w-20 bg-gray-700 rounded-full h-1.5 overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${progressData.percent >= 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${progressData.percent}%` }}></div></div><span className={`text-xs font-bold font-mono ${progressData.percent >= 100 ? 'text-green-400' : 'text-white'}`}>{progressData.percent}%</span></div>
                                <button onClick={() => setIsListOpen(!isListOpen)} className="flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-indigo-900 transition-colors bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200 active:bg-gray-300">{isListOpen ? '목록 닫기' : '다른 강의'}<Icon name={isListOpen ? "chevronDown" : "chevronUp"} className="w-4 h-4" /></button>
                            </div>
                        </div>
                    {isListOpen && (
                            <div className="h-48 lg:h-1/3 flex-none overflow-y-auto p-4 custom-scrollbar bg-white border-t border-gray-100">
                                <div className="space-y-2">
                                    {sortedLogs.map(log => renderLogItem(log))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <div className={`w-full ${hasLessonVideos ? 'lg:w-[400px]' : 'lg:w-full'} flex flex-col bg-white h-[40%] lg:h-full flex-shrink-0 border-t lg:border-t-0 ${hasLessonVideos ? 'lg:border-l' : ''} border-gray-200`}>
                    <div className="flex border-b border-gray-200 bg-gray-50">
                        <div className="flex-1 py-3 text-center text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 bg-white">학습 메모</div>
                    </div>
                    <div className="p-4 border-b border-gray-100 bg-white">
                        <div className="flex gap-2">
                            <input type="text" value={bookmarkNote} onChange={(e) => setBookmarkNote(e.target.value)} placeholder="중요한 내용 메모하기..." className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all" onKeyPress={(e) => e.key === 'Enter' && handleAddBookmark()} />
                            <button onClick={handleAddBookmark} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl transition-colors shadow-sm flex-shrink-0 active:scale-95"><Icon name="plus" className="w-5 h-5" /></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/30">
                        {myBookmarks.length > 0 ? (<div className="space-y-3">{myBookmarks.map((bm) => (<div key={bm.id} className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all group"><button onClick={() => handleSeekToBookmark(bm.time)} className="flex items-center gap-2 mb-2 w-full text-left active:opacity-70"><div className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-[11px] font-bold font-mono border border-indigo-100 flex items-center gap-1 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><Icon name="play" className="w-3 h-3" />{formatTime(bm.time)}</div><span className="text-xs text-gray-400 ml-auto">이동하기</span></button><p className="text-sm text-gray-800 leading-relaxed pl-1 break-words">{bm.note}</p></div>))}</div>) : (<div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3"><div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center"><Icon name="pen" className="w-8 h-8 text-gray-300" /></div><div className="text-center text-xs"><p>아직 작성된 메모가 없습니다.</p><p className="mt-1">영상 재생 중 중요한 부분을 기록해보세요!</p></div></div>)}
                    </div>
                </div>
            </div>
        </div>
    );
}