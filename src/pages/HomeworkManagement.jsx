import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../utils/helpers';
import ClassSelectionPanel from '../components/Shared/ClassSelectionPanel';
import HomeworkGradingTable from '../components/Homework/HomeworkGradingTable';
import HomeworkStatisticsPanel from '../components/Homework/HomeworkStatisticsPanel';
import { HomeworkAssignmentModal } from '../utils/modals/HomeworkAssignmentModal';
import { buildAssignmentSummary, getClassAssignments, getClassStudents, getSelectedAssignment } from '../domain/homework/homework.service';

export default function HomeworkManagement({
    students, classes, homeworkAssignments, homeworkResults,
    handleSaveHomeworkAssignment, handleDeleteHomeworkAssignment,
    handleUpdateHomeworkResult, handleSaveClass, calculateClassSessions,
    setIsGlobalDirty 
}) {
    const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || null);
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [assignmentToEdit, setAssignmentToEdit] = useState(null);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
    
    // 로컬 변경 사항 관리
    const [localChanges, setLocalChanges] = useState([]); 

    const selectedClass = classes.find(c => c.id === selectedClassId);
    
    const classAssignments = useMemo(
        () => getClassAssignments(homeworkAssignments, selectedClassId),
        [homeworkAssignments, selectedClassId]
    );

    const selectedAssignment = useMemo(
        () => getSelectedAssignment(classAssignments, selectedAssignmentId),
        [classAssignments, selectedAssignmentId]
    );

    const classStudents = useMemo(
        () => getClassStudents(students, selectedClass),
        [students, selectedClass]
    );

    const assignmentSummary = useMemo(
        () => buildAssignmentSummary(selectedAssignment, classStudents, homeworkResults, localChanges),
        [selectedAssignment, classStudents, homeworkResults, localChanges]
    );

    const handleAssignmentSelect = (id) => {
        if (localChanges.length > 0) {
            if (!window.confirm('저장하지 않은 채점 결과가 있습니다. 다른 과제로 이동하시겠습니까?\n(이동 시 변경사항은 사라집니다)')) {
                return;
            }
            setLocalChanges([]); 
            setIsGlobalDirty(false);
        }
        setSelectedAssignmentId(id);
    };

    const handleClassSelectWrapper = (id) => {
        if (localChanges.length > 0) {
            if (!window.confirm('저장하지 않은 채점 결과가 있습니다. 다른 클래스로 이동하시겠습니까?')) {
                return;
            }
            setLocalChanges([]);
            setIsGlobalDirty(false);
        }
        setSelectedClassId(id);
        setSelectedAssignmentId(null);
    }
    
    const assignmentPanelContent = useMemo(() => {
        if (!selectedClass) return <p className="text-sm text-gray-500">클래스를 선택해주세요.</p>;
        
        return (
            <div className="max-h-[70vh] overflow-y-auto pr-2">
                {classAssignments.map(assignment => {
                    const rangeDisplay = assignment.rangeString 
                        ? assignment.rangeString 
                        : (assignment.startQuestion ? `${assignment.startQuestion}~${assignment.endQuestion}` : '범위 없음');

                    return (
                        <div 
                            key={assignment.id} 
                            onClick={() => handleAssignmentSelect(assignment.id)}
                            // [색상 변경] 선택 시: bg-indigo-50 border-indigo-200
                            className={`p-3 mb-2 rounded-lg cursor-pointer border transition duration-150 ${
                                assignment.id === selectedAssignmentId 
                                    ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                                    : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            <p className="text-sm font-bold text-gray-800">{assignment.book} ({rangeDisplay})</p>
                            <p className="text-xs text-gray-600 mt-1">{assignment.date}: {assignment.content}</p>
                        </div>
                    );
                })}
                {classAssignments.length === 0 && <p className="text-sm text-gray-500 mt-2">배정된 과제가 없습니다.</p>}
            </div>
        );
    }, [classAssignments, selectedClassId, selectedAssignmentId, selectedClass, localChanges]);

    const handleEditAssignment = (assignment) => {
        setAssignmentToEdit(assignment);
        setIsAssignmentModalOpen(true);
    };

    const handleNewAssignment = () => {
        setAssignmentToEdit(null);
        setIsAssignmentModalOpen(true);
    };

    const handleUpdateResultLocal = (studentId, qNum, status) => {
        if (!selectedAssignmentId) return;
        
        setLocalChanges(prev => {
            const filtered = prev.filter(c => !(c.studentId === studentId && c.assignmentId === selectedAssignmentId && c.questionId === qNum));
            return [...filtered, { studentId, assignmentId: selectedAssignmentId, questionId: qNum, status }];
        });
        
        setIsGlobalDirty(true);
    };

    const handleSaveChanges = () => {
        if (localChanges.length === 0) return;
        handleUpdateHomeworkResult(localChanges); 
        setLocalChanges([]);
        setIsGlobalDirty(false);
        alert('채점 결과가 저장되었습니다.');
    };

    const statusSummary = useMemo(() => {
        if (!assignmentSummary || assignmentSummary.length === 0) return { submitted: 0, notSubmitted: 0, graded: 0 };

        const graded = assignmentSummary.filter(s => s.completionRate === 100).length;
        const submitted = assignmentSummary.filter(s => s.completionRate > 0).length;
        const notSubmitted = assignmentSummary.length - submitted;

        return { submitted, notSubmitted, graded };
    }, [assignmentSummary]);

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
                        <span>{selectedAssignment?.date || '날짜 없음'}</span>
                        {localChanges.length > 0 && (
                            <span className="ml-1 text-[11px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full">저장되지 않음</span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs lg:text-sm">
                    <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold">제출 {statusSummary.submitted}명</span>
                    <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 font-semibold">미제출 {statusSummary.notSubmitted}명</span>
                    <span className="px-3 py-1 rounded-full bg-green-50 text-green-700 font-semibold">채점완료 {statusSummary.graded}명</span>
                </div>

                <div className="flex flex-wrap gap-2 justify-end">
                    <button
                        onClick={handleSaveChanges}
                        disabled={localChanges.length === 0}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-900 hover:bg-indigo-800 rounded-lg shadow-md transition ${
                            localChanges.length > 0
                                ? 'bg-indigo-900 text-white hover:bg-indigo-800'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        <Icon name="checkSquare" className="w-5 h-5" />
                        채점 입력 ({localChanges.length})
                    </button>
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
                    </div>
                </div>

                <div className="space-y-4">
                    {!selectedAssignment ? (
                        <div className="p-6 bg-white rounded-xl shadow-md border border-gray-200">
                            <p className="text-gray-500">클래스를 선택하고 왼쪽에서 과제를 선택하세요.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-indigo-900 border border-gray-200">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-bold text-gray-800 flex items-center">
                                            {selectedAssignment.book}
                                        </h3>
                                        <p className="text-sm text-gray-600 mt-1">
                                            {selectedAssignment.date} | {selectedAssignment.content}
                                            ({selectedAssignment.rangeString || `${selectedAssignment.startQuestion || '?'}~${selectedAssignment.endQuestion || '?'}`} 총 {selectedAssignment.totalQuestions}문항)
                                        </p>
                                    </div>
                                    <div className='flex flex-wrap gap-2 items-center lg:justify-end'>
                                        <button
                                            onClick={() => handleEditAssignment(selectedAssignment)}
                                            className="text-gray-500 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-50 transition-colors"
                                        >
                                            <Icon name="edit" className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => { if(window.confirm('정말 이 과제 기록을 삭제하시겠습니까?')) handleDeleteHomeworkAssignment(selectedAssignment.id); }}
                                            className="text-gray-500 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
                                        >
                                            <Icon name="trash" className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-bold text-gray-700">학생 제출/채점 상태</h4>
                                    <div className="flex items-center gap-2 text-[11px]">
                                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold">제출</span>
                                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold">미제출</span>
                                        <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-semibold">채점완료</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {assignmentSummary.map((s) => {
                                        const statusChip = s.completionRate === 100
                                            ? 'bg-green-100 text-green-700'
                                            : s.completionRate > 0
                                                ? 'bg-indigo-100 text-indigo-700'
                                                : 'bg-gray-100 text-gray-600';

                                        const statusLabel = s.completionRate === 100 ? '채점완료' : s.completionRate > 0 ? '제출' : '미제출';

                                        return (
                                            <div key={s.studentId} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 bg-gray-50">
                                                <span className="text-sm font-semibold text-gray-800 truncate">{s.studentName}</span>
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusChip}`}>{statusLabel}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                        <HomeworkGradingTable
                                summary={assignmentSummary}
                                assignment={selectedAssignment}
                                handleUpdateResult={handleUpdateResultLocal}
                            />

                            <HomeworkStatisticsPanel
                                assignment={selectedAssignment}
                                summary={assignmentSummary}
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
                students={students}
                selectedClass={selectedClass}
            />
        </div>
    );
}