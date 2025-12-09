import React, { useState, useMemo, useCallback } from 'react';
import { Icon } from '../utils/helpers';
import { StudentFormModal } from '../utils/modals/StudentFormModal';
import { MemoModal } from '../utils/modals/MemoModal';

export default function StudentManagement({ 
    students, classes, getClassesNames, handleSaveStudent, handleDeleteStudent, 
    attendanceLogs, studentMemos, handleSaveMemo, handlePageChange 
}) {
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [studentToEdit, setStudentToEdit] = useState(null);
    const [search, setSearch] = useState('');
    const [memoModalState, setMemoModalState] = useState({ isOpen: false, studentId: null, content: '', studentName: '' });

    const filteredStudents = useMemo(() => {
        return students.filter(student =>
            student.name.includes(search) || 
            student.school.includes(search) ||
            student.phone.includes(search)
        ).sort((a, b) => {
            if (a.status === '재원생' && b.status !== '재원생') return -1;
            if (a.status !== '재원생' && b.status === '재원생') return 1;
            return b.registeredDate.localeCompare(a.registeredDate);
        });
    }, [students, search]);

    const handleEdit = (student) => {
        setStudentToEdit(student);
        setIsStudentModalOpen(true);
    };

    const handleNewStudent = () => {
        setStudentToEdit(null);
        setIsStudentModalOpen(true);
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

    // 출석 요약 (가장 최근 10회 수업 기준)
    const getAttendanceSummary = useCallback((studentId) => {
        const studentLogs = attendanceLogs.filter(log => log.studentId === studentId);
        const lastTen = studentLogs.slice(-10); 
        
        const summary = {
            '출석': 0, '지각': 0, '결석': 0, '동영상보강': 0, total: lastTen.length
        };
        lastTen.forEach(log => {
            if (summary[log.status] !== undefined) {
                summary[log.status]++;
            }
        });
        return summary;
    }, [attendanceLogs]);


    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-800">학생 정보 관리</h3>
            
            <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex space-x-3 items-center w-1/3">
                        <Icon name="search" className="w-5 h-5 text-gray-500"/>
                        <input
                            type="text"
                            placeholder="이름, 학교, 연락처로 검색..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="p-2 border border-gray-300 rounded-lg w-full focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <button 
                        onClick={handleNewStudent}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center shadow-md transition duration-150"
                    >
                        <Icon name="plus" className="w-5 h-5 mr-2" />
                        새 학생 등록
                    </button>
                </div>
                
                <div className="overflow-x-auto rounded-lg border">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {['이름', '학교', '학년', '상태', '수강 클래스', '최근 출결(10회)', '등록일', '관리'].map(header => (
                                    <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredStudents.map(student => {
                                const summary = getAttendanceSummary(student.id);
                                return (
                                <tr key={student.id} className="hover:bg-blue-50/50 cursor-pointer transition duration-100" onClick={() => handlePageChange('students', student.id)}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.school}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">고{student.grade}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${student.status === '재원생' ? 'text-green-600' : 'text-gray-500'}`}>
                                        {student.status}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {getClassesNames(student.classes)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className="font-semibold text-green-600">출석 {summary['출석']}</span>
                                        <span className="text-yellow-600 ml-2">지각 {summary['지각']}</span>
                                        <span className="text-red-600 ml-2">결석 {summary['결석']}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.registeredDate}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex space-x-2">
                                            <button 
                                                type="button" 
                                                onClick={(e) => {e.stopPropagation(); openMemoModal(student);}}
                                                className="text-yellow-600 hover:text-yellow-800 p-1 rounded-full hover:bg-yellow-100"
                                                title="메모"
                                            >
                                                <Icon name="fileText" className="w-5 h-5" />
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={(e) => {e.stopPropagation(); handleEdit(student);}}
                                                className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-100"
                                                title="수정"
                                            >
                                                <Icon name="edit" className="w-5 h-5" />
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={(e) => {e.stopPropagation(); if(window.confirm(`${student.name} 학생을 정말 삭제하시겠습니까?`)) handleDeleteStudent(student.id);}}
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
            
            <StudentFormModal 
                isOpen={isStudentModalOpen}
                onClose={() => setIsStudentModalOpen(false)}
                student={studentToEdit}
                allClasses={classes}
                onSave={handleSaveStudent}
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