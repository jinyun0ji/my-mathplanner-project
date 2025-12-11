// src/utils/modals/LessonLogFormModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/common/Modal';
import { Icon, calculateClassSessions } from '../../utils/helpers';

export const LessonLogFormModal = ({ isOpen, onClose, onSave, classId, log = null, classes, defaultDate = null, students, logNotification }) => {
  const selectedClass = classes.find(c => c.id === classId);
  
  // 수업 회차 목록 계산
  const sessions = useMemo(() => selectedClass ? calculateClassSessions(selectedClass) : [], [selectedClass, calculateClassSessions]);
  
  const [date, setDate] = useState(defaultDate || '');
  const [progress, setProgress] = useState('');
  const [iframeCode, setIframeCode] = useState('');
  const [materialUrl, setMaterialUrl] = useState('');
  const [scheduleTime, setScheduleTime] = useState(''); 
  
  // ✅ 수정: 학생별 알림 설정을 담는 맵으로 변경
  const [studentNotificationMap, setStudentNotificationMap] = useState({});

  useEffect(() => {
    if (log) {
      setDate(log.date);
      setProgress(log.progress);
      setIframeCode(log.iframeCode);
      setMaterialUrl(log.materialUrl);
      setScheduleTime(log.scheduleTime || '');
    } else {
      setDate(defaultDate || (sessions.length > 0 ? sessions[sessions.length - 1].date : ''));
      setProgress('');
      setIframeCode('');
      setMaterialUrl('');
      setScheduleTime('');
    }
    
    // 모달이 열릴 때 알림 설정 기본값 초기화 (학부모만 기본 체크)
    if (selectedClass && isOpen) {
        const initialMap = {};
        selectedClass.students.forEach(sId => {
            initialMap[sId] = {
                notifyParent: true,
                notifyStudent: false,
            };
        });
        setStudentNotificationMap(initialMap); 
    } else if (!selectedClass) {
        setStudentNotificationMap({});
    }
  }, [log, defaultDate, sessions, selectedClass, isOpen]); 

  // ✅ 추가: 학생별 알림 설정 토글 핸들러
  const handleNotificationToggle = (studentId, type) => {
    setStudentNotificationMap(prevMap => ({
        ...prevMap,
        [studentId]: {
            ...prevMap[studentId],
            [type]: !prevMap[studentId][type]
        }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!classId || !date || !progress) return;

    const logData = {
        id: log ? log.id : null,
        classId,
        date,
        progress,
        iframeCode,
        materialUrl,
        scheduleTime: scheduleTime || null, // 예약 시간 저장
    };
    
    onSave(logData, !!log);
    
    if (scheduleTime) {
        // ✅ 수정: 알림 맵을 기준으로 수신자 목록 계산
        const studentRecipients = students.filter(s => {
            const prefs = studentNotificationMap[s.id];
            // 학부모나 학생 중 한 명이라도 알림이 켜져 있는 학생만 대상
            return prefs && (prefs.notifyParent || prefs.notifyStudent);
        });

        if (studentRecipients.length === 0) {
             alert('알림을 받을 대상 학생을 최소 한 명 이상 선택하거나, 학부모/학생 알림 중 하나 이상을 체크해주세요.');
             // 알림을 보낼 대상이 없으면 저장만 하고 알림 예약은 건너뜁니다.
        } else {
            let parentCount = 0;
            let studentCount = 0;

            studentRecipients.forEach(s => {
                const prefs = studentNotificationMap[s.id];
                if (prefs.notifyParent) parentCount++;
                if (prefs.notifyStudent) studentCount++;
            });

            const recipients = [];
            if (parentCount > 0) recipients.push('학부모');
            if (studentCount > 0) recipients.push('학생');

            const recipientString = recipients.length > 0 ? recipients.join(' 및 ') : '대상 없음';

            logNotification('scheduled', '수업 일지 알림 예약', 
                `[${selectedClass.name}] 수업 일지가 ${scheduleTime.replace('T', ' ')}에 ${recipientString}에게 발송되도록 예약됨. (총 ${studentRecipients.length}명 대상)`);
        }
    }

    onClose();
  };

  if (!selectedClass) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={log ? '수업 일지 수정' : `${selectedClass.name} 수업 일지 등록`} maxWidth="max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">수업 일자*</label>
                    <select value={date} onChange={e => setDate(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                        {sessions.map(s => (
                            <option key={s.date} value={s.date}>
                                {s.date} ({s.session}회차)
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">알림 예약 시간 (선택)</label>
                    <input type="datetime-local" value={scheduleTime || ''} onChange={e => setScheduleTime(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                    <p className="text-xs text-gray-500 mt-1">예약 시간을 설정하면 알림이 자동으로 전송됩니다.</p>
                </div>
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700">진도/주요 내용*</label>
                <textarea value={progress} onChange={e => setProgress(e.target.value)} rows="3" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" placeholder="예: 다항식의 연산 P.12 ~ P.18 (유형 5까지)"></textarea>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">수업 영상 URL (iframe 코드)</label>
                <input type="text" value={iframeCode} onChange={e => setIframeCode(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" placeholder="유튜브 등 영상 공유 링크의 임베드 코드를 입력하세요." />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700">첨부 자료 URL/이름 (선택)</label>
                <input type="text" value={materialUrl} onChange={e => setMaterialUrl(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" placeholder="예: 수업자료_1103.pdf 또는 다운로드 링크" />
            </div>

            {scheduleTime && (
                <div className="border p-3 rounded-lg bg-yellow-50 space-y-3">
                    <h4 className="text-sm font-bold text-gray-700 mb-2 border-b pb-2">학생별 알림 설정</h4>
                    <div className="overflow-y-auto max-h-60 border rounded-md">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className='bg-gray-100 sticky top-0'>
                                <tr>
                                    <th className="p-2 text-left font-medium text-gray-700">학생명</th>
                                    <th className="p-2 text-center font-medium text-gray-700 w-24">학부모 알림</th>
                                    <th className="p-2 text-center font-medium text-gray-700 w-24">학생 알림</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {selectedClass.students.map(sId => {
                                    const student = students.find(s => s.id === sId);
                                    if (!student || !studentNotificationMap[sId]) return null;
                                    const prefs = studentNotificationMap[sId];

                                    return (
                                        <tr key={sId} className="hover:bg-gray-50">
                                            <td className="p-2 font-medium text-gray-900">{student.name}</td>
                                            <td className="p-2 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={prefs.notifyParent} 
                                                    onChange={() => handleNotificationToggle(sId, 'notifyParent')}
                                                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer" 
                                                />
                                            </td>
                                            <td className="p-2 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={prefs.notifyStudent} 
                                                    onChange={() => handleNotificationToggle(sId, 'notifyStudent')}
                                                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer" 
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-gray-600 pt-2 border-t">
                        체크된 대상에게 예약된 시간에 알림이 발송됩니다. (기본 설정: 학부모에게만 발송)
                    </p>
                </div>
            )}


            <div className="pt-4 border-t flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition duration-150">
                    취소
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 transition duration-150 shadow-md flex items-center">
                    <Icon name="save" className="w-4 h-4 mr-2" />
                    {scheduleTime ? (log ? '일지 수정 & 예약 유지' : '일지 등록 & 알림 예약') : (log ? '수정 사항 저장' : '일지 등록')}
                </button>
            </div>
        </form>
    </Modal>
  );
};