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