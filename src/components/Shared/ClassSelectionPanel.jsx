import React, { useState, useMemo } from 'react';
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
    
    // 수업 회차 목록
    const sessions = useMemo(() => selectedClass ? calculateClassSessions(selectedClass) : [], [selectedClass, calculateClassSessions]);

    const sessionsBeforeSelectedDate = useMemo(() => {
        if (!selectedDate) return sessions;
        return sessions.filter(s => s.date <= selectedDate);
    }, [sessions, selectedDate]);


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
                        {customPanelTitle} ({sessionsBeforeSelectedDate.length}회)
                        {handleDateNavigate && selectedDate && (
                            <div className="flex space-x-1">
                                <button type="button" onClick={() => handleDateNavigate(-1)} className="p-1 rounded-full hover:bg-gray-200 text-gray-600">
                                    <Icon name="arrow-left" className="w-4 h-4"/>
                                </button>
                                <button type="button" onClick={() => handleDateNavigate(1)} className="p-1 rounded-full hover:bg-gray-200 text-gray-600 rotate-180">
                                    <Icon name="arrow-left" className="w-4 h-4"/>
                                </button>
                            </div>
                        )}
                    </h4>
                    {customPanelContent || (
                        <ul className="space-y-1 max-h-48 overflow-y-auto pr-2 text-sm">
                            {[...sessionsBeforeSelectedDate].reverse().map(session => (
                                <li 
                                    key={session.date} 
                                    onClick={() => onDateSelect && onDateSelect(session.date)}
                                    className={`p-2 rounded-lg transition ${
                                        session.date === selectedDate 
                                            ? 'bg-blue-100 font-bold text-blue-700' 
                                            : 'text-gray-600 hover:bg-gray-50'
                                    } ${onDateSelect ? 'cursor-pointer' : ''}`}
                                >
                                    <span className="font-mono text-xs mr-2">{session.date}</span>
                                    {session.session}회차
                                </li>
                            ))}
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