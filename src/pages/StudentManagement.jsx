// src/pages/StudentManagement.jsx
import React, { useState, useMemo, useCallback } from 'react';
import { Icon } from '../utils/helpers';
import { StudentFormModal } from '../utils/modals/StudentFormModal';
import { MemoModal } from '../utils/modals/MemoModal';

export default function StudentManagement({ 
    students, classes, getClassesNames, handleSaveStudent, handleDeleteStudent, 
    attendanceLogs, studentMemos, handleSaveMemo, handlePageChange,
    // ✅ props로 전달받음
    studentSearchTerm, setStudentSearchTerm 
}) {
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [studentToEdit, setStudentToEdit] = useState(null);
    // 로컬 search state 제거됨 -> studentSearchTerm 사용
    const [memoModalState, setMemoModalState] = useState({ isOpen: false, studentId: null, content: '', studentName: '' });

    const filteredStudents = useMemo(() => {
        return students.filter(student => {
            // ✅ [수정] 클래스 명 검색 추가
            // 학생이 수강 중인 클래스들의 이름을 문자열로 변환하여 검색 대상에 포함
            const studentClassNames = getClassesNames(student.classes);
            
            return (
                student.name.includes(studentSearchTerm) || 
                student.school.includes(studentSearchTerm) ||
                student.phone.includes(studentSearchTerm) ||
                studentClassNames.includes(studentSearchTerm) // 클래스명 검색
            );
        }).sort((a, b) => {
            if (a.status === '재원생' && b.status !== '재원생') return -1;
            if (a.status !== '재원생' && b.status === '재원생') return 1;
            return b.registeredDate.localeCompare(a.registeredDate);
        });
    }, [students, studentSearchTerm, getClassesNames]); // 의존성 배열 수정

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
            
            <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex space-x-3 items-center w-1/3">
                        <Icon name="search" className="w-5 h-5 text-gray-500"/>
                        <input
                            type="text"
                            placeholder="이름, 학교, 연락처, 클래스명으로 검색..."
                            value={studentSearchTerm} // ✅ 전역 상태 사용
                            onChange={(e) => setStudentSearchTerm(e.target.value)} // ✅ 전역 상태 변경
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
                                {['이름', '학교', '학년', '상태', '수강 클래스', '연락처 (학생/학부모)', '등록일', '관리'].map(header => (
                                    <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredStudents.map(student => {
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
                                        <div className="flex flex-col">
                                            <span className="text-gray-900 font-medium">{student.phone}</span>
                                            <span className="text-gray-500 text-xs">부모: {student.parentPhone}</span>
                                        </div>
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