export const normalizeDateToYMD = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value.slice(0, 10);
    if (typeof value?.toDate === 'function') {
        return value.toDate().toISOString().slice(0, 10);
    }
    try {
        return new Date(value).toISOString().slice(0, 10);
    } catch {
        return '';
    }
};

export const buildClosuresIndex = (closures = []) => {
    const byClassId = new Map();
    const globals = [];

    (closures || []).forEach((closure) => {
        if (!closure) return;
        const scope = String(closure.scope || '').trim();
        const classKey = String(closure.classId || '').trim();
        const isLegacyGlobal = !scope && (!classKey || classKey === 'all' || classKey === 'global');

        if (scope === 'global' || classKey === 'all' || classKey === 'global' || isLegacyGlobal) {
            globals.push(closure);
            return;
        }
        if (scope === 'class') {
            if (!classKey) return;
            const list = byClassId.get(classKey) || [];
            list.push(closure);
            byClassId.set(classKey, list);
        }
    });

    return { globals, byClassId };
};

export const isDateInClosureRange = (dateYMD, closure) => {
    if (!dateYMD || !closure) return false;
    const start = normalizeDateToYMD(closure.startDate);
    const end = normalizeDateToYMD(closure.endDate);
    if (!start || !end) return false;
    return dateYMD >= start && dateYMD <= end;
};

export const isClosedDate = ({ date, classId, closures = [] }) => {
    const targetDate = normalizeDateToYMD(date);
    if (!targetDate) return false;

    const { globals, byClassId } = buildClosuresIndex(closures);

    if (globals.some((closure) => isDateInClosureRange(targetDate, closure))) return true;

    const classKey = String(classId || '');
    if (!classKey) return false;

    const classClosures = byClassId.get(classKey) || [];
    return classClosures.some((closure) => isDateInClosureRange(targetDate, closure));
};

const findClosureMatch = ({ date, classId, closures = [] }) => {
    const targetDate = normalizeDateToYMD(date);
    if (!targetDate) return null;

    const { globals, byClassId } = buildClosuresIndex(closures);
    const classKey = String(classId || '');

    const globalMatch = globals.find((closure) => isDateInClosureRange(targetDate, closure));
    if (globalMatch) return globalMatch;

    if (!classKey) return null;
    const classClosures = byClassId.get(classKey) || [];
    return classClosures.find((closure) => isDateInClosureRange(targetDate, closure)) || null;
};

export const assertNotClosedOrThrow = ({ date, classId, closures = [], label = '해당 날짜' }) => {
    const targetDate = normalizeDateToYMD(date);
    if (!targetDate) return { ok: true };

    const match = findClosureMatch({ date: targetDate, classId, closures });
    if (!match) return { ok: true };

    const start = normalizeDateToYMD(match.startDate);
    const end = normalizeDateToYMD(match.endDate);
    const title = match.title || '휴강';
    const reason = match.reason ? ` (${match.reason})` : '';
    const rangeLabel = start && end ? `휴강 기간(${start}~${end})` : '휴강 기간';
    const message = `${rangeLabel}에는 ${label}로 등록할 수 없습니다.\n${title}${reason}`;

    return { ok: false, message, closure: match };
};

export const toDateStr = (value) => normalizeDateToYMD(value);

export const isDateWithin = (dateStr, startStr, endStr) => {
    if (!dateStr || !startStr || !endStr) return false;
    return dateStr >= startStr && dateStr <= endStr;
};

export const isClosedForClassOn = (closures = [], classId, dateStr) => {
    return isClosedDate({ date: dateStr, classId, closures });
};