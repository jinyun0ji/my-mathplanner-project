// src/pages/student/ClassroomView.jsx
import React, { useState, useRef } from 'react';
import { Icon, getYouTubeId, formatTime } from '../../utils/helpers'; // helpers에서 가져옴
import YouTubePlayer from '../../components/YouTubePlayer'; // 분리한 플레이어 컴포넌트

export default function ClassroomView({ 
    classes, lessonLogs, attendanceLogs, studentId, selectedClassId, setSelectedClassId, 
    videoProgress, onSaveVideoProgress, videoBookmarks, onSaveBookmark 
}) {
    const targetClass = classes.find(c => c.id === selectedClassId);
    // 최신순 정렬
    const logs = lessonLogs.filter(l => l.classId === selectedClassId).sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // 영상 재생 관련 상태
    const [playingLesson, setPlayingLesson] = useState(null);
    const [currentSessionProgress, setCurrentSessionProgress] = useState(0);
    const [bookmarkNote, setBookmarkNote] = useState('');
    const playerRef = useRef(null); 

    const handleProgress = (percent, seconds) => {
        setCurrentSessionProgress(percent);
        if (playingLesson && onSaveVideoProgress) {
            onSaveVideoProgress(studentId, playingLesson.id, { percent, seconds });
        }
    };

    const handleAddBookmark = () => {
        if (!playingLesson || !playerRef.current) return;
        const currentTime = playerRef.current.getCurrentTime();
        
        const newBookmark = {
            id: Date.now(),
            time: currentTime,
            note: bookmarkNote || '중요한 부분' 
        };

        if (onSaveBookmark) {
            onSaveBookmark(studentId, playingLesson.id, newBookmark);
        }
        setBookmarkNote(''); 
    };

    const handleSeekToBookmark = (time) => {
        if (playerRef.current) {
            playerRef.current.seekTo(time);
        }
    };

    const getProgressData = (lessonId) => {
        const rawData = videoProgress?.[studentId]?.[lessonId];
        if (typeof rawData === 'number') {
            return { percent: rawData, seconds: 0 }; 
        }
        return { 
            percent: rawData?.percent || 0, 
            seconds: rawData?.seconds || 0 
        };
    };

    return (
        <div className="space-y-6 animate-fade-in-up pb-20">
            {/* 상단 헤더 (뒤로가기) */}
            <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setSelectedClassId(null)} className="p-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-indigo-600">
                    <Icon name="arrow-left" className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold text-gray-800">{targetClass?.name} 강의실</h2>
            </div>

            {/* 강의 목록 리스트 */}
            <div className="space-y-4">
                {logs.length > 0 ? logs.map((log) => {
                    const attendRecord = attendanceLogs.find(a => a.studentId === studentId && a.classId === targetClass.id && a.date === log.date);
                    const status = attendRecord?.status;
                    const isAccessible = ['출석', '지각', '동영상보강'].includes(status);
                    
                    const { percent } = getProgressData(log.id);
                    const youtubeId = getYouTubeId(log.iframeCode);

                    return (
                        <div key={log.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                    {log.date} 수업
                                </span>
                                {status ? (
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                                        status === '출석' ? 'bg-green-100 text-green-700' :
                                        status === '지각' ? 'bg-yellow-100 text-yellow-700' :
                                        status === '동영상보강' ? 'bg-blue-100 text-blue-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                        {status}
                                    </span>
                                ) : (
                                    <span className="text-xs font-bold px-2 py-1 rounded bg-gray-100 text-gray-500">기록 없음</span>
                                )}
                            </div>
                            
                            <h3 className="text-lg font-bold text-gray-800 mb-2">{log.progress}</h3>

                            {/* 진도율 표시 (유튜브 영상이 있을 때만) */}
                            {youtubeId && (
                                <div className="mb-4">
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span>수강률</span>
                                        <span className={`font-bold ${percent === 100 ? 'text-green-600' : 'text-indigo-600'}`}>{percent}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div 
                                            className={`h-2 rounded-full transition-all duration-500 ${percent === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} 
                                            style={{ width: `${percent}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            {/* 버튼 영역 */}
                            <div className="flex gap-2">
                                {isAccessible ? (
                                    <>
                                        {youtubeId ? (
                                            <button 
                                                onClick={() => {
                                                    const data = getProgressData(log.id); 
                                                    setPlayingLesson({ id: log.id, videoId: youtubeId, ...data, date: log.date, progress: log.progress });
                                                    setCurrentSessionProgress(data.percent);
                                                }}
                                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <Icon name="monitor" className="w-4 h-4" /> 
                                                {percent > 0 && percent < 100 ? '이어 보기' : (percent === 100 ? '다시 보기' : '강의 보기')}
                                            </button>
                                        ) : (
                                            <button disabled className="flex-1 bg-gray-100 text-gray-400 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed">
                                                <Icon name="monitor" className="w-4 h-4" /> 영상 없음
                                            </button>
                                        )}
                                        
                                        {log.materialUrl ? (
                                            <button className="flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors">
                                                <Icon name="fileText" className="w-4 h-4" /> 자료 다운
                                            </button>
                                        ) : (
                                            <button disabled className="flex-1 bg-gray-100 text-gray-400 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed">
                                                <Icon name="fileText" className="w-4 h-4" /> 자료 없음
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="w-full bg-gray-100 text-gray-400 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                                        <Icon name="lock" className="w-4 h-4" /> 
                                        {status === '결석' ? '결석으로 조회 불가' : '출결 확인 전'}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                }) : (
                    <div className="text-center py-20 text-gray-400">
                        <Icon name="bookOpen" className="w-12 h-12 mb-2 opacity-50 mx-auto" />
                        <p>등록된 수업 기록이 없습니다.</p>
                    </div>
                )}
            </div>

            {/* 비디오 모달 (JSX 인라인 배치) */}
            {playingLesson && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setPlayingLesson(null)}>
                    {/* ✅ [수정] Grid 레이아웃 적용 (PC: 7:3 비율 고정 / 모바일: 1열) */}
                    <div 
                        className="bg-gray-900 p-0 rounded-2xl w-full max-w-7xl shadow-2xl relative overflow-hidden flex flex-col h-[85vh]" 
                        onClick={e => e.stopPropagation()}
                    >
                        
                        {/* 1. 헤더 (고정 높이) */}
                        <div className="px-4 py-3 flex justify-between items-center border-b border-gray-800 bg-gray-900 shrink-0">
                            <span className="text-white font-bold text-sm truncate flex-1 mr-4">
                                {playingLesson.date} {playingLesson.progress}
                            </span>
                            <button 
                                onClick={() => setPlayingLesson(null)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <Icon name="x" className="w-6 h-6" />
                            </button>
                        </div>

                        {/* 2. 본문 영역 (CSS Grid: PC 70/30, 모바일 1열) */}
                        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[7fr_3fr] overflow-hidden">
                            
                            {/* 좌측: 영상 + 수강률 */}
                            <div className="flex flex-col bg-black h-full overflow-hidden relative">
                                {/* 비디오 플레이어 (남은 공간 모두 차지) */}
                                <div className="flex-1 relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
                                    <div className="w-full h-full max-h-full aspect-video lg:aspect-auto"> 
                                        <YouTubePlayer 
                                            ref={playerRef}
                                            videoId={playingLesson.videoId}
                                            initialProgress={playingLesson.percent || 0}
                                            initialSeconds={playingLesson.seconds || 0}
                                            onProgressUpdate={handleProgress}
                                        />
                                    </div>
                                </div>
                                {/* 수강률 바 (하단 고정) */}
                                <div className="p-4 bg-gray-900 border-t border-gray-800 shrink-0 z-10">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-gray-400 text-xs font-medium">나의 수강률</span>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xl font-bold ${currentSessionProgress === 100 ? 'text-green-500' : 'text-indigo-500'}`}>
                                                {currentSessionProgress}%
                                            </span>
                                            {currentSessionProgress === 100 && (
                                                <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-green-500/30">
                                                    수강 완료
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-300 ${currentSessionProgress === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} 
                                            style={{ width: `${currentSessionProgress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            {/* 우측: 메모 + 북마크 */}
                            <div className="flex flex-col h-full bg-gray-900 border-l border-gray-800 flex-1 min-h-0 overflow-hidden">
                                {/* 메모 입력 (상단 고정) */}
                                <div className="p-4 border-b border-gray-800 shrink-0">
                                    <p className="text-gray-400 text-xs mb-2 font-medium">메모 남기기</p>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={bookmarkNote}
                                            onChange={(e) => setBookmarkNote(e.target.value)}
                                            placeholder="내용 입력..."
                                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-gray-600"
                                        />
                                        <button 
                                            onClick={handleAddBookmark}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap"
                                        >
                                            저장
                                        </button>
                                    </div>
                                </div>

                                {/* 북마크 리스트 (스크롤 가능) */}
                                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                    <p className="text-gray-400 text-xs mb-3 font-medium flex items-center justify-between">
                                        나의 북마크
                                        <span className="text-gray-600">{videoBookmarks?.[studentId]?.[playingLesson.id]?.length || 0}개</span>
                                    </p>
                                    
                                    <div className="space-y-2">
                                        {videoBookmarks?.[studentId]?.[playingLesson.id]?.length > 0 ? (
                                            videoBookmarks[studentId][playingLesson.id].map((bm) => (
                                                <div 
                                                    key={bm.id} 
                                                    onClick={() => handleSeekToBookmark(bm.time)}
                                                    className="bg-gray-800 hover:bg-gray-700 p-3 rounded-lg cursor-pointer flex justify-between items-start transition-colors group border border-transparent hover:border-gray-600"
                                                >
                                                    <div className="flex flex-col gap-1 w-full">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-indigo-400 font-mono text-xs bg-indigo-900/30 px-1.5 py-0.5 rounded">
                                                                {formatTime(bm.time)}
                                                            </span>
                                                            <Icon name="chevronRight" className="w-3 h-3 text-gray-600 group-hover:text-gray-400" />
                                                        </div>
                                                        <span className="text-gray-300 text-sm break-words leading-snug">{bm.note}</span>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-10 text-gray-600 text-xs border border-dashed border-gray-800 rounded-lg">
                                                저장된 메모가 없습니다.<br/>중요한 부분에서 '저장'을 눌러보세요.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}