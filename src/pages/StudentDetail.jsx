import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    collection,
    doc,
    documentId,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    startAfter,
    where,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import useAuth from '../auth/useAuth';
import { ROLE } from '../constants/roles';
import StaffTimelineThreadCard from '../components/StaffTimeline/StaffTimelineThreadCard';
import StudentDetailPrint from '../components/StudentDetail/StudentDetailPrint';
import {
    createStaffTimelineThread,
    fetchStaffTimelineByStudent,
} from '../domain/staffTimeline/staffTimeline.service';
import { getStudentGradeLabel } from '../utils/gradeUtils';
import { isClosedClass, sortClassesWithClosedLast } from '../utils/classStatus';
import { isSameStudentByAnyKey } from '../utils/studentKey';
import {
    resolveHomeworkAssignmentId,
    resolveHomeworkAssignmentTitle,
    resolveHomeworkQuestionSummary,
} from '../domain/homework/homework.service';
import { resolveGradeDisplay, resolveGradeTestId } from '../domain/grade/grade.service';
import { resolveClassTestStats } from '../domain/grade/classTestStats.service';
import { formatScoreStat } from '../utils/scoreDisplay';
import { buildStudentClinicPrintRows, buildStudentClinicRows, buildStudentGradeRows, buildStudentHomeworkRows, fetchStudentPageCore } from '../domain/studentDetail/studentDetailScreen.logic';

const COLLECTIONS = {
    users: 'users',
    classes: 'classes',
    attendance: 'attendanceLogs',
    clinic: 'clinicLogs',
    clinicReservations: 'clinicReservations',
    grades: 'grades',
    tests: 'tests',
    homeworkResults: 'homeworkResults',
    homeworkAssignments: 'homeworkAssignments',
    payments: 'payments',
    materials: 'materialPurchases',
};

const TABS = [
    ['profile', '기본정보'],
    ['classes', '수강반'],
    ['attendance', '출결'],
    ['grades', '성적'],
    ['homework', '과제'],
    ['clinic', '클리닉'],
    ['timeline', '교직원 타임라인'],
    ['payments', '결제/교재'],
];

const toDate = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value, fallback = '-') => {
    const date = toDate(value);
    if (!date) return value ? String(value) : fallback;
    return date.toLocaleDateString('ko-KR');
};

const formatTime = (value) => {
    if (!value) return '-';
    const date = toDate(value);
    if (!date) return String(value);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};

const firstValue = (record, keys, fallback = '') => {
    for (const key of keys) {
        const value = record?.[key];
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return fallback;
};

const sortNewest = (items, keys) => [...items].sort((a, b) => {
    const aDate = toDate(firstValue(a, keys));
    const bDate = toDate(firstValue(b, keys));
    return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
});

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();
const isAbsent = (value) => ['결석', 'absent', 'absence'].includes(normalizeStatus(value));
const isLate = (value) => ['지각', 'late', 'tardy'].includes(normalizeStatus(value));
const isPresent = (value) => ['출석', 'present', 'attended', '정상'].includes(normalizeStatus(value));
const isVideoMakeup = (value) => ['동영상보강', '동영상 보강', 'video', 'video_makeup'].includes(normalizeStatus(value));

const getClassId = (record) => String(
    record?.classId || record?.classUid || record?.classDocId || record?.class?.id || '',
);

const getStudentClassIds = (student) => {
    const values = Array.isArray(student?.classIds)
        ? student.classIds
        : (Array.isArray(student?.classes) ? student.classes : []);
    return values.map(String);
};

const mergeById = (groups) => {
    const map = new Map();
    groups.flat().forEach((item) => {
        if (item?.id) map.set(String(item.id), item);
    });
    return [...map.values()];
};

const PAGE_SIZE = 4;
const studentQueryPairs = (student, fields) => {
    const values = {
        id: student?.id,
        uid: student?.uid,
        authUid: student?.authUid,
        studentUid: student?.studentUid,
        userUid: student?.userUid,
    };
    const pairs = fields.flatMap(([field, valueKeys]) => valueKeys.map((key) => [field, values[key]]));
    const seen = new Set();
    return pairs.filter(([field, value]) => {
        if (!value) return false;
        const key = `${field}:${value}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

export const fetchStudentPage = async (collectionName, student, fields, cursors = {}) => {
    const pairs = studentQueryPairs(student, fields);
    return fetchStudentPageCore({
        pairs, cursors, pageSize: PAGE_SIZE, mergeRows: mergeById,
        sortRows: (rows) => sortNewest(rows, ['date']),
        fetchPair: async ({ field, value, cursor }) => {
        const constraints = [
            where(field, '==', value),
            orderBy('date', 'desc'),
            ...(cursor ? [startAfter(cursor)] : []),
            limit(PAGE_SIZE),
        ];
        try {
            const snapshot = await getDocs(query(collection(db, collectionName), ...constraints));
            const result = {
                docs: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
                cursor: snapshot.docs.at(-1) || null,
                hasMore: snapshot.size === PAGE_SIZE,
            };
            if (process.env.NODE_ENV !== 'production' && collectionName === COLLECTIONS.clinic) {
                console.log('[studentDetail][clinic:query]', {
                    field,
                    value,
                    previousCursorId: cursor?.id || null,
                    returnedIds: result.docs.map((item) => item.id),
                    nextCursorId: result.cursor?.id || null,
                    hasMore: result.hasMore,
                });
            }
            return result;
        } catch (pageError) {
            console.warn(`[StudentDetail] ${collectionName} fallback query skipped`, { field, pageError });
            return { docs: [], cursor: null, hasMore: false };
        }
        },
    });
};

export const CLINIC_FIELDS = [
    ['studentId', ['id', 'studentUid', 'uid', 'authUid', 'userUid']],
    ['studentDocId', ['id', 'studentUid', 'uid', 'authUid', 'userUid']],
    ['studentUid', ['id', 'studentUid', 'uid', 'authUid', 'userUid']],
    ['authUid', ['id', 'studentUid', 'uid', 'authUid', 'userUid']],
    ['uid', ['id', 'studentUid', 'uid', 'authUid', 'userUid']],
    ['userUid', ['id', 'studentUid', 'uid', 'authUid', 'userUid']],
];

// clinicLogs에는 date가 생기기 전의 문서도 남아 있다. Firestore의 orderBy는 해당
// 필드가 없는 문서를 제외하므로, 일반 학생 상세의 클리닉 목록만 식별자별 전체를
// 한 번 읽고 effective date를 클라이언트에서 정렬한 뒤 화면 단위로 나눈다.
export const fetchStudentClinicPage = async (student, cursors = {}) => {
    const identityPairs = studentQueryPairs(student, CLINIC_FIELDS);
    const pairs = ['clinicLogs', 'clinicReservations'].flatMap((source) => (
        identityPairs.map(([field, value]) => [`${source}:${field}`, value])
    ));
    return fetchStudentPageCore({
        pairs, cursors, pageSize: PAGE_SIZE,
        mergeRows: (groups) => {
            const rows = groups.flat();
            return buildStudentClinicRows({
                clinicLogs: mergeById([rows.filter((row) => row.sourceType === 'clinicLog')]),
                clinicReservations: mergeById([rows.filter((row) => row.sourceType === 'clinicReservation')]),
            });
        },
        sortRows: (rows) => rows,
        fetchPair: async ({ field: sourceField, value }) => {
            const [source, field] = sourceField.split(':');
            const snapshot = await getDocs(query(
                collection(db, source),
                where(field, '==', value),
            ));
            const sourceType = source === COLLECTIONS.clinicReservations ? 'clinicReservation' : 'clinicLog';
            const docs = snapshot.docs.map((item) => ({ id: item.id, ...item.data(), sourceType }));
            if (process.env.NODE_ENV !== 'production') {
                console.log('[studentDetail][clinic:query]', {
                    field: sourceField,
                    value,
                    previousCursorId: null,
                    returnedIds: docs.map((item) => item.id),
                    nextCursorId: null,
                    hasMore: false,
                });
            }
            return { docs, cursor: null, hasMore: false };
        },
    });
};

const ATTENDANCE_FIELDS = [
    ['studentId', ['id']],
    ['studentUid', ['studentUid', 'uid', 'id']],
    ['authUid', ['authUid', 'uid']],
];

const fetchByStudentKeys = async (collectionName, student, count = 300) => {
    const studentKeys = [...new Set([
        student.id,
        student.uid,
        student.authUid,
        student.studentUid,
        student.userUid,
    ].filter(Boolean).map(String))];
    const fields = ['studentId', 'studentDocId', 'studentUid', 'authUid', 'uid']
        .flatMap((field) => studentKeys.map((value) => [field, value]));
    const snapshots = await Promise.all(fields.map(([field, value]) => {
        const constraints = [where(field, '==', value)];
        if (count != null) constraints.push(limit(count));
        return getDocs(query(collection(db, collectionName), ...constraints));
    }));
    return mergeById(snapshots.map((snapshot) => (
        snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    )));
};

const fetchByIds = async (collectionName, ids) => {
    const uniqueIds = [...new Set(ids.filter(Boolean).map(String))];
    const chunks = [];
    for (let index = 0; index < uniqueIds.length; index += 10) {
        chunks.push(uniqueIds.slice(index, index + 10));
    }
    if (!chunks.length) return [];
    const snapshots = await Promise.all(chunks.map((idsChunk) => (
        getDocs(query(collection(db, collectionName), where(documentId(), 'in', idsChunk)))
    )));
    return snapshots.flatMap((snapshot) => (
        snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    ));
};

const fetchStudentRecords = async (collectionName, student, count = 300) => {
    const keys = [...new Set([
        student?.id,
        student?.authUid,
        student?.uid,
        student?.studentUid,
        student?.userUid,
    ].filter(Boolean).map(String))];
    const [queried, directSnapshots] = await Promise.all([
        fetchByStudentKeys(collectionName, student, count),
        Promise.all(keys.map((key) => getDoc(doc(db, collectionName, key)).catch(() => null))),
    ]);
    const direct = directSnapshots
        .filter((snapshot) => snapshot?.exists())
        .flatMap((snapshot) => {
            const data = snapshot.data();
            const nestedEntries = Object.entries(data || {}).filter(([, value]) => (
                value && typeof value === 'object' && !Array.isArray(value)
            ));
            if (!nestedEntries.length) return [{ id: snapshot.id, ...data }];
            return nestedEntries.map(([recordId, value]) => ({
                id: `${snapshot.id}:${recordId}`,
                studentId: snapshot.id,
                ...(collectionName === COLLECTIONS.grades ? { testId: recordId } : { assignmentId: recordId }),
                ...value,
            }));
        });
    return mergeById([queried, direct]);
};

const fetchByClassIds = async (collectionName, classIds, count = 300) => {
    const uniqueIds = [...new Set(classIds.filter(Boolean).map(String))];
    const chunks = [];
    for (let index = 0; index < uniqueIds.length; index += 10) chunks.push(uniqueIds.slice(index, index + 10));
    if (!chunks.length) return [];
    const snapshots = await Promise.all(chunks.flatMap((idsChunk) => ['classId', 'classDocId'].map((field) => {
        const constraints = [where(field, 'in', idsChunk)];
        if (count != null) constraints.push(limit(count));
        return getDocs(query(collection(db, collectionName), ...constraints));
    })));
    return mergeById(snapshots.map((snapshot) => (
        snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    )));
};

const EmptyState = ({ children }) => (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-xs text-gray-500">
        {children}
    </div>
);

const SectionCard = ({ title, description, children, action }) => (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
            <div>
                <h3 className="text-sm font-bold text-gray-900">{title}</h3>
                {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
            </div>
            {action}
        </div>
        {children}
    </section>
);

export const DataTable = ({ columns, rows, emptyText }) => {
    if (!rows.length) return <EmptyState>{emptyText}</EmptyState>;
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
                <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                        {columns.map((column) => (
                            <th key={column.key} className="px-3 py-2.5 font-semibold">{column.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {rows.map((row, rowIndex) => (
                        <tr key={row.id || rowIndex} className="text-gray-700 hover:bg-gray-50/70">
                            {columns.map((column) => (
                                <td key={column.key} className="px-3 py-3 align-top">
                                    {column.render ? column.render(row) : (row[column.key] ?? '-')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const scoreValue = (grade) => firstValue(grade, ['score', 'result', 'totalScore', 'studentScore'], null);
const isNotAttempted = (grade) => {
    const value = scoreValue(grade);
    const normalized = normalizeStatus(value);
    return grade?.attempted === false
        || value === null
        || value === undefined
        || value === ''
        || ['미응시', '미제출', 'absent', 'not_attempted'].includes(normalized);
};

const formatScore = (grade) => {
    if (isNotAttempted(grade)) return '미응시';
    const numeric = Number(scoreValue(grade));
    return Number.isFinite(numeric) ? `${numeric.toFixed(1)}점` : String(scoreValue(grade));
};

export default function StudentDetail() {
    const { studentId } = useParams();
    const navigate = useNavigate();
    const { user, role, userProfile, profileDocId } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [student, setStudent] = useState(null);
    const [classes, setClasses] = useState([]);
    const [attendances, setAttendances] = useState([]);
    const [grades, setGrades] = useState([]);
    const [tests, setTests] = useState([]);
    const [classTestStats, setClassTestStats] = useState({});
    const [homeworkResults, setHomeworkResults] = useState([]);
    const [homeworkAssignments, setHomeworkAssignments] = useState([]);
    const [clinicLogs, setClinicLogs] = useState([]);
    const [attendanceCursors, setAttendanceCursors] = useState({});
    const [clinicCursors, setClinicCursors] = useState({});
    const [attendanceHasMore, setAttendanceHasMore] = useState(false);
    const [clinicHasMore, setClinicHasMore] = useState(false);
    const [attendanceMoreLoading, setAttendanceMoreLoading] = useState(false);
    const [clinicMoreLoading, setClinicMoreLoading] = useState(false);
    const [payments, setPayments] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [timeline, setTimeline] = useState([]);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [timelineDraft, setTimelineDraft] = useState('');
    const [timelineSaving, setTimelineSaving] = useState(false);
    const [timelineError, setTimelineError] = useState('');
    const [printData, setPrintData] = useState(null);
    const [printPreparing, setPrintPreparing] = useState(false);
    const [printError, setPrintError] = useState('');

    const canUseTimeline = [ROLE.ADMIN, ROLE.STAFF, ROLE.TEACHER].includes(role);

    const loadTimeline = useCallback(async () => {
        if (!student || !canUseTimeline) {
            setTimeline([]);
            return;
        }
        setTimelineLoading(true);
        setTimelineError('');
        try {
            setTimeline(await fetchStaffTimelineByStudent(db, student, { limitCount: 20 }));
        } catch (loadError) {
            console.error('[StudentDetail] staffTimeline load failed', loadError);
            setTimelineError('교직원 타임라인을 불러오지 못했습니다.');
        } finally {
            setTimelineLoading(false);
        }
    }, [student, canUseTimeline]);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const studentSnapshot = await getDoc(doc(db, COLLECTIONS.users, studentId));
                if (!studentSnapshot.exists()) throw new Error('학생 정보를 찾을 수 없습니다.');
                const loadedStudent = { id: studentSnapshot.id, ...studentSnapshot.data() };
                if (loadedStudent.role && loadedStudent.role !== ROLE.STUDENT && loadedStudent.role !== 'student') {
                    throw new Error('학생 역할의 문서가 아닙니다.');
                }

                const [attendancePage, gradeRows, homeworkRows, clinicPage, paymentRows, materialRows] = await Promise.all([
                    fetchStudentPage(COLLECTIONS.attendance, loadedStudent, ATTENDANCE_FIELDS),
                    fetchStudentRecords(COLLECTIONS.grades, loadedStudent),
                    fetchStudentRecords(COLLECTIONS.homeworkResults, loadedStudent),
                    fetchStudentClinicPage(loadedStudent),
                    fetchByStudentKeys(COLLECTIONS.payments, loadedStudent).catch(() => []),
                    fetchByStudentKeys(COLLECTIONS.materials, loadedStudent).catch(() => []),
                ]);
                const attendanceRows = attendancePage.rows;
                const clinicRows = clinicPage.rows;

                const classIds = new Set(getStudentClassIds(loadedStudent));
                [...attendanceRows, ...gradeRows, ...homeworkRows, ...clinicRows].forEach((item) => {
                    const classId = getClassId(item);
                    if (classId) classIds.add(classId);
                });
                const testIds = gradeRows.map(resolveGradeTestId).filter(Boolean);
                const assignmentIds = homeworkRows.map(resolveHomeworkAssignmentId).filter(Boolean);
                const testRows = await fetchByIds(COLLECTIONS.tests, testIds);
                testRows.forEach((test) => {
                    const classId = getClassId(test);
                    if (classId) classIds.add(classId);
                });
                const statsIds = testRows
                    .filter((test) => test.id && getClassId(test))
                    .map((test) => `${getClassId(test)}_${test.id}`);
                const [classRows, assignmentRowsByClass, assignmentRowsById, statsRows] = await Promise.all([
                    fetchByIds(COLLECTIONS.classes, [...classIds]),
                    fetchByClassIds(COLLECTIONS.homeworkAssignments, [...classIds]),
                    fetchByIds(COLLECTIONS.homeworkAssignments, assignmentIds),
                    fetchByIds('classTestStats', statsIds),
                ]);
                const assignmentRows = mergeById([assignmentRowsByClass, assignmentRowsById]);

                if (!mounted) return;
                setStudent(loadedStudent);
                setClasses(classRows);
                setAttendances(attendanceRows.filter((item) => isSameStudentByAnyKey(item, loadedStudent)));
                setAttendanceCursors(attendancePage.cursors);
                setAttendanceHasMore(attendancePage.hasMore);
                const matchedGrades = gradeRows.filter((item) => (
                    isSameStudentByAnyKey(item, loadedStudent)
                    && testRows.some((test) => String(resolveGradeTestId(item)) === String(test.id))
                ));
                const matchedHomework = homeworkRows.filter((item) => isSameStudentByAnyKey(item, loadedStudent));
                if (process.env.NODE_ENV !== 'production') {
                    const loadedTestMap = new Map(testRows.map((item) => [String(item.id), item]));
                    const loadedClassMap = new Map(classRows.map((item) => [String(item.id), item]));
                    const loadedAssignmentMap = new Map(assignmentRows.map((item) => [String(item.id || item.assignmentId), item]));
                    const renderedGrades = buildStudentGradeRows({
                        grades: matchedGrades, testMap: loadedTestMap, classMap: loadedClassMap,
                        classTestStats: Object.fromEntries(statsRows.map((stats) => [stats.id, stats])),
                        getClassId, isClosedClass, resolveClassTestStats,
                        logger: (details) => console.log('[studentDetail][grade:join]', details),
                    });
                    const renderedHomework = buildStudentHomeworkRows({
                        homeworkResults: matchedHomework, assignmentMap: loadedAssignmentMap, studentId: loadedStudent.id,
                        logger: (details) => console.log('[studentDetail][homework:join]', details),
                    });
                    const unresolvedAssignmentIds = assignmentIds.filter((id) => !loadedAssignmentMap.has(String(id)));
                    console.log('[studentDetail][grades]', {
                        rawGradeCount: gradeRows.length,
                        matchedGradeCount: matchedGrades.length,
                        testIds,
                        loadedTestCount: testRows.length,
                        renderedGradeCount: renderedGrades.length,
                    });
                    console.log('[studentDetail][homework]', {
                        rawHomeworkResultCount: homeworkRows.length,
                        matchedHomeworkResultCount: matchedHomework.length,
                        assignmentIds,
                        loadedAssignmentCount: assignmentRows.length,
                        renderedHomeworkCount: renderedHomework.length,
                        unresolvedAssignmentIds,
                    });
                    console.log('[studentDetail][clinic:initial]', {
                        fetchedClinicCount: clinicPage.rows.length,
                        fetchedClinicIds: clinicPage.rows.map((item) => item.id),
                        renderedClinicCount: clinicRows.filter((item) => isSameStudentByAnyKey(item, loadedStudent)).length,
                        clinicHasMore: clinicPage.hasMore,
                    });
                }
                setGrades(matchedGrades);
                setHomeworkResults(matchedHomework);
                setClinicLogs(clinicRows.filter((item) => isSameStudentByAnyKey(item, loadedStudent)));
                setClinicCursors(clinicPage.cursors);
                setClinicHasMore(clinicPage.hasMore);
                setPayments(paymentRows);
                setMaterials(materialRows);
                setTests(testRows);
                setClassTestStats(Object.fromEntries(statsRows.map((stats) => [stats.id, stats])));
                setHomeworkAssignments(assignmentRows);
            } catch (loadError) {
                console.error('[StudentDetail] load failed', loadError);
                if (mounted) setError(loadError?.message || '학생 정보를 불러오지 못했습니다.');
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [studentId]);

    useEffect(() => {
        if (activeTab === 'timeline') loadTimeline();
    }, [activeTab, loadTimeline]);

    const classMap = useMemo(() => new Map(classes.map((item) => [String(item.id), item])), [classes]);
    const testMap = useMemo(() => new Map(tests.map((item) => [String(item.id), item])), [tests]);
    const assignmentMap = useMemo(() => new Map(homeworkAssignments.map((item) => [
        String(item.id || item.assignmentId),
        item,
    ])), [homeworkAssignments]);
    const sortedClasses = useMemo(() => sortClassesWithClosedLast(classes), [classes]);
    const sortedAttendances = useMemo(
        () => sortNewest(attendances, ['date', 'lessonDate', 'createdAt']),
        [attendances],
    );
    const gradeRows = useMemo(() => buildStudentGradeRows({
        grades, testMap, classMap, classTestStats, getClassId, isClosedClass, resolveClassTestStats,
    }), [grades, testMap, classMap, classTestStats]);
    const sortedGrades = useMemo(
        () => [...gradeRows].sort((a, b) => (
            (toDate(b.testDate)?.getTime() || 0) - (toDate(a.testDate)?.getTime() || 0)
        )),
        [gradeRows],
    );
    const sortedClinics = useMemo(
        () => sortNewest(clinicLogs, ['effectiveDate', 'date', 'clinicDate', 'reservationDate', 'scheduledAt', 'startAt', 'createdAt']),
        [clinicLogs],
    );

    const attendanceSummary = useMemo(() => {
        const presentCount = sortedAttendances.filter((item) => isPresent(firstValue(item, ['status', 'attendanceStatus']))).length;
        const videoCount = sortedAttendances.filter((item) => isVideoMakeup(firstValue(item, ['status', 'attendanceStatus']))).length;
        const absentCount = sortedAttendances.filter((item) => isAbsent(firstValue(item, ['status', 'attendanceStatus']))).length;
        const lateCount = sortedAttendances.filter((item) => isLate(firstValue(item, ['status', 'attendanceStatus']))).length;
        return {
            recent: sortedAttendances.slice(0, 4),
            presentCount,
            videoCount,
            absentCount,
            lateCount,
            rate: sortedAttendances.length
                ? Math.round(((presentCount + videoCount) / sortedAttendances.length) * 100)
                : null,
        };
    }, [sortedAttendances]);

    const latestGrade = sortedGrades[0];
    const latestClinic = sortedClinics[0];
    const clinicMinutes = useMemo(() => clinicLogs.reduce((total, item) => {
        const direct = Number(firstValue(item, ['durationMinutes', 'minutes'], 0));
        if (Number.isFinite(direct) && direct > 0) return total + direct;
        const start = toDate(firstValue(item, ['checkIn', 'startAt']));
        const end = toDate(firstValue(item, ['checkOut', 'endAt']));
        return start && end ? total + Math.max(0, Math.round((end - start) / 60000)) : total;
    }, 0), [clinicLogs]);

    const homeworkRows = useMemo(() => sortNewest(buildStudentHomeworkRows({
        homeworkResults, assignmentMap, studentId: student?.id,
    }), ['assignedDate', 'date', 'createdAt']), [homeworkResults, assignmentMap, student?.id]);

    const actor = useMemo(() => ({
        uid: profileDocId || user?.uid || '',
        name: userProfile?.displayName || user?.displayName || user?.email || '교직원',
        role,
    }), [profileDocId, user, userProfile, role]);

    const loadMore = async (type) => {
        if (!student) return;
        const isAttendance = type === 'attendance';
        const setMoreLoading = isAttendance ? setAttendanceMoreLoading : setClinicMoreLoading;
        setMoreLoading(true);
        try {
            const page = isAttendance
                ? await fetchStudentPage(COLLECTIONS.attendance, student, ATTENDANCE_FIELDS, attendanceCursors)
                : await fetchStudentClinicPage(student, clinicCursors);
            if (isAttendance) {
                setAttendances((current) => sortNewest(mergeById([current, page.rows]), ['date']));
                setAttendanceCursors(page.cursors);
                setAttendanceHasMore(page.hasMore);
            } else {
                setClinicLogs((current) => {
                    const merged = sortNewest(mergeById([current, page.rows]), ['effectiveDate', 'date', 'clinicDate', 'reservationDate', 'scheduledAt', 'startAt', 'createdAt']);
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('[studentDetail][clinic:more]', {
                            previousClinicCount: current.length,
                            previousClinicIds: current.map((item) => item.id),
                            fetchedNextCount: page.rows.length,
                            fetchedNextIds: page.rows.map((item) => item.id),
                            mergedClinicCount: merged.length,
                            mergedClinicIds: merged.map((item) => item.id),
                            clinicHasMore: page.hasMore,
                        });
                    }
                    return merged;
                });
                setClinicCursors(page.cursors);
                setClinicHasMore(page.hasMore);
            }
        } catch (loadError) {
            console.error(`[StudentDetail] ${type} pagination failed`, loadError);
        } finally {
            setMoreLoading(false);
        }
    };

    const handleCreateTimeline = async () => {
        const content = timelineDraft.trim();
        if (!content || !student) return;
        setTimelineSaving(true);
        setTimelineError('');
        try {
            await createStaffTimelineThread(db, {
                sourceType: 'studentMemo',
                sourceDocId: student.id,
                sourceCollection: COLLECTIONS.users,
                studentId: student.id,
                studentName: student.name || '',
                title: '학생 상세 메모',
                content,
                createdBy: actor.uid,
                createdByName: actor.name,
                senderRole: actor.role,
            });
            setTimelineDraft('');
            await loadTimeline();
        } catch (saveError) {
            console.error('[StudentDetail] staffTimeline save failed', saveError);
            setTimelineError('교직원 메모 저장에 실패했습니다.');
        } finally {
            setTimelineSaving(false);
        }
    };

    if (loading) return <EmptyState>학생 정보를 불러오는 중입니다.</EmptyState>;
    if (error || !student) {
        return (
            <EmptyState>
                <p className="font-semibold text-rose-600">{error || '학생 정보를 찾을 수 없습니다.'}</p>
                <button type="button" onClick={() => navigate('/students')} className="mt-3 rounded-lg bg-[#455fab] px-4 py-2 font-bold text-white">
                    학생 목록으로
                </button>
            </EmptyState>
        );
    }

    const className = (record) => record?.className
        || firstValue(classMap.get(getClassId(record)), ['name', 'className', 'title'])
        || firstValue(record, ['className'], '(클래스 미상)');
    const activeClassCount = sortedClasses.filter((item) => !isClosedClass(item)).length;
    const infoRows = [
        ['이름', student.name || '-'],
        ['학교', student.school || '-'],
        ['학년', getStudentGradeLabel(student)],
        ['연락처', firstValue(student, ['phone', 'studentPhone'], '-')],
        ['학부모 연락처', firstValue(student, ['parentPhone', 'guardianPhone'], '-')],
        ['등록일', formatDate(firstValue(student, ['registeredAt', 'joinedAt', 'createdAt']))],
        ['상태', student.status || '-'],
        ['출생년도', student.birthYear || '-'],
    ];

    const handlePrint = async () => {
        if (printPreparing) return;
        setPrintPreparing(true);
        setPrintError('');
        try {
            // The clinic tab is deliberately the source of truth for printing: do not fetch either
            // clinic collection here, because that would make the printout differ from the loaded page.
            const currentClinicsForPrint = buildStudentClinicPrintRows(sortedClinics);
            const [allAttendances, allGrades, allHomework, allPayments, allMaterials, allTimeline] = await Promise.all([
                fetchByStudentKeys(COLLECTIONS.attendance, student, null),
                fetchStudentRecords(COLLECTIONS.grades, student, null),
                fetchStudentRecords(COLLECTIONS.homeworkResults, student, null),
                fetchByStudentKeys(COLLECTIONS.payments, student, null).catch(() => []),
                fetchByStudentKeys(COLLECTIONS.materials, student, null).catch(() => []),
                canUseTimeline ? fetchStaffTimelineByStudent(db, student, { limitCount: null }) : Promise.resolve([]),
            ]);
            const matchedAttendances = allAttendances.filter((item) => isSameStudentByAnyKey(item, student));
            const matchedGrades = allGrades.filter((item) => isSameStudentByAnyKey(item, student));
            const matchedHomework = allHomework.filter((item) => isSameStudentByAnyKey(item, student));
            const baseClassIds = getStudentClassIds(student);
            const referencedTestIds = matchedGrades.map(resolveGradeTestId).filter(Boolean);
            const [referencedTests, classTests] = await Promise.all([
                fetchByIds(COLLECTIONS.tests, referencedTestIds),
                fetchByClassIds(COLLECTIONS.tests, baseClassIds, null),
            ]);
            const printTests = mergeById([referencedTests, classTests]);
            const printClassIds = [...new Set([
                ...baseClassIds,
                ...matchedAttendances.map(getClassId),
                ...currentClinicsForPrint.map(getClassId),
                ...printTests.map(getClassId),
            ].filter(Boolean))];
            const assignmentIds = matchedHomework.map(resolveHomeworkAssignmentId).filter(Boolean);
            const statsIds = printTests.filter((test) => test.id && getClassId(test)).map((test) => `${getClassId(test)}_${test.id}`);
            const [printClasses, assignmentsByClass, assignmentsById, printStats] = await Promise.all([
                fetchByIds(COLLECTIONS.classes, printClassIds),
                fetchByClassIds(COLLECTIONS.homeworkAssignments, printClassIds, null),
                fetchByIds(COLLECTIONS.homeworkAssignments, assignmentIds),
                fetchByIds('classTestStats', statsIds),
            ]);
            const printClassMap = new Map(printClasses.map((item) => [String(item.id), item]));
            const printTestMap = new Map(printTests.map((item) => [String(item.id), item]));
            const printAssignmentMap = new Map(mergeById([assignmentsByClass, assignmentsById]).map((item) => [String(item.id), item]));
            const printStatsMap = Object.fromEntries(printStats.map((item) => [item.id, item]));
            const resolvedGrades = matchedGrades.flatMap((grade) => {
                const test = printTestMap.get(String(resolveGradeTestId(grade)));
                if (!test) return [];
                const classDoc = printClassMap.get(getClassId(test));
                const stats = resolveClassTestStats(test, printStatsMap);
                return [{ ...grade, test, testDate: firstValue(test, ['testDate', 'date', 'createdAt']), ...resolveGradeDisplay({ grade, test, classDoc }), classAverage: stats?.average ?? test.average ?? null, highestScore: stats?.maxScore ?? test.maxScore ?? null }];
            });
            const resolvedHomework = matchedHomework.flatMap((result) => {
                const assignment = printAssignmentMap.get(String(resolveHomeworkAssignmentId(result)));
                if (!assignment) return [];
                return [{ ...assignment, ...result, assignmentTitle: resolveHomeworkAssignmentTitle(assignment), questionSummary: resolveHomeworkQuestionSummary(assignment, result) }];
            });
            const printClassName = (record) => record?.className
                || firstValue(printClassMap.get(getClassId(record)), ['name', 'className', 'title'])
                || firstValue(record, ['className'], '(클래스 미상)');
            if (process.env.NODE_ENV !== 'production') {
                const clinicId = (item) => `${item.sourceType || 'clinicLog'}:${item.id}`;
                console.log('[studentDetail][print:clinic]', {
                    screenClinicCount: clinicLogs.length,
                    screenClinicIds: clinicLogs.map(clinicId),
                    printClinicCount: currentClinicsForPrint.length,
                    printClinicIds: currentClinicsForPrint.map(clinicId),
                });
            }
            setPrintData({
                student,
                infoRows,
                classes: sortClassesWithClosedLast(printClasses),
                attendances: sortNewest(matchedAttendances, ['date', 'lessonDate', 'createdAt']),
                clinics: currentClinicsForPrint,
                tests: sortNewest(printTests, ['testDate', 'date', 'createdAt']),
                grades: sortNewest(resolvedGrades, ['testDate', 'date', 'createdAt']),
                homework: sortNewest(resolvedHomework, ['assignedDate', 'date', 'createdAt']),
                timeline: allTimeline,
                paymentMaterials: [
                    ...allPayments.map((item) => ({ ...item, recordType: '결제' })),
                    ...allMaterials.map((item) => ({ ...item, recordType: '교재' })),
                ],
                className: printClassName,
                formatScore,
            });
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            window.print();
            setPrintData(null);
        } catch (printLoadError) {
            console.error('[StudentDetail] print data load failed', printLoadError);
            setPrintError('인쇄용 전체 데이터를 준비하지 못했습니다. 다시 시도해주세요.');
            setPrintData(null);
        } finally {
            setPrintPreparing(false);
        }
    };

    const renderTab = () => {
        if (activeTab === 'profile') {
            return (
                <SectionCard title="기본정보" description="학생 등록 정보입니다. 수정은 기존 학생 관리 화면을 이용합니다.">
                    <dl className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-4">
                        {infoRows.map(([label, value]) => (
                            <div key={label}>
                                <dt className="text-[11px] font-semibold text-gray-400">{label}</dt>
                                <dd className="mt-1 text-sm font-medium text-gray-800">{value}</dd>
                            </div>
                        ))}
                        <div className="col-span-2 lg:col-span-4">
                            <dt className="text-[11px] font-semibold text-gray-400">메모</dt>
                            <dd className="mt-1 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                                {firstValue(student, ['memo', 'note', 'notes'], '메모가 없습니다.')}
                            </dd>
                        </div>
                    </dl>
                </SectionCard>
            );
        }
        if (activeTab === 'classes') {
            return (
                <SectionCard title="수강반" description="진행 중 클래스가 먼저 표시됩니다.">
                    <DataTable
                        rows={sortedClasses}
                        emptyText="등록된 수강반이 없습니다."
                        columns={[
                            { key: 'name', label: '클래스명' },
                            { key: 'teacher', label: '담당 강사', render: (row) => firstValue(row, ['teacherName', 'teacher'], '-') },
                            { key: 'schedule', label: '요일/시간', render: (row) => [firstValue(row, ['day', 'days', 'weekday']), firstValue(row, ['time', 'classTime'])].filter(Boolean).join(' ') || '-' },
                            { key: 'status', label: '상태', render: (row) => <span className={`rounded-full px-2 py-1 font-bold ${isClosedClass(row) ? 'bg-gray-100 text-gray-500' : 'bg-[#eef2ff] text-[#455fab]'}`}>{isClosedClass(row) ? '종강' : firstValue(row, ['status', 'classStatus'], '진행중')}</span> },
                            { key: 'startDate', label: '시작일', render: (row) => formatDate(firstValue(row, ['startDate', 'startedAt'])) },
                            { key: 'endDate', label: '종강일', render: (row) => formatDate(firstValue(row, ['endDate', 'endedAt', 'finishDate'])) },
                        ]}
                    />
                </SectionCard>
            );
        }
        if (activeTab === 'attendance') {
            return (
                <div className="space-y-4">
                    <p className="text-xs font-medium text-gray-500">현재 표시된 최근 기록 기준 요약입니다.</p>
                    <div className="grid gap-3 sm:grid-cols-5">
                        {[
                            ['출석', `${attendanceSummary.presentCount}회`],
                            ['지각', `${attendanceSummary.lateCount}회`],
                            ['결석', `${attendanceSummary.absentCount}회`],
                            ['동영상 보강', `${attendanceSummary.videoCount}회`],
                            ['출석률', attendanceSummary.rate === null ? '-' : `${attendanceSummary.rate}%`],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
                                <p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-xl font-bold text-[#455fab]">{value}</p>
                            </div>
                        ))}
                    </div>
                    <SectionCard title="출결 기록" description="최근 기록부터 4개씩 표시합니다.">
                        <DataTable rows={sortedAttendances} emptyText="출결 기록이 없습니다." columns={[
                            { key: 'date', label: '날짜', render: (row) => formatDate(firstValue(row, ['date', 'lessonDate', 'createdAt'])) },
                            { key: 'class', label: '클래스', render: className },
                            { key: 'status', label: '출결 상태', render: (row) => firstValue(row, ['status', 'attendanceStatus'], '-') },
                            { key: 'memo', label: '메모/사유', render: (row) => firstValue(row, ['memo', 'reason', 'note'], '-') },
                        ]} />
                        <div className="no-print mt-4 text-center">
                            {attendanceHasMore ? (
                                <button type="button" disabled={attendanceMoreLoading} onClick={() => loadMore('attendance')} className="rounded-lg border border-[#455fab] px-4 py-2 text-xs font-bold text-[#455fab] disabled:opacity-50">
                                    {attendanceMoreLoading ? '불러오는 중...' : '출결 4개 더보기'}
                                </button>
                            ) : sortedAttendances.length > 0 && <p className="text-xs text-gray-400">더 이상 기록이 없습니다.</p>}
                        </div>
                    </SectionCard>
                </div>
            );
        }
        if (activeTab === 'grades') {
            return (
                <SectionCard title="성적" description="미응시는 점수와 구분하여 표시합니다.">
                    <DataTable rows={sortedGrades} emptyText="성적 기록이 없습니다." columns={[
                        { key: 'test', label: '시험명', render: (row) => firstValue(row.test, ['name', 'title', 'testName'], firstValue(row, ['testName', 'name'], '-')) },
                        { key: 'class', label: '클래스', render: className },
                        { key: 'date', label: '날짜', render: (row) => formatDate(row.testDate) },
                        { key: 'score', label: '학생 점수', render: (row) => <span className={isNotAttempted(row) ? 'font-bold text-gray-400' : 'font-bold text-[#455fab]'}>{formatScore(row)}</span> },
                        { key: 'average', label: '평균', render: (row) => formatScoreStat(row.classAverage) },
                        { key: 'highest', label: '최고점', render: (row) => formatScoreStat(row.highestScore) },
                        { key: 'submitted', label: '응시자 수', render: (row) => row.submittedCount ?? '통계 준비 중' },
                        { key: 'attempted', label: '응시 여부', render: (row) => isNotAttempted(row) ? '미응시' : '응시' },
                    ]} />
                </SectionCard>
            );
        }
        if (activeTab === 'homework') {
            return (
                <SectionCard title="과제" description="해당 학생의 과제 결과만 표시합니다.">
                    <DataTable rows={homeworkRows} emptyText="과제 결과가 없습니다." columns={[
                        { key: 'title', label: '과제명', render: (row) => row.assignmentTitle },
                        { key: 'class', label: '클래스', render: className },
                        { key: 'date', label: '출제일', render: (row) => formatDate(firstValue(row, ['assignedDate', 'date', 'createdAt'])) },
                        { key: 'status', label: '제출/완료', render: (row) => firstValue(row, ['status', 'submissionStatus'], row?.completed ? '완료' : '미완료') },
                        { key: 'summary', label: '문항 요약', render: (row) => row.questionSummary },
                    ]} />
                </SectionCard>
            );
        }
        if (activeTab === 'clinic') {
            return (
                <SectionCard title="클리닉" description={`현재 표시된 기록 합계 ${clinicMinutes ? `${Math.floor(clinicMinutes / 60)}시간 ${clinicMinutes % 60}분` : '집계 정보 없음'}`}>
                    <DataTable rows={sortedClinics} emptyText="클리닉 기록이 없습니다." columns={[
                        { key: 'date', label: '날짜', render: (row) => formatDate(firstValue(row, ['effectiveDate', 'date', 'clinicDate', 'reservationDate', 'scheduledAt', 'startAt', 'createdAt'])) },
                        { key: 'time', label: '시간', render: (row) => firstValue(row, ['effectiveTime', 'plannedTime', 'time'], formatTime(firstValue(row, ['checkIn', 'startAt']))) },
                        { key: 'teacher', label: '담당자', render: (row) => firstValue(row, ['effectiveStaffName', 'tutorName', 'tutor', 'assistantName', 'assistant', 'teacherName', 'teacher', 'updatedByName', 'createdByName'], '담당자 미지정') },
                        { key: 'status', label: '상태', render: (row) => firstValue(row, ['effectiveStatus', 'status', 'clinicStatus'], '-') },
                        { key: 'comment', label: '코멘트', render: (row) => firstValue(row, ['effectiveComment', 'clinicComment', 'comment', 'content'], '-') },
                    ]} />
                    <div className="no-print mt-4 text-center">
                        {clinicHasMore ? (
                            <button type="button" disabled={clinicMoreLoading} onClick={() => loadMore('clinic')} className="rounded-lg border border-[#455fab] px-4 py-2 text-xs font-bold text-[#455fab] disabled:opacity-50">
                                {clinicMoreLoading ? '불러오는 중...' : '클리닉 4개 더보기'}
                            </button>
                        ) : sortedClinics.length > 0 && <p className="text-xs text-gray-400">더 이상 기록이 없습니다.</p>}
                    </div>
                </SectionCard>
            );
        }
        if (activeTab === 'timeline') {
            if (!canUseTimeline) return <EmptyState>교직원만 접근할 수 있습니다.</EmptyState>;
            return (
                <SectionCard title="교직원 타임라인" description="학생/학부모에게 노출되지 않는 내부 기록입니다.">
                    <div className="mb-5 rounded-xl border border-[#dfe6ff] bg-[#f8f9ff] p-4">
                        <textarea value={timelineDraft} onChange={(event) => setTimelineDraft(event.target.value)} placeholder="새 교직원 메모를 입력하세요." className="min-h-[90px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#455fab] focus:outline-none" />
                        <div className="mt-2 flex items-center justify-between">
                            <p className="text-xs text-rose-600">{timelineError}</p>
                            <button type="button" disabled={timelineSaving || !timelineDraft.trim()} onClick={handleCreateTimeline} className="rounded-lg bg-[#455fab] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{timelineSaving ? '저장 중...' : '메모 등록'}</button>
                        </div>
                    </div>
                    {timelineLoading ? <EmptyState>타임라인을 불러오는 중입니다.</EmptyState> : (
                        <div className="space-y-3">
                            {timeline.map((thread) => <StaffTimelineThreadCard key={thread.id} thread={thread} actor={actor} onChanged={loadTimeline} showStudentName={false} />)}
                            {!timeline.length && <EmptyState>교직원 타임라인 기록이 없습니다.</EmptyState>}
                        </div>
                    )}
                </SectionCard>
            );
        }
        const paymentMaterialRows = [
            ...payments.map((item) => ({ ...item, recordType: '결제' })),
            ...materials.map((item) => ({ ...item, recordType: '교재' })),
        ];
        return (
            <SectionCard title="결제/교재">
                <DataTable rows={sortNewest(paymentMaterialRows, ['date', 'paidAt', 'createdAt'])} emptyText="결제/교재 기록이 없습니다." columns={[
                    { key: 'type', label: '구분', render: (row) => row.recordType },
                    { key: 'date', label: '날짜', render: (row) => formatDate(firstValue(row, ['date', 'paidAt', 'receivedAt', 'createdAt'])) },
                    { key: 'item', label: '항목', render: (row) => firstValue(row, ['title', 'itemName', 'bookName', 'description'], '-') },
                    { key: 'amount', label: '금액', render: (row) => { const amount = Number(firstValue(row, ['amount', 'price'], NaN)); return Number.isFinite(amount) ? `${amount.toLocaleString()}원` : '-'; } },
                    { key: 'status', label: '상태', render: (row) => firstValue(row, ['status', 'paymentStatus', 'receiveStatus'], '-') },
                ]} />
            </SectionCard>
        );
    };

    return (
        <div className="student-detail-container mx-auto max-w-[1500px] space-y-4 pb-8">
            <div className="no-print flex items-center justify-between">
                <button type="button" onClick={() => navigate('/students')} className="text-xs font-semibold text-gray-500 hover:text-[#455fab]">← 학생 목록</button>
                <div className="flex items-center gap-3">
                    {printError && <span className="text-xs font-medium text-rose-600">{printError}</span>}
                    <button type="button" disabled={printPreparing} onClick={handlePrint} className="rounded-lg bg-[#455fab] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{printPreparing ? '인쇄 준비 중...' : '인쇄'}</button>
                </div>
            </div>
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-gray-900">{student.name || '이름 미상'}</h1>
                            <span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-bold text-[#455fab]">{student.status || '상태 미상'}</span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">{student.school || '학교 정보 없음'} · {getStudentGradeLabel(student)}</p>
                    </div>
                    <div className="rounded-xl bg-[#455fab] px-5 py-3 text-white">
                        <p className="text-[11px] text-white/70">수강 중 클래스</p>
                        <p className="mt-0.5 text-2xl font-bold">{activeClassCount}</p>
                    </div>
                </div>
                <div className="grid gap-3 pt-4 md:grid-cols-3">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[11px] font-bold text-gray-400">최근 출결</p>
                        <p className="mt-1 text-sm font-semibold text-gray-800">{attendanceSummary.recent[0] ? `${formatDate(firstValue(attendanceSummary.recent[0], ['date', 'lessonDate']))} · ${firstValue(attendanceSummary.recent[0], ['status', 'attendanceStatus'], '-')}` : '기록 없음'}</p>
                        <p className="mt-1 text-xs text-gray-500">최근 4회 · 출석률 {attendanceSummary.rate === null ? '-' : `${attendanceSummary.rate}%`}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[11px] font-bold text-gray-400">최근 성적</p>
                        <p className="mt-1 text-sm font-semibold text-gray-800">{latestGrade ? formatScore(latestGrade) : '기록 없음'}</p>
                        <p className="mt-1 text-xs text-gray-500">{latestGrade ? (firstValue(latestGrade.test, ['name', 'title', 'testName'], firstValue(latestGrade, ['testName'], '시험명 없음'))) : '등록된 성적이 없습니다.'}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[11px] font-bold text-gray-400">최근 클리닉</p>
                        <p className="mt-1 text-sm font-semibold text-gray-800">{latestClinic ? `${formatDate(firstValue(latestClinic, ['date', 'clinicDate']))} · ${firstValue(latestClinic, ['status', 'clinicStatus'], '-')}` : '기록 없음'}</p>
                        <p className="mt-1 text-xs text-gray-500">{clinicMinutes ? `누적 ${Math.floor(clinicMinutes / 60)}시간 ${clinicMinutes % 60}분` : '누적 시간 정보 없음'}</p>
                    </div>
                </div>
            </section>
            <nav className="no-print overflow-x-auto rounded-2xl border border-gray-200 bg-white px-2">
                <div className="flex min-w-max">
                    {TABS.map(([id, label]) => (
                        <button key={id} type="button" onClick={() => setActiveTab(id)} className={`border-b-2 px-4 py-3 text-xs font-bold transition ${activeTab === id ? 'border-[#455fab] text-[#455fab]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                            {label}
                        </button>
                    ))}
                </div>
            </nav>
            {renderTab()}
            <StudentDetailPrint data={printData} />
        </div>
    );
}
