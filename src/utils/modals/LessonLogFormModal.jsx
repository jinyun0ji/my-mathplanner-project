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
  const [studentNotificationMap, setStudentNotificationMap] = useState({});

  // ✅ [추가] 변경 사항 감지 상태
  const [isDirty, setIsDirty] = useState(false);

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
    
    // 모달이 열릴 때 알림 설정 기본값 초기화
    if (selectedClass && isOpen) {
        const initialMap = {};
        selectedClass.students.forEach(sId => {
            initialMap[sId] = {
                notifyParent: true,
                notifyStudent: true, // ✅ [수정] 기본값을 true로 변경 (학생도 발송)
            };
        });
        setStudentNotificationMap(initialMap); 
    } else if (!selectedClass) {
        setStudentNotificationMap({});
    }
    
    // 모달 열릴 때 dirty 상태 초기화
    if (isOpen) {
        setIsDirty(false);
    }
  }, [log, defaultDate, sessions, selectedClass, isOpen]); 

  // ✅ [추가] 닫기 핸들러 (저장되지 않은 변경사항 확인)
  const handleCloseWrapper = () => {
      if (isDirty) {
          if (!window.confirm("작성 중인 내용이 저장되지 않았습니다. 정말 닫으시겠습니까?")) {
              return;
          }
      }
      onClose();
  };

  const handleNotificationToggle = (studentId, type) => {
    setStudentNotificationMap(prevMap => ({
        ...prevMap,
        [studentId]: {
            ...prevMap[studentId],
            [type]: !prevMap[studentId][type]
        }
    }));
    // 알림 설정 변경도 dirty로 간주하고 싶다면 아래 주석 해제 (보통은 내용 수정만 dirty로 침)
    // setIsDirty(true); 
  };

  // 입력 변경 시 dirty 상태 true로 설정
  const handleChange = (setter, value) => {
      setter(value);
      setIsDirty(true);
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
        scheduleTime: scheduleTime || null,
    };
    
    onSave(logData, !!log);
    
    if (scheduleTime) {
        const studentRecipients = students.filter(s => {
            const prefs = studentNotificationMap[s.id];
            return prefs && (prefs.notifyParent || prefs.notifyStudent);
        });

        if (studentRecipients.length === 0) {
             alert('알림을 받을 대상 학생을 최소 한 명 이상 선택하거나, 학부모/학생 알림 중 하나 이상을 체크해주세요.');
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

    setIsDirty(false); // 저장 완료 후 dirty 해제
    onClose();
  };

  if (!selectedClass) return null;

  return (
    // ✅ [수정] onClose를 handleCloseWrapper로 변경
    <Modal isOpen={isOpen} onClose={handleCloseWrapper} title={log ? '수업 일지 수정' : `${selectedClass.name} 수업 일지 등록`} maxWidth="max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">수업 일자*</label>
                    <select 
                        value={date} 
                        onChange={e => handleChange(setDate, e.target.value)} 
                        required 
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    >
                        {sessions.map(s => (
                            <option key={s.date} value={s.date}>
                                {s.date} ({s.session}회차)
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">알림 예약 시간 (선택)</label>
                    <input 
                        type="datetime-local" 
                        value={scheduleTime || ''} 
                        onChange={e => handleChange(setScheduleTime, e.target.value)} 
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" 
                    />
                    <p className="text-xs text-gray-500 mt-1">예약 시간을 설정하면 알림이 자동으로 전송됩니다.</p>
                </div>
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700">진도/주요 내용*</label>
                <textarea 
                    value={progress} 
                    onChange={e => handleChange(setProgress, e.target.value)} 
                    rows="3" 
                    required 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" 
                    placeholder="예: 다항식의 연산 P.12 ~ P.18 (유형 5까지)"
                ></textarea>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">수업 영상 URL (iframe 코드)</label>
                <input 
                    type="text" 
                    value={iframeCode} 
                    onChange={e => handleChange(setIframeCode, e.target.value)} 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" 
                    placeholder="유튜브 등 영상 공유 링크의 임베드 코드를 입력하세요." 
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700">첨부 자료 URL/이름 (선택)</label>
                <input 
                    type="text" 
                    value={materialUrl} 
                    onChange={e => handleChange(setMaterialUrl, e.target.value)} 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" 
                    placeholder="예: 수업자료_1103.pdf 또는 다운로드 링크" 
                />
            </div>

            {scheduleTime && (
                // ✅ [수정] 배경색 제거 (bg-white) 및 테두리 유지
                <div className="border border-gray-200 p-4 rounded-lg bg-white space-y-3">
                    <h4 className="text-sm font-bold text-gray-700 mb-2 border-b pb-2">학생별 알림 설정</h4>
                    <div className="overflow-y-auto max-h-60 border rounded-md">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className='bg-gray-50 sticky top-0'>
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
                    <p className="text-xs text-gray-500 pt-2">
                        * 체크된 대상에게 예약된 시간에 알림이 발송됩니다. (기본 설정: 학부모/학생 모두 발송)
                    </p>
                </div>
            )}


            <div className="pt-4 border-t flex justify-end space-x-3">
                <button type="button" onClick={handleCloseWrapper} className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition duration-150">
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