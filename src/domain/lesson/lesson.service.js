import { getYouTubeId } from '../../utils/helpers';

const extractUrlFromIframe = (iframeCode = '') => {
    if (!iframeCode || typeof iframeCode !== 'string') return '';
    const srcMatch = iframeCode.match(/src="([^"]+)"/);
    return srcMatch && srcMatch[1] ? srcMatch[1] : '';
};

export const getSortedLessonLogs = (lessonLogs = [], classId) => {
    if (!classId) return [];

    return lessonLogs
        .filter(log => log.classId === classId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
};

export const getCurrentLessonByDate = (lessonLogs = [], targetDate, lessonId) => {
    if (lessonId) {
        return lessonLogs.find(log => log.id === lessonId) || null;
    }

    if (!targetDate) return null;

    return lessonLogs.find(log => log.date === targetDate) || null;
};

export const calculateVideoProgress = (videoProgress = {}, studentId, lessonId) => {
    if (!studentId || !lessonId) {
        return { percent: 0, seconds: 0, accumulated: 0 };
    }

    return videoProgress?.[studentId]?.[lessonId] || { percent: 0, seconds: 0, accumulated: 0 };
};

export const buildLessonSessions = (sessions = [], classLogs = [], selectedDate = null) => {
    return [...sessions]
        .reverse()
        .map(session => {
            const log = classLogs.find(l => l.date === session.date);
            const isLogged = !!log;
            const isSelected = session.date === selectedDate;

            return {
                session,
                log,
                isLogged,
                isSelected,
            };
        })
        .filter(item => item.isLogged || item.isSelected);
        };

export const normalizeLessonVideos = (lessonLog = null) => {
    if (!lessonLog) return [];

    const rawVideos = Array.isArray(lessonLog.videos) ? lessonLog.videos : [];

    const normalized = rawVideos
        .map((video, idx) => {
            const rawUrl = video?.url || video?.link || extractUrlFromIframe(video?.iframeCode);
            const videoId = video?.videoId || getYouTubeId(rawUrl) || null;

            return {
                id: video?.id || video?.key || `${lessonLog.id || 'lesson'}-${idx}`,
                title: video?.title || video?.name || `영상 ${idx + 1}`,
                url: rawUrl,
                iframeCode: video?.iframeCode || '',
                videoId,
            };
        })
        .filter(video => video.videoId || video.iframeCode || video.url);

    if (normalized.length > 0) return normalized;

    const fallbackUrl = extractUrlFromIframe(lessonLog.iframeCode) || lessonLog.materialUrl || '';
    const fallbackVideoId = getYouTubeId(fallbackUrl);

    if (!fallbackUrl && !fallbackVideoId) return [];

    return [{
        id: lessonLog.id || 'primary-video',
        title: lessonLog.progress || '수업 영상',
        url: fallbackUrl,
        iframeCode: lessonLog.iframeCode || '',
        videoId: fallbackVideoId,
    }];
};