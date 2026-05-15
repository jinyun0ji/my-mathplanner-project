const normalizeToken = (value) => String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');

const pickRefCollectionFromRef = (ref) => {
    const raw = String(ref || '').trim();
    if (!raw) return '';
    return raw.split('/')[0] || '';
};

const getNotificationTokens = (notification = {}) => {
    const payload = notification.payload || {};
    return [
        notification.type,
        notification.category,
        notification.refCollection,
        payload.type,
        payload.category,
        payload.refCollection,
        pickRefCollectionFromRef(notification.ref),
        pickRefCollectionFromRef(payload.ref),
    ].map(normalizeToken).filter(Boolean);
};

const PARENT_ALLOWED_TOKENS = new Set([
    'lessonreport',
    'lessonreports',
    'clinicreport',
    'clinicreports',
    'cliniccomment',
    'announcement',
    'announcements',
    'post',
    'posts',
    'message',
    'messages',
    'chatmessage',
    'chat',
    'chats',
    'clinicreservationreminder',
]);

const PARENT_BLOCKED_TOKENS = new Set([
    'grade',
    'grades',
    'gradepublished',
    'attendance',
    'attendancelog',
    'attendancelogs',
    'attendanceupdated',
    'homework',
    'homeworkresult',
    'homeworkresults',
    'homeworkgraded',
    'lesson',
    'lessonlog',
    'lessonlogs',
    'lessonupdated',
    'clinicreservation',
    'clinicreservations',
    'clinicreservationcancelled',
    'clinicreservationcanceled',
    'cliniccanceled',
    'cliniccancelled',
]);

const PARENT_ALLOWED_TITLE_PATTERNS = [
    /수업\s*리포트/,
    /클리닉\s*리포트/,
    /공지사항|게시글/,
    /새\s*메시지|메신저/,
    /클리닉.*전날|전날.*클리닉/,
];

const PARENT_BLOCKED_TITLE_PATTERNS = [
    /성적/,
    /출결/,
    /과제/,
    /클리닉.*(취소|예약(?!.*전날))/,
    /수업\s*안내/,
];

export const isNotificationUnread = (notification = {}, lastReadAt = null) => {
    if (notification.isRead === true || notification.readAt) {
        return false;
    }

    const createdAt = notification.createdAt;
    if (!createdAt || !lastReadAt) {
        return true;
    }

    if (typeof createdAt?.toMillis === 'function' && typeof lastReadAt?.toMillis === 'function') {
        return createdAt.toMillis() > lastReadAt.toMillis();
    }

    return true;
};

export const isParentAllowedNotification = (notification = {}) => {
    const tokens = getNotificationTokens(notification);
    const hasAllowedToken = tokens.some((token) => PARENT_ALLOWED_TOKENS.has(token));

    if (hasAllowedToken) {
        return true;
    }

    if (tokens.some((token) => PARENT_BLOCKED_TOKENS.has(token))) {
        return false;
    }

    const title = String(notification.title || notification.payload?.title || '');
    const body = String(notification.body || notification.payload?.body || '');
    const text = `${title} ${body}`;

    if (PARENT_BLOCKED_TITLE_PATTERNS.some((pattern) => pattern.test(text))) {
        return false;
    }

    return PARENT_ALLOWED_TITLE_PATTERNS.some((pattern) => pattern.test(text));
};

export const filterParentNotifications = (notifications = [], lastReadAt = null, { unreadOnly = true } = {}) => {
    const list = Array.isArray(notifications) ? notifications : [];
    return list.filter((notification) => (
        isParentAllowedNotification(notification)
        && (!unreadOnly || isNotificationUnread(notification, lastReadAt))
    ));
};