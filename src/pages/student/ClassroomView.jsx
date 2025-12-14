// src/pages/student/ClassroomView.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Icon, getYouTubeId, formatTime } from '../../utils/helpers';
import YouTubePlayer from '../../components/YouTubePlayer';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';

export default function ClassroomView({ 
    classes, lessonLogs, attendanceLogs, studentId, 
    selectedClassId, setSelectedClassId,
    videoProgress, onSaveVideoProgress,
    videoBookmarks, onSaveBookmark,
    onVideoModalChange, 
    targetMemo, onClearTargetMemo 
}) {
    const selectedClass = classes.find(c => c.id === selectedClassId);
    
    const sortedLogs = useMemo(() => {
        return lessonLogs
            .filter(log => log.classId === selectedClassId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [lessonLogs, selectedClassId]);

    const [viewMode, setViewMode] = useState('list');
    const [currentLesson, setCurrentLesson] = useState(null);
    const playerRef = useRef(null);

    useEffect(() => {
        if (targetMemo && targetMemo.lessonId) {
            const target = sortedLogs.find(l => l.id === targetMemo.lessonId);
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
    const [isListOpen, setIsListOpen] = useState(true); // 목록 토글

    const handleAddBookmark = () => {
        if (!playerRef.current || !bookmarkNote.trim() || !currentLesson) return;
        const currentTime = playerRef.current.getCurrentTime();
        const newBookmark = { id: Date.now(), time: currentTime, note: bookmarkNote };
        onSaveBookmark(studentId, currentLesson.id, newBookmark);
        setBookmarkNote('');
    };

    const handleSeekToBookmark = (time) => {
        if (playerRef.current) {
            playerRef.current.seekTo(time);
        }
    };

    const handleWatchedTick = (addedSeconds, currentTime, duration) => {
        if (!currentLesson || duration <= 0) return;
        const prevData = videoProgress?.[studentId]?.[currentLesson.id] || { percent: 0, seconds: 0, accumulated: 0 };
        const newAccumulated = (prevData.accumulated || 0) + addedSeconds;
        const newPercent = Math.min(100, Math.floor((newAccumulated / duration) * 100));
        onSaveVideoProgress(studentId, currentLesson.id, {
            percent: newPercent,
            seconds: currentTime,
            accumulated: newAccumulated
        });
    };

    const myBookmarks = videoBookmarks?.[studentId]?.[currentLesson?.id] || [];
    const progressData = videoProgress?.[studentId]?.[currentLesson?.id] || { percent: 0, seconds: 0 };

    const getVideoIdFromLog = (log) => {
        if (!log) return null;
        let url = log.materialUrl;
        if (log.iframeCode && log.iframeCode.includes('src="')) {
            const srcMatch = log.iframeCode.match(/src="([^"]+)"/);
            if (srcMatch && srcMatch[1]) url = srcMatch[1];
        }
        return getYouTubeId(url);
    };

    const currentVideoId = getVideoIdFromLog(currentLesson);

    // 1. 강의 목록 뷰
    if (viewMode === 'list') {
        return (
            <div className="animate-fade-in-up pb-20 space-y-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedClassId(null)} className="p-2 bg-white rounded-xl text-gray-600 hover:bg-gray-100 transition-colors shadow-sm">
                        <Icon name="chevronLeft" className="w-6 h-6" /> 
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{selectedClass?.name}</h2>
                        <p className="text-xs text-gray-500">{selectedClass?.schedule.days.join(', ')} {selectedClass?.schedule.time}</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Icon name="list" className="w-5 h-5 text-indigo-600" />
                            강의 목록 ({sortedLogs.length})
                        </h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {sortedLogs.length > 0 ? sortedLogs.map(log => {
                            const prog = videoProgress?.[studentId]?.[log.id]?.percent || 0;
                            return (
                                <div key={log.id} onClick={() => { setCurrentLesson(log); setViewMode('player'); }} className="p-5 hover:bg-indigo-50/50 transition-colors cursor-pointer flex items-center justify-between group">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{log.date}</span>
                                            {prog >= 100 && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">완료</span>}
                                            {prog > 0 && prog < 100 && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{prog}%</span>}
                                        </div>
                                        <h4 className="text-base font-bold text-gray-800 group-hover:text-indigo-900 truncate">{log.progress}</h4>
                                        <p className="text-xs text-gray-500 mt-1 truncate">{log.assignment}</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-all">
                                        <PlayCircleFilledWhiteIcon className="w-6 h-6" />
                                    </div>
                                </div>
                            );
                        }) : (<div className="p-10 text-center text-gray-400 text-sm">등록된 강의가 없습니다.</div>)}
                    </div>
                </div>
            </div>
        );
    }

    // 2. 플레이어 뷰
    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-fade-in-up">
            {/* 상단 헤더 */}
            <div className="flex-none h-14 flex items-center gap-3 px-4 border-b border-gray-200 bg-white shadow-sm z-20">
                <button onClick={() => { setViewMode('list'); onClearTargetMemo(); }} className="p-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors">
                    <Icon name="chevronLeft" className="w-5 h-5" /> 
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold text-gray-900 truncate">
                        <span className="text-indigo-600 mr-2">[{currentLesson?.date}]</span>
                        {currentLesson?.progress}
                    </h2>
                </div>
            </div>

            {/* 메인 컨텐츠 */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-black">
                {/* 왼쪽: 영상 영역 */}
                <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 lg:border-r lg:border-gray-200 relative">
                    
                    {/* ✅ [수정] 영상 컨테이너: flex로 꽉 채우되 비율 유지 (잘림 방지) */}
                    <div className="flex-1 min-h-0 bg-black flex items-center justify-center w-full">
                        {currentVideoId ? (
                            // max-w, max-h, aspect-video 조합으로 화면 안에 쏙 들어오게 함
                            <div className="w-full h-full max-w-full max-h-full aspect-video flex items-center justify-center">
                                <YouTubePlayer
                                    ref={playerRef}
                                    videoId={currentVideoId}
                                    initialSeconds={targetMemo?.time || progressData.seconds} 
                                    onWatchedTick={handleWatchedTick}
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-gray-500">
                                <Icon name="monitor" className="w-12 h-12 mb-2 opacity-50" />
                                <p>재생할 영상이 없습니다.</p>
                            </div>
                        )}
                    </div>

                    {/* ✅ [수정] 하단 컨트롤바 + 수강률 배지 이동 */}
                    <div className="bg-white border-b border-gray-200 shrink-0 z-10">
                        <div className="px-4 py-3 flex justify-between items-center">
                            
                            {/* 수강률 배지 (디자인 유지, 위치 변경) */}
                            <div className="bg-gray-900 px-4 py-1.5 rounded-full flex items-center gap-3 shadow-sm border border-gray-200">
                                <span className="text-xs text-gray-300 font-medium">내 수강률</span>
                                <div className="w-20 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-500 ${progressData.percent >= 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${progressData.percent}%` }}></div>
                                </div>
                                <span className={`text-xs font-bold font-mono ${progressData.percent >= 100 ? 'text-green-400' : 'text-white'}`}>{progressData.percent}%</span>
                            </div>

                            {/* 강의 목록 토글 버튼 */}
                            <button 
                                onClick={() => setIsListOpen(!isListOpen)}
                                className="flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-indigo-900 transition-colors bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200"
                            >
                                {isListOpen ? '목록 닫기' : '다른 강의'}
                                <Icon name={isListOpen ? "chevronDown" : "chevronUp"} className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* 강의 목록 (토글됨) */}
                    {isListOpen && (
                        <div className="h-48 lg:h-1/3 flex-none overflow-y-auto p-4 custom-scrollbar bg-white border-t border-gray-100">
                            <div className="space-y-2">
                                {sortedLogs.map(log => {
                                    const logProgress = videoProgress?.[studentId]?.[log.id]?.percent || 0;
                                    const isSelected = currentLesson?.id === log.id;
                                    return (
                                        <div 
                                            key={log.id} 
                                            onClick={() => { setCurrentLesson(log); onClearTargetMemo(); }}
                                            className={`p-3 rounded-xl cursor-pointer transition-all flex justify-between items-center ${isSelected ? 'bg-indigo-50 border border-indigo-200' : 'bg-white border border-gray-100 hover:bg-gray-50'}`}
                                        >
                                            <div className="min-w-0 flex-1 mr-3">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${logProgress >= 100 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {logProgress >= 100 ? '완료' : `${Math.round(logProgress)}%`}
                                                    </span>
                                                    <span className="text-xs text-gray-400">{log.date}</span>
                                                </div>
                                                <h4 className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>{log.progress}</h4>
                                            </div>
                                            {isSelected && <Icon name="play" className="w-4 h-4 text-indigo-500 flex-shrink-0" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* 오른쪽: 메모 및 북마크 */}
                <div className="w-full lg:w-[400px] flex flex-col bg-white h-[40%] lg:h-full flex-shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200">
                    <div className="flex border-b border-gray-200 bg-gray-50">
                        <div className="flex-1 py-3 text-center text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 bg-white">학습 메모</div>
                        <div className="flex-1 py-3 text-center text-sm font-medium text-gray-500 hover:text-gray-700 cursor-not-allowed opacity-50">강의 정보</div>
                    </div>
                    <div className="p-4 border-b border-gray-100 bg-white">
                        <div className="flex gap-2">
                            <input 
                                type="text" value={bookmarkNote} onChange={(e) => setBookmarkNote(e.target.value)} placeholder="중요한 내용 메모하기..."
                                className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                                onKeyPress={(e) => e.key === 'Enter' && handleAddBookmark()}
                            />
                            <button onClick={handleAddBookmark} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl transition-colors shadow-sm flex-shrink-0"><Icon name="plus" className="w-5 h-5" /></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/30">
                        {myBookmarks.length > 0 ? (<div className="space-y-3">{myBookmarks.map((bm) => (<div key={bm.id} className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all group"><button onClick={() => handleSeekToBookmark(bm.time)} className="flex items-center gap-2 mb-2 w-full text-left"><div className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-[11px] font-bold font-mono border border-indigo-100 flex items-center gap-1 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><Icon name="play" className="w-3 h-3" />{formatTime(bm.time)}</div><span className="text-xs text-gray-400 ml-auto">이동하기</span></button><p className="text-sm text-gray-800 leading-relaxed pl-1 break-words">{bm.note}</p></div>))}</div>) : (<div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3"><div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center"><Icon name="pen" className="w-8 h-8 text-gray-300" /></div><div className="text-center text-xs"><p>아직 작성된 메모가 없습니다.</p><p className="mt-1">영상 재생 중 중요한 부분을 기록해보세요!</p></div></div>)}
                    </div>
                </div>
            </div>
        </div>
    );
}