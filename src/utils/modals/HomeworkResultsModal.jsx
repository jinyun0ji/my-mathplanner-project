import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { computeHomeworkProgress } from '../../domain/homework/homework.service';


const toStatus = (value) => {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (['1', 'o', '맞음'].includes(normalized)) return '맞음';
    if (['2', 'x', '틀림'].includes(normalized)) return '틀림';
    if (['3', '고침'].includes(normalized)) return '고침';
    return null;
};

export default function HomeworkResultsModal({
    isOpen,
    onClose,
    students = [],
    assignment,
    homeworkResults,
    activeStudentId,
    onSaveStudentResult,
    onDraftChange,
    onDraftClear,
}) {
    const [search, setSearch] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [resultMap, setResultMap] = useState({});
    const [activeQIndex, setActiveQIndex] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const containerRef = useRef(null);

    const totalQuestions = Number(assignment?.totalQuestions) || 0;
    const questions = useMemo(() => Array.from({ length: totalQuestions }, (_, i) => i + 1), [totalQuestions]);

    const progressByStudentId = useMemo(() => {
        return students.reduce((acc, student) => {
            const record = homeworkResults?.[student.studentId]?.[assignment?.id];
            const studentResultsMap = record?.results || record || {};
            const progress = computeHomeworkProgress(studentResultsMap, totalQuestions);
            const answeredCount = progress.checkedCount;
            const completionPercentRaw = progress.completionRate;
            const hasWrong = progress.incorrectCount > 0;
            const wrongProgress = completionPercentRaw === 99;
            const completionPercentDisplay = completionPercentRaw;
            acc[student.studentId] = {
                completionPercentRaw,
                completionPercentDisplay,
                answeredCount,
                hasWrong,
                wrongProgress,
            };
            return acc;
        }, {});
    }, [students, homeworkResults, assignment, totalQuestions]);

    const filteredStudents = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return students;
        return students.filter((student) => String(student.studentName || '').toLowerCase().includes(keyword));
    }, [students, search]);

    const selectedStudent = useMemo(
        () => students.find((student) => String(student.studentId) === String(selectedStudentId)) || null,
        [students, selectedStudentId]
    );

    useEffect(() => {
        if (!isOpen) return;
        const nextId = activeStudentId || students[0]?.studentId || null;
        setSelectedStudentId(nextId);
    }, [isOpen, activeStudentId, students]);

    useEffect(() => {
        if (!selectedStudentId || !assignment?.id) {
            setResultMap({});
            return;
        }
        const record = homeworkResults?.[selectedStudentId]?.[assignment.id];
        const map = record?.results || record || {};
        setResultMap(map);
        setActiveQIndex(0);
        setIsDirty(false);
    }, [selectedStudentId, assignment, homeworkResults]);

    useEffect(() => {
        if (!isOpen || !selectedStudentId || !assignment?.id) return;
        const completionRate = computeHomeworkProgress(resultMap, totalQuestions).completionRate;
        onDraftChange?.(selectedStudentId, assignment.id, resultMap, completionRate);
    }, [isOpen, selectedStudentId, assignment, resultMap, totalQuestions, onDraftChange]);

    useEffect(() => {
        if (!isOpen) return;
        setTimeout(() => containerRef.current?.focus(), 0);
    }, [isOpen, selectedStudentId]);

    if (!isOpen || !assignment) return null;

    const requestClose = () => {
        if (isDirty) {
            const ok = window.confirm('저장되지 않은 변경사항이 있습니다. 저장하지 않고 닫을까요?');
            if (!ok) return;
            if (selectedStudentId) {
                onDraftClear?.(selectedStudentId, assignment.id);
            }
        }

        setIsDirty(false);
        onClose();
    };

    const requestChangeStudent = (nextStudentId) => {
        if (String(nextStudentId) === String(selectedStudentId)) return;
        if (isDirty) {
            const ok = window.confirm('저장되지 않은 변경사항이 있습니다. 저장하지 않고 이동할까요?');
            if (!ok) return;
            if (selectedStudentId) {
                onDraftClear?.(selectedStudentId, assignment.id);
            }
        }

        setIsDirty(false);
        setSelectedStudentId(nextStudentId);
    };

    const setQuestionStatus = (questionNumber, statusValue, moveToNext = true) => {
        const key = String(questionNumber);
        const nextStatus = toStatus(statusValue);
        setResultMap((prev) => {
            const next = { ...prev };
            if (!nextStatus) delete next[key];
            else next[key] = nextStatus;
            return next;
        });
        setIsDirty(true);
        if (!moveToNext || totalQuestions <= 0) return;
        setActiveQIndex((prev) => Math.min(prev + 1, totalQuestions - 1));
    };

    const clearActiveQuestion = () => {
        if (totalQuestions <= 0) return;
        const qNum = String(activeQIndex + 1);
        setResultMap((prev) => {
            const next = { ...(prev || {}) };
            delete next[qNum];
            return next;
        });
        setIsDirty(true);
    };

    const handleKeyDown = (e) => {
        if (!selectedStudent) return;
        if (totalQuestions <= 0) return;

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setActiveQIndex((prev) => Math.max(0, prev - 1));
            return;
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            setActiveQIndex((prev) => Math.min(totalQuestions - 1, prev + 1));
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveQIndex((prev) => Math.max(0, prev - 10));
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveQIndex((prev) => Math.min(totalQuestions - 1, prev + 10));
            return;
        }
        if (e.key === 'Home') {
            e.preventDefault();
            setActiveQIndex(0);
            return;
        }
        if (e.key === 'End') {
            e.preventDefault();
            setActiveQIndex(totalQuestions - 1);
            return;
        }

        if (['1', '2', '3'].includes(e.key)) {
            e.preventDefault();
            setQuestionStatus(activeQIndex + 1, e.key, true);
            return;
        }
        if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            clearActiveQuestion();
        }
    };

    const handleSave = async () => {
        if (!selectedStudent) return;
        setIsSaving(true);
        try {
            await onSaveStudentResult({
                studentId: selectedStudent.studentId,
                assignmentId: assignment.id,
                resultsMap: resultMap,
            });
            setIsDirty(false);
            onDraftClear?.(selectedStudent.studentId, assignment.id);
        } catch (error) {
            alert('과제 결과 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setIsSaving(false);
        }
    };

    const selectedProgress = selectedStudent ? progressByStudentId[selectedStudent.studentId] : null;

    return (
        <Modal isOpen={isOpen} onClose={requestClose} title="과제 결과 입력/수정" maxWidth="max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-4 min-h-[60vh]">
                <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="학생 검색"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                    <div className="max-h-[52vh] overflow-y-auto space-y-2 pr-1">
                        {filteredStudents.map((student) => {
                            const progress = progressByStudentId[student.studentId];
                            const isActive = String(student.studentId) === String(selectedStudentId);
                            return (
                                <button
                                    type="button"
                                    key={student.studentId}
                                    onClick={() => requestChangeStudent(student.studentId)}
                                    className={`w-full text-left rounded-md border px-3 py-2 ${isActive ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-200 hover:bg-gray-100'}`}
                                >
                                    <p className="text-sm font-semibold text-gray-800">{student.studentName}</p>
                                    <p className="text-xs text-gray-500">{progress ? `${progress.completionPercentDisplay}% (${progress.answeredCount}/${totalQuestions})` : '-'}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div
                    ref={containerRef}
                    tabIndex={0}
                    onKeyDown={handleKeyDown}
                    className="border rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                    {selectedStudent ? (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-lg font-bold text-gray-800">{selectedStudent.studentName}</p>
                                    <p className="text-xs text-gray-500">{assignment.book || assignment.title || '과제'} · {assignment.assignedDate || assignment.date}</p>
                                </div>
                                <p className="text-sm font-bold text-indigo-700">
                                    {selectedProgress ? `${selectedProgress.completionPercentDisplay}%` : '-'}
                                </p>
                            </div>

                            <div className="grid grid-cols-10 gap-2">
                                {questions.map((questionNumber) => {
                                    const status = resultMap[String(questionNumber)] || null;
                                    const questionIndex = questionNumber - 1;
                                    const isActiveQ = activeQIndex === questionIndex;
                                    return (
                                        <button
                                            key={questionNumber}
                                            type="button"
                                            onClick={() => {
                                                setActiveQIndex(questionIndex);
                                                const sequence = ['맞음', '틀림', '고침', null];
                                                const currentIndex = sequence.indexOf(status);
                                                const nextStatus = sequence[(currentIndex + 1) % sequence.length];
                                                setQuestionStatus(questionNumber, nextStatus, false);
                                            }}
                                            className={`border rounded-md py-2 text-xs font-semibold ${isActiveQ ? 'ring-2 ring-indigo-400' : ''} ${status === '맞음' ? 'bg-green-100 text-green-700 border-green-200' : status === '틀림' ? 'bg-red-100 text-red-700 border-red-200' : status === '고침' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200'}`}
                                        >
                                            <div>{questionNumber}</div>
                                            <div>{status || '-'}</div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-4 flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-4 py-2 text-sm font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300"
                                >
                                    {isSaving ? '저장 중...' : '저장'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-gray-500">학생을 선택해주세요.</p>
                    )}
                </div>
            </div>
        </Modal>
    );
}

// changed: arrow key nav + delete fix