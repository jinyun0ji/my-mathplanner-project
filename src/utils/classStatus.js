const isValidDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());

const getLocalStartOfDay = (date) => {
    const local = new Date(date);
    local.setHours(0, 0, 0, 0);
    return local;
};

const parseDateString = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const localDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (localDateMatch) {
        const [, year, month, day] = localDateMatch;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }
    return new Date(trimmed);
};

const parseDateValue = (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') return parseDateString(value);
    if (typeof value === 'number') {
        const msValue = value < 1_000_000_000_000 ? value * 1000 : value;
        return new Date(msValue);
    }
    if (typeof value?.toDate === 'function') {
        return value.toDate();
    }
    return null;
};

const normalizeEndDate = (classDoc) => {
    const parsed = parseDateValue(classDoc?.endDate);
    if (!parsed || !isValidDate(parsed)) return null;
    return getLocalStartOfDay(parsed);
};

const getTodayStart = () => getLocalStartOfDay(new Date());

export const isClassOngoing = (classDoc) => {
    const endDate = normalizeEndDate(classDoc);
    if (!endDate) return true;
    return endDate.getTime() >= getTodayStart().getTime();
};

export const isClassFinished = (classDoc) => {
    const endDate = normalizeEndDate(classDoc);
    if (!endDate) return false;
    return endDate.getTime() < getTodayStart().getTime();
};

export const getDefaultClassId = (classes = []) => {
    const ongoing = classes.find(isClassOngoing);
    return ongoing?.id ?? classes[0]?.id ?? null;
};

export const sortClassesByStatus = (classes = []) => {
    const ongoing = [];
    const finished = [];
    classes.forEach((cls) => {
        if (isClassOngoing(cls)) {
            ongoing.push(cls);
        } else {
            finished.push(cls);
        }
    });
    return { ongoing, finished, ordered: [...ongoing, ...finished] };
};