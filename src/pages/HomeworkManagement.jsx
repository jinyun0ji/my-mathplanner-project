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

    return (
        <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 h-full">
            <div className="w-full xl:w-80 flex-shrink-0 space-y-4">
                <ClassSelectionPanel
                    classes={classes}
                    selectedClassId={selectedClassId}
                    setSelectedClassId={handleClassSelectWrapper}
                    handleClassSave={handleSaveClass}
                    calculateClassSessions={calculateClassSessions}
                    showSessions={false}
                    showEditButton={true}
                />
                <div className="bg-white p-4 rounded-xl shadow-md space-y-3">
                    <div className='flex justify-between items-center border-b pb-2'>
                        <h4 className="text-lg font-bold text-gray-800">과제 목록</h4>
                        {/* [색상 변경] text-green-600 -> text-indigo-900 */}
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

            <div className="flex-1 min-w-0 space-y-4">
                {!selectedAssignment ? (
                    <div className="p-6 bg-white rounded-xl shadow-md"><p className="text-gray-500">클래스를 선택하고 왼쪽에서 과제를 선택하세요.</p></div>
                ) : (
                    <div className="space-y-6">
                        {/* 1. 과제 정보 및 액션 패널 */}
                        {/* [색상 변경] border-green-500 -> border-indigo-900 */}
                        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-indigo-900">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-bold text-gray-800 flex items-center">
                                        {selectedAssignment.book}
                                        {localChanges.length > 0 && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">저장되지 않음</span>}
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {selectedAssignment.date} | {selectedAssignment.content} 
                                        ({selectedAssignment.rangeString || `${selectedAssignment.startQuestion || '?'}~${selectedAssignment.endQuestion || '?'}`}, 총 {selectedAssignment.totalQuestions}문항)
                                    </p>
                                </div>
                                <div className='flex flex-wrap gap-2 items-center lg:justify-end'>
                                    {/* [색상 변경] bg-blue-600 -> bg-indigo-900 */}
                                    <button 
                                        onClick={handleSaveChanges}
                                        disabled={localChanges.length === 0}
                                        className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold shadow-md transition ${
                                            localChanges.length > 0 
                                            ? 'bg-indigo-900 text-white hover:bg-indigo-800' 
                                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        } w-full sm:w-auto justify-center`}
                                    >
                                        <Icon name="save" className="w-4 h-4 mr-2" />
                                        채점 저장 ({localChanges.length})
                                    </button>
                                    
                                    <div className="h-6 w-px bg-gray-300 mx-2 hidden sm:block"></div>

                                    {/* [색상 변경] text-indigo-600 -> text-gray-500 hover:text-indigo-900 */}
                                    <button 
                                        onClick={() => handleEditAssignment(selectedAssignment)}
                                        className="text-gray-500 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-50 transition-colors"
                                    >
                                        <Icon name="edit" className="w-5 h-5" />
                                    </button>
                                    {/* [색상 변경] text-red-600 -> text-gray-500 hover:text-red-600 */}
                                    <button 
                                        onClick={() => { if(window.confirm('정말 이 과제 기록을 삭제하시겠습니까?')) handleDeleteHomeworkAssignment(selectedAssignment.id); }}
                                        className="text-gray-500 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
                                    >
                                        <Icon name="trash" className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ✅ 2. 채점 테이블 */}
                        <HomeworkGradingTable 
                            summary={assignmentSummary} 
                            assignment={selectedAssignment} 
                            handleUpdateResult={handleUpdateResultLocal} 
                        />

                        {/* ✅ 3. 통계 패널 */}
                        <HomeworkStatisticsPanel 
                            assignment={selectedAssignment} 
                            summary={assignmentSummary} 
                        />
                    </div>
                )}
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