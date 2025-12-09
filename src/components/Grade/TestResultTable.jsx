import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../../utils/helpers'; // 경로 수정
import { Modal } from '../../components/common/Modal'; // 경로 수정

const RESULT_OPTIONS_GRADE = { '맞음': 'text-green-600', '틀림': 'text-red-600', '고침': 'text-blue-600', '미채점': 'text-gray-500' };

const getStatusColor = (statusKey) => {
    return RESULT_OPTIONS_GRADE[statusKey] || 'text-gray-500';
};

export default function TestResultTable({ isOpen, onClose, test, studentsData, handleUpdateGrade, grades }) {
    
    const [selectedStudentId, setSelectedStudentId] = useState(studentsData[0]?.id || null);
    const [resultMapping, setResultMapping] = useState({});
    
    const selectedStudent = useMemo(() => studentsData.find(s => s.id === selectedStudentId), [studentsData, selectedStudentId]);

    // 해당 학생의 기존 결과 불러오기
    useEffect(() => {
        if (selectedStudentId) {
            const existing = grades[selectedStudentId]?.[test.id]?.correctCount || {};
            setResultMapping(existing);
        }
    }, [selectedStudentId, test.id, grades]);
    
    // 채점 상태 변경 핸들러
    const handleResultChange = (qNum) => {
        const currentStatus = resultMapping[qNum] || '미채점';
        let newStatus;
        
        // 상태 순환: 미채점 -> 맞음 -> 틀림 -> 고침 -> 미채점
        if (currentStatus === '맞음') newStatus = '틀림';
        else if (currentStatus === '틀림') newStatus = '고침';
        else if (currentStatus === '고침') newStatus = '미채점'; 
        else newStatus = '맞음'; 
        
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
    
    const handleSubmit = (isNoShow = false) => {
        if (selectedStudentId === null) return;
        
        const finalResult = isNoShow ? '미응시' : resultMapping;
        
        handleUpdateGrade(selectedStudentId, test.id, finalResult);
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
                
                {/* 오른쪽: 채점 그리드 */}
                <div className='flex-1 space-y-4 min-w-0'>
                    {selectedStudentId === null ? (
                        <p className="text-gray-500">채점을 시작할 학생을 선택해주세요.</p>
                    ) : (
                        <>
                            <div className='p-3 bg-red-50 border border-red-300 rounded-lg flex justify-between items-center'>
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
                            
                            <div className='grid grid-cols-10 gap-2 overflow-y-auto pr-2 h-[55vh]'>
                                {Array.from({ length: test.totalQuestions }, (_, i) => i + 1).map(qNum => {
                                    const qIndex = qNum - 1;
                                    const score = test.questionScores[qIndex] || 0;
                                    const status = resultMapping[qNum] || '미채점';
                                    const statusClass = getStatusColor(status);
                                    
                                    return (
                                        <div 
                                            key={qNum} 
                                            onClick={() => handleResultChange(qNum.toString())}
                                            className={`p-2 rounded-lg border cursor-pointer transition duration-150 text-center ${status === '미채점' ? 'bg-gray-100 hover:bg-gray-200' : `bg-white hover:opacity-80 border-2 ${statusClass.replace('text', 'border')}`}`}
                                        >
                                            <p className='text-xs font-bold'>{qNum}. ({score}점)</p>
                                            <p className={`text-sm font-bold mt-1 ${statusClass}`}>{status}</p>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            <div className='flex space-x-4 text-sm mt-3'>
                                <p className="flex items-center"><span className="w-3 h-3 rounded-full bg-green-500 mr-1"></span> 맞음</p>
                                <p className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-500 mr-1"></span> 틀림</p>
                                <p className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-500 mr-1"></span> 고침</p>
                                <p className="flex items-center"><span className="w-3 h-3 rounded-full bg-gray-500 mr-1"></span> 미채점</p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
};