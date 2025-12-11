// src/utils/modals/ClinicCommentModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/common/Modal';

export const ClinicCommentModal = ({ isOpen, onClose, onSave, log, students, defaultDate }) => {
    const isNewLog = log === null;
    
    // 상태 초기값 설정
    const [studentId, setStudentId] = useState(log?.studentId || '');
    const [checkIn, setCheckIn] = useState(log?.checkIn || '');
    const [checkOut, setCheckOut] = useState(log?.checkOut || '');
    const [comment, setComment] = useState(log?.comment || '');
    const [date, setDate] = useState(log?.date || defaultDate || new Date().toISOString().slice(0, 10));

    useEffect(() => {
        if (log) {
            setStudentId(log.studentId);
            setCheckIn(log.checkIn || '');
            setCheckOut(log.checkOut || '');
            setComment(log.comment || '');
            setDate(log.date);
        } else if (isOpen) {
            setStudentId('');
            setCheckIn(new Date().toTimeString().slice(0, 5)); // 기본값 현재 시간
            setCheckOut('');
            setComment('');
            setDate(defaultDate || new Date().toISOString().slice(0, 10));
        }
    }, [log, isOpen, defaultDate]);

    const currentStudent = useMemo(() => students.find(s => s.id === Number(studentId)), [studentId, students]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!studentId || !date || !checkIn) {
            alert("학생, 날짜, 입실 시간은 필수 입력 항목입니다.");
            return;
        }

        const logData = {
            id: isNewLog ? null : log.id,
            studentId: Number(studentId),
            studentName: currentStudent ? currentStudent.name : 'Unknown',
            date,
            plannedTime: log?.plannedTime || null, // 예정 시간은 없을 수 있음 (미예약)
            checkIn,
            checkOut,
            comment,
            notificationSent: log?.notificationSent || false,
        };

        onSave(logData, !isNewLog); 
        onClose();
    };

    return (
        // ✅ 모달 제목 변경
        <Modal isOpen={isOpen} onClose={onClose} title={isNewLog ? '미예약 학생 클리닉 기록' : `${log?.studentName || '학생'} 클리닉 코멘트 수정`} maxWidth="max-w-lg">
            <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* ✅ 신규 로그 시 학생 선택 및 날짜 필드 */}
                {isNewLog && (
                    <div className='grid grid-cols-2 gap-4'>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">클리닉 날짜*</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                                className="w-full border rounded-md p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">학생 선택*</label>
                            <select 
                                value={studentId} 
                                onChange={(e) => setStudentId(e.target.value)} 
                                required
                                className="w-full border rounded-md p-2"
                            >
                                <option value="">학생을 선택하세요</option>
                                {students.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.school})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
                
                {/* 기존 필드 */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">입실 시간*</label>
                        <input 
                            type="time" 
                            value={checkIn} 
                            onChange={(e) => setCheckIn(e.target.value)} 
                            required
                            className="w-full border rounded-md p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">퇴실 시간</label>
                        <input 
                            type="time" 
                            value={checkOut} 
                            onChange={(e) => setCheckOut(e.target.value)} 
                            className="w-full border rounded-md p-2"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">활동 내용 및 코멘트</label>
                    <textarea 
                        value={comment} 
                        onChange={(e) => setComment(e.target.value)} 
                        rows="5"
                        placeholder="오늘 진행한 학습 내용과 학생의 특이사항을 기록해주세요."
                        className="w-full border rounded-md p-2"
                    ></textarea>
                </div>

                <div className="pt-4 flex justify-end space-x-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg text-sm">취소</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">{isNewLog ? '클리닉 기록 및 코멘트 등록' : '코멘트 저장'}</button>
                </div>
            </form>
        </Modal>
    );
};