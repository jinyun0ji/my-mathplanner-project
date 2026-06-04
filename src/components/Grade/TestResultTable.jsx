import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Modal } from '../../components/common/Modal';
import { getTotalScore, isAbsentGrade } from '../../domain/grade/grade.service';

const RESULT_OPTIONS_GRADE = {
    맞음: 'text-green-600 bg-green-50 border-green-200',
    틀림: 'text-red-600 bg-red-50 border-red-200',
    미채점: 'text-gray-400 bg-gray-50 border-gray-200',
};

const getStatusStyle = (statusKey) => RESULT_OPTIONS_GRADE[statusKey] || RESULT_OPTIONS_GRADE.미채점;

export default function TestResultTable({ isOpen, onClose, test, studentsData, handleUpdateGrade, grades }) {
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [resultMapping, setResultMapping] = useState({});
    const [isDirty, setIsDirty] = useState(false);

    const inputRefs = useRef({});
    const studentsInClass = useMemo(() => studentsData, [studentsData]);

    useEffect(() => {
        if (!isOpen) return;
        if (!studentsInClass.length) {
            setSelectedStudentId(null);
            return;
        }
        if (!selectedStudentId || !studentsInClass.some((s) => s.id === selectedStudentId)) {
            setSelectedStudentId(studentsInClass[0].id);
        }
    }, [isOpen, studentsInClass, selectedStudentId]);

    const selectedStudent = useMemo(
        () => studentsData.find((s) => s.id === selectedStudentId),
        [studentsData, selectedStudentId],
    );

    useEffect(() => {
        if (!isOpen || !selectedStudentId) return;
        const existing = grades[selectedStudentId]?.[test.id]?.correctCount || {};
        setResultMapping(existing);
        setIsDirty(false);

        setTimeout(() => {
            const firstInput = inputRefs.current[`${selectedStudentId}-0`];
            if (firstInput) firstInput.focus();
        }, 30);
    }, [isOpen, selectedStudentId, test.id, grades]);

    const handleCloseWrapper = () => {
        if (isDirty && !window.confirm('저장하지 않은 성적이 있습니다. 정말 닫으시겠습니까?')) return;
        setIsDirty(false);
        onClose();
    };

    const handleResultChange = (qNum, forceStatus = null) => {
        const currentStatus = resultMapping[qNum] || '미채점';
        let newStatus = forceStatus;
        if (!newStatus) {
            if (currentStatus === '맞음') newStatus = '틀림';
            else if (currentStatus === '틀림') newStatus = '미채점';
            else newStatus = '맞음';
        }

        setResultMapping((prev) => {
            const next = { ...prev };
            if (newStatus === '미채점') delete next[qNum];
            else next[qNum] = newStatus;
            return next;
        });
        setIsDirty(true);
    };

    const moveFocus = (targetIndex) => {
        if (targetIndex < 0 || targetIndex >= test.totalQuestions) return;
        inputRefs.current[`${selectedStudentId}-${targetIndex}`]?.focus();
    };
    
    const handleKeyDown = (e, qNum, qIndex) => {
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

    const calculateCurrentScore = useMemo(() => {
        const score = getTotalScore({ correctCount: resultMapping }, test);
        return Number.isFinite(score) ? score.toFixed(1) : '-';
    }, [resultMapping, test]);
    
    const moveToNextStudent = () => {
        const idx = studentsInClass.findIndex((s) => s.id === selectedStudentId);
        const next = studentsInClass[idx + 1];
        if (next) setSelectedStudentId(next.id);
    };

    const handleSubmit = (isNoShow = false) => {
        if (!selectedStudentId) return;
        handleUpdateGrade(selectedStudentId, test.id, isNoShow ? '미응시' : resultMapping, '');
        setIsDirty(false);
        moveToNextStudent();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleCloseWrapper} title={`${test.name} 문항별 채점`} maxWidth="max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-4 min-h-[60vh]">
                <div className="border rounded-lg p-3 space-y-2 bg-gray-50 max-h-[62vh] overflow-y-auto">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">학생 목록 ({studentsInClass.length})</h4>
                    {studentsInClass.map((student) => {
                        const scoreData = grades[student.id]?.[test.id] || {};
                        const totalScore = isAbsentGrade(scoreData) ? null : getTotalScore(scoreData, test);
                        const scoreDisplay = totalScore === null ? '미응시' : Number.isFinite(totalScore) ? totalScore.toFixed(1) : '-';
                        const isSelected = student.id === selectedStudentId;
                        return (
                            <button
                                type="button"
                                key={student.id}
                                onClick={() => {
                                    if (isDirty && !window.confirm('저장하지 않은 성적이 있습니다. 이동하시겠습니까?')) return;
                                    setSelectedStudentId(student.id);
                                }}
                                className={`w-full text-left rounded-md border px-3 py-2 flex items-center justify-between ${isSelected ? 'bg-[#f1f4ff] border-[#cfd8ff]' : 'bg-white border-gray-200 hover:bg-gray-100'}`}
                            >
                                <span className="text-sm font-semibold text-gray-800">{student.name}</span>
                                <span className={`text-xs font-bold ${scoreDisplay === '미응시' ? 'text-red-500' : 'text-gray-700'}`}>{scoreDisplay}</span>
                            </button>
                        );
                    })}
                </div>
                
                 <div className="border rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-[#455fab] flex flex-col min-h-[62vh]">
                    {selectedStudentId === null ? (
                        <div className="flex items-center justify-center h-full text-gray-400">학생을 선택해주세요.</div>
                    ) : (
                        <>
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-baseline gap-2">
                                    <h5 className="text-lg font-bold text-gray-800">{selectedStudent?.name}</h5>
                                    <span className="text-2xl font-bold text-[#334a91]">{calculateCurrentScore}</span>
                                    <span className="text-xs text-gray-500">/ {test.maxScore}점</span>
                                </div>
                                {isDirty && <span className="text-xs text-red-500 font-bold">* 변경됨</span>}
                            </div>
                            
                            <div className="flex-grow overflow-y-auto pr-1">
                                <div className="grid grid-cols-10 gap-1">
                                    {Array.from({ length: test.totalQuestions }, (_, i) => i + 1).map((qNum) => {
                                        const qIndex = qNum - 1;
                                        const score = Array.isArray(test?.questionScores) ? Number(test.questionScores[qIndex] ?? 0) : 0;
                                        const status = resultMapping[qNum.toString()] || '미채점';
                                        return (
                                            <div
                                                key={qNum}
                                                onClick={() => handleResultChange(qNum.toString())}
                                                tabIndex={0}
                                                onKeyDown={(e) => handleKeyDown(e, qNum.toString(), qIndex)}
                                                ref={(el) => {
                                                    inputRefs.current[`${selectedStudentId}-${qIndex}`] = el;
                                                }}
                                                className={`relative flex flex-col items-center justify-center h-12 border rounded cursor-pointer transition select-none ${getStatusStyle(status)} focus:outline-none focus:ring-2 focus:ring-[#455fab] focus:z-10`}
                                            >
                                                <div className="text-[10px] text-gray-500 leading-none absolute top-1 left-1">{qNum}. ({score}점)</div>
                                                <div className={`text-sm font-bold mt-2 ${status === '미채점' ? 'opacity-0' : 'opacity-100'}`}>
                                                    {status === '맞음' ? 'O' : status === '틀림' ? 'X' : ''}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            <div className="pt-3 mt-3 border-t flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleSubmit(true)}
                                    className="px-4 py-2 text-sm font-semibold rounded-md border border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                                >
                                    미응시
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSubmit(false)}
                                    className="px-4 py-2 text-sm font-semibold rounded-md bg-[#455fab] text-white hover:bg-[#3b5198] disabled:bg-[#cfd8ff]"
                                >
                                    저장
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
};