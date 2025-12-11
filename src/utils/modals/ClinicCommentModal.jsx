// src/utils/modals/ClinicCommentModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/common/Modal';

export const ClinicCommentModal = ({ isOpen, onClose, onSave, log, students, defaultDate }) => {
    const isNewLog = log === null;
    
    const [studentId, setStudentId] = useState(log?.studentId || '');
    const [checkIn, setCheckIn] = useState(log?.checkIn || '');
    const [checkOut, setCheckOut] = useState(log?.checkOut || '');
    const [comment, setComment] = useState(log?.comment || '');
    const [date, setDate] = useState(log?.date || defaultDate || new Date().toISOString().slice(0, 10));
    // ✅ [추가] 담당 조교 상태
    const [tutor, setTutor] = useState(log?.tutor || ''); 
    // ✅ [추가] 변경 감지 상태
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        if (log) {
            setStudentId(log.studentId);
            setCheckIn(log.checkIn || '');
            setCheckOut(log.checkOut || '');
            setComment(log.comment || '');
            setTutor(log.tutor || '');
            setDate(log.date);
        } else if (isOpen) {
            setStudentId('');
            setCheckIn(new Date().toTimeString().slice(0, 5));
            setCheckOut('');
            setComment('');
            setTutor('');
            setDate(defaultDate || new Date().toISOString().slice(0, 10));
        }
        if (isOpen) setIsDirty(false); // 초기화
    }, [log, isOpen, defaultDate]);

    // ✅ 변경 감지 핸들러
    const handleChange = (setter, value) => {
        setter(value);
        setIsDirty(true);
    };

    // ✅ 닫기 시 경고 핸들러
    const handleCloseWrapper = () => {
        if (isDirty) {
            if (!window.confirm("저장하지 않은 내용이 있습니다. 정말 닫으시겠습니까?")) {
                return;
            }
        }
        onClose();
    };

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
            plannedTime: log?.plannedTime || null,
            checkIn,
            checkOut,
            comment,
            tutor, // ✅ 저장
            notificationSent: log?.notificationSent || false,
        };

        onSave(logData, !isNewLog); 
        setIsDirty(false);
        onClose();
    };

    return (
        // ✅ onClose -> handleCloseWrapper
        <Modal isOpen={isOpen} onClose={handleCloseWrapper} title={isNewLog ? '미예약 학생 클리닉 기록' : `${log?.studentName || '학생'} 클리닉 코멘트 수정`} maxWidth="max-w-lg">
            <form onSubmit={handleSubmit} className="space-y-4">
                
                {isNewLog && (
                    <div className='grid grid-cols-2 gap-4'>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">클리닉 날짜*</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => handleChange(setDate, e.target.value)}
                                required
                                className="w-full border rounded-md p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">학생 선택*</label>
                            <select 
                                value={studentId} 
                                onChange={(e) => handleChange(setStudentId, e.target.value)} 
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
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">입실 시간*</label>
                        <input 
                            type="time" 
                            value={checkIn} 
                            onChange={(e) => handleChange(setCheckIn, e.target.value)} 
                            required
                            className="w-full border rounded-md p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">퇴실 시간</label>
                        <input 
                            type="time" 
                            value={checkOut} 
                            onChange={(e) => handleChange(setCheckOut, e.target.value)} 
                            className="w-full border rounded-md p-2"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">활동 내용 및 코멘트</label>
                    <textarea 
                        value={comment} 
                        onChange={(e) => handleChange(setComment, e.target.value)} 
                        rows="5"
                        placeholder="오늘 진행한 학습 내용과 학생의 특이사항을 기록해주세요."
                        className="w-full border rounded-md p-2"
                    ></textarea>
                </div>

                {/* ✅ 담당 조교 입력란 추가 */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">담당 조교 (작성자)</label>
                    <input 
                        type="text" 
                        value={tutor} 
                        onChange={(e) => handleChange(setTutor, e.target.value)} 
                        placeholder="예: 김조교"
                        className="w-full border rounded-md p-2"
                    />
                </div>

                <div className="pt-4 flex justify-end space-x-2">
                    <button type="button" onClick={handleCloseWrapper} className="px-4 py-2 bg-gray-200 rounded-lg text-sm">취소</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">{isNewLog ? '기록 등록' : '저장하기'}</button>
                </div>
            </form>
        </Modal>
    );
};