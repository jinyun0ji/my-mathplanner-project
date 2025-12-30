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

const normalizeStudentUser = (student) => {
    if (!student) return student;
    return {
        ...student,
        role: student.role || ROLE.STUDENT,
    };
};

const normalizeDoc = (docSnap) => ({ id: docSnap.id, ...docSnap.data() });

const fetchList = async (
    db,
    label,
    setter,
    q,
    isCancelled,
    normalize = null,
) => {
    if (!setter) return [];
    const snap = await getDocs(q);
    if (isCancelled()) return [];
    const list = snap.docs.map((d) => normalizeDoc(d));
    const normalized = normalize ? list.map(normalize) : list;
    setter(normalized);
    return normalized;
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
    if (!isStaffOrTeachingRole(userRole)) return;

    try {
        if (setStudents) {
            await fetchList(
                db,
                'users',
                setStudents,
                query(collection(db, 'users'), where('role', '==', ROLE.STUDENT), limit(200)),
                () => false,
                normalizeStudentUser,
            );
        }

        await fetchList(db, 'classes', setClasses, query(collection(db, 'classes'), limit(200)), () => false);
        await fetchList(db, 'tests', setTests, query(collection(db, 'tests'), limit(200)), () => false);
        await fetchList(db, 'lessonLogs', setLessonLogs, query(collection(db, 'lessonLogs'), limit(300)), () => false);
        await fetchList(db, 'attendanceLogs', setAttendanceLogs, query(collection(db, 'attendanceLogs'), limit(300)), () => false);
        await fetchList(db, 'clinicLogs', setClinicLogs, query(collection(db, 'clinicLogs'), limit(300)), () => false);
        await fetchList(db, 'workLogs', setWorkLogs, query(collection(db, 'workLogs'), limit(300)), () => false);
        await fetchList(db, 'announcements', setAnnouncements, query(collection(db, 'announcements'), limit(200)), () => false);
        await fetchList(db, 'homeworkAssignments', setHomeworkAssignments, query(collection(db, 'homeworkAssignments'), limit(300)), () => false);
        await fetchList(db, 'payments', setPaymentLogs, query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(200)), () => false);
        await fetchList(db, 'grades', setGrades, query(collection(db, 'grades'), limit(500)), () => false);
        await fetchList(db, 'homeworkResults', setHomeworkResults, query(collection(db, 'homeworkResults'), limit(500)), () => false);
    } catch (error) {
        console.error('staff 단발성 데이터 로드 실패:', error);
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
    // ✅ [핵심 수정 1] 학생도 실행 가능하게
    const isViewerRole = isViewerGroupRole(userRole) || isStudentRole(userRole);
    if (!isLoggedIn || !db || !isViewerRole) return;

    const linkedStudentIds = Array.isArray(studentIds) ? studentIds.filter(Boolean) : [];

    // ✅ [핵심 수정 2] 학생은 authUid(userId)를 절대 섞지 말고 "학생 문서ID(studentDocId)"만 사용
    const viewerStudentUids = (userRole === 'student'
        ? linkedStudentIds
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
            ...myStudents.map((student) => student.id).filter(Boolean),
        ])).slice(0, 10);

        const myClassesMap = new Map();
        if (setClasses) {
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
            setClasses?.(myClasses);
        }

        await fetchList(
            db,
            'lessonLogs',
            setLessonLogs,
            query(collection(db, 'lessonLogs'), where('studentId', 'in', scopedStudentUids), limit(200)),
            isCancelled,
        );

        await fetchList(
            db,
            'attendanceLogs',
            setAttendanceLogs,
            query(collection(db, 'attendanceLogs'), where('studentId', 'in', scopedStudentUids), limit(200)),
            isCancelled,
        );

        await fetchList(
            db,
            'clinicLogs',
            setClinicLogs,
            query(collection(db, 'clinicLogs'), where('studentId', 'in', scopedStudentUids), orderBy('date', 'desc'), limit(150)),
            isCancelled,
        );

        await fetchList(
            db,
            'homeworkAssignments',
            setHomeworkAssignments,
            query(collection(db, 'homeworkAssignments'), where('studentId', 'in', scopedStudentUids), orderBy('assignedDate', 'desc'), limit(150)),
            isCancelled,
        );

        await fetchList(
            db,
            'announcements',
            setAnnouncements,
            query(collection(db, 'announcements'), orderBy('date', 'desc'), limit(80)),
            isCancelled,
        );

        await fetchList(
            db,
            'tests',
            setTests,
            query(collection(db, 'tests'), where('studentId', 'in', scopedStudentUids), orderBy('date', 'desc'), limit(100)),
            isCancelled,
        );

        await fetchList(
            db,
            'homeworkResults',
            setHomeworkResults,
            query(collection(db, 'homeworkResults'), where('studentId', 'in', scopedStudentUids), limit(200)),
            isCancelled,
        );

        await fetchList(
            db,
            'grades',
            setGrades,
            query(collection(db, 'grades'), where('studentId', 'in', scopedStudentUids), limit(200)),
            isCancelled,
        );

        const activeViewerUid =
            (userRole === 'student' ? (scopedStudentUids[0] || null) : (activeStudentId || null));

        if (activeViewerUid) {
            await fetchList(
                db,
                'videoProgress',
                setVideoProgress,
                query(collection(db, 'videoProgress'), where('authUid', '==', userId), limit(50)),
                isCancelled,
            );

            await fetchList(
                db,
                'externalSchedules',
                setExternalSchedules,
                query(
                    collection(db, 'externalSchedules'),
                    where('authUid', '==', userId),
                    orderBy('date', 'desc'),
                    limit(30),
                ),
                isCancelled,
            );
        }
    } catch (error) {
        console.error('학생/학부모 단발성 데이터 로드 실패:', error);
    }
};
