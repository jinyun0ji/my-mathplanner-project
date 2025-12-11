// src/utils/modals/PaymentNotificationModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal'; // 경로 확인 필요
import { Icon } from '../../utils/helpers';

export const PaymentNotificationModal = ({ isOpen, onClose, targets, logNotification }) => {
    const [scheduleTime, setScheduleTime] = useState('');

    useEffect(() => {
        if (isOpen) {
            // 기본값: 현재 시간 + 1분 후 (한국 시간대 고려 간략화)
            const now = new Date();
            now.setMinutes(now.getMinutes() + 1);
            const defaultTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            setScheduleTime(defaultTime);
        }
    }, [isOpen]);

    if (!isOpen || !targets || targets.length === 0) return null;

    const isBulk = targets.length > 1;

    // 단일 메시지 생성 함수
    const getMessageText = (target) => {
        const bookNames = target.unpaidBooks.map(b => b.name).join(', ');
        return `[채수용 연구소] 교재비 납부 안내\n\n안녕하세요, ${target.student.name} 학생 학부모님.\n수업에 필요한 교재비를 안내드립니다.\n\n- 학생명: ${target.student.name}\n- 필요 교재: ${bookNames}\n- 결제 금액: ${target.unpaidAmount.toLocaleString()}원\n\n아래 링크를 통해 간편하게 결제하실 수 있습니다.\n결제 링크: https://pay.example.com/link`;
    };

    const handleSend = () => {
        const actionType = scheduleTime ? 'scheduled' : 'sent';
        const scheduleText = scheduleTime ? `${scheduleTime.replace('T', ' ')}에 예약됨` : '즉시 발송됨';

        if (isBulk) {
            // 일괄 발송 로직
            targets.forEach(target => {
                const msg = getMessageText(target);
                logNotification(actionType, '교재비 안내 발송', 
                    `[일괄] ${target.student.name} 학부모님께 알림이 ${scheduleText}.\n내용: ${msg.substring(0, 30)}...`);
            });
            alert(`총 ${targets.length}명의 학부모님께 알림을 ${scheduleTime ? '예약' : '발송'}했습니다.`);
        } else {
            // 단일 발송 로직
            const target = targets[0];
            const msg = getMessageText(target);
            logNotification(actionType, '교재비 안내 발송', 
                `${target.student.name} 학부모님께 알림이 ${scheduleText}.\n내용: ${msg.substring(0, 50)}...`);
            alert(`${target.student.name} 학생의 학부모님께 알림을 ${scheduleTime ? '예약' : '발송'}했습니다.`);
        }
        
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isBulk ? `교재비 안내 일괄 발송 (${targets.length}명)` : "교재비 안내 발송"} maxWidth="max-w-lg">
            <div className="space-y-4">
                {/* 1. 발송 대상 정보 */}
                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg">
                    <h4 className="text-sm font-bold text-indigo-800 mb-2 flex items-center">
                        <Icon name="users" className="w-4 h-4 mr-2" />
                        수신 대상 {isBulk ? `(총 ${targets.length}명)` : ''}
                    </h4>
                    <div className="text-sm text-gray-700 max-h-32 overflow-y-auto pr-2">
                        {isBulk ? (
                            <ul className="list-disc pl-5 space-y-1">
                                {targets.map((t, idx) => (
                                    <li key={idx}>
                                        <span className="font-bold">{t.student.name}</span> 
                                        <span className="text-gray-500"> ({t.unpaidAmount.toLocaleString()}원 미납)</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p>
                                <span className="font-bold">{targets[0].student.name}</span> 학생 학부모님 
                                <span className="text-gray-500"> ({targets[0].student.parentPhone || '번호 없음'})</span>
                            </p>
                        )}
                    </div>
                </div>

                {/* 2. 예약 설정 */}
                <div className="border border-gray-300 p-3 rounded-lg bg-white">
                    <label className="block text-sm font-bold text-gray-700 mb-1">알림 예약 시간 (선택)</label>
                    <input 
                        type="datetime-local" 
                        value={scheduleTime} 
                        onChange={e => setScheduleTime(e.target.value)} 
                        className="w-full border rounded-md p-2 bg-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        설정 시 해당 시각에 발송됩니다. (미설정 시 즉시 발송)
                    </p>
                </div>

                {/* 3. 메시지 미리보기 */}
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                    <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center">
                        <Icon name="messageSquare" className="w-4 h-4 mr-2" />
                        메시지 미리보기 {isBulk && <span className="text-xs font-normal ml-1 text-gray-500">(첫 번째 대상 기준)</span>}
                    </h4>
                    <div className="text-sm text-gray-600 whitespace-pre-wrap bg-white p-3 border rounded">
                        {getMessageText(targets[0])}
                    </div>
                </div>

                {/* 4. 버튼 */}
                <div className="pt-4 flex justify-end space-x-2 border-t mt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300 transition">취소</button>
                    <button 
                        onClick={handleSend}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center transition shadow-sm"
                    >
                        <Icon name={scheduleTime ? 'clock' : 'send'} className="w-4 h-4 mr-2" />
                        {scheduleTime ? (isBulk ? '일괄 예약하기' : '예약하기') : (isBulk ? '일괄 발송하기' : '발송하기')}
                    </button>
                </div>
            </div>
        </Modal>
    );
};