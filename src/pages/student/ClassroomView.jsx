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

    // 화면 모드: 'list' | 'player'
    const [viewMode, setViewMode] = useState('list');
    const [currentLesson, setCurrentLesson] = useState(null);
    
    // 플레이어 Ref
    const playerRef = useRef(null);

    // [로직] 메모 타겟이 있으면 바로 플레이어 모드로 진입
    useEffect(() => {
        if (targetMemo && targetMemo.lessonId) {
            const target = sortedLogs.find(l => l.id === targetMemo.lessonId);
            if (target) {
                setCurrentLesson(target);
                setViewMode('player');
            }
        }
    }, [targetMemo, sortedLogs]);

    // [로직] 비디오 모달 상태 알림 (헤더 숨김 등 처리를 위함)
    useEffect(() => {
        if (onVideoModalChange) {
            onVideoModalChange(viewMode === 'player');
        }
    }, [viewMode, onVideoModalChange]);

    const [bookmarkNote, setBookmarkNote] = useState('');

    // 북마크 추가
    const handleAddBookmark = () => {
        if (!playerRef.current || !bookmarkNote.trim() || !currentLesson) return;
        
        const currentTime = playerRef.current.getCurrentTime();
        const newBookmark = {
            id: Date.now(),
            time: currentTime,
            note: bookmarkNote
        };
        
        onSaveBookmark(studentId, currentLesson.id, newBookmark);
        setBookmarkNote('');
    };

    // 북마크 이동
    const handleSeekToBookmark = (time) => {
        if (playerRef.current) {
            playerRef.current.seekTo(time);
        }
    };

    // [핵심] 수강률 누적 계산 (1초마다 호출됨)
    // addedSeconds: 이번 틱에 추가된 시간 (보통 1)
    // currentTime: 현재 재생 위치 (이어보기를 위해 저장)
    // duration: 전체 영상 길이
    const handleWatchedTick = (addedSeconds, currentTime, duration) => {
        if (!currentLesson || duration <= 0) return;

        // 기존 데이터 가져오기
        const prevData = videoProgress?.[studentId]?.[currentLesson.id] || { percent: 0, seconds: 0, accumulated: 0 };
        const prevAccumulated = prevData.accumulated || 0; // 누적 시청 시간 (초)

        // 새로운 누적 시간
        const newAccumulated = prevAccumulated + addedSeconds;
        
        // 퍼센트 계산 (최대 100%)
        const newPercent = Math.min(100, Math.floor((newAccumulated / duration) * 100));

        // 저장 (seconds 필드는 '마지막 시청 위치'로 사용, accumulated 필드 새로 추가하여 관리)
        onSaveVideoProgress(studentId, currentLesson.id, {
            percent: newPercent,
            seconds: currentTime, // 마지막 재생 위치
            accumulated: newAccumulated // 실제 시청한 총 시간
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

    // ----------------------------------------------------------------------
    // 뷰 1: 강의 목록 (List View)
    // ----------------------------------------------------------------------
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
                                <div 
                                    key={log.id} 
                                    onClick={() => { setCurrentLesson(log); setViewMode('player'); }}
                                    className="p-5 hover:bg-indigo-50/50 transition-colors cursor-pointer flex items-center justify-between group"
                                >
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
                        }) : (
                            <div className="p-10 text-center text-gray-400 text-sm">등록된 강의가 없습니다.</div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ----------------------------------------------------------------------
    // 뷰 2: 플레이어 (Player View) - 전체화면 오버레이
    // ----------------------------------------------------------------------
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

            {/* 메인 컨텐츠 (좌우 분할) */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-black">
                
                {/* 1. 왼쪽: 영상 영역 (반응형 비율 유지) */}
                <div className="flex-1 flex items-center justify-center relative bg-black overflow-hidden p-4 lg:p-0">
                    {/* 영상 컨테이너: 화면 크기에 맞춰 비율 유지하며 중앙 정렬 (contain) */}
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="w-full max-w-5xl aspect-video shadow-2xl relative">
                            {currentVideoId ? (
                                <YouTubePlayer
                                    ref={playerRef}
                                    videoId={currentVideoId}
                                    initialSeconds={targetMemo?.time || progressData.seconds} 
                                    onWatchedTick={handleWatchedTick}
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-gray-900 rounded-xl border border-gray-800">
                                    <Icon name="monitor" className="w-12 h-12 mb-2 opacity-50" />
                                    <p>영상을 불러올 수 없습니다.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* 수강률 오버레이 (영상 하단) */}
                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900/80 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 flex items-center gap-4 shadow-lg z-10">
                        <span className="text-xs text-gray-300 font-medium">내 수강률</span>
                        <div className="w-32 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${progressData.percent >= 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${progressData.percent}%` }}></div>
                        </div>
                        <span className={`text-sm font-bold font-mono ${progressData.percent >= 100 ? 'text-green-400' : 'text-white'}`}>{progressData.percent}%</span>
                    </div>
                </div>

                {/* 2. 오른쪽: 사이드바 (메모 & 정보) */}
                <div className="w-full lg:w-[400px] flex flex-col bg-white h-[40%] lg:h-full flex-shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200">
                    
                    {/* 탭 헤더 (메모 / 강의정보) */}
                    <div className="flex border-b border-gray-200 bg-gray-50">
                        <div className="flex-1 py-3 text-center text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 bg-white">학습 메모</div>
                        <div className="flex-1 py-3 text-center text-sm font-medium text-gray-500 hover:text-gray-700 cursor-not-allowed opacity-50">강의 정보</div>
                    </div>

                    {/* 메모 입력창 */}
                    <div className="p-4 border-b border-gray-100 bg-white">
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={bookmarkNote}
                                onChange={(e) => setBookmarkNote(e.target.value)}
                                placeholder="중요한 내용 메모하기..."
                                className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                                onKeyPress={(e) => e.key === 'Enter' && handleAddBookmark()}
                            />
                            <button 
                                onClick={handleAddBookmark}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl transition-colors shadow-sm flex-shrink-0"
                            >
                                <Icon name="plus" className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* 북마크 리스트 */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/30">
                        {myBookmarks.length > 0 ? (
                            <div className="space-y-3">
                                {myBookmarks.map((bm) => (
                                    <div key={bm.id} className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all group">
                                        <button 
                                            onClick={() => handleSeekToBookmark(bm.time)}
                                            className="flex items-center gap-2 mb-2 w-full text-left"
                                        >
                                            <div className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-[11px] font-bold font-mono border border-indigo-100 flex items-center gap-1 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                <Icon name="play" className="w-3 h-3" />
                                                {formatTime(bm.time)}
                                            </div>
                                            <span className="text-xs text-gray-400 ml-auto">이동하기</span>
                                        </button>
                                        <p className="text-sm text-gray-800 leading-relaxed pl-1 break-words">{bm.note}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                                    <Icon name="pen" className="w-8 h-8 text-gray-300" />
                                </div>
                                <div className="text-center text-xs">
                                    <p>아직 작성된 메모가 없습니다.</p>
                                    <p className="mt-1">영상 재생 중 중요한 부분을 기록해보세요!</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}