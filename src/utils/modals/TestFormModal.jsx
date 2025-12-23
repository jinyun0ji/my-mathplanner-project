// src/utils/modals/TestFormModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/common/Modal';
import { Icon, calculateClassSessions } from '../../utils/helpers';
import StaffNotificationFields from '../../components/Shared/StaffNotificationFields';

const DIFFICULTY_OPTIONS = ['하', '중', '상', '최상'];
const TYPE_OPTIONS = ['개념', '계산', '응용', '심화', '서술형'];

export const TestFormModal = ({ isOpen, onClose, onSave, classId, test = null, classes, calculateClassSessions }) => {
    const selectedClass = classes.find(c => c.id === classId);
    const sessions = useMemo(() => selectedClass ? calculateClassSessions(selectedClass) : [], [selectedClass, calculateClassSessions]);

    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [maxScore, setMaxScore] = useState(100);
    const [totalQuestions, setTotalQuestions] = useState(20);
    // 문항별 배점 배열 (예: [5, 5, 5, ...])
    const [questionScores, setQuestionScores] = useState([]); 
    // 🚨 문항별 분석 배열 (새로운 필드)
    const [questionAnalysis, setQuestionAnalysis] = useState([]);
    const [staffNotifyMode, setStaffNotifyMode] = useState('none');
    const [staffNotifyTitle, setStaffNotifyTitle] = useState('');
    const [staffNotifyBody, setStaffNotifyBody] = useState('');
    const [staffNotifyScheduledAt, setStaffNotifyScheduledAt] = useState('');

    const toDatetimeLocal = (value) => {
        if (!value) return '';
        const date = value instanceof Date
            ? value
            : typeof value?.toDate === 'function'
                ? value.toDate()
                : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const offset = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return offset.toISOString().slice(0, 16);
    };

    useEffect(() => {
        if (test) {
            setName(test.name);
            setDate(test.date);
            setMaxScore(test.maxScore);
            setTotalQuestions(test.totalQuestions);
            setQuestionScores(test.questionScores || Array(test.totalQuestions).fill(test.maxScore / test.totalQuestions));
            // 🚨 기존 분석 데이터 로드 또는 기본값 설정
            setQuestionAnalysis(test.questionAnalysis || Array(test.totalQuestions).fill({ difficulty: '중', type: '개념' }));
            if (test.notifyMode === 'staff' && test.staffNotification) {
                setStaffNotifyMode(test.staffNotification.mode || 'immediate');
                setStaffNotifyTitle(test.staffNotification.title || '');
                setStaffNotifyBody(test.staffNotification.body || '');
                setStaffNotifyScheduledAt(
                    test.staffNotification.mode === 'scheduled'
                        ? toDatetimeLocal(test.staffNotification.scheduledAt)
                        : ''
                );
            } else {
                setStaffNotifyMode('none');
                setStaffNotifyTitle('');
                setStaffNotifyBody('');
                setStaffNotifyScheduledAt('');
            }
        } else {
            setName('');
            setDate(sessions.length > 0 ? sessions[sessions.length - 1].date : new Date().toISOString().slice(0, 10));
            setMaxScore(100);
            setTotalQuestions(20);
            setQuestionScores(Array(20).fill(5));
            setQuestionAnalysis(Array(20).fill({ difficulty: '중', type: '개념' }));
            setStaffNotifyMode('none');
            setStaffNotifyTitle('');
            setStaffNotifyBody('');
            setStaffNotifyScheduledAt('');
        }
    }, [test, sessions]);
    
    // 문항 수가 변경될 때마다 questionScores 및 questionAnalysis 배열 크기를 조정
    useEffect(() => {
        const newCount = Number(totalQuestions);
        if (newCount > 0) {
            setQuestionScores(prevScores => {
                const newScores = [...prevScores];
                while (newScores.length < newCount) {
                    newScores.push(maxScore / newCount); 
                }
                newScores.length = newCount;
                return newScores;
            });

            // 🚨 questionAnalysis 배열 크기 조정
            setQuestionAnalysis(prevAnalysis => {
                const newAnalysis = [...prevAnalysis];
                while (newAnalysis.length < newCount) {
                    newAnalysis.push({ difficulty: '중', type: '개념' });
                }
                newAnalysis.length = newCount;
                return newAnalysis;
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

    // 🚨 문항 분석 변경 핸들러
    const handleAnalysisChange = (index, field, value) => {
        setQuestionAnalysis(prevAnalysis => {
            const updatedAnalysis = [...prevAnalysis];
            updatedAnalysis[index] = {
                ...updatedAnalysis[index],
                [field]: value
            };
            return updatedAnalysis;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name || !date || Number(maxScore) <= 0 || Number(totalQuestions) <= 0) return;

        if (staffNotifyMode !== 'none') {
            if (!staffNotifyTitle.trim() || !staffNotifyBody.trim()) {
                alert('직원 알림 제목과 내용을 입력해주세요.');
                return;
            }
            if (staffNotifyMode === 'scheduled' && !staffNotifyScheduledAt) {
                alert('직원 알림 예약 시간을 선택해주세요.');
                return;
            }
        }

        const staffNotification = staffNotifyMode === 'none'
            ? null
            : {
                mode: staffNotifyMode,
                title: staffNotifyTitle.trim(),
                body: staffNotifyBody.trim(),
                ...(staffNotifyMode === 'scheduled'
                    ? { scheduledAt: new Date(staffNotifyScheduledAt) }
                    : {}),
            };

        const testData = {
            id: test ? test.id : null,
            classId,
            name,
            date,
            maxScore: Number(maxScore),
            totalQuestions: Number(totalQuestions),
            questionScores: questionScores.map(s => Number(s)), 
            // 🚨 문항 분석 데이터 저장
            questionAnalysis: questionAnalysis,
            notifyMode: staffNotifyMode === 'none' ? 'system' : 'staff',
            staffNotification,
        };
        onSave(testData, !!test);
        onClose();
    };

    const handleStaffNotifyModeChange = (value) => {
        setStaffNotifyMode(value);
        if (value !== 'scheduled') {
            setStaffNotifyScheduledAt('');
        }
    };

    if (!selectedClass) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={test ? '시험 정보 수정' : `${selectedClass.name} 새 시험 등록`} maxWidth="max-w-5xl">
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
                    <h4 className="text-base font-bold text-gray-800 border-b pb-2">문항별 배점 및 분석 설정 ({totalQuestions} 문항)</h4>
                    <p className="text-sm text-gray-600 mb-2">총점: <span className="font-bold text-red-600">{maxScore.toFixed(1)}</span>점</p>
                    <div className="overflow-y-auto max-h-80">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className='sticky top-0 bg-yellow-100'>
                                <tr className='text-xs font-medium text-gray-700 uppercase'>
                                    <th className="w-10 px-1 py-2 text-center">문항</th>
                                    <th className="w-16 px-1 py-2 text-center">배점*</th>
                                    <th className="w-20 px-1 py-2 text-center">난이도</th>
                                    <th className="w-20 px-1 py-2 text-center">유형</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: totalQuestions }).map((_, index) => (
                                    <tr key={index} className='text-sm border-b'>
                                        <td className="w-10 px-1 py-1 text-center font-semibold">{index + 1}</td>
                                        <td className="w-16 px-1 py-1">
                                            <input 
                                                type="number" 
                                                value={questionScores[index] || ''} 
                                                onChange={e => handleScoreChange(index, e.target.value)}
                                                step="0.1" 
                                                min="0"
                                                className="w-full rounded-md border-gray-300 shadow-sm p-1 border text-center text-xs"
                                                placeholder="점수"
                                            />
                                        </td>
                                        <td className="w-20 px-1 py-1">
                                            <select 
                                                value={questionAnalysis[index]?.difficulty || '중'}
                                                onChange={e => handleAnalysisChange(index, 'difficulty', e.target.value)}
                                                className="w-full rounded-md border-gray-300 shadow-sm p-1 border text-center text-xs"
                                            >
                                                {DIFFICULTY_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                        </td>
                                        <td className="w-20 px-1 py-1">
                                            <select 
                                                value={questionAnalysis[index]?.type || '개념'}
                                                onChange={e => handleAnalysisChange(index, 'type', e.target.value)}
                                                className="w-full rounded-md border-gray-300 shadow-sm p-1 border text-center text-xs"
                                            >
                                                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {totalQuestions > 0 && maxScore === 0 && (
                        <p className="text-sm text-red-500 mt-2 flex items-center"><Icon name="alert" className="w-4 h-4 mr-1"/> 배점의 총합이 0점입니다. 점수를 입력해주세요.</p>
                    )}
                </div>

                <StaffNotificationFields
                    mode={staffNotifyMode}
                    onModeChange={handleStaffNotifyModeChange}
                    title={staffNotifyTitle}
                    onTitleChange={setStaffNotifyTitle}
                    body={staffNotifyBody}
                    onBodyChange={setStaffNotifyBody}
                    scheduledAt={staffNotifyScheduledAt}
                    onScheduledAtChange={setStaffNotifyScheduledAt}
                />

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