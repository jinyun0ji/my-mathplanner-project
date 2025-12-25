// src/utils/modals/ClinicCommentModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/common/Modal';
import { Icon } from '../../utils/helpers';

export const ClinicCommentModal = ({ isOpen, onClose, onSave, log, students, defaultDate, classes }) => {
    const isNewLog = log === null;
    
    const [studentId, setStudentId] = useState(log?.studentId || '');
    const [checkIn, setCheckIn] = useState(log?.checkIn || '');
    const [checkOut, setCheckOut] = useState(log?.checkOut || '');
    const [comment, setComment] = useState(log?.comment || '');
    const [date, setDate] = useState(log?.date || defaultDate || new Date().toISOString().slice(0, 10));
    const [tutor, setTutor] = useState(log?.tutor || ''); 
    const [status, setStatus] = useState(log?.status || (log?.checkIn ? 'attended' : 'pending')); 
    const [isDirty, setIsDirty] = useState(false);

    const currentStudent = useMemo(() => students.find(s => s.id === studentId), [studentId, students]);
    
    // ✅ [수정] 학생 정보 텍스트에 전화번호 추가
    const studentInfoText = useMemo(() => {
        if (!currentStudent) return '학생 정보를 불러오는 중...';
        
        let className = '클래스 미정';
        if (currentStudent.classes && currentStudent.classes.length > 0 && classes) {
            const classNames = currentStudent.classes
                .map(clsId => classes.find(c => c.id === clsId)?.name)
                .filter(Boolean);
            if (classNames.length > 0) className = classNames.join(', ');
        }
        
        const phone = currentStudent.phone ? currentStudent.phone.slice(-4) : '----';
        
        return `${currentStudent.school || '학교 미정'} / ${className} (번호: ${phone})`;
    }, [currentStudent, classes]);

    useEffect(() => {
        if (log) {
            setStudentId(log.studentId);
            setCheckIn(log.checkIn || '');
            setCheckOut(log.checkOut || '');
            setComment(log.comment || '');
            setTutor(log.tutor || '');
            setDate(log.date);
            setStatus(log.status || (log.checkIn ? 'attended' : 'pending'));
        } else if (isOpen) {
            setStudentId('');
            setCheckIn(new Date().toTimeString().slice(0, 5));
            setCheckOut('');
            setComment('');
            setTutor('');
            setDate(defaultDate || new Date().toISOString().slice(0, 10));
            setStatus('attended');
        }
        if (isOpen) setIsDirty(false);
    }, [log, isOpen, defaultDate]);

    const handleChange = (setter, value) => {
        setter(value);
        setIsDirty(true);
    };

    const handleStatusChange = (newStatus) => {
        if (newStatus === 'no-show') {
            handleChange(setCheckIn, '');
            handleChange(setCheckOut, '');
        } else if (newStatus === 'attended' && !checkIn) {
            handleChange(setCheckIn, new Date().toTimeString().slice(0, 5));
        }
        handleChange(setStatus, newStatus);
    };

    const handleCloseWrapper = () => {
        if (isDirty) {
            if (!window.confirm("저장하지 않은 내용이 있습니다. 정말 닫으시겠습니까?")) {
                return;
            }
        }
        onClose();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (status === 'attended' && (!studentId || !date || !checkIn)) {
            alert("참석 완료 상태에서는 학생, 날짜, 입실 시간이 필수입니다.");
            return;
        }

        if (isNewLog && !studentId) {
            alert("학생을 선택해야 합니다.");
            return;
        }
        
        let finalCheckIn = checkIn;
        let finalCheckOut = checkOut;
        
        if (status === 'no-show') {
            finalCheckIn = '';
            finalCheckOut = '';
        }

        const logData = {
            id: isNewLog ? null : log.id,
            studentId,
            studentName: currentStudent ? currentStudent.name : log?.studentName || 'Unknown',
            date,
            plannedTime: log?.plannedTime || null,
            checkIn: finalCheckIn,
            checkOut: finalCheckOut,
            comment,
            tutor,
            notificationSent: log?.notificationSent || false,
            status: status,
        };

        onSave(logData, !isNewLog); 
        setIsDirty(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleCloseWrapper} title={isNewLog ? '미예약 학생 클리닉 기록' : '클리닉 기록/코멘트 수정'} maxWidth="max-w-lg">
            <form onSubmit={handleSubmit} className="space-y-4">
                
                <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg flex items-center">
                    <Icon name="user" className="w-5 h-5 mr-3 text-indigo-600"/>
                    <div>
                        <h3 className="text-lg font-bold text-indigo-800">
                            {log?.studentName || currentStudent?.name || '신규 학생'}
                        </h3>
                        <p className="text-sm text-indigo-700">{studentInfoText}</p>
                    </div>
                </div>
                
                <div className='grid grid-cols-2 gap-4'>
                    {isNewLog && (
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
                                    <option key={s.id} value={s.id}>{s.name} ({s.school} / {s.class})</option>
                                ))}
                            </select>
                        </div>
                    )}
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
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">참석 상태*</label>
                    <select 
                        value={status} 
                        onChange={(e) => handleStatusChange(e.target.value)} 
                        className="w-full border rounded-md p-2 bg-white"
                    >
                        <option value="pending">예약됨 (미처리)</option>
                        <option value="attended">참석 완료</option>
                        <option value="no-show">미참석</option>
                    </select>
                    {status === 'no-show' && (
                        <p className='text-xs text-red-500 mt-1 flex items-center'>
                            <Icon name="alertTriangle" className="w-3 h-3 mr-1" />
                            미참석 처리 시 입/퇴실 시간은 기록되지 않습니다.
                        </p>
                    )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={`block text-sm font-bold text-gray-700 mb-1 ${status !== 'attended' ? 'text-gray-400' : ''}`}>
                            입실 시간{status === 'attended' && '*'}
                        </label>
                        <input 
                            type="time" 
                            value={checkIn} 
                            onChange={(e) => handleChange(setCheckIn, e.target.value)} 
                            required={status === 'attended'}
                            disabled={status !== 'attended'}
                            className={`w-full border rounded-md p-2 ${status !== 'attended' ? 'bg-gray-100 text-gray-400' : ''}`}
                        />
                    </div>
                    <div>
                        <label className={`block text-sm font-bold text-gray-700 mb-1 ${status !== 'attended' ? 'text-gray-400' : ''}`}>
                            퇴실 시간
                        </label>
                        <input 
                            type="time" 
                            value={checkOut} 
                            onChange={(e) => handleChange(setCheckOut, e.target.value)} 
                            disabled={status !== 'attended'}
                            className={`w-full border rounded-md p-2 ${status !== 'attended' ? 'bg-gray-100 text-gray-400' : ''}`}
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
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">
                        {isNewLog ? '기록 등록' : '저장하기'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};