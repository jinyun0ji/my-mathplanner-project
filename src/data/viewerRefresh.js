import { loadViewerDataOnce } from './firestoreSync';

export const VIEWER_TAB_REFRESH_TTL_MS = 20_000;
export const VIEWER_RESUME_THRESHOLD_MS = 30_000;

// Realtime subscriptions are deliberately restricted to these domain streams.
// All other viewer data must use the tab-scoped one-shot loader below.
export const VIEWER_REALTIME_COLLECTIONS = Object.freeze([
    'announcements',
    'lessonReports',
    'chatMessages',
    'clinicReservations',
]);

export const VIEWER_TAB_DATA_GROUPS = Object.freeze({
    home: ['attendance', 'homework', 'grades', 'clinic', 'schedule', 'announcements'],
    class: ['lessons', 'video'],
    report: ['attendance', 'homework', 'grades', 'clinic', 'lessons'],
    learning: ['homework', 'grades', 'clinic', 'lessons', 'video'],
    board: ['announcements'],
    notices: ['announcements'],
    schedule: ['schedule', 'clinic'],
    messenger: [],
    menu: ['announcements'],
    more: ['announcements'],
    notifications: [],
});

const GROUP_SETTERS = Object.freeze({
    attendance: ['setAttendanceLogs'],
    homework: ['setHomeworkAssignments', 'setHomeworkResults'],
    grades: ['setGrades'],
    clinic: ['setClinicLogs'],
    schedule: ['setExternalSchedules', 'setClosures'],
    announcements: ['setAnnouncements'],
    lessons: ['setLessonLogs', 'setTests', 'setClassTestStats', 'setLessonReports'],
    video: ['setVideoProgress', 'setVideoMemos'],
});
const ALL_SETTER_NAMES = new Set(Object.values(GROUP_SETTERS).flat());

export const normalizeViewerTab = (tab) => {
    const value = String(tab || 'home');
    return Object.prototype.hasOwnProperty.call(VIEWER_TAB_DATA_GROUPS, value) ? value : 'home';
};

export const getViewerTabFromNotification = (payload = {}) => {
    const collectionName = payload.refCollection || payload.collection || payload.type || '';
    if (/chat/i.test(collectionName)) return 'messenger';
    if (/announcement|post|board/i.test(collectionName)) return 'board';
    if (/schedule|reservation/i.test(collectionName)) return 'schedule';
    if (/homework|test|grade|clinic|report/i.test(collectionName)) return 'learning';
    return 'notifications';
};

export const createViewerRefreshController = ({
    getContext,
    now = () => Date.now(),
    ttlMs = VIEWER_TAB_REFRESH_TTL_MS,
    loader = loadViewerDataOnce,
}) => {
    const refreshedAt = new Map();
    const pending = new Map();

    const refresh = (requestedTab, { force = false } = {}) => {
        const tab = normalizeViewerTab(requestedTab);
        const groups = VIEWER_TAB_DATA_GROUPS[tab];
        if (groups.length === 0) return Promise.resolve({ tab, skipped: 'realtime' });

        const timestamp = now();
        if (!force && timestamp - (refreshedAt.get(tab) || 0) < ttlMs) {
            return Promise.resolve({ tab, skipped: 'ttl' });
        }
        if (pending.has(tab)) return pending.get(tab);

        const context = getContext();
        const baseContext = Object.fromEntries(
            Object.entries(context).filter(([name]) => !ALL_SETTER_NAMES.has(name)),
        );
        const scopedSetters = {};
        groups.forEach((group) => {
            (GROUP_SETTERS[group] || []).forEach((name) => {
                if (context[name]) scopedSetters[name] = context[name];
            });
        });
        const task = loader({ ...baseContext, ...scopedSetters, dataGroups: groups })
            .then(() => {
                refreshedAt.set(tab, now());
                return { tab, refreshed: true };
            })
            .finally(() => pending.delete(tab));
        pending.set(tab, task);
        return task;
    };

    return {
        refresh,
        refreshHome: (options) => refresh('home', options),
        refreshLearning: (options) => refresh('learning', options),
        refreshBoard: (options) => refresh('board', options),
        refreshSchedule: (options) => refresh('schedule', options),
        refreshMessenger: (options) => refresh('messenger', options),
        refreshMenu: (options) => refresh('menu', options),
        clear: () => refreshedAt.clear(),
    };
};
