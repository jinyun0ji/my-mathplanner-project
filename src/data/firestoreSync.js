// ⚠️ 이 파일은 staff/admin/teacher 전용 Firestore 실시간 동기화 로직이다
// ⚠️ student / parent 계정에서는 절대 실행되면 안 된다
import {
    collection,
    documentId,
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
    if (!isLoggedIn || !db) return () => {};
    if (!userRole) return () => {};
    if (!['staff', 'admin', 'teacher'].includes(userRole)) return () => {};

    const unsubs = [];

    const syncBasic = (colRef, setter, orderField = null) => {
        let q = colRef;
        if (orderField) q = query(q, orderBy(orderField));
        unsubs.push(onSnapshot(q, (snap) => {
            if (!snap.empty) setter(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }, (err) => {
            console.error('[FirestoreSync] 권한 오류:', err);
        }));
    };

    const syncLogs = (colName, setter) => {
        const q = query(collection(db, colName), orderBy('date', 'desc'), limit(150));
        unsubs.push(onSnapshot(q, (snap) => {
            if (!snap.empty) setter(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }, (err) => {
            console.error('[FirestoreSync] 권한 오류:', err);
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
        }, (err) => {
            console.error('[FirestoreSync] 권한 오류:', err);
        }));
    };

    syncBasic(query(collection(db, 'users'), where('role', '==', 'student')), setStudents);
    syncBasic(collection(db, 'classes'), setClasses);
    syncBasic(collection(db, 'tests'), setTests, 'date');

    syncLogs('lessonLogs', setLessonLogs);
    syncLogs('attendanceLogs', setAttendanceLogs);
    syncLogs('clinicLogs', setClinicLogs);
    syncLogs('workLogs', setWorkLogs);
    syncLogs('announcements', setAnnouncements);
    syncLogs('homeworkAssignments', setHomeworkAssignments);
    syncLogs('payments', setPaymentLogs);

    syncMappedData('grades', setGrades, 'studentUid', 'testId');
    syncMappedData('homeworkResults', setHomeworkResults, 'studentUid', 'assignmentId');

    return () => {
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

    const viewerStudentUids = userRole === 'student'
        ? [userId].filter(Boolean)
        : Array.isArray(studentIds)
            ? studentIds.filter(Boolean).slice(0, 10)
            : [];

    if (viewerStudentUids.length === 0) return;

    try {
        const myStudents = await fetchList(
            db,
            'users',
            setStudents,
            query(collection(db, 'users'), where(documentId(), 'in', viewerStudentUids), limit(10)),
            isCancelled,
        );

        const myClasses = await fetchList(
            db,
            'classes',
            setClasses,
            query(collection(db, 'classes'), where('students', 'array-contains-any', viewerStudentUids)),
            isCancelled,
        );

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
        await fetchLimitedLogs('clinicLogs', setClinicLogs, 'studentUid');

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
            where('studentUid', 'in', viewerStudentUids),
            limit(80),
        );
        const homeworkSnap = await getDocs(qHomework);
        if (!isCancelled()) {
            const mapped = {};
            homeworkSnap.docs.forEach((doc) => {
                const data = doc.data();
                const { studentUid: sId, assignmentId } = data;
                if (!mapped[sId]) mapped[sId] = {};
                mapped[sId][assignmentId] = data;
            });
            setHomeworkResults((prev) => ({ ...prev, ...mapped }));
        }

        const qGrades = query(collection(db, 'grades'), where('studentUid', 'in', viewerStudentUids), limit(80));
        const gradeSnap = await getDocs(qGrades);
        if (!isCancelled()) {
            const mappedGrades = {};
            gradeSnap.docs.forEach((doc) => {
                const data = doc.data();
                const { studentUid: sId, testId } = data;
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
            query(collection(db, 'videoProgress'), where('studentUid', '==', userId), limit(50)),
            isCancelled,
        );
        await fetchList(
            db,
            'externalSchedules',
            setExternalSchedules,
            query(
                collection(db, 'externalSchedules'),
                where('studentUid', '==', userId),
                orderBy('date', 'desc'),
                limit(30),
            ),
            isCancelled,
        );
    } catch (error) {
        console.error('학생/학부모 단발성 데이터 로드 실패:', error);
    }
};