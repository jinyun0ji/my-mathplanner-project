// src/pages/ClinicManagement.jsx
import React, { useState, useMemo } from 'react';
import { Icon } from '../utils/helpers';
import { ClinicScheduleModal } from '../utils/modals/ClinicScheduleModal';
import { ClinicCommentModal } from '../utils/modals/ClinicCommentModal'; // Unscheduled/Comment Modal
import { ClinicNotificationModal } from '../utils/modals/ClinicNotificationModal';

export default function ClinicManagement({ 
    students, clinicLogs, handleSaveClinicLog, handleDeleteClinicLog, 
    logNotification 
}) {
    const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
    
    // 모달 상태 관리
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
    const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
    
    const [selectedLog, setSelectedLog] = useState(null);

    // 날짜별 로그 필터링
    const dailyLogs = useMemo(() => {
        return clinicLogs
            .filter(log => log.date === filterDate)
            .sort((a, b) => {
                // 정렬 우선순위: 1. 예정 시간 (없으면 맨 뒤), 2. 이름
                const timeA = a.plannedTime || '23:59:59';
                const timeB = b.plannedTime || '23:59:59';
                return timeA.localeCompare(timeB) || a.studentName.localeCompare(b.studentName);
            });
    }, [clinicLogs, filterDate]);

    // 핸들러 함수들
    const openScheduleModal = () => setIsScheduleModalOpen(true);
    
    // ✅ 미예약 학생 코멘트/로그 등록
    const openUnscheduledLogModal = () => {
        setSelectedLog(null); // 신규 로그 생성 모드
        setIsCommentModalOpen(true);
    }
    
    // 기존 로그 수정 (입퇴실/코멘트)
    const openCommentModal = (log) => {
        setSelectedLog(log);
        setIsCommentModalOpen(true);
    };

    const openNotifyModal = (log) => {
        if (!log.comment) {
            alert("작성된 코멘트가 없습니다. 먼저 코멘트를 입력해주세요.");
            return;
        }
        setSelectedLog(log);
        setIsNotifyModalOpen(true);
    };

    // 알림 발송 완료 처리 (scheduleTime 추가)
    const handleNotificationSent = (logId, scheduleTime) => {
        const log = clinicLogs.find(l => l.id === logId);
        if (log) {
            // log에 예약 시간 정보도 저장 (선택 사항이나, 시스템의 일관성 유지를 위해)
            handleSaveClinicLog({ 
                ...log, 
                notificationSent: true, 
                notificationScheduledTime: scheduleTime || null 
            }, true);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-md">
                {/* 상단 컨트롤 바 */}
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <div className='flex items-center space-x-4'>
                        <h2 className="text-xl font-bold text-gray-800">클리닉 일정 및 기록</h2>
                        <input
                            type="date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                    </div>
                    
                    <div className='flex space-x-3'>
                        {/* ✅ 미예약 학생 코멘트/로그 등록 버튼 */}
                        <button 
                            onClick={openUnscheduledLogModal}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg flex items-center shadow-md transition"
                        >
                            <Icon name="userPlus" className="w-5 h-5 mr-2" />
                            미예약 코멘트 기록
                        </button>
                        
                        {/* ✅ 일정 일괄 등록 버튼 */}
                        <button 
                            onClick={openScheduleModal}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center shadow-md transition"
                        >
                            <Icon name="calendar" className="w-5 h-5 mr-2" />
                            일정 일괄 등록
                        </button>
                    </div>
                </div>

                {/* 메인 테이블 */}
                <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">학생명</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">예정 시간</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">입/퇴실 (실제)</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-1/3">코멘트</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">알림 상태</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">관리</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {dailyLogs.length > 0 ? (
                                dailyLogs.map(log => {
                                    const isUnscheduled = !log.plannedTime;
                                    const isSent = log.notificationSent;
                                    
                                    return (
                                        <tr key={log.id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-gray-900">{log.studentName}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {isUnscheduled ? (
                                                     <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">미예약</span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        {log.plannedTime}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                                                {log.checkIn ? (
                                                    <span className="font-mono text-indigo-600">{log.checkIn} ~ {log.checkOut || '...'}</span>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-700">
                                                {log.comment ? (
                                                    <div className="max-w-xs truncate" title={log.comment}>{log.comment}</div>
                                                ) : (
                                                    <span className="text-gray-400 text-xs italic">코멘트 없음</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {isSent ? (
                                                    <span className="inline-flex items-center text-green-600 text-xs font-bold">
                                                        <Icon name="check" className="w-3 h-3 mr-1" /> 발송됨
                                                    </span>
                                                ) : log.comment ? (
                                                    <span className="inline-flex items-center text-yellow-600 text-xs font-bold">
                                                        <Icon name="alertTriangle" className="w-3 h-3 mr-1" /> 대기
                                                    </span>
                                                ) : (
                                                     <span className="text-gray-400 text-xs">코멘트 미작성</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                                <div className="flex justify-center space-x-2">
                                                    {/* 코멘트/결과 입력 버튼 */}
                                                    <button 
                                                        onClick={() => openCommentModal(log)}
                                                        className="text-gray-600 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50 tooltip-container"
                                                        title="결과/코멘트 입력"
                                                    >
                                                        <Icon name="edit" className="w-5 h-5" />
                                                    </button>
                                                    
                                                    {/* 알림 발송 버튼 */}
                                                    <button 
                                                        onClick={() => openNotifyModal(log)}
                                                        className={`p-1 rounded hover:bg-yellow-50 transition ${isSent ? 'text-green-500' : 'text-yellow-600 hover:text-yellow-800'}`}
                                                        title="알림 발송/예약"
                                                    >
                                                        <Icon name="bell" className="w-5 h-5" />
                                                    </button>

                                                    {/* 삭제 버튼 */}
                                                    <button 
                                                        onClick={() => {if(window.confirm('일정을 삭제하시겠습니까?')) handleDeleteClinicLog(log.id)}}
                                                        className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                                                        title="삭제"
                                                    >
                                                        <Icon name="trash" className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-10 text-center text-gray-500">
                                        등록된 클리닉 일정이 없습니다. '일정 일괄 등록' 버튼을 눌러 추가하거나, '미예약 코멘트/로그'로 즉시 기록할 수 있습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 1. 일정 등록 모달 (일괄 등록) */}
            <ClinicScheduleModal 
                isOpen={isScheduleModalOpen}
                onClose={() => setIsScheduleModalOpen(false)}
                onSave={handleSaveClinicLog}
                students={students}
                defaultDate={filterDate}
            />

            {/* 2. 코멘트 입력 모달 (예약된 학생 코멘트 수정 & 미예약 학생 신규 코멘트 등록) */}
            <ClinicCommentModal
                isOpen={isCommentModalOpen}
                onClose={() => setIsCommentModalOpen(false)}
                onSave={handleSaveClinicLog}
                log={selectedLog}
                students={students}
                defaultDate={filterDate}
            />

            {/* 3. 알림 발송 모달 (예약 기능 추가) */}
            <ClinicNotificationModal
                isOpen={isNotifyModalOpen}
                onClose={() => setIsNotifyModalOpen(false)}
                log={selectedLog}
                students={students}
                logNotification={logNotification}
                onSent={handleNotificationSent}
            />
        </div>
    );
};