// src/utils/modals/ClinicScheduleModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/common/Modal';
import { Icon } from '../../utils/helpers';

export const ClinicScheduleModal = ({ isOpen, onClose, onSave, students, defaultDate, clinicLogs, classes }) => {
    const [date, setDate] = useState(defaultDate);
    const [selectedStudentIds, setSelectedStudentIds] = useState([]); 
    const [plannedTime, setPlannedTime] = useState('14:00');

    useEffect(() => {
        if (isOpen) {
            setDate(defaultDate);
            setSelectedStudentIds([]); 
            setPlannedTime('14:00');
        }
    }, [isOpen, defaultDate]);

    const getClassNameString = (student) => {
        if (!student.classes || student.classes.length === 0) return '클래스 미정';
        
        const classNames = student.classes
            .map(clsId => classes?.find(c => c.id === clsId)?.name)
            .filter(Boolean);
            
        return classNames.length > 0 ? classNames.join(', ') : '클래스 미정';
    };

    // ✅ [수정] 그룹핑 기준: 클래스명만 사용
    const groupedStudents = useMemo(() => {
        return students.reduce((acc, student) => {
            const className = getClassNameString(student);
            
            // 학교 제외하고 클래스명으로만 그룹핑
            const key = className;
            
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(student);
            return acc;
        }, {});
    }, [students, classes]);

    const handleStudentToggle = (id) => {
        setSelectedStudentIds(prev => 
            prev.includes(id) 
                ? prev.filter(sId => sId !== id) 
                : [...prev, id]
        );
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (selectedStudentIds.length === 0 || !date) {
            alert("날짜와 최소 한 명 이상의 학생을 선택하세요.");
            return;
        }

        const duplicates = [];
        const uniqueStudentIds = [];

        selectedStudentIds.forEach(sId => {
            const isDuplicate = clinicLogs.some(log => log.date === date && log.studentId === sId && !!log.plannedTime);
            if (isDuplicate) {
                const student = students.find(s => s.id === sId);
                const className = getClassNameString(student);
                duplicates.push(`${student ? student.name : 'Unknown'} (${className})`);
            } else {
                uniqueStudentIds.push(sId);
            }
        });

        if (duplicates.length > 0) {
            alert(`다음 학생들은 이미 ${date}에 예약이 되어 있어 제외됩니다:\n${duplicates.join('\n')}`);
        }

        if (uniqueStudentIds.length === 0) {
             if (duplicates.length === 0) alert("등록할 학생이 없습니다.");
             return;
        }

        const newLogs = uniqueStudentIds.map(sId => {
            const student = students.find(s => s.id === sId);
            return {
                id: null,
                studentId: sId,
                studentName: student ? student.name : 'Unknown',
                date,
                plannedTime,
                checkIn: '',
                checkOut: '',
                comment: '',
                tutor: '',
                notificationSent: false,
                status: 'pending',
            };
        });

        newLogs.forEach(log => onSave(log, false)); 
        
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="클리닉 예약" maxWidth="max-w-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">날짜</label>
                        <input 
                            type="date" 
                            value={date} 
                            onChange={(e) => setDate(e.target.value)} 
                            required
                            className="w-full border rounded-md p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">참석 예정 시간 (선택)</label>
                        <input 
                            type="time" 
                            value={plannedTime} 
                            onChange={(e) => setPlannedTime(e.target.value)} 
                            className="w-full border rounded-md p-2"
                        />
                        <p className='text-xs text-gray-500 mt-1'>체크된 학생들의 기본 참석 예정 시간입니다.</p>
                    </div>
                </div>
                
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">클리닉 참석 학생 선택* (총 {students.length}명)</label>
                    <div className="border rounded-md p-3 max-h-80 overflow-y-auto bg-gray-50">
                        {Object.entries(groupedStudents).map(([groupName, groupStudents]) => (
                            <div key={groupName} className="mb-4 border-b pb-3 last:border-b-0">
                                <h5 className="text-sm font-bold text-indigo-700 mb-2 p-1 border-l-4 border-indigo-400 pl-2 bg-white rounded-sm shadow-sm">
                                    {groupName} ({groupStudents.length}명)
                                </h5>
                                <div className="grid grid-cols-3 gap-2">
                                    {groupStudents.map(s => (
                                        <div 
                                            key={s.id} 
                                            className={`flex items-start p-2 rounded-lg cursor-pointer transition border ${selectedStudentIds.includes(s.id) ? 'bg-indigo-100 border-indigo-500 shadow-sm' : 'bg-white hover:bg-gray-100'}`}
                                            onClick={() => handleStudentToggle(s.id)}
                                        >
                                            <input 
                                                type="checkbox" 
                                                checked={selectedStudentIds.includes(s.id)} 
                                                onChange={() => {}} 
                                                className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 mr-2 flex-shrink-0" 
                                            />
                                            <div className='flex flex-col text-sm'>
                                                {/* ✅ [수정] 이름 뒤에 번호 뒤4자리 추가 */}
                                                <span className="font-bold text-gray-900">
                                                    {s.name} <span className="text-gray-500 font-normal text-xs">({s.phone ? s.phone.slice(-4) : '----'})</span>
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className='text-xs text-gray-500 mt-1'>체크된 모든 학생에 대해 일정이 등록됩니다.</p>
                </div>

                <div className="pt-4 flex justify-end space-x-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg text-sm">취소</button>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">총 {selectedStudentIds.length}명 예약</button>
                </div>
            </form>
        </Modal>
    );
};