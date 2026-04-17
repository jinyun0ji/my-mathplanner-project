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
import AccordionSection from '../components/common/AccordionSection';
import { Modal } from '../components/common/Modal';
import StaffMemoPreview from '../components/Student/StaffMemoPreview';
import { formatGradeLabel, Icon } from '../utils/helpers';
import { formatGradeScoreText } from '../domain/grade/grade.service';
import { getLinkedParentAuthUids } from '../utils/parentLinking';
import { getStudentKeyCandidates, isSameStudentByAnyKey } from '../utils/studentKey';

const COL = {
    USERS: 'users',
    ATTENDANCE: 'attendanceLogs',
    CLINIC: 'clinicLogs',
    GRADES: 'grades',
    HOMEWORK_RESULTS: 'homeworkResults',
    HOMEWORK_ASSIGNMENTS: 'homeworkAssignments',
    TESTS: 'tests',
    CLASSES: 'classes',
    STAFF_MEMOS: 'staffMemos',
};

const STAFF_MEMO_LIMIT = 100;

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

const mergeItemsById = (items) => {
    const merged = new Map();
    (items || []).flat().filter(Boolean).forEach((item) => {
        if (!item?.id) return;
        merged.set(String(item.id), item);
    });
    return Array.from(merged.values());
};

const fetchByFieldIn = async (collectionName, field, ids, limitCount = 200) => {
    if (!ids?.length) return [];
    const batches = [];
    for (let i = 0; i < ids.length; i += 10) {
        batches.push(ids.slice(i, i + 10));
    }
    const snapshots = await Promise.all(
        batches.map((chunk) =>
            getDocs(query(collection(db, collectionName), where(field, 'in', chunk), limit(limitCount))),
        ),
    );
    return snapshots.flatMap((snapshot) =>
        snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })),
    );
};

const fetchByClassIds = async (collectionName, ids, limitCount = 200) => {
    if (!ids?.length) return [];
    const [byClassId, byClassDocId] = await Promise.all([
        fetchByFieldIn(collectionName, 'classId', ids, limitCount),
        fetchByFieldIn(collectionName, 'classDocId', ids, limitCount),
    ]);
    return mergeItemsById([byClassId, byClassDocId]);
};

const getClassId = (record) => record?.classId || record?.classDocId || record?.class?.id || '';
const getActiveClassId = (studentData) => {
    if (!studentData) return '';
    const classIds = getStudentClassIds(studentData);
    if (classIds.length === 0) return '';
    const classStatusMap = studentData.classStatusMap || studentData.classStatuses || {};
    const preferredStatus = new Set(['진행중', '수강중', '진행']);
    const preferredId = classIds.find((classId) => preferredStatus.has(classStatusMap?.[classId]?.status));
    return preferredId || classIds[0];
};

export default function StudentDetail() {
    const { studentId: studentDocId } = useParams();
    const navigate = useNavigate();
    const { user, role, userProfile, profileDocId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [student, setStudent] = useState(null);
    const [attendances, setAttendances] = useState([]);
    const [homeworks, setHomeworks] = useState([]);
    const [homeworkAssignments, setHomeworkAssignments] = useState([]);
    const [grades, setGrades] = useState([]);
    const [clinicLogs, setClinicLogs] = useState([]);
    const [classes, setClasses] = useState([]);
    const [tests, setTests] = useState([]);
    const [lessonReports, setLessonReports] = useState([]);
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
    const [summaryScope, setSummaryScope] = useState('all');
    const [isStaffMemoModalOpen, setIsStaffMemoModalOpen] = useState(false);

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
            setHomeworkAssignments([]);
            setGrades([]);
            setClinicLogs([]);
            setClasses([]);
            setTests([]);
            setLessonReports([]);
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

                const lessonReportsPromise = fetchByFields(
                    'lessonReports',
                    [
                        { key: 'studentId', value: studentDocId },
                        { key: 'studentDocId', value: studentDocId },
                    ],
                    300,
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

                const [attendanceItems, clinicItems, homeworkItems, gradeItems, lessonReportItems] = await Promise.all([
                    attendancePromise,
                    clinicPromise,
                    homeworkPromise,
                    gradesPromise,
                    lessonReportsPromise,
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
                const classIdList = Array.from(classIds);
                const [classDocs, assignmentDocs] = await Promise.all([
                    fetchClassesByIds(classIdList),
                    fetchByClassIds(COL.HOMEWORK_ASSIGNMENTS, classIdList),
                ]);

                if (!isMounted) return;

                await parentsPromise;

                setAttendances(attendanceItems);
                setClinicLogs(clinicItems);
                setHomeworks(homeworkItems);
                setGrades(gradeItems);
                setTests(testDocs);
                setClasses(classDocs);
                setHomeworkAssignments(assignmentDocs);
                setLessonReports(
                    (lessonReportItems || [])
                        .filter((item) => item?.status === 'sent')
                        .sort((a, b) => {
                            const aDate = toSortableDate(a?.sentAt || a?.lessonDate || a?.updatedAt);
                            const bDate = toSortableDate(b?.sentAt || b?.lessonDate || b?.updatedAt);
                            if (!aDate && !bDate) return 0;
                            if (!aDate) return 1;
                            if (!bDate) return -1;
                            return bDate.getTime() - aDate.getTime();
                        }),
                );
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

    const selectedClassId = useMemo(() => getActiveClassId(student), [student]);

    const studentKeyCandidates = useMemo(() => getStudentKeyCandidates(student), [student]);

    const allClassIds = useMemo(() => {
        const ids = new Set();
        getStudentClassIds(student).forEach((id) => ids.add(String(id)));
        (Array.isArray(classes) ? classes : []).forEach((classItem) => {
            if (classItem?.id) ids.add(String(classItem.id));
            const studentList = classItem?.students || classItem?.studentIds || classItem?.studentUids || [];
            if (Array.isArray(studentList) && studentKeyCandidates.length > 0) {
                const studentSet = new Set(studentList.map((value) => String(value)));
                if (studentKeyCandidates.some((value) => studentSet.has(String(value)))) {
                    ids.add(String(classItem.id));
                }
            }
        });
        (Array.isArray(homeworkAssignments) ? homeworkAssignments : []).forEach((assignment) => {
            const classId = assignment?.classId || assignment?.classDocId;
            if (classId) ids.add(String(classId));
        });
        (Array.isArray(tests) ? tests : []).forEach((test) => {
            if (test?.classId) ids.add(String(test.classId));
        });
        return Array.from(ids);
    }, [student, classes, homeworkAssignments, tests, studentKeyCandidates]);

    const targetClassIds = useMemo(() => {
        if (summaryScope === 'all') return allClassIds;
        return allClassIds.includes(String(summaryScope)) ? [String(summaryScope)] : [];
    }, [summaryScope, allClassIds]);

    useEffect(() => {
        if (summaryScope !== 'all' && !allClassIds.includes(String(summaryScope))) {
            setSummaryScope('all');
        }
    }, [summaryScope, allClassIds]);

    const testsById = useMemo(
        () => new Map((Array.isArray(tests) ? tests : []).map((item) => [String(item.id), item])),
        [tests],
    );

    const sentLessonReports = useMemo(
        () => (Array.isArray(lessonReports) ? lessonReports : [])
            .filter((item) => item?.status === 'sent')
            .map((item) => ({
                ...item,
                className: classNameById.get(String(item?.classId || item?.classDocId || '')) || item?.className || item?.classId || '-',
            }))
            .sort((a, b) => {
                const aDate = toSortableDate(a?.sentAt || a?.lessonDate || a?.updatedAt);
                const bDate = toSortableDate(b?.sentAt || b?.lessonDate || b?.updatedAt);
                if (!aDate && !bDate) return 0;
                if (!aDate) return 1;
                if (!bDate) return -1;
                return bDate.getTime() - aDate.getTime();
            }),
        [classNameById, lessonReports],
    );

    const classTests = useMemo(() => {
        if (!targetClassIds.length) return [];
        return (Array.isArray(tests) ? tests : []).filter(
            (test) => targetClassIds.includes(String(test?.classId)),
        );
    }, [tests, targetClassIds]);

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

        const staffMemoCollection = collection(db, COL.STAFF_MEMOS, studentDocId, 'items');
        const memosQuery = query(
            staffMemoCollection,
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

    useEffect(() => {
        if (process.env.NODE_ENV === 'production') return;
        console.log('[StudentDetail] selectedStudent keys=', { id: student?.id, authUid: student?.authUid });
        console.log('[StudentDetail] selectedClassId=', selectedClassId);
        console.log('[StudentDetail] homeworkResults keys=', Array.isArray(homeworks) ? homeworks.length : Object.keys(homeworks || {}).length);
        console.log('[StudentDetail] grades top keys=', Array.isArray(grades) ? grades.length : Object.keys(grades || {}).length);
    }, [student, selectedClassId, homeworks, grades]);

    const handleSaveStaffMemo = async () => {
        const trimmed = memoDraft.trim();
        if (!trimmed || !studentDocId) return;
        setMemoSaving(true);
        setMemoError(null);

        try {
            const createdByName = userProfile?.displayName || user?.displayName || user?.email || '알 수 없음';
            await addDoc(collection(db, COL.STAFF_MEMOS, studentDocId, 'items'), {
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

    const targetClassIdSet = useMemo(() => new Set(targetClassIds.map((id) => String(id))), [targetClassIds]);

    const filteredAttendanceItems = useMemo(() => {
        const items = Array.isArray(attendances) ? attendances : [];
        if (targetClassIdSet.size === 0) return items;
        return items.filter((item) => {
            const classId = getClassId(item);
            return classId && targetClassIdSet.has(String(classId));
        });
    }, [attendances, targetClassIdSet]);

    const filteredClinicItems = useMemo(() => {
        const items = Array.isArray(clinicLogs) ? clinicLogs : [];
        if (targetClassIdSet.size === 0) return items;
        return items.filter((item) => {
            const classId = getClassId(item);
            return classId && targetClassIdSet.has(String(classId));
        });
    }, [clinicLogs, targetClassIdSet]);

    const classAssignments = useMemo(() => {
        if (!targetClassIdSet.size) return [];
        return (Array.isArray(homeworkAssignments) ? homeworkAssignments : []).filter((assignment) => {
            const classId = assignment?.classId || assignment?.classDocId;
            return classId && targetClassIdSet.has(String(classId));
        });
    }, [homeworkAssignments, targetClassIdSet]);

    const homeworkSummaryItems = useMemo(() => {
        if (!student) return [];
        const assignmentMap = new Map();
        classAssignments.forEach((assignment) => {
            const assignmentId = assignment?.id || assignment?.assignmentId || assignment?.homeworkAssignmentId;
            if (assignmentId) assignmentMap.set(String(assignmentId), assignment);
        });

        const resultsMap = new Map();
        const addResult = (record, fallbackKey) => {
            if (!record || typeof record !== 'object') return;
            const assignmentId = record.assignmentId || record.homeworkAssignmentId || record.id || fallbackKey;
            const classId = record.classId || record.classDocId || record.class?.id;
            if (targetClassIdSet.size > 0 && classId && !targetClassIdSet.has(String(classId))) return;
            const merged = assignmentId && assignmentMap.has(String(assignmentId))
                ? { ...assignmentMap.get(String(assignmentId)), ...record }
                : { ...record };
            const idValue = record.id || assignmentId || fallbackKey;
            if (idValue) {
                resultsMap.set(String(idValue), {
                    ...merged,
                    id: idValue,
                    assignmentId: assignmentId || merged.assignmentId || merged.homeworkAssignmentId,
                });
            }
        };
        if (Array.isArray(homeworks)) {
            homeworks.forEach((record) => {
                if (!isSameStudentByAnyKey(record, student)) return;
                addResult(record);
            });
        } else if (homeworks && typeof homeworks === 'object') {
            const studentResultsBuckets = [];
            Object.entries(homeworks || {}).forEach(([key, value]) => {
                if (isSameStudentByAnyKey({ studentId: key }, student)) studentResultsBuckets.push(value);
                if (value && typeof value === 'object') {
                    const sample = Object.values(value).find(Boolean);
                    if (sample && isSameStudentByAnyKey(sample, student)) studentResultsBuckets.push(value);
                }
            });
            studentResultsBuckets.forEach((bucket) => {
                if (!bucket) return;
                if (Array.isArray(bucket)) {
                    bucket.forEach((record) => addResult(record));
                } else if (typeof bucket === 'object') {
                    Object.entries(bucket).forEach(([key, record]) => addResult(record, key));
                }
            });
        }

        const resultAssignmentIds = new Set(
            Array.from(resultsMap.values())
                .map((item) => item.assignmentId)
                .filter(Boolean)
                .map((value) => String(value)),
        );

        classAssignments.forEach((assignment) => {
            const assignmentId = assignment?.id || assignment?.assignmentId || assignment?.homeworkAssignmentId;
            if (!assignmentId) return;
            if (!resultAssignmentIds.has(String(assignmentId))) {
                resultsMap.set(String(assignmentId), {
                    ...assignment,
                    assignmentId: String(assignmentId),
                    id: assignment.id || assignmentId,
                });
            }
        });

        return Array.from(resultsMap.values());
    }, [student, homeworks, classAssignments, targetClassIdSet]);

    const gradeSummaryItems = useMemo(() => {
        if (!student) return [];
        const collected = [];
        const classTestIdSet = new Set(classTests.map((test) => String(test.id)));
        const pushIfMatch = (record, testIdOverride, skipStudentCheck = false) => {
            if (!record || typeof record !== 'object') return;
            if (!skipStudentCheck && !isSameStudentByAnyKey(record, student)) return;
            const testId = testIdOverride || record?.testId || record?.testDocId || record?.test?.id;
            if (testId && classTestIdSet.size > 0 && !classTestIdSet.has(String(testId))) return;
            if (!testId) {
                const classId = record?.classId || record?.classDocId || record?.class?.id;
                if (targetClassIdSet.size > 0 && classId && !targetClassIdSet.has(String(classId))) return;
            }
            collected.push({ ...record, testId: testId || record?.testId || record?.testDocId });
        };

        if (Array.isArray(grades)) {
            grades.forEach((record) => pushIfMatch(record));
            return collected;
        }

        if (grades && typeof grades === 'object') {
            Object.entries(grades || {}).forEach(([key, byTest]) => {
                if (!byTest || typeof byTest !== 'object') return;
                if (isSameStudentByAnyKey({ studentId: key }, student)) {
                    Object.entries(byTest).forEach(([testId, row]) => {
                        pushIfMatch({ ...(row || {}), testId }, testId, true);
                    });
                    return;
                }
                const sample = Object.values(byTest).find(Boolean);
                if (sample && isSameStudentByAnyKey(sample, student)) {
                    Object.entries(byTest).forEach(([testId, row]) => {
                        pushIfMatch({ ...(row || {}), testId }, testId, true);
                    });
                }
            });
        }
        return collected;
    }, [grades, student, classTests, targetClassIdSet]);

    useEffect(() => {
        if (!student) return;
        if (homeworkSummaryItems.length === 0) {
            console.warn('[StudentDetail][summary] empty', {
                summaryScope,
                targetClassIds,
                studentKeys: getStudentKeyCandidates(student),
                hwAssignments: classAssignments.length,
                tests: classTests.length,
            });
        }
    }, [student, summaryScope, targetClassIds, homeworkSummaryItems, classAssignments.length, classTests.length]);

    useEffect(() => {
        if (!student) return;
        if (gradeSummaryItems.length === 0) {
            console.warn('[StudentDetail][summary] empty', {
                summaryScope,
                targetClassIds,
                studentKeys: getStudentKeyCandidates(student),
                hwAssignments: classAssignments.length,
                tests: classTests.length,
            });
        }
    }, [student, summaryScope, targetClassIds, gradeSummaryItems, classAssignments.length, classTests.length]);

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

        const attendanceItems = filteredAttendanceItems;
        const homeworkItems = homeworkSummaryItems;
        const gradeItems = gradeSummaryItems;
        const clinicItems = filteredClinicItems;
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
        const currentClassName = selectedClassId
            ? (classNameById.get(String(selectedClassId)) || `클래스 ${selectedClassId}`)
            : '정보 없음';

        const kpiCards = [
            { label: '출결', value: attendanceItems.length, accent: 'text-indigo-600' },
            { label: '클리닉', value: clinicItems.length, accent: 'text-emerald-600' },
            { label: '과제', value: homeworkItems.length, accent: 'text-amber-600' },
            { label: '시험', value: gradeItems.length, accent: 'text-rose-600' },
        ];

        const renderSummaryList = (items, renderItem, emptyLabel, maxCount, sortKeys = ['date', 'createdAt', 'updatedAt']) => (
            items.length > 0
                ? sortByDateDesc(items, sortKeys)
                    .slice(0, maxCount)
                    .map(renderItem)
                : (
                    <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
                        {emptyLabel}
                    </p>
                )
        );

        const memoForm = (
            <div className="space-y-3">
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
        );

        const memoTimeline = (
            <div className="space-y-4">
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
                                                        doc(db, COL.STAFF_MEMOS, studentDocId, 'items', item.id),
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
                                                    await deleteDoc(doc(db, COL.STAFF_MEMOS, studentDocId, 'items', item.id));
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
        );

        const attendanceLink = (
            <button
                type="button"
                onClick={() => navigate('/attendance')}
                className="text-xs font-semibold text-indigo-600 hover:underline"
            >
                출결 관리
            </button>
        );

        const clinicLink = (
            <button
                type="button"
                onClick={() => navigate('/clinic')}
                className="text-xs font-semibold text-indigo-600 hover:underline"
            >
                클리닉 관리
            </button>
        );

        const homeworkLink = (
            <button
                type="button"
                onClick={() => navigate('/homework')}
                className="text-xs font-semibold text-indigo-600 hover:underline"
            >
                과제 관리
            </button>
        );

        const gradeLink = (
            <button
                type="button"
                onClick={() => navigate('/grades')}
                className="text-xs font-semibold text-indigo-600 hover:underline"
            >
                성적 관리
            </button>
        );

        const attendanceContent = (
            <div className="space-y-3 text-sm text-gray-600">
                {renderSummaryList(
                    attendanceItems,
                    (item) => {
                        const dateValue = resolveValue(item, ['date', 'createdAt', 'updatedAt']);
                        const className = resolveClassName(item);
                        return (
                            <div key={item.id} className="rounded-lg bg-gray-50 px-4 py-3">
                                <p className="text-xs text-gray-500">{formatDate(dateValue)} · {className}</p>
                                <p className="mt-1 text-sm font-semibold text-gray-800">{item.status || item.attendance || '상태 없음'}</p>
                            </div>
                        );
                    },
                    '최근 출결 기록이 없습니다.',
                    5,
                    ['date', 'createdAt', 'updatedAt'],
                )}
            </div>
        );

        const clinicContent = (
            <div className="space-y-3 text-sm text-gray-600">
                {renderSummaryList(
                    clinicItems,
                    (item) => {
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
                    },
                    '최근 클리닉 기록이 없습니다.',
                    5,
                    ['date', 'clinicDate', 'createdAt'],
                )}
            </div>
        );

        const homeworkContent = (
            <div className="space-y-3 text-sm text-gray-600">
                {renderSummaryList(
                    homeworkItems,
                    (item) => {
                        const dateValue = resolveValue(item, [
                            'checkedAt',
                            'updatedAt',
                            'submittedAt',
                            'completedAt',
                            'date',
                            'assignedDate',
                            'createdAt',
                        ]);
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
                    },
                    '데이터 없음',
                    3,
                    ['checkedAt', 'updatedAt', 'submittedAt', 'completedAt', 'date', 'assignedDate', 'createdAt'],
                )}
            </div>
        );

        const gradeContent = (
            <div className="grid gap-3 md:grid-cols-2">
                {gradeItems.length > 0 ? (
                    sortByDateDesc(gradeItems, ['date', 'updatedAt', 'createdAt'])
                        .slice(0, 3)
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
                        데이터 없음
                    </p>
                )}
            </div>
        );

        return (
            <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[420px,1fr]">
                    <aside className="space-y-4">
                        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs text-gray-500">학생 상세</p>
                                    <h2 className="mt-1 text-2xl font-bold text-gray-900">{student.name || '이름 미상'}</h2>
                                    <p className="mt-2 text-sm text-gray-600">
                                        {student.school || '학교 정보 없음'} · {formatGradeLabel(student.grade) || '학년 정보 없음'}
                                    </p>
                                    <p className="mt-2 text-xs font-semibold text-gray-500">
                                        현재 반: <span className="text-gray-700">{currentClassName}</span>
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
                                    <button
                                        type="button"
                                        onClick={() => document.getElementById('student-sent-lesson-reports')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                        className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                                    >
                                        <Icon name="clipboardCheck" className="h-4 w-4" />
                                        수업 리포트 보기
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
                            <div id="student-sent-lesson-reports" className="mt-6 rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-gray-700">수업 리포트 보기 (발송본)</p>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/lesson-reports?studentId=${student.id}`)}
                                        className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                                    >
                                        관리 화면으로 이동
                                    </button>
                                </div>
                                <div className="mt-3 space-y-2">
                                    {sentLessonReports.slice(0, 5).map((report) => (
                                        <details key={report.id} className="rounded-lg border border-gray-200 bg-white p-3">
                                            <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                                                {formatDate(report?.lessonDate)} · {report.className}
                                            </summary>
                                            <div className="mt-2 space-y-1 text-xs text-gray-600">
                                                {report.learnedTopics && <p>진도: {report.learnedTopics}</p>}
                                                {report.attendanceStatus && <p>출결: {report.attendanceStatus}</p>}
                                                {Array.isArray(report?.homeworkSummary?.text) && report.homeworkSummary.text.length > 0 && (
                                                    <p>과제 수행: {report.homeworkSummary.text.join(' · ')}</p>
                                                )}
                                                {Array.isArray(report?.testSummary?.text) && report.testSummary.text.length > 0 && (
                                                    <p>시험: {report.testSummary.text.join(' · ')}</p>
                                                )}
                                                {report.comment && <p className="text-indigo-700">코멘트: {report.comment}</p>}
                                                <p className="text-[11px] text-gray-400">발송 시각: {formatDateTime(report?.sentAt || report?.updatedAt)}</p>
                                            </div>
                                        </details>
                                    ))}
                                    {sentLessonReports.length === 0 && (
                                        <p className="text-xs text-gray-500">해당 학생에게 발송된 수업 리포트가 없습니다.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {canManageStaffMemos && (
                            <>
                                <div className="lg:hidden">
                                    <AccordionSection title="직원 메모" defaultOpen>
                                        <div className="space-y-4">
                                            {memoForm}
                                            <StaffMemoPreview
                                                memos={staffMemos}
                                                onOpenAll={() => setIsStaffMemoModalOpen(true)}
                                            />
                                        </div>
                                    </AccordionSection>
                                </div>
                                <div className="hidden lg:block">
                                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                                        <div>
                                            <h3 className="text-base font-semibold text-gray-900">직원 메모</h3>
                                            <p className="mt-1 text-xs text-gray-500">직원 전용 메모는 학생/학부모에게 노출되지 않습니다.</p>
                                        </div>
                                        <div className="mt-4 space-y-4">
                                            {memoForm}
                                            <div className="max-h-[40vh] overflow-y-auto pr-2">
                                                <StaffMemoPreview
                                                    memos={staffMemos}
                                                    onOpenAll={() => setIsStaffMemoModalOpen(true)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </aside>

                    <main className="space-y-4">
                        <div className="space-y-3">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    {kpiCards.map((card) => (
                                        <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                            <p className="text-xs font-semibold text-gray-500">{card.label}</p>
                                            <p className={`mt-2 text-2xl font-bold ${card.accent}`}>{card.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm">
                                    <span>요약 범위</span>
                                    <select
                                        value={summaryScope}
                                        onChange={(event) => setSummaryScope(event.target.value)}
                                        className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
                                        disabled={allClassIds.length === 0}
                                    >
                                        <option value="all">전체 반</option>
                                        {allClassIds.map((classId) => (
                                            <option key={classId} value={classId}>
                                                {classNameById.get(String(classId)) || `클래스 ${classId}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                {!accountLinked && (
                    <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        아직 계정이 연결되지 않았습니다. 초대 가입을 완료하면 과제/성적/수업 기록을 확인할 수 있습니다.
                    </div>
                )}

                <div className="hidden lg:grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">출결 요약</h3>
                            {attendanceLink}
                        </div>
                        <div className="mt-4">{attendanceContent}</div>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">클리닉 요약</h3>
                            {clinicLink}
                        </div>
                        <div className="mt-4">{clinicContent}</div>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">과제 요약</h3>
                            {homeworkLink}
                        </div>
                        <div className="mt-4">{homeworkContent}</div>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">시험/성적 요약</h3>
                            {gradeLink}
                        </div>
                        <div className="mt-4">{gradeContent}</div>
                    </div>
                </div>
                        
                <div className="space-y-3 lg:hidden">
                    <AccordionSection title="출결 요약">
                        <div className="flex justify-end">{attendanceLink}</div>
                        <div className="mt-3">{attendanceContent}</div>
                    </AccordionSection>
                    <AccordionSection title="클리닉 요약">
                        <div className="flex justify-end">{clinicLink}</div>
                        <div className="mt-3">{clinicContent}</div>
                    </AccordionSection>
                    <AccordionSection title="과제 요약">
                        <div className="flex justify-end">{homeworkLink}</div>
                        <div className="mt-3">{homeworkContent}</div>
                    </AccordionSection>
                    <AccordionSection title="시험/성적 요약">
                        <div className="flex justify-end">{gradeLink}</div>
                        <div className="mt-3">{gradeContent}</div>
                    </AccordionSection>
                </div>
            </main>
        </div>

        {canManageStaffMemos && (
            <Modal
                isOpen={isStaffMemoModalOpen}
                onClose={() => setIsStaffMemoModalOpen(false)}
                title="직원 메모 타임라인"
            >
                <div className="space-y-6">
                    {memoForm}
                    {memoTimeline}
                </div>
            </Modal>
        )}
        </div>
        );
    };

    return <div className="space-y-6">{renderStatus()}</div>;
}