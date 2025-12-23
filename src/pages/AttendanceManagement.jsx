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

    const attendanceSummary = useMemo(() => {
        const summary = { total: classStudents.length, 출석: 0, 지각: 0, 결석: 0, 동영상보강: 0, 미기록: 0 };
        classStudents.forEach(student => {
            const status = classAttendance.find(log => log.studentId === student.id)?.status || '미기록';
            if (summary[status] !== undefined) summary[status] += 1;
            else summary.미기록 += 1;
        });
        return summary;
    }, [classStudents, classAttendance]);

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

    const currentSessionIndex = useMemo(() => sessionDates.findIndex(s => s.date === selectedDate), [sessionDates, selectedDate]);
    const hasPrevSession = currentSessionIndex > 0;
    const hasNextSession = currentSessionIndex > -1 && currentSessionIndex < sessionDates.length - 1;

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
    }, [selectedClassId, sessionDates, selectedDate]);

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

    const statusBadgeStyles = {
        '출석': 'bg-green-50 text-green-800 border-green-200',
        '지각': 'bg-yellow-50 text-yellow-700 border-yellow-200',
        '결석': 'bg-red-50 text-red-700 border-red-200',
        '동영상보강': 'bg-indigo-50 text-indigo-800 border-indigo-200',
        '미기록': 'bg-gray-50 text-gray-600 border-gray-200'
    };

    return (
        <div className="space-y-3">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <Icon name="calendar" className="w-4 h-4 text-indigo-800" />
                        <span>{selectedClass ? selectedClass.name : '클래스를 선택하세요'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleDateNavigate(-1)}
                            disabled={!hasPrevSession}
                            className={`flex items-center px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                                hasPrevSession ? 'text-gray-700 border-gray-200 hover:border-indigo-300 hover:text-indigo-800' : 'text-gray-400 border-gray-100 cursor-not-allowed'
                            }`}
                        >
                            <Icon name="chevronLeft" className="w-4 h-4" />
                            이전 회차
                        </button>
                        <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs font-bold text-gray-700">
                            {selectedDate || '날짜 선택'}
                        </div>
                        <button
                            onClick={() => handleDateNavigate(1)}
                            disabled={!hasNextSession}
                            className={`flex items-center px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                                hasNextSession ? 'text-gray-700 border-gray-200 hover:border-indigo-300 hover:text-indigo-800' : 'text-gray-400 border-gray-100 cursor-not-allowed'
                            }`}
                        >
                            다음 회차
                            <Icon name="chevronRight" className="w-4 h-4 ml-1" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
                    {[
                        { label: '총원', value: attendanceSummary.total, tone: 'bg-gray-50 text-gray-700 border-gray-200' },
                        { label: '출석', value: attendanceSummary['출석'], tone: 'bg-green-50 text-green-800 border-green-200' },
                        { label: '지각', value: attendanceSummary['지각'], tone: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
                        { label: '결석', value: attendanceSummary['결석'], tone: 'bg-red-50 text-red-700 border-red-200' },
                        { label: '동영상', value: attendanceSummary['동영상보강'], tone: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
                    ].map(item => (
                        <div key={item.label} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${item.tone}`}>
                            <span className="font-semibold">{item.label}</span>
                            <span className="font-bold">{item.value}</span>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 h-full">
                <div className="w-full xl:w-80 flex-shrink-0">
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

                <div className="flex-1 min-w-0 space-y-4">
                    {selectedClassId === null ? (
                        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                            <p className="text-gray-500">클래스를 선택하고 날짜를 지정하여 출결을 관리하세요.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-indigo-900">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-bold text-gray-800 leading-snug">
                                        {selectedClass.name}
                                    </h3>
                                    <p className="text-sm text-gray-500 flex items-center gap-2">
                                        <Icon name="clock" className="w-4 h-4 text-indigo-800" />
                                        {selectedDate} 출결 입력
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                    <button
                                        onClick={() => handleDateNavigate(-1)}
                                        disabled={!hasPrevSession}
                                        className={`flex-1 md:flex-none flex items-center justify-center px-3 py-2 rounded-lg text-sm font-semibold border transition ${
                                            hasPrevSession ? 'text-gray-700 border-gray-200 hover:border-indigo-300 hover:text-indigo-800' : 'text-gray-400 border-gray-100 cursor-not-allowed'
                                        }`}
                                    >
                                        <Icon name="chevronLeft" className="w-4 h-4 mr-1" />
                                        이전
                                    </button>
                                    <button
                                        onClick={() => setIsAttendanceModalOpen(true)}
                                        className="flex-1 md:flex-none bg-indigo-900 hover:bg-indigo-800 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center shadow-md transition duration-150"
                                    >
                                        <Icon name="edit" className="w-5 h-5 mr-2" />
                                        출결 기록 / 수정
                                    </button>
                                    <button
                                        onClick={() => handleDateNavigate(1)}
                                        disabled={!hasNextSession}
                                        className={`flex-1 md:flex-none flex items-center justify-center px-3 py-2 rounded-lg text-sm font-semibold border transition ${
                                            hasNextSession ? 'text-gray-700 border-gray-200 hover:border-indigo-300 hover:text-indigo-800' : 'text-gray-400 border-gray-100 cursor-not-allowed'
                                        }`}
                                    >
                                        다음
                                        <Icon name="chevronRight" className="w-4 h-4 ml-1" />
                                    </button>
                                </div>
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
                                        const memoContent = studentMemos[student.id];
                                        const phoneSuffix = student.phone ? student.phone.slice(-4) : '';

                                        const badgeStyle = statusBadgeStyles[status] || statusBadgeStyles['미기록'];
                                        const memoStyle = memoContent ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-500 border-gray-200';

                                        return (
                                            <div key={student.id} className="p-4 border border-gray-200 rounded-xl shadow-sm bg-white space-y-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-base font-bold text-gray-900 leading-snug">{student.name}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5 truncate">{formatGradeLabel(student.grade)} · {student.school}{phoneSuffix ? ` · ${phoneSuffix}` : ''}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => openMemoModal(student)}
                                                            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold border transition ${memoStyle} hover:border-indigo-300 hover:bg-indigo-50`}
                                                            title={memoContent ? '메모 있음' : '메모 작성'}
                                                            aria-label={memoContent ? `${student.name} 메모 확인` : `${student.name} 메모 작성`}
                                                        >
                                                            <Icon name="fileText" className="w-4 h-4" />
                                                        </button>
                                                        <span className={`w-10 h-10 rounded-full border flex items-center justify-center text-[11px] font-bold ${badgeStyle}`}>
                                                            {status}
                                                        </span>
                                                    </div>
                                                </div>
                                                {memoContent && (
                                                    <p className="text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded-lg p-2 leading-snug">
                                                        {memoContent}
                                                    </p>
                                                )}
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