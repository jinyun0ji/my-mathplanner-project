// src/utils/modals/ClinicNotificationModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Icon } from '../../utils/helpers';

export const ClinicNotificationModal = ({ isOpen, onClose, log, students, logNotification, onSent, notificationType }) => {
    const [scheduleTime, setScheduleTime] = useState(''); 
    
    useEffect(() => {
        if (isOpen) {
            const now = new Date();
            now.setMinutes(now.getMinutes() + 1);
            const defaultTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            setScheduleTime(defaultTime); 
        }
    }, [isOpen]);

    if (!log) return null;

    const student = students.find(s => s.id === log.studentId);
    
    // ✅ [수정] 미참석 알림 메시지 생성 함수 (단순 텍스트용)
    const getMessageText = () => {
        if (notificationType === 'no-show') {
            return `[클리닉 알림]\n학생: ${log.studentName}\n클리닉 미참석하였습니다.`;
        }
        return `[클리닉 리포트]
학생: ${log.studentName}
시간: ${log.checkIn || '미기록'} ~ ${log.checkOut || '미기록'}

${log.comment || ''}`;
    };

    const handleSend = () => {
        if (notificationType === 'comment' && !log.comment) {
            alert("작성된 코멘트가 없습니다. 알림을 발송할 수 없습니다.");
            return;
        }
        
        const actionType = scheduleTime ? 'scheduled' : 'sent';
        const scheduleText = scheduleTime ? `${scheduleTime.replace('T', ' ')}에 예약됨` : '즉시 발송됨';
        const message = getMessageText();
        
        const title = notificationType === 'no-show' ? '클리닉 미참석 알림' : '클리닉 리포트 알림';

        logNotification(actionType, title, 
            `${title}(${log.studentName})가 학부모님께 ${scheduleText}.\n내용: ${message.substring(0, 50)}...`);
        
        if (onSent) onSent(log.id, scheduleTime);
        
        alert(`${log.studentName} 학생의 학부모님께 알림을 ${scheduleTime ? '예약' : '발송'}했습니다.`);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={notificationType === 'no-show' ? '미참석 알림 발송' : '클리닉 리포트 발송'} maxWidth="max-w-lg">
            <div className="space-y-4">
                
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

                {/* ✅ [수정] 미리보기 영역 */}
                <div className={`${notificationType === 'no-show' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'} border p-4 rounded-lg`}>
                    <h4 className={`text-sm font-bold mb-2 flex items-center ${notificationType === 'no-show' ? 'text-red-800' : 'text-yellow-800'}`}>
                        <Icon name="bell" className="w-4 h-4 mr-2" />
                        발송될 메시지 미리보기
                    </h4>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                        {notificationType === 'no-show' ? (
                            <>
                                <span className="font-bold">[클리닉 알림]</span><br/>
                                학생: {log.studentName}<br/>
                                {/* ✅ 미참석 시 빨간색 글씨로 표시 */}
                                <span className="text-red-600 font-bold">클리닉 미참석하였습니다.</span>
                            </>
                        ) : (
                            getMessageText()
                        )}
                    </div>
                </div>

                <div className="text-sm text-gray-600">
                    <p>수신자: <span className="font-bold">{student?.parentPhone || '번호 없음'}</span> (학부모)</p>
                    <p className="mt-1 text-xs text-gray-500">* 메시지 내용을 확인 후 발송/예약 해주세요.</p>
                </div>

                <div className="pt-4 flex justify-end space-x-2 border-t mt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg text-sm">취소</button>
                    <button 
                        onClick={handleSend}
                        className={`px-4 py-2 text-white rounded-lg text-sm font-bold flex items-center ${notificationType === 'no-show' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                        <Icon name={scheduleTime ? 'clock' : 'send'} className="w-4 h-4 mr-2" />
                        {scheduleTime ? '알림 예약하기' : '즉시 발송하기'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};