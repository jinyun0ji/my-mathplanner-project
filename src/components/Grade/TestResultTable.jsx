import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Icon } from '../../utils/helpers';
import { Modal } from '../../components/common/Modal'; 
import { getTotalScore } from '../../domain/grade/grade.service';

const RESULT_OPTIONS_GRADE = { 
    '맞음': 'text-green-600 bg-green-50 border-green-200', 
    '틀림': 'text-red-600 bg-red-50 border-red-200', 
    '미채점': 'text-gray-400 bg-gray-50 border-gray-200' 
};

const getStatusStyle = (statusKey) => RESULT_OPTIONS_GRADE[statusKey] || RESULT_OPTIONS_GRADE['미채점'];

export default function TestResultTable({ isOpen, onClose, test, studentsData, handleUpdateGrade, grades }) {
    
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [resultMapping, setResultMapping] = useState({});
    const [studentComment, setStudentComment] = useState('');
    
    // ✅ 저장되지 않은 변경사항 확인용 상태
    const [isDirty, setIsDirty] = useState(false);

    const inputRefs = useRef({});

    const studentsInClass = useMemo(
        () => studentsData,
        [studentsData]
    );

    useEffect(() => {
        if (isOpen && !selectedStudentId && studentsInClass.length > 0) {
            setSelectedStudentId(studentsInClass[0].id);
        }
    }, [isOpen, studentsInClass, selectedStudentId]);

    const selectedStudent = useMemo(() => 
        studentsData.find(s => s.id === selectedStudentId), 
    [studentsData, selectedStudentId]);

    useEffect(() => {
        if (selectedStudentId) {
            const existing = grades[selectedStudentId]?.[test.id]?.correctCount || {};
            setResultMapping(existing);
            const existingComment = grades[selectedStudentId]?.[test.id]?.comment || '';
            setStudentComment(existingComment);
            setIsDirty(false); // 학생 변경 시 초기화
            
            setTimeout(() => {
                const firstInput = inputRefs.current[`${selectedStudentId}-0`];
                if (firstInput) firstInput.focus();
            }, 50);
        }
    }, [selectedStudentId, test.id, grades]); 

    // ✅ 모달 닫기 시 보호 로직
    const handleCloseWrapper = () => {
        if (isDirty) {
            if (!window.confirm("저장하지 않은 성적이 있습니다. 정말 닫으시겠습니까?")) {
                return;
            }
        }
        setIsDirty(false);
        onClose();
    };

    const handleResultChange = (qNum, forceStatus = null) => {
        const currentStatus = resultMapping[qNum] || '미채점';
        let newStatus;
        if (forceStatus) newStatus = forceStatus;
        else {
            if (currentStatus === '맞음') newStatus = '틀림';
            else if (currentStatus === '틀림') newStatus = '미채점'; 
            else newStatus = '맞음'; 
        }

        setResultMapping(prev => {
            const newMap = { ...prev };
            if (newStatus === '미채점') delete newMap[qNum];
            else newMap[qNum] = newStatus;
            return newMap;
        });
        setIsDirty(true); // 변경 발생
    };
    
    const handleKeyDown = (e, qNum, qIndex) => {
        const totalQuestions = test.totalQuestions;
        if (e.key === '1') {
            e.preventDefault();
            handleResultChange(qNum, '맞음');
            moveFocus(qIndex + 1);
        } else if (e.key === '2') {
            e.preventDefault();
            handleResultChange(qNum, '틀림');
            moveFocus(qIndex + 1);
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            handleResultChange(qNum, '미채점');
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            moveFocus(qIndex + 1);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            moveFocus(qIndex - 1);
        }
    };

    const moveFocus = (targetIndex) => {
        if (targetIndex >= 0 && targetIndex < test.totalQuestions) {
            const nextInput = inputRefs.current[`${selectedStudentId}-${targetIndex}`];
            if (nextInput) nextInput.focus();
        }
    };

    const calculateCurrentScore = useMemo(() => {
        const score = getTotalScore({ correctCount: resultMapping }, test);
        return Number.isFinite(score) ? score.toFixed(1) : '-';
    }, [resultMapping, test]);
    
    const handleSubmit = (isNoShow = false) => {
        if (!selectedStudentId) return;
        
        const finalResult = isNoShow ? '미응시' : resultMapping;
        handleUpdateGrade(selectedStudentId, test.id, finalResult, studentComment);
        
        setIsDirty(false); // 저장 완료 처리

        const currentIndex = studentsInClass.findIndex(s => s.id === selectedStudentId);
        const nextStudent = studentsInClass[currentIndex + 1];

        if (nextStudent) {
            setTimeout(() => {
                setSelectedStudentId(nextStudent.id);
            }, 100); 
        }
    };

    return (
        // onClose를 handleCloseWrapper로 교체
        <Modal isOpen={isOpen} onClose={handleCloseWrapper} title={`${test.name} 문항별 채점`} maxWidth="max-w-6xl">
            <div className='flex space-x-4 h-[70vh]'>
                <div className='w-1/4 space-y-2 border-r pr-4 overflow-y-auto custom-scrollbar'>
                    <h4 className='text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide'>학생 목록 ({studentsInClass.length})</h4>
                    {studentsInClass.map(student => {
                        const scoreData = grades[student.id]?.[test.id] || {};
                        const totalScore = getTotalScore(scoreData, test);
                        const scoreDisplay = scoreData.score === null && totalScore === null
                            ? '미응시'
                            : Number.isFinite(totalScore)
                                ? totalScore.toFixed(1)
                                : '-';
                        const isSelected = student.id === selectedStudentId;
                        
                        return (
                            <div 
                                key={student.id} 
                                onClick={() => {
                                    if(isDirty) {
                                        if(!window.confirm("저장하지 않은 성적이 있습니다. 이동하시겠습니까?")) return;
                                    }
                                    setSelectedStudentId(student.id);
                                }}
                                className={`px-3 py-2 rounded-md cursor-pointer flex justify-between items-center transition text-sm
                                ${isSelected ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-gray-100 text-gray-700'}`}
                            >
                                <span className="font-medium">{student.name}</span>
                                <span className={`font-bold ${isSelected ? 'text-white' : (scoreDisplay === '미응시' ? 'text-red-500' : 'text-gray-900')}`}>
                                    {scoreDisplay}
                                </span>
                            </div>
                        );
                    })}
                </div>
                
                <div className='flex-1 space-y-3 min-w-0 flex flex-col'>
                    {selectedStudentId === null ? (
                        <div className="flex items-center justify-center h-full text-gray-400">학생을 선택해주세요.</div>
                    ) : (
                        <>
                            <div className='flex justify-between items-center p-2 bg-gray-50 rounded-lg border border-gray-200'>
                                <div className='flex items-baseline space-x-2'>
                                    <h5 className='text-lg font-bold text-gray-800'>{selectedStudent.name}</h5>
                                    <span className='text-2xl font-bold text-blue-600'>{calculateCurrentScore}</span>
                                    <span className='text-xs text-gray-500'>/ {test.maxScore}점</span>
                                    {isDirty && <span className='text-xs text-red-500 font-bold ml-2'>* 변경됨 (저장 필요)</span>}
                                </div>
                                <div className='space-x-2' onClick={e => e.stopPropagation()}> 
                                    <button 
                                        type='button' 
                                        onClick={(e) => { e.stopPropagation(); handleSubmit(true); }}
                                        className='px-3 py-1.5 text-xs font-bold rounded text-white bg-red-500 hover:bg-red-600 transition'
                                    >
                                        미응시 & 다음
                                    </button>
                                    <button 
                                        type='button' 
                                        onClick={(e) => { handleSubmit(false); }}
                                        className='px-3 py-1.5 text-xs font-bold rounded text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm'
                                    >
                                        저장 & 다음 (Enter)
                                    </button>
                                </div>
                            </div>
                            
                            <div className='flex-grow overflow-y-auto pr-1 custom-scrollbar'>
                                <div className='grid grid-cols-10 gap-1'> 
                                    {Array.from({ length: test.totalQuestions }, (_, i) => i + 1).map(qNum => {
                                        const qIndex = qNum - 1;
                                        const score = Array.isArray(test?.questionScores)
                                            ? Number(test.questionScores[qIndex] ?? 0)
                                            : 0;
                                        const status = resultMapping[qNum.toString()] || '미채점';
                                        const styleClass = getStatusStyle(status);
                                        
                                        return (
                                            <div 
                                                key={qNum} 
                                                onClick={() => handleResultChange(qNum.toString())}
                                                tabIndex={0}
                                                onKeyDown={(e) => handleKeyDown(e, qNum.toString(), qIndex)}
                                                ref={el => inputRefs.current[`${selectedStudentId}-${qIndex}`] = el}
                                                className={`
                                                    relative flex flex-col items-center justify-center 
                                                    h-12 border rounded cursor-pointer transition select-none 
                                                    ${styleClass}
                                                    focus:outline-none focus:ring-2 focus:ring-blue-400 focus:z-10
                                                `}
                                            >
                                                <div className='text-[10px] text-gray-500 leading-none absolute top-1 left-1'>
                                                    {qNum}. <span className='text-gray-400'>({score}점)</span>
                                                </div>
                                                <div className={`text-sm font-bold mt-2 ${status === '미채점' ? 'opacity-0' : 'opacity-100'}`}>
                                                    {status === '맞음' ? 'O' : (status === '틀림' ? 'X' : '')}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            <div className='pt-2 border-t mt-auto'>
                                <input 
                                    value={studentComment}
                                    onChange={(e) => { setStudentComment(e.target.value); setIsDirty(true); }}
                                    className='w-full px-3 py-2 border rounded text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition'
                                    placeholder="특이사항 입력 (Enter 키를 누르면 저장하고 다음 학생으로 이동합니다)"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSubmit(false); 
                                        }
                                    }}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
};