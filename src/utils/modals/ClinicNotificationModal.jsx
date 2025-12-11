// src/utils/modals/ClinicNotificationModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Icon } from '../../utils/helpers';

export const ClinicNotificationModal = ({ isOpen, onClose, log, students, logNotification, onSent }) => {
    // ✅ [추가] 예약 시간 상태
    const [scheduleTime, setScheduleTime] = useState(''); 
    
    useEffect(() => {
        if (isOpen) {
            // 기본 예약 시간: 현재 시간 + 1분 (테스트 용이) 
            const now = new Date();
            now.setMinutes(now.getMinutes() + 1);
            // 한국 시간대에 맞추기 위해 9시간을 더하거나, UTC offset을 사용하여 현재 시간 기준으로 설정 (여기서는 간단히 UTC offset을 이용)
            const defaultTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            
            setScheduleTime(defaultTime); 
        }
    }, [isOpen]);


    if (!log) return null;

    const student = students.find(s => s.id === log.studentId);
    
    const handleSend = () => {
        if (!log.comment) {
            alert("작성된 코멘트가 없습니다. 알림을 발송할 수 없습니다.");
            return;
        }
        
        const actionType = scheduleTime ? 'scheduled' : 'sent';
        const scheduleText = scheduleTime ? `${scheduleTime.replace('T', ' ')}에 예약됨` : '즉시 발송됨';
        const message = `[클리닉 알림] ${log.date} ${log.studentName} 학생 클리닉 활동 리포트가 도착했습니다.\n내용: ${log.comment}`;
        
        logNotification(actionType, '클리닉 리포트 발송/예약', 
            `클리닉 리포트(${log.studentName})가 학부모님께 ${scheduleText}.\n내용: ${message.substring(0, 50)}...`);
        
        if (onSent) onSent(log.id, scheduleTime); // onSent 함수에 scheduleTime 전달
        
        alert(`${log.studentName} 학생의 학부모님께 알림을 ${scheduleTime ? '예약' : '발송'}했습니다.`);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="클리닉 알림 발송/예약" maxWidth="max-w-lg">
            <div className="space-y-4">
                
                {/* ✅ [추가] 알림 예약 시간 설정 */}
                <div className="border border-gray-300 p-3 rounded-lg bg-gray-50">
                    <label className="block text-sm font-bold text-gray-700 mb-1">알림 예약 시간 (선택)</label>
                    <input 
                        type="datetime-local" 
                        value={scheduleTime} 
                        onChange={e => setScheduleTime(e.target.value)} 
                        className="w-full border rounded-md p-2 bg-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">예약 시간을 설정하면 해당 시각에 학부모에게 알림이 발송됩니다. 설정하지 않으면 즉시 발송됩니다.</p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                    <h4 className="text-sm font-bold text-yellow-800 mb-2 flex items-center">
                        <Icon name="bell" className="w-4 h-4 mr-2" />
                        발송될 메시지 미리보기 ({log.studentName})
                    </h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        <span className="font-bold">[클리닉 리포트]</span><br/>
                        학생: {log.studentName} ({log.date})<br/>
                        시간: {log.checkIn || '미기록'} ~ {log.checkOut || '미기록'}<br/>
                        <br/>
                        {log.comment || <span className='text-red-500 font-medium'>[경고: 코멘트 없음]</span>}
                    </p>
                </div>

                <div className="text-sm text-gray-600">
                    <p>수신자: <span className="font-bold">{student?.parentPhone || '번호 없음'}</span> (학부모)</p>
                    <p className="mt-1 text-xs text-gray-500">* 메시지 내용을 확인 후 발송/예약 해주세요.</p>
                </div>

                <div className="pt-4 flex justify-end space-x-2 border-t mt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg text-sm">취소</button>
                    <button 
                        onClick={handleSend}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 flex items-center"
                        disabled={!log.comment} // 코멘트가 없으면 발송 불가
                    >
                        <Icon name={scheduleTime ? 'clock' : 'send'} className="w-4 h-4 mr-2" />
                        {scheduleTime ? '알림 예약하기' : '즉시 발송하기'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};