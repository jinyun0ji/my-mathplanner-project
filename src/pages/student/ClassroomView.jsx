// src/pages/student/ClassroomView.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Icon, formatTime, formatClassScheduleKo } from '../../utils/helpers';
import YouTubePlayer from '../../components/YouTubePlayer';
import NativeYouTubeLauncher from '../../components/NativeYouTubeLauncher';
import VideoFilePlayer from '../../components/VideoFilePlayer';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
import { calculateVideoProgress, getCurrentLessonByDate, getSortedLessonLogs, normalizeLessonVideos } from '../../domain/lesson/lesson.service';
import { getLessonVideoMemosFromState } from '../../domain/memo/videoMemo.service';
import { buildClassroomStats } from '../../domain/classroom/classroom.service';
import { canAccessLessonContent } from '../../utils/attendanceAccess';
import { Capacitor } from '@capacitor/core';
import { isCapacitorNativeEnvironment, isIosCapacitorNativeEnvironment } from '../../utils/capacitorEnvironment';

const normalizeAttendanceStatus = (status) => {
    if (!status) return null;
    if (status === 'present' || status === 'absent' || status === 'video_makeup' || status === 'late') return status;

    if (status === '출석') return 'present';
    if (status === '결석') return 'absent';
    if (status === '동영상보강') return 'video_makeup';
    if (status === '지각') return 'late';

    return null;
};


export default function ClassroomView({
    classes, lessonLogs, attendanceLogs, studentDocId, studentAuthUid, currentAuthUid,
    selectedClassId, setSelectedClassId,
    videoProgress, onSaveVideoProgress,
    videoMemos, onAddMemo, onUpdateMemo, onDeleteMemo,
    onVideoModalChange,
    targetMemo, onClearTargetMemo,
    homeworkAssignments, homeworkResults,
    tests, grades,
    onNavigateToTab
}) {
    const selectedClass = classes.find(c => String(c.id) === String(selectedClassId));
    const memoOwnerUid = currentAuthUid || studentAuthUid || '';

    const sortedLogs = useMemo(
        () => getSortedLessonLogs(lessonLogs, selectedClassId),
        [lessonLogs, selectedClassId]
    );

    const [viewMode, setViewMode] = useState('list');
    const [currentLesson, setCurrentLesson] = useState(null);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [pendingNativeVideo, setPendingNativeVideo] = useState(null);
    const playerRef = useRef(null);
    const [isAttendanceDetailOpen, setIsAttendanceDetailOpen] = useState(false);
    const [isVideoListOpen, setIsVideoListOpen] = useState(false);

    // 자료 리스트 펼침 상태 관리
    const [expandedMaterialLogId, setExpandedMaterialLogId] = useState(null);
    const attendanceMap = useMemo(() => {
        const map = {};
        sortedLogs.forEach((log) => {
            const attendance = attendanceLogs.find(
                (attendanceLog) =>
                    (attendanceLog.studentId || attendanceLog.studentUid) === studentDocId &&
                    (attendanceLog.lessonLogId === log.id ||
                        (!attendanceLog.lessonLogId &&
                            attendanceLog.classId === log.classId &&
                            attendanceLog.date === log.date))
            );
            const normalizedStatus = normalizeAttendanceStatus(attendance?.status);
            if (normalizedStatus) {
                map[log.id] = { status: normalizedStatus };
            }
        });
        return map;
    }, [attendanceLogs, sortedLogs, studentDocId]);

    useEffect(() => {
        if (targetMemo && targetMemo.lessonId) {
            const target = getCurrentLessonByDate(sortedLogs, null, targetMemo.lessonId);
            if (target) {
                const targetVideos = normalizeLessonVideos(target);
                const targetVideo = targetVideos[0] || null;
                const targetVideoId = targetVideo?.youtubeVideoId || targetVideo?.videoId;

                setCurrentLesson(target);
                setSelectedVideo(targetVideo);

                const canAccessTargetLesson = canAccessLessonContent(attendanceMap[target.id]);

                if (isCapacitorNativeEnvironment() && targetVideoId && canAccessTargetLesson) {
                    setPendingNativeVideo({
                        lessonId: target.id,
                        videoId: targetVideoId,
                        initialSeconds: targetMemo.time || 0,
                        requestId: Date.now(),
                    });
                    return;
                }

                setPendingNativeVideo(null);
                setViewMode('player');
            }
        }
    }, [targetMemo, sortedLogs, attendanceMap]);

    useEffect(() => {
        if (onVideoModalChange) {
            onVideoModalChange(viewMode === 'player');
        }
    }, [viewMode, onVideoModalChange]);

    const [bookmarkNote, setBookmarkNote] = useState('');
    const [isListOpen, setIsListOpen] = useState(false);
    const [editingMemoId, setEditingMemoId] = useState(null);
    const [editFields, setEditFields] = useState({ note: '', time: '' });

    useEffect(() => {
        setEditingMemoId(null);
        setEditFields({ note: '', time: '' });
    }, [currentLesson?.id]);

    const getProgress = (lessonId) => {
        const primary = calculateVideoProgress(videoProgress, studentAuthUid, lessonId);
        if ((primary.percent || primary.seconds || primary.accumulated) && studentAuthUid) return primary;
        return calculateVideoProgress(videoProgress, studentDocId, lessonId);
    };

    // --- 통계 및 상태 계산 ---
    const stats = useMemo(
        () => buildClassroomStats({
            attendanceLogs,
            selectedClassId,
            studentDocId,
            studentAuthUid,
            homeworkAssignments,
            homeworkResults,
            tests,
            grades,
        }),
        [attendanceLogs, selectedClassId, studentDocId, studentAuthUid, homeworkAssignments, homeworkResults, tests, grades]
    );

    const handleAddMemo = async () => {
        if (!playerRef.current || !bookmarkNote.trim() || !currentLesson || !memoOwnerUid) return;
        const currentTime = playerRef.current.getCurrentTime();
        try {
            await onAddMemo?.(memoOwnerUid, { lessonId: currentLesson.id, time: currentTime, note: bookmarkNote });
            setBookmarkNote('');
        } catch (error) {
            console.error('[ClassroomView] add memo failed', error);
        }
    };

    const handleAddNativeMemo = async ({ videoId, currentTime, note }) => {
        if (!currentLesson || !memoOwnerUid || !note?.trim()) return;
        if (videoId && currentVideoId && String(videoId) !== String(currentVideoId)) return;

        try {
            await onAddMemo?.(memoOwnerUid, {
                lessonId: currentLesson.id,
                time: Number(currentTime) || 0,
                note: note.trim(),
            });
        } catch (error) {
            console.error('[ClassroomView] add native memo failed', error);
        }
    };

    const handleUpdateNativeMemo = async ({ id, videoId, note, time }) => {
        if (!id || !memoOwnerUid || !note?.trim()) return;
        if (videoId && currentVideoId && String(videoId) !== String(currentVideoId)) return;

        try {
            await onUpdateMemo?.(memoOwnerUid, id, {
                note: note.trim(),
                ...(time !== undefined ? { time: Number(time) || 0 } : {}),
            });
        } catch (error) {
            console.error('[ClassroomView] update native memo failed', error);
        }
    };

    const handleDeleteNativeMemo = async ({ id, videoId }) => {
        if (!id || !memoOwnerUid) return;
        if (videoId && currentVideoId && String(videoId) !== String(currentVideoId)) return;

        try {
            await onDeleteMemo?.(memoOwnerUid, id);
        } catch (error) {
            console.error('[ClassroomView] delete native memo failed', error);
        }
    };

    const handleSeekToMemo = (time) => {
        if (playerRef.current) playerRef.current.seekTo(time);
    };

    const handleWatchedTick = (addedSeconds, currentTime, duration) => {
        if (!currentLesson || duration <= 0) return;
        const prevData = getProgress(currentLesson.id);
        const newAccumulated = (prevData.accumulated || 0) + addedSeconds;
        const newPercent = Math.min(100, Math.floor((newAccumulated / duration) * 100));
        onSaveVideoProgress(studentAuthUid, currentLesson.id, {
            percent: newPercent, seconds: currentTime, accumulated: newAccumulated
        });
    };

    const startEditingMemo = (memo) => {
        setEditingMemoId(memo.id);
        setEditFields({ note: memo.note || '', time: memo.time ?? 0 });
    };

    const handleSaveEditedMemo = async () => {
        if (!editingMemoId || !memoOwnerUid) return;
        try {
            await onUpdateMemo?.(memoOwnerUid, editingMemoId, editFields);
            setEditingMemoId(null);
            setEditFields({ note: '', time: '' });
        } catch (error) {
            console.error('[ClassroomView] update memo failed', error);
        }
    };

    const handleDeleteMemo = async (memoId) => {
        if (!memoId || !memoOwnerUid) return;
        if (!window.confirm('이 메모를 삭제하시겠어요?')) return;
        try {
            await onDeleteMemo?.(memoOwnerUid, memoId);
            if (editingMemoId === memoId) {
                setEditingMemoId(null);
                setEditFields({ note: '', time: '' });
            }
        } catch (error) {
            console.error('[ClassroomView] delete memo failed', error);
        }
    };

    const myMemos = useMemo(() => {
        const lessonId = currentLesson?.id;
        return getLessonVideoMemosFromState(videoMemos, memoOwnerUid, lessonId);
    }, [videoMemos, memoOwnerUid, currentLesson?.id]);

    const progressData = getProgress(currentLesson?.id);

    const lessonVideos = useMemo(() => normalizeLessonVideos(currentLesson), [currentLesson]);
    const hasLessonVideos = lessonVideos.length > 0;
    const hasMultipleLessonVideos = lessonVideos.length > 1;
    const canAccessCurrentLesson = canAccessLessonContent(
        currentLesson ? attendanceMap[currentLesson.id] : null
    );

    useEffect(() => {
        setSelectedVideo(lessonVideos[0] || null);
        setIsVideoListOpen(false);
    }, [lessonVideos]);


    const nativeLessonVideos = useMemo(() => lessonVideos.map((video, index) => ({
        id: String(video.id ?? `video-${index}`),
        title: String(video.title || `${index + 1}번 영상`),
        videoId: String(video.videoId || video.youtubeVideoId || ''),
        youtubeVideoId: String(video.youtubeVideoId || video.videoId || ''),
    })).filter((video) => video.videoId || video.youtubeVideoId), [lessonVideos]);

    const nativeLessonList = useMemo(() => sortedLogs.map((log) => {
        const videos = normalizeLessonVideos(log);
        const firstVideo = videos[0] || {};
        const canAccess = canAccessLessonContent(attendanceMap[log.id]);
        return {
            id: String(log.id),
            date: String(log.date || ''),
            title: String(log.title || log.progress || log.date || '강의'),
            progress: String(log.progress || log.title || ''),
            videosCount: videos.length,
            firstVideoId: String(firstVideo.youtubeVideoId || firstVideo.videoId || ''),
            canAccess,
            locked: !canAccess,
        };
    }), [sortedLogs, attendanceMap]);

    const handleNativeVideoSelected = (payload = {}) => {
        const next = lessonVideos.find((video) => String(video.id) === String(payload.id) || String(video.youtubeVideoId || video.videoId) === String(payload.videoId || payload.youtubeVideoId));
        if (next) setSelectedVideo(next);
    };

    const handleNativeLessonSelected = (payload = {}) => {
        const nextLesson = sortedLogs.find((log) => String(log.id) === String(payload.lessonId || payload.id));
        if (!nextLesson || !canAccessLessonContent(attendanceMap[nextLesson.id])) return;
        const videos = normalizeLessonVideos(nextLesson);
        setCurrentLesson(nextLesson);
        setSelectedVideo(videos[0] || null);
    };

    const currentVideoId = selectedVideo?.youtubeVideoId || selectedVideo?.videoId;
    const currentDirectVideoUrl = selectedVideo?.videoUrl || selectedVideo?.fileUrl || selectedVideo?.hlsUrl || selectedVideo?.directUrl || '';
    const isNativeApp = isCapacitorNativeEnvironment();
    const isIosNativeApp = isIosCapacitorNativeEnvironment();


    const handleVideoEnded = (currentTime, duration) => {
        if (!currentLesson || duration <= 0) return;
        onSaveVideoProgress(studentAuthUid, currentLesson.id, {
            percent: 100,
            seconds: currentTime || duration,
            accumulated: duration,
        });
    };

    const openSelectedVideoInYouTube = () => {
        if (!currentVideoId) return;
        window.open(`https://www.youtube.com/watch?v=${currentVideoId}`, '_blank');
    };

    const renderAccessRestrictedNotice = () => (
        <div className="flex flex-col items-center justify-center text-gray-300 text-center px-6">
            <Icon name="lock" className="w-10 h-10 mb-3 opacity-70" />
            <p className="text-sm leading-relaxed">출결 확인 후 시청 가능합니다</p>
        </div>
    );

    const renderCurrentVideoPlayer = () => {
        const initialSeconds = targetMemo?.time || progressData.seconds;

        console.log('[video branch]', {
            currentVideoId,
            isNativeApp,
            isIosNativeApp,
            href: window.location.href,
            origin: window.location.origin,
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            capacitorPlatform: Capacitor?.getPlatform?.(),
            windowCapacitorPlatform: window.Capacitor?.getPlatform?.(),
        });

        if (currentDirectVideoUrl) {
            return (
                <VideoFilePlayer
                    ref={playerRef}
                    src={currentDirectVideoUrl}
                    initialSeconds={initialSeconds}
                    onWatchedTick={handleWatchedTick}
                    onEnded={handleVideoEnded}
                />
            );
        }

        if (currentVideoId && isIosNativeApp) {
            return (
                <NativeYouTubeLauncher
                    videoId={currentVideoId}
                    initialSeconds={initialSeconds}
                    memos={myMemos}
                    currentLessonId={currentLesson?.id || ''}
                    lessonVideos={nativeLessonVideos}
                    lessonList={nativeLessonList}
                    onNativeVideoSelected={handleNativeVideoSelected}
                    onNativeLessonSelected={handleNativeLessonSelected}
                    onAddNativeMemo={handleAddNativeMemo}
                    onUpdateNativeMemo={handleUpdateNativeMemo}
                    onDeleteNativeMemo={handleDeleteNativeMemo}
                />
            );
        }

        if (currentVideoId && !isNativeApp) {
            return (
                <YouTubePlayer
                    ref={playerRef}
                    videoId={currentVideoId}
                    initialSeconds={initialSeconds}
                    onWatchedTick={handleWatchedTick}
                    onEnded={handleVideoEnded}
                />
            );
        }

        if (currentVideoId && isNativeApp) {
            return (
                <div className="w-full h-full min-h-[220px] flex flex-col items-center justify-center bg-gray-950 text-white text-center px-6 py-8">
                    <div className="max-w-sm space-y-4">
                        <p className="text-sm sm:text-base font-semibold leading-relaxed">
                            앱 내 재생이 제한된 영상입니다. 관리자에게 문의해주세요.
                        </p>
                        <button
                            type="button"
                            onClick={openSelectedVideoInYouTube}
                            className="inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-700 active:scale-95"
                        >
                            YouTube에서 보기
                        </button>
                    </div>
                </div>
            );
        }

        return (<div className="flex flex-col items-center justify-center text-gray-500"><Icon name="monitor" className="w-12 h-12 mb-2 opacity-50" /><p>재생할 영상이 없습니다.</p></div>);
    };

    const toggleMaterials = (e, logId) => {
        e.stopPropagation();
        setExpandedMaterialLogId(prev => prev === logId ? null : logId);
    };

    const playVideo = (log) => {
        const videos = normalizeLessonVideos(log);
        const firstVideo = videos[0] || null;
        const videoId = firstVideo?.youtubeVideoId || firstVideo?.videoId;

        setCurrentLesson(log);
        setSelectedVideo(firstVideo);

        const canAccess = canAccessLessonContent(attendanceMap[log.id]);

        if (isNativeApp && videoId && canAccess) {
            const logProgress = getProgress(log.id);
            setPendingNativeVideo({
                lessonId: log.id,
                videoId,
                lessonVideos: videos.map((video, index) => ({
                    id: String(video.id ?? `video-${index}`),
                    title: String(video.title || `${index + 1}번 영상`),
                    videoId: String(video.videoId || video.youtubeVideoId || ''),
                    youtubeVideoId: String(video.youtubeVideoId || video.videoId || ''),
                })).filter((video) => video.videoId || video.youtubeVideoId),
                lessonList: nativeLessonList,
                initialSeconds: targetMemo?.lessonId === log.id ? (targetMemo.time || 0) : (logProgress.seconds || 0),
                requestId: Date.now(),
            });
            return;
        }

        setPendingNativeVideo(null);
        if (viewMode === 'list') setViewMode('player');
    };

    const handleCardBodyClick = (log) => {
        if (isNativeApp) return;
        playVideo(log);
    };

    const renderLogItem = (log) => {
        const { percent: prog } = getProgress(log.id);
        const isSelected = currentLesson?.id === log.id;
        const attachments = Array.isArray(log.attachments)
            ? log.attachments
            : (Array.isArray(log.materials) ? log.materials : []);
        const hasMaterials = attachments.length > 0;
        const isMaterialsExpanded = expandedMaterialLogId === log.id;
        const canAccess = canAccessLessonContent(attendanceMap[log.id]);

        return (
            <div
                key={log.id}
                className={`p-4 rounded-xl transition-all border ${
                    isSelected
                        ? 'bg-[#f1f4ff] border-[#cfd8ff] shadow-sm'
                        : 'bg-white border-gray-100 hover:bg-gray-50'
                }`}
            >
                <div className="flex justify-between items-start">
                    <div
                        className={`flex-1 min-w-0 pr-4 ${isNativeApp ? '' : 'cursor-pointer'}`}
                        onClick={() => handleCardBodyClick(log)}
                    >
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{log.date}</span>
                            {prog >= 100 && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">완료</span>}
                            {prog > 0 && prog < 100 && <span className="text-[10px] font-bold text-[#455fab] bg-[#f1f4ff] px-1.5 py-0.5 rounded border border-[#eef2ff]">{prog}%</span>}
                        </div>
                        <h4 className={`text-base font-bold truncate ${isSelected ? 'text-[#334a91]' : 'text-gray-800'}`}>{log.progress}</h4>
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
                            onClick={(e) => { e.stopPropagation(); playVideo(log); }}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${isSelected ? 'bg-[#eef2ff] text-[#455fab]' : 'bg-gray-50 text-gray-300'}`}
                        >
                            <PlayCircleFilledWhiteIcon className="w-7 h-7" />
                        </button>
                    </div>
                </div>

                {isMaterialsExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-200/60 animate-fade-in-down">
                        <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                            <Icon name="folder" className="w-3 h-3" />
                            강의 자료 ({attachments.length})
                        </p>
                        <div className="space-y-2">
                            {attachments.map((mat, idx) => (
                                canAccess ? (
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
                                ) : (
                                    <span
                                        key={idx}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-500"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0 text-gray-400">
                                            <Icon name="download" className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-medium truncate flex-1">
                                            {mat.name} (출결 확인 후 다운로드 가능)
                                        </span>
                                    </span>
                                )
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
                {pendingNativeVideo && (
                    <NativeYouTubeLauncher
                        key={`${pendingNativeVideo.lessonId}-${pendingNativeVideo.videoId}-${pendingNativeVideo.initialSeconds}-${pendingNativeVideo.requestId}`}
                        videoId={pendingNativeVideo.videoId}
                        initialSeconds={pendingNativeVideo.initialSeconds}
                        memos={myMemos}
                        currentLessonId={currentLesson?.id || ''}
                        lessonVideos={pendingNativeVideo.lessonVideos || nativeLessonVideos}
                        lessonList={pendingNativeVideo.lessonList || nativeLessonList}
                        onNativeVideoSelected={handleNativeVideoSelected}
                        onNativeLessonSelected={handleNativeLessonSelected}
                        onAddNativeMemo={handleAddNativeMemo}
                        onUpdateNativeMemo={handleUpdateNativeMemo}
                        onDeleteNativeMemo={handleDeleteNativeMemo}
                        autoOpen
                        renderControls={false}
                    />
                )}
                <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedClassId(null)} className="mobile-back-button p-2 bg-white rounded-xl text-gray-600 hover:bg-gray-100 transition-colors shadow-sm active:scale-95">
                        <Icon name="chevronLeft" className="w-6 h-6" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{selectedClass?.name}</h2>
                        <p className="text-xs text-gray-500">{formatClassScheduleKo(selectedClass) || '시간 미정'}</p>
                    </div>
                </div>


                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        {/* ✅ [수정] 복습 영상 아이콘: list -> video */}
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Icon name="video" className="w-5 h-5 text-[#455fab]" />복습 영상 ({sortedLogs.length})</h3>
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
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${log.status === '출석' ? 'bg-green-100 text-green-700' : log.status === '지각' ? 'bg-yellow-100 text-yellow-700' : log.status === '동영상보강' ? 'bg-blue-100 text-[#334a91]' : 'bg-red-100 text-red-700'}`}>{log.status}</span>
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
        <div className="mobile-screen fixed inset-0 z-50 bg-white flex flex-col animate-fade-in-up">
            <div className="mobile-header flex-none flex items-center gap-3 px-4 border-b border-gray-200 bg-white shadow-sm z-20">
                <button onClick={() => { setViewMode('list'); onClearTargetMemo(); }} className="mobile-back-button p-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors active:scale-95"><Icon name="chevronLeft" className="w-5 h-5" /></button>
                <div className="flex-1 min-w-0"><h2 className="text-base font-bold text-gray-900 truncate"><span className="text-[#455fab] mr-2">[{currentLesson?.date}]</span>{currentLesson?.progress}</h2></div>
            </div>

            <div className={`flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden ${hasLessonVideos ? 'bg-black' : 'bg-white'}`}>
                {hasLessonVideos && (
                    <div className="flex-none lg:flex-1 flex flex-col overflow-visible lg:overflow-hidden bg-gray-50 lg:border-r lg:border-gray-200 relative pb-2 lg:pb-0">
                        <div className="flex-none lg:flex-1 lg:min-h-0 bg-black flex flex-col overflow-visible lg:overflow-hidden">
                            <div className="flex-none aspect-video lg:aspect-auto lg:flex-1 flex items-center justify-center w-full">
                                {!canAccessCurrentLesson ? (
                                    renderAccessRestrictedNotice()
                                ) : (
                                    <div className="w-full h-full max-w-full max-h-full aspect-video flex items-center justify-center">{renderCurrentVideoPlayer()}</div>
                                )}
                            </div>

                        {hasMultipleLessonVideos && (
                                <div className="bg-gray-900 border-t border-gray-800 shrink-0">
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
                                        <div className="max-h-48 lg:max-h-64 overflow-y-auto custom-scrollbar bg-black/70 divide-y divide-gray-800">
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

                    <div className="bg-white border-y border-gray-200 shrink-0">
                            <div className="px-4 py-3 flex justify-between items-center">
                                <div className="bg-gray-900 px-4 py-1.5 rounded-full flex items-center gap-3 shadow-sm border border-gray-200"><span className="text-xs text-gray-300 font-medium">내 수강률</span><div className="w-20 bg-gray-700 rounded-full h-1.5 overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${progressData.percent >= 100 ? 'bg-green-500' : 'bg-[#455fab]'}`} style={{ width: `${progressData.percent}%` }}></div></div><span className={`text-xs font-bold font-mono ${progressData.percent >= 100 ? 'text-green-400' : 'text-white'}`}>{progressData.percent}%</span></div>
                                <button onClick={() => setIsListOpen(!isListOpen)} className="flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-[#334a91] transition-colors bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200 active:bg-gray-300">{isListOpen ? '목록 닫기' : '다른 강의'}<Icon name={isListOpen ? "chevronDown" : "chevronUp"} className="w-4 h-4" /></button>
                            </div>
                        </div>
                    {isListOpen && (
                            <div className="max-h-48 lg:max-h-72 flex-none overflow-y-auto p-4 custom-scrollbar bg-white border-t border-gray-100">
                                <div className="space-y-2">
                                    {sortedLogs.map(log => renderLogItem(log))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <div className={`w-full ${hasLessonVideos ? 'lg:w-[400px]' : 'lg:w-full'} flex flex-col bg-white min-h-[40vh] lg:min-h-0 lg:h-full flex-shrink-0 border-t lg:border-t-0 ${hasLessonVideos ? 'lg:border-l' : ''} border-gray-200`}>
                    <div className="flex border-b border-gray-200 bg-gray-50">
                        <div className="flex-1 py-3 text-center text-sm font-bold text-[#455fab] border-b-2 border-[#455fab] bg-white">학습 메모</div>
                    </div>
                    <div className="p-4 border-b border-gray-100 bg-white">
                        <div className="flex gap-2">
                        <input type="text" value={bookmarkNote} onChange={(e) => setBookmarkNote(e.target.value)} placeholder="중요한 내용 메모하기..." className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#455fab] focus:outline-none transition-all" onKeyPress={(e) => e.key === 'Enter' && handleAddMemo()} />
                            <button onClick={handleAddMemo} className="bg-[#455fab] hover:bg-[#3b5198] text-white p-2.5 rounded-xl transition-colors shadow-sm flex-shrink-0 active:scale-95"><Icon name="plus" className="w-5 h-5" /></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/30">
                        {myMemos.length > 0 ? (
                            <div className="space-y-3">
                                {myMemos.map((bm) => {
                                    const isEditing = editingMemoId === bm.id;
                                    return (
                                        <div key={bm.id} className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm hover:border-[#cfd8ff] hover:shadow-md transition-all group">
                                            <button onClick={() => handleSeekToMemo(bm.time)} className="flex items-center gap-2 mb-2 w-full text-left active:opacity-70">
                                                <div className="bg-[#f1f4ff] text-[#455fab] px-2 py-1 rounded text-[11px] font-bold font-mono border border-[#eef2ff] flex items-center gap-1 group-hover:bg-[#455fab] group-hover:text-white transition-colors">
                                                    <Icon name="play" className="w-3 h-3" />
                                                    {formatTime(bm.time)}
                                                </div>
                                                <span className="text-xs text-gray-400 ml-auto">이동하기</span>
                                            </button>
                                            {isEditing ? (
                                                <div className="space-y-2">
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="number"
                                                            value={editFields.time}
                                                            onChange={(e) => setEditFields((prev) => ({ ...prev, time: e.target.value }))}
                                                            className="w-28 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#455fab] focus:outline-none"
                                                            min={0}
                                                            step={1}
                                                        />
                                                        <div className="flex gap-2 ml-auto">
                                                            <button onClick={handleSaveEditedMemo} className="px-3 py-2 rounded-lg bg-[#455fab] text-white text-xs font-bold hover:bg-[#3b5198] active:scale-95">저장</button>
                                                            <button onClick={() => { setEditingMemoId(null); setEditFields({ note: '', time: '' }); }} className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 active:scale-95">취소</button>
                                                        </div>
                                                    </div>
                                                    <textarea
                                                        value={editFields.note}
                                                        onChange={(e) => setEditFields((prev) => ({ ...prev, note: e.target.value }))}
                                                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#455fab] focus:outline-none"
                                                        rows={2}
                                                    />
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-800 leading-relaxed pl-1 break-words">{bm.note}</p>
                                            )}
                                            <div className="flex justify-end gap-2 mt-3">
                                                {!isEditing && (
                                                    <>
                                                        <button onClick={() => startEditingMemo(bm)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 active:scale-95">수정</button>
                                                        <button onClick={() => handleDeleteMemo(bm.id)} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 active:scale-95">삭제</button>
                                                    </>
                                                )}
                                                {isEditing && (
                                                    <button onClick={() => handleDeleteMemo(bm.id)} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 active:scale-95">삭제</button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center"><Icon name="pen" className="w-8 h-8 text-gray-300" /></div>
                                <div className="text-center text-xs"><p>아직 작성된 메모가 없습니다.</p><p className="mt-1">영상 재생 중 중요한 부분을 기록해보세요!</p></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
