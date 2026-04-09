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

const CLOSED_STATUS_SET = new Set([
    '종강',
    '종료',
    '마감',
    'closed',
    'close',
    'completed',
    'complete',
    'finished',
    'inactive',
]);

const normalizeStatusText = (value) => String(value || '').trim().toLowerCase();

const readClassStatus = (classDoc = {}) => (
    classDoc.status
    || classDoc.classStatus
    || classDoc.state
    || classDoc.lifecycleStatus
    || ''
);

const compareClassNameKo = (a, b) => {
    const left = String(a?.name || '');
    const right = String(b?.name || '');
    return left.localeCompare(right, 'ko');
};

export const isClosedClass = (classDoc) => {
    if (!classDoc) return false;

    const status = normalizeStatusText(readClassStatus(classDoc));
    if (status && CLOSED_STATUS_SET.has(status)) return true;

    const endDate = normalizeEndDate(classDoc);
    if (!endDate) return false;

    const isOperating = Boolean(classDoc?.isOperating ?? classDoc?.operating ?? classDoc?.isActive);
    if (isOperating) return false;

    return endDate.getTime() < getTodayStart().getTime();
};

export const sortClassesWithClosedLast = (classes = []) => {
    const list = Array.isArray(classes) ? [...classes] : [];
    return list.sort((a, b) => {
        const aClosed = isClosedClass(a);
        const bClosed = isClosedClass(b);
        if (aClosed !== bClosed) return aClosed ? 1 : -1;
        return compareClassNameKo(a, b);
    });
};

export const formatClassLabel = (classDoc, { includeClosedBadge = true } = {}) => {
    if (!classDoc) return '';
    const teacher = classDoc.teacher ? ` (${classDoc.teacher})` : '';
    const closedSuffix = includeClosedBadge && isClosedClass(classDoc) ? ' [종강]' : '';
    return `${classDoc.name || '이름 없음'}${teacher}${closedSuffix}`;
};

export const isClassOngoing = (classDoc) => {
    return !isClosedClass(classDoc);
};

export const isClassFinished = (classDoc) => {
    return isClosedClass(classDoc);
};

export const getDefaultClassId = (classes = []) => {
    const ongoing = classes.find(isClassOngoing);
    return ongoing?.id ?? classes[0]?.id ?? null;
};

export const sortClassesByStatus = (classes = [], studentClassStatusMap = {}, childClassExitMap = {}) => {
    const all = Array.isArray(classes) ? classes : [];

    const isWithdrawn = (value) => {
        const status = String(value || '').trim();
        return ['퇴원', '중도퇴원', '전반', '전반퇴원'].includes(status);
    };

    const getStatus = (classId) => {
        const exitStatus = childClassExitMap?.[classId]?.status;
        if (exitStatus) return exitStatus;
        return studentClassStatusMap?.[classId];
    };

    const isEndedByDate = (classDoc) => {
        const end = classDoc?.endDate || classDoc?.endAt || classDoc?.finishedAt;
        if (!end) return false;
        const date = typeof end === 'string'
            ? new Date(end)
            : (typeof end?.toDate === 'function' ? end.toDate() : new Date(end));
        return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
    };
    const ongoing = [];
    const finished = [];
    const withdrawn = [];

    all.forEach((cls) => {
        const classId = String(cls?.id || cls?.classId || '');
        const status = getStatus(classId);

        if (isWithdrawn(status)) {
            withdrawn.push(cls);
            return;
        }

        if (isEndedByDate(cls) || isClosedClass(cls)) {
            finished.push(cls);
            return;
        }

        ongoing.push(cls);
    });
    const ordered = [
        ...ongoing.sort(compareClassNameKo),
        ...finished.sort(compareClassNameKo),
        ...withdrawn.sort(compareClassNameKo),
    ];

    return {
        all,
        ongoing: ongoing.sort(compareClassNameKo),
        finished: finished.sort(compareClassNameKo),
        withdrawn: withdrawn.sort(compareClassNameKo),
        ordered,
    };
};

export const toDateSafe = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const normalizeYmd = (value) => {
    const date = toDateSafe(value);
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const isStudentActiveInClassOnDate = (student, classId, lessonDate) => {
    if (!student || !classId) return true;

    const map = student.classStatusMap;
    const statusInfo = map?.[classId];

    if (!statusInfo) return true;

    const status = String(statusInfo.status || '');
    const reason = String(statusInfo.endReason || '');

    if (status !== '퇴원' || reason !== '중도퇴원') return true;

    const endedAt = normalizeYmd(statusInfo.endedAt);
    const normalizedLessonDate = normalizeYmd(lessonDate);

    if (!endedAt || !normalizedLessonDate) return true;

    return normalizedLessonDate <= endedAt;
};

export const filterActiveStudentsForLesson = (students, classId, lessonDate) => {
    const list = Array.isArray(students) ? students : [];
    return list.filter((student) => isStudentActiveInClassOnDate(student, classId, lessonDate));
};