// src/pages/GradeManagement.jsx

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Icon } from '../utils/helpers';
import ClassSelectionPanel from '../components/Shared/ClassSelectionPanel'; 
import FullGradeTable from '../components/Grade/FullGradeTable'; 
import TestResultTable from '../components/Grade/TestResultTable'; 
import TestStatisticsTable from '../components/Grade/TestStatisticsTable'; 
import { TestFormModal } from '../utils/modals/TestFormModal'; 
// Modal 컴포넌트는 TestResultTable 내부에서 사용되므로 여기서는 직접 import하지 않아도 되지만, 
// 만약 다른 모달을 쓴다면 유지하세요. 여기서는 TestFormModal과 TestResultTable이 주된 모달입니다.

// ----------------------------------------------------------------------
// 통계 계산 헬퍼 함수
// ----------------------------------------------------------------------
const computeTestStatistics = (test, students, grades, classAverages) => {
    if (!test || !students.length) {
        return { average: 0, maxScore: 0, minScore: 0, stdDev: 0, correctRates: {}, rank: [] };
    }

    const scores = students.map(s => {
        const score = grades[s.id]?.[test.id]?.score;
        return score === undefined ? null : score;
    }).filter(s => s !== null);

    if (scores.length === 0) {
        return { average: 0, maxScore: 0, minScore: 0, stdDev: 0, correctRates: {}, rank: [] };
    }
    
    const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - average, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    const attemptedStudents = students.filter(s => grades[s.id]?.[test.id]?.score !== null && grades[s.id]?.[test.id]?.score !== undefined);
    const attemptedScores = attemptedStudents.map(s => ({
        score: grades[s.id][test.id].score,
        studentId: s.id,
        name: s.name
    }));

    const rankedScores = attemptedScores.sort((a, b) => b.score - a.score);
        
    let currentRank = 1;
    let rank = rankedScores.map((item, index) => {
        if (index > 0 && item.score < rankedScores[index - 1].score) {
            currentRank = index + 1;
        }
        return { score: item.score, studentId: item.studentId, rank: currentRank };
    });

    const correctRates = {};
    const totalAttempted = attemptedStudents.length; 

    if (test.totalQuestions > 0 && totalAttempted > 0) {
        for (let i = 1; i <= test.totalQuestions; i++) {
            let correctCount = 0;
            attemptedStudents.forEach(student => {
                const status = grades[student.id]?.[test.id]?.correctCount?.[i.toString()];
                if (status === '맞음' || status === '고침') { 
                    correctCount++;
                }
            });
            correctRates[i] = correctCount / totalAttempted;
        }
    }

    return { average, maxScore, minScore, stdDev, correctRates, rank };
};

// ----------------------------------------------------------------------
// 메인 컴포넌트: GradeManagement
// ----------------------------------------------------------------------
export default function GradeManagement({ 
    students, classes, tests, grades, handleSaveTest, handleDeleteTest, 
    handleUpdateGrade, handleSaveClass, calculateClassSessions 
}) {
    const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || null);
    const [isTestModalOpen, setIsTestModalOpen] = useState(false);
    const [testToEdit, setTestToEdit] = useState(null);
    const [selectedTestId, setSelectedTestId] = useState(null); 
    const [isGradeInputModalOpen, setIsGradeInputModalOpen] = useState(false);
    
    // 엑셀 파일 입력을 위한 Ref
    const fileInputRef = useRef(null);
    
    const selectedClass = classes.find(c => c.id === selectedClassId);

    // 모달 닫기 함수 (useCallback으로 안정화)
    const handleCloseGradeInput = useCallback(() => {
        setIsGradeInputModalOpen(false);
    }, []);

    // ------------------------------------------
    // 데이터 가공 (useMemo)
    // ------------------------------------------
    
    // 클래스 학생 목록
    const classStudents = useMemo(() => {
        if (!selectedClass) return [];
        return students
            .filter(s => selectedClass.students.includes(s.id) && s.status === '재원생')
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [students, selectedClass]);
    
    // 클래스 시험 목록 (날짜 오름차순 정렬)
    const classTests = useMemo(() => {
        if (!selectedClassId) return [];
        return tests
            .filter(t => t.classId === selectedClassId)
            .sort((a, b) => new Date(a.date) - new Date(b.date)); 
    }, [tests, selectedClassId]);

    // 선택된 시험 객체
    const selectedTest = useMemo(() => {
        return tests.find(t => t.id === selectedTestId);
    }, [tests, selectedTestId]);

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
    
    // 통계 계산 결과 캐싱
    const testStatistics = useMemo(() => {
        const stats = {};
        classTests.forEach(test => {
            stats[test.id] = computeTestStatistics(test, classStudents, grades, classAverages);
        });
        return stats;
    }, [classTests, classStudents, grades, classAverages]); 

    // 클래스 변경 시 선택된 시험 초기화
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

    // ------------------------------------------
    // ✅ 엑셀 기능 구현 (TestResultTable에서 이동됨)
    // ------------------------------------------

    // 엑셀 양식 다운로드 (CSV 포맷)
    const handleDownloadExcelForm = (e) => {
        if (!selectedTest || !selectedClass) {
            alert("클래스와 시험을 선택해주세요.");
            return;
        }
        e.stopPropagation(); // 이벤트 버블링 방지
        
        const test = selectedTest; 
        const studentsInClass = classStudents; // 이미 필터링된 학생 목록 사용
        
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

    // 엑셀 업로드 버튼 클릭 시 파일 입력 트리거
    const handleUploadExcel = (e) => {
        if (!selectedTest) {
            alert("시험을 선택해주세요.");
            return;
        }
        e.stopPropagation(); 
        fileInputRef.current?.click();
    };

    // 파일 선택 완료 시 처리 (시뮬레이션)
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
            
            event.target.value = ''; // 같은 파일을 다시 선택할 수 있도록 초기화
        }
    };
    
    // ------------------------------------------
    // UI 서브 컴포넌트
    // ------------------------------------------

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
    
    // 시험 상세 정보/관리/채점 버튼 패널
    const TestActionPanel = ({ test }) => {
        if (!test) return null;
        
        const questionScoresString = test.questionScores.map((score, index) => 
            `${index + 1}번: ${score}점`
        );

        return (
            <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-red-500 space-y-4">
                <div className="flex justify-between items-start border-b pb-3">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center">
                        <Icon name="fileText" className="w-5 h-5 mr-2 text-red-600"/>
                        선택 시험 정보: {test.name}
                    </h3>
                    <div className="flex space-x-2 items-center">
                        {/* ✅ 엑셀 양식 다운로드 버튼 */}
                         <button 
                            onClick={handleDownloadExcelForm}
                            className="flex items-center text-sm px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                        >
                            <Icon name="file-text" className="w-4 h-4 mr-1" /> 엑셀 양식
                        </button>
                        
                        {/* ✅ 엑셀 자료 입력 버튼 */}
                        <button 
                            onClick={handleUploadExcel}
                            className="flex items-center text-sm px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                            <Icon name="upload" className="w-4 h-4 mr-1" /> 엑셀로 결과 입력
                        </button>

                         {/* 성적 입력/채점 버튼 */}
                         <button 
                            onClick={handleOpenGradeInput}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center shadow-md transition duration-150 text-sm ml-2"
                        >
                            <Icon name="edit" className="w-4 h-4 mr-1" />
                            성적 입력 / 채점
                        </button>
                    </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                    <p><span className="font-medium text-gray-600">시험일:</span> {test.date}</p>
                    <p><span className="font-medium text-gray-600">총점:</span> {test.maxScore}점</p>
                    <p><span className="font-medium text-gray-600">총 문항 수:</span> {test.totalQuestions}개</p>
                </div>
                
                <p className="text-sm border-t pt-3 text-gray-700">
                    <span className="font-medium text-gray-600 block mb-2">문항당 배점:</span>
                    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {questionScoresString.map((item, index) => (
                             <span key={index} className='bg-gray-50 px-1 rounded'>{item}</span>
                        ))}
                    </span>
                </p>
                
                <div className="flex space-x-4 border-t pt-3">
                     <button 
                        onClick={() => handleEditTest(test)}
                        className="text-indigo-600 hover:underline flex items-center text-sm"
                    >
                        <Icon name="edit" className="w-4 h-4 mr-1" />시험 정보 수정
                    </button>
                     <button 
                        onClick={() => { if(window.confirm(`${test.name} 시험을 삭제하면 모든 학생의 성적 데이터도 삭제됩니다. 정말 삭제하시겠습니까?`)) handleDeleteTest(test.id); }}
                        className="text-red-600 hover:underline flex items-center text-sm"
                    >
                        <Icon name="trash" className="w-4 h-4 mr-1" />시험 삭제
                    </button>
                </div>
            </div>
        );
    };


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
                        <h4 className="text-lg font-bold text-gray-800">시험 목록 (클릭 시 채점)</h4>
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

            {/* 오른쪽: 성적 테이블 또는 시험 상세/채점 패널 */}
            <div className="flex-1 min-w-0">
                {selectedClassId === null ? (
                    <div className="p-6 bg-white rounded-xl shadow-md"><p className="text-gray-500">클래스를 선택하세요.</p></div>
                ) : (
                    <div className="space-y-6">
                        
                        {selectedTestId ? (
                            <>
                                {/* 1. 선택 시험 정보 패널 (엑셀 버튼 포함됨) */}
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
                            <div className="space-y-6">
                                <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-gray-300">
                                    <h3 className="text-xl font-bold text-gray-800">{selectedClass.name} 성적 현황</h3>
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
            
            {/* 성적 입력 모달 (TestResultTable 사용) */}
            {selectedTest && (
                <TestResultTable 
                    isOpen={isGradeInputModalOpen} 
                    onClose={handleCloseGradeInput} // 안정적인 useCallback 핸들러 전달
                    test={selectedTest}
                    studentsData={classStudents}
                    handleUpdateGrade={handleUpdateGrade}
                    grades={grades}
                />
            )}
            
            {/* ✅ 엑셀 파일 업로드를 위한 Hidden Input */}
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