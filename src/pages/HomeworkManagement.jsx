import React, { useState, useMemo } from 'react';
import { Icon } from '../utils/helpers';
import ClassSelectionPanel from '../components/Shared/ClassSelectionPanel'; // 경로 수정
import HomeworkGradingTable from '../components/Homework/HomeworkGradingTable'; // 경로 수정
import { HomeworkAssignmentModal } from '../utils/modals/HomeworkAssignmentModal'; // 경로 수정

export default function HomeworkManagement({ 
    students, classes, homeworkAssignments, homeworkResults, 
    handleSaveHomeworkAssignment, handleDeleteHomeworkAssignment, 
    handleUpdateHomeworkResult, handleSaveClass, calculateClassSessions 
}) {
    const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || null);
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [assignmentToEdit, setAssignmentToEdit] = useState(null);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
    
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

    // 클래스 학생 목록
    const classStudents = useMemo(() => {
        if (!selectedClass) return [];
        return students.filter(s => selectedClass.students.includes(s.id) && s.status === '재원생').sort((a, b) => a.name.localeCompare(b.name));
    }, [students, selectedClass]);
    
    // 선택된 과제의 결과 요약
    const assignmentSummary = useMemo(() => {
        if (!selectedAssignment) return [];
        
        return classStudents.map(student => {
            const result = homeworkResults[student.id]?.[selectedAssignment.id] || {};
            const total = selectedAssignment.totalQuestions;
            
            let correct = 0;
            let incorrect = 0;
            let corrected = 0;

            Object.values(result).forEach(status => {
                if (status === '맞음') correct++;
                if (status === '틀림') incorrect++;
                if (status === '고침') corrected++;
            });
            
            const completionCount = correct + corrected + incorrect; // 채점된 개수
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
    }, [selectedAssignment, classStudents, homeworkResults]);
    
    // 과제 목록 패널
    const assignmentPanelContent = useMemo(() => {
        if (!selectedClass) return <p className="text-sm text-gray-500">클래스를 선택해주세요.</p>;
        
        return (
            <div className="max-h-[70vh] overflow-y-auto pr-2">
                {classAssignments.map(assignment => (
                    <div 
                        key={assignment.id} 
                        onClick={() => setSelectedAssignmentId(assignment.id)}
                        className={`p-3 mb-2 rounded-lg cursor-pointer border transition duration-150 ${
                            assignment.id === selectedAssignmentId 
                                ? 'bg-blue-100 border-blue-400 shadow-md' 
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <p className="text-sm font-bold text-gray-800">{assignment.book} ({assignment.startQuestion}~{assignment.endQuestion})</p>
                        <p className="text-xs text-gray-600 mt-1">{assignment.date}: {assignment.content}</p>
                    </div>
                ))}
                {classAssignments.length === 0 && <p className="text-sm text-gray-500 mt-2">배정된 과제가 없습니다.</p>}
            </div>
        );
    }, [classAssignments, selectedClassId, selectedAssignmentId, selectedClass]);

    const handleEditAssignment = (assignment) => {
        setAssignmentToEdit(assignment);
        setIsAssignmentModalOpen(true);
    };

    const handleNewAssignment = () => {
        setAssignmentToEdit(null);
        setIsAssignmentModalOpen(true);
    };

    const handleUpdateResult = (studentId, qNum, status) => {
        if (!selectedAssignmentId) return;
        handleUpdateHomeworkResult(studentId, selectedAssignmentId, qNum, status);
    };

    return (
        <div className="flex space-x-6 h-full">
            {/* 왼쪽: 클래스 및 과제 목록 패널 */}
            <div className="w-80 flex-shrink-0 space-y-4">
                <ClassSelectionPanel
                    classes={classes}
                    selectedClassId={selectedClassId}
                    setSelectedClassId={setSelectedClassId}
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

            {/* 오른쪽: 과제 상세 및 채점 테이블 */}
            <div className="flex-1 min-w-0">
                {!selectedAssignment ? (
                    <div className="p-6 bg-white rounded-xl shadow-md"><p className="text-gray-500">클래스를 선택하고 왼쪽에서 과제를 선택하세요.</p></div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-green-500">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">{selectedAssignment.book}</h3>
                                    <p className="text-sm text-gray-600 mt-1">{selectedAssignment.date} | {selectedAssignment.content} ({selectedAssignment.totalQuestions}문항)</p>
                                </div>
                                <div className='flex space-x-2'>
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

                        {/* 채점 테이블 */}
                        <HomeworkGradingTable 
                            summary={assignmentSummary} 
                            assignment={selectedAssignment} 
                            handleUpdateResult={handleUpdateResult} 
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