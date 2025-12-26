import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Icon } from '../utils/helpers';
import ClassSelectionPanel from '../components/Shared/ClassSelectionPanel';
import FullGradeTable from '../components/Grade/FullGradeTable';
import TestResultTable from '../components/Grade/TestResultTable';
import TestStatisticsTable from '../components/Grade/TestStatisticsTable';
import { TestFormModal } from '../utils/modals/TestFormModal';
import { getClassAverages, getClassTests, getTestStatistics } from '../domain/grade/grade.service';
import { getDefaultClassId } from '../utils/classStatus';
import { useClassStudents } from '../utils/useClassStudents';

// ----------------------------------------------------------------------
// 메인 컴포넌트: GradeManagement
// ----------------------------------------------------------------------
export default function GradeManagement({ 
    classes, tests, grades, handleSaveTest, handleDeleteTest, 
    handleUpdateGrade, handleSaveClass, calculateClassSessions 
}) {
    const [selectedClassId, setSelectedClassId] = useState(() => getDefaultClassId(classes));
    const [isTestModalOpen, setIsTestModalOpen] = useState(false);
    const [testToEdit, setTestToEdit] = useState(null);
    const [selectedTestId, setSelectedTestId] = useState(null); 
    const [isGradeInputModalOpen, setIsGradeInputModalOpen] = useState(false);
    const { students: classStudents, isLoading: isLoadingStudents } = useClassStudents(selectedClassId);
    
    // 엑셀 파일 입력을 위한 Ref
    const fileInputRef = useRef(null);
    
    const selectedClass = classes.find(c => String(c.id) === String(selectedClassId));

    useEffect(() => {
        if (!classes || classes.length === 0) return;
        if (selectedClassId && classes.some(c => String(c.id) === String(selectedClassId))) return;
        setSelectedClassId(getDefaultClassId(classes));
    }, [classes, selectedClassId]);

    const handleCloseGradeInput = useCallback(() => {
        setIsGradeInputModalOpen(false);
    }, []);

    // ------------------------------------------
    // 데이터 가공 (useMemo)
    // ------------------------------------------
    
    const classTests = useMemo(
        () => getClassTests(tests, selectedClassId),
        [tests, selectedClassId]
    );

    const selectedTest = useMemo(() => {
        return tests.find(t => t.id === selectedTestId);
    }, [tests, selectedTestId]);

    const classAverages = useMemo(
        () => getClassAverages(classTests, classStudents, grades),
        [classTests, classStudents, grades]
    );

    const testStatistics = useMemo(
        () => getTestStatistics(classTests, classStudents, grades, classAverages),
        [classTests, classStudents, grades, classAverages]
    ); 

    useEffect(() => {
        setSelectedTestId(null); 
    }, [selectedClassId]);

    // ------------------------------------------
    // 핸들러 함수들
    // ------------------------------------------

    const handleNewTest = () => {
        setTestToEdit(null);
        setIsTestModalOpen(true);
    };

    const handleEditTest = (test) => {
        setTestToEdit(test);
        setIsTestModalOpen(true);
    };

    const handleOpenGradeInput = () => {
        if (selectedTestId) {
            setIsGradeInputModalOpen(true);
        }
    };

    // 엑셀 양식 다운로드
    const handleDownloadExcelForm = (e) => {
        if (!selectedTest || !selectedClass) {
            alert("클래스와 시험을 선택해주세요.");
            return;
        }
        e.stopPropagation(); 
        
        const test = selectedTest; 
        const studentsInClass = classStudents; 
        
        const headers = ['학생명', ...Array.from({ length: test.totalQuestions }, (_, i) => `Q${i + 1} (${test.questionScores[i] || 0}점)`)];
        const sampleData = ['김철수 (예시)', ...Array(test.totalQuestions).fill('1')]; 
        
        const csvContent = [
            headers.join(','),
            '// --- 입력 규칙: 1 (맞음), 2 (틀림) / 미응시 학생은 점수 칸을 비워두세요 ---',
            sampleData.join(','),
            ...studentsInClass.map(student => [student.name, ...Array(test.totalQuestions).fill('')].join(','))
        ].join('\n');

        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) { 
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${test.name}_채점양식.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleUploadExcel = (e) => {
        if (!selectedTest) {
            alert("시험을 선택해주세요.");
            return;
        }
        e.stopPropagation(); 
        fileInputRef.current?.click();
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
                alert('CSV 또는 XLSX 파일만 업로드할 수 있습니다.');
                event.target.value = ''; 
                return;
            }
            console.log('File selected:', file.name);
            alert(`[시뮬레이션] '${file.name}' 파일을 읽었습니다.\n\n실제 구현 시:\n1. 파일을 파싱하여 학생별/문항별 점수 데이터를 추출합니다.\n2. handleUpdateGrade를 반복 호출하여 일괄 저장합니다.\n\n(현재는 시뮬레이션 메시지만 표시됩니다.)`);
            event.target.value = ''; 
        }
    };
    
    // ------------------------------------------
    // UI 서브 컴포넌트
    // ------------------------------------------

    const testPanelContent = useMemo(() => {
        return (
            <div className="max-h-72 overflow-y-auto pr-2">
                {classTests.map(test => (
                    <div 
                        key={test.id} 
                        onClick={() => setSelectedTestId(test.id)}
                        // [색상 변경] 선택 시: bg-indigo-50 border-indigo-200 (Navy Theme)
                        className={`p-3 mb-2 rounded-lg cursor-pointer border transition duration-150 ${
                            test.id === selectedTestId 
                                ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <p className={`text-sm font-bold ${test.id === selectedTestId ? 'text-indigo-900' : 'text-gray-800'}`}>
                            {test.name}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">{test.date} | 총점 {test.maxScore}점</p>
                    </div>
                ))}
                {classTests.length === 0 && <p className="text-sm text-gray-500 mt-2">등록된 시험이 없습니다.</p>}
                {isLoadingStudents && (
                    <p className="text-xs text-gray-400 mt-2">학생 목록을 불러오는 중입니다...</p>
                )}
            </div>
        );
    }, [classTests, selectedTestId]);
    
    const TestActionPanel = ({ test }) => {
        if (!test) return null;
        
        const questionScoresString = test.questionScores.map((score, index) => 
            `${index + 1}번: ${score}점`
        );

        return (
            // [색상 변경] border-l-4 border-indigo-900 (Navy Theme)
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-indigo-900 space-y-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between border-b pb-3">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center leading-snug">
                        {/* [색상 변경] 아이콘: text-indigo-900 */}
                        <Icon name="fileText" className="w-5 h-5 mr-2 text-indigo-900"/>
                        선택 시험 정보: {test.name}
                    </h3>
                    <p className="text-xs text-gray-500">상단 바에서 채점/엑셀 작업을 진행할 수 있습니다.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <p><span className="font-medium text-gray-600">시험일:</span> {test.date}</p>
                    <p><span className="font-medium text-gray-600">총점:</span> {test.maxScore}점</p>
                    <p><span className="font-medium text-gray-600">총 문항 수:</span> {test.totalQuestions}개</p>
                </div>
                
                <p className="text-sm border-t pt-3 text-gray-700">
                    <span className="font-medium text-gray-600 block mb-2">문항당 배점:</span>
                    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {questionScoresString.map((item, index) => (
                             <span key={index} className='bg-gray-50 px-1 rounded text-gray-600 border border-gray-100'>{item}</span>
                        ))}
                    </span>
                </p>
                
                <div className="flex flex-wrap gap-3 border-t pt-3">
                    {/* [색상 변경] 텍스트 버튼: 회색 -> 호버시 남색 */}
                     <button 
                        onClick={() => handleEditTest(test)}
                        className="text-gray-500 hover:text-indigo-900 flex items-center text-sm font-medium transition"
                    >
                        <Icon name="edit" className="w-4 h-4 mr-1" />시험 정보 수정
                    </button>
                     <button 
                        onClick={() => { if(window.confirm(`${test.name} 시험을 삭제하면 모든 학생의 성적 데이터도 삭제됩니다. 정말 삭제하시겠습니까?`)) handleDeleteTest(test.id); }}
                        className="text-gray-500 hover:text-red-600 flex items-center text-sm font-medium transition"
                    >
                        <Icon name="trash" className="w-4 h-4 mr-1" />시험 삭제
                    </button>
                </div>
            </div>
        );
    };


    return (
        <div className="space-y-4 h-full">
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200 px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <Icon name="calendar" className="w-5 h-5 text-indigo-900" />
                        <p>{selectedClass?.name || '클래스 미선택'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        <span>{selectedTest?.name || '시험 미선택'}</span>
                        {selectedTest?.date && <span className="text-gray-400">| {selectedTest.date}</span>}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end w-full lg:w-auto">
                    <button
                        onClick={handleNewTest}
                        disabled={!selectedClassId}
                        className="flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200"
                    >
                        <Icon name="plus" className="w-4 h-4 mr-2" />
                        새 시험 등록
                    </button>
                    {selectedTest && (
                        <>
                            <button
                                onClick={handleDownloadExcelForm}
                                className="flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                                <Icon name="file-text" className="w-4 h-4 mr-2" />
                                엑셀 양식
                            </button>
                            <button
                                onClick={handleUploadExcel}
                                className="flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-indigo-900 text-indigo-900 hover:bg-indigo-50"
                            >
                                <Icon name="upload" className="w-4 h-4 mr-2" />
                                엑셀로 결과 입력
                            </button>
                            <button
                                onClick={handleOpenGradeInput}
                                className="flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-900 text-white hover:bg-indigo-800 shadow"
                            >
                                <Icon name="edit" className="w-4 h-4 mr-2" />
                                성적 입력/채점
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[320px,1fr]">
                <div className="space-y-4">
                    <ClassSelectionPanel
                        classes={classes}
                        selectedClassId={selectedClassId}
                        setSelectedClassId={setSelectedClassId}
                        handleClassSave={handleSaveClass}
                        calculateClassSessions={calculateClassSessions}
                        showSessions={false}
                        showEditButton={true}
                    />
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-3">
                        <div className='flex justify-between items-center border-b pb-2'>
                            <h4 className="text-lg font-bold text-gray-800">시험 목록 (클릭 시 채점)</h4>
                        </div>
                        {testPanelContent}
                    </div>
                </div>

                <div className="space-y-4">
                    {selectedClassId === null ? (
                        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                            <p className="text-gray-500">클래스를 선택하세요.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {selectedTestId ? (
                                <>
                                    {/* 1. 선택 시험 정보 패널 */}
                                    <TestActionPanel test={selectedTest} />

                                    {/* 2. 시험 통계 테이블 */}
                                    <TestStatisticsTable
                                        test={selectedTest}
                                        stats={testStatistics[selectedTestId]}
                                        currentStudents={classStudents}
                                    />
                                </>
                            ) : (
                                /* 선택된 시험이 없을 때 (전체 성적 테이블) 표시 */
                                <div className="space-y-4">
                                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-indigo-900">
                                        <h3 className="text-lg font-bold text-gray-800">{selectedClass.name} 성적 현황</h3>
                                        <p className="text-sm text-gray-600 mt-1">총 {classTests.length}개의 시험이 등록되어 있습니다. 성적 입력은 **시험 목록에서 시험을 선택**하여 진행하세요.</p>
                                    </div>
                                    <FullGradeTable
                                        classStudents={classStudents}
                                        classTests={classTests}
                                        grades={grades}
                                        classAverages={classAverages}
                                    />
                                </div>
                                )}
                        </div>
                    )}
                </div>
            </div>
            
            {/* 시험 등록/수정 모달 */}
            <TestFormModal
                isOpen={isTestModalOpen}
                onClose={() => setIsTestModalOpen(false)}
                onSave={handleSaveTest}
                classId={selectedClassId}
                test={testToEdit} 
                classes={classes}
                calculateClassSessions={calculateClassSessions}
            />
            
            {/* 성적 입력 모달 */}
            {selectedTest && (
                <TestResultTable 
                    isOpen={isGradeInputModalOpen} 
                    onClose={handleCloseGradeInput}
                    test={selectedTest}
                    studentsData={classStudents}
                    handleUpdateGrade={handleUpdateGrade}
                    grades={grades}
                />
            )}
            
            {/* 엑셀 파일 업로드 Input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                style={{ display: 'none' }}
            />
        </div>
    );
};