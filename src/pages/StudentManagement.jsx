import React, { useState, useMemo, useCallback } from 'react';
import { Icon } from '../utils/helpers';
import { StudentFormModal } from '../utils/modals/StudentFormModal';
import { MemoModal } from '../utils/modals/MemoModal';

export default function StudentManagement({ 
    students, classes, getClassesNames, handleSaveStudent, handleDeleteStudent, 
    attendanceLogs, studentMemos, handleSaveMemo, handlePageChange,
    studentSearchTerm, setStudentSearchTerm 
}) {
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [studentToEdit, setStudentToEdit] = useState(null);
    const [memoModalState, setMemoModalState] = useState({ isOpen: false, studentId: null, content: '', studentName: '' });

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

    return (
        <div className="space-y-6">
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex space-x-3 items-center w-1/3">
                        <Icon name="search" className="w-5 h-5 text-gray-400"/>
                        <input
                            type="text"
                            placeholder="이름, 학교, 연락처, 클래스명으로 검색..."
                            value={studentSearchTerm}
                            onChange={(e) => setStudentSearchTerm(e.target.value)}
                            // [색상 변경] focus:ring-blue -> focus:ring-indigo-900
                            className="p-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-indigo-900 focus:border-indigo-900 transition-colors"
                        />
                    </div>
                    <button 
                        onClick={handleNewStudent}
                        // [색상 변경] bg-blue -> bg-indigo-900
                        className="bg-indigo-900 hover:bg-indigo-800 text-white font-bold py-2 px-4 rounded-lg flex items-center shadow-md transition duration-150 text-sm"
                    >
                        <Icon name="plus" className="w-5 h-5 mr-2" />
                        새 학생 등록
                    </button>
                </div>
                
                <div className="overflow-x-auto rounded-lg border border-gray-200">
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
                                return (
                                // [색상 변경] hover:bg-blue-50 -> hover:bg-indigo-50
                                <tr key={student.id} className="hover:bg-indigo-50 cursor-pointer transition duration-100" onClick={() => handlePageChange('students', student.id)}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{student.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{student.school}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">고{student.grade}</td>
                                    {/* 상태 색상은 의미 전달을 위해 유지하되 톤 조정 */}
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${student.status === '재원생' ? 'text-green-700' : 'text-gray-500'}`}>
                                        {student.status}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {getClassesNames(student.classes)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <div className="flex flex-col">
                                            <span className="text-gray-900 font-medium">{student.phone}</span>
                                            <span className="text-gray-400 text-xs">부모: {student.parentPhone}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.registeredDate}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex space-x-2">
                                            {/* [색상 변경] 기본 회색, 호버 시 컬러 */}
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