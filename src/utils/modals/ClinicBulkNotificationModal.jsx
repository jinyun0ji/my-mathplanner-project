// src/utils/modals/ClinicBulkNotificationModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Icon } from '../../utils/helpers';

export const ClinicBulkNotificationModal = ({ isOpen, onClose, selectedLogs, students, logNotification, onSent }) => {
    const [scheduleTime, setScheduleTime] = useState('');

    useEffect(() => {
        if (isOpen) {
            // 기본값: 현재 시간 + 1분 후
            const now = new Date();
            now.setMinutes(now.getMinutes() + 1);
            // 한국 시간대 고려 (간이)
            const defaultTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            setScheduleTime(defaultTime);
        }
    }, [isOpen]);

    const handleSend = () => {
        // 코멘트 없는 로그 확인 (미참석이 아닌데 코멘트가 없는 경우만 체크)
        const noCommentLogs = selectedLogs.filter(log => !log.comment && log.status !== 'no-show');
        
        if (noCommentLogs.length > 0) {
            if (!window.confirm(`선택된 ${selectedLogs.length}명 중 ${noCommentLogs.length}명의 코멘트가 비어있습니다. 그대로 발송하시겠습니까?`)) {
                return;
            }
        }

        const actionType = scheduleTime ? 'scheduled' : 'sent';
        const scheduleText = scheduleTime ? `${scheduleTime.replace('T', ' ')}에 예약됨` : '즉시 발송됨';

        selectedLogs.forEach(log => {
            // ✅ 상태에 따라 메시지 내용 분기
            let message = '';
            let title = '';

            if (log.status === 'no-show') {
                 title = '클리닉 미참석 알림';
                 message = `[클리닉 알림] ${log.date} ${log.studentName} 학생이 예정된 클리닉에 참석하지 않았습니다. 일정 확인 부탁드립니다.`;
            } else {
                 title = '클리닉 리포트 알림';
                 message = `[클리닉 알림] ${log.date} ${log.studentName} 학생 클리닉 활동 리포트가 도착했습니다.\n내용: ${log.comment || '(코멘트 없음)'}`;
            }
            
            // 실제 알림 발송 (가상 함수 호출)
            logNotification(actionType, title, 
                `[일괄] ${log.studentName} 학생 알림이 ${scheduleText}.`);
            
            // 상태 업데이트 호출
            if (onSent) onSent(log.id, scheduleTime);
        });

        alert(`총 ${selectedLogs.length}건의 알림을 ${scheduleTime ? '예약' : '발송'}했습니다.`);
        onClose();
    };

    if (selectedLogs.length === 0) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="클리닉 알림 일괄 발송" maxWidth="max-w-lg">
            <div className="space-y-4">
                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg">
                    <h4 className="text-sm font-bold text-indigo-800 mb-2 flex items-center">
                        <Icon name="users" className="w-4 h-4 mr-2" />
                        발송 대상 ({selectedLogs.length}명)
                    </h4>
                    <div className="text-sm text-gray-700 max-h-32 overflow-y-auto pr-2">
                        <ul className="list-disc pl-5 space-y-1">
                            {selectedLogs.map(log => (
                                <li key={log.id} className={(!log.comment && log.status !== 'no-show') ? "text-red-500 font-medium" : ""}>
                                    {log.studentName} 
                                    {log.status === 'no-show' && <span className="text-red-600 text-xs ml-1 font-bold">(미참석)</span>}
                                    {(!log.comment && log.status !== 'no-show') && " (코멘트 없음!)"}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="border border-gray-300 p-3 rounded-lg bg-white">
                    <label className="block text-sm font-bold text-gray-700 mb-1">알림 예약 시간 (선택)</label>
                    <input 
                        type="datetime-local" 
                        value={scheduleTime} 
                        onChange={e => setScheduleTime(e.target.value)} 
                        className="w-full border rounded-md p-2 bg-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        설정 시 해당 시각에 일괄 발송됩니다. (미설정 시 즉시 발송)
                    </p>
                </div>

                <div className="pt-4 flex justify-end space-x-2 border-t mt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg text-sm font-medium">취소</button>
                    <button 
                        onClick={handleSend}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 flex items-center"
                    >
                        <Icon name={scheduleTime ? 'clock' : 'send'} className="w-4 h-4 mr-2" />
                        {scheduleTime ? '일괄 예약하기' : '즉시 일괄 발송'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};