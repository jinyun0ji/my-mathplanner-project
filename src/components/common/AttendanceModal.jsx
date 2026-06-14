// src/components/common/AttendanceModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Icon, formatGradeLabel } from '../../utils/helpers';
import { formatStudentNameWithParentLast4 } from '../../utils/parentPhone';

export const AttendanceModal = ({ isOpen, onClose, studentsData, initialAttendance, onSave, isReadOnly = false, parentLast4Map = {} }) => {
    const [attendance, setAttendance] = useState({});
    const [loadedAttendance, setLoadedAttendance] = useState({});

    useEffect(() => {
        setAttendance(initialAttendance);
        setLoadedAttendance(initialAttendance);
    }, [initialAttendance, isOpen]);

    const handleStatusChange = (studentId, status) => {
        if (isReadOnly) return;
        setAttendance(prev => {
            const currentStatus = prev[studentId]?.status;
            const nextStatus = currentStatus === status ? null : status;
            return {
                ...prev,
                [studentId]: { ...prev[studentId], status: nextStatus }
            };
        });
    };
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (isReadOnly) return;
        const changedRecords = Object.entries(attendance)
            .filter(([, record]) => record.status)
            .filter(([studentId, record]) => {
                const initial = loadedAttendance[studentId] || {};
                return ['status', 'reason', 'memo'].some((field) => (
                    (record[field] ?? '') !== (initial[field] ?? '')
                ));
            })
            .map(([, record]) => record);
        onSave(changedRecords);
        onClose();
    };

    const studentList = studentsData.filter(s => attendance[s.id]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="출결 현황 기록" maxWidth="max-w-3xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                {isReadOnly && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        휴강일에는 출결을 수정/저장할 수 없습니다.
                    </div>
                )}
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
                                        {formatStudentNameWithParentLast4(student, parentLast4Map)} <span className="text-xs text-gray-500">({formatGradeLabel(student.grade) || '학년 정보 없음'})</span>
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap">
                                        <div className="flex flex-wrap justify-center gap-2 text-xs sm:text-sm">
                                            {['출석', '지각', '결석', '동영상보강'].map(status => (
                                                <button
                                                    type="button"
                                                    key={status}
                                                    onClick={() => handleStatusChange(student.id, status)}
                                                    disabled={isReadOnly}
                                                    className={`px-3 py-1 rounded-full border transition duration-150 min-w-[72px] ${
                                                        attendance[student.id]?.status === status
                                                            ? 'bg-[#455fab] text-white border-[#3b5198] shadow-md'
                                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                                                    } ${isReadOnly ? 'cursor-not-allowed opacity-60 hover:bg-white' : ''}`}
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
                        <Icon name="info" className="w-4 h-4 mr-1 text-[#455fab]"/>
                        미기록 학생은 자동으로 '결석' 처리되지 않습니다.
                    </p>
                    <button
                        type="submit"
                        disabled={isReadOnly}
                        className={`px-6 py-2 text-sm font-medium rounded-lg transition duration-150 shadow-md ${
                            isReadOnly
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'text-white bg-[#455fab] hover:bg-[#3b5198]'
                        }`}
                    >
                        출결 기록 저장
                    </button>
                </div>
            </form>
        </Modal>
    );
};
