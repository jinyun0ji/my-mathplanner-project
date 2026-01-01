// ⚠️ 이 파일은 staff/admin/teacher 전용 Firestore 단발성 로드 로직이다
// ⚠️ student / parent 계정에서는 절대 실행되면 안 된다
import {
    collection,
    documentId,
    query,
    where,
    orderBy,
    limit,
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

const normalizeAuthUid = (item) => {
    if (item?.studentId) return item;
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
    const snap = await getDocs(q || collection(db, colName));
    const baseItems = snap.docs.map((d) => normalizeAuthUid({ id: d.id, ...d.data() }));
    const items = mapper ? baseItems.map(mapper) : baseItems;
    if (isCancelled()) return [];
    setter(items);
    return items;
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
}) => {
    if (!isLoggedIn || !db) return;
    if (!userRole) return;
    if (!isStaffOrTeachingRole(userRole)) return;

    const shouldLoad = (key) => !pageKey || pageKey === key;
    const applyStudents = (items) => setStudents?.(dedupeStudentsByAuthUid(items));

    try {
        if (setStudents) {
            await fetchList(
                db,
                'users',
                applyStudents,
                query(collection(db, 'users'), where('role', '==', ROLE.STUDENT), limit(500)),
                () => false,
                normalizeStudentUser,
            );
        }

        if (setClasses) {
            await fetchList(db, 'classes', setClasses, query(collection(db, 'classes'), orderBy('name')), () => false);
        }

        if (setTests && (shouldLoad('grades') || shouldLoad('lessons'))) {
            await fetchList(db, 'tests', setTests, query(collection(db, 'tests'), orderBy('date', 'desc'), limit(200)), () => false);
        }

        if (setLessonLogs && shouldLoad('lessons')) {
            await fetchList(db, 'lessonLogs', setLessonLogs, query(collection(db, 'lessonLogs'), orderBy('date', 'desc'), limit(150)), () => false);
        }

        if (setAttendanceLogs && (shouldLoad('attendance') || shouldLoad('lessons') || shouldLoad('students'))) {
            await fetchList(db, 'attendanceLogs', setAttendanceLogs, query(collection(db, 'attendanceLogs'), orderBy('date', 'desc'), limit(150)), () => false);
        }

        if (setClinicLogs && (shouldLoad('clinic') || shouldLoad('lessons'))) {
            await fetchList(db, 'clinicLogs', setClinicLogs, query(collection(db, 'clinicLogs'), orderBy('date', 'desc'), limit(150)), () => false);
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
            const gradesSnap = await getDocs(query(collection(db, 'grades'), limit(500)));
            const mappedGrades = {};
            gradesSnap.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const { authUid: sId, testId } = data;
                if (!mappedGrades[sId]) mappedGrades[sId] = {};
                mappedGrades[sId][testId] = data;
            });
            setGrades(mappedGrades);
        }

        if (setHomeworkResults && shouldLoad('homework')) {
            const homeworkSnap = await getDocs(query(collection(db, 'homeworkResults'), limit(500)));
            const mappedResults = {};
            homeworkSnap.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const { authUid: sId, assignmentId } = data;
                if (!mappedResults[sId]) mappedResults[sId] = {};
                mappedResults[sId][assignmentId] = data.results || data;
            });
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
    setExternalSchedules,
    setHomeworkResults,
    setGrades,
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

    const linkedStudentIds = Array.isArray(studentIds) ? studentIds.filter(Boolean) : [];

    // ✅ 학생은 authUid(userId) 섞지 않고 studentDocId만 사용
    const viewerStudentUids = (userRole === 'student'
        ? linkedStudentIds
        : activeStudentId
            ? [activeStudentId]
            : linkedStudentIds
    ).filter(Boolean).slice(0, 10);

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

        const scopedStudentUids = Array.from(new Set([
            ...viewerStudentUids,
            ...myStudents.map((s) => s.id).filter(Boolean),
        ])).slice(0, 10);

        console.log('[viewer] scopedStudentUids =', scopedStudentUids);

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

        const myClasses = Array.from(myClassesMap.values());
        if (!isCancelled()) {
            setClasses?.(myClasses);
        }

        console.log('[viewer] myClasses ids =', myClasses.map((c) => c.id));

        /* =========================
           attendanceLogs (fetchList)
        ========================= */
        if (scopedStudentUids.length > 0) {
            await fetchListSafe(
                'attendanceLogs fetchList',
                db,
                'attendanceLogs',
                setAttendanceLogs,
                query(
                    collection(db, 'attendanceLogs'),
                    where('studentUid', 'in', scopedStudentUids),
                    orderBy('date', 'desc'),
                    limit(30),
                ),
                isCancelled,
            );
        } else if (!isCancelled()) {
            setAttendanceLogs?.([]);
        }

        /* =========================
        clinicLogs (fetchList)
        ========================= */
        if (scopedStudentUids.length > 0) {
            const clinicDocs = [];

            // 1) studentId 기준 (studentDocId가 들어있는 케이스)
            await fetchListSafe(
                'clinicLogs studentId',
                db,
                'clinicLogs',
                (items) => clinicDocs.push(...items),
                query(
                    collection(db, 'clinicLogs'),
                    where('studentId', 'in', scopedStudentUids),
                    orderBy('date', 'desc'),
                    limit(30),
                ),
                isCancelled,
            );

            // 2) authUid 기준 (학생 authUid가 들어있는 케이스)
            await fetchListSafe(
                'clinicLogs authUid',
                db,
                'clinicLogs',
                (items) => clinicDocs.push(...items),
                query(
                    collection(db, 'clinicLogs'),
                    where('authUid', 'in', scopedStudentUids),
                    orderBy('date', 'desc'),
                    limit(30),
                ),
                isCancelled,
            );

            // 3) studentUid 기준 (옛 필드가 남아있는 케이스)
            await fetchListSafe(
                'clinicLogs studentUid',
                db,
                'clinicLogs',
                (items) => clinicDocs.push(...items),
                query(
                    collection(db, 'clinicLogs'),
                    where('studentUid', 'in', scopedStudentUids),
                    orderBy('date', 'desc'),
                    limit(30),
                ),
                isCancelled,
            );

            // ✅ 중복 제거 + 정렬
            if (!isCancelled()) {
                const map = new Map();
                clinicDocs.forEach((x) => {
                    if (!x?.id) return;
                    if (!map.has(x.id)) map.set(x.id, x);
                });

                const merged = Array.from(map.values()).sort((a, b) => {
                    const ad = String(a?.date || '');
                    const bd = String(b?.date || '');
                    return bd.localeCompare(ad);
                });

                setClinicLogs?.(merged.slice(0, 50));
            }
            } else if (!isCancelled()) {
                setClinicLogs?.([]);
        }


        /* =========================
        lessonLogs / tests
        ========================= */
        let viewerTests = [];

        const lessonClassIds = myClasses.map(c => c.id).slice(0, 10);

        if (lessonClassIds.length > 0) {
            await fetchListSafe(
                'lessonLogs fetchList',
                db,
                'lessonLogs',
                setLessonLogs,
                query(
                    collection(db, 'lessonLogs'),
                    where('classId', 'in', lessonClassIds),
                    orderBy('date', 'desc'),
                    limit(30),
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
                        limit(30),
                    ),
                ),
            );

            viewerTests = testSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setTests?.(viewerTests);
        } else if (!isCancelled()) {
            setLessonLogs?.([]);
            setTests?.([]);
        }

        /* =========================
        grades (viewer: 학생/부모)
        ⚠️ 반 전체 조회 금지
        ========================= */
        if (scopedStudentUids.length > 0) {
            const gradeSnap = await run('grades getDocs', () =>
                getDocs(
                    query(
                        collection(db, 'grades'),
                        where('authUid', 'in', scopedStudentUids),
                        limit(100),
                    ),
                ),
            );

            if (!isCancelled()) {
                const mappedGrades = {};
                gradeSnap.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    const { authUid: sId, testId } = data;
                    if (!mappedGrades[sId]) mappedGrades[sId] = {};
                    mappedGrades[sId][testId] = data;
                });
                setGrades?.(mappedGrades);
            }
        } else if (!isCancelled()) {
            setGrades?.({});
        }

        /* =========================
           homeworkResults (직접 getDocs)
        ========================= */
        if (scopedStudentUids.length > 0) {
            const homeworkSnap = await run('homeworkResults getDocs', () =>
                getDocs(
                    query(
                        collection(db, 'homeworkResults'),
                        where('authUid', 'in', scopedStudentUids),
                        limit(80),
                    ),
                ),
            );

            if (!isCancelled()) {
                const mapped = {};
                homeworkSnap.docs.forEach((docSnap) => {
                    const data = docSnap.data();
                    const { authUid: sId, assignmentId } = data;
                    if (!mapped[sId]) mapped[sId] = {};
                    mapped[sId][assignmentId] = data.results || data;
                });
                setHomeworkResults?.(mapped);
            }
        } else if (!isCancelled()) {
            setHomeworkResults?.({});
        }

        /* =========================
        announcements  (✅ viewer에서는 public만)
        ========================= */
        console.log('[viewer] fetch announcements start');

        const announcementDocs = [];

        try {
        const publicOnes = await getDocs(
            query(
            collection(db, 'announcements'),
            orderBy('date', 'desc'),
            limit(20),
            ),
        );
        announcementDocs.push(...publicOnes.docs);
        } catch (e) {
        console.error('[viewer] FAIL: announcements public', e);
        }

        if (!isCancelled()) {
        const seen = new Set();
        const merged = announcementDocs.reduce((acc, d) => {
            if (seen.has(d.id)) return acc;
            seen.add(d.id);
            acc.push({ id: d.id, ...d.data() });
            return acc;
        }, []);
        setAnnouncements?.(merged);
        }

        console.log('[viewer] fetch announcements ok');

        /* =========================
           homeworkAssignments
        ========================= */
        if (lessonClassIds.length > 0) {
            await fetchListSafe(
                'homeworkAssignments fetchList',
                db,
                'homeworkAssignments',
                setHomeworkAssignments,
                query(
                    collection(db, 'homeworkAssignments'),
                    where('classId', 'in', lessonClassIds),
                    orderBy('date', 'desc'),
                    limit(30),
                ),
                isCancelled,
            );
        } else if (!isCancelled()) {
            setHomeworkAssignments?.([]);
        }

        /* =========================
        videoProgress / externalSchedules  (✅ authUid 기준으로 조회)
        ========================= */

        // ✅ 학생 문서 id(ullo...) (화면/학생목록용)
        const activeStudentDocId = scopedStudentUids[0] || null;

        // ✅ 실제 데이터 키로 쓸 authUid(7MR...) (videoProgress/externalSchedules 조회용)
        const activeViewerAuthUid =
        (userRole === 'student' ? userId : null) // 학생 본인 로그인: auth.uid
        || myStudents.find(s => s?.id === activeStudentDocId)?.authUid // parent: 학생 문서의 authUid
        || myStudents[0]?.authUid
        || null;

        console.log('[viewer] activeStudentDocId =', activeStudentDocId);
        console.log('[viewer] activeViewerAuthUid =', activeViewerAuthUid);

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

    console.log('[viewer] COMPLETE');

    } catch (error) {
        console.error('[viewer] loadViewerDataOnce FAILED (top-level)', error);
    }
};