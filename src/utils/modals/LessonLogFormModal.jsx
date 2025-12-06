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
  const [selectedStudents, setSelectedStudents] = useState([]); // 알림 대상 학생

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
    if (selectedClass) {
      // 기본 알림 대상은 현재 클래스 학생
      setSelectedStudents(selectedClass.students || []); 
    } else {
      setSelectedStudents([]);
    }
  }, [log, defaultDate, sessions, selectedClass]);

  const handleStudentToggle = (studentId) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
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
        // 알림 예약 모의 로직 (실제 백엔드 알림 예약 기능 대신 프론트엔드 알림 패널에 표시)
        const studentNames = students
            .filter(s => selectedStudents.includes(s.id))
            .map(s => s.name);
        
        logNotification('scheduled', '수업 일지 알림 예약', 
            `[${selectedClass.name}] 수업 일지가 ${scheduleTime.replace('T', ' ')}에 ${studentNames.length}명의 학생/학부모에게 발송되도록 예약됨. (대상: ${studentNames.join(', ')})`);
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
                    <p className="text-xs text-gray-500 mt-1">예약 시간을 설정하면 학생/학부모에게 자동으로 일지 알림이 전송됩니다.</p>
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
                <div className="border p-3 rounded-lg bg-yellow-50">
                    <label className="block text-sm font-bold text-gray-700 mb-2">알림 대상 학생 선택</label>
                    <div className="flex flex-wrap gap-2">
                        {selectedClass.students.map(sId => {
                            const student = students.find(s => s.id === sId);
                            if (!student) return null;
                            return (
                                <button
                                    key={sId}
                                    type="button"
                                    onClick={() => handleStudentToggle(sId)}
                                    className={`px-3 py-1 text-xs rounded-full transition ${
                                        selectedStudents.includes(sId)
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white border text-gray-700 hover:bg-blue-50'
                                    }`}
                                >
                                    {student.name}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-xs text-gray-600 mt-2">선택된 학생의 학부모에게 예약된 시간에 알림이 발송됩니다.</p>
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