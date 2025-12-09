import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../utils/helpers';
import ClassSelectionPanel from '../components/Shared/ClassSelectionPanel'; // 경로 수정
import FullGradeTable from '../components/Grade/FullGradeTable'; // 경로 수정
import TestResultTable from '../components/Grade/TestResultTable'; // 경로 수정
import { TestFormModal } from '../utils/modals/TestFormModal'; // 경로 수정

export default function GradeManagement({ 
    students, classes, tests, grades, handleSaveTest, handleDeleteTest, 
    handleUpdateGrade, handleSaveClass, calculateClassSessions 
}) {
    const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || null);
    const [isTestModalOpen, setIsTestModalOpen] = useState(false);
    const [testToEdit, setTestToEdit] = useState(null);
    const [isResultModalOpen, setIsResultModalOpen] = useState(false);
    const [selectedTestId, setSelectedTestId] = useState(null);
    
    const selectedClass = classes.find(c => c.id === selectedClassId);

    // 클래스 학생 목록 및 시험 목록
    const classStudents = useMemo(() => {
        if (!selectedClass) return [];
        return students.filter(s => selectedClass.students.includes(s.id) && s.status === '재원생').sort((a, b) => a.name.localeCompare(b.name));
    }, [students, selectedClass]);
    
    const classTests = useMemo(() => {
        if (!selectedClassId) return [];
        return tests
            .filter(t => t.classId === selectedClassId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [tests, selectedClassId]);

    const selectedTest = useMemo(() => {
        return classTests.find(t => t.id === selectedTestId);
    }, [classTests, selectedTestId]);

    // 클래스 학생들의 시험별 평균 점수 계산
    const classAverages = useMemo(() => {
        const averages = {};
        
        classTests.forEach(test => {
            let totalScore = 0;
            let count = 0;
            
            classStudents.forEach(student => {
                const score = grades[student.id]?.[test.id]?.score;
                if (score !== undefined && score !== null) {
                    totalScore += Number(score);
                    count++;
                }
            });
            averages[test.id] = count > 0 ? (totalScore / count) : 0;
        });
        return averages;
    }, [classTests, classStudents, grades]);
    
    useEffect(() => {
        if (classTests.length > 0) {
            setSelectedTestId(classTests[0].id);
        } else {
            setSelectedTestId(null);
        }
    }, [selectedClassId, classTests.length]);

    const handleNewTest = () => {
        setTestToEdit(null);
        setIsTestModalOpen(true);
    };

    const handleEditTest = (test) => {
        setTestToEdit(test);
        setIsTestModalOpen(true);
    };

    const handleOpenResultModal = (test) => {
        setSelectedTestId(test.id);
        setIsResultModalOpen(true);
    };
    
    // 시험 목록 패널 컨텐츠
    const testPanelContent = useMemo(() => {
        return (
            <div className="max-h-72 overflow-y-auto pr-2">
                {classTests.map(test => (
                    <div 
                        key={test.id} 
                        onClick={() => setSelectedTestId(test.id)}
                        className={`p-3 mb-2 rounded-lg cursor-pointer border transition duration-150 ${
                            test.id === selectedTestId 
                                ? 'bg-red-100 border-red-400 shadow-md' 
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <p className="text-sm font-bold text-gray-800">{test.name}</p>
                        <p className="text-xs text-gray-600 mt-1">{test.date} | 총점 {test.maxScore}점</p>
                    </div>
                ))}
                {classTests.length === 0 && <p className="text-sm text-gray-500 mt-2">등록된 시험이 없습니다.</p>}
            </div>
        );
    }, [classTests, selectedTestId]);

    return (
        <div className="flex space-x-6 h-full">
            {/* 왼쪽: 클래스 및 시험 목록 패널 */}
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
                        <h4 className="text-lg font-bold text-gray-800">시험 목록</h4>
                        <button 
                            onClick={handleNewTest}
                            disabled={!selectedClassId}
                            className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center disabled:text-gray-400"
                        >
                            <Icon name="plus" className="w-4 h-4 mr-1" />
                            새 시험 등록
                        </button>
                    </div>
                    {testPanelContent}
                </div>
            </div>

            {/* 오른쪽: 성적 테이블 */}
            <div className="flex-1 min-w-0">
                {selectedClassId === null ? (
                    <div className="p-6 bg-white rounded-xl shadow-md"><p className="text-gray-500">클래스를 선택하세요.</p></div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-red-500">
                            <h3 className="text-xl font-bold text-gray-800">{selectedClass.name} 성적 현황}</h3>
                            <p className="text-sm text-gray-600 mt-1">총 {classTests.length}개의 시험이 등록되어 있습니다.</p>
                        </div>

                        {/* 전체 성적 테이블 */}
                        <FullGradeTable 
                            classStudents={classStudents}
                            classTests={classTests}
                            grades={grades}
                            classAverages={classAverages}
                            handleEditTest={handleEditTest}
                            handleDeleteTest={handleDeleteTest}
                            handleOpenResultModal={handleOpenResultModal}
                        />

                    </div>
                )}
            </div>
            
            <TestFormModal
                isOpen={isTestModalOpen}
                onClose={() => setIsTestModalOpen(false)}
                onSave={handleSaveTest}
                classId={selectedClassId}
                test={testToEdit}
                classes={classes}
                calculateClassSessions={calculateClassSessions}
            />
            {selectedTest && (
                <TestResultTable
                    isOpen={isResultModalOpen}
                    onClose={() => setIsResultModalOpen(false)}
                    test={selectedTest}
                    studentsData={classStudents}
                    handleUpdateGrade={handleUpdateGrade}
                    grades={grades}
                />
            )}
        </div>
    );
};