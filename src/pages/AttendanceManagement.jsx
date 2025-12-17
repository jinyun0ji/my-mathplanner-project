import React, { useState, useMemo, useEffect } from 'react';
import { Icon, formatGradeLabel } from '../utils/helpers';
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
    const [mobileView, setMobileView] = useState('attendance');

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

    useEffect(() => {
        if (!selectedClassId) setMobileView('class');
    }, [selectedClassId]);


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
        <div className="space-y-3">
            <div className="xl:hidden bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setMobileView('class')}
                        className={`py-2 px-3 rounded-lg text-sm font-semibold transition ${mobileView === 'class' ? 'bg-indigo-900 text-white shadow-md' : 'bg-gray-100 text-gray-700'}`}
                    >
                        클래스 선택
                    </button>
                    <button
                        onClick={() => setMobileView('attendance')}
                        className={`py-2 px-3 rounded-lg text-sm font-semibold transition ${mobileView === 'attendance' ? 'bg-indigo-900 text-white shadow-md' : 'bg-gray-100 text-gray-700'}`}
                    >
                        출결 현황/입력
                    </button>
                </div>
                <div className="mt-3 text-xs text-gray-600 flex items-center justify-between">
                    <span className="font-semibold">{selectedClass ? selectedClass.name : '클래스를 선택하세요'}</span>
                    <span className="font-mono text-[11px] text-gray-500">{selectedDate}</span>
                </div>
            </div>
            
            <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 h-full">
                <div className={`w-full xl:w-80 flex-shrink-0 ${mobileView === 'class' ? 'block' : 'hidden'} xl:block`}>
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
                </div>

                <div className={`flex-1 min-w-0 space-y-4 ${mobileView === 'attendance' ? 'block' : 'hidden'} xl:block`}>
                    {selectedClassId === null ? (
                        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                            <p className="text-gray-500">클래스를 선택하고 날짜를 지정하여 출결을 관리하세요.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-indigo-900">
                                <h3 className="text-xl font-bold text-gray-800 leading-snug">
                                    {selectedClass.name} |
                                    <span className="text-indigo-900 ml-2">{selectedDate}</span>
                                </h3>
                                <button
                                    onClick={() => setIsAttendanceModalOpen(true)}
                                    className="bg-indigo-900 hover:bg-indigo-800 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center shadow-md transition duration-150 w-full md:w-auto"
                                >
                                    <Icon name="edit" className="w-5 h-5 mr-2" />
                                    출결 기록 / 수정
                                </button>
                            </div>
                        
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <h4 className="text-lg font-bold mb-4 border-b pb-2 text-gray-800">학생별 출결 현황 ({classStudents.length}명)</h4>
                            
                                <div className="overflow-x-auto rounded-lg border border-gray-200 hidden md:block">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                {['이름', '학년/학교', '상태', '메모'].map(header => (
                                                    <th key={header} className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                                        {header}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {classStudents.map(student => {
                                                const attendance = classAttendance.find(log => log.studentId === student.id);
                                                const status = attendance?.status || '미기록';
                                            
                                            let statusColor = 'text-gray-500';
                                                if (status === '출석') statusColor = 'text-green-700';
                                                else if (status === '지각') statusColor = 'text-yellow-600';
                                                else if (status === '결석') statusColor = 'text-red-600 font-bold';
                                                else if (status === '동영상보강') statusColor = 'text-indigo-700';

                                                const memoContent = studentMemos[student.id];

                                                return (
                                                    <tr key={student.id} className="hover:bg-indigo-50 transition-colors">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{student.name}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatGradeLabel(student.grade)} / {student.school}</td>
                                                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${statusColor}`}>{status}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                            <button
                                                                onClick={() => openMemoModal(student)}
                                                                className={`flex items-center text-xs px-2 py-1 rounded-full transition-colors ${
                                                                    memoContent
                                                                        ? 'bg-yellow-100 text-yellow-800'
                                                                        : 'bg-gray-100 text-gray-500 hover:bg-indigo-100 hover:text-indigo-900'
                                                                }`}
                                                            >
                                                                <Icon name="fileText" className="w-4 h-4 mr-1" />
                                                                {memoContent ? '메모 있음' : '메모 작성'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="grid gap-3 md:hidden">
                                    {classStudents.map(student => {
                                        const attendance = classAttendance.find(log => log.studentId === student.id);
                                        const status = attendance?.status || '미기록';

                                        let statusColor = 'bg-gray-100 text-gray-600';
                                        if (status === '출석') statusColor = 'bg-green-100 text-green-700';
                                        else if (status === '지각') statusColor = 'bg-yellow-100 text-yellow-700';
                                        else if (status === '결석') statusColor = 'bg-red-100 text-red-700';
                                        else if (status === '동영상보강') statusColor = 'bg-indigo-100 text-indigo-800';

                                        const memoContent = studentMemos[student.id];

                                        return (
                                            <div key={student.id} className="p-4 border border-gray-200 rounded-xl shadow-sm bg-white space-y-2">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="text-base font-bold text-gray-900">{student.name}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5">{formatGradeLabel(student.grade)} · {student.school}</p>
                                                    </div>
                                                    <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${statusColor}`}>
                                                        {status}
                                                    </span>
                                                </div>
                                                <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-700 flex items-center justify-between">
                                                    <p className="font-semibold text-gray-700">기록 날짜</p>
                                                    <p className="font-mono text-[11px]">{selectedDate}</p>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <button
                                                        onClick={() => openMemoModal(student)}
                                                        className={`text-sm font-semibold px-3 py-2 rounded-lg border transition ${
                                                            memoContent
                                                                ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                                                : 'bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-900'
                                                        }`}
                                                    >
                                                        {memoContent ? '메모 확인' : '메모 작성'}
                                                    </button>
                                                    <button
                                                        onClick={() => setIsAttendanceModalOpen(true)}
                                                        className="text-sm font-semibold px-3 py-2 rounded-lg bg-indigo-900 text-white hover:bg-indigo-800 transition"
                                                    >
                                                        출결 입력
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
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