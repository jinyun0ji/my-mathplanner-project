import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Icon, formatGradeLabel, formatClassScheduleKo } from '../../utils/helpers';
import { ClassFormModal } from '../../utils/modals/ClassFormModal';
import { isClosedClass, sortClassesWithClosedLast, formatClassLabel } from '../../utils/classStatus';

export default function ClassSelectionPanel({ 
    classes, selectedClassId, setSelectedClassId, handleClassSave, calculateClassSessions, 
    showSessions = true, selectedDate, handleDateNavigate, showEditButton = false, 
    customPanelContent = null, customPanelTitle = '수업 회차',
    onDateSelect 
}) {
    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false); // ✅ [추가] 편집 모드 상태 관리
    const orderedClasses = useMemo(() => sortClassesWithClosedLast(classes), [classes]);
    const selectedClass = classes.find(c => String(c.id) === String(selectedClassId));
    const isSelectedClassClosed = isClosedClass(selectedClass);
    const selectedClassGrade = selectedClass ? formatGradeLabel(selectedClass.grade) : '';
    const selectedStudentCount = selectedClass
        ? (selectedClass.students?.length ?? 0)
        : 0;
    
    // Ref 설정: 선택된 항목을 참조할 Ref 객체
    const selectedItemRef = useRef(null); 
    
    // useEffect로 선택 항목이 변경될 때 스크롤 이동
    useEffect(() => {
        if (selectedItemRef.current) {
            selectedItemRef.current.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        }
    }, [selectedDate, selectedClassId]);

    // 수업 회차 목록
    const sessions = useMemo(() => selectedClass ? calculateClassSessions(selectedClass) : [], [selectedClass, calculateClassSessions]);
    const displaySessions = sessions;
    
    return (
        <div className="w-full xl:w-80 flex-shrink-0 bg-white p-4 rounded-xl shadow-md space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-lg font-bold text-gray-800">클래스 선택</h3>
                <button 
                    // ✅ [수정] 새 클래스 버튼: 편집 모드 끄고 모달 열기
                    onClick={() => { setIsEditMode(false); setIsClassModalOpen(true); }}
                    className="text-blue-500 hover:text-blue-700 text-sm font-medium flex items-center"
                >
                    <Icon name="plus" className="w-4 h-4 mr-1" />
                    새 클래스
                </button>
            </div>
            
            <select
                value={selectedClassId || ''}
                onChange={e => setSelectedClassId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 focus:ring-indigo-500 focus:border-indigo-500"
            >
                <option value="" disabled>클래스를 선택하세요</option>
                {orderedClasses.map(cls => (
                    <option key={cls.id} value={cls.id}>
                        {formatClassLabel(cls, { includeClosedBadge: true })}
                    </option>
                ))}
            </select>

            {selectedClass && (
                <div className={`border p-3 rounded-lg space-y-2 ${isSelectedClassClosed ? 'bg-gray-100 border-gray-300' : 'bg-indigo-50 border-indigo-100'}`}>
                    <p className={`text-sm font-semibold ${isSelectedClassClosed ? 'text-gray-700' : 'text-indigo-700'}`}>
                        {selectedClassGrade || '학년 미정'} | {formatClassScheduleKo(selectedClass) || '시간 미정'}
                    </p>
                    <p className={`text-xs ${isSelectedClassClosed ? 'text-gray-600' : 'text-indigo-600'}`}>
                        총 학생: {selectedStudentCount}명
                        {isSelectedClassClosed ? ' · 종강 클래스' : ''}
                    </p>
                    {showEditButton && (
                        <button 
                            // ✅ [수정] 수정 버튼: 편집 모드 켜고 모달 열기
                            onClick={() => { setIsEditMode(true); setIsClassModalOpen(true); }}
                            className={`text-xs font-medium flex items-center ${isSelectedClassClosed ? 'text-gray-500 hover:text-gray-700' : 'text-indigo-500 hover:text-indigo-700'}`}
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
                    </h4>
                    {customPanelContent || (
                        <ul className="space-y-1 max-h-48 overflow-y-auto pr-2 text-sm">
                            {[...displaySessions].reverse().map(session => {
                                const isSelected = session.date === selectedDate;
                                return (
                                    <li 
                                        key={session.date} 
                                        onClick={() => onDateSelect && onDateSelect(session.date)}
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
                // ✅ [수정] 편집 모드일 때만 선택된 클래스 정보 전달
                classToEdit={isEditMode ? selectedClass : null}
            />
        </div>
    );
};