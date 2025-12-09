// src/components/Grade/TestResultTable.jsx

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../../utils/helpers';
import { Modal } from '../../components/common/Modal'; 

const RESULT_OPTIONS_GRADE = { '맞음': 'text-green-600', '틀림': 'text-red-600', '고침': 'text-blue-600', '미채점': 'text-gray-500' };

const getStatusColor = (statusKey) => {
    return RESULT_OPTIONS_GRADE[statusKey] || 'text-gray-500';
};

export default function TestResultTable({ isOpen, onClose, test, studentsData, handleUpdateGrade, grades }) {
    
    const [selectedStudentId, setSelectedStudentId] = useState(studentsData[0]?.id || null);
    const [resultMapping, setResultMapping] = useState({});
    const [studentComment, setStudentComment] = useState('');

    const inputRefs = useRef({});

    const selectedStudent = useMemo(() => studentsData.find(s => s.id === selectedStudentId), [studentsData, selectedStudentId]);

    // 해당 학생의 기존 결과 불러오기 및 초기화 (유지)
    useEffect(() => {
        if (selectedStudentId) {
            const existing = grades[selectedStudentId]?.[test.id]?.correctCount || {};
            setResultMapping(existing);
            
            const existingComment = grades[selectedStudentId]?.[test.id]?.comment || '';
            setStudentComment(existingComment);
            
            setTimeout(() => {
                const firstInput = inputRefs.current[`${selectedStudentId}-0`];
                if (firstInput) {
                    firstInput.focus();
                }
            }, 0);
        }
    }, [selectedStudentId, test.id, grades, isOpen]); 

    // 채점 상태 변경 핸들러 (유지)
    const handleResultChange = (qNum, forceStatus = null) => {
        const currentStatus = resultMapping[qNum] || '미채점';
        let newStatus;
        
        if (forceStatus) {
            newStatus = forceStatus;
        } else {
            // 상태 순환: 미채점 -> 맞음 -> 틀림 -> 고침 -> 미채점
            if (currentStatus === '맞음') newStatus = '틀림';
            else if (currentStatus === '틀림') newStatus = '고침';
            else if (currentStatus === '고침') newStatus = '미채점'; 
            else newStatus = '맞음'; 
        }

        setResultMapping(prev => {
            const newMap = { ...prev };
            if (newStatus === '미채점') {
                delete newMap[qNum];
            } else {
                newMap[qNum] = newStatus;
            }
            return newMap;
        });
    };
    
    // 키보드 입력 및 이동 로직 (유지)
    const handleKeyDown = (e, qNum, qIndex) => {
        const totalQuestions = test.totalQuestions;

        // 1. 상태 입력 (1=맞음, 2=틀림)
        if (e.key === '1' || e.key === '2') {
            e.preventDefault();
            const status = e.key === '1' ? '맞음' : '틀림';

            handleResultChange(qNum, status);

            if (qIndex < totalQuestions - 1) {
                setTimeout(() => {
                    const nextInput = inputRefs.current[`${selectedStudentId}-${qIndex + 1}`];
                    if (nextInput) nextInput.focus();
                }, 0);
            }
        } 
        // 2. 초기화 (Delete/Backspace)
        else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            handleResultChange(qNum, '미채점');
        }
        // 3. 이동 (방향키)
        else if (e.key === 'ArrowRight' && qIndex < totalQuestions - 1) {
            e.preventDefault();
            const nextInput = inputRefs.current[`${selectedStudentId}-${qIndex + 1}`];
            if (nextInput) nextInput.focus();
        } else if (e.key === 'ArrowLeft' && qIndex > 0) {
            e.preventDefault();
            const prevInput = inputRefs.current[`${selectedStudentId}-${qIndex - 1}`];
            if (prevInput) prevInput.focus();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
             e.preventDefault(); 
        }
    };

    // 현재 점수 계산 로직 (유지)
    const calculateCurrentScore = useMemo(() => {
        let score = 0;
        Object.keys(resultMapping).forEach(qNum => {
            const status = resultMapping[qNum];
            const qIndex = Number(qNum) - 1;
            const qScore = test.questionScores[qIndex] || 0;
            
            if (status === '맞음' || status === '고침') {
                score += qScore;
            }
        });
        return score.toFixed(1);
    }, [resultMapping, test.questionScores]);
    
    // 🚨 FIX: 저장 후 모달 유지
    const handleSubmit = (isNoShow = false) => {
        if (selectedStudentId === null) return;
        
        const action = isNoShow ? "미응시 처리" : "점수 저장";
        
        if (window.confirm(`${selectedStudent.name} 학생의 성적을 ${action}하시겠습니까?\n저장 후에도 모달이 유지됩니다.`)) {
            const finalResult = isNoShow ? '미응시' : resultMapping;
            
            // 코멘트와 함께 성적 업데이트
            handleUpdateGrade(selectedStudentId, test.id, finalResult, studentComment); 
            
            // 🚨 onClose() 호출 제거! (모달 유지)
        }
    };

    const studentsInClass = studentsData.filter(s => grades[s.id]?.[test.id] !== undefined || s.status === '재원생');

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${test.name} 문항별 채점`} maxWidth="max-w-6xl">
            <div className='flex space-x-4 h-[70vh]'>
                {/* 왼쪽: 학생 목록 및 점수 요약 */}
                <div className='w-1/4 space-y-3 border-r pr-4 overflow-y-auto'>
                    <h4 className='text-sm font-bold text-gray-700'>학생 선택 ({test.maxScore}점 만점)</h4>
                    {studentsInClass.map(student => {
                        const studentScore = grades[student.id]?.[test.id]?.score;
                        const scoreDisplay = studentScore === null ? '미응시' : (studentScore === undefined ? '-' : `${Number(studentScore).toFixed(1)}점`);
                        const isSelected = student.id === selectedStudentId;
                        
                        return (
                            <div 
                                key={student.id} 
                                onClick={() => setSelectedStudentId(student.id)}
                                className={`p-2 rounded-lg cursor-pointer flex justify-between items-center transition ${isSelected ? 'bg-indigo-100 border border-indigo-500' : 'hover:bg-gray-100 border'}`}
                            >
                                <span className={`text-sm font-medium ${isSelected ? 'text-indigo-800' : 'text-gray-700'}`}>{student.name}</span>
                                <span className={`text-xs font-bold ${studentScore === null ? 'text-red-500' : 'text-gray-800'}`}>{scoreDisplay}</span>
                            </div>
                        );
                    })}
                </div>
                
                {/* 오른쪽: 채점 그리드 및 코멘트 */}
                <div className='flex-1 space-y-4 min-w-0 flex flex-col'>
                    {selectedStudentId === null ? (
                        <p className="text-gray-500">채점을 시작할 학생을 선택해주세요.</p>
                    ) : (
                        <>
                            <div className='p-3 bg-red-50 border border-red-300 rounded-lg flex justify-between items-center flex-shrink-0'>
                                <h5 className='text-lg font-bold text-red-800'>
                                    {selectedStudent.name} 학생 채점 중: 현재 점수 <span className='text-2xl ml-2'>{calculateCurrentScore}</span>점
                                </h5>
                                <div className='space-x-2'>
                                    <button 
                                        type='button' 
                                        onClick={() => handleSubmit(true)}
                                        className='px-4 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700'
                                    >
                                        <Icon name="x" className='w-4 h-4 inline mr-1'/> 미응시 처리
                                    </button>
                                    <button 
                                        type='button' 
                                        onClick={() => handleSubmit(false)}
                                        className='px-4 py-2 text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700'
                                    >
                                        <Icon name="save" className='w-4 h-4 inline mr-1'/> 점수 저장
                                    </button>
                                </div>
                            </div>
                            
                            {/* 문항별 셀 크기 축소 및 그림자 제거 */}
                            <div className='grid grid-cols-10 gap-1 overflow-y-auto pr-2 flex-grow' style={{ maxHeight: 'calc(100% - 160px)' }}> 
                                {Array.from({ length: test.totalQuestions }, (_, i) => i + 1).map(qNum => {
                                    const qIndex = qNum - 1;
                                    const score = test.questionScores[qIndex] || 0;
                                    const status = resultMapping[qNum.toString()] || '미채점';
                                    const statusClass = getStatusColor(status);
                                    
                                    return (
                                        <div 
                                            key={qNum} 
                                            onClick={() => handleResultChange(qNum.toString())}
                                            tabIndex={0}
                                            onKeyDown={(e) => handleKeyDown(e, qNum.toString(), qIndex)}
                                            ref={el => inputRefs.current[`${selectedStudentId}-${qIndex}`] = el}
                                            className={`p-1 rounded-lg border cursor-pointer transition duration-150 text-center relative text-xs font-semibold
                                            ${status === '미채점' ? 'bg-gray-100 hover:bg-gray-200' : `bg-white hover:opacity-80 border-2 ${statusClass.replace('text', 'border')}`}
                                            focus:outline-none focus:border-blue-500`}
                                        >
                                            <p>{qNum}. ({score}점)</p>
                                            <p className={`text-sm font-bold mt-1 ${statusClass}`}>{status}</p>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            {/* 코멘트 박스 (오버플로우 수정) */}
                            <div className='space-y-1 pt-3 border-t flex-shrink-0'>
                                <h4 className='text-sm font-bold text-gray-700'>교직원 코멘트 (학생/학부모 공유용)</h4>
                                <textarea 
                                    value={studentComment}
                                    onChange={(e) => setStudentComment(e.target.value)}
                                    rows="2"
                                    className='w-full p-2 border rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500'
                                    placeholder={`${selectedStudent.name} 학생의 시험 특이사항, 다음 학습 지도 방향 등`}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
};