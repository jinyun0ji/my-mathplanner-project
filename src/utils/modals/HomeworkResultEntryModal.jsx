import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { getAssignmentQuestionNumbers, normalizeHomeworkResultMapForDisplay } from '../../domain/homework/homework.service';

const STATUS_ORDER = [null, '맞음', '틀림', '고침'];
const STATUS_STYLE = {
    맞음: 'bg-green-100 text-green-700 border-green-200',
    틀림: 'bg-red-100 text-red-700 border-red-200',
    고침: 'bg-blue-100 text-blue-700 border-blue-200',
};

const buildQuestionList = (assignment) => getAssignmentQuestionNumbers(assignment);

export default function HomeworkResultEntryModal({
    isOpen,
    onClose,
    student,
    assignment,
    initialResult,
    onSave,
}) {
    const [resultMap, setResultMap] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    const questions = useMemo(() => buildQuestionList(assignment), [assignment]);

    useEffect(() => {
        if (!isOpen) return;
        const initialMap = normalizeHomeworkResultMapForDisplay(initialResult, questions, {
            assignmentId: assignment?.id,
            studentId: student?.studentId || student?.id,
        });
        setResultMap(initialMap);
    }, [isOpen, initialResult, questions, assignment, student]);

    if (!isOpen || !student || !assignment) return null;

    const toggleStatus = (questionNumber) => {
        const key = String(questionNumber);
        const currentStatus = resultMap[key] ?? null;
        const nextIndex = (STATUS_ORDER.indexOf(currentStatus) + 1) % STATUS_ORDER.length;
        const nextStatus = STATUS_ORDER[nextIndex];

        setResultMap((prev) => {
            const next = { ...prev };
            if (!nextStatus) {
                delete next[key];
            } else {
                next[key] = nextStatus;
            }
            return next;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave({
                studentId: student.studentId || student.id,
                assignmentId: assignment.id,
                results: normalizeHomeworkResultMapForDisplay(resultMap, questions, {
                    assignmentId: assignment.id,
                    studentId: student.studentId || student.id,
                }),
            });
            onClose();
        } catch (error) {
            alert('과제 결과 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="과제 결과 입력" maxWidth="max-w-3xl">
            <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="text-sm font-semibold text-gray-800">{student.studentName || student.name}</p>
                    <p className="text-xs text-gray-600 mt-1">{assignment.book || assignment.title || '과제'} · {assignment.assignedDate || assignment.date}</p>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {questions.map((questionNumber) => {
                        const status = resultMap[String(questionNumber)] || null;
                        return (
                            <button
                                key={questionNumber}
                                type="button"
                                onClick={() => toggleStatus(questionNumber)}
                                className={`border rounded-md py-2 text-xs font-semibold transition ${status ? STATUS_STYLE[status] : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                            >
                                <div>{questionNumber}번</div>
                                <div className="mt-1">{status || '-'}</div>
                            </button>
                        );
                    })}
                </div>

                <div className="text-xs text-gray-500">클릭 시 상태가 `- → 맞음 → 틀림 → 고침 → -` 순서로 변경됩니다.</div>

                <div className="pt-2 border-t flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300">
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300"
                    >
                        {isSaving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}