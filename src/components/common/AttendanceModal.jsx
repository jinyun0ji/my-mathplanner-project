// src/components/common/AttendanceModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Icon, formatGradeLabel } from '../../utils/helpers';

export const AttendanceModal = ({ isOpen, onClose, studentsData, initialAttendance, onSave }) => {
    const [attendance, setAttendance] = useState({});

    useEffect(() => {
        setAttendance(initialAttendance);
    }, [initialAttendance, isOpen]);

    const handleStatusChange = (studentId, status) => {
        setAttendance(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], status }
        }));
    };
    
    const handleSubmit = (e) => {
        e.preventDefault();
        // ✅ [수정] status가 null인(미입력) 항목은 저장하지 않고 필터링
        const validRecords = Object.values(attendance).filter(record => record.status);
        onSave(validRecords);
        onClose();
    };

    const studentList = studentsData.filter(s => attendance[s.id]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="출결 현황 기록" maxWidth="max-w-3xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="max-h-[60vh] overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">상태 선택</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {studentList.map(student => (
                                <tr key={student.id}>
                                    <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {student.name} <span className="text-xs text-gray-500">({formatGradeLabel(student.grade) || '학년 정보 없음'})</span>
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap">
                                        <div className="flex flex-wrap justify-center gap-2 text-xs sm:text-sm">
                                            {['출석', '지각', '결석', '동영상보강'].map(status => (
                                                <button
                                                    type="button"
                                                    key={status}
                                                    onClick={() => handleStatusChange(student.id, status)}
                                                    className={`px-3 py-1 rounded-full border transition duration-150 min-w-[72px] ${
                                                        attendance[student.id]?.status === status
                                                            ? 'bg-blue-600 text-white border-blue-700 shadow-md'
                                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                                                    }`}
                                                >
                                                    {status}
                                                </button>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="pt-4 border-t flex justify-between items-center">
                    <p className="text-sm text-gray-600 flex items-center">
                        <Icon name="info" className="w-4 h-4 mr-1 text-blue-500"/>
                        미기록 학생은 자동으로 '결석' 처리되지 않습니다.
                    </p>
                    <button type="submit" className="px-6 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition duration-150 shadow-md">
                        출결 기록 저장
                    </button>
                </div>
            </form>
        </Modal>
    );
};