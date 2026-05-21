// ⚠️ 이 파일은 staff/admin/teacher 전용 Firestore 단발성 로드 로직이다
// ⚠️ student / parent 계정에서는 절대 실행되면 안 된다
import {
    collection,
    documentId,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getDocs,
    doc,
    getDoc,
} from 'firebase/firestore';
import {
    ROLE,
    isStaffOrTeachingRole,
    isViewerGroupRole,
    isStudentRole,
} from '../constants/roles';
import {
    getViewerVisibleClassIds,
    getViewerClassVisibilityReason,
} from '../utils/classStatus';

const chunkArray = (items, size = 10) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

// ✅ Firestore 'in' / 'array-contains-any' 는 빈 배열이면 Invalid Query 발생
export function safeNonEmptyArray(arr) {
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : [];
}

const nonEmpty = (arr) => Array.isArray(arr) && arr.filter(Boolean).length > 0;
const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean).map(String)));
const safeArray = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
const uniqById = (arr) => {
    const m = new Map();
    (arr || []).forEach((x) => {
        if (!x) return;
        const id = x.id || x._id || null;
        if (!id) return;
        if (!m.has(id)) m.set(id, x);
    });
    return Array.from(m.values());
};


const isDevelopment = () => process.env.NODE_ENV !== 'production';
const viewerDebug = (...args) => {
    if (isDevelopment()) console.log(...args);
};

const getItemClassId = (item) => String(
    item?.classId
    || item?.classDocId
    || item?.classID
    || item?.class?.id
    || item?.class?.classId
    || item?.class?.classDocId
    || '',
).trim();

const filterItemsByVisibleClassIds = (items = [], visibleClassIds = [], collectionName = '') => {
    const visibleSet = new Set(safeNonEmptyArray(visibleClassIds));
    if (visibleSet.size === 0) return [];
    let warnedMissingClassId = false;
    return (Array.isArray(items) ? items : []).filter((item) => {
        const classId = getItemClassId(item);
        if (!classId) {
            if (!warnedMissingClassId && isDevelopment()) {
                warnedMissingClassId = true;
                console.warn('[viewer] missing class id while filtering collection', {
                    collectionName,
                    sampleDocId: item?.id || '',
                });
            }
            return false;
        }
        return visibleSet.has(classId);
    });
};

const fetchClassScopedDocs = async ({
    db,
    collectionName,
    classIds = [],
    buildQuery,
    mapDoc = (d) => normalizeAuthUid({ id: d.id, ...d.data() }),
    runLabel = collectionName,
    isCancelled = () => false,
    run = async (_label, fn) => fn(),
}) => {
    const ids = safeNonEmptyArray(classIds);
    if (ids.length === 0) {
        viewerDebug(`[viewer] ${collectionName} skipped: no visible classIds`);
        return [];
    }

    viewerDebug(`[viewer] ${collectionName} target classIds count=`, ids.length);
    const out = [];
    const seen = new Set();
    for (const ch of chunkArray(ids, 10)) {
        if (isCancelled()) return out;
        const snap = await run(`${runLabel} classId chunk(${ch.length})`, () => getDocs(buildQuery(ch)));
        snap.docs.forEach((d) => {
            if (seen.has(d.id)) return;
            seen.add(d.id);
            out.push(mapDoc(d));
        });
    }
    return out;
};



export const safeIn = (arr, max = 10) => safeNonEmptyArray(arr).slice(0, max);

export function buildInQueryOrNull(values, max = 10) {
    const v = safeIn(values, max);
    return v.length > 0 ? v : null;
}

const fetchListSafe = async (q, isCancelled = () => false, mapper = null) => {
    if (!q) return [];
    const snap = await getDocs(q);
    if (isCancelled()) return [];
    const baseItems = snap.docs.map((d) => normalizeAuthUid({ id: d.id, ...d.data() }));
    return mapper ? baseItems.map(mapper) : baseItems;
};

const viewerDetailCache = {
    lessonLogs: new Map(),
    attendance: new Map(),
    homeworkResults: new Map(),
    grades: new Map(),
};

const viewerDetailCacheKey = (classIds = [], studentId = '') => {
    const classKey = safeNonEmptyArray(classIds).sort().join(',');
    return `${classKey}|${String(studentId || '')}`;
};

const normalizeAuthUid = (item) => {
    if (item?.studentId) return item;
    if (item?.studentDocId) return { ...item, studentId: item.studentDocId };
    if (item?.authUid) return { ...item, studentId: item.authUid };
    if (item?.studentUid) return { ...item, studentId: item.studentUid };
    return item;
};

const formatPaymentDate = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value?.toDate === 'function') {
        return value.toDate().toISOString().slice(0, 10);
    }
    try {
        return new Date(value).toISOString().slice(0, 10);
    } catch (error) {
        return '';
    }
};

const normalizeClinicDateString = (value) => {
    if (!value) return '';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return '';
        const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) return `${match[1]}-${match[2]}-${match[3]}`;
        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toISOString().slice(0, 10);
        }
        return '';
    }
    if (typeof value?.toDate === 'function') {
        return value.toDate().toISOString().slice(0, 10);
    }
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }
    try {
        return new Date(value).toISOString().slice(0, 10);
    } catch (error) {
        return '';
    }
};

const resolveClinicEffectiveDate = (log) => {
    if (!log) return '';
    const date = normalizeClinicDateString(log.date);
    if (date) return date;
    const clinicDate = normalizeClinicDateString(log.clinicDate);
    if (clinicDate) return clinicDate;
    const createdAt = normalizeClinicDateString(log.createdAt);
    if (createdAt) return createdAt;
    return '';
};

const normalizeClinicLog = (log) => {
    if (!log) return log;
    const effectiveDate = resolveClinicEffectiveDate(log) || '';
    const plannedTimeRaw = log?.plannedTime ?? log?.timeSlot ?? log?.time ?? log?.slot ?? '';
    const plannedTime = String(plannedTimeRaw || '').trim();

    const normalized = {
        ...log,
        effectiveDate: String(effectiveDate || ''),
        plannedTime,
        __source: log.__source || 'clinicLogs',
    };

    // 예약 문서에서 studentDocId만 있는 경우 viewer에서 사용할 studentId 보정
    if (!normalized.studentId && normalized.studentDocId) {
        normalized.studentId = String(normalized.studentDocId);
    }

    return normalized;
};

const normalizeClinicReservation = (log) => {
    if (!log) return log;
    const base = normalizeAuthUid(log);
    const timeSlot = base.timeSlot || base.plannedTime || base.time || base.slot || '';
    return normalizeClinicLog({
        ...base,
        plannedTime: String(base.plannedTime || timeSlot || '').trim(),
        status: base.status || 'pending',
        __source: 'clinicReservations',
    });
};

const mergeClinicDocs = (clinicLogs = [], reservations = []) => {
    const mergedMap = new Map();
    [...clinicLogs, ...reservations].forEach((item) => {
        if (item?.id && !mergedMap.has(item.id)) {
            mergedMap.set(item.id, item);
        }
    });

    return Array.from(mergedMap.values()).sort((a, b) => {
        const effectiveDateCompare = String(b?.effectiveDate || '').localeCompare(String(a?.effectiveDate || ''));
        if (effectiveDateCompare !== 0) return effectiveDateCompare;
        return String(b?.plannedTime || '').localeCompare(String(a?.plannedTime || ''));
    });
};

const normalizePaymentLog = (log) => {
    const base = normalizeAuthUid(log);
    const firstItem = Array.isArray(base.items) ? base.items[0] : null;
    const itemAmount = firstItem && Number.isFinite(firstItem.price)
        ? firstItem.price * (Number(firstItem.quantity) || 1)
        : 0;
    const amount = Number.isFinite(base.amount) ? base.amount : itemAmount;
    const date = base.date || formatPaymentDate(base.createdAt);
    return {
        ...base,
        amount,
        date,
        status: base.status || 'paid',
        studentName: base.studentName || base.payerName,
        bookName: base.bookName || base.bookTitle || firstItem?.title || firstItem?.name,
    };
};

const fetchList = async (db, colName, setter, q, isCancelled, mapper = null) => {
    if (q === null) {
        if (!isCancelled()) setter([]);
        return [];
    }
    const snap = await getDocs(q || collection(db, colName));
    const baseItems = snap.docs.map((d) => normalizeAuthUid({ id: d.id, ...d.data() }));
    const items = mapper ? baseItems.map(mapper) : baseItems;
    if (isCancelled()) return [];
    setter(items);
    return items;
};

const fetchAttendanceLogsWithPagination = async (db, isCancelled, pageSize = 1000) => {
    const items = [];
    let lastDoc = null;

    while (true) {
        if (isCancelled()) return items;
        const constraints = [
            orderBy('date', 'desc'),
            limit(pageSize),
        ];
        if (lastDoc) {
            constraints.push(startAfter(lastDoc));
        }
        const snap = await getDocs(query(collection(db, 'attendanceLogs'), ...constraints));
        if (snap.empty) break;
        items.push(...snap.docs.map((d) => normalizeAuthUid({ id: d.id, ...d.data() })));
        lastDoc = snap.docs[snap.docs.length - 1];
        if (snap.size < pageSize) break;
    }

    return items;
};

const fetchClinicLogsLight = async (db, isCancelled, lightLimit = 300) => {
    const snap = await getDocs(
        query(
            collection(db, 'clinicLogs'),
            orderBy('date', 'desc'),
            limit(lightLimit),
        ),
    );
    if (isCancelled()) return [];
    return snap.docs.map((d) => normalizeClinicLog({ id: d.id, ...d.data() }));
};

const fetchClinicReservationsLight = async (db, isCancelled, lightLimit = 500) => {
    const snap = await getDocs(
        query(
            collection(db, 'clinicReservations'),
            orderBy('date', 'desc'),
            limit(lightLimit),
        ),
    );
    if (isCancelled()) return [];
    return snap.docs.map((d) => normalizeClinicReservation({ id: d.id, ...d.data() }));
};

const fetchClinicForViewer = async ({
    db,
    studentIds,
    studentAuthUids,
    isCancelled = () => false,
}) => {
    const results = [];

    try {
        const logs = await loadClinicLogsForViewer(db, safeArray(studentIds), isCancelled);
        results.push(...(logs || []));
    } catch (e) {
        console.warn('[viewer] clinicLogs FAIL', e);
    }

    const tryReservationsByField = async (field, values, maxDocs = 200) => {
        const chunks = chunkArray(values, 10);
        for (const ch of chunks) {
            if (!ch.length) continue;
            try {
                const docs = await fetchList(
                    db,
                    'clinicReservations',
                    () => {},
                    query(
                        collection(db, 'clinicReservations'),
                        where(field, 'in', ch),
                        orderBy('date', 'desc'),
                        limit(maxDocs),
                    ),
                    isCancelled,
                    normalizeClinicReservation,
                );
                results.push(...(docs || []));
            } catch (e) {
                console.warn(`[viewer] clinicReservations FAIL (${field})`, e);
            }
        }
    };

    try {
        const studentIdValues = safeIn(studentIds, 50);
        await tryReservationsByField('studentId', studentIdValues, 200);
        await tryReservationsByField('studentUid', studentIdValues, 100);
    } catch (e) {
        console.warn('[viewer] clinicReservations FAIL (student ids)', e);
    }

    try {
        const authValues = safeIn(studentAuthUids, 50);
        await tryReservationsByField('authUid', authValues, 200);
    } catch (e) {
        console.warn('[viewer] clinicReservations FAIL (authUid)', e);
    }

    return results.map((x) => normalizeClinicLog(x));
};

async function loadClinicLogsForViewer(db, viewerStudentDocIds, isCancelled = () => false) {
    if (!nonEmpty(viewerStudentDocIds)) return [];
    const targetIds = uniq(viewerStudentDocIds);

    if (targetIds.length === 1) {
        const q = query(
            collection(db, 'clinicLogs'),
            where('studentId', '==', targetIds[0]),
            orderBy('date', 'desc'),
            limit(200),
        );
        return fetchListSafe(q, isCancelled, normalizeClinicLog);
    }

    const results = [];
    const chunks = chunkArray(targetIds, 10);
    for (const chunk of chunks) {
        if (!nonEmpty(chunk)) continue;
        const q = query(
            collection(db, 'clinicLogs'),
            where('studentId', 'in', chunk),
            orderBy('date', 'desc'),
            limit(200),
        );
        results.push(...(await fetchListSafe(q, isCancelled, normalizeClinicLog)));
    }
    return results;
}

async function loadGradesForViewer(db, viewerStudentDocIds, isCancelled = () => false, viewerClassIds = []) {
    if (!nonEmpty(viewerStudentDocIds) || !nonEmpty(viewerClassIds)) return [];
    const ids = uniq(viewerStudentDocIds);
    const classIds = uniq(viewerClassIds);
    const out = [];
    const seen = new Set();

    const push = (items) => {
        (items || []).forEach((item) => {
            if (!item?.id || seen.has(item.id)) return;
            seen.add(item.id);
            out.push(item);
        });
    };

    for (const studentId of ids) {
        for (const classChunk of chunkArray(classIds, 10)) {
            try {
                const q = query(
                    collection(db, 'grades'),
                    where('authUid', '==', studentId),
                    where('classId', 'in', classChunk),
                    limit(500),
                );
                push(await fetchListSafe(q, isCancelled));
            } catch (e) {
                console.warn('[viewer] grades classId scoped query skipped', { studentId, classChunk, error: e });
            }
        }
    }

    return out;
}

async function loadHomeworkAssignmentsForViewer(
    db,
    viewerStudentDocIds,
    isCancelled = () => false,
    viewerClassIds = [],
) {
    const results = [];
    const seen = new Set();

    const push = (items) => {
        (items || []).forEach((item) => {
            if (!item?.id) return;
            if (seen.has(item.id)) return;
            seen.add(item.id);
            results.push(item);
        });
    };

    const ids = uniq(viewerStudentDocIds);
    const classIds = uniq(viewerClassIds);
    if (classIds.length === 0) return [];

    // 1) 학생 직접 지정 과제
    if (ids.length === 1) {
        try {
            const q = query(
                collection(db, 'homeworkAssignments'),
                where('targetStudents', 'array-contains', ids[0]),
                orderBy('assignedDate', 'desc'),
                limit(200),
            );
            push(await fetchListSafe(q, isCancelled));
        } catch (e) {
            console.warn('[viewer] homeworkAssignments targetStudents(single) skipped', e);
        }
    } else if (ids.length > 1) {
        const chunks = chunkArray(ids, 10);
        for (const chunk of chunks) {
            try {
                const q = query(
                    collection(db, 'homeworkAssignments'),
                    where('targetStudents', 'array-contains-any', chunk),
                    orderBy('assignedDate', 'desc'),
                    limit(200),
                );
                push(await fetchListSafe(q, isCancelled));
            } catch (e) {
                console.warn('[viewer] homeworkAssignments targetStudents(any) skipped', e);
            }
        }
    }

    // 2) classId 기반 과제
    if (classIds.length > 0) {
        const chunks = chunkArray(classIds, 10);
        for (const chunk of chunks) {
            try {
                const q = query(
                    collection(db, 'homeworkAssignments'),
                    where('classId', 'in', chunk),
                    orderBy('assignedDate', 'desc'),
                    limit(200),
                );
                push(await fetchListSafe(q, isCancelled));
            } catch (e) {
                console.warn('[viewer] homeworkAssignments classId skipped', e);
            }
        }
    }

    return results;
}

const buildGradesMap = (gradeList = []) => {
    const mapped = {};
    gradeList.forEach((item) => {
        const studentId = item?.authUid;
        const testId = item?.testId;
        if (!studentId || !testId) return;
        if (!mapped[studentId]) mapped[studentId] = {};
        mapped[studentId][testId] = item;
    });
    return mapped;
};

export async function fetchClinicLogsPaged({
    db,
    lastDoc = null,
    pageSize = 50,
    fromDate = null,
}) {
    const col = collection(db, 'clinicLogs');
    const constraints = [];

    if (fromDate) {
        constraints.push(where('date', '>=', fromDate));
    }

    constraints.push(orderBy('date', 'desc'));
    constraints.push(limit(pageSize));

    if (lastDoc) {
        constraints.push(startAfter(lastDoc));
    }

    const q = query(col, ...constraints);
    const snap = await getDocs(q);

    return {
        docs: snap.docs.map((d) => normalizeClinicLog({ id: d.id, ...d.data() })),
        lastDoc: snap.docs[snap.docs.length - 1] || null,
    };
}

export async function fetchClinicLogsDeepForStaff({
    db,
    classId,
    className,
    studentId,
    date,
    from,
    to,
    pageSize = 500,
    maxDocs = 5000,
    isCancelled = () => false,
}) {
    const logsCol = collection(db, 'clinicLogs');
    const reservationsCol = collection(db, 'clinicReservations');
    const clinicLogs = [];
    const reservations = [];

    // 서버 쿼리에는 사용하지 않지만 호출부 시그니처 호환 및 클라이언트 필터 의도를 유지한다.
    void classId;
    void className;
    void studentId;
    void pageSize;

    const pushClinicLogSnap = (snap) => {
        snap.forEach((d) => {
            clinicLogs.push(normalizeClinicLog({ id: d.id, ...d.data() }));
        });
    };

    const pushReservationSnap = (snap) => {
        snap.forEach((d) => {
            reservations.push(normalizeClinicReservation({ id: d.id, ...d.data() }));
        });
    };

    const safeMaxDocs = Math.min(Number(maxDocs) || 5000, 5000);

    if (date && String(date).trim()) {
        const logsQ = query(
            logsCol,
            where('date', '==', String(date).trim()),
            orderBy(documentId()),
            limit(safeMaxDocs),
        );
        const reservationsQ = query(
            reservationsCol,
            where('date', '==', String(date).trim()),
            orderBy(documentId()),
            limit(safeMaxDocs),
        );
        const [logsSnap, reservationsSnap] = await Promise.all([
            getDocs(logsQ),
            getDocs(reservationsQ),
        ]);
        if (isCancelled?.()) return [];
        pushClinicLogSnap(logsSnap);
        pushReservationSnap(reservationsSnap);
        return mergeClinicDocs(clinicLogs, reservations);
    }

    const fromDate = String(from || '').trim();
    const toDate = String(to || '').trim();

    if (fromDate || toDate) {
        const clauses = [];
        if (fromDate) {
            clauses.push(where('date', '>=', fromDate));
        }
        if (toDate) {
            clauses.push(where('date', '<=', toDate));
        }
        clauses.push(orderBy('date', 'desc'));
        clauses.push(limit(safeMaxDocs));

        const [logsSnap, reservationsSnap] = await Promise.all([
            getDocs(query(logsCol, ...clauses)),
            getDocs(query(reservationsCol, ...clauses)),
        ]);
        if (isCancelled?.()) return [];
        pushClinicLogSnap(logsSnap);
        pushReservationSnap(reservationsSnap);
        return mergeClinicDocs(clinicLogs, reservations);
    }


    const clauses = [
        orderBy('date', 'desc'),
        limit(safeMaxDocs),
    ];

    const [logsSnap, reservationsSnap] = await Promise.all([
        getDocs(query(logsCol, ...clauses)),
        getDocs(query(reservationsCol, ...clauses)),
    ]);
    if (isCancelled?.()) return [];
    pushClinicLogSnap(logsSnap);
    pushReservationSnap(reservationsSnap);

    return mergeClinicDocs(clinicLogs, reservations);
}

// staff 전용: grades 전체 페이지네이션 로드
const fetchGradesWithPagination = async (db, maxDocs = 5000, pageSize = 500) => {
    const all = [];
    let last = null;

    while (all.length < maxDocs) {
        const q = last
            ? query(
                collection(db, 'grades'),
                orderBy(documentId()),
                startAfter(last),
                limit(pageSize),
            )
            : query(
                collection(db, 'grades'),
                orderBy(documentId()),
                limit(pageSize),
            );

        const snap = await getDocs(q);
        if (snap.empty) break;

        all.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        last = snap.docs[snap.docs.length - 1];

        if (snap.size < pageSize) break;
    }

    return all;
};

const warnOnQuestionScores = (tests = [], context = 'viewer') => {
    tests.forEach((test) => {
        const totalQuestions = Number(test?.totalQuestions) || 0;
        const hasScores = Array.isArray(test?.questionScores);
        if (!hasScores || test.questionScores.length < totalQuestions) {
            console.warn(`[${context}] test missing questionScores`, test?.id);
        }
    });
};

const normalizeStudentUser = (user) => {
    if (!user || !isStudentRole(user.role)) return user;
    return {
        ...user,
        classes: Array.isArray(user.classIds) ? user.classIds : (user.classes || []),
    };
};

const dedupeStudentsByAuthUid = (students = []) => {
    const map = new Map();
    students.forEach((student) => {
        if (!student) return;
        const key = student.authUid || student.id;
        const existing = key ? map.get(key) : null;
        if (!existing) {
            map.set(key || student.id || `anon-${map.size}`, student);
            return;
        }

        const shouldReplaceExisting = existing.id === existing.authUid && student.id !== student.authUid;
        if (shouldReplaceExisting) {
            map.set(key, student);
        }
    });
    return Array.from(map.values());
};

export const loadStaffDataOnce = async ({
    db,
    isLoggedIn,
    userRole,
    pageKey = null,
    setStudents,
    setParents,
    setClasses,
    setTests,
    setLessonLogs,
    setAttendanceLogs,
    setClinicLogs,
    setWorkLogs,
    setAnnouncements,
    setHomeworkAssignments,
    setPaymentLogs,
    setGrades,
    setHomeworkResults,
    setExternalSchedules,
    setClosures,
    setLessonReports,
}) => {
    if (!isLoggedIn || !db) return;
    if (!userRole) return;
    if (!isStaffOrTeachingRole(userRole)) return;

    const shouldLoad = (key) => !pageKey || pageKey === key;
    const applyStudents = (items) => setStudents?.(dedupeStudentsByAuthUid(items));

    const fetchHomeworkResultsWithPagination = async (db, maxDocs = 5000, pageSize = 500) => {
        const all = [];
        let last = null;

        while (all.length < maxDocs) {
            const q = last
                ? query(
                    collection(db, 'homeworkResults'),
                    orderBy(documentId()),
                    startAfter(last),
                    limit(pageSize),
                )
                : query(
                    collection(db, 'homeworkResults'),
                    orderBy(documentId()),
                    limit(pageSize),
                );

            const snap = await getDocs(q);
            if (snap.empty) break;

            all.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            last = snap.docs[snap.docs.length - 1];

            if (snap.size < pageSize) break;
        }

        return all;
    };

    let staffClasses = [];
    let staffStudents = [];

    const fetchClosuresForStaff = async (classes = []) => {
        const merged = new Map();

        try {
            const globalSnap = await getDocs(
                query(
                    collection(db, 'closures'),
                    where('scope', '==', 'global'),
                    orderBy('startDate', 'desc'),
                    limit(500),
                ),
            );
            globalSnap.docs.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
        } catch (e) {
            console.warn('[staff] closures global load failed', e);
        }

        const classIds = Array.isArray(classes)
            ? classes.map((c) => String(c?.id)).filter(Boolean)
            : [];

        if (classIds.length > 0) {
            const chunks = chunkArray(classIds, 10);
            for (const ch of chunks) {
                try {
                    const snap = await getDocs(
                        query(
                            collection(db, 'closures'),
                            where('scope', '==', 'class'),
                            where('classId', 'in', ch),
                            orderBy('startDate', 'desc'),
                            limit(500),
                        ),
                    );
                    snap.docs.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
                } catch (e) {
                    try {
                        const snap2 = await getDocs(
                            query(
                                collection(db, 'closures'),
                                where('scope', '==', 'class'),
                                where('classId', 'in', ch),
                                limit(500),
                            ),
                        );
                        snap2.docs.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
                    } catch (e2) {
                        console.warn('[staff] closures class load failed', e2);
                    }
                }
            }
        }

        return Array.from(merged.values()).sort((a, b) =>
            String(b?.startDate || '').localeCompare(String(a?.startDate || '')),
        );
    };

    try {
        if (setStudents) {
            staffStudents = await fetchList(
                db,
                'users',
                applyStudents,
                query(collection(db, 'users'), where('role', '==', ROLE.STUDENT), limit(500)),
                () => false,
                normalizeStudentUser,
            );
        }

        if (setParents) {
            const parentRoles = [ROLE.PARENT, '학부모'];
            try {
                await fetchList(
                    db,
                    'users',
                    setParents,
                    query(collection(db, 'users'), where('role', 'in', parentRoles), limit(500)),
                    () => false,
                );
            } catch (error) {
                console.warn('[staff] parent role in query failed, fallback to client filter', error);
                const users = await fetchList(
                    db,
                    'users',
                    () => {},
                    query(collection(db, 'users'), limit(500)),
                    () => false,
                );
                const roleSet = new Set(parentRoles);
                setParents(users.filter((user) => roleSet.has(user?.role)));
            }
        }

        if (setClasses) {
            staffClasses = await fetchList(
                db,
                'classes',
                setClasses,
                query(collection(db, 'classes'), orderBy('name')),
                () => false,
            );
        }

        if (setTests && (shouldLoad('grades') || shouldLoad('lessons') || shouldLoad('lessonReports'))) {
            const tests = await fetchList(db, 'tests', setTests, query(collection(db, 'tests'), orderBy('date', 'desc'), limit(200)), () => false);
            warnOnQuestionScores(tests, 'staff');
        }

        if (setLessonLogs && (shouldLoad('lessons') || shouldLoad('lessonReports'))) {
            await fetchList(db, 'lessonLogs', setLessonLogs, query(collection(db, 'lessonLogs'), orderBy('date', 'desc'), limit(150)), () => false);
        }
        if (setLessonReports && (shouldLoad('lessons') || shouldLoad('students') || shouldLoad('lessonReports'))) {
            await fetchList(db, 'lessonReports', setLessonReports, query(collection(db, 'lessonReports'), orderBy('lessonDate', 'desc'), limit(300)), () => false);
        }


        if (setAttendanceLogs && (shouldLoad('attendance') || shouldLoad('lessons') || shouldLoad('students') || shouldLoad('lessonReports'))) {
            const attendanceLogs = await fetchAttendanceLogsWithPagination(db, () => false);
            setAttendanceLogs?.(attendanceLogs);
        }

        if (setClinicLogs && (shouldLoad('clinic') || shouldLoad('lessons'))) {
            const [lightLogs, lightReservations] = await Promise.all([
                fetchClinicLogsLight(db, () => false, 300),
                fetchClinicReservationsLight(db, () => false, 500),
            ]);
            const mergedClinicDocs = mergeClinicDocs(lightLogs, lightReservations);
            setClinicLogs?.(mergedClinicDocs);
            console.log('[staff] clinic logs loaded (merged)=', {
                clinicLogs: lightLogs.length,
                clinicReservations: lightReservations.length,
                merged: mergedClinicDocs.length,
            });
        }

        if (setWorkLogs && shouldLoad('communication')) {
            await fetchList(db, 'workLogs', setWorkLogs, query(collection(db, 'workLogs'), orderBy('date', 'desc'), limit(150)), () => false);
        }

        if (setAnnouncements && shouldLoad('communication')) {
            await fetchList(db, 'announcements', setAnnouncements, query(collection(db, 'announcements'), orderBy('date', 'desc'), limit(150)), () => false);
        }

        if (setHomeworkAssignments && (shouldLoad('homework') || shouldLoad('lessonReports'))) {
            await fetchList(db, 'homeworkAssignments', setHomeworkAssignments, query(collection(db, 'homeworkAssignments'), orderBy('date', 'desc'), limit(150)), () => false);
        }

        if (setPaymentLogs && shouldLoad('payment')) {
            await fetchList(
                db,
                'payments',
                setPaymentLogs,
                query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(150)),
                () => false,
                normalizePaymentLog,
            );
        }

        if (setGrades && (shouldLoad('grades') || shouldLoad('lessonReports'))) {
            const mappedGrades = {};
            const grades = await fetchGradesWithPagination(db, 5000, 500);

            grades.forEach((raw) => {
                const data = normalizeAuthUid(raw); // ✅ authUid/studentUid → studentId로 정규화

                const sId = data.studentId; // ✅ 이제 항상 studentId를 키로 사용
                const testId = data.testId;

                if (!sId || !testId) return; // 방어 로직

                if (!mappedGrades[sId]) mappedGrades[sId] = {};
                mappedGrades[sId][testId] = data;
            });

            setGrades(mappedGrades);
        }

        if (setHomeworkResults && (shouldLoad('homework') || shouldLoad('lessonReports'))) {
            const docs = await fetchHomeworkResultsWithPagination(db, 5000, 500);
            const mappedResults = {};
            const authUidToStudentDocId = new Map(
                (staffStudents || [])
                    .filter((student) => student?.authUid && student?.id)
                    .map((student) => [String(student.authUid), String(student.id)]),
            );
            docs.forEach((data) => {
                const assignmentId = data.assignmentId || data.homeworkAssignmentId || null;

                const rawKey = data.studentId
                    || data.studentDocId
                    || data.authUid
                    || data.studentUid
                    || null;
                
                const sKey = rawKey && authUidToStudentDocId.get(String(rawKey))
                ? authUidToStudentDocId.get(String(rawKey))
                : rawKey;

                if (!sKey || !assignmentId) return;

                if (!mappedResults[sKey]) mappedResults[sKey] = {};
                mappedResults[sKey][assignmentId] = data.results || data;
            });
            console.log('[staff][homeworkResults] loaded docs=', docs.length, 'keys=', Object.keys(mappedResults).length);
            setHomeworkResults(mappedResults);
        }

        if (setExternalSchedules && shouldLoad('schedule')) {
            await fetchList(
                db,
                'externalSchedules',
                setExternalSchedules,
                query(collection(db, 'externalSchedules'), orderBy('startDate', 'desc'), limit(500)),
                () => false,
            );
        }

        if (setClosures) {
            const closures = await fetchClosuresForStaff(staffClasses);
            setClosures(closures);
        }

    } catch (error) {
        console.error('[FirestoreSync] staff 데이터 로드 실패:', error);
    }
};

export const loadViewerDataOnce = async ({
    db,
    isLoggedIn,
    userRole,
    userId,
    studentIds = [],
    activeStudentId = null,
    setStudents,
    setClasses,
    setLessonLogs,
    setAttendanceLogs,
    setClinicLogs,
    setHomeworkAssignments,
    setAnnouncements,
    setTests,
    setVideoProgress,
    setVideoMemos,
    setExternalSchedules,
    setHomeworkResults,
    setGrades,
    setClosures,

    // ✅ 추가: classTestStats setter (없으면 그냥 스킵)
    setClassTestStats = null,
    setLessonReports,

    isCancelled = () => false,
}) => {
    // ✅ helper (요청한 그대로)
    const run = async (label, fn) => {
        try {
            const result = await fn();
            console.log('[viewer] ok:', label);
            return result;
        } catch (e) {
            console.error('[viewer] FAIL:', label, e);
            throw e;
        }
    };


    const isViewerRole = isViewerGroupRole(userRole) || isStudentRole(userRole);
    if (!isLoggedIn || !db || !isViewerRole) {
        console.log('[viewer] skip: not viewer role or not logged in');
        return;
    }

    const viewerStudentDocIds = uniq(
        (activeStudentId ? [activeStudentId] : []).concat(Array.isArray(studentIds) ? studentIds : []),
    ).slice(0, 10);
    const activeOnly = safeNonEmptyArray(activeStudentId ? [activeStudentId] : []);

    async function fetchClinicReservationsForViewer({ db, studentDocIds = [], studentAuthUids = [], isCancelled = () => false }) {
        const results = [];
        const seen = new Set();

        const push = (snap) => {
            snap?.docs?.forEach((d) => {
                if (!d?.id) return;
                if (seen.has(d.id)) return;
                seen.add(d.id);
                const raw = { id: d.id, ...d.data() };

                // 예약 문서는 studentDocId만 있는 경우가 있으므로
                // viewer 기준으로 studentId를 studentDocId로 통일
                const normalized = normalizeClinicReservation(raw);

                const fixed = normalized?.studentDocId
                    ? { ...normalized, studentId: String(normalized.studentDocId) }
                    : normalized;

                results.push(fixed);
            });
        };

        if (Array.isArray(studentDocIds) && studentDocIds.length > 0) {
            try {
                const snap = await getDocs(
                    query(
                        collection(db, 'clinicReservations'),
                        where('studentDocId', 'in', studentDocIds.slice(0, 10)),
                        limit(500),
                    ),
                );
                push(snap);
                console.log('[viewer] ok: clinicReservations studentDocId in', snap.size);
            } catch (e) {
                console.warn('[viewer] clinicReservations studentDocId in skipped', e);
            }

            try {
                const snap = await getDocs(
                    query(
                        collection(db, 'clinicReservations'),
                        where('studentId', 'in', studentDocIds.slice(0, 10)),
                        limit(500),
                    ),
                );
                push(snap);
                console.log('[viewer] ok: clinicReservations studentId in', snap.size);
            } catch (e) {
                console.warn('[viewer] clinicReservations studentId in skipped', e);
            }
        }

        if (Array.isArray(studentAuthUids) && studentAuthUids.length > 0) {
            try {
                const snap = await getDocs(
                    query(
                        collection(db, 'clinicReservations'),
                        where('authUid', 'in', studentAuthUids.slice(0, 10)),
                        limit(500),
                    ),
                );
                push(snap);
                console.log('[viewer] ok: clinicReservations authUid in', snap.size);
            } catch (e) {
                console.warn('[viewer] clinicReservations authUid in skipped', e);
            }
        }

        return results;
    }

    console.log('[viewer] viewerStudentDocIds =', viewerStudentDocIds);

    if (!nonEmpty(viewerStudentDocIds)) {
        console.log('[viewer] skip: no student ids');
        return;
    }

    try {
        /* =========================
           users (getDoc 방식)
        ========================= */
        const studentSnaps = await run('users getDoc batch', async () => {
            return Promise.all(
                viewerStudentDocIds.map((sid) =>
                    run(`users getDoc ${sid}`, () => getDoc(doc(db, 'users', sid))),
                ),
            );
        });

        const myStudents = studentSnaps
            .filter((s) => s.exists())
            .map((s) => ({ id: s.id, ...s.data() }))
            .map(normalizeStudentUser);

        if (!isCancelled()) {
            setStudents?.(myStudents);
        }

        console.log('[viewer] myStudents ids =', myStudents.map((s) => s.id));

        const scopedStudentUids = safeNonEmptyArray(Array.from(new Set([
            ...viewerStudentDocIds,
            ...myStudents.map((s) => s.id).filter(Boolean),
        ])).slice(0, 10));

        console.log('[viewer] scopedStudentUids =', scopedStudentUids);

        const scopedStudentAuthUids = safeNonEmptyArray(Array.from(new Set([
            ...(userRole === 'student' ? [userId] : []),
            ...myStudents.map((s) => s.authUid).filter(Boolean),
        ].filter(Boolean))).slice(0, 10));

        console.log('[viewer] scopedStudentAuthUids =', scopedStudentAuthUids);

        /* =========================
           classes (student.classIds 우선, classes.students는 fallback)
        ========================= */
        const myClassesMap = new Map();

        // 1) student 문서의 classIds / classes를 최우선으로 사용
        const classIdsFromStudents = Array.from(new Set(
            myStudents
                .flatMap((s) => Array.isArray(s?.classIds)
                    ? s.classIds
                    : (Array.isArray(s?.classes) ? s.classes : []))
                .filter(Boolean)
                .map(String),
        ));

        console.log('[viewer] classIdsFromStudents =', classIdsFromStudents);

        // 2) classIds로 직접 classes 문서를 읽는다 (이 경로가 메인)
        if (classIdsFromStudents.length > 0) {
            const chunks = chunkArray(classIdsFromStudents, 10);

            for (const ch of chunks) {
                try {
                    const snap = await run(`classes by classIds chunk(${ch.length})`, () =>
                        getDocs(
                            query(
                                collection(db, 'classes'),
                                where(documentId(), 'in', ch),
                            ),
                        ));

                    snap.docs.forEach((docSnap) => {
                        myClassesMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
                    });
                } catch (e) {
                    console.warn('[viewer] classes by classIds load skipped', e);
                }
            }
        }

        // 3) fallback: classes.students array-contains 조회
        // - 예전 데이터 호환용
        // - 실패해도 전체 로딩을 죽이지 않는다
        if (myClassesMap.size === 0 && scopedStudentUids.length > 0) {
            for (const sId of scopedStudentUids) {
                try {
                    const snap = await run(`classes fallback for student ${sId}`, () =>
                        getDocs(
                            query(
                                collection(db, 'classes'),
                                where('students', 'array-contains', sId),
                            ),
                        ));

                    snap.docs.forEach((docSnap) => {
                        myClassesMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
                    });
                } catch (e) {
                    console.warn(`[viewer] classes fallback skipped for ${sId}`, e);
                }
            }
        }

        const allMyClasses = Array.from(myClassesMap.values());
        if (!allMyClasses.length) {
            console.warn('[viewer] no classes resolved from student.classIds or fallback students array');
        }

        const activeStudentForVisibility = myStudents.find((s) => String(s?.id || '') === String(activeOnly[0] || scopedStudentUids[0] || ''))
            || myStudents[0]
            || null;
        const visibleClassIds = getViewerVisibleClassIds(allMyClasses, activeStudentForVisibility);
        const visibleClassIdSet = new Set(visibleClassIds);
        const myClasses = allMyClasses.filter((cls) => visibleClassIdSet.has(String(cls?.id || cls?.classId || '')));
        const hiddenClassIds = allMyClasses
            .map((cls) => String(cls?.id || cls?.classId || ''))
            .filter((classId) => classId && !visibleClassIdSet.has(classId));

        if (isDevelopment()) {
            const hiddenReasons = {};
            allMyClasses.forEach((cls) => {
                const classId = String(cls?.id || cls?.classId || '');
                const reason = getViewerClassVisibilityReason(cls, activeStudentForVisibility);
                if (classId && reason !== 'visible') hiddenReasons[classId] = reason;
            });
            console.log('[viewer][visibility] myClasses count =', allMyClasses.length);
            console.log('[viewer][visibility] visibleClassIds =', visibleClassIds);
            console.log('[viewer][visibility] hiddenClassIds =', hiddenClassIds);
            console.log('[viewer][visibility] hiddenReasons =', hiddenReasons);
        }

        if (!isCancelled()) {
            setClasses?.(myClasses);
        }

        console.log('[viewer] myClasses ids =', myClasses.map((c) => c.id));

        const viewerClassIds = visibleClassIds;
        console.log('[viewer] viewerClassIds =', viewerClassIds);

        const lessonClassIds = visibleClassIds;
        const detailCacheKey = viewerDetailCacheKey(lessonClassIds, activeOnly[0] || scopedStudentUids[0] || '');
        const hasDetailCache = viewerDetailCache.lessonLogs.has(detailCacheKey)
            && viewerDetailCache.attendance.has(detailCacheKey)
            && viewerDetailCache.homeworkResults.has(detailCacheKey)
            && viewerDetailCache.grades.has(detailCacheKey);

        if (hasDetailCache && !isCancelled()) {
            setLessonLogs?.(viewerDetailCache.lessonLogs.get(detailCacheKey) || []);
            setAttendanceLogs?.(viewerDetailCache.attendance.get(detailCacheKey) || []);
            setHomeworkResults?.(viewerDetailCache.homeworkResults.get(detailCacheKey) || {});
            setGrades?.(viewerDetailCache.grades.get(detailCacheKey) || {});
            console.log('[viewer] detail cache hit', detailCacheKey);
        }

        /* =========================
           attendanceLogs (fetchList)
        ========================= */
        if (!hasDetailCache && nonEmpty(lessonClassIds) && (nonEmpty(scopedStudentUids) || nonEmpty(scopedStudentAuthUids))) {
            try {
                const studentKeySet = new Set([...scopedStudentUids, ...scopedStudentAuthUids].map(String));
                const attendanceDocs = await fetchClassScopedDocs({
                    db,
                    collectionName: 'attendanceLogs',
                    classIds: lessonClassIds,
                    run,
                    isCancelled,
                    buildQuery: (classChunk) => query(
                        collection(db, 'attendanceLogs'),
                        where('classId', 'in', classChunk),
                        orderBy('date', 'desc'),
                        limit(300),
                    ),
                    mapDoc: (d) => ({ id: d.id, ...d.data() }),
                });

                if (!isCancelled()) {
                    const authUidToStudentDocId = new Map(
                        myStudents.map((s) => [s?.authUid, s?.id]).filter(([authUid, id]) => authUid && id),
                    );
                    const map = new Map();
                    attendanceDocs.forEach((log) => {
                        const rawStudentKeys = [log?.studentId, log?.studentUid, log?.authUid].filter(Boolean).map(String);
                        if (!rawStudentKeys.some((key) => studentKeySet.has(key))) return;
                        if (!log?.id) return;
                        if (!map.has(log.id)) map.set(log.id, log);
                    });

                    const normalizedLogs = Array.from(map.values()).map((log) => {
                        const normalized = { ...log };
                        if (!normalized.studentId && normalized.studentUid) {
                            normalized.studentId = normalized.studentUid;
                        }
                        if (!normalized.studentId && normalized.authUid) {
                            const mappedId = authUidToStudentDocId.get(normalized.authUid);
                            if (mappedId) {
                                normalized.studentId = mappedId;
                            }
                        }
                        return normalized;
                    }).sort((a, b) => {
                        const ad = String(a?.date || '');
                        const bd = String(b?.date || '');
                        return bd.localeCompare(ad);
                    });

                    setAttendanceLogs?.(normalizedLogs);
                    viewerDetailCache.attendance.set(detailCacheKey, normalizedLogs);
                }
            } catch (e) {
                console.warn('[viewer] attendanceLogs visible class scoped load skipped', e);
                if (!isCancelled()) setAttendanceLogs?.([]);
            }
        } else if (!isCancelled() && !hasDetailCache) {
            setAttendanceLogs?.([]);
        }

        /* =========================
        clinicLogs / grades / homeworkAssignments (viewer 병렬 로딩)
        ========================= */
        const settled = await Promise.allSettled([
            fetchClinicForViewer({
                db,
                studentIds: scopedStudentUids,
                studentAuthUids: scopedStudentAuthUids,
                isCancelled,
            }),
            loadGradesForViewer(db, scopedStudentUids, isCancelled, lessonClassIds),
            loadHomeworkAssignmentsForViewer(db, scopedStudentUids, isCancelled, lessonClassIds),
        ]);

        const clinicList = settled[0].status === 'fulfilled' ? settled[0].value : [];
        if (settled[0].status === 'rejected') console.warn('[viewer] clinicForViewer failed (continue)', settled[0].reason);

        const gradeList = settled[1].status === 'fulfilled' ? settled[1].value : [];
        if (settled[1].status === 'rejected') console.warn('[viewer] gradesForViewer failed (continue)', settled[1].reason);

        const hwAssignList = settled[2].status === 'fulfilled' ? settled[2].value : [];
        if (settled[2].status === 'rejected') console.warn('[viewer] homeworkAssignmentsForViewer failed (continue)', settled[2].reason);

        let clinicReservationsList = [];
        try {
            clinicReservationsList = await fetchClinicReservationsForViewer({
                db,
                studentDocIds: scopedStudentUids,
                studentAuthUids: scopedStudentAuthUids,
                isCancelled,
            });
        } catch (e) {
            console.warn('[viewer] clinicReservations fetch failed (continue)', e);
        }

        if (!isCancelled()) {
            const mergedClinic = uniqById([
                ...safeArray(clinicList).map((log) => normalizeClinicLog(log)),
                ...safeArray(clinicReservationsList).map((log) => normalizeClinicLog(log)),
            ]);
            setClinicLogs?.(
                mergedClinic.filter(
                    (log) => Boolean(log?.studentId || log?.studentDocId),
                ),
            );
            const mappedGrades = buildGradesMap(gradeList);
            setGrades?.(mappedGrades);
            viewerDetailCache.grades.set(detailCacheKey, mappedGrades);
            const sortedHomework = filterItemsByVisibleClassIds(hwAssignList, lessonClassIds, 'homeworkAssignments').sort((a, b) => {
                const da = a.date || a.assignedDate || a.createdAt?.toDate?.() || a.createdAt;
                const dbb = b.date || b.assignedDate || b.createdAt?.toDate?.() || b.createdAt;
                return new Date(dbb || 0) - new Date(da || 0);
            });
            setHomeworkAssignments?.(sortedHomework);
        }

        try {
            if (setLessonReports) {
                const activeStudentId = scopedStudentUids[0] || null;
                if (!activeStudentId) {
                    console.warn('[viewer] skip lessonReports: activeStudentId missing');
                    if (!isCancelled()) setLessonReports([]);
                } else {
                    const visibleClassIdSet = new Set((lessonClassIds || []).map(String));
                    const reportsQuery = query(
                        collection(db, 'lessonReports'),
                        where('studentId', '==', activeStudentId),
                        where('status', '==', 'sent'),
                    );
                    const snap = await run('lessonReports by student', () => getDocs(reportsQuery));
                    const visibleReports = snap.docs
                        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
                        .filter((report) => {
                            const classId = String(report?.classId || '');
                            if (!classId) return true;
                            return visibleClassIdSet.has(classId);
                        })
                        .sort((a, b) => String(b?.lessonDate || '').localeCompare(String(a?.lessonDate || '')));
                    if (!isCancelled()) setLessonReports(visibleReports);
                }
            }
        } catch (error) {
            const activeStudentId = scopedStudentUids[0] || null;
            console.error('[viewer] lessonReports by student FAIL', {
                code: error?.code,
                message: error?.message,
                query: {
                    collection: 'lessonReports',
                    where: [
                        ['studentId', '==', activeStudentId],
                        ['status', '==', 'sent'],
                    ],
                },
                activeStudentId,
                visibleClassIds: lessonClassIds,
                error,
            });
            if (!isCancelled()) setLessonReports?.([]);
        }
        

        /* =========================
        lessonLogs / tests
        ========================= */
        let viewerTests = [];
        let filteredTests = [];

        /* =========================
           closures (viewer: student/parent) ✅ 새로고침 유지 핵심
        ========================= */
        if (setClosures) {
            try {
                const closureDocs = [];
                const seen = new Set();

                const push = (docs) => {
                    docs.forEach((d) => {
                        if (!d?.id) return;
                        if (seen.has(d.id)) return;
                        seen.add(d.id);
                        closureDocs.push({ id: d.id, ...d.data() });
                    });
                };

                // 1) global closures
                try {
                    const snapGlobal = await run('closures global', () =>
                        getDocs(
                            query(
                                collection(db, 'closures'),
                                where('scope', '==', 'global'),
                                orderBy('startDate', 'desc'),
                                limit(200),
                            ),
                        ),
                    );
                    push(snapGlobal.docs);
                } catch (e) {
                    console.warn('[viewer] closures global skipped', e);
                }

                // 2) class closures (classId in)
                const classIds = Array.isArray(myClasses)
                    ? myClasses.map((c) => String(c?.id)).filter(Boolean)
                    : [];

                if (classIds.length > 0) {
                    const chunks = chunkArray(classIds, 10);
                    for (const ch of chunks) {
                        try {
                            const snapClass = await run(`closures class chunk(${ch.length})`, () =>
                                getDocs(
                                    query(
                                        collection(db, 'closures'),
                                        where('scope', '==', 'class'),
                                        where('classId', 'in', ch),
                                        orderBy('startDate', 'desc'),
                                        limit(200),
                                    ),
                                ),
                            );
                            push(snapClass.docs);
                        } catch (e) {
                            console.warn('[viewer] closures class retry without orderBy', e);
                            try {
                                const snapClass2 = await getDocs(
                                    query(
                                        collection(db, 'closures'),
                                        where('scope', '==', 'class'),
                                        where('classId', 'in', ch),
                                        limit(200),
                                    ),
                                );
                                push(snapClass2.docs);
                            } catch (e2) {
                                console.warn('[viewer] closures class skipped', e2);
                            }
                        }
                    }
                }

                if (!isCancelled()) {
                    const sorted = closureDocs.sort((a, b) => {
                        const da = String(a?.startDate || '');
                        const dbb = String(b?.startDate || '');
                        return dbb.localeCompare(da);
                    });
                    setClosures(sorted);
                    console.log('[viewer] closures loaded =', sorted.length);
                }
            } catch (e) {
                console.error('[viewer] FAIL: closures', e);
                if (!isCancelled()) setClosures([]);
            }
        }

        if (!hasDetailCache && lessonClassIds.length > 0) {
            try {
                const viewerLessonLogs = await fetchClassScopedDocs({
                    db,
                    collectionName: 'lessonLogs',
                    classIds: lessonClassIds,
                    run,
                    isCancelled,
                    buildQuery: (classChunk) => query(
                        collection(db, 'lessonLogs'),
                        where('classId', 'in', classChunk),
                        orderBy('date', 'desc'),
                        limit(100),
                    ),
                });
                const sortedLessonLogs = viewerLessonLogs.sort((a, b) => String(b?.date || '').localeCompare(String(a?.date || '')));
                setLessonLogs?.(sortedLessonLogs);
                viewerDetailCache.lessonLogs.set(detailCacheKey, sortedLessonLogs);

                // ✅ tests 로딩 + 로컬 변수에 저장
                viewerTests = await fetchClassScopedDocs({
                    db,
                    collectionName: 'tests',
                    classIds: lessonClassIds,
                    run,
                    isCancelled,
                    buildQuery: (classChunk) => query(
                        collection(db, 'tests'),
                        where('classId', 'in', classChunk),
                        orderBy('date', 'desc'),
                        limit(100),
                    ),
                    mapDoc: (d) => ({ id: d.id, ...d.data() }),
                });
                filteredTests = viewerTests.sort((a, b) => String(b?.date || '').localeCompare(String(a?.date || '')));
                setTests?.(filteredTests);
                warnOnQuestionScores(filteredTests, 'viewer');
            } catch (e) {
                console.warn('[viewer] lessonLogs/tests load failed', e);
                if (!isCancelled()) {
                    setLessonLogs?.([]);
                    setTests?.([]);
                }
            }

             /* =========================
               classTestStats (viewer: student/parent)
               - stats are optional
               - must NOT break viewer load
            ========================= */
            if (setClassTestStats && Array.isArray(viewerTests)) {
                try {
                    const statsMap = {};

                    for (const t of viewerTests) {
                        if (!t?.id || !t?.classId) continue;

                        const statsId = `${t.classId}_${t.id}`;
                        const snap = await getDoc(doc(db, 'classTestStats', statsId));

                        if (snap.exists()) {
                            statsMap[t.id] = snap.data();
                        }
                    }

                    if (!isCancelled()) setClassTestStats(statsMap);
                } catch (e) {
                    console.error('[viewer] FAIL: classTestStats (skip)', e);
                    if (!isCancelled()) setClassTestStats({});
                }
            }
        } else if (!isCancelled() && !hasDetailCache) {
            setLessonLogs?.([]);
            setTests?.([]);
            setClassTestStats?.({});
        }

        /* =========================
        grades (viewer): 병렬 로딩 결과 사용
        ========================= */
        
        /* =========================
           homeworkResults (직접 getDocs)
        ========================= */
        try {
            if (!hasDetailCache && scopedStudentUids.length > 0) {
                const mapped = {};
                const authUidToStudentDocId = new Map(
                    myStudents
                        .filter((student) => student?.authUid && student?.id)
                        .map((student) => [String(student.authUid), String(student.id)]),
                );

            const upsert = (data) => {
                    const assignmentId = data.assignmentId || data.homeworkAssignmentId || null;
                    const rawKey = data.studentId || data.studentDocId || data.authUid || data.studentUid || null;
                    const sKey = rawKey && authUidToStudentDocId.get(String(rawKey))
                        ? authUidToStudentDocId.get(String(rawKey))
                        : rawKey;
                    if (!sKey || !assignmentId) return;
                    if (!mapped[sKey]) mapped[sKey] = {};
                    mapped[sKey][assignmentId] = data.results || data;
                };

                const loadHomeworkResultsForField = async (field, values) => {
                    for (const value of safeNonEmptyArray(values)) {
                        const docs = await fetchClassScopedDocs({
                            db,
                            collectionName: 'homeworkResults',
                            classIds: lessonClassIds,
                            run,
                            isCancelled,
                            runLabel: `homeworkResults ${field}=${value}`,
                            buildQuery: (classChunk) => query(
                                collection(db, 'homeworkResults'),
                                where(field, '==', value),
                                where('classId', 'in', classChunk),
                                limit(200),
                            ),
                            mapDoc: (d) => ({ id: d.id, ...d.data() }),
                        });
                        docs.forEach((docData) => upsert(docData || {}));
                    }
                };

                if (Array.isArray(scopedStudentAuthUids) && scopedStudentAuthUids.length > 0) {
                    await loadHomeworkResultsForField('authUid', scopedStudentAuthUids);
                }

                if (Array.isArray(scopedStudentUids) && scopedStudentUids.length > 0) {
                    await loadHomeworkResultsForField('studentId', scopedStudentUids);
                }

            if (!isCancelled()) {
                console.log('[viewer][homeworkResults] keys=', Object.keys(mapped));
                setHomeworkResults?.(mapped);
                viewerDetailCache.homeworkResults.set(detailCacheKey, mapped);
            }
            } else if (!isCancelled() && !hasDetailCache) {
                setHomeworkResults?.({});
                viewerDetailCache.homeworkResults.set(detailCacheKey, {});
            }
        } catch (e) {
            console.warn('[viewer] homeworkResults load failed', e);
            if (!isCancelled()) setHomeworkResults?.({});
                viewerDetailCache.homeworkResults.set(detailCacheKey, {});
        }

        /* =========================
        viewer 식별자 (공지 조회용)
        ========================= */
        const activeStudentDocId = scopedStudentUids[0] || null;

        // ✅ 실제 데이터 키로 쓸 authUid(7MR...) (videoProgress/externalSchedules 조회용)
        const activeViewerAuthUid = userId ? String(userId) : null;

        console.log('[viewer] activeStudentDocId =', activeStudentDocId);
        console.log('[viewer] current auth.uid =', activeViewerAuthUid);

        /* =========================
           announcements  (✅ public + audienceAuthUids 통합)
        ========================= */
        console.log('[viewer] fetch announcements start');

        const [publicSnap, targetedSnap] = await Promise.all([
            getDocs(query(
                collection(db, 'announcements'),
                where('isPublic', '==', true),
                limit(50),
            )),
            activeViewerAuthUid
                ? getDocs(query(
                    collection(db, 'announcements'),
                    where('audienceAuthUids', 'array-contains', String(activeViewerAuthUid)),
                    limit(50),
                ))
                : Promise.resolve({ docs: [] }),
        ]);

        if (!isCancelled()) {
            const mergedMap = new Map();
            [...publicSnap.docs, ...targetedSnap.docs].forEach((docSnap) => {
                mergedMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
            });

            const merged = Array.from(mergedMap.values())
                .sort((a, b) => {
                    const pinGap = Number(Boolean(b?.isPinned)) - Number(Boolean(a?.isPinned));
                    if (pinGap !== 0) return pinGap;
                    const da = a.createdAt?.toDate?.()?.getTime?.() || new Date(a.createdAt || a.date || 0).getTime() || 0;
                    const dbb = b.createdAt?.toDate?.()?.getTime?.() || new Date(b.createdAt || b.date || 0).getTime() || 0;
                    return dbb - da;
                });

            setAnnouncements?.(merged);
            const publicCount = publicSnap.docs.length;
            const targetedCount = targetedSnap.docs.length;
            console.log('[viewer] public announcements count =', publicCount);
            console.log('[viewer] targeted announcements count =', targetedCount);
            console.log('[viewer] loaded announcement sample =', merged.slice(0, 5).map((n) => ({
                id: n.id,
                title: n.title,
                isPublic: n.isPublic,
                targetClassIds: n.targetClassIds || n.targetClasses || [],
                audienceAuthUids: n.audienceAuthUids || [],
            })));
        }

        console.log('[viewer] fetch announcements done');

        /* =========================
           homeworkAssignments: 병렬 로딩 결과 사용
        ========================= */
        
        /* =========================
        videoProgress / externalSchedules  (✅ authUid 기준으로 조회)
        ========================= */

        const viewerAuthUids = Array.from(new Set([
            ...(userRole === 'student' && userId ? [userId] : []),
            ...myStudents.map((s) => s?.authUid).filter(Boolean),
            activeViewerAuthUid,
        ].filter(Boolean))).slice(0, 10);

        if (setVideoMemos) {
            try {
                if (viewerAuthUids.length > 0) {
                    const memoMap = {};
                    await Promise.all(
                        viewerAuthUids.map(async (uid) => {
                            const snap = await run(`videoMemos ${uid}`, () =>
                                getDocs(
                                    query(
                                        collection(db, 'videoMemos', uid, 'items'),
                                        orderBy('updatedAt', 'desc'),
                                    ),
                                ),
                            );
                            memoMap[uid] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                        }),
                    );

                    if (!isCancelled()) {
                        setVideoMemos(memoMap);
                    }
                } else if (!isCancelled()) {
                    setVideoMemos({});
                }
            } catch (e) {
                console.error('[viewer] FAIL videoMemos', e);
            }
        }

        // ✅ 여기부터는 authUid가 있어야 조회 가능
        if (activeViewerAuthUid) {
            try {
                const progressDocs = await fetchClassScopedDocs({
                    db,
                    collectionName: 'videoProgress',
                    classIds: lessonClassIds,
                    run,
                    isCancelled,
                    buildQuery: (classChunk) => query(
                        collection(db, 'videoProgress'),
                        where('studentId', '==', activeViewerAuthUid),
                        where('classId', 'in', classChunk),
                        limit(100),
                    ),
                });
                if (!isCancelled()) setVideoProgress?.(progressDocs);
            } catch (e) {
                console.warn('[viewer] videoProgress visible class scoped load skipped', e);
                if (!isCancelled()) setVideoProgress?.([]);
            }

            console.log('[viewer] fetch externalSchedules start', { activeViewerAuthUid });

            try {
                if (activeViewerAuthUid) {
                    const items = await fetchList(
                        db,
                        'externalSchedules',
                        setExternalSchedules,
                        query(
                            collection(db, 'externalSchedules'),
                            where('authUid', '==', activeViewerAuthUid),
                            limit(50),
                        ),
                        isCancelled,
                    );

                    console.log('[viewer] fetch externalSchedules ok', {
                        count: Array.isArray(items) ? items.length : null,
                        first: Array.isArray(items) ? items[0] : null,
                    });
                } else {
                    console.log('[viewer] skip externalSchedules: no activeViewerAuthUid');
                }
            } catch (e) {
                console.error('[viewer] FAIL externalSchedules', e);
            }

        } else if (!isCancelled()) {
            setVideoProgress?.([]);
            setExternalSchedules?.([]);
        }

        if (setClosures) {
            try {
                const snap = await getDocs(
                    query(collection(db, 'closures'), orderBy('startDate', 'desc'), limit(200)),
                );
                if (!isCancelled()) {
                    setClosures(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
                }
            } catch (e) {
                console.warn('[viewer] closures load skipped', e);
                if (!isCancelled()) setClosures([]);
            }
        }

        console.log('[viewer] COMPLETE');

    } catch (error) {
        console.error('[viewer] loadViewerDataOnce FAILED (top-level)', error);
        if (String(error?.code || '').includes('permission-denied')
            || String(error?.message || '').includes('Missing or insufficient permissions')) {
            return;
        }
        throw error;
    }
};