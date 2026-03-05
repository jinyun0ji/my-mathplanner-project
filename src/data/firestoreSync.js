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


export const safeIn = (arr, max = 10) => safeNonEmptyArray(arr).slice(0, max);

export function buildInQueryOrNull(values, max = 10) {
    const v = safeIn(values, max);
    return v.length > 0 ? v : null;
}

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
    return {
        ...log,
        effectiveDate: resolveClinicEffectiveDate(log),
        __source: log.__source || 'clinicLogs',
    };
};

const normalizeClinicReservation = (log) => {
    if (!log) return log;
    const base = normalizeAuthUid(log);
    const timeSlot = base.timeSlot || base.plannedTime || '';
    return normalizeClinicLog({
        ...base,
        plannedTime: base.plannedTime || timeSlot,
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

const fetchClinicLogsForViewer = async ({
    db,
    studentDocId,
    authUid,
    pageSize = 200,
    maxDocs = 2000,
    isCancelled = () => false,
}) => {
    const col = collection(db, 'clinicLogs');

    const runByField = async (field, value) => {
        const output = [];
        let lastDoc = null;
        let guard = 0;

        while (guard < 50 && output.length < maxDocs) {
            if (isCancelled()) break;

            const constraints = [
                where(field, '==', String(value)),
                orderBy('date', 'desc'),
                orderBy('name', 'desc'),
                limit(pageSize),
            ];
            if (lastDoc) constraints.push(startAfter(lastDoc));

            const snap = await getDocs(query(col, ...constraints));
            if (snap.empty) break;

            snap.docs.forEach((d) => {
                output.push(normalizeAuthUid({ id: d.id, ...d.data() }));
            });

            lastDoc = snap.docs[snap.docs.length - 1];
            if (snap.docs.length < pageSize) break;
            guard += 1;
        }

        return output;
    };

    const merged = new Map();
    const errors = [];

    const execute = async (queryType, field, value) => {
        if (!value) return;
        try {
            const docs = await runByField(field, value);
            docs.forEach((item) => {
                if (item?.id) merged.set(item.id, item);
            });
        } catch (error) {
            console.warn('[viewer] clinicLogs query failed', {
                queryType,
                field,
                studentDocId: studentDocId || null,
                authUid: authUid || null,
                code: error?.code || '',
                message: error?.message || '',
            });
            errors.push(error);
        }
    };

    await execute('studentId', 'studentId', studentDocId);
    await execute('authUid', 'authUid', authUid);
    await execute('studentUid', 'studentUid', studentDocId);

    if (merged.size === 0 && errors.length > 0) {
        throw errors[0];
    }

    return Array.from(merged.values()).map(normalizeClinicLog);
};


const fetchClinicForViewer = async ({
    db,
    studentIds,
    studentAuthUids,
    studentDocId,
    authUid,
    isCancelled = () => false,
}) => {
    const results = [];

    try {
        const logs = await fetchClinicLogsForViewer({
            db,
            studentDocId,
            authUid,
            pageSize: 200,
            maxDocs: 2000,
            isCancelled,
        });
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

        if (setTests && (shouldLoad('grades') || shouldLoad('lessons'))) {
            const tests = await fetchList(db, 'tests', setTests, query(collection(db, 'tests'), orderBy('date', 'desc'), limit(200)), () => false);
            warnOnQuestionScores(tests, 'staff');
        }

        if (setLessonLogs && shouldLoad('lessons')) {
            await fetchList(db, 'lessonLogs', setLessonLogs, query(collection(db, 'lessonLogs'), orderBy('date', 'desc'), limit(150)), () => false);
        }

        if (setAttendanceLogs && (shouldLoad('attendance') || shouldLoad('lessons') || shouldLoad('students'))) {
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

        if (setHomeworkAssignments && shouldLoad('homework')) {
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

        if (setGrades && shouldLoad('grades')) {
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

        if (setHomeworkResults && shouldLoad('homework')) {
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

    // fetchList는 내부에서 getDocs를 실행하므로, 호출 단위를 라벨링하는 래퍼 추가
    const fetchListSafe = async (label, ...args) => {
        return run(label, async () => fetchList(...args));
    };

    const isViewerRole = isViewerGroupRole(userRole) || isStudentRole(userRole);
    if (!isLoggedIn || !db || !isViewerRole) {
        console.log('[viewer] skip: not viewer role or not logged in');
        return;
    }

    const linkedStudentIds = safeNonEmptyArray(studentIds);

    // ✅ 학생은 authUid(userId) 섞지 않고 studentDocId만 사용
    const viewerStudentUids = safeNonEmptyArray(userRole === 'student'
        ? linkedStudentIds
        : activeStudentId
            ? [activeStudentId]
            : linkedStudentIds
    ).slice(0, 10);
    const activeOnly = safeNonEmptyArray(activeStudentId ? [activeStudentId] : []);

    console.log('[viewer] viewerStudentUids =', viewerStudentUids);

    if (viewerStudentUids.length === 0) {
        console.log('[viewer] skip: no student ids');
        return;
    }

    try {
        /* =========================
           users (getDoc 방식)
        ========================= */
        const studentSnaps = await run('users getDoc batch', async () => {
            return Promise.all(
                viewerStudentUids.map((sid) =>
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
            ...viewerStudentUids,
            ...myStudents.map((s) => s.id).filter(Boolean),
        ])).slice(0, 10));

        console.log('[viewer] scopedStudentUids =', scopedStudentUids);

        const scopedStudentAuthUids = safeNonEmptyArray(Array.from(new Set([
            ...(userRole === 'student' ? [userId] : []),
            ...myStudents.map((s) => s.authUid).filter(Boolean),
        ].filter(Boolean))).slice(0, 10));

        console.log('[viewer] scopedStudentAuthUids =', scopedStudentAuthUids);
        const nonEmpty = (arr) => Array.isArray(arr) && arr.length > 0;

        /* =========================
           classes (학생 id별 array-contains)
        ========================= */
        const myClassesMap = new Map();

        const classSnaps = await run('classes getDocs (per-student)', async () => {
            return Promise.all(
                scopedStudentUids.map(async (sId) => {
                    return run(`classes for student ${sId}`, async () => {
                        const q = query(
                            collection(db, 'classes'),
                            where('students', 'array-contains', sId),
                        );
                        return getDocs(q);
                    });
                }),
            );
        });

        classSnaps.forEach((snap) => {
            snap.docs.forEach((docSnap) => {
                myClassesMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
            });
        });

        // ✅ (추가) student 문서의 classIds 기반으로 클래스도 합쳐서 로드한다
        // - 퇴원 처리 과정에서 classes.students에서 학생을 빼버린 경우에도 과거 반을 유지하기 위함
        const classIdsFromStudents = Array.from(new Set(
            myStudents
                .flatMap((s) => Array.isArray(s?.classIds) ? s.classIds : (Array.isArray(s?.classes) ? s.classes : []))
                .filter(Boolean)
                .map(String),
        ));

        if (classIdsFromStudents.length > 0) {
            const chunks = chunkArray(classIdsFromStudents, 10);

            for (const ch of chunks) {
                try {
                    const snap = await getDocs(
                        query(
                            collection(db, 'classes'),
                            where(documentId(), 'in', ch),
                        ),
                    );
                    snap.docs.forEach((docSnap) => {
                        myClassesMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
                    });
                } catch (e) {
                    console.warn('[viewer] classes by classIds load skipped', e);
                }
            }
        }

        const myClasses = Array.from(myClassesMap.values());
        if (!isCancelled()) {
            setClasses?.(myClasses);
        }

        console.log('[viewer] myClasses ids =', myClasses.map((c) => c.id));

        const viewerClassIds = myClasses.map((c) => String(c.id)).filter(Boolean).slice(0, 10);
        console.log('[viewer] viewerClassIds =', viewerClassIds);

        const lessonClassIds = safeIn(myClasses.map((c) => c.id), 10);
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
        if (!hasDetailCache && (nonEmpty(scopedStudentUids) || nonEmpty(scopedStudentAuthUids))) {
            const attendanceDocs = [];

            if (nonEmpty(scopedStudentUids)) {
                try {
                    const snap = await run('attendanceLogs studentId', () =>
                        getDocs(
                            query(
                                collection(db, 'attendanceLogs'),
                                where('studentId', 'in', scopedStudentUids),
                                orderBy('date', 'desc'),
                                limit(300),
                            ),
                        ),
                    );
                    attendanceDocs.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
                } catch (e) {
                    console.warn('[viewer] attendanceLogs studentId load skipped', e);
                }
            }

            if (nonEmpty(scopedStudentUids)) {
                try {
                    const snap = await run('attendanceLogs studentUid', () =>
                        getDocs(
                            query(
                                collection(db, 'attendanceLogs'),
                                where('studentUid', 'in', scopedStudentUids),
                                orderBy('date', 'desc'),
                                limit(300),
                            ),
                        ),
                    );
                    attendanceDocs.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
                } catch (e) {
                    console.warn('[viewer] attendanceLogs studentUid load skipped', e);
                }
            }

            if (nonEmpty(scopedStudentAuthUids)) {
                try {
                    const snap = await run('attendanceLogs authUid', () =>
                        getDocs(
                            query(
                                collection(db, 'attendanceLogs'),
                                where('authUid', 'in', scopedStudentAuthUids),
                                orderBy('date', 'desc'),
                                limit(300),
                            ),
                        ),
                    );
                    attendanceDocs.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
                } catch (e) {
                    console.warn('[viewer] attendanceLogs authUid load skipped', e);
                }
            }

            if (!isCancelled()) {
                const authUidToStudentDocId = new Map(
                    myStudents.map((s) => [s?.authUid, s?.id]).filter(([authUid, id]) => authUid && id),
                );
                const map = new Map();
                attendanceDocs.forEach((log) => {
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
        } else if (!isCancelled() && !hasDetailCache) {
            setAttendanceLogs?.([]);
        }

        /* =========================
        clinicLogs + clinicReservations (권한 실패 허용)
        ========================= */
        if (scopedStudentUids.length > 0) {
            const viewerStudentDocId = activeOnly[0] || scopedStudentUids[0] || null;
            const viewerAuthUid = userId || scopedStudentAuthUids[0] || null;

            const clinicItems = await fetchClinicForViewer({
                db,
                studentIds: scopedStudentUids,
                studentAuthUids: scopedStudentAuthUids,
                studentDocId: viewerStudentDocId,
                authUid: viewerAuthUid,
                isCancelled,
            });

            if (!isCancelled()) {
                setClinicLogs?.(mergeClinicDocs(clinicItems, []));
            }
        } else if (!isCancelled()) {
            setClinicLogs?.([]);
        }

        /* =========================
        lessonLogs / tests
        ========================= */
        let viewerTests = [];
        let filteredTests = [];
        let allowedTestIds = null;

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
                await fetchListSafe(
                    'lessonLogs fetchList',
                    db,
                    'lessonLogs',
                    (items) => {
                        setLessonLogs?.(items);
                        viewerDetailCache.lessonLogs.set(detailCacheKey, items);
                    },
                    query(
                        collection(db, 'lessonLogs'),
                        where('classId', 'in', lessonClassIds),
                        orderBy('date', 'desc'),
                        limit(100),
                    ),
                    isCancelled,
                );

                // ✅ tests 로딩 + 로컬 변수에 저장
                const testSnap = await run('tests getDocs', () =>
                    getDocs(
                        query(
                            collection(db, 'tests'),
                            where('classId', 'in', lessonClassIds),
                            orderBy('date', 'desc'),
                            limit(100),
                        ),
                    ),
                );

                viewerTests = testSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                filteredTests = viewerTests;
                setTests?.(filteredTests);
                warnOnQuestionScores(filteredTests, 'viewer');
                allowedTestIds = null;
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
        grades (viewer: 학생/부모)
        ⚠️ 반 전체 조회 금지
        ========================= */
        if (!hasDetailCache && scopedStudentAuthUids.length > 0) {
            try {
                const gradeSnap = await run('grades getDocs', () =>
                    getDocs(
                        query(
                            collection(db, 'grades'),
                            where('authUid', 'in', scopedStudentAuthUids),
                            limit(100),
                        ),
                    ),
                );

                if (!isCancelled()) {
                    const mappedGrades = {};
                    gradeSnap.docs.forEach((docSnap) => {
                        const data = docSnap.data();
                        const { authUid: sId, testId } = data;

                        if (!sId || !testId) return;
                        if (allowedTestIds && !allowedTestIds.has(testId)) return;

                        if (!mappedGrades[sId]) mappedGrades[sId] = {};
                        mappedGrades[sId][testId] = data;
                    });

                    setGrades?.(mappedGrades);
                    viewerDetailCache.grades.set(detailCacheKey, mappedGrades);
                }
            } catch (e) {
                console.warn('[viewer] grades load failed', e);
                if (!isCancelled()) setGrades?.({});
                viewerDetailCache.grades.set(detailCacheKey, {});
            }
        } else if (!isCancelled() && !hasDetailCache) {
            setGrades?.({});
            viewerDetailCache.grades.set(detailCacheKey, {});
        }

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

                if (Array.isArray(scopedStudentAuthUids) && scopedStudentAuthUids.length > 0) {
                    const snapA = await run('homeworkResults authUid in', () =>
                        getDocs(
                            query(
                                collection(db, 'homeworkResults'),
                                where('authUid', 'in', scopedStudentAuthUids),
                                limit(200),
                            ),
                        ),
                    );
                snapA.docs.forEach((d) => upsert(d.data() || {}));
            }

            if (Array.isArray(scopedStudentUids) && scopedStudentUids.length > 0) {
                const snapB = await run('homeworkResults studentId in', () =>
                    getDocs(
                        query(
                            collection(db, 'homeworkResults'),
                            where('studentId', 'in', scopedStudentUids),
                            limit(200),
                        ),
                    ),
                );
            snapB.docs.forEach((d) => upsert(d.data() || {}));
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
        const activeViewerAuthUid =
            (userRole === 'student' ? userId : null) // 학생 본인 로그인: auth.uid
            || myStudents.find(s => s?.id === activeStudentDocId)?.authUid // parent: 학생 문서의 authUid
            || myStudents[0]?.authUid
            || null;

        console.log('[viewer] activeStudentDocId =', activeStudentDocId);
        console.log('[viewer] activeViewerAuthUid =', activeViewerAuthUid);

        /* =========================
           announcements  (✅ public + 내 대상 통합)
        ========================= */
        console.log('[viewer] fetch announcements start');

        const announcementDocs = [];
        const seen = new Set();

        const pushDocs = (docs) => {
            docs.forEach((d) => {
                if (seen.has(d.id)) return;
                seen.add(d.id);
                announcementDocs.push(d);
            });
        };

        // viewer 식별자 준비
        // - scopedStudentUids: 학생 문서 id 배열(학부모면 여러명, 학생이면 1명) (기존 변수 사용)
        // - activeViewerAuthUid: 학생 authUid (학부모면 선택학생 authUid, 학생이면 auth.uid) (기존 변수 사용)
        // - lessonClassIds: viewer가 속한 classId들 (기존 변수 사용)
        const targetStudentKeys = Array.from(
            new Set(
                [
                    ...(Array.isArray(scopedStudentUids) ? scopedStudentUids : []),
                    ...(activeViewerAuthUid ? [activeViewerAuthUid] : []),
                ].filter(Boolean).map(String)
            )
        );

        const targetClassKeys = Array.from(
            new Set((Array.isArray(lessonClassIds) ? lessonClassIds : []).filter(Boolean).map(String))
        );

        // helper: 인덱스 없으면 orderBy 없이 재시도
        async function safeGetDocsWithOptionalOrderBy(buildQueryWithOrderBy, buildQueryNoOrderBy, tag) {
            try {
                const snap = await getDocs(buildQueryWithOrderBy());
                console.log(`[viewer] announcements ${tag} ok (orderBy) size=`, snap.size);
                return snap.docs;
            } catch (e) {
                // 인덱스 필요 / 권한 문제 등 -> orderBy 제거 재시도 (권한 문제면 이것도 실패할 수 있음)
                console.warn(`[viewer] announcements ${tag} retry without orderBy`, e);
                try {
                    const snap2 = await getDocs(buildQueryNoOrderBy());
                    console.log(`[viewer] announcements ${tag} ok (no orderBy) size=`, snap2.size);
                    return snap2.docs;
                } catch (e2) {
                    console.warn(`[viewer] announcements ${tag} FAIL`, e2);
                    return [];
                }
            }
        }

        // 1) 전체 공개 공지 (isPublic === true)
        const publicDocs = await safeGetDocsWithOptionalOrderBy(
            () =>
                query(
                    collection(db, 'announcements'),
                    where('isPublic', '==', true),
                    orderBy('date', 'desc'),
                    limit(50),
                ),
            () =>
                query(
                    collection(db, 'announcements'),
                    where('isPublic', '==', true),
                    limit(50),
                ),
            'public'
        );
        pushDocs(publicDocs);

        // 2) 반 공지: targetClasses array-contains-any (필드명이 targetClasses인 경우)
        if (targetClassKeys.length > 0) {
            const classDocs = await safeGetDocsWithOptionalOrderBy(
                () =>
                    query(
                        collection(db, 'announcements'),
                        where('targetClasses', 'array-contains-any', targetClassKeys.slice(0, 10)),
                        orderBy('date', 'desc'),
                        limit(50),
                    ),
                () =>
                    query(
                        collection(db, 'announcements'),
                        where('targetClasses', 'array-contains-any', targetClassKeys.slice(0, 10)),
                        limit(50),
                    ),
                'targetClasses'
            );
            pushDocs(classDocs);
        }

        // 3) 학생 타겟 공지: targetStudents array-contains-any (레거시 호환)
        // targetStudents에 학생 문서 id 또는 authUid가 들어오는 케이스 둘 다 커버
        if (targetStudentKeys.length > 0) {
            const studentDocs = await safeGetDocsWithOptionalOrderBy(
                () =>
                    query(
                        collection(db, 'announcements'),
                        where('targetStudents', 'array-contains-any', targetStudentKeys.slice(0, 10)),
                        orderBy('date', 'desc'),
                        limit(50),
                    ),
                () =>
                    query(
                        collection(db, 'announcements'),
                        where('targetStudents', 'array-contains-any', targetStudentKeys.slice(0, 10)),
                        limit(50),
                    ),
                'targetStudents'
            );
            pushDocs(studentDocs);
        }

        // 최종 merge: data로 변환 + 정렬
        if (!isCancelled()) {
            const merged = announcementDocs
                .map((d) => ({ id: d.id, ...d.data() }))
                .filter((notice) => {
                    const hasClassTargets = Array.isArray(notice?.targetClasses)
                        && notice.targetClasses.length > 0;
                    if (!hasClassTargets) return true;
                    if (notice?.isPublic === true) return true;
                    const noticeTargets = Array.isArray(notice?.targetStudents) ? notice.targetStudents.map(String) : [];
                    const isPersonalTarget = noticeTargets.some((key) => targetStudentKeys.includes(String(key)));
                    return isPersonalTarget;
                })
                .sort((a, b) => {
                    // date가 "YYYY-MM-DD" string인 경우 우선, 없으면 createdAt/updatedAt fallback
                    const da = a.date || '';
                    const dbb = b.date || '';
                    if (da && dbb) return dbb.localeCompare(da);
                    const ta = a.createdAt?.toDate?.()?.getTime?.() || new Date(a.createdAt || 0).getTime() || 0;
                    const tb = b.createdAt?.toDate?.()?.getTime?.() || new Date(b.createdAt || 0).getTime() || 0;
                    return tb - ta;
                });

            setAnnouncements?.(merged);
        }

        console.log('[viewer] fetch announcements done');

        /* =========================
           homeworkAssignments
        ========================= */
        const homeworkDocs = [];
        const pushedHomeworkIds = new Set();
        const pushHomeworkDocs = (docs) => {
            docs.forEach((d) => {
                if (!pushedHomeworkIds.has(d.id)) {
                    pushedHomeworkIds.add(d.id);
                    homeworkDocs.push({ id: d.id, ...d.data() });
                }
            });
        };

        if (lessonClassIds.length > 0) {
            try {
                const snap = await run('homeworkAssignments by class', () =>
                    getDocs(
                        query(
                            collection(db, 'homeworkAssignments'),
                            where('classId', 'in', lessonClassIds),
                            orderBy('date', 'desc'),
                            limit(30),
                        ),
                    ),
                );
                pushHomeworkDocs(snap.docs);
            } catch (e) {
                console.warn('[viewer] homeworkAssignments class load skipped', e);
            }
        }

        if (scopedStudentUids.length > 0) {
            try {
                const directDocs = await getDocs(
                    query(
                        collection(db, 'homeworkAssignments'),
                        where('targetStudents', 'array-contains-any', scopedStudentUids.slice(0, 10)),
                        limit(30),
                    ),
                );
                pushHomeworkDocs(directDocs.docs);
            } catch (e) {
                console.warn('[viewer] homeworkAssignments targetStudents load skipped', e);
            }
        }

        if (!isCancelled()) {
            const sortedHomework = homeworkDocs.sort((a, b) => {
                const da = a.date || a.assignedDate || a.createdAt?.toDate?.() || a.createdAt;
                const dbb = b.date || b.assignedDate || b.createdAt?.toDate?.() || b.createdAt;
                return new Date(dbb || 0) - new Date(da || 0);
            });
            setHomeworkAssignments?.(sortedHomework);
        }

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
            await fetchListSafe(
                'videoProgress fetchList',
                db,
                'videoProgress',
                setVideoProgress,
                query(
                    collection(db, 'videoProgress'),
                    where('studentId', '==', activeViewerAuthUid), // ✅ 여기 바뀜 (ullo -> 7MR)
                    limit(50),
                ),
                isCancelled,
            );

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
    }
};