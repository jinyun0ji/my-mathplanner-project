import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Icon, getLastCheckedDate } from '../utils/helpers';
import ClassSelectionPanel from '../components/Shared/ClassSelectionPanel';
import HomeworkStatisticsPanel from '../components/Homework/HomeworkStatisticsPanel';
import { HomeworkAssignmentModal } from '../utils/modals/HomeworkAssignmentModal';
import HomeworkResultsModal from '../utils/modals/HomeworkResultsModal';
import { buildAssignmentSummary, computeHomeworkProgress, getClassAssignments, getSelectedAssignment, resolveAssignmentStudentIds, resolveAssignmentTypeLabel, resolveAssignmentType } from '../domain/homework/homework.service';
import { db } from '../firebase/client';
import { getDefaultClassId } from '../utils/classStatus';
import { useClassStudents } from '../utils/useClassStudents';
import { filterRosterByWithdrawDate } from '../utils/rosterFilter';
import { buildStudentParentPhoneLast4Map, formatStudentNameWithParentLast4 } from '../utils/parentPhone';

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
    
    const classAssignments = useMemo(
        () => getClassAssignments(homeworkAssignments, selectedClassId),
        [homeworkAssignments, selectedClassId]
    );

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
        const totalQuestions = Number(selectedAssignment?.totalQuestions) || 0;

        return assignmentSummary.reduce((acc, student) => {
            const sid = String(student.studentId);
            const aid = String(selectedAssignment?.id || '');
            const overlay = draftHomeworkOverlay?.[sid]?.[aid];
            const resultMap = overlay?.results || student.resultMap || {};
            const progress = computeHomeworkProgress(resultMap, totalQuestions);
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
        setSelectedAssignmentId(id);
        setIsGlobalDirty(false);
    }, [setIsGlobalDirty]);

    const handleClassSelectWrapper = useCallback((id) => {
        setSelectedClassId(id);
        setSelectedAssignmentId(null);
        setIsGlobalDirty(false);
    }, [setIsGlobalDirty]);
    
    const assignmentPanelContent = useMemo(() => {
        if (!selectedClass) return <p className="text-sm text-gray-500">클래스를 선택해주세요.</p>;
        
        return (
            <div className="max-h-[70vh] overflow-y-auto pr-2">
                {classAssignments.map(assignment => {
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
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                                {assignmentType === 'video_makeup'
                                    ? detailText
                                    : `${assignment.assignedDate || assignment.date}: ${assignment.content} (${rangeDisplay} 총 ${assignment.totalQuestions}문항)`}
                            </p>
                        </div>
                    );
                })}
                {classAssignments.length === 0 && <p className="text-sm text-gray-500 mt-2">배정된 과제가 없습니다.</p>}
            </div>
        );
    }, [classAssignments, selectedAssignmentId, selectedClass, handleAssignmentSelect]);

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
        const existingRecord = normalizedHomeworkResults[studentId]?.[assignmentId];
        const existingMap = existingRecord?.results || existingRecord || {};
        const keys = new Set([...Object.keys(existingMap), ...Object.keys(resultsMap || {})]);
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
        </div>
    );
}

// changed: src/pages/HomeworkManagement.jsx
// added: src/utils/modals/HomeworkResultsModal.jsx