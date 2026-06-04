export const getNoticeDateValue = (notice) => (
    notice?.createdAt
    || notice?.updatedAt
    || notice?.date
    || notice?.scheduleTime
    || ''
);

export const getNoticeTime = (notice) => {
    const value = getNoticeDateValue(notice);
    if (!value) return 0;
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

export const sortNoticesForDisplay = (notices) => [...(Array.isArray(notices) ? notices : [])]
    .sort((a, b) => {
        const pinGap = Number(Boolean(b?.isPinned)) - Number(Boolean(a?.isPinned));
        if (pinGap !== 0) return pinGap;
        return getNoticeTime(b) - getNoticeTime(a);
    });

export const formatNoticeDate = (value) => {
    if (!value) return '-';
    if (typeof value === 'string') return value.slice(0, 10) || '-';
    if (typeof value?.toDate === 'function') return value.toDate().toISOString().slice(0, 10);
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toISOString().slice(0, 10);
};

export const stripNoticeHtml = (value) => {
    const html = String(value || '');
    if (!html) return '';

    const withoutImages = html
        .replace(/<img\b[^>]*>/gi, ' ')
        .replace(/data:image\/[a-z0-9.+-]+;base64,[^\s"'<>]+/gi, ' ');
    const withoutTags = withoutImages.replace(/<[^>]*>/g, ' ');
    const decoded = withoutTags
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&#x27;/gi, "'")
        .replace(/&#x2F;/gi, '/')
        .replace(/&#(\d+);/g, (_, code) => {
            const charCode = Number(code);
            return Number.isFinite(charCode) ? String.fromCharCode(charCode) : ' ';
        });

    return decoded
        .replace(/<img\b[^>]*>/gi, ' ')
        .replace(/data:image\/[a-z0-9.+-]+;base64,[^\s"'<>]+/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

export const getNoticePreviewText = (content, maxLength = 120) => {
    const text = stripNoticeHtml(content);
    if (!text) return '내용이 없습니다.';
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};