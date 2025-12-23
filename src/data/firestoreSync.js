import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    getDocs,
} from 'firebase/firestore';

const fetchList = async (db, colName, setter, q, isCancelled) => {
    const snap = await getDocs(q || collection(db, colName));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (isCancelled()) return [];
    setter(items);
    return items;
};

export const startStaffFirestoreSync = ({
    db,
    isLoggedIn,
    userRole,
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
    const isStaff = userRole && !['student', 'parent'].includes(userRole);
    if (!isLoggedIn || !db || !isStaff) return () => {};

    console.log('🔥 Firestore Sync Started (staff only)');
    const unsubs = [];

    const syncBasic = (colName, setter, orderField = null) => {
        let q = collection(db, colName);
        if (orderField) q = query(q, orderBy(orderField));
        unsubs.push(onSnapshot(q, (snap) => {
            if (!snap.empty) setter(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }));
    };

    const syncLogs = (colName, setter) => {
        const q = query(collection(db, colName), orderBy('date', 'desc'), limit(150));
        unsubs.push(onSnapshot(q, (snap) => {
            if (!snap.empty) setter(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }));
    };

    const syncMappedData = (colName, setter, keyField1, keyField2) => {
        const q = query(collection(db, colName), limit(300));
        unsubs.push(onSnapshot(q, (snap) => {
            if (!snap.empty) {
                const rawDocs = snap.docs.map((d) => d.data());
                const mapped = {};
                rawDocs.forEach((doc) => {
                    const k1 = doc[keyField1];
                    const k2 = doc[keyField2];
                    if (!mapped[k1]) mapped[k1] = {};
                    mapped[k1][k2] = doc;
                });
                setter((prev) => ({ ...prev, ...mapped }));
            }
        }));
    };

    syncBasic('students', setStudents, 'name');
    syncBasic('classes', setClasses);
    syncBasic('tests', setTests, 'date');

    syncLogs('lessonLogs', setLessonLogs);
    syncLogs('attendanceLogs', setAttendanceLogs);
    syncLogs('clinicLogs', setClinicLogs);
    syncLogs('workLogs', setWorkLogs);
    syncLogs('announcements', setAnnouncements);
    syncLogs('homeworkAssignments', setHomeworkAssignments);
    syncLogs('payments', setPaymentLogs);

    syncMappedData('grades', setGrades, 'studentId', 'testId');
    syncMappedData('homeworkResults', setHomeworkResults, 'studentId', 'assignmentId');

    return () => {
        console.log('🛑 Firestore Sync Stopped');
        unsubs.forEach((u) => u());
    };
};

export const loadViewerDataOnce = async ({
    db,
    isLoggedIn,
    userRole,
    userId,
    studentIds = [],
    setStudents,
    setClasses,
    setLessonLogs,
    setAttendanceLogs,
    setClinicLogs,
    setHomeworkAssignments,
    setAnnouncements,
    setVideoProgress,
    setExternalSchedules,
    setHomeworkResults,
    setGrades,
    isCancelled = () => false,
}) => {
    const isViewerRole = ['student', 'parent'].includes(userRole);
    if (!isLoggedIn || !db || !isViewerRole) return;

    const viewerStudentIds = userRole === 'student'
        ? [userId].filter(Boolean)
        : Array.isArray(studentIds)
            ? studentIds.filter(Boolean).slice(0, 10)
            : [];

    const normalizedStudentIds = viewerStudentIds.map((id) => (
        typeof id === 'string' && !Number.isNaN(Number(id))
            ? Number(id)
            : id
    ));
    if (normalizedStudentIds.length === 0) return;

    try {
        const myStudents = await fetchList(
            db,
            'students',
            setStudents,
            query(collection(db, 'students'), where('id', 'in', normalizedStudentIds), limit(10)),
            isCancelled,
        );

        const myClasses = await fetchList(
            db,
            'classes',
            setClasses,
            query(collection(db, 'classes'), where('students', 'array-contains-any', normalizedStudentIds)),
            isCancelled,
        );

        const fetchLimitedLogs = async (colName, setter, filterField) => {
            const q = query(
                collection(db, colName),
                where(filterField, 'in', normalizedStudentIds),
                orderBy('date', 'desc'),
                limit(30),
            );
            await fetchList(db, colName, setter, q, isCancelled);
        };

        await fetchLimitedLogs('attendanceLogs', setAttendanceLogs, 'studentId');
        await fetchLimitedLogs('clinicLogs', setClinicLogs, 'studentId');

        if (myClasses.length > 0) {
            const classIds = myClasses.map((c) => c.id).slice(0, 10);
            const lessonQuery = query(
                collection(db, 'lessonLogs'),
                where('classId', 'in', classIds),
                orderBy('date', 'desc'),
                limit(30),
            );
            await fetchList(db, 'lessonLogs', setLessonLogs, lessonQuery, isCancelled);
        }

        const qHomework = query(
            collection(db, 'homeworkResults'),
            where('studentId', 'in', normalizedStudentIds),
            limit(80),
        );
        const homeworkSnap = await getDocs(qHomework);
        if (!isCancelled()) {
            const mapped = {};
            homeworkSnap.docs.forEach((doc) => {
                const data = doc.data();
                const { studentId: sId, assignmentId } = data;
                if (!mapped[sId]) mapped[sId] = {};
                mapped[sId][assignmentId] = data;
            });
            setHomeworkResults((prev) => ({ ...prev, ...mapped }));
        }

        const qGrades = query(collection(db, 'grades'), where('studentId', 'in', normalizedStudentIds), limit(80));
        const gradeSnap = await getDocs(qGrades);
        if (!isCancelled()) {
            const mappedGrades = {};
            gradeSnap.docs.forEach((doc) => {
                const data = doc.data();
                const { studentId: sId, testId } = data;
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

        await fetchList(
            db,
            'videoProgress',
            setVideoProgress,
            query(collection(db, 'videoProgress'), where('studentId', '==', userId), limit(50)),
            isCancelled,
        );
        await fetchList(
            db,
            'externalSchedules',
            setExternalSchedules,
            query(
                collection(db, 'externalSchedules'),
                where('studentId', '==', userId),
                orderBy('date', 'desc'),
                limit(30),
            ),
            isCancelled,
        );
    } catch (error) {
        console.error('학생/학부모 단발성 데이터 로드 실패:', error);
    }
};