// src/utils/modals/ClinicScheduleModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Icon } from '../../utils/helpers';

// ✅ clinicLogs prop 추가
export const ClinicScheduleModal = ({ isOpen, onClose, onSave, students, defaultDate, clinicLogs }) => {
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

        // ✅ 중복 예약 확인 로직
        const duplicates = [];
        const uniqueStudentIds = [];

        selectedStudentIds.forEach(sId => {
            const isDuplicate = clinicLogs.some(log => log.date === date && log.studentId === sId);
            if (isDuplicate) {
                const student = students.find(s => s.id === sId);
                duplicates.push(student ? student.name : 'Unknown');
            } else {
                uniqueStudentIds.push(sId);
            }
        });

        if (duplicates.length > 0) {
            alert(`다음 학생들은 이미 ${date}에 예약이 되어 있어 제외됩니다:\n${duplicates.join(', ')}`);
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
                notificationSent: false,
            };
        });

        // ✅ 중복되지 않은 학생들만 저장
        newLogs.forEach(log => onSave(log, false)); 
        
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="클리닉 예약" maxWidth="max-w-xl">
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
                    <label className="block text-sm font-bold text-gray-700 mb-2">클리닉 참석 학생 선택*</label>
                    <div className="border rounded-md p-3 max-h-60 overflow-y-auto bg-gray-50">
                        <div className="grid grid-cols-3 gap-2">
                            {students.map(s => (
                                <div 
                                    key={s.id} 
                                    className={`flex items-center p-2 rounded-lg cursor-pointer transition ${selectedStudentIds.includes(s.id) ? 'bg-indigo-100 border-indigo-500 border-2' : 'bg-white border'}`}
                                    onClick={() => handleStudentToggle(s.id)}
                                >
                                    <input 
                                        type="checkbox" 
                                        checked={selectedStudentIds.includes(s.id)} 
                                        onChange={() => handleStudentToggle(s.id)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 mr-2" 
                                    />
                                    <span className="text-sm font-medium text-gray-800">{s.name}</span>
                                </div>
                            ))}
                        </div>
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