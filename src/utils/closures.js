export const toDateStr = (v) => {
    if (!v) return '';
    if (typeof v === 'string') return v.slice(0, 10);
    if (typeof v?.toDate === 'function') return v.toDate().toISOString().slice(0, 10);
    try { return new Date(v).toISOString().slice(0, 10); } catch { return ''; }
};

export const isDateWithin = (dateStr, startStr, endStr) => {
    if (!dateStr || !startStr || !endStr) return false;
    return dateStr >= startStr && dateStr <= endStr;
};

export const isClosedForClassOn = (closures = [], classId, dateStr) => {
    const cid = String(classId || '');
    const target = toDateStr(dateStr);
    if (!cid || !target) return false;

    return closures.some((c) => {
        const scope = c?.scope || '';
        const start = toDateStr(c?.startDate);
        const end = toDateStr(c?.endDate);
        if (!start || !end) return false;

        if (scope === 'global') {
            return isDateWithin(target, start, end);
        }
        if (scope === 'class' && String(c?.classId || '') === cid) {
            return isDateWithin(target, start, end);
        }
        return false;
    });
};