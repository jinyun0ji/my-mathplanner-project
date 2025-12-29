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
    const isViewerRole = isViewerGroupRole(userRole);
    if (!isLoggedIn || !db || !isViewerRole) return;

    const linkedStudentIds = Array.isArray(studentIds) ? studentIds.filter(Boolean) : [];
    const viewerStudentUids = (userRole === 'student'
        ? [userId, ...linkedStudentIds]
        : activeStudentId
            ? [activeStudentId]
            : linkedStudentIds).filter(Boolean).slice(0, 10);

    if (viewerStudentUids.length === 0) return;

    try {
        const myStudents = await fetchList(
            db,
            'users',
            setStudents,
            query(collection(db, 'users'), where(documentId(), 'in', viewerStudentUids), limit(10)),
            isCancelled,
            normalizeStudentUser,
        );

        const scopedStudentUids = Array.from(new Set([
            ...viewerStudentUids,
            ...myStudents.map((student) => student.authUid || student.uid || student.id).filter(Boolean),
        ])).slice(0, 10);

        const myClassesMap = new Map();
        if (scopedStudentUids.length > 0) {
            const classSnaps = await Promise.all(
                scopedStudentUids.map(async (sId) => {
                    const classQuery = query(
                        collection(db, 'classes'),
                        where('students', 'array-contains', sId),
                    );
                    return getDocs(classQuery);
                }),
            );
            classSnaps.forEach((snap) => {
                snap.docs.forEach((docSnap) => {
                    myClassesMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
                });
            });
        }
        const myClasses = Array.from(myClassesMap.values());
        if (!isCancelled()) {
            setClasses(myClasses);
        }

        const fetchLimitedLogs = async (colName, setter, filterField) => {
            if (scopedStudentUids.length === 0) return;
            const q = query(
                collection(db, colName),
                where(filterField, 'in', scopedStudentUids),
                orderBy('date', 'desc'),
                limit(30),
            );
            await fetchList(db, colName, setter, q, isCancelled);
        };

        await fetchLimitedLogs('attendanceLogs', setAttendanceLogs, 'studentUid');
        await fetchLimitedLogs('clinicLogs', setClinicLogs, 'authUid');

        const lessonClassIds = myClasses.map((c) => c.id).slice(0, 10);

        if (lessonClassIds.length > 0) {
            const lessonQuery = query(
                collection(db, 'lessonLogs'),
                where('classId', 'in', lessonClassIds),
                orderBy('date', 'desc'),
                limit(30),
            );
            await fetchList(db, 'lessonLogs', setLessonLogs, lessonQuery, isCancelled);

            if (setTests) {
                const testsQuery = query(
                    collection(db, 'tests'),
                    where('classId', 'in', lessonClassIds),
                    orderBy('date', 'desc'),
                    limit(30),
                );
                await fetchList(db, 'tests', setTests, testsQuery, isCancelled);
            }
            } else if (!isCancelled()) {
            setLessonLogs([]);
            setTests?.([]);
        }

        if (scopedStudentUids.length > 0) {
            const qHomework = query(
                collection(db, 'homeworkResults'),
                where('authUid', 'in', scopedStudentUids),
                limit(80),
            );
            const homeworkSnap = await getDocs(qHomework);
            if (!isCancelled()) {
                const mapped = {};
                homeworkSnap.docs.forEach((doc) => {
                    const data = doc.data();
                    const { authUid: sId, assignmentId } = data;
                    if (!mapped[sId]) mapped[sId] = {};
                    mapped[sId][assignmentId] = data.results || data;
                });
                setHomeworkResults((prev) => ({ ...prev, ...mapped }));
            }

            const qGrades = query(collection(db, 'grades'), where('authUid', 'in', scopedStudentUids), limit(80));
            const gradeSnap = await getDocs(qGrades);
            if (!isCancelled()) {
                const mappedGrades = {};
                gradeSnap.docs.forEach((doc) => {
                    const data = doc.data();
                    const { authUid: sId, testId } = data;
                    if (!mappedGrades[sId]) mappedGrades[sId] = {};
                    mappedGrades[sId][testId] = data;
                });
                setGrades((prev) => ({ ...prev, ...mappedGrades }));
            }
        }

        const announcementDocs = [];
        if (scopedStudentUids.length > 0) {
            const targetedAnnouncements = await getDocs(
                query(
                    collection(db, 'announcements'),
                    where('targetStudents', 'array-contains-any', scopedStudentUids),
                    orderBy('date', 'desc'),
                    limit(20),
                ),
            );
            announcementDocs.push(...targetedAnnouncements.docs);
        }
        const publicAnnouncements = await getDocs(
            query(collection(db, 'announcements'), orderBy('date', 'desc'), limit(20)),
        );
        announcementDocs.push(...publicAnnouncements.docs);

        if (!isCancelled()) {
            const seen = new Set();
            const mergedAnnouncements = announcementDocs.reduce((acc, docSnap) => {
                if (seen.has(docSnap.id)) return acc;
                seen.add(docSnap.id);
                acc.push({ id: docSnap.id, ...docSnap.data() });
                return acc;
            }, []);
            setAnnouncements(mergedAnnouncements);
        }

        if (lessonClassIds.length > 0) {
            const assignmentsQuery = query(
                collection(db, 'homeworkAssignments'),
                where('classId', 'in', lessonClassIds),
                orderBy('date', 'desc'),
                limit(30),
            );
            await fetchList(db, 'homeworkAssignments', setHomeworkAssignments, assignmentsQuery, isCancelled);
        } else if (!isCancelled()) {
            setHomeworkAssignments([]);
        }

        const activeViewerUid = scopedStudentUids[0];
        await fetchList(
            db,
            'videoProgress',
            setVideoProgress,
            query(collection(db, 'videoProgress'), where('authUid', '==', activeViewerUid), limit(50)),
            isCancelled,
        );
        await fetchList(
            db,
            'externalSchedules',
            setExternalSchedules,
            query(
                collection(db, 'externalSchedules'),
                where('authUid', '==', activeViewerUid),
                orderBy('date', 'desc'),
                limit(30),
            ),
            isCancelled,
        );
    } catch (error) {
        console.error('학생/학부모 단발성 데이터 로드 실패:', error);
    }
};