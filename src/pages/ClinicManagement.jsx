import React, { useState, useMemo } from 'react';
import { Icon } from '../utils/helpers';
import { ClinicLogModal } from '../utils/modals/ClinicLogModal'; // 경로 수정

export default function ClinicManagement({ students, clinicLogs, handleSaveClinicLog, handleDeleteClinicLog, classes }) {
    
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [logToEdit, setLogToEdit] = useState(null);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));

    const filteredLogs = useMemo(() => {
        return clinicLogs
            .filter(log => log.date === filterDate)
            .sort((a, b) => new Date(b.checkIn) - new Date(a.checkIn));
    }, [clinicLogs, filterDate]);

    const studentMap = useMemo(() => {
        return students.reduce((map, student) => {
            map[student.id] = student;
            return map;
        }, {});
    }, [students]);

    const handleEditLog = (log) => {
        setLogToEdit(log);
        setIsLogModalOpen(true);
    };

    const handleNewLog = () => {
        setLogToEdit(null);
        setIsLogModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-800">클리닉 활동 로그</h3>
            
            <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <div className='flex items-center space-x-3'>
                        <label className="text-lg font-medium text-gray-700">날짜 선택:</label>
                        <input
                            type="date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <button 
                        onClick={handleNewLog}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg flex items-center shadow-md transition duration-150"
                    >
                        <Icon name="plus" className="w-5 h-5 mr-2" />
                        로그 기록하기
                    </button>
                </div>

                <h4 className="text-xl font-semibold mb-3">{filterDate} 클리닉 현황 ({filteredLogs.length}건)</h4>
                
                <div className="overflow-x-auto rounded-lg border max-h-[70vh] overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                {['이름', '학교/학년', '입퇴실 시간', '총 시간', '담당 조교', '활동 내용', '관리'].map(header => (
                                    <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredLogs.map(log => {
                                const student = studentMap[log.studentId];
                                const startTime = log.checkIn;
                                const endTime = log.checkOut;
                                
                                let duration = '-';
                                if (startTime && endTime) {
                                    try {
                                        const start = new Date(`2000/01/01 ${startTime}`);
                                        const end = new Date(`2000/01/01 ${endTime}`);
                                        let diffMs = end - start;
                                        if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; // 다음날 넘어가는 경우 보정
                                        const hours = Math.floor(diffMs / 3600000);
                                        const minutes = Math.floor((diffMs % 3600000) / 60000);
                                        duration = `${hours > 0 ? hours + 'h' : ''} ${minutes}m`.trim();
                                    } catch {}
                                }
                                
                                return (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.studentName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">고{student?.grade || '-'} / {student?.school || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {log.checkIn} ~ {log.checkOut || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">{duration}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.tutor}</td>
                                    <td className="px-6 py-4 text-sm text-gray-700 max-w-sm truncate" title={log.comment}>{log.comment}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex space-x-2">
                                            <button 
                                                type="button" 
                                                onClick={(e) => {e.stopPropagation(); handleEditLog(log);}}
                                                className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-100"
                                                title="수정"
                                            >
                                                <Icon name="edit" className="w-5 h-5" />
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={(e) => {e.stopPropagation(); if(window.confirm('정말 이 클리닉 로그를 삭제하시겠습니까?')) handleDeleteClinicLog(log.id);}}
                                                className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-100"
                                                title="삭제"
                                            >
                                                <Icon name="trash" className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );})}
                        </tbody>
                    </table>
                </div>
            </div>

            <ClinicLogModal
                isOpen={isLogModalOpen}
                onClose={() => setIsLogModalOpen(false)}
                onSave={handleSaveClinicLog}
                logToEdit={logToEdit}
                students={students}
                defaultDate={filterDate}
                classes={classes}
            />
        </div>
    );
};