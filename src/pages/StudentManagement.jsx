// src/pages/StudentManagement.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { doc, serverTimestamp, setDoc, Timestamp, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { Icon } from '../utils/helpers';
import { StudentFormModal } from '../utils/modals/StudentFormModal';
import { MemoModal } from '../utils/modals/MemoModal';
import { Modal } from '../components/common/Modal'; 
import { db } from '../firebase/client';
import { getLinkedParentAuthUids } from '../utils/parentLinking';

const RETIRE_REASONS = ['중도퇴원', '전반'];

export default function StudentManagement({
    students, parents = [], classes, handleSaveStudent, handleDeleteStudent,
    attendanceLogs, studentMemos, handleSaveMemo, handlePageChange,
    studentSearchTerm, setStudentSearchTerm,
    externalSchedules,
    pendingQuickAction,
    clearPendingQuickAction,
    handleUpdateStudentClassStatus
}) {
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [studentToEdit, setStudentToEdit] = useState(null);
    const [memoModalState, setMemoModalState] = useState({ isOpen: false, studentId: null, content: '', studentName: '' });
    
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [selectedStudentSchedule, setSelectedStudentSchedule] = useState({ name: '', schedules: [] });
    const [retireModal, setRetireModal] = useState({ isOpen: false, student: null, classId: null });
    const [retireDate, setRetireDate] = useState(new Date().toISOString().slice(0, 10));
    const [retireReason, setRetireReason] = useState('중도퇴원');
    const [selectedClassId, setSelectedClassId] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const todayString = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const debugLoggedRef = useRef(false);
    const normalizeClassStatus = (value) => {
        if (value === 'withdrawn') return '퇴원';
        if (value === 'active') return '진행중';
        if (value === '재원') return '진행중';
        return value;
    };
    const isWithdrawnStatus = (value) => ['퇴원', '전반', '종강'].includes(normalizeClassStatus(value));
    const isInactiveStatus = (value) => Boolean(value) && value !== '재원생';
    const isActiveStatus = (value) => value === '재원생';
    const getStatusLabel = (value) => value || '상태 미정';
    const parseDateValue = (value) => {
        if (!value) return null;
        if (typeof value?.toDate === 'function') return value.toDate();
        if (value instanceof Date) return value;
        const asDate = new Date(value);
        return Number.isNaN(asDate.getTime()) ? null : asDate;
    };
    const formatDate = (date) => {
        if (!date) return '-';
        return date.toISOString().slice(0, 10);
    };
    const getClassStatusMap = (student) => {
        if (!student) return {};
        return student.classStatusMap || student.classStatuses || {};
    };
    const getWithdrawDate = (student) => {
        const directDate = parseDateValue(student?.withdrawnAt);
        if (directDate) return directDate;
        const map = getClassStatusMap(student);
        if (!map || typeof map !== 'object') return null;
        const endedDates = Object.values(map)
            .filter((entry) => isWithdrawnStatus(entry?.status))
            .map((entry) => parseDateValue(entry?.endedAt || entry?.endDate))
            .filter(Boolean);
        if (endedDates.length === 0) return null;
        endedDates.sort((a, b) => b - a);
        return endedDates[0];
    };

    const shortId = (value) => {
        if (!value) return '-';
        const str = String(value);
        if (str.length <= 14) return str;
        return `${str.slice(0, 6)}…${str.slice(-4)}`;
    };

    const copyToClipboard = async (text) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
        } catch (error) {
            console.error('copy failed', error);
        }
    };

    useEffect(() => {
        if (pendingQuickAction?.page === 'students' && pendingQuickAction.action === 'openStudentModal') {
            setStudentToEdit(null);
            setIsStudentModalOpen(true);
            clearPendingQuickAction?.();
        }
    }, [pendingQuickAction, clearPendingQuickAction]);

    useEffect(() => {
        if (debugLoggedRef.current) return;
        if (!parents?.length && !students?.length) return;
        debugLoggedRef.current = true;
        console.log('[staff] parents count=', parents?.length, 'sample=', parents?.slice(0, 3));
        console.log('[staff] student id sample=', students?.[0]?.id);
        if (students?.[0]?.id) {
            console.log(
                '[staff] matched parents for first student=',
                getLinkedParentAuthUids(students[0], parents),
            );
        }
    }, [parents, students]);

    const normalizedStudents = useMemo(() => Array.isArray(students) ? students : [], [students]);

    const classOptions = useMemo(() => {
        return (Array.isArray(classes) ? classes : []).filter((item) => item?.id && item?.name);
    }, [classes]);

    const statusOptions = useMemo(() => {
        const options = new Set(
            normalizedStudents
                .map((student) => student?.status)
                .filter((status) => Boolean(status)),
        );
        return Array.from(options);
    }, [normalizedStudents]);

    const filteredStudents = useMemo(() => {
        const term = String(studentSearchTerm || '').trim().toLowerCase();

        const byClass = (student) => {
            if (selectedClassId === 'all') return true;
            const ids = Array.isArray(student.classIds)
                ? student.classIds
                : (Array.isArray(student.classes) ? student.classes : []);
            return ids.map((id) => String(id)).includes(String(selectedClassId));
        };

        const byStatus = (student) => {
            if (selectedStatus === 'all') return true;
            return String(student.status || '') === selectedStatus;
        };

        const bySearch = (student) => {
            if (!term) return true;
            const name = String(student.name || '').toLowerCase();
            const phone = String(student.phone || '').toLowerCase();
            const parentName = String(student.parentName || '').toLowerCase();
            return name.includes(term) || phone.includes(term) || parentName.includes(term);
        };

        const list = normalizedStudents
            .filter(byClass)
            .filter(byStatus)
            .filter(bySearch);

        const hasClass = (student) => Array.isArray(student.classIds)
            ? student.classIds.length > 0
            : (Array.isArray(student.classes) ? student.classes.length > 0 : false);

        list.sort((a, b) => {
            const aHas = hasClass(a);
            const bHas = hasClass(b);
            if (aHas !== bHas) return aHas ? -1 : 1;
            return String(a?.name || '').localeCompare(String(b?.name || ''), 'ko');
        });
    return list;
    }, [normalizedStudents, studentSearchTerm, selectedClassId, selectedStatus]);

    const handleEdit = (student) => { setStudentToEdit(student); setIsStudentModalOpen(true); };
    const handleNewStudent = () => { setStudentToEdit(null); setIsStudentModalOpen(true); };
    const openMemoModal = (student) => { setMemoModalState({ isOpen: true, studentId: student.id, content: studentMemos[student.id] || '', studentName: student.name }); };
    const closeMemoModal = () => { setMemoModalState({ isOpen: false, studentId: null, content: '', studentName: '' }); };

    const openScheduleModal = (student) => {
        const schedules = externalSchedules ? externalSchedules.filter(s => s.studentId === student.id) : [];
        setSelectedStudentSchedule({ name: student.name, schedules });
        setScheduleModalOpen(true);
    };

    const handleWithdrawClick = (student, classId) => {
        setRetireModal({ isOpen: true, student, classId });
        setRetireDate(todayString);
        setRetireReason('중도퇴원');
    };

    const handleRestoreClick = (student, classId) => {
        if (!handleUpdateStudentClassStatus) return;
        handleUpdateStudentClassStatus({ studentId: student.id, classId, status: '재원' });
    };

    const retireStudentOnlyUpdate = async (student, { classId, endDate, endReason }) => {
        if (!student?.id) throw new Error('retireStudentOnlyUpdate: missing student.id');
        if (!classId) throw new Error('retireStudentOnlyUpdate: missing classId');

        const safeReason = RETIRE_REASONS.includes(endReason) ? endReason : '중도퇴원';
        const nextStatus = safeReason === '전반' ? '전반' : '퇴원';
        const safeDate = endDate || new Date().toISOString().slice(0, 10);

        const resolvedEndedAt = safeDate ? Timestamp.fromDate(new Date(safeDate)) : serverTimestamp();
        await setDoc(doc(db, 'users', student.id), {
            classStatusMap: {
                [classId]: {
                    status: nextStatus,
                    endedAt: resolvedEndedAt,
                    endReason: safeReason,
                },
            },
            updatedAt: serverTimestamp(),
        }, { merge: true });
    };

    const handleRetireSave = async () => {
        const { student, classId } = retireModal;
        if (!student || !classId) return;

        try {
            const safeDate = retireDate;
            const safeReason = retireReason; // '중도퇴원' | '전반'

            await setDoc(
                doc(db, 'users', student.id),
                {
                    classStatusMap: {
                        [classId]: {
                            status: safeReason === '전반' ? '전반' : '퇴원',
                            endedAt: Timestamp.fromDate(new Date(safeDate)),
                            endReason: safeReason,
                        },
                    },
                    updatedAt: serverTimestamp(),
                },
                { merge: true },
            );

            if (safeReason === '전반') {
                await updateDoc(doc(db, 'classes', classId), {
                    students: arrayRemove(student.id),
                });

                const nextClassIds = Array.isArray(student.classIds)
                    ? student.classIds
                    : (Array.isArray(student.classes) ? student.classes : []);
                const transferTargets = nextClassIds.filter((id) => String(id) !== String(classId));
                if (transferTargets.length > 0) {
                    await Promise.all(
                        transferTargets.map((targetId) => updateDoc(doc(db, 'classes', targetId), {
                            students: arrayUnion(student.id),
                        })),
                    );
                }
            }

            setRetireModal({ isOpen: false, student: null, classId: null });
        } catch (error) {
            console.error('전반/퇴원 처리 실패', error);
            alert('저장 중 오류가 발생했습니다.');
        }
    };

    const closeRetireModal = () => {
        setRetireModal({ isOpen: false, student: null, classId: null });
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-4">
                    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <label className="text-xs font-semibold text-gray-600">
                            클래스
                            <select
                                value={selectedClassId}
                                onChange={(e) => setSelectedClassId(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            >
                                <option value="all">전체</option>
                                {classOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="text-xs font-semibold text-gray-600">
                            상태
                            <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            >
                                <option value="all">전체</option>
                                {statusOptions.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="text-xs font-semibold text-gray-600 sm:col-span-2">
                            검색
                            <div className="mt-1 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus-within:border-indigo-900 focus-within:ring-2 focus-within:ring-indigo-200">
                                <Icon name="search" className="w-4 h-4 text-gray-400"/>
                                <input
                                    type="text"
                                    placeholder="이름, 연락처, 보호자 이름"
                                    value={studentSearchTerm}
                                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                                    className="w-full border-0 p-0 focus:outline-none focus:ring-0"
                                />
                            </div>
                        </label>
                    </div>
                    <div className="flex w-full justify-end lg:w-auto">
                        <button 
                            onClick={handleNewStudent}
                            className="w-full lg:w-auto justify-center bg-indigo-900 hover:bg-indigo-800 text-white font-bold py-2 px-4 rounded-lg flex items-center shadow-md transition duration-150 text-sm"
                        >
                            <Icon name="plus" className="w-5 h-5 mr-2" />
                            새 학생 등록
                        </button>
                    </div>
                </div>
                
                <div className="overflow-x-auto rounded-lg border border-gray-200 hidden md:block">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                {['이름', '문서ID', 'Auth UID', '학교', '학년', '상태', '퇴원일', '연락처 (학생/학부모)', '등록일', '관리'].map(header => (
                                    <th key={header} className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredStudents.map(student => {
                                // ✅ [추가] 해당 학생의 타학원 스케줄 존재 여부 확인
                                const hasExternal = externalSchedules?.some(s => s.studentId === student.id);
                                const parentAuthUids = getLinkedParentAuthUids(student, parents);

                                const classStatusMap = getClassStatusMap(student);
                                const allClassIds = Array.isArray(student.classes)
                                    ? student.classes
                                    : (Array.isArray(student.classIds) ? student.classIds : []);
                                const activeClassIds = allClassIds.filter((classId) => !isWithdrawnStatus(classStatusMap[classId]?.status));
                                const withdrawnClassIds = Object.entries(classStatusMap)
                                    .filter(([, value]) => isWithdrawnStatus(value?.status))
                                    .map(([id]) => id);
                                const getClassName = (classId) => classes.find((cls) => String(cls.id) === String(classId))?.name || classId;
                                const withdrawDate = getWithdrawDate(student);
                                
                                return (
                                    <tr key={student.id} className="hover:bg-indigo-50 cursor-pointer transition duration-100" onClick={() => handlePageChange('students', student.id)}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                            <div className="flex items-center gap-2">
                                                <span>{student.name}</span>
                                                {student.hasAccount && (
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                                        계정 연결
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">
                                            {student.id ? (
                                                <button
                                                    type="button"
                                                    className="hover:underline"
                                                    title={student.id}
                                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(student.id); }}
                                                >
                                                    {shortId(student.id)}
                                                </button>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-gray-700">
                                                    학생: {student.authUid ? (
                                                        <button
                                                            type="button"
                                                            className="hover:underline"
                                                            title={student.authUid}
                                                            onClick={(e) => { e.stopPropagation(); copyToClipboard(student.authUid); }}
                                                        >
                                                            {shortId(student.authUid)}
                                                        </button>
                                                    ) : '-'}
                                                </span>
                                                <span className="text-gray-500">
                                                    학부모: {parentAuthUids.length > 0 ? parentAuthUids.join(', ') : '-'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{student.school}</td>
                                        {/* 학년 표시 수정 */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{student.grade}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            <div className="flex flex-wrap gap-2">
                                                {activeClassIds.length > 0 ? activeClassIds.map((classId) => (
                                                    <div key={classId} className="flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">
                                                        <span>{getClassName(classId)}</span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleWithdrawClick(student, classId); }}
                                                            className="text-[10px] text-indigo-700 hover:text-indigo-900"
                                                        >
                                                            퇴원 처리
                                                        </button>
                                                    </div>
                                                )) : <span className="text-xs text-gray-400">수강 정보 없음</span>}
                                            </div>
                                            {withdrawnClassIds.length > 0 && (
                                            <div className="mt-2 text-xs text-gray-500 space-y-1">
                                                <p className="font-semibold text-gray-600">종료된 클래스</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {withdrawnClassIds.map((classId) => (
                                                            <div key={classId} className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                                                                <span>{getClassName(classId)}</span>
                                                                <span className="text-[10px] font-semibold text-gray-500">수강 종료</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); handleRestoreClick(student, classId); }}
                                                                    className="text-[10px] text-indigo-600 hover:text-indigo-800"
                                                                >
                                                                    복원
                                                                </button>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {withdrawDate ? formatDate(withdrawDate) : '-'}
                                    </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm"><div className="flex flex-col"><span className="text-gray-900 font-medium">{student.phone}</span><span className="text-gray-400 text-xs">부모: {student.parentPhone}</span></div></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.registeredDate}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex space-x-2">
                                                {/* ✅ [수정] 타학원 버튼: 데이터 있으면 녹색/인디고, 없으면 회색 */}
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => {e.stopPropagation(); openScheduleModal(student);}}
                                                    className={`p-1 rounded-full transition-colors ${
                                                        hasExternal 
                                                            ? 'text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 ring-1 ring-indigo-200' 
                                                            : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                                                    }`}
                                                    title={hasExternal ? "타학원 시간표 보기" : "타학원 시간표 없음"}
                                                >
                                                    <Icon name="calendar" className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => {e.stopPropagation(); openMemoModal(student);}}
                                                    className="text-gray-400 hover:text-yellow-600 p-1 rounded-full hover:bg-yellow-50 transition-colors"
                                                    title="메모"
                                                >
                                                    <Icon name="fileText" className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => {e.stopPropagation(); handleEdit(student);}}
                                                    className="text-gray-400 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-50 transition-colors"
                                                    title="수정"
                                                >
                                                    <Icon name="edit" className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => {e.stopPropagation(); if(window.confirm(`${student.name} 학생을 정말 삭제하시겠습니까?`)) handleDeleteStudent(student.id);}}
                                                    className="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
                                                    title="삭제"
                                                >
                                                    <Icon name="trash" className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* ✅ 모바일 카드 뷰 */}
                <div className="grid gap-3 md:hidden">
                    {filteredStudents.map(student => {
                        const hasExternal = externalSchedules?.some(s => s.studentId === student.id);
                        const parentAuthUids = getLinkedParentAuthUids(student, parents);
                        const classStatusMap = student.classStatuses || {};
                        const allClassIds = Array.isArray(student.classes)
                            ? student.classes
                            : (Array.isArray(student.classIds) ? student.classIds : []);
                            const activeClassIds = allClassIds.filter((classId) => !isWithdrawnStatus(classStatusMap[classId]?.status));
                        const withdrawnClassIds = Object.entries(classStatusMap)
                            .filter(([, value]) => isWithdrawnStatus(value?.status))
                            .map(([id]) => id);
                        const getClassName = (classId) => classes.find((cls) => String(cls.id) === String(classId))?.name || classId;
                        const withdrawDate = getWithdrawDate(student);
                        return (
                            <div 
                                key={student.id}
                                onClick={() => handlePageChange('students', student.id)}
                                className="border border-gray-200 rounded-xl p-4 shadow-sm bg-white active:scale-[0.99] transition"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-base font-bold text-gray-900">{student.name}</span>
                                            {student.hasAccount && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                                    계정 연결
                                                </span>
                                            )}
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isInactiveStatus(student.status) ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700 ring-1 ring-green-100'}`}>
                                                {getStatusLabel(student.status)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">{student.school} • {student.grade}</p>
                                        <div className="mt-2 space-y-1">
                                            <div className="flex flex-wrap gap-2 text-sm text-gray-700 leading-snug">
                                                {activeClassIds.length > 0 ? activeClassIds.map((classId) => (
                                                    <span key={classId} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">
                                                        {getClassName(classId)}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleWithdrawClick(student, classId); }}
                                                            className="text-[10px] text-indigo-700"
                                                        >
                                                            퇴원 처리
                                                        </button>
                                                    </span>
                                                )) : <span className="text-xs text-gray-400">수강 정보 없음</span>}
                                            </div>
                                            {withdrawnClassIds.length > 0 && (
                                                <div className="text-[11px] text-gray-500">
                                                    <p className="font-semibold text-gray-600">종료된 클래스</p>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        {withdrawnClassIds.map((classId) => (
                                                            <span key={classId} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                                                                {getClassName(classId)}
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); handleRestoreClick(student, classId); }}
                                                                    className="text-[10px] text-indigo-600"
                                                                >
                                                                    복원
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-2 space-y-1 text-xs text-gray-500">
                                            <p className="font-medium text-gray-700">학생: {student.phone}</p>
                                            <p>학부모: {student.parentPhone}</p>
                                            <p>퇴원일 {withdrawDate ? formatDate(withdrawDate) : '-'}</p>
                                            <p className="text-gray-400">등록일 {student.registeredDate}</p>
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                <div className="flex items-center gap-1 text-[11px] text-gray-600">
                                                    <span className="font-semibold">문서ID</span>
                                                    {student.id ? (
                                                        <button
                                                            type="button"
                                                            className="hover:underline"
                                                            title={student.id}
                                                            onClick={(e) => { e.stopPropagation(); copyToClipboard(student.id); }}
                                                        >
                                                            {shortId(student.id)}
                                                        </button>
                                                    ) : '-'}
                                                </div>
                                                <div className="flex items-center gap-1 text-[11px] text-gray-600">
                                                    <span className="font-semibold">Auth UID</span>
                                                    <div className="flex flex-col gap-0.5">
                                                        <span>
                                                            학생: {student.authUid ? (
                                                                <button
                                                                    type="button"
                                                                    className="hover:underline"
                                                                    title={student.authUid}
                                                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(student.authUid); }}
                                                                >
                                                                    {shortId(student.authUid)}
                                                                </button>
                                                            ) : '-'}
                                                        </span>
                                                        <span className="text-gray-500">
                                                            학부모: {parentAuthUids.length > 0 ? parentAuthUids.join(', ') : '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button 
                                            type="button" 
                                            onClick={(e) => {e.stopPropagation(); openScheduleModal(student);}}
                                            className={`p-2 rounded-lg transition-colors ${
                                                hasExternal 
                                                    ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 ring-1 ring-indigo-100' 
                                                    : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                                            }`}
                                            title={hasExternal ? "타학원 시간표 보기" : "타학원 시간표 없음"}
                                        >
                                            <Icon name="calendar" className="w-5 h-5" />
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={(e) => {e.stopPropagation(); openMemoModal(student);}}
                                            className="p-2 rounded-lg text-gray-500 bg-gray-50 hover:bg-yellow-50 hover:text-yellow-700 transition-colors"
                                            title="메모"
                                        >
                                            <Icon name="fileText" className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 mt-3">
                                    <button 
                                        type="button" 
                                        onClick={(e) => {e.stopPropagation(); handleEdit(student);}}
                                        className="flex-1 text-sm font-semibold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-lg py-2 transition-colors"
                                    >
                                        수정
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={(e) => {e.stopPropagation(); if(window.confirm(`${student.name} 학생을 정말 삭제하시겠습니까?`)) handleDeleteStudent(student.id);}}
                                        className="flex-1 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg py-2 transition-colors"
                                    >
                                        삭제
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <StudentFormModal isOpen={isStudentModalOpen} onClose={() => setIsStudentModalOpen(false)} student={studentToEdit} allClasses={classes} onSave={handleSaveStudent} />
            <MemoModal isOpen={memoModalState.isOpen} onClose={closeMemoModal} onSave={handleSaveMemo} studentId={memoModalState.studentId} initialContent={memoModalState.content} studentName={memoModalState.studentName} />
            <Modal isOpen={retireModal.isOpen} onClose={closeRetireModal} title="퇴원 처리">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">퇴원일</label>
                        <input
                            type="date"
                            value={retireDate}
                            onChange={(e) => setRetireDate(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">퇴원 사유</label>
                        <select
                            value={retireReason}
                            onChange={(e) => setRetireReason(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200"
                        >
                            <option value="중도퇴원">중도퇴원</option>
                            <option value="전반">전반</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={closeRetireModal}
                            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="button"
                            onClick={handleRetireSave}
                            className="px-4 py-2 rounded-lg bg-indigo-900 text-white text-sm font-semibold hover:bg-indigo-800 transition-colors"
                        >
                            저장
                        </button>
                    </div>
                </div>
            </Modal>

            {/* ✅ [수정] 타학원 시간표 모달: 정보 전체 표시 */}
            <Modal isOpen={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} title={`${selectedStudentSchedule.name} 학생 타학원 시간표`}>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                    {selectedStudentSchedule.schedules.length > 0 ? (
                        selectedStudentSchedule.schedules.map((s, i) => (
                            <div key={i} className="border border-gray-200 p-4 rounded-xl bg-gray-50 flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-gray-900 text-lg">{s.academyName}</p>
                                        <p className="text-sm text-gray-600 font-medium">{s.courseName} <span className="text-gray-400">|</span> {s.instructor || '강사 미정'}</p>
                                    </div>
                                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                                        {s.days.join(', ')}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-gray-500 border-t border-gray-200 pt-2 mt-1">
                                    <div className="flex items-center gap-1">
                                        <Icon name="clock" className="w-3 h-3" />
                                        {s.startTime} ~ {s.endTime}
                                    </div>
                                    {/* ✅ [추가] 기간 표시 */}
                                    <div className="flex items-center gap-1">
                                        <Icon name="calendar" className="w-3 h-3" />
                                        {s.startDate} ~ {s.endDate || '종료일 미정'}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <p className="text-gray-500">등록된 타학원 일정이 없습니다.</p>
                        </div>
                    )}
                    <div className="flex justify-end pt-2">
                        <button onClick={() => setScheduleModalOpen(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium transition-colors">닫기</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};