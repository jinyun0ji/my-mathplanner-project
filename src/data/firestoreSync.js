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

    try {
        if (setStudents) {
            await fetchList(
                db,
                'users',
                setStudents,
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
            await fetchList(db, 'payments', setPaymentLogs, query(collection(db, 'payments'), orderBy('date', 'desc'), limit(150)), () => false);
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

    const viewerStudentUids = (userRole === 'student'
        ? [userId].filter(Boolean)
        : activeStudentId
            ? [activeStudentId]
            : []).slice(0, 10);

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

        const classIds = [
            ...new Set(
                myStudents
                    .flatMap((student) => (
                        Array.isArray(student.classIds)
                            ? student.classIds
                            : (student.classes || [])
                    ))
                    .map((classId) => String(classId))
                    .filter(Boolean),
            ),
        ];
        let myClasses = [];
        if (classIds.length > 0) {
            const chunks = chunkArray(classIds, 10);
            const classSnaps = await Promise.all(
                chunks.map(async (chunk) => {
                    const classQuery = query(
                        collection(db, 'classes'),
                        where(documentId(), 'in', chunk),
                    );
                    return getDocs(classQuery);
                }),
            );
            myClasses = classSnaps.flatMap((snap) => snap.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data(),
            })));
        }
        if (!isCancelled()) {
            setClasses(myClasses);
        }

        const fetchLimitedLogs = async (colName, setter, filterField) => {
            const q = query(
                collection(db, colName),
                where(filterField, 'in', viewerStudentUids),
                orderBy('date', 'desc'),
                limit(30),
            );
            await fetchList(db, colName, setter, q, isCancelled);
        };

        await fetchLimitedLogs('attendanceLogs', setAttendanceLogs, 'studentUid');
        await fetchLimitedLogs('clinicLogs', setClinicLogs, 'authUid');

        if (myClasses.length > 0) {
            const lessonClassIds = myClasses.map((c) => c.id).slice(0, 10);
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
        }

        const qHomework = query(
            collection(db, 'homeworkResults'),
            where('authUid', 'in', viewerStudentUids),
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

        const qGrades = query(collection(db, 'grades'), where('authUid', 'in', viewerStudentUids), limit(80));
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

        await fetchList(
            db,
            'announcements',
            setAnnouncements,
            query(collection(db, 'announcements'), orderBy('date', 'desc'), limit(20)),
            isCancelled,
        );
        await fetchList(
            db,
            'homeworkAssignments',
            setHomeworkAssignments,
            query(collection(db, 'homeworkAssignments'), orderBy('date', 'desc'), limit(20)),
            isCancelled,
        );

        const activeViewerUid = viewerStudentUids[0];
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