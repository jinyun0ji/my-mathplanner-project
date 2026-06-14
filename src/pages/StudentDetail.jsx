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
import {
    createStaffTimelineThread,
    fetchStaffTimelineByStudent,
} from '../domain/staffTimeline/staffTimeline.service';
import { getStudentGradeLabel } from '../utils/gradeUtils';
import { isClosedClass, sortClassesWithClosedLast } from '../utils/classStatus';
import { isSameStudentByAnyKey } from '../utils/studentKey';

const COLLECTIONS = {
    users: 'users',
    classes: 'classes',
    attendance: 'attendanceLogs',
    clinic: 'clinicLogs',
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
    record?.classId || record?.classDocId || record?.class?.id || '',
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

const fetchStudentPage = async (collectionName, student, fields, cursors = {}) => {
    const pairs = studentQueryPairs(student, fields);
    const bufferedRows = Array.isArray(cursors.__buffer) ? cursors.__buffer : [];
    if (bufferedRows.length >= PAGE_SIZE) {
        return {
            rows: bufferedRows.slice(0, PAGE_SIZE),
            cursors: { ...cursors, __buffer: bufferedRows.slice(PAGE_SIZE) },
            hasMore: true,
        };
    }
    const results = await Promise.all(pairs.map(async ([field, value]) => {
        const cursorKey = `${field}:${value}`;
        if (cursors[cursorKey] === null) return { cursorKey, docs: [], cursor: null, hasMore: false };
        const constraints = [
            where(field, '==', value),
            orderBy('date', 'desc'),
            ...(cursors[cursorKey] ? [startAfter(cursors[cursorKey])] : []),
            limit(PAGE_SIZE),
        ];
        try {
            const snapshot = await getDocs(query(collection(db, collectionName), ...constraints));
            return {
                cursorKey,
                docs: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
                cursor: snapshot.docs.at(-1) || null,
                hasMore: snapshot.size === PAGE_SIZE,
            };
        } catch (pageError) {
            console.warn(`[StudentDetail] ${collectionName} fallback query skipped`, { field, pageError });
            return { cursorKey, docs: [], cursor: null, hasMore: false };
        }
    }));
    const nextCursors = { ...cursors };
    results.forEach((result) => { nextCursors[result.cursorKey] = result.hasMore ? result.cursor : null; });
    const mergedRows = sortNewest(mergeById([
        bufferedRows,
        ...results.map((result) => result.docs),
    ]), ['date']);
    nextCursors.__buffer = mergedRows.slice(PAGE_SIZE);
    return {
        rows: mergedRows.slice(0, PAGE_SIZE),
        cursors: nextCursors,
        hasMore: nextCursors.__buffer.length > 0 || results.some((result) => result.hasMore),
    };
};

const ATTENDANCE_FIELDS = [
    ['studentId', ['id']],
    ['studentUid', ['studentUid', 'uid', 'id']],
    ['authUid', ['authUid', 'uid']],
];
const CLINIC_FIELDS = [
    ['studentId', ['id']],
    ['studentDocId', ['id']],
    ['studentUid', ['uid', 'id']],
    ['authUid', ['authUid', 'uid']],
];

const fetchByStudentKeys = async (collectionName, student, count = 300) => {
    const fields = [
        ['studentId', student.id],
        ['studentDocId', student.id],
        ['studentUid', student.id],
        ['authUid', student.authUid],
        ['uid', student.authUid],
    ].filter(([, value]) => value);
    const snapshots = await Promise.all(fields.map(([field, value]) => (
        getDocs(query(collection(db, collectionName), where(field, '==', value), limit(count)))
    )));
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

const fetchStudentRecords = async (collectionName, student) => {
    const keys = [...new Set([
        student?.id,
        student?.authUid,
        student?.uid,
        student?.studentUid,
    ].filter(Boolean).map(String))];
    const [queried, directSnapshots] = await Promise.all([
        fetchByStudentKeys(collectionName, student),
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

const fetchByClassIds = async (collectionName, classIds) => {
    const uniqueIds = [...new Set(classIds.filter(Boolean).map(String))];
    const chunks = [];
    for (let index = 0; index < uniqueIds.length; index += 10) chunks.push(uniqueIds.slice(index, index + 10));
    if (!chunks.length) return [];
    const snapshots = await Promise.all(chunks.flatMap((idsChunk) => [
        getDocs(query(collection(db, collectionName), where('classId', 'in', idsChunk), limit(300))),
        getDocs(query(collection(db, collectionName), where('classDocId', 'in', idsChunk), limit(300))),
    ]));
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

const DataTable = ({ columns, rows, emptyText }) => {
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
        || (Number(value) === 0 && grade?.attempted !== true)
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

    const canUseTimeline = [ROLE.ADMIN, ROLE.STAFF].includes(role);

    const loadTimeline = useCallback(async () => {
        if (!studentId || !canUseTimeline) {
            setTimeline([]);
            return;
        }
        setTimelineLoading(true);
        setTimelineError('');
        try {
            setTimeline(await fetchStaffTimelineByStudent(db, studentId, { limitCount: 20 }));
        } catch (loadError) {
            console.error('[StudentDetail] staffTimeline load failed', loadError);
            setTimelineError('교직원 타임라인을 불러오지 못했습니다.');
        } finally {
            setTimelineLoading(false);
        }
    }, [studentId, canUseTimeline]);

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
                    fetchStudentPage(COLLECTIONS.clinic, loadedStudent, CLINIC_FIELDS),
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
                const testIds = gradeRows.map((item) => firstValue(item, ['testId', 'testDocId'])).filter(Boolean);
                const [classRows, testRows, assignmentRows] = await Promise.all([
                    fetchByIds(COLLECTIONS.classes, [...classIds]),
                    fetchByIds(COLLECTIONS.tests, testIds),
                    fetchByClassIds(COLLECTIONS.homeworkAssignments, [...classIds]),
                ]);

                if (!mounted) return;
                setStudent(loadedStudent);
                setClasses(classRows);
                setAttendances(attendanceRows.filter((item) => isSameStudentByAnyKey(item, loadedStudent)));
                setAttendanceCursors(attendancePage.cursors);
                setAttendanceHasMore(attendancePage.hasMore);
                setGrades(gradeRows.filter((item) => isSameStudentByAnyKey(item, loadedStudent)));
                setHomeworkResults(homeworkRows.filter((item) => isSameStudentByAnyKey(item, loadedStudent)));
                setClinicLogs(clinicRows.filter((item) => isSameStudentByAnyKey(item, loadedStudent)));
                setClinicCursors(clinicPage.cursors);
                setClinicHasMore(clinicPage.hasMore);
                setPayments(paymentRows);
                setMaterials(materialRows);
                setTests(testRows);
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
    const sortedGrades = useMemo(() => sortNewest(grades, ['date', 'testDate', 'createdAt']), [grades]);
    const sortedClinics = useMemo(
        () => sortNewest(clinicLogs, ['date', 'clinicDate', 'createdAt']),
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

    const homeworkRows = useMemo(() => sortNewest(homeworkResults.map((result) => {
        const assignmentId = String(firstValue(result, ['assignmentId', 'homeworkAssignmentId'], ''));
        return { ...assignmentMap.get(assignmentId), ...result };
    }), ['assignedDate', 'date', 'createdAt']), [homeworkResults, assignmentMap]);

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
            const page = await fetchStudentPage(
                isAttendance ? COLLECTIONS.attendance : COLLECTIONS.clinic,
                student,
                isAttendance ? ATTENDANCE_FIELDS : CLINIC_FIELDS,
                isAttendance ? attendanceCursors : clinicCursors,
            );
            if (isAttendance) {
                setAttendances((current) => sortNewest(mergeById([current, page.rows]), ['date']));
                setAttendanceCursors(page.cursors);
                setAttendanceHasMore(page.hasMore);
            } else {
                setClinicLogs((current) => sortNewest(mergeById([current, page.rows]), ['date']));
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

    const className = (record) => classMap.get(getClassId(record))?.name
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
                        { key: 'test', label: '시험명', render: (row) => testMap.get(String(firstValue(row, ['testId', 'testDocId'])))?.name || firstValue(row, ['testName', 'name'], '-') },
                        { key: 'class', label: '클래스', render: className },
                        { key: 'date', label: '날짜', render: (row) => formatDate(firstValue(row, ['date', 'testDate', 'createdAt'])) },
                        { key: 'score', label: '학생 점수', render: (row) => <span className={isNotAttempted(row) ? 'font-bold text-gray-400' : 'font-bold text-[#455fab]'}>{formatScore(row)}</span> },
                        { key: 'average', label: '평균', render: (row) => firstValue(row, ['average', 'classAverage'], '-') },
                        { key: 'highest', label: '최고점', render: (row) => firstValue(row, ['highest', 'highestScore', 'classMax'], '-') },
                        { key: 'attempted', label: '응시 여부', render: (row) => isNotAttempted(row) ? '미응시' : '응시' },
                    ]} />
                </SectionCard>
            );
        }
        if (activeTab === 'homework') {
            return (
                <SectionCard title="과제" description="해당 학생의 과제 결과만 표시합니다.">
                    <DataTable rows={homeworkRows} emptyText="과제 결과가 없습니다." columns={[
                        { key: 'title', label: '과제명', render: (row) => firstValue(row, ['title', 'name', 'homeworkName'], '-') },
                        { key: 'class', label: '클래스', render: className },
                        { key: 'date', label: '출제일', render: (row) => formatDate(firstValue(row, ['assignedDate', 'date', 'createdAt'])) },
                        { key: 'status', label: '제출/완료', render: (row) => firstValue(row, ['status', 'submissionStatus'], row?.completed ? '완료' : '미완료') },
                        { key: 'summary', label: '문항 요약', render: (row) => `맞음 ${firstValue(row, ['correctCount', 'correct'], 0)} · 틀림 ${firstValue(row, ['wrongCount', 'wrong'], 0)} · 고침 ${firstValue(row, ['correctedCount', 'corrected'], 0)} · 남음 ${firstValue(row, ['remainingCount', 'remaining'], 0)}` },
                    ]} />
                </SectionCard>
            );
        }
        if (activeTab === 'clinic') {
            return (
                <SectionCard title="클리닉" description={`현재 표시된 기록 합계 ${clinicMinutes ? `${Math.floor(clinicMinutes / 60)}시간 ${clinicMinutes % 60}분` : '집계 정보 없음'}`}>
                    <DataTable rows={sortedClinics} emptyText="클리닉 기록이 없습니다." columns={[
                        { key: 'date', label: '날짜', render: (row) => formatDate(firstValue(row, ['date', 'clinicDate', 'createdAt'])) },
                        { key: 'time', label: '시간', render: (row) => firstValue(row, ['plannedTime', 'time'], formatTime(firstValue(row, ['checkIn', 'startAt']))) },
                        { key: 'teacher', label: '담당자', render: (row) => firstValue(row, ['tutorName', 'tutor', 'assistantName', 'assistant', 'teacherName', 'teacher', 'updatedByName', 'createdByName'], '담당자 미지정') },
                        { key: 'status', label: '상태', render: (row) => firstValue(row, ['status', 'clinicStatus'], '-') },
                        { key: 'comment', label: '코멘트', render: (row) => firstValue(row, ['clinicComment', 'comment', 'content'], '-') },
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
        <div className="student-detail-print mx-auto max-w-[1500px] space-y-4 pb-8">
            <div className="no-print flex items-center justify-between">
                <button type="button" onClick={() => navigate('/students')} className="text-xs font-semibold text-gray-500 hover:text-[#455fab]">← 학생 목록</button>
                <button type="button" onClick={() => window.print()} className="rounded-lg bg-[#455fab] px-4 py-2 text-xs font-bold text-white">인쇄</button>
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
                        <p className="mt-1 text-xs text-gray-500">{latestGrade ? (testMap.get(String(firstValue(latestGrade, ['testId', 'testDocId'])))?.name || firstValue(latestGrade, ['testName'], '시험명 없음')) : '등록된 성적이 없습니다.'}</p>
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
        </div>
    );
}
