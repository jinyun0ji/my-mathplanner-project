import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Icon } from '../../utils/helpers';
import { ClassFormModal } from '../../utils/modals/ClassFormModal';

export default function ClassSelectionPanel({ 
    classes, selectedClassId, setSelectedClassId, handleClassSave, calculateClassSessions, 
    showSessions = true, selectedDate, handleDateNavigate, showEditButton = false, 
    customPanelContent = null, customPanelTitle = '수업 회차',
    onDateSelect 
}) {
    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    const selectedClass = classes.find(c => c.id === selectedClassId);
    
    // 1. Ref 설정: 선택된 항목을 참조할 Ref 객체
    const selectedItemRef = useRef(null); 
    
    // 2. useEffect로 선택 항목이 변경될 때 스크롤 이동
    useEffect(() => {
        if (selectedItemRef.current) {
            // 선택된 항목이 가장 가까운 위치에 보이도록 스크롤합니다. (페이지 점프 방지)
            selectedItemRef.current.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        }
    }, [selectedDate, selectedClassId]); // 선택 날짜나 클래스가 바뀌면 실행

    // 수업 회차 목록 (모든 세션을 포함합니다.)
    const sessions = useMemo(() => selectedClass ? calculateClassSessions(selectedClass) : [], [selectedClass, calculateClassSessions]);

    // 🚨 수정: 필터링 로직 제거. sessionsBeforeSelectedDate 대신 sessions를 사용합니다.
    const displaySessions = sessions;
    
    return (
        <div className="w-80 flex-shrink-0 bg-white p-4 rounded-xl shadow-md space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-lg font-bold text-gray-800">클래스 선택</h3>
                <button 
                    onClick={() => setIsClassModalOpen(true)}
                    className="text-blue-500 hover:text-blue-700 text-sm font-medium flex items-center"
                >
                    <Icon name="plus" className="w-4 h-4 mr-1" />
                    새 클래스
                </button>
            </div>
            
            <select
                value={selectedClassId || ''}
                onChange={e => setSelectedClassId(Number(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 focus:ring-indigo-500 focus:border-indigo-500"
            >
                <option value="" disabled>클래스를 선택하세요</option>
                {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name} ({cls.teacher})</option>
                ))}
            </select>

            {selectedClass && (
                <div className="border p-3 rounded-lg bg-indigo-50 space-y-2">
                    <p className="text-sm font-semibold text-indigo-700">고{selectedClass.grade} | {selectedClass.schedule.days.join(', ')} ({selectedClass.schedule.time})</p>
                    <p className="text-xs text-indigo-600">총 학생: {selectedClass.students.length}명</p>
                    {showEditButton && (
                        <button 
                            onClick={() => setIsClassModalOpen(true)}
                            className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center"
                        >
                            <Icon name="edit" className="w-4 h-4 mr-1" />
                            클래스 정보 수정
                        </button>
                    )}
                </div>
            )}

            {selectedClass && showSessions && (
                <div className="pt-2 border-t">
                    <h4 className="text-base font-bold mb-2 flex justify-between items-center text-gray-800">
                        {customPanelTitle} ({sessions.length}회)
                        {/* 좌우 이동 버튼은 제거되었습니다. */}
                    </h4>
                    {customPanelContent || (
                        <ul className="space-y-1 max-h-48 overflow-y-auto pr-2 text-sm">
                            {/* 🚨 수정: 모든 세션을 역순으로 표시 (최신 회차가 상단) */}
                            {[...displaySessions].reverse().map(session => {
                                const isSelected = session.date === selectedDate;
                                
                                return (
                                    <li 
                                        key={session.date} 
                                        onClick={() => onDateSelect && onDateSelect(session.date)}
                                        // 3. Ref 연결: 선택된 항목에 Ref를 연결합니다.
                                        ref={isSelected ? selectedItemRef : null} 
                                        className={`p-2 rounded-lg transition ${
                                            isSelected 
                                                ? 'bg-blue-100 font-bold text-blue-700' 
                                                : 'text-gray-600 hover:bg-gray-50'
                                        } ${onDateSelect ? 'cursor-pointer' : ''}`}
                                    >
                                        <span className="font-mono text-xs mr-2">{session.date}</span>
                                        {session.session}회차
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
            
            <ClassFormModal
                isOpen={isClassModalOpen}
                onClose={() => setIsClassModalOpen(false)}
                onSave={handleClassSave}
                classToEdit={selectedClass}
            />
        </div>
    );
};