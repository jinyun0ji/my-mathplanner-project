import React, { useState, useEffect, useMemo } from 'react';
import { Icon, getYouTubeId } from '../utils/helpers';
import { LessonLogFormModal } from '../utils/modals/LessonLogFormModal';
import ClassSelectionPanel from '../components/Shared/ClassSelectionPanel';
import VideoProgressViewer from '../components/Shared/VideoProgressViewer';
import { buildLessonSessions, getCurrentLessonByDate, getSortedLessonLogs } from '../domain/lesson/lesson.service';
import YouTubePlayer from '../components/YouTubePlayer';

const normalizeLessonVideos = (lesson) => {
    if (!lesson) return [];

    const baseVideos = Array.isArray(lesson.videos) ? lesson.videos : [];
    const videos = baseVideos.length > 0 ? baseVideos : (lesson.videoUrl ? [{
        url: lesson.videoUrl,
        title: lesson.videoTitle || '수업 영상',
        progress: typeof lesson.videoProgress === 'number' ? lesson.videoProgress : (typeof lesson.progressPercent === 'number' ? lesson.progressPercent : 0),
        id: lesson.videoId || lesson.id || lesson.date,
    }] : []);

    return videos
        .map((video, index) => {
            const url = video.url || video.videoUrl || '';
            if (!url) return null;

            const progressValue = typeof video.progress === 'number'
                ? video.progress
                : (typeof video.percent === 'number' ? video.percent : 0);

            return {
                ...video,
                url,
                id: video.id || video.videoId || url || `video-${index}`,
                title: video.title || video.name || `영상 ${index + 1}`,
                progress: Math.min(100, Math.max(0, progressValue)),
            };
        })
        .filter(Boolean);
};

const getVideoKey = (video, index) => video.id || video.url || `video-${index}`;

export default function LessonManagement({ 
    students, classes, lessonLogs, handleSaveLessonLog, handleDeleteLessonLog, 
    handleSaveClass, videoProgress, attendanceLogs, calculateClassSessions, logNotification, handleSendStudentNotification, setIsGlobalDirty
}) {
    const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || null);
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [logToEdit, setLogToEdit] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [isMobile, setIsMobile] = useState(false);
    const [activeVideoByLog, setActiveVideoByLog] = useState({});

    const selectedClass = classes.find(c => c.id === selectedClassId);
    
    // 선택된 클래스의 일지 목록을 날짜 역순으로 정렬
    const classLogs = useMemo(
        () => getSortedLessonLogs(lessonLogs, selectedClassId),
        [lessonLogs, selectedClassId]
    );

    useEffect(() => {
        if (selectedClassId) {
            if (selectedDate === null && classLogs.length > 0) {
                 setSelectedDate(classLogs[0].date);
            } else if (classLogs.length === 0) {
                 setSelectedDate(null);
            }
        }
    }, [selectedClassId, classLogs.length]); 

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        const handleResize = () => setIsMobile(mediaQuery.matches);
        handleResize();
        mediaQuery.addEventListener('change', handleResize);
        return () => mediaQuery.removeEventListener('change', handleResize);
    }, []);

    const currentLog = useMemo(
        () => getCurrentLessonByDate(classLogs, selectedDate),
        [classLogs, selectedDate]
    );

    useEffect(() => {
        if (!currentLog) return;

        const normalizedVideos = normalizeLessonVideos(currentLog);
        if (normalizedVideos.length === 0) return;

        const currentActive = activeVideoByLog[currentLog.id];
        const exists = normalizedVideos.some((video, index) => (video.id || video.url || `video-${index}`) === currentActive);

        if (!exists) {
            const defaultKey = normalizedVideos[0].id || normalizedVideos[0].url || 'video-0';
            setActiveVideoByLog(prev => ({ ...prev, [currentLog.id]: defaultKey }));
        }
    }, [currentLog, activeVideoByLog]);

    
    const handleDateNavigate = (direction) => {
        const sessions = calculateClassSessions(selectedClass);
        const currentIndex = sessions.findIndex(s => s.date === selectedDate);

        if (currentIndex === -1) return;

        const newIndex = currentIndex + direction;
        
        if (newIndex >= 0 && newIndex < sessions.length) {
            setSelectedDate(sessions[newIndex].date);
        }
    };
    
    // ✅ [수정] 진도 내용이 포함된 개선된 리스트 (비용 안전)
    const logSessionsContent = useMemo(() => {
        const sessions = calculateClassSessions(selectedClass);
        const sessionItems = buildLessonSessions(sessions, classLogs, selectedDate);
        
        return (
            <ul className="space-y-2 max-h-[500px] overflow-y-auto pr-1 text-sm custom-scrollbar">
                {sessionItems.map(({ session, log, isLogged, isSelected }) => (
                    <li
                        key={session.date}
                        onClick={() => setSelectedDate(session.date)}
                        className={`p-3 rounded-lg transition cursor-pointer border flex flex-col gap-1 ${
                            isSelected
                                ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                : 'bg-white border-transparent hover:bg-gray-50 border-gray-100'
                        }`}
                    >
                        {/* 헤더: 회차 및 날짜 */}
                        <div className="flex justify-between items-center">
                            <span className={`font-bold ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>
                                {session.session}회차
                                <span className="font-mono text-xs font-normal ml-2 text-gray-400">{session.date}</span>
                            </span>
                            {isLogged && <Icon name="check" className="w-4 h-4 text-green-500" />}
                        </div>

                        {/* 내용 요약: 진도 내용이 있으면 표시 */}
                        {isLogged ? (
                            <p className="text-xs text-gray-600 line-clamp-2 pl-2 border-l-2 border-indigo-100">
                                {log.progress}
                            </p>
                        ) : (
                            <p className="text-xs text-red-400 pl-2 border-l-2 border-red-100">
                                일지 미작성
                            </p>
                        )}
                    </li>
                ))}
            </ul>
        );
    }, [classLogs, selectedClass, selectedDate, calculateClassSessions]);

    const handleEditLog = (log) => {
        setLogToEdit(log);
        setIsLogModalOpen(true);
    };

    const handleNewLog = () => {
        setLogToEdit(null);
        setIsLogModalOpen(true);
    };

    const isCurrentDateLogged = currentLog !== undefined;

    const renderLogDetail = (log) => {
        const videos = normalizeLessonVideos(log);
        const fallbackKey = videos.length ? getVideoKey(videos[0], 0) : null;
        const savedKey = videos.length ? activeVideoByLog[log.id] : null;
        const activeKey = videos.length && savedKey && videos.some((video, index) => getVideoKey(video, index) === savedKey)
            ? savedKey
            : fallbackKey;
        const activeVideo = videos.find((video, index) => getVideoKey(video, index) === activeKey);
        const overallVideoProgress = videos.length
            ? Math.round(videos.reduce((total, video) => total + (Number.isFinite(video.progress) ? video.progress : 0), 0) / videos.length)
            : null;

            return (
            <>
                <h4 className="text-lg font-bold text-gray-800 border-b pb-2">수업 진도 및 내용</h4>
                <div className="text-gray-700 whitespace-pre-wrap text-sm sm:text-base leading-relaxed">{log.progress}</div>

            {videos.length > 0 && (
                    <div className="space-y-3 pt-4">
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                        {activeVideo ? (
                            <div className="aspect-w-16 aspect-h-9 bg-black/5">
                                {getYouTubeId(activeVideo.url) ? (
                                    <YouTubePlayer key={activeKey} videoId={getYouTubeId(activeVideo.url)} />
                                ) : (
                                    <iframe
                                        title={activeVideo.title}
                                        src={activeVideo.url}
                                        className="w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                )}
                            </div>
                            ) : (
                            <div className="p-4 text-sm text-gray-500">재생할 영상을 선택하세요.</div>
                        )}
                    </div>

                    {videos.length > 1 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 text-gray-800 font-semibold">
                                    <Icon name="video" className="w-4 h-4 text-indigo-600" />
                                    수업 영상 목록
                                </div>
                                {overallVideoProgress !== null && (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                        평균 진도율 {overallVideoProgress}%
                                    </span>
                                )}
                            </div>

                                <div className="space-y-2">
                                {videos.map((video, index) => {
                                    const key = getVideoKey(video, index);
                                    const isActive = key === activeKey;
                                    const progressValue = Number.isFinite(video.progress) ? video.progress : 0;

                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setActiveVideoByLog(prev => ({ ...prev, [log.id]: key }))}
                                            className={`w-full text-left p-3 rounded-lg border transition ${isActive ? 'border-indigo-200 bg-indigo-50 shadow-sm' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Icon name={isActive ? 'playCircle' : 'play'} className="w-4 h-4 text-indigo-600" />
                                                    <p className="text-sm font-semibold text-gray-800 truncate">{video.title}</p>
                                                </div>
                                                <span className="text-xs font-bold text-indigo-700">{progressValue}%</span>
                                            </div>
                                            <div className="mt-2 w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                                                <div
                                                    className="h-2 bg-indigo-500"
                                                    style={{ width: `${Math.min(100, Math.max(0, progressValue))}%` }}
                                                />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

                {log.materialUrl && (
                    <div className="text-sm font-medium text-indigo-600 flex items-center border-t pt-4">
                        <Icon name="fileText" className="w-4 h-4 mr-2" />
                        <button
                            type="button"
                            onClick={() => window.open(log.materialUrl, '_blank', 'noopener,noreferrer')}
                            className="ml-1 hover:underline"
                        >
                            첨부 자료: {log.materialUrl}
                        </button>
                    </div>
                )}

                {log.iframeCode && (
                    <div className="border border-gray-300 rounded-lg overflow-hidden mt-4">
                        <div className="aspect-w-16 aspect-h-9" dangerouslySetInnerHTML={{ __html: log.iframeCode }} />
                    </div>
                )}

                {log.iframeCode && (
                    <VideoProgressViewer
                        log={log}
                        students={students}
                        videoProgress={videoProgress}
                        attendanceLogs={attendanceLogs}
                        logNotification={logNotification}
                        handleSendStudentNotification={handleSendStudentNotification}
                    />
                )}

                <div className='pt-4 border-t flex justify-end'>
                    <button
                        onClick={() => { if(window.confirm('정말 이 수업 일지를 삭제하시겠습니까?')) handleDeleteLessonLog(log.id) }}
                        className='text-sm text-red-500 hover:text-red-700 flex items-center font-medium'
                    >
                        <Icon name="trash" className="w-4 h-4 mr-1"/>
                        일지 삭제
                    </button>
                </div>
            </>
        );
    };

    const renderLogCards = (containerClass = '') => (
        <div className={`${containerClass} space-y-3`}>
            {classLogs.length === 0 && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-sm text-gray-500">작성된 수업 일지가 없습니다. 새로 작성해 주세요.</p>
                </div>
            )}
            {classLogs.map(log => {
                const isOpen = log.date === selectedDate;

                return (
                    <div key={log.id} className="bg-white border border-gray-200 rounded-xl shadow-sm">
                        <button
                            type="button"
                            onClick={() => setSelectedDate(log.date)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left"
                        >
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-800">{log.date}</p>
                                <p className="text-xs text-gray-500 truncate">{selectedClass?.name}</p>
                            </div>
                            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${isOpen ? 'bg-indigo-50 text-indigo-900 border-indigo-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                {isOpen ? '선택됨' : '선택'}
                            </span>
                        </button>
                        {isOpen && (
                            <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                                {renderLogDetail(log)}
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => handleEditLog(log)}
                                        className="flex-1 min-w-[140px] bg-white border border-gray-300 hover:border-indigo-300 text-gray-700 text-sm font-semibold py-2 px-3 rounded-lg flex items-center justify-center shadow-sm"
                                    >
                                        <Icon name="edit" className="w-4 h-4 mr-2 text-gray-500" />
                                        일지 수정
                                    </button>
                                    <button
                                        onClick={() => { if(window.confirm('정말 이 수업 일지를 삭제하시겠습니까?')) handleDeleteLessonLog(log.id) }}
                                        className="flex-1 min-w-[140px] bg-red-50 border border-red-200 text-red-600 text-sm font-semibold py-2 px-3 rounded-lg flex items-center justify-center hover:bg-red-100"
                                    >
                                        <Icon name="trash" className="w-4 h-4 mr-2" />
                                        삭제
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
    
    return (
        <div className="space-y-4 h-full">
            <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex items-center gap-2">
                        <Icon name="calendar" className="w-5 h-5 text-indigo-900" />
                        <p className="text-sm font-semibold text-gray-800">{selectedClass?.name || '클래스 미선택'}</p>
                    </div>
                    <span className="text-xs text-gray-500">{selectedDate || '날짜 선택'}</span>
                </div>
                <button
                    onClick={isCurrentDateLogged ? () => handleEditLog(currentLog) : handleNewLog}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-900 hover:bg-indigo-800 rounded-lg shadow-md transition"
                >
                    <Icon name="checkSquare" className="w-5 h-5" />
                    일지 수정 / 작성
                </button>
            </div>

            <div className="grid gap-4 xl:grid-cols-[320px,1fr]">
                <div className="space-y-4">
                    <ClassSelectionPanel
                        classes={classes}
                        selectedClassId={selectedClassId}
                        setSelectedClassId={setSelectedClassId}
                        handleClassSave={handleSaveClass}
                        calculateClassSessions={calculateClassSessions}
                        showSessions={!isMobile}
                        selectedDate={selectedDate}
                        handleDateNavigate={handleDateNavigate}
                        showEditButton={true}
                        customPanelContent={logSessionsContent}
                        customPanelTitle="수업 일지 회차"
                        onDateSelect={setSelectedDate}
                    />

                    {renderLogCards('hidden md:block')}
                </div>

                <div className="min-w-0 w-full space-y-4">
                    {selectedClassId === null ? (
                        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                            <p className="text-gray-500">왼쪽에서 클래스를 선택하여 일지를 확인하세요.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="md:hidden">
                                {renderLogCards('')}
                            </div>

                            {currentLog ? (
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
                                    {renderLogDetail(currentLog)}
                                </div>
                            ) : (
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                    <p className="text-gray-500">선택된 날짜({selectedDate})에 작성된 수업 일지가 없습니다. 새로 작성해주세요.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <LessonLogFormModal
                isOpen={isLogModalOpen}
                onClose={() => setIsLogModalOpen(false)}
                onSave={handleSaveLessonLog}
                log={logToEdit}
                classId={selectedClassId}
                classes={classes}
                calculateClassSessions={calculateClassSessions}
                defaultDate={selectedDate}
                students={students}
                logNotification={logNotification}
                onDirtyChange={setIsGlobalDirty}
            />
        </div>
    );
};