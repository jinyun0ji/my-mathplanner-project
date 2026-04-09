import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Icon, getLastCheckedDate } from '../utils/helpers';
import ClassSelectionPanel from '../components/Shared/ClassSelectionPanel';
import HomeworkStatisticsPanel from '../components/Homework/HomeworkStatisticsPanel';
import { HomeworkAssignmentModal } from '../utils/modals/HomeworkAssignmentModal';
import HomeworkResultsModal from '../utils/modals/HomeworkResultsModal';
import { buildAssignmentSummary, classifyHomeworkResultKeyMode, computeHomeworkProgress, getAssignmentQuestionNumbers, getClassAssignments, getSelectedAssignment, normalizeHomeworkResultMapForDisplay, resolveAssignmentStudentIds, resolveAssignmentTypeLabel, resolveAssignmentType } from '../domain/homework/homework.service';
import { buildHomeworkWrongNoteText } from '../domain/homework/homeworkWrongNote.service';
import { db } from '../firebase/client';
import { formatClassLabel, getDefaultClassId, sortClassesWithClosedLast } from '../utils/classStatus';
import { useClassStudents } from '../utils/useClassStudents';
import { filterRosterByWithdrawDate } from '../utils/rosterFilter';
import { buildStudentParentPhoneLast4Map, formatStudentNameWithParentLast4 } from '../utils/parentPhone';
import { Modal } from '../components/common/Modal';

const isSameStudent = (result, student) => {
    if (!result || !student) return false;

    const resultStudentIds = [
        result.studentId,
        result.studentDocId,
        result.studentUid,
        result.authUid,
    ].filter(Boolean).map(String);

    const studentIds = [
        student.id,
        student.authUid,
    ].filter(Boolean).map(String);

    return resultStudentIds.some(rid => studentIds.includes(rid));
};

const toDateSafe = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    const next = value instanceof Date ? value : new Date(value);
    return Number.isNaN(next.getTime()) ? null : next;
};

const toYmd = (value) => {
    const date = toDateSafe(value);
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const compareByDateDescThenName = (a, b) => {
    const aDate = toDateSafe(a?.assignedDate || a?.date);
    const bDate = toDateSafe(b?.assignedDate || b?.date);
    const timeDiff = (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
    if (timeDiff !== 0) return timeDiff;

    const classDiff = String(a?.className || '').localeCompare(String(b?.className || ''), 'ko');
    if (classDiff !== 0) return classDiff;

    const titleA = String(a?.book || a?.title || a?.content || '');
    const titleB = String(b?.book || b?.title || b?.content || '');
    return titleA.localeCompare(titleB, 'ko');
};

export default function HomeworkManagement({
    classes, homeworkAssignments, homeworkResults,
    handleSaveHomeworkAssignment, handleDeleteHomeworkAssignment,
    handleUpdateHomeworkResult, handleSaveClass, calculateClassSessions,
    setIsGlobalDirty,
    students = [],
    parents = [],
}) {
    const [selectedClassId, setSelectedClassId] = useState(() => getDefaultClassId(classes));
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [assignmentToEdit, setAssignmentToEdit] = useState(null);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
    const [isHomeworkResultsModalOpen, setIsHomeworkResultsModalOpen] = useState(false);
    const [activeStudentId, setActiveStudentId] = useState(null);
    const [activeAssignment, setActiveAssignment] = useState(null);
    const { students: classStudents, isLoading: isLoadingStudents } = useClassStudents(selectedClassId);
    const [scopedHomeworkResults, setScopedHomeworkResults] = useState(null);
    const [isLoadingScopedResults, setIsLoadingScopedResults] = useState(false);
    const [draftHomeworkOverlay, setDraftHomeworkOverlay] = useState({});
    const [isWrongNoteModalOpen, setIsWrongNoteModalOpen] = useState(false);
    const [wrongNoteText, setWrongNoteText] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [classFilter, setClassFilter] = useState('current');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    
    const [checkedDate, setCheckedDate] = useState(() => new Date().toISOString().slice(0, 10));

    const parentLast4Map = useMemo(
        () => buildStudentParentPhoneLast4Map(students, parents),
        [students, parents],
    );

    useEffect(() => {
        if (!classes || classes.length === 0) return;
        if (selectedClassId && classes.some(c => String(c.id) === String(selectedClassId))) return;
        setSelectedClassId(getDefaultClassId(classes));
    }, [classes, selectedClassId]);

    const selectedClass = classes.find(c => String(c.id) === String(selectedClassId));
    const orderedClasses = useMemo(() => sortClassesWithClosedLast(classes), [classes]);
    
    const classAssignments = useMemo(
        () => getClassAssignments(homeworkAssignments, selectedClassId),
        [homeworkAssignments, selectedClassId]
    );

    const allAssignments = useMemo(() => {
        const classById = new Map((classes || []).map((cls) => [String(cls.id), cls]));
        return (Array.isArray(homeworkAssignments) ? homeworkAssignments : []).map((assignment, index) => {
            const classId = String(assignment?.classId || assignment?.class || '');
            const cls = classById.get(classId);
            return {
                ...assignment,
                __index: index,
                classId,
                className: cls?.name || '',
            };
        });
    }, [homeworkAssignments, classes]);

    const selectedAssignment = useMemo(
        () => getSelectedAssignment(classAssignments, selectedAssignmentId),
        [classAssignments, selectedAssignmentId]
    );

    const rosterForHomework = useMemo(() => {
        const targetDate = selectedAssignment?.assignedDate || selectedAssignment?.date || checkedDate;
        return filterRosterByWithdrawDate(classStudents, selectedClassId, targetDate);
    }, [classStudents, selectedAssignment, selectedClassId, checkedDate]);

    const effectiveHomeworkResults = scopedHomeworkResults ?? homeworkResults;

    const normalizedHomeworkResults = useMemo(() => {
        if (!effectiveHomeworkResults) return {};

        const entries = Object.entries(effectiveHomeworkResults);
        const normalized = {};

        rosterForHomework.forEach((student) => {
            const matches = entries.filter(([key, value]) => {
                if (isSameStudent({ studentId: key }, student)) return true;
                if (value && typeof value === 'object') {
                    const sample = Object.values(value).find(Boolean);
                    return isSameStudent(sample, student);
                }
                return false;
            });

            if (matches.length > 0) {
                normalized[student.id] = matches[0][1];
            }
        });

        return normalized;
    }, [effectiveHomeworkResults, rosterForHomework]);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!selectedAssignmentId) {
                setScopedHomeworkResults(null);
                return;
            }

            setIsLoadingScopedResults(true);

            try {
                const snapA = await getDocs(
                    query(
                        collection(db, 'homeworkResults'),
                        where('assignmentId', '==', selectedAssignmentId),
                        limit(2000)
                    )
                );

                const snapB = await getDocs(
                    query(
                        collection(db, 'homeworkResults'),
                        where('homeworkAssignmentId', '==', selectedAssignmentId),
                        limit(2000)
                    )
                );

                const docs = [...snapA.docs, ...snapB.docs];

                const mapped = {};
                docs.forEach((d) => {
                    const data = d.data() || {};
                    const assignmentId = data.assignmentId || data.homeworkAssignmentId;
                    if (!assignmentId || String(assignmentId) !== String(selectedAssignmentId)) return;

                    const studentId = data.authUid || data.studentId || data.studentDocId || data.studentUid;
                    if (!studentId) return;

                    if (!mapped[studentId]) mapped[studentId] = {};
                    mapped[studentId][assignmentId] = {
                        ...data,
                        results: data.results || {},
                    };
                });

                if (!cancelled) {
                    setScopedHomeworkResults(mapped);
                }
            } catch (error) {
                console.error('Failed to load scoped homework results', error);
                if (!cancelled) {
                    setScopedHomeworkResults(null);
                }
            } finally {
                if (!cancelled) {
                    setIsLoadingScopedResults(false);
                }
            }
        };

        run();
        return () => { cancelled = true; };
    }, [selectedAssignmentId]);

    useEffect(() => {
        if (!selectedAssignmentId) {
            setCheckedDate(new Date().toISOString().slice(0, 10));
            return;
        }

        const toDateString = (v) => {
            if (!v) return null;
            if (typeof v === 'string') return v.slice(0, 10);
            if (typeof v?.toDate === 'function') return v.toDate().toISOString().slice(0, 10);
            try { return new Date(v).toISOString().slice(0, 10); } catch { return null; }
        };

        let latestChecked = null;
        Object.values(effectiveHomeworkResults || {}).forEach((byAssignment) => {
            const record = byAssignment?.[selectedAssignmentId];
            const candidate = toDateString(getLastCheckedDate(record));
            if (candidate && (!latestChecked || new Date(candidate) > new Date(latestChecked))) {
                latestChecked = candidate;
            }
        });

        setCheckedDate(latestChecked || new Date().toISOString().slice(0, 10));
    }, [effectiveHomeworkResults, selectedAssignmentId]);

    const assignmentSummary = useMemo(() => {
        const assignedSet = new Set((resolveAssignmentStudentIds(selectedAssignment) || []).map(String));

        const assignedStudents = assignedSet.size > 0
            ? rosterForHomework.filter(student =>
                assignedSet.has(String(student.id)) || assignedSet.has(String(student.authUid))
            )
            : rosterForHomework;
        return buildAssignmentSummary(selectedAssignment, assignedStudents, normalizedHomeworkResults, [])
            .map((item) => ({
                ...item,
                studentName: formatStudentNameWithParentLast4(
                    assignedStudents.find((s) => String(s.id) === String(item.studentId)),
                    parentLast4Map,
                ) || item.studentName,
            }));
    }, [selectedAssignment, rosterForHomework, normalizedHomeworkResults, parentLast4Map]);

    const completionRateByStudentId = useMemo(() => {
        const questionNumbers = getAssignmentQuestionNumbers(selectedAssignment);
        const totalQuestions = questionNumbers.length;
        const isDev = (typeof window !== 'undefined' && typeof window.__DEV__ !== 'undefined')
            ? window.__DEV__
            : process.env.NODE_ENV !== 'production';

        return assignmentSummary.reduce((acc, student) => {
            const sid = String(student.studentId);
            const aid = String(selectedAssignment?.id || '');
            const overlay = draftHomeworkOverlay?.[sid]?.[aid];
            const mergedResultMap = overlay?.results || student.resultMap || {};
            const normalizedResultMap = normalizeHomeworkResultMapForDisplay(mergedResultMap, questionNumbers, {
                assignmentId: selectedAssignment?.id,
                studentId: student.studentId,
            });

            if (isDev) {
                console.log('[homework completion debug]', {
                    assignmentId: selectedAssignment?.id,
                    title: selectedAssignment?.title || selectedAssignment?.book || selectedAssignment?.content,
                    questionNumbers,
                    rawKeys: Object.keys(mergedResultMap || {}),
                    normalizedKeys: Object.keys(normalizedResultMap || {}),
                    mode: classifyHomeworkResultKeyMode(mergedResultMap, questionNumbers),
                });
            }

            const progress = computeHomeworkProgress(normalizedResultMap, questionNumbers);
            const answeredCount = progress.checkedCount;
            const completionPercentRaw = progress.completionRate;
            const hasWrong = progress.incorrectCount > 0;
            const wrongProgress = completionPercentRaw === 99;
            const completed = completionPercentRaw === 100;
            const completionPercentDisplay = overlay && typeof overlay.completionRate === 'number'
                ? overlay.completionRate
                : completionPercentRaw;

            acc[student.studentId] = {
                raw: completionPercentRaw,
                display: completionPercentDisplay,
                done: answeredCount,
                total: totalQuestions,
                hasWrong,
                wrongProgress,
                completed,
            };
            return acc;
        }, {});
    }, [assignmentSummary, selectedAssignment, draftHomeworkOverlay]);

    const assignmentStatusById = useMemo(() => {
        const summaryByAssignment = {};
        allAssignments.forEach((assignment) => {
            const assignmentId = String(assignment.id);
            const rates = [];

            Object.values(normalizedHomeworkResults || {}).forEach((byAssignment) => {
                const record = byAssignment?.[assignmentId];
                if (!record) return;
                const rate = Number(record.completionRate);
                if (Number.isFinite(rate)) rates.push(rate);
            });

            const total = rates.length;
            const completedCount = rates.filter((value) => value === 100).length;
            const wrongProgressCount = rates.filter((value) => value === 99).length;

            let status = '미완료';
            if (total > 0 && completedCount === total) status = '완료';
            else if (wrongProgressCount > 0) status = '오답 진행';
            else if (rates.some((value) => value > 0)) status = '진행 중';

            summaryByAssignment[assignmentId] = status;
        });
        return summaryByAssignment;
    }, [allAssignments, normalizedHomeworkResults]);

    const assignmentTypeOptions = useMemo(() => {
        const values = new Set();
        allAssignments.forEach((assignment) => {
            const type = resolveAssignmentType(assignment);
            if (type) values.add(type);
        });
        return ['all', ...Array.from(values)];
    }, [allAssignments]);

    const filteredAssignments = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const text = searchTerm.trim().toLowerCase();

        const getDateRange = () => {
            if (dateFilter === '7d') return { from: new Date(startOfToday.getTime() - (6 * 24 * 60 * 60 * 1000)), to: now };
            if (dateFilter === '30d') return { from: new Date(startOfToday.getTime() - (29 * 24 * 60 * 60 * 1000)), to: now };
            if (dateFilter === 'custom') {
                return {
                    from: dateFrom ? new Date(`${dateFrom}T00:00:00`) : null,
                    to: dateTo ? new Date(`${dateTo}T23:59:59`) : null,
                };
            }
            return { from: null, to: null };
        };

        const { from, to } = getDateRange();

        return allAssignments
            .filter((assignment) => {
                const targetClassId = String(assignment.classId || '');
                if (classFilter === 'current' && String(selectedClassId || '') !== targetClassId) return false;
                if (classFilter !== 'all' && classFilter !== 'current' && classFilter !== targetClassId) return false;

                if (text) {
                    const candidate = [
                        assignment.book,
                        assignment.content,
                        assignment.title,
                    ].filter(Boolean).join(' ').toLowerCase();
                    if (!candidate.includes(text)) return false;
                }

                if (statusFilter !== 'all') {
                    const mappedStatus = assignmentStatusById[String(assignment.id)] || '미완료';
                    if (statusFilter !== mappedStatus) return false;
                }

                if (typeFilter !== 'all') {
                    if (resolveAssignmentType(assignment) !== typeFilter) return false;
                }

                const assignmentDate = toDateSafe(assignment.assignedDate || assignment.date);
                if ((from || to) && !assignmentDate) return false;
                if (from && assignmentDate < from) return false;
                if (to && assignmentDate > to) return false;

                return true;
            })
            .sort((a, b) => {
                const byDate = compareByDateDescThenName(a, b);
                if (byDate !== 0) return byDate;
                return a.__index - b.__index;
            });
    }, [allAssignments, searchTerm, classFilter, selectedClassId, statusFilter, typeFilter, dateFilter, dateFrom, dateTo, assignmentStatusById]);

    const clearDraftOverlayFor = useCallback((studentId, assignmentId) => {
        const sid = String(studentId);
        const aid = String(assignmentId);

        setDraftHomeworkOverlay((prev) => {
            const studentOverlay = prev?.[sid];
            if (!studentOverlay?.[aid]) return prev;

            const nextStudentOverlay = { ...studentOverlay };
            delete nextStudentOverlay[aid];

            const next = { ...prev };
            if (Object.keys(nextStudentOverlay).length === 0) {
                delete next[sid];
            } else {
                next[sid] = nextStudentOverlay;
            }

            return next;
        });
    }, []);

    const handleAssignmentSelect = useCallback((id) => {
        const nextAssignment = allAssignments.find((assignment) => String(assignment.id) === String(id));
        if (nextAssignment?.classId && String(nextAssignment.classId) !== String(selectedClassId || '')) {
            setSelectedClassId(nextAssignment.classId);
        }
        setSelectedAssignmentId(id);
        setIsGlobalDirty(false);
    }, [setIsGlobalDirty, allAssignments, selectedClassId]);

    const handleClassSelectWrapper = useCallback((id) => {
        setSelectedClassId(id);
        setClassFilter('current');
        setSelectedAssignmentId(null);
        setIsGlobalDirty(false);
    }, [setIsGlobalDirty]);

    const resetFilters = useCallback(() => {
        setSearchTerm('');
        setClassFilter('current');
        setStatusFilter('all');
        setDateFilter('all');
        setDateFrom('');
        setDateTo('');
        setTypeFilter('all');
    }, []);
    
    const assignmentPanelContent = useMemo(() => {
        if (!selectedClass) return <p className="text-sm text-gray-500">클래스를 선택해주세요.</p>;
        
        return (
            <div className="max-h-[70vh] overflow-y-auto pr-2">
                {filteredAssignments.map(assignment => {
                    const rangeDisplay = assignment.rangeString
                        ? assignment.rangeString
                        : (assignment.startQuestion ? `${assignment.startQuestion}~${assignment.endQuestion}` : '범위 없음');
                    const typeLabel = resolveAssignmentTypeLabel(assignment);
                    const assignmentType = resolveAssignmentType(assignment);
                    const detailText = assignmentType === 'video_makeup'
                        ? (assignment.content || assignment.title || '동영상 보강')
                        : `${assignment.assignedDate || assignment.date}: ${assignment.content}`;

                    return (
                        <div
                            key={assignment.id}
                            onClick={() => handleAssignmentSelect(assignment.id)}
                            className={`p-3 mb-2 rounded-lg cursor-pointer border transition duration-150 ${
                                assignment.id === selectedAssignmentId
                                    ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                    : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-gray-800">{assignment.book || assignment.title || '과제'}</p>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">{typeLabel}</span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                    {assignmentStatusById[String(assignment.id)] || '미완료'}
                                </span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                                {assignmentType === 'video_makeup'
                                    ? detailText
                                    : `${assignment.assignedDate || assignment.date}: ${assignment.content} (${rangeDisplay} 총 ${assignment.totalQuestions}문항)`}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-1">{assignment.className || '클래스 미지정'}</p>
                        </div>
                    );
                })}
                {filteredAssignments.length === 0 && <p className="text-sm text-gray-500 mt-2">조건에 맞는 과제가 없습니다.</p>}
            </div>
        );
    }, [filteredAssignments, selectedAssignmentId, selectedClass, handleAssignmentSelect, assignmentStatusById]);

    useEffect(() => {
        if (!selectedAssignmentId) return;
        const exists = filteredAssignments.some((assignment) => String(assignment.id) === String(selectedAssignmentId));
        if (!exists) {
            setSelectedAssignmentId(null);
        }
    }, [filteredAssignments, selectedAssignmentId]);

    const handleEditAssignment = (assignment) => {
        setAssignmentToEdit(assignment);
        setIsAssignmentModalOpen(true);
    };

    const handleNewAssignment = () => {
        setAssignmentToEdit(null);
        setIsAssignmentModalOpen(true);
    };

    const openResultModal = (studentId = null) => {
        setActiveStudentId(studentId);
        setActiveAssignment(selectedAssignment);
        setIsHomeworkResultsModalOpen(true);
    };

    const handleSaveResultFromModal = async ({ studentId, assignmentId, resultsMap }) => {
        const assignment = classAssignments.find((item) => String(item.id) === String(assignmentId));
        const questionNumbers = getAssignmentQuestionNumbers(assignment);
        const allowedKeys = new Set(questionNumbers.map((q) => String(q)));
        const existingRecord = normalizedHomeworkResults[studentId]?.[assignmentId];
        const existingMap = normalizeHomeworkResultMapForDisplay(existingRecord, questionNumbers, {
            assignmentId,
            studentId,
        });
        const keys = new Set(
            [...Object.keys(existingMap), ...Object.keys(resultsMap || {})]
                .filter((key) => allowedKeys.has(String(key)))
        );
        const updates = Array.from(keys).map((questionId) => ({
            studentId,
            assignmentId,
            questionId,
            status: resultsMap?.[questionId] ?? null,
        }));

        if (updates.length === 0) {
            return;
        }

        await handleUpdateHomeworkResult(updates, checkedDate);
    };

    const handleOpenWrongNoteModal = useCallback(() => {
        const baseAssignment = selectedAssignment || activeAssignment;

        if (!baseAssignment) {
            alert('과제를 먼저 선택해주세요.');
            return;
        }

        const nextWrongNoteText = buildHomeworkWrongNoteText({
            assignment: baseAssignment,
            students: rosterForHomework,
            homeworkResults: normalizedHomeworkResults,
        });

        setWrongNoteText(nextWrongNoteText);
        setIsWrongNoteModalOpen(true);
    }, [selectedAssignment, activeAssignment, rosterForHomework, normalizedHomeworkResults]);

    const handleCopyWrongNoteText = useCallback(async () => {
        if (!wrongNoteText) {
            alert('추출할 오답 문항이 없습니다.');
            return;
        }

        try {
            await navigator.clipboard.writeText(wrongNoteText);
            alert('복사되었습니다.');
        } catch (error) {
            alert('복사에 실패했습니다. 다시 시도해주세요.');
        }
    }, [wrongNoteText]);

    return (
        <div className="space-y-4 h-full">
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200 px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <Icon name="book" className="w-5 h-5 text-indigo-900" />
                        <span>{selectedClass?.name || '클래스 미선택'}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        <span>{selectedAssignment?.book || '과제 미선택'}</span>
                        <span className="text-gray-400">|</span>
                        <span>{selectedAssignment?.assignedDate || selectedAssignment?.date || '날짜 없음'}</span>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 items-center justify-end">
                    <button
                        type="button"
                        onClick={handleOpenWrongNoteModal}
                        disabled={!selectedAssignment && !activeAssignment}
                        className="px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                        오답노트 텍스트 추출
                    </button>
                    <label className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                        <span>검사일</span>
                        <input
                            type="date"
                            value={checkedDate}
                            onChange={(e) => setCheckedDate(e.target.value)}
                            className="border rounded-md px-2 py-1 text-xs"
                        />
                    </label>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[320px,1fr]">
                <div className="space-y-4">
                    <ClassSelectionPanel
                        classes={classes}
                        selectedClassId={selectedClassId}
                        setSelectedClassId={handleClassSelectWrapper}
                        handleClassSave={handleSaveClass}
                        calculateClassSessions={calculateClassSessions}
                        showSessions={false}
                        showEditButton={true}
                    />
                    <div className="bg-white p-4 rounded-xl shadow-md space-y-3 border border-gray-200">
                        <div className='flex justify-between items-center border-b pb-2'>
                            <h4 className="text-lg font-bold text-gray-800">과제 목록</h4>
                            <button
                                onClick={handleNewAssignment}
                                disabled={!selectedClassId}
                                className="text-indigo-900 hover:text-indigo-700 text-sm font-bold flex items-center disabled:text-gray-400"
                            >
                                <Icon name="plus" className="w-4 h-4 mr-1" />
                                새 과제
                            </button>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="과제명 / book / content 검색"
                                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                                />
                                <select
                                    value={classFilter}
                                    onChange={(e) => setClassFilter(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
                                >
                                    <option value="current">현재 선택 클래스</option>
                                    <option value="all">전체 클래스</option>
                                    {orderedClasses.map((cls) => (
                                        <option key={cls.id} value={String(cls.id)}>
                                            {formatClassLabel(cls, { includeClosedBadge: true })}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
                                >
                                    <option value="all">상태: 전체</option>
                                    <option value="진행 중">진행 중</option>
                                    <option value="완료">완료</option>
                                    <option value="미완료">미완료</option>
                                    <option value="오답 진행">오답 진행</option>
                                </select>
                                <select
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
                                >
                                    <option value="all">유형: 전체</option>
                                    {assignmentTypeOptions.filter((value) => value !== 'all').map((value) => (
                                        <option key={value} value={value}>{value}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,1fr,1fr] gap-2 items-center">
                                <select
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
                                >
                                    <option value="all">날짜: 전체</option>
                                    <option value="7d">최근 7일</option>
                                    <option value="30d">최근 30일</option>
                                    <option value="custom">직접 기간 선택</option>
                                </select>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    disabled={dateFilter !== 'custom'}
                                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm disabled:bg-gray-100"
                                />
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    disabled={dateFilter !== 'custom'}
                                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm disabled:bg-gray-100"
                                />
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm font-semibold bg-white hover:bg-gray-100"
                                >
                                    필터 초기화
                                </button>
                            </div>
                            <p className="text-xs text-gray-600">
                                결과 {filteredAssignments.length}건
                                {filteredAssignments[0] ? ` · 최신 ${toYmd(filteredAssignments[0].assignedDate || filteredAssignments[0].date)}` : ''}
                            </p>
                        </div>
                        {assignmentPanelContent}
                        {isLoadingStudents && (
                            <p className="text-xs text-gray-400">학생 목록을 불러오는 중입니다...</p>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    {!selectedAssignment && (
                        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
                            과제를 선택하면 채점 및 통계를 확인할 수 있습니다.
                        </div>
                    )}

                    {selectedAssignment && (
                        <div className="space-y-4">
                            <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
                                <div className='flex justify-between items-start gap-3'>
                                    <div>
                                        <h4 className="text-lg font-bold text-gray-800">{selectedAssignment.book || '과제 상세'}</h4>
                                        <p className="text-sm text-gray-600 mt-1">
                                            {selectedAssignment.assignedDate || selectedAssignment.date} | {selectedAssignment.content}
                                            {resolveAssignmentType(selectedAssignment) === 'video_makeup'
                                                ? ''
                                                : ` (${selectedAssignment.rangeString || `${selectedAssignment.startQuestion || '?'}~${selectedAssignment.endQuestion || '?'}`} 총 ${selectedAssignment.totalQuestions}문항)`}
                                        </p>
                                    </div>
                                    <div className='flex flex-wrap gap-2 items-center lg:justify-end'>
                                        <button
                                            onClick={() => handleEditAssignment(selectedAssignment)}
                                            className="text-gray-500 p-1 rounded-full transition-colors hover:text-indigo-900 hover:bg-indigo-50"
                                        >
                                            <Icon name="edit" className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => { if (window.confirm('정말 이 과제 기록을 삭제하시겠습니까?')) handleDeleteHomeworkAssignment(selectedAssignment.id); }}
                                            className="text-gray-500 p-1 rounded-full transition-colors hover:text-red-600 hover:bg-red-50"
                                        >
                                            <Icon name="trash" className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {isLoadingScopedResults && (
                                <div className="text-xs text-gray-400 px-1">과제 채점 데이터를 불러오는 중...</div>
                            )}

                            <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
                                <h4 className="text-lg font-bold text-gray-800 border-b pb-2 mb-3">과제 결과 입력</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {assignmentSummary.map((student) => {
                                        const completion = completionRateByStudentId[student.studentId];

                                        return (
                                            <div key={student.studentId} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 bg-gray-50">
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-800">{student.studentName}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {completion?.total > 0 ? `${completion.display}% (${completion.done}/${completion.total})` : '-'}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => openResultModal(student.studentId)}
                                                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                                                >
                                                    결과 입력/수정
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-3">
                                    <button
                                        onClick={() => openResultModal()}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                                    >
                                        결과 입력/수정 (모달)
                                    </button>
                                </div>
                            </div>
                            <HomeworkStatisticsPanel
                                summary={assignmentSummary}
                                assignment={selectedAssignment}
                                completionRateByStudentId={completionRateByStudentId}
                            />
                        </div>
                    )}
                </div>
            </div>
            
            <HomeworkAssignmentModal
                isOpen={isAssignmentModalOpen}
                onClose={() => setIsAssignmentModalOpen(false)}
                onSave={handleSaveHomeworkAssignment}
                classId={selectedClassId}
                assignment={assignmentToEdit}
                students={classStudents}
                selectedClass={selectedClass}
            />

            <HomeworkResultsModal
                isOpen={isHomeworkResultsModalOpen}
                onClose={() => setIsHomeworkResultsModalOpen(false)}
                students={assignmentSummary}
                assignment={activeAssignment}
                homeworkResults={normalizedHomeworkResults}
                activeStudentId={activeStudentId}
                completionRateByStudentId={completionRateByStudentId}
                onSaveStudentResult={handleSaveResultFromModal}
                onDraftChange={(studentId, assignmentId, results, completionRate) => {
                    const sid = String(studentId);
                    const aid = String(assignmentId);
                    setDraftHomeworkOverlay((prev) => ({
                        ...prev,
                        [sid]: {
                            ...(prev[sid] || {}),
                            [aid]: {
                                results,
                                completionRate,
                            },
                        },
                    }));
                }}
                onDraftClear={clearDraftOverlayFor}
            />
            <Modal
                isOpen={isWrongNoteModalOpen}
                onClose={() => setIsWrongNoteModalOpen(false)}
                title="오답노트 추출 결과"
                maxWidth="max-w-3xl"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">한글 매크로 입력용 형식입니다.</p>
                    {wrongNoteText ? (
                        <textarea
                            readOnly
                            value={wrongNoteText}
                            className="w-full min-h-[320px] rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-800 bg-gray-50"
                        />
                    ) : (
                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                            추출할 오답 문항이 없습니다.
                        </div>
                    )}
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={handleCopyWrongNoteText}
                            disabled={!wrongNoteText}
                            className="px-4 py-2 text-sm font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                        >
                            복사
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsWrongNoteModalOpen(false)}
                            className="px-4 py-2 text-sm font-semibold rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}