// src/utils/modals/ClinicLogModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/common/Modal';
import { formatGradeLabel } from '../../utils/helpers';

export const ClinicLogModal = ({ isOpen, onClose, onSave, logToEdit = null, students, defaultDate, classes }) => {
    const [date, setDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
    const [studentId, setStudentId] = useState('');
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [tutor, setTutor] = useState('');
    const [comment, setComment] = useState('');

    const activeStudents = useMemo(() => students.filter(s => s.status === '재원생').sort((a, b) => a.name.localeCompare(b.name)), [students]);
    
    const selectedStudent = useMemo(() => activeStudents.find(s => s.id === studentId), [activeStudents, studentId]);
    const studentClassNames = useMemo(() => {
        if (!selectedStudent) return '';
        return selectedStudent.classes.map(id => classes.find(c => c.id === id)?.name).join(', ');
    }, [selectedStudent, classes]);
    
    useEffect(() => {
        if (logToEdit) {
            setDate(logToEdit.date);
            setStudentId(logToEdit.studentId);
            setCheckIn(logToEdit.checkIn);
            setCheckOut(logToEdit.checkOut);
            setTutor(logToEdit.tutor);
            setComment(logToEdit.comment);
        } else {
            setDate(defaultDate || new Date().toISOString().slice(0, 10));
            setStudentId(activeStudents.length > 0 ? activeStudents[0].id : '');
            setCheckIn('');
            setCheckOut('');
            setTutor('');
            setComment('');
        }
    }, [logToEdit, defaultDate, activeStudents]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!date || !studentId || !checkIn || !tutor) return;

        const logData = {
            id: logToEdit ? logToEdit.id : null,
            date,
            studentId,
            studentName: selectedStudent?.name || '알 수 없음',
            checkIn,
            checkOut,
            tutor,
            comment,
        };
        onSave(logData, !!logToEdit);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={logToEdit ? '클리닉 로그 수정' : '클리닉 로그 기록'} maxWidth="max-w-3xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4 border p-3 rounded-lg bg-gray-50">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">날짜*</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">학생 이름*</label>
                        <select value={studentId} onChange={e => setStudentId(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                            {activeStudents.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({formatGradeLabel(s.grade)})</option>
                            ))}
                        </select>
                    </div>
                </div>

                {selectedStudent && (
                    <div className="text-sm p-3 bg-white border rounded-lg">
                        <p className="font-semibold text-gray-700">학생 정보 요약</p>
                        <p className="text-xs text-gray-600 mt-1">
                            학교/학년: {selectedStudent.school} ({formatGradeLabel(selectedStudent.grade)})<br/>
                            수강 클래스: <span className="font-medium text-blue-600">{studentClassNames || '없음'}</span><br/>
                            클리닉 희망: {selectedStudent.clinicTime || '미정'}
                        </p>
                    </div>
                )}


                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">입실 시간*</label>
                        <input type="time" value={checkIn} onChange={e => setCheckIn(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">퇴실 시간</label>
                        <input type="time" value={checkOut} onChange={e => setCheckOut(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">담당 조교/강사*</label>
                        <input type="text" value={tutor} onChange={e => setTutor(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" placeholder="예: 조교A 또는 강사명" />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">활동 내용 및 특이사항</label>
                    <textarea value={comment} onChange={e => setComment(e.target.value)} rows="3" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" placeholder="예: 미적분 복습 질문 해결, 30분 오답노트 작성 지도."></textarea>
                </div>

                <div className="pt-4 border-t flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition duration-150">
                        취소
                    </button>
                    <button type="submit" className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition duration-150 shadow-md">
                        {logToEdit ? '로그 수정 저장' : '로그 기록하기'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};