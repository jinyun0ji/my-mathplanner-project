import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    addDoc,
    collection,
    doc,
    deleteDoc,
    documentId,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import useAuth from '../auth/useAuth';
import { ROLE } from '../constants/roles';
import { formatGradeLabel, Icon } from '../utils/helpers';
import { formatGradeScoreText } from '../domain/grade/grade.service';
import { getLinkedParentAuthUids } from '../utils/parentLinking';

const COL = {
    USERS: 'users',
    ATTENDANCE: 'attendanceLogs',
    CLINIC: 'clinicLogs',
    GRADES: 'grades',
    HOMEWORK_RESULTS: 'homeworkResults',
    TESTS: 'tests',
    CLASSES: 'classes',
    STAFF_MEMOS: 'staffMemos',
};

const STAFF_MEMO_LIMIT = 100;
const SUMMARY_LIMIT = 20;

const formatDateTime = (value) => {
    if (!value) return '작성 시각 정보 없음';
    if (typeof value?.toDate === 'function') {
        return value.toDate().toLocaleString('ko-KR');
    }
    if (value instanceof Date) {
        return value.toLocaleString('ko-KR');
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString('ko-KR');
    }
    return String(value);
};

const formatDate = (value) => {
    if (!value) return '날짜 정보 없음';
    if (typeof value?.toDate === 'function') {
        return value.toDate().toISOString().slice(0, 10);
    }
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
    }
    return String(value);
};

const resolveValue = (record, keys) => keys.map((key) => record?.[key]).find((value) => value !== null && value !== undefined && value !== '');

const toSortableDate = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return null;
};

const sortByDateDesc = (items, keys) => {
    const sorted = [...items];
    sorted.sort((a, b) => {
        const aDate = toSortableDate(resolveValue(a, keys));
        const bDate = toSortableDate(resolveValue(b, keys));
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return bDate.getTime() - aDate.getTime();
    });
    return sorted;
};

const getStudentClassIds = (studentData) => {
    if (!studentData) return [];
    const rawIds = Array.isArray(studentData.classIds)
        ? studentData.classIds
        : (Array.isArray(studentData.classes) ? studentData.classes : []);
    return rawIds.map((value) => String(value));
};

const fetchClassesByIds = async (ids) => {
    if (!ids?.length) return [];
    const batches = [];
    for (let i = 0; i < ids.length; i += 10) {
        batches.push(ids.slice(i, i + 10));
    }
    const snapshots = await Promise.all(
        batches.map((chunk) =>
            getDocs(query(collection(db, COL.CLASSES), where(documentId(), 'in', chunk))),
        ),
    );
    return snapshots.flatMap((snapshot) =>
        snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })),
    );
};

const fetchDocsByIds = async (collectionName, ids) => {
    if (!ids?.length) return [];
    const batches = [];
    for (let i = 0; i < ids.length; i += 10) {
        batches.push(ids.slice(i, i + 10));
    }
    const snapshots = await Promise.all(
        batches.map((chunk) =>
            getDocs(query(collection(db, collectionName), where(documentId(), 'in', chunk))),
        ),
    );
    return snapshots.flatMap((snapshot) =>
        snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })),
    );
};

const mergeSnapshots = (snapshots) => {
    const merged = new Map();
    snapshots.filter(Boolean).forEach((snapshot) => {
        snapshot.docs.forEach((docSnap) => {
            merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
        });
    });
    return Array.from(merged.values());
};

const fetchByFields = async (collectionName, fields, limitCount = 200) => {
    const queries = fields
        .filter(({ value }) => value)
        .map(({ key, value }) => query(collection(db, collectionName), where(key, '==', value), limit(limitCount)));
    if (queries.length === 0) return [];
    const snapshots = await Promise.all(queries.map((q) => getDocs(q)));
    return mergeSnapshots(snapshots);
};

const getClassId = (record) => record?.classId || record?.classDocId || record?.class?.id || '';

export default function StudentDetail() {
    const { studentId: studentDocId } = useParams();
    const navigate = useNavigate();
    const { user, role, userProfile, profileDocId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [student, setStudent] = useState(null);
    const [attendances, setAttendances] = useState([]);
    const [homeworks, setHomeworks] = useState([]);
    const [grades, setGrades] = useState([]);
    const [clinicLogs, setClinicLogs] = useState([]);
    const [classes, setClasses] = useState([]);
    const [tests, setTests] = useState([]);
    const [parents, setParents] = useState([]);
    const [staffMemos, setStaffMemos] = useState([]);
    const [memoDraft, setMemoDraft] = useState('');
    const [memoSaving, setMemoSaving] = useState(false);
    const [memoError, setMemoError] = useState(null);
    const [studentAuthUid, setStudentAuthUid] = useState(null);
    const [parentsLoading, setParentsLoading] = useState(false);
    const [editingMemoId, setEditingMemoId] = useState(null);
    const [editingMemoDraft, setEditingMemoDraft] = useState('');
    const [memoActionId, setMemoActionId] = useState(null);

    const canManageStaffMemos = useMemo(
        () => [ROLE.ADMIN, ROLE.STAFF].includes(role),
        [role],
    );

    useEffect(() => {
        let isMounted = true;

        const loadStudentDetail = async () => {
            setLoading(true);
            setError(null);
            setStudent(null);
            setAttendances([]);
            setHomeworks([]);
            setGrades([]);
            setClinicLogs([]);
            setClasses([]);
            setTests([]);
            setParents([]);
            setStudentAuthUid(null);
            setParentsLoading(true);

            if (!studentDocId) {
                if (isMounted) {
                    setError('학생 UID를 찾을 수 없습니다.');
                    setParentsLoading(false);
                    setLoading(false);
                }
                return;
            }

            try {
                const studentRef = doc(db, COL.USERS, studentDocId);
                const studentSnap = await getDoc(studentRef);

                if (!isMounted) return;

                if (!studentSnap.exists()) {
                    setError('학생 정보를 찾을 수 없습니다.');
                    setStudent(null);
                    setParentsLoading(false);
                    setLoading(false);
                    return;
                }

                const studentData = studentSnap.data();
                if (studentData?.role && studentData.role !== 'student') {
                    setError('학생 역할의 문서가 아닙니다.');
                    setStudent(null);
                    setParentsLoading(false);
                    setLoading(false);
                    return;
                }

                const authUid = studentData?.authUid || null;
                setStudent({ id: studentSnap.id, ...studentData });
                setStudentAuthUid(authUid);

                const attendancePromise = fetchByFields(
                    COL.ATTENDANCE,
                    [
                        { key: 'studentId', value: studentDocId },
                        { key: 'studentDocId', value: studentDocId },
                        { key: 'studentUid', value: studentDocId },
                        { key: 'authUid', value: authUid },
                        { key: 'uid', value: authUid },
                    ],
                    200,
                );

                const clinicPromise = fetchByFields(
                    COL.CLINIC,
                    [
                        { key: 'studentId', value: studentDocId },
                        { key: 'studentDocId', value: studentDocId },
                        { key: 'studentUid', value: studentDocId },
                        { key: 'authUid', value: authUid },
                        { key: 'uid', value: authUid },
                    ],
                    200,
                );

                const homeworkPromise = fetchByFields(
                    COL.HOMEWORK_RESULTS,
                    [
                        { key: 'studentId', value: studentDocId },
                        { key: 'studentDocId', value: studentDocId },
                        { key: 'uid', value: authUid },
                        { key: 'authUid', value: authUid },
                    ],
                    200,
                );

                const gradesPromise = fetchByFields(
                    COL.GRADES,
                    [
                        { key: 'studentId', value: studentDocId },
                        { key: 'studentDocId', value: studentDocId },
                        { key: 'authUid', value: authUid },
                    ],
                    200,
                );

                const parentsPromise = (async () => {
                    const parentRoles = [ROLE.PARENT, '학부모'];
                    try {
                        const parentSnapshot = await getDocs(
                            query(collection(db, COL.USERS), where('role', 'in', parentRoles), limit(500)),
                        );
                        if (!isMounted) return;
                        setParents(parentSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
                    } catch (fetchError) {
                        console.warn('[student detail] parent role in query failed, fallback to client filter', fetchError);
                        const fallbackSnapshot = await getDocs(query(collection(db, COL.USERS), limit(500)));
                        if (!isMounted) return;
                        const roleSet = new Set(parentRoles);
                        setParents(
                            fallbackSnapshot.docs
                                .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
                                .filter((user) => roleSet.has(user?.role)),
                        );
                    } finally {
                        if (isMounted) {
                            setParentsLoading(false);
                        }
                    }
                })();

                const [attendanceItems, clinicItems, homeworkItems, gradeItems] = await Promise.all([
                    attendancePromise,
                    clinicPromise,
                    homeworkPromise,
                    gradesPromise,
                ]);

                if (!isMounted) return;

                const testIds = Array.from(
                    new Set(
                        gradeItems
                            .map((item) => item.testId || item.testDocId || item.test?.id)
                            .filter(Boolean)
                            .map((value) => String(value)),
                    ),
                );
                const testDocs = await fetchDocsByIds(COL.TESTS, testIds);

                if (!isMounted) return;

                const classIds = new Set(getStudentClassIds(studentData));
                [...attendanceItems, ...clinicItems, ...homeworkItems, ...gradeItems, ...testDocs].forEach((record) => {
                    const id = getClassId(record) || record?.classId;
                    if (id) classIds.add(String(id));
                });
                const classDocs = await fetchClassesByIds(Array.from(classIds));

                if (!isMounted) return;

                await parentsPromise;

                setAttendances(attendanceItems);
                setClinicLogs(clinicItems);
                setHomeworks(homeworkItems);
                setGrades(gradeItems);
                setTests(testDocs);
                setClasses(classDocs);
            } catch (fetchError) {
                console.error('상세 에러 로그:', fetchError);
                if (isMounted) {
                    setError('학생 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
                    setParentsLoading(false);
                }
                } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadStudentDetail();

        return () => {
            isMounted = false;
        };
    }, [studentDocId]);

    const classNameById = useMemo(
        () => new Map((Array.isArray(classes) ? classes : []).map((item) => [String(item.id), item.name])),
        [classes],
    );

    const testsById = useMemo(
        () => new Map((Array.isArray(tests) ? tests : []).map((item) => [String(item.id), item])),
        [tests],
    );

    const resolveClassName = (record, fallbackId = '') => {
        const classId = fallbackId || getClassId(record);
        if (!classId) return '(클래스 미상)';
        return classNameById.get(String(classId)) || '(클래스 미상)';
    };

    useEffect(() => {
        if (!studentDocId || !canManageStaffMemos) {
            setStaffMemos([]);
            return undefined;
        }

        const memosQuery = query(
            collection(db, COL.USERS, studentDocId, COL.STAFF_MEMOS),
            orderBy('createdAt', 'desc'),
            limit(STAFF_MEMO_LIMIT),
        );

        const unsubscribe = onSnapshot(
            memosQuery,
            (snapshot) => {
                const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
                setStaffMemos(items);
            },
            (fetchError) => {
                console.error('staff memo load error:', fetchError);
                setMemoError('직원 메모를 불러오는 데 실패했습니다.');
            },
        );

        return () => unsubscribe();
    }, [studentDocId, canManageStaffMemos]);

    const handleSaveStaffMemo = async () => {
        const trimmed = memoDraft.trim();
        if (!trimmed || !studentDocId) return;
        setMemoSaving(true);
        setMemoError(null);

        try {
            const createdByName = userProfile?.displayName || user?.displayName || user?.email || '알 수 없음';
            await addDoc(collection(db, COL.USERS, studentDocId, COL.STAFF_MEMOS), {
                content: trimmed,
                createdAt: serverTimestamp(),
                createdByUid: profileDocId || user?.uid || null,
                createdByName,
                tags: [],
                visibility: 'staff',
            });
            setMemoDraft('');
        } catch (saveError) {
            console.error('staff memo save error:', saveError);
            setMemoError('직원 메모 저장에 실패했습니다.');
        } finally {
            setMemoSaving(false);
        }
    };

    const renderStatus = () => {
        if (loading) {
            return (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
                    <p className="text-sm font-semibold text-gray-700">학생 정보를 불러오는 중입니다</p>
                    <p className="mt-2 text-xs text-gray-500">데이터를 안전하게 불러오는 중입니다.</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center shadow-sm">
                    <p className="text-sm font-semibold text-rose-600">{error}</p>
                    <button
                        type="button"
                        onClick={() => navigate('/students')}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-rose-600 shadow-sm"
                    >
                        <Icon name="arrow-left" className="h-4 w-4" />
                        학생 목록으로 돌아가기
                    </button>
                </div>
            );
        }

        if (!student) {
            return (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
                    <p className="text-sm font-semibold text-gray-700">학생을 찾을 수 없습니다</p>
                    <p className="mt-2 text-xs text-gray-500">학생 UID: {studentDocId}</p>
                    <button
                        type="button"
                        onClick={() => navigate('/students')}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-sm"
                    >
                        <Icon name="arrow-left" className="h-4 w-4" />
                        학생 목록으로 이동
                    </button>
                </div>
            );
        }

        const attendanceItems = Array.isArray(attendances) ? attendances : [];
        const homeworkItems = Array.isArray(homeworks) ? homeworks : [];
        const gradeItems = Array.isArray(grades) ? grades : [];
        const clinicItems = Array.isArray(clinicLogs) ? clinicLogs : [];
        const classItems = Array.isArray(classes) ? classes : [];
        const accountLinked = Boolean(studentAuthUid);
        const parentAuthUids = getLinkedParentAuthUids(student, parents);
        const parentAuthUidLabel = parentsLoading
            ? '로딩...'
            : (parentAuthUids.length > 0 ? parentAuthUids.join(', ') : '연결 없음');
        const classStatusMap = student.classStatusMap || student.classStatuses || {};
        const classIds = getStudentClassIds(student);
        const classBadges = classIds.map((classId) => {
            const classInfo = classItems.find((item) => String(item.id) === String(classId));
            const status = classStatusMap?.[classId]?.status || student.status || '상태 정보 없음';
            return {
                id: classId,
                name: classInfo?.name || `클래스 ${classId}`,
                status,
            };
        });

        return (
            <div className="space-y-6">
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-xs text-gray-500">학생 상세</p>
                            <h2 className="mt-1 text-2xl font-bold text-gray-900">{student.name || '이름 미상'}</h2>
                            <p className="mt-2 text-sm text-gray-600">
                                {student.school || '학교 정보 없음'} · {formatGradeLabel(student.grade) || '학년 정보 없음'}
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
                                {student.status || '상태 정보 없음'}
                            </span>
                            <button
                                type="button"
                                onClick={() => navigate('/students')}
                                className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-700"
                            >
                                <Icon name="arrow-left" className="h-4 w-4" />
                                학생 목록
                            </button>
                        </div>
                    </div>
                    <div className="mt-6 grid gap-4 lg:grid-cols-3">
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                            <p className="text-xs font-semibold text-gray-500">계정 정보</p>
                            <div className="mt-3 space-y-2 text-xs text-gray-600">
                                <p>문서 ID: <span className="font-medium text-gray-800">{student.id}</span></p>
                                <p>학생 authUid: <span className="font-medium text-gray-800">{studentAuthUid || '연결 없음'}</span></p>
                                <p>
                                    학부모 authUid: <span className="font-medium text-gray-800">
                                        {parentAuthUidLabel}
                                    </span>
                                </p>
                            </div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                            <p className="text-xs font-semibold text-gray-500">연락처</p>
                            <div className="mt-3 space-y-2 text-xs text-gray-600">
                                <p>학생 연락처: <span className="font-medium text-gray-800">{student.phone || '번호 없음'}</span></p>
                                <p>학부모 연락처: <span className="font-medium text-gray-800">{student.parentPhone || '번호 없음'}</span></p>
                                <p>학부모 이름: <span className="font-medium text-gray-800">{student.parentName || '정보 없음'}</span></p>
                            </div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                            <p className="text-xs font-semibold text-gray-500">수강 클래스</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {classBadges.length > 0 ? (
                                    classBadges.map((item) => (
                                        <span
                                            key={item.id}
                                            className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-600"
                                        >
                                            {item.name}
                                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-500">
                                                {item.status}
                                            </span>
                                        </span>
                                    ))
                                ) : (
                    <span className="text-xs text-gray-400">등록된 클래스가 없습니다.</span>
                )}
            </div>
        </div>
                    </div>
                </div>

                {!accountLinked && (
                    <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        아직 계정이 연결되지 않았습니다. 초대 가입을 완료하면 과제/성적/수업 기록을 확인할 수 있습니다.
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">출결 요약</h3>
                            <button
                                type="button"
                                onClick={() => navigate('/attendance')}
                                className="text-xs font-semibold text-indigo-600 hover:underline"
                            >
                                출결 관리
                            </button>
                        </div>
                        <div className="mt-4 space-y-3 text-sm text-gray-600">
                            {attendanceItems.length > 0 ? (
                                sortByDateDesc(attendanceItems, ['date', 'createdAt', 'updatedAt'])
                                    .slice(0, SUMMARY_LIMIT)
                                    .map((item) => {
                                        const dateValue = resolveValue(item, ['date', 'createdAt', 'updatedAt']);
                                        const className = resolveClassName(item);
                                        return (
                                            <div key={item.id} className="rounded-lg bg-gray-50 px-4 py-3">
                                                <p className="text-xs text-gray-500">{formatDate(dateValue)} · {className}</p>
                                                <p className="mt-1 text-sm font-semibold text-gray-800">{item.status || item.attendance || '상태 없음'}</p>
                                            </div>
                                        );
                                    })
                            ) : (
                                <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
                                    최근 출결 기록이 없습니다.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">과제 요약</h3>
                            <button
                                type="button"
                                onClick={() => navigate('/homework')}
                                className="text-xs font-semibold text-indigo-600 hover:underline"
                            >
                                과제 관리
                            </button>
                        </div>
                        <div className="mt-4 space-y-3 text-sm text-gray-600">
                            {homeworkItems.length > 0 ? (
                                sortByDateDesc(homeworkItems, ['checkedAt', 'updatedAt', 'submittedAt', 'completedAt', 'date', 'assignedDate', 'createdAt'])
                                    .slice(0, SUMMARY_LIMIT)
                                    .map((item) => {
                                        const dateValue = resolveValue(item, ['checkedAt', 'updatedAt', 'submittedAt', 'completedAt', 'date', 'assignedDate', 'createdAt']);
                                        const className = resolveClassName(item);
                                        const title = item.title || item.assignmentTitle || item.name || item.homeworkTitle || item.assignmentName || item.content || '과제명 없음';
                                        const status = item.status || item.state || (item.isComplete ? '완료' : null) || (item.completedAt ? '완료' : null)
                                            || (item.submittedAt ? '제출' : null) || '진행 중';
                                        const progressRate = Number.isFinite(item.progressRate)
                                            ? `${item.progressRate}%`
                                            : (Number.isFinite(item.progress) ? `${item.progress}%` : null);
                                        return (
                                            <div key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-semibold text-gray-800">{title}</p>
                                                    <span className="text-xs font-semibold text-gray-500">
                                                        {progressRate || status}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs text-gray-500">{formatDate(dateValue)} · {className}</p>
                                            </div>
                                        );
                                    })
                            ) : (
                                <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
                                    최근 과제 기록이 없습니다.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">시험/성적 요약</h3>
                            <button
                                type="button"
                                onClick={() => navigate('/grades')}
                                className="text-xs font-semibold text-indigo-600 hover:underline"
                            >
                                성적 관리
                            </button>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {gradeItems.length > 0 ? (
                                sortByDateDesc(gradeItems, ['date', 'updatedAt', 'createdAt'])
                                    .slice(0, SUMMARY_LIMIT)
                                    .map((item) => {
                                        const testId = item.testId || item.testDocId || item.test?.id;
                                        const test = testId ? testsById.get(String(testId)) : null;
                                        const testName = test?.name || item.testName || item.subject || '(시험명 없음)';
                                        const className = resolveClassName(item, test?.classId);
                                        const dateValue = resolveValue(item, ['date', 'updatedAt', 'createdAt']) || test?.date;
                                        const maxScore = Number.isFinite(test?.maxScore) ? test.maxScore : item.maxScore;
                                        const { scoreText } = formatGradeScoreText(item, item.totalScore ?? item.score ?? null, test || {});
                                        const classAverage = [item.classAverage, item.average, item.classAvg].find(Number.isFinite)
                                            ?? (Number.isFinite(test?.classAverage) ? test.classAverage : (Number.isFinite(test?.average) ? test.average : null));
                                        const classMax = [item.classMax, item.highestScore].find(Number.isFinite)
                                            ?? (Number.isFinite(test?.classMax) ? test.classMax : (Number.isFinite(test?.highestScore) ? test.highestScore : null));
                                        return (
                                            <div key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                                                <p className="text-sm font-semibold text-gray-800">{testName}</p>
                                                <p className="mt-1 text-xs text-gray-500">{formatDate(dateValue)} · {className}</p>
                                                <p className="mt-2 text-sm font-semibold text-indigo-600">
                                                    {scoreText === '미응시'
                                                        ? '미응시'
                                                        : (scoreText && maxScore
                                                            ? `${scoreText} / ${maxScore}점`
                                                            : (scoreText || '점수 정보 없음'))}
                                                </p>
                                                {(classAverage !== null || classMax !== null) && (
                                                    <p className="mt-1 text-xs text-gray-500">
                                                        {classAverage !== null && `반 평균 ${classAverage}점`}
                                                        {classAverage !== null && classMax !== null && ' · '}
                                                        {classMax !== null && `최고점 ${classMax}점`}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })
                            ) : (
                                <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
                                    최근 성적 기록이 없습니다.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">

                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">클리닉 기록 요약</h3>
                            <button
                                type="button"
                                onClick={() => navigate('/clinic')}
                                className="text-xs font-semibold text-indigo-600 hover:underline"
                            >
                                클리닉 관리
                            </button>
                        </div>
                        <div className="mt-4 space-y-3 text-sm text-gray-600">
                            {clinicItems.length > 0 ? (
                                sortByDateDesc(clinicItems, ['date', 'clinicDate', 'createdAt'])
                                    .slice(0, SUMMARY_LIMIT)
                                    .map((item) => {
                                        const dateValue = resolveValue(item, ['date', 'clinicDate', 'createdAt']);
                                        const className = resolveClassName(item);
                                        const comment = item.comment || item.note || item.memo || item.content || '';
                                        return (
                                            <div key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-semibold text-gray-800">{item.tutor || item.teacher || '담당자 미정'}</p>
                                                    <span className="text-xs font-semibold text-gray-500">{item.status || '상태 없음'}</span>
                                                </div>
                                                <p className="mt-1 text-xs text-gray-500">{formatDate(dateValue)} · {className}</p>
                                                {comment && (
                                                    <p className="mt-2 text-xs text-gray-600">{comment}</p>
                                                )}
                                            </div>
                                        );
                                    })
                            ) : (
                                <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
                                    최근 클리닉 기록이 없습니다.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {canManageStaffMemos && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-semibold text-gray-900">직원 메모 타임라인</h3>
                                <p className="mt-1 text-xs text-gray-500">직원 전용 메모는 학생/학부모에게 노출되지 않습니다.</p>
                            </div>
                        </div>
                        <div className="mt-4 space-y-3">
                            <textarea
                                value={memoDraft}
                                onChange={(event) => setMemoDraft(event.target.value)}
                                placeholder="학생 관련 내부 메모를 남겨주세요."
                                rows={4}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            />
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-rose-500">{memoError}</p>
                                <button
                                    type="button"
                                    onClick={handleSaveStaffMemo}
                                    disabled={memoSaving || !memoDraft.trim()}
                                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                                >
                                    {memoSaving ? '저장 중...' : '저장'}
                                </button>
                            </div>
                        </div>
                        <div className="mt-6 space-y-4">
                            {staffMemos.length > 0 ? (
                                staffMemos.map((item) => (
                                    <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold text-gray-700">{item.createdByName || '작성자 정보 없음'}</p>
                                            <div className="text-right text-xs text-gray-400">
                                                <p>{formatDateTime(item.createdAt)}</p>
                                                {item.editedAt && <p>수정 {formatDateTime(item.editedAt)}</p>}
                                            </div>
                                        </div>
                                        {editingMemoId === item.id ? (
                                            <div className="mt-3 space-y-2">
                                                <textarea
                                                    value={editingMemoDraft}
                                                    onChange={(event) => setEditingMemoDraft(event.target.value)}
                                                    rows={3}
                                                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                                                />
                                                <div className="flex items-center justify-end gap-2 text-xs font-semibold">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingMemoId(null);
                                                            setEditingMemoDraft('');
                                                        }}
                                                        className="rounded-lg border border-gray-200 px-3 py-1 text-gray-600"
                                                    >
                                                        취소
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={memoActionId === item.id || !editingMemoDraft.trim()}
                                                        onClick={async () => {
                                                            setMemoActionId(item.id);
                                                            setMemoError(null);
                                                            try {
                                                                await updateDoc(
                                                                    doc(db, COL.USERS, studentDocId, COL.STAFF_MEMOS, item.id),
                                                                    { content: editingMemoDraft.trim(), editedAt: serverTimestamp() },
                                                                );
                                                                setEditingMemoId(null);
                                                                setEditingMemoDraft('');
                                                            } catch (updateError) {
                                                                console.error('staff memo update error:', updateError);
                                                                setMemoError('직원 메모 수정에 실패했습니다.');
                                                            } finally {
                                                                setMemoActionId(null);
                                                            }
                                                        }}
                                                        className="rounded-lg bg-indigo-600 px-3 py-1 text-white disabled:cursor-not-allowed disabled:bg-indigo-300"
                                                    >
                                                        저장
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{item.content}</p>
                                                <div className="mt-3 flex items-center justify-end gap-2 text-xs font-semibold">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingMemoId(item.id);
                                                            setEditingMemoDraft(item.content || '');
                                                        }}
                                                        className="rounded-lg border border-gray-200 px-3 py-1 text-gray-600"
                                                    >
                                                        수정
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={memoActionId === item.id}
                                                        onClick={async () => {
                                                            if (!window.confirm('해당 메모를 삭제할까요?')) return;
                                                            setMemoActionId(item.id);
                                                            setMemoError(null);
                                                            try {
                                                                await deleteDoc(doc(db, COL.USERS, studentDocId, COL.STAFF_MEMOS, item.id));
                                                            } catch (deleteError) {
                                                                console.error('staff memo delete error:', deleteError);
                                                                setMemoError('직원 메모 삭제에 실패했습니다.');
                                                            } finally {
                                                                setMemoActionId(null);
                                                            }
                                                        }}
                                                        className="rounded-lg border border-gray-200 px-3 py-1 text-rose-600 disabled:cursor-not-allowed disabled:text-rose-300"
                                                    >
                                                        삭제
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
                                    아직 등록된 직원 메모가 없습니다.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return <div className="space-y-6">{renderStatus()}</div>;
}