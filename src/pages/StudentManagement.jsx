// src/pages/StudentManagement.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Icon } from '../utils/helpers';
import { StudentFormModal } from '../utils/modals/StudentFormModal';
import { MemoModal } from '../utils/modals/MemoModal';
import { Modal } from '../components/common/Modal'; 

export default function StudentManagement({ 
    students, classes, getClassesNames, handleSaveStudent, handleDeleteStudent, 
    attendanceLogs, studentMemos, handleSaveMemo, handlePageChange,
    studentSearchTerm, setStudentSearchTerm,
    externalSchedules,
    pendingQuickAction,
    clearPendingQuickAction
}) {
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [studentToEdit, setStudentToEdit] = useState(null);
    const [memoModalState, setMemoModalState] = useState({ isOpen: false, studentId: null, content: '', studentName: '' });
    
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [selectedStudentSchedule, setSelectedStudentSchedule] = useState({ name: '', schedules: [] });

    useEffect(() => {
        if (pendingQuickAction?.page === 'students' && pendingQuickAction.action === 'openStudentModal') {
            setStudentToEdit(null);
            setIsStudentModalOpen(true);
            clearPendingQuickAction?.();
        }
    }, [pendingQuickAction, clearPendingQuickAction]);

    const filteredStudents = useMemo(() => {
        return students.filter(student => {
            const studentClassNames = getClassesNames(student.classes);
            return (
                student.name.includes(studentSearchTerm) || 
                student.school.includes(studentSearchTerm) ||
                student.phone.includes(studentSearchTerm) ||
                studentClassNames.includes(studentSearchTerm)
            );
        }).sort((a, b) => {
            if (a.status === '재원생' && b.status !== '재원생') return -1;
            if (a.status !== '재원생' && b.status === '재원생') return 1;
            return b.registeredDate.localeCompare(a.registeredDate);
        });
    }, [students, studentSearchTerm, getClassesNames]);

    const handleEdit = (student) => { setStudentToEdit(student); setIsStudentModalOpen(true); };
    const handleNewStudent = () => { setStudentToEdit(null); setIsStudentModalOpen(true); };
    const openMemoModal = (student) => { setMemoModalState({ isOpen: true, studentId: student.id, content: studentMemos[student.id] || '', studentName: student.name }); };
    const closeMemoModal = () => { setMemoModalState({ isOpen: false, studentId: null, content: '', studentName: '' }); };

    const openScheduleModal = (student) => {
        const schedules = externalSchedules ? externalSchedules.filter(s => s.studentId === student.id) : [];
        setSelectedStudentSchedule({ name: student.name, schedules });
        setScheduleModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                    <div className="flex space-x-3 items-center w-full md:w-1/2 lg:w-1/3">
                        <Icon name="search" className="w-5 h-5 text-gray-400"/>
                        <input
                            type="text"
                            placeholder="이름, 학교, 연락처, 클래스명으로 검색..."
                            value={studentSearchTerm}
                            onChange={(e) => setStudentSearchTerm(e.target.value)}
                            className="p-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-indigo-900 focus:border-indigo-900 transition-colors"
                        />
                    </div>
                    <div className="flex w-full justify-end">
                        <button 
                            onClick={handleNewStudent}
                            className="w-full md:w-auto justify-center bg-indigo-900 hover:bg-indigo-800 text-white font-bold py-2 px-4 rounded-lg flex items-center shadow-md transition duration-150 text-sm"
                        >
                            <Icon name="plus" className="w-5 h-5 mr-2" />
                            새 학생 등록
                        </button>
                    </div>
                </div>
                
                <div className="overflow-x-auto rounded-lg border border-gray-200 hidden md:block">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                {['이름', '학교', '학년', '상태', '수강 클래스', '연락처 (학생/학부모)', '등록일', '관리'].map(header => (
                                    <th key={header} className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredStudents.map(student => {
                                // ✅ [추가] 해당 학생의 타학원 스케줄 존재 여부 확인
                                const hasExternal = externalSchedules?.some(s => s.studentId === student.id);
                                
                                return (
                                    <tr key={student.id} className="hover:bg-indigo-50 cursor-pointer transition duration-100" onClick={() => handlePageChange('students', student.id)}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                            <div className="flex items-center gap-2">
                                                <span>{student.name}</span>
                                                {student.hasAccount && (
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                                        계정 연결
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{student.school}</td>
                                        {/* 학년 표시 수정 */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{student.grade}</td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${student.status === '재원생' ? 'text-green-700' : 'text-gray-500'}`}>{student.status}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{getClassesNames(student.classes)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm"><div className="flex flex-col"><span className="text-gray-900 font-medium">{student.phone}</span><span className="text-gray-400 text-xs">부모: {student.parentPhone}</span></div></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.registeredDate}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex space-x-2">
                                                {/* ✅ [수정] 타학원 버튼: 데이터 있으면 녹색/인디고, 없으면 회색 */}
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => {e.stopPropagation(); openScheduleModal(student);}}
                                                    className={`p-1 rounded-full transition-colors ${
                                                        hasExternal 
                                                            ? 'text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 ring-1 ring-indigo-200' 
                                                            : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                                                    }`}
                                                    title={hasExternal ? "타학원 시간표 보기" : "타학원 시간표 없음"}
                                                >
                                                    <Icon name="calendar" className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => {e.stopPropagation(); openMemoModal(student);}}
                                                    className="text-gray-400 hover:text-yellow-600 p-1 rounded-full hover:bg-yellow-50 transition-colors"
                                                    title="메모"
                                                >
                                                    <Icon name="fileText" className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => {e.stopPropagation(); handleEdit(student);}}
                                                    className="text-gray-400 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-50 transition-colors"
                                                    title="수정"
                                                >
                                                    <Icon name="edit" className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => {e.stopPropagation(); if(window.confirm(`${student.name} 학생을 정말 삭제하시겠습니까?`)) handleDeleteStudent(student.id);}}
                                                    className="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
                                                    title="삭제"
                                                >
                                                    <Icon name="trash" className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* ✅ 모바일 카드 뷰 */}
                <div className="grid gap-3 md:hidden">
                    {filteredStudents.map(student => {
                        const hasExternal = externalSchedules?.some(s => s.studentId === student.id);
                        return (
                            <div 
                                key={student.id}
                                onClick={() => handlePageChange('students', student.id)}
                                className="border border-gray-200 rounded-xl p-4 shadow-sm bg-white active:scale-[0.99] transition"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-base font-bold text-gray-900">{student.name}</span>
                                            {student.hasAccount && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                                    계정 연결
                                                </span>
                                            )}
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${student.status === '재원생' ? 'bg-green-50 text-green-700 ring-1 ring-green-100' : 'bg-gray-100 text-gray-500'}`}>
                                                {student.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">{student.school} • {student.grade}</p>
                                        <p className="text-sm text-gray-700 mt-2 leading-snug">{getClassesNames(student.classes) || '수강 정보 없음'}</p>
                                        <div className="mt-2 space-y-1 text-xs text-gray-500">
                                            <p className="font-medium text-gray-700">학생: {student.phone}</p>
                                            <p>학부모: {student.parentPhone}</p>
                                            <p className="text-gray-400">등록일 {student.registeredDate}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button 
                                            type="button" 
                                            onClick={(e) => {e.stopPropagation(); openScheduleModal(student);}}
                                            className={`p-2 rounded-lg transition-colors ${
                                                hasExternal 
                                                    ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 ring-1 ring-indigo-100' 
                                                    : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                                            }`}
                                            title={hasExternal ? "타학원 시간표 보기" : "타학원 시간표 없음"}
                                        >
                                            <Icon name="calendar" className="w-5 h-5" />
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={(e) => {e.stopPropagation(); openMemoModal(student);}}
                                            className="p-2 rounded-lg text-gray-500 bg-gray-50 hover:bg-yellow-50 hover:text-yellow-700 transition-colors"
                                            title="메모"
                                        >
                                            <Icon name="fileText" className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 mt-3">
                                    <button 
                                        type="button" 
                                        onClick={(e) => {e.stopPropagation(); handleEdit(student);}}
                                        className="flex-1 text-sm font-semibold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-lg py-2 transition-colors"
                                    >
                                        수정
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={(e) => {e.stopPropagation(); if(window.confirm(`${student.name} 학생을 정말 삭제하시겠습니까?`)) handleDeleteStudent(student.id);}}
                                        className="flex-1 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg py-2 transition-colors"
                                    >
                                        삭제
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <StudentFormModal isOpen={isStudentModalOpen} onClose={() => setIsStudentModalOpen(false)} student={studentToEdit} allClasses={classes} onSave={handleSaveStudent} />
            <MemoModal isOpen={memoModalState.isOpen} onClose={closeMemoModal} onSave={handleSaveMemo} studentId={memoModalState.studentId} initialContent={memoModalState.content} studentName={memoModalState.studentName} />
            
            {/* ✅ [수정] 타학원 시간표 모달: 정보 전체 표시 */}
            <Modal isOpen={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} title={`${selectedStudentSchedule.name} 학생 타학원 시간표`}>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                    {selectedStudentSchedule.schedules.length > 0 ? (
                        selectedStudentSchedule.schedules.map((s, i) => (
                            <div key={i} className="border border-gray-200 p-4 rounded-xl bg-gray-50 flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-gray-900 text-lg">{s.academyName}</p>
                                        <p className="text-sm text-gray-600 font-medium">{s.courseName} <span className="text-gray-400">|</span> {s.instructor || '강사 미정'}</p>
                                    </div>
                                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                                        {s.days.join(', ')}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-gray-500 border-t border-gray-200 pt-2 mt-1">
                                    <div className="flex items-center gap-1">
                                        <Icon name="clock" className="w-3 h-3" />
                                        {s.startTime} ~ {s.endTime}
                                    </div>
                                    {/* ✅ [추가] 기간 표시 */}
                                    <div className="flex items-center gap-1">
                                        <Icon name="calendar" className="w-3 h-3" />
                                        {s.startDate} ~ {s.endDate || '종료일 미정'}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <p className="text-gray-500">등록된 타학원 일정이 없습니다.</p>
                        </div>
                    )}
                    <div className="flex justify-end pt-2">
                        <button onClick={() => setScheduleModalOpen(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium transition-colors">닫기</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};