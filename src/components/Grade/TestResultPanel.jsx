// src/components/Grade/TestResultPanel.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '../../utils/helpers';
// Modal은 GradeManagement.jsx에서 사용하므로 여기서는 제거하거나 유지해도 무방

export default function TestResultPanel({ 
    test, studentsData, handleUpdateGrade, grades, onSave 
}) {
    
    // ref를 사용하여 모든 입력 필드에 접근
    const inputRefs = useRef({}); 
    
    // 점수 계산 로직
    const calculateTotalScore = useCallback((scores) => {
        if (!test.questionScores || test.questionScores.length !== test.totalQuestions) {
            console.error("Warning: Invalid question scores configuration.");
            return 0;
        }

        let totalScore = 0;
        scores.forEach((status, index) => {
            // status === 1: 맞음 (정답/고침)
            if (status === 1) {
                totalScore += (test.questionScores[index] || 0);
            }
        });
        return Math.min(totalScore, test.maxScore);
    }, [test.questionScores, test.maxScore, test.totalQuestions]);


    // 초기 상태 계산 로직
    const initializeGrades = useCallback(() => {
        return studentsData.reduce((acc, student) => {
            // App.jsx의 initialGrades 구조를 참고하여 데이터 로딩
            const studentGrade = grades[student.id]?.[test.id] || { correctCount: {}, score: null, comment: '' };
            
            const initialScores = Array(test.totalQuestions).fill(null);
            
            if (studentGrade.score === null) {
                // 미응시 상태일 경우 scores 배열을 초기화하여 입력 필드를 비워둡니다.
            } else {
                for (let i = 0; i < test.totalQuestions; i++) {
                    const qNum = (i + 1).toString();
                    const status = studentGrade.correctCount?.[qNum];
                    if (status === 1) {
                        initialScores[i] = 1;
                    } else if (status === 0) {
                        initialScores[i] = 0;
                    }
                }
            }
            
            acc[student.id] = {
                scores: initialScores,
                comment: studentGrade.comment || '',
            };
            return acc;
        }, {});
    }, [studentsData, grades, test.id, test.totalQuestions]);
    

    const [currentGrades, setCurrentGrades] = useState(initializeGrades);
    const [calculatedScores, setCalculatedScores] = useState({});
    
    // 선택된 시험이 바뀌면 상태 초기화
    useEffect(() => {
        if (test) {
            setCurrentGrades(initializeGrades());
        }
    }, [test, initializeGrades]); 

    // 모든 학생의 점수 재계산
    useEffect(() => {
        const newCalculatedScores = {};
        studentsData.forEach(student => {
            const scores = currentGrades[student.id]?.scores || [];
            // 미응시 상태 (null)가 아닌 경우에만 점수 계산
            newCalculatedScores[student.id] = calculateTotalScore(scores);
        });
        setCalculatedScores(newCalculatedScores);
    }, [currentGrades, studentsData, calculateTotalScore]);


    // 문항 결과 변경 핸들러
    const handleScoreChange = (studentId, questionIndex, value) => {
        setCurrentGrades(prev => {
            const newScores = [...(prev[studentId]?.scores || [])];
            
            let newStatus = null;
            if (value === '1') {
                newStatus = 1; // 맞음 (점수 획득)
            } else if (value === '2') {
                newStatus = 0; // 틀림
            } else if (value === '') {
                newStatus = null; // 초기화/미채점
            } else {
                return prev; 
            }

            newScores[questionIndex] = newStatus;

            // 다음 입력 필드로 포커스 이동 (1 또는 2 입력 시)
            if (newStatus !== null) {
                let nextIndex = questionIndex + 1;
                let nextStudentId = studentId;
                const currentStudentIndex = studentsData.findIndex(s => s.id === studentId);

                if (nextIndex >= test.totalQuestions) {
                    if (currentStudentIndex < studentsData.length - 1) {
                        nextStudentId = studentsData[currentStudentIndex + 1].id;
                        nextIndex = 0;
                    } else {
                        // 마지막 학생의 마지막 문항: 포커스 이동 없음
                        // 포커스를 코멘트 입력창으로 이동시키는 것도 고려 가능
                        // const commentRef = inputRefs.current[`${studentId}-comment`];
                        // if (commentRef) { setTimeout(() => commentRef.focus(), 0); }
                        return { 
                            ...prev, 
                            [studentId]: { ...prev[studentId], scores: newScores } 
                        };
                    }
                }
                
                const nextRefActual = inputRefs.current[`${nextStudentId}-${nextIndex}`];
                if (nextRefActual) {
                    setTimeout(() => nextRefActual.focus(), 0); 
                }
            }

            return { 
                ...prev, 
                [studentId]: { ...prev[studentId], scores: newScores } 
            };
        });
    };

    // 키보드 이벤트 핸들러 (1 또는 2 입력 처리)
    const handleKeyDown = (e, studentId, questionIndex) => {
        if (e.key === '1' || e.key === '2' || e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault(); 
            if (e.key === 'Delete' || e.key === 'Backspace') {
                handleScoreChange(studentId, questionIndex, ''); 
            } else {
                handleScoreChange(studentId, questionIndex, e.key); 
            }
        }
    };
    
    // 코멘트 변경 핸들러
    const handleCommentChange = (studentId, comment) => {
        setCurrentGrades(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], comment }
        }));
    };

    // 점수 저장 핸들러 (모달 닫지 않음)
    const handleSave = () => {
        studentsData.forEach(student => {
            const finalGrades = currentGrades[student.id];

            const resultMapping = finalGrades.scores.reduce((acc, status, index) => {
                if (status !== null) {
                    // 1: 맞음 (정답/고침), 0: 틀림
                    acc[(index + 1).toString()] = status; 
                }
                return acc;
            }, {});

            handleUpdateGrade(
                student.id, 
                test.id, 
                resultMapping, 
                finalGrades.comment // ✅ 코멘트 전달
            );
        });
        
        // if (onSave) { onSave(); }  // 🚨 요청에 따라 모달 닫기 로직 제거

        // 저장 후 UI를 업데이트된 데이터로 리프레시
        setCurrentGrades(initializeGrades());
    };

    // 전체 미응시 처리 핸들러 (모달 닫지 않음)
    const handleMarkAbsentAll = () => {
        if (!window.confirm("경고: 현재 보이는 모든 학생의 성적을 [미응시]로 처리하고 저장하시겠습니까? (기존 점수 초기화)")) {
            return;
        }

        studentsData.forEach(student => {
            // App.jsx의 handleUpdateGrade 로직에 따라, '미응시' 스트링을 전달하여 처리
            handleUpdateGrade(
                student.id, 
                test.id, 
                '미응시', // resultMapping 대신 '미응시' 스트링 전달
                currentGrades[student.id]?.comment || '' // ✅ 코멘트 전달
            );
        });

        // 처리 후 UI를 미응시 상태로 업데이트하여 리프레시
        setCurrentGrades(initializeGrades());
    }

    // 취소/초기화 핸들러 (저장되지 않은 변경 사항 초기화)
    const handleCancel = () => {
        setCurrentGrades(initializeGrades());
    };


    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-600">
                총점: **{test.maxScore}점**, 문항 수: **{test.totalQuestions}개**
                <span className="ml-4 font-bold text-blue-600">키 입력: 1 (맞음), 2 (틀림)</span>
            </p>
            <div className="overflow-x-auto max-h-[60vh] relative">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-3 py-2 text-left font-bold text-gray-600 w-24 sticky left-0 bg-gray-50 border-r">학생명</th>
                            <th className="px-3 py-2 text-center font-bold text-gray-600 w-20">총점</th>
                            {Array.from({ length: test.totalQuestions }).map((_, i) => (
                                <th key={i} className="px-2 py-2 text-center font-bold text-gray-600 w-12 border-l">
                                    {i + 1}번
                                    <div className='text-xs font-normal text-red-500'>({test.questionScores[i] || 0}점)</div>
                                </th>
                            ))}
                            <th className="px-3 py-2 text-left font-bold text-gray-600 w-64 border-l">코멘트</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {studentsData.map(student => {
                            // 미응시 여부 확인
                            const isAbsent = grades[student.id]?.[test.id]?.score === null;
                            const totalScoreText = isAbsent 
                                ? '미응시' 
                                : (calculatedScores[student.id] !== undefined 
                                    ? calculatedScores[student.id].toFixed(1) 
                                    : '-');

                            return (
                                <tr key={student.id} className={`hover:bg-gray-50 ${isAbsent ? 'bg-red-50/50' : ''}`}>
                                    <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white hover:bg-gray-50 border-r text-sm">{student.name}</td>
                                    
                                    <td className="px-3 py-2 text-center font-bold text-base text-blue-600">
                                        <span className={isAbsent ? 'text-red-500' : 'text-blue-600'}>
                                            {totalScoreText}
                                        </span>
                                    </td>
                                    
                                    {Array.from({ length: test.totalQuestions }).map((_, i) => {
                                        const status = currentGrades[student.id]?.scores[i];
                                        return (
                                            <td key={i} className="px-1 py-2 text-center border-l">
                                                <input
                                                    ref={el => inputRefs.current[`${student.id}-${i}`] = el}
                                                    type="text"
                                                    value={status !== null ? (status === 1 ? '1' : '2') : ''} 
                                                    onKeyDown={(e) => handleKeyDown(e, student.id, i)}
                                                    maxLength="1"
                                                    className={`w-8 h-6 text-center border rounded-md font-bold text-sm 
                                                        focus:ring-2 focus:ring-blue-500 transition duration-100
                                                        ${isAbsent ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed' :
                                                          status === 1 ? 'bg-green-100 border-green-400 text-green-700' : 
                                                          status === 0 ? 'bg-red-100 border-red-400 text-red-700' : 'border-gray-300 text-gray-700'}`
                                                    }
                                                    placeholder="-"
                                                    disabled={isAbsent} // 미응시 처리 시 입력 비활성화
                                                />
                                            </td>
                                        );
                                    })}
                                    
                                    <td className="px-3 py-2 border-l">
                                        <input
                                            type="text"
                                            value={currentGrades[student.id]?.comment || ''}
                                            onChange={(e) => handleCommentChange(student.id, e.target.value)}
                                            className="w-full border rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500"
                                            placeholder="특이사항 입력"
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3 border-t pt-4">
                <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition"
                >
                    취소 (초기화)
                </button>
                <button
                    onClick={handleMarkAbsentAll} // ✅ 추가된 미응시 처리 버튼
                    className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-orange-500 hover:bg-orange-600 transition shadow-md"
                >
                    <Icon name="slash" className="w-4 h-4 mr-1 inline-block" />
                    전체 미응시 처리
                </button>
                <button
                    onClick={handleSave} // ✅ 모달 닫기 로직 제거
                    className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 transition shadow-md"
                >
                    <Icon name="save" className="w-4 h-4 mr-1 inline-block" />
                    점수 저장
                </button>
                {/* 닫기 버튼: 모달을 닫고 싶을 때를 위해 onSave(부모의 닫기 함수)를 호출하는 버튼 추가 */}
                <button
                    onClick={onSave}
                    className="px-4 py-2 text-sm font-medium rounded-lg text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 transition"
                >
                    모달 닫기
                </button>
            </div>
        </div>
    );
};