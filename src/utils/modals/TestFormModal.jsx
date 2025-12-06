// src/utils/modals/TestFormModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/common/Modal';
import { Icon, calculateClassSessions } from '../../utils/helpers';

export const TestFormModal = ({ isOpen, onClose, onSave, classId, test = null, classes, calculateClassSessions }) => {
    const selectedClass = classes.find(c => c.id === classId);
    const sessions = useMemo(() => selectedClass ? calculateClassSessions(selectedClass) : [], [selectedClass, calculateClassSessions]);

    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [maxScore, setMaxScore] = useState(100);
    const [totalQuestions, setTotalQuestions] = useState(20);
    // 문항별 배점 배열 (예: [5, 5, 5, ...])
    const [questionScores, setQuestionScores] = useState([]); 

    useEffect(() => {
        if (test) {
            setName(test.name);
            setDate(test.date);
            setMaxScore(test.maxScore);
            setTotalQuestions(test.totalQuestions);
            // 기존 배점 데이터를 사용하거나, 총 문항 수에 맞춰 기본값(100/N)으로 초기화
            setQuestionScores(test.questionScores || Array(test.totalQuestions).fill(test.maxScore / test.totalQuestions));
        } else {
            setName('');
            setDate(sessions.length > 0 ? sessions[sessions.length - 1].date : new Date().toISOString().slice(0, 10));
            setMaxScore(100);
            setTotalQuestions(20);
            setQuestionScores(Array(20).fill(5));
        }
    }, [test, sessions]);
    
    // 문항 수가 변경될 때마다 questionScores 배열 크기를 조정
    useEffect(() => {
        const newCount = Number(totalQuestions);
        if (newCount > 0) {
            setQuestionScores(prevScores => {
                const newScores = [...prevScores];
                // 기존 점수를 유지하면서 배열 크기 조정
                while (newScores.length < newCount) {
                    newScores.push(maxScore / newCount); // 새로운 항목은 평균 점수로 채움
                }
                newScores.length = newCount;
                return newScores;
            });
        }
    }, [totalQuestions, maxScore]);
    
    // 개별 배점 변경 핸들러
    const handleScoreChange = (index, value) => {
        const newScore = Number(value);
        if (newScore < 0) return;

        setQuestionScores(prevScores => {
            const updatedScores = [...prevScores];
            updatedScores[index] = newScore;
            
            // 총점 자동 계산 및 maxScore 업데이트
            const newMaxScore = updatedScores.reduce((sum, score) => sum + (Number(score) || 0), 0);
            setMaxScore(newMaxScore);
            
            return updatedScores;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name || !date || Number(maxScore) <= 0 || Number(totalQuestions) <= 0) return;

        const testData = {
            id: test ? test.id : null,
            classId,
            name,
            date,
            maxScore: Number(maxScore),
            totalQuestions: Number(totalQuestions),
            // 최종 계산된 배점 배열 저장
            questionScores: questionScores.map(s => Number(s)), 
        };
        onSave(testData, !!test);
        onClose();
    };

    if (!selectedClass) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={test ? '시험 정보 수정' : `${selectedClass.name} 새 시험 등록`} maxWidth="max-w-3xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">시험명*</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">시험일*</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">총 문항 수*</label>
                        <input type="number" value={totalQuestions} onChange={e => setTotalQuestions(e.target.value)} required min="1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                    </div>
                </div>
                
                <div className="border p-3 rounded-lg bg-yellow-50">
                    <h4 className="text-base font-semibold text-gray-800">문항별 배점 설정 ({totalQuestions} 문항)</h4>
                    <p className="text-sm text-gray-600 mb-2">총점: <span className="font-bold text-red-600">{maxScore.toFixed(1)}</span>점 (입력되는 개별 배점에 따라 자동 계산)</p>
                    <div className="grid grid-cols-6 gap-2 max-h-60 overflow-y-auto pr-2">
                        {Array.from({ length: totalQuestions }).map((_, index) => (
                            <div key={index} className="flex items-center text-xs">
                                <label className="w-5 font-medium">{index + 1}.</label>
                                <input 
                                    type="number" 
                                    value={questionScores[index] || ''} 
                                    onChange={e => handleScoreChange(index, e.target.value)}
                                    step="0.1" 
                                    min="0"
                                    className="w-full rounded-md border-gray-300 shadow-sm p-1 border text-center text-sm"
                                    placeholder="점수"
                                />
                            </div>
                        ))}
                    </div>
                    {totalQuestions > 0 && maxScore === 0 && (
                        <p className="text-sm text-red-500 mt-2 flex items-center"><Icon name="alert" className="w-4 h-4 mr-1"/> 배점의 총합이 0점입니다. 점수를 입력해주세요.</p>
                    )}
                </div>

                <div className="pt-4 border-t flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition duration-150">
                        취소
                    </button>
                    <button type="submit" disabled={maxScore <= 0} className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 transition duration-150 shadow-md disabled:bg-red-300">
                        {test ? '수정 사항 저장' : '등록하기'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};