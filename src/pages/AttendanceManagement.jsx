import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../utils/helpers';
import ClassSelectionPanel from '../components/Shared/ClassSelectionPanel'; 
import { AttendanceModal } from '../components/common/AttendanceModal'; 
import { MemoModal } from '../utils/modals/MemoModal'; 

export default function AttendanceManagement({ 
    students, classes, attendanceLogs, handleSaveAttendance, 
    studentMemos, handleSaveMemo, handleSaveClass, calculateClassSessions 
}) {
    const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
    const [memoModalState, setMemoModalState] = useState({ isOpen: false, studentId: null, content: '', studentName: '' });

    const selectedClass = classes.find(c => c.id === selectedClassId);

    const classAttendance = useMemo(() => {
        if (!selectedClassId || !selectedDate) return [];
        return attendanceLogs.filter(log => log.classId === selectedClassId && log.date === selectedDate);
    }, [attendanceLogs, selectedClassId, selectedDate]);

    const classStudents = useMemo(() => {
        if (!selectedClass) return [];
        return students.filter(s => selectedClass.students.includes(s.id) && s.status === '재원생').sort((a, b) => a.name.localeCompare(b.name));
    }, [students, selectedClass]);

    const initialAttendanceForModal = useMemo(() => {
        const initial = {};
        classStudents.forEach(s => {
            const existingLog = classAttendance.find(log => log.studentId === s.id);
            initial[s.id] = existingLog || { 
                classId: selectedClassId, 
                date: selectedDate, 
                studentId: s.id, 
                status: null
            };
        });
        return initial;
    }, [classStudents, classAttendance, selectedClassId, selectedDate]);
    
    const sessionDates = useMemo(() => {
        if (!selectedClass) return [];
        return calculateClassSessions(selectedClass);
    }, [selectedClass, calculateClassSessions]);

    useEffect(() => {
        if (selectedClassId) {
            const today = new Date().toISOString().slice(0, 10);
            
            const pastAndCurrentSessions = sessionDates.filter(s => s.date <= today);
            const isSelectedDateValid = sessionDates.some(s => s.date === selectedDate);
            
            if (!isSelectedDateValid && pastAndCurrentSessions.length > 0) {
                const mostRecentDate = pastAndCurrentSessions[pastAndCurrentSessions.length - 1].date;
                setSelectedDate(mostRecentDate);
            } else if (!isSelectedDateValid && sessionDates.length > 0) {
                 setSelectedDate(sessionDates[0].date);
            }
        }
    }, [selectedClassId, sessionDates]);


    const handleDateNavigate = (direction) => {
        const currentIndex = sessionDates.findIndex(s => s.date === selectedDate);
        if (currentIndex === -1) return;

        const newIndex = currentIndex + direction;
        
        if (newIndex >= 0 && newIndex < sessionDates.length) {
            setSelectedDate(sessionDates[newIndex].date);
        }
    };

    const openMemoModal = (student) => {
        setMemoModalState({
            isOpen: true,
            studentId: student.id,
            content: studentMemos[student.id] || '',
            studentName: student.name,
        });
    };

    const closeMemoModal = () => {
        setMemoModalState({ isOpen: false, studentId: null, content: '', studentName: '' });
    };

    return (
        <div className="flex space-x-6 h-full">
            <ClassSelectionPanel
                classes={classes}
                selectedClassId={selectedClassId}
                setSelectedClassId={setSelectedClassId}
                handleClassSave={handleSaveClass}
                calculateClassSessions={calculateClassSessions}
                showSessions={true}
                selectedDate={selectedDate}
                showEditButton={true}
                customPanelContent={null} 
                customPanelTitle="수업 날짜 선택"
                onDateSelect={setSelectedDate} 
            />
            <div className="flex-1 min-w-0">
                {selectedClassId === null ? (
                    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                        <p className="text-gray-500">클래스를 선택하고 날짜를 지정하여 출결을 관리하세요.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* [색상 변경] border-blue-500 -> border-indigo-900 */}
                        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-indigo-900">
                            <h3 className="text-xl font-bold text-gray-800">
                                {selectedClass.name} | 
                                {/* [색상 변경] text-blue-600 -> text-indigo-900 */}
                                <span className="text-indigo-900 ml-2">{selectedDate}</span>
                            </h3>
                            {/* [색상 변경] bg-blue-600 -> bg-indigo-900 */}
                            <button 
                                onClick={() => setIsAttendanceModalOpen(true)}
                                className="bg-indigo-900 hover:bg-indigo-800 text-white font-medium py-2 px-4 rounded-lg flex items-center shadow-md transition duration-150"
                            >
                                <Icon name="edit" className="w-5 h-5 mr-2" />
                                출결 기록 / 수정
                            </button>
                        </div>
                        
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <h4 className="text-lg font-bold mb-4 border-b pb-2 text-gray-800">학생별 출결 현황 ({classStudents.length}명)</h4>
                            
                            <div className="overflow-x-auto rounded-lg border border-gray-200">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            {['이름', '학년/학교', '상태', '클리닉 희망', '메모'].map(header => (
                                                <th key={header} className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">{header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {classStudents.map(student => {
                                            const attendance = classAttendance.find(log => log.studentId === student.id);
                                            const status = attendance?.status || '미기록';
                                            
                                            let statusColor = 'text-gray-500';
                                            if (status === '출석') statusColor = 'text-green-700'; // 톤 다운
                                            else if (status === '지각') statusColor = 'text-yellow-600';
                                            else if (status === '결석') statusColor = 'text-red-600 font-bold';
                                            else if (status === '동영상보강') statusColor = 'text-indigo-700'; // Indigo로 통일

                                            const memoContent = studentMemos[student.id];

                                            return (
                                                <tr key={student.id} className="hover:bg-indigo-50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{student.name}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">고{student.grade} / {student.school}</td>
                                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${statusColor}`}>{status}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.clinicTime || '-'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                        <button 
                                                            onClick={() => openMemoModal(student)}
                                                            className={`flex items-center text-xs px-2 py-1 rounded-full transition-colors ${
                                                                memoContent 
                                                                    ? 'bg-yellow-100 text-yellow-800' 
                                                                    : 'bg-gray-100 text-gray-500 hover:bg-indigo-100 hover:text-indigo-900'
                                                            }`}
                                                        >
                                                            <Icon name="fileText" className="w-4 h-4 mr-1"/>
                                                            {memoContent ? '메모 있음' : '메모 작성'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <AttendanceModal
                isOpen={isAttendanceModalOpen}
                onClose={() => setIsAttendanceModalOpen(false)}
                studentsData={classStudents}
                initialAttendance={initialAttendanceForModal}
                onSave={handleSaveAttendance}
            />
            <MemoModal
                isOpen={memoModalState.isOpen}
                onClose={closeMemoModal}
                onSave={handleSaveMemo}
                studentId={memoModalState.studentId}
                initialContent={memoModalState.content}
                studentName={memoModalState.studentName}
            />
        </div>
    );
};