import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../utils/helpers';
import ClassSelectionPanel from '../components/Shared/ClassSelectionPanel'; 
import HomeworkGradingTable from '../components/Homework/HomeworkGradingTable'; 
import { HomeworkAssignmentModal } from '../utils/modals/HomeworkAssignmentModal'; 

export default function HomeworkManagement({ 
    students, classes, homeworkAssignments, homeworkResults, 
    handleSaveHomeworkAssignment, handleDeleteHomeworkAssignment, 
    handleUpdateHomeworkResult, handleSaveClass, calculateClassSessions,
    setIsGlobalDirty // ✅ App.jsx에서 전달받음
}) {
    const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || null);
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [assignmentToEdit, setAssignmentToEdit] = useState(null);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
    
    // ✅ 로컬 변경 사항 관리 (자동 저장 방지)
    const [localChanges, setLocalChanges] = useState([]); 

    const selectedClass = classes.find(c => c.id === selectedClassId);
    
    const classAssignments = useMemo(() => {
        if (!selectedClassId) return [];
        return homeworkAssignments
            .filter(a => a.classId === selectedClassId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [homeworkAssignments, selectedClassId]);

    const selectedAssignment = useMemo(() => {
        return classAssignments.find(a => a.id === selectedAssignmentId);
    }, [classAssignments, selectedAssignmentId]);

    const classStudents = useMemo(() => {
        if (!selectedClass) return [];
        return students.filter(s => selectedClass.students.includes(s.id) && s.status === '재원생').sort((a, b) => a.name.localeCompare(b.name));
    }, [students, selectedClass]);
    
    // 요약 데이터 계산 (로컬 변경사항 + 기존 데이터 병합)
    const assignmentSummary = useMemo(() => {
        if (!selectedAssignment) return [];
        
        return classStudents.map(student => {
            // 기존 결과 복사
            const savedResult = { ...(homeworkResults[student.id]?.[selectedAssignment.id] || {}) };
            
            // 로컬 변경사항 적용
            localChanges.forEach(change => {
                if (change.studentId === student.id && change.assignmentId === selectedAssignment.id) {
                    if (change.status === null) delete savedResult[change.questionId];
                    else savedResult[change.questionId] = change.status;
                }
            });

            const result = savedResult;
            const total = selectedAssignment.totalQuestions;
            
            let correct = 0;
            let incorrect = 0;
            let corrected = 0;

            Object.values(result).forEach(status => {
                if (status === '맞음') correct++;
                if (status === '틀림') incorrect++;
                if (status === '고침') corrected++;
            });
            
            const completionCount = correct + corrected + incorrect; 
            const unchecked = total - completionCount;
            const completionRate = Math.round((completionCount / total) * 100) || 0;
            
            return {
                studentId: student.id,
                studentName: student.name,
                total,
                correct,
                incorrect,
                corrected,
                unchecked,
                completionRate,
                isCompleted: unchecked === 0,
                resultMap: result,
            };
        });
    }, [selectedAssignment, classStudents, homeworkResults, localChanges]);

    // ✅ 과제 선택 변경 시 보호
    const handleAssignmentSelect = (id) => {
        if (localChanges.length > 0) {
            if (!window.confirm('저장하지 않은 채점 결과가 있습니다. 다른 과제로 이동하시겠습니까?\n(이동 시 변경사항은 사라집니다)')) {
                return;
            }
            setLocalChanges([]); // 이동 시 초기화
            setIsGlobalDirty(false);
        }
        setSelectedAssignmentId(id);
    };

    // ✅ 클래스 변경 시 보호
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
    
    // 과제 목록 패널
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
                            className={`p-3 mb-2 rounded-lg cursor-pointer border transition duration-150 ${
                                assignment.id === selectedAssignmentId 
                                    ? 'bg-blue-100 border-blue-400 shadow-md' 
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

    // ✅ 로컬 상태 업데이트 (실제 저장은 안 함)
    const handleUpdateResultLocal = (studentId, qNum, status) => {
        if (!selectedAssignmentId) return;
        
        // 기존 변경사항 덮어쓰기
        setLocalChanges(prev => {
            const filtered = prev.filter(c => !(c.studentId === studentId && c.assignmentId === selectedAssignmentId && c.questionId === qNum));
            return [...filtered, { studentId, assignmentId: selectedAssignmentId, questionId: qNum, status }];
        });
        
        setIsGlobalDirty(true); // 전역 dirty 상태 설정
    };

    // ✅ 실제 저장 버튼 핸들러
    const handleSaveChanges = () => {
        if (localChanges.length === 0) return;
        
        handleUpdateHomeworkResult(localChanges); // App.jsx에 일괄 업데이트 요청
        setLocalChanges([]);
        setIsGlobalDirty(false);
        alert('채점 결과가 저장되었습니다.');
    };

    return (
        <div className="flex space-x-6 h-full">
            <div className="w-80 flex-shrink-0 space-y-4">
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
                        <button 
                            onClick={handleNewAssignment}
                            disabled={!selectedClassId}
                            className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center disabled:text-gray-400"
                        >
                            <Icon name="plus" className="w-4 h-4 mr-1" />
                            새 과제
                        </button>
                    </div>
                    {assignmentPanelContent}
                </div>
            </div>

            <div className="flex-1 min-w-0">
                {!selectedAssignment ? (
                    <div className="p-6 bg-white rounded-xl shadow-md"><p className="text-gray-500">클래스를 선택하고 왼쪽에서 과제를 선택하세요.</p></div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-green-500">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 flex items-center">
                                        {selectedAssignment.book}
                                        {/* 변경사항이 있으면 표시 */}
                                        {localChanges.length > 0 && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">저장되지 않음</span>}
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {selectedAssignment.date} | {selectedAssignment.content} 
                                        ({selectedAssignment.rangeString || `${selectedAssignment.startQuestion || '?'}~${selectedAssignment.endQuestion || '?'}`}, 총 {selectedAssignment.totalQuestions}문항)
                                    </p>
                                </div>
                                <div className='flex space-x-2 items-center'>
                                    {/* ✅ 저장 버튼 추가 */}
                                    <button 
                                        onClick={handleSaveChanges}
                                        disabled={localChanges.length === 0}
                                        className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold shadow-md transition ${
                                            localChanges.length > 0 
                                            ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        }`}
                                    >
                                        <Icon name="save" className="w-4 h-4 mr-2" />
                                        채점 저장 ({localChanges.length})
                                    </button>
                                    
                                    <div className="h-6 w-px bg-gray-300 mx-2"></div>

                                    <button 
                                        onClick={() => handleEditAssignment(selectedAssignment)}
                                        className="text-indigo-600 hover:text-indigo-800 p-1 rounded-full hover:bg-indigo-100"
                                    >
                                        <Icon name="edit" className="w-5 h-5" />
                                    </button>
                                    <button 
                                        onClick={() => { if(window.confirm('정말 이 과제 기록을 삭제하시겠습니까?')) handleDeleteHomeworkAssignment(selectedAssignment.id); }}
                                        className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100"
                                    >
                                        <Icon name="trash" className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <HomeworkGradingTable 
                            summary={assignmentSummary} 
                            assignment={selectedAssignment} 
                            handleUpdateResult={handleUpdateResultLocal} 
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
};