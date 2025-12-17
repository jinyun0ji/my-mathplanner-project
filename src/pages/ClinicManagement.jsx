import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../utils/helpers';
import { ClinicScheduleModal } from '../utils/modals/ClinicScheduleModal';
import { ClinicCommentModal } from '../utils/modals/ClinicCommentModal';
import { ClinicNotificationModal } from '../utils/modals/ClinicNotificationModal';
import { ClinicBulkNotificationModal } from '../utils/modals/ClinicBulkNotificationModal';

export default function ClinicManagement({ 
    students, classes, clinicLogs, handleSaveClinicLog, handleDeleteClinicLog, 
    logNotification 
}) {
    const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
    const [viewMode, setViewMode] = useState('staff'); // staff | tutor

    // 모달 상태
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
    const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
    const [isBulkNotifyModalOpen, setIsBulkNotifyModalOpen] = useState(false);
    
    const [selectedLog, setSelectedLog] = useState(null);
    const [selectedLogIds, setSelectedLogIds] = useState([]);
    const [selectedNotificationType, setSelectedNotificationType] = useState('comment'); 

    // 날짜별 로그 필터링
    const dailyLogs = useMemo(() => {
        return clinicLogs
            .filter(log => log.date === filterDate)
            .sort((a, b) => {
                const timeA = a.plannedTime || '23:59:59';
                const timeB = b.plannedTime || '23:59:59';
                return timeA.localeCompare(timeB) || a.studentName.localeCompare(b.studentName);
            });
    }, [clinicLogs, filterDate]);

    useEffect(() => {
        setSelectedLogIds([]);
    }, [filterDate]);

    // 핸들러
    const openScheduleModal = () => setIsScheduleModalOpen(true);
    
    const openUnscheduledLogModal = () => {
        setSelectedLog(null);
        setIsCommentModalOpen(true);
    }
    
    const openCommentModal = (log) => {
        setSelectedLog(log);
        setIsCommentModalOpen(true);
    };

    // 통합 알림 버튼 핸들러
    const handleNotifyClick = (log) => {
        const status = log.status || (log.checkIn ? 'attended' : 'pending');

        if (status === 'pending') {
            alert("⚠️ '예약됨' 상태에서는 알림을 보낼 수 없습니다.\n학생의 출석 여부(참석/미참석)를 먼저 확정해주세요.");
            return;
        }

        if (status === 'no-show') {
            openNotifyModal(log, 'no-show');
        } else {
            // attended 상태
            openNotifyModal(log, 'comment');
        }
    };

    const openNotifyModal = (log, type) => {
        // 코멘트 알림일 때만 코멘트 필수 체크
        if (type === 'comment' && !log.comment) {
            alert("작성된 코멘트가 없습니다. 먼저 코멘트를 입력해주세요.");
            return;
        }
        setSelectedLog(log);
        setSelectedNotificationType(type);
        setIsNotifyModalOpen(true);
    };

    const handleNotificationSent = (logId, scheduleTime) => {
        const log = clinicLogs.find(l => l.id === logId);
        if (log) {
            handleSaveClinicLog({ 
                ...log, 
                notificationSent: true, 
                notificationScheduledTime: scheduleTime || null 
            }, true);
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedLogIds(dailyLogs.map(log => log.id));
        } else {
            setSelectedLogIds([]);
        }
    };

    const handleSelectLog = (id) => {
        setSelectedLogIds(prev => 
            prev.includes(id) ? prev.filter(logId => logId !== id) : [...prev, id]
        );
    };

    const openBulkNotifyModal = () => {
        if (selectedLogIds.length === 0) return;
        setIsBulkNotifyModalOpen(true);
    };

    const renderStatusBadge = (log) => {
        const status = log.status || (log.checkIn ? 'attended' : 'pending');
        switch(status) {
            case 'attended':
                // [색상 변경] 참석: bg-blue-100 -> bg-indigo-100, text-blue-700 -> text-indigo-800
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">참석 완료</span>;
            case 'no-show':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">미참석</span>;
            case 'pending':
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">예약됨</span>;
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 min-h-[80vh] flex flex-col">
                
                {/* 모드 전환 탭 */}
                <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-lg w-full sm:w-fit mb-6">
                    <button
                        onClick={() => setViewMode('staff')}
                        // [색상 변경] text-indigo-600 -> text-indigo-900
                        className={`px-4 py-2 text-sm font-bold rounded-md transition ${viewMode === 'staff' ? 'bg-white text-indigo-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Icon name="briefcase" className="w-4 h-4 mr-2 inline-block"/>
                        관리자/직원 모드 (예약/발송)
                    </button>
                    <button
                        onClick={() => setViewMode('tutor')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition ${viewMode === 'tutor' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Icon name="edit" className="w-4 h-4 mr-2 inline-block"/>
                        조교 모드 (기록/코멘트)
                    </button>
                </div>

                <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <div className='flex items-center space-x-4'>
                        <input
                            type="date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            // [색상 변경] focus:ring-indigo-500 -> focus:ring-indigo-900
                            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-900 focus:border-indigo-900 text-sm font-medium text-gray-700"
                        />
                        <span className="text-gray-500 text-sm font-medium">{dailyLogs.length}건의 일정</span>
                    </div>
                    <div className='flex flex-wrap gap-2 justify-start md:justify-end'>
                        {/* 조교 모드 버튼 */}
                        {viewMode === 'tutor' && (
                            <button 
                                onClick={openUnscheduledLogModal}
                                className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 px-4 rounded-lg flex items-center shadow transition"
                            >
                                미예약 학생 기록
                            </button>
                        )}
                        {/* 관리자 모드 버튼: [색상 변경] bg-indigo-600 -> bg-indigo-900 */}
                        {viewMode === 'staff' && (
                            <button onClick={openScheduleModal} className="bg-indigo-900 hover:bg-indigo-800 text-white text-sm font-bold py-2 px-4 rounded-lg flex items-center shadow transition">
                                <Icon name="calendar" className="w-4 h-4 mr-2" /> 클리닉 예약
                            </button>
                        )}
                    </div>
                </div>

                {viewMode === 'staff' && selectedLogIds.length > 0 && (
                    <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 animate-fade-in">
                        <span className="text-sm font-bold text-indigo-900 ml-2">{selectedLogIds.length}명 선택됨</span>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => { if(window.confirm(`선택한 ${selectedLogIds.length}건의 일정을 정말 삭제하시겠습니까?`)) { selectedLogIds.forEach(id => handleDeleteClinicLog(id)); setSelectedLogIds([]); } }} className="bg-white border border-gray-300 text-red-600 hover:bg-red-50 text-xs font-bold py-1.5 px-3 rounded-md flex items-center transition">
                                <Icon name="trash" className="w-3 h-3 mr-1" /> 선택 삭제
                            </button>
                            <button onClick={openBulkNotifyModal} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1.5 px-3 rounded-md flex items-center shadow-sm transition">
                                <Icon name="send" className="w-3 h-3 mr-1" /> 선택 알림 일괄 발송/예약
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                    {viewMode === 'staff' && (
                                        <th className="px-4 py-3 text-center w-10">
                                            <input type="checkbox" onChange={handleSelectAll} checked={dailyLogs.length > 0 && selectedLogIds.length === dailyLogs.length} className="rounded text-indigo-900 focus:ring-indigo-900 h-4 w-4" />
                                        </th>
                                    )}
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">학생명</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">예정</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">상태</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">실제 시간</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-2/5">코멘트</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">담당 조교</th>
                                    {viewMode === 'staff' && <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">알림 상태</th>}
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">관리</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {dailyLogs.length > 0 ? (
                                    dailyLogs.map(log => {
                                        const isUnscheduled = !log.plannedTime;
                                        const isSent = log.notificationSent;
                                        const isSelected = selectedLogIds.includes(log.id);
                                        const status = log.status || (log.checkIn ? 'attended' : 'pending');
                                        
                                        return (
                                            // [색상 변경] hover:bg-gray-50 -> hover:bg-indigo-50/30
                                            <tr key={log.id} className={`hover:bg-indigo-50/30 transition ${isSelected ? 'bg-indigo-50' : ''}`}>
                                                {viewMode === 'staff' && (
                                                    <td className="px-4 py-4 text-center">
                                                        <input type="checkbox" checked={isSelected} onChange={() => handleSelectLog(log.id)} className="rounded text-indigo-900 focus:ring-indigo-900 h-4 w-4" />
                                                    </td>
                                                )}
                                                <td className="px-4 py-4 whitespace-nowrap"><div className="text-sm font-bold text-gray-900">{log.studentName}</div></td>
                                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                                    {isUnscheduled ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">미예약</span> : <span className="text-sm font-medium text-gray-700 font-mono">{log.plannedTime}</span>}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-center">{renderStatusBadge(log)}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-center text-sm">
                                                    {log.checkIn ? <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">{log.checkIn} ~ {log.checkOut || '...'}</span> : <span className="text-gray-300">-</span>}
                                                </td>
                                                <td className="px-4 py-4 text-sm text-gray-700">
                                                    {log.comment ? <div className="line-clamp-2 text-gray-800" title={log.comment}>{log.comment}</div> : <span className="text-gray-400 text-xs italic">내용 없음</span>}
                                                </td>
                                                <td className="px-4 py-4 text-center whitespace-nowrap text-sm text-gray-600">{log.tutor || '-'}</td>

                                                {viewMode === 'staff' && (
                                                    <td className="px-4 py-4 whitespace-nowrap text-center">
                                                        {isSent ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700"><Icon name="check" className="w-3 h-3 mr-1" /> 발송됨</span> : 
                                                         (log.comment || status === 'no-show') ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700"><Icon name="clock" className="w-3 h-3 mr-1" /> 대기</span> : 
                                                         <span className="text-gray-400 text-xs">-</span>}
                                                    </td>
                                                )}
                                                <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium">
                                                    <div className="flex justify-center space-x-1">
                                                        <button onClick={() => openCommentModal(log)} className="text-gray-500 hover:text-indigo-900 p-1.5 rounded hover:bg-gray-100 transition" title="기록 수정"><Icon name="edit" className="w-4 h-4" /></button>
                                                        
                                                        {viewMode === 'staff' && (
                                                            <>
                                                                <button 
                                                                    onClick={() => handleNotifyClick(log)}
                                                                    className={`p-1.5 rounded hover:bg-gray-100 transition ${isSent ? 'text-green-600' : 'text-gray-400 hover:text-indigo-900'}`}
                                                                    title="알림 발송"
                                                                >
                                                                    <Icon name="bell" className="w-4 h-4" />
                                                                </button>

                                                                <button onClick={() => {if(window.confirm('일정을 삭제하시겠습니까?')) handleDeleteClinicLog(log.id)}} className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-gray-100 transition" title="삭제"><Icon name="trash" className="w-4 h-4" /></button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                ) : (
                                    <tr><td colSpan={viewMode === 'staff' ? 9 : 7} className="px-6 py-12 text-center text-gray-500 bg-gray-50"><div className="flex flex-col items-center"><Icon name="calendar" className="w-12 h-12 text-gray-300 mb-2" /><p className="text-lg font-medium">등록된 일정이 없습니다.</p></div></td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    <div className="md:hidden p-3 space-y-3 overflow-y-auto">
                        {dailyLogs.length > 0 ? dailyLogs.map(log => {
                            const isUnscheduled = !log.plannedTime;
                            const isSent = log.notificationSent;
                            const isSelected = selectedLogIds.includes(log.id);
                            const status = log.status || (log.checkIn ? 'attended' : 'pending');

                            return (
                                <div key={log.id} className={`bg-white border rounded-xl shadow-sm p-4 space-y-3 ${isSelected ? 'ring-1 ring-indigo-200' : ''}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="text-base font-bold text-gray-900">{log.studentName}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{log.tutor || '담당 조교 미정'}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            {viewMode === 'staff' && (
                                                <label className="flex items-center gap-1 text-xs text-gray-600">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isSelected} 
                                                        onChange={() => handleSelectLog(log.id)} 
                                                        className="rounded text-indigo-900 focus:ring-indigo-900 h-4 w-4"
                                                    />
                                                    선택
                                                </label>
                                            )}
                                            {renderStatusBadge(log)}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                        <div className="bg-gray-50 rounded-lg px-3 py-2">
                                            <p className="font-semibold text-gray-700">예정</p>
                                            <p className="mt-0.5">{isUnscheduled ? '미예약' : log.plannedTime}</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg px-3 py-2">
                                            <p className="font-semibold text-gray-700">실제 시간</p>
                                            <p className="mt-0.5 font-mono text-[11px]">
                                                {log.checkIn ? `${log.checkIn} ~ ${log.checkOut || '...'}` : '-'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-sm text-gray-700">
                                        {log.comment ? (
                                            <p className="leading-snug">{log.comment}</p>
                                        ) : (
                                            <p className="text-gray-400 text-xs italic">코멘트가 없습니다.</p>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <button 
                                            onClick={() => openCommentModal(log)} 
                                            className="flex-1 text-sm font-semibold px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-indigo-50 hover:text-indigo-900 transition"
                                        >
                                            기록/코멘트
                                        </button>
                                        
                                        {viewMode === 'staff' && (
                                            <>
                                                <button 
                                                    onClick={() => handleNotifyClick(log)}
                                                    className={`flex-1 text-sm font-semibold px-3 py-2 rounded-lg border transition ${
                                                        isSent ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                                                    }`}
                                                >
                                                    알림 {isSent ? '완료' : '발송'}
                                                </button>
                                                <button 
                                                    onClick={() => {if(window.confirm('일정을 삭제하시겠습니까?')) handleDeleteClinicLog(log.id)}}
                                                    className="flex-1 text-sm font-semibold px-3 py-2 rounded-lg bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition"
                                                >
                                                    삭제
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="text-center text-gray-500 text-sm py-8">
                                선택한 날짜에 일정이 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ClinicScheduleModal isOpen={isScheduleModalOpen} onClose={() => setIsScheduleModalOpen(false)} onSave={handleSaveClinicLog} students={students} defaultDate={filterDate} clinicLogs={clinicLogs} classes={classes} />
            <ClinicCommentModal isOpen={isCommentModalOpen} onClose={() => setIsCommentModalOpen(false)} onSave={handleSaveClinicLog} log={selectedLog} students={students} defaultDate={filterDate} classes={classes} />
            <ClinicNotificationModal isOpen={isNotifyModalOpen} onClose={() => setIsNotifyModalOpen(false)} log={selectedLog} students={students} logNotification={logNotification} onSent={handleNotificationSent} notificationType={selectedNotificationType} />
            <ClinicBulkNotificationModal isOpen={isBulkNotifyModalOpen} onClose={() => setIsBulkNotifyModalOpen(false)} selectedLogs={dailyLogs.filter(log => selectedLogIds.includes(log.id))} students={students} logNotification={logNotification} onSent={handleNotificationSent} />
        </div>
    );
};