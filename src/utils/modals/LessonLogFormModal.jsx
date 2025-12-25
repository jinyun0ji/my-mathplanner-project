// src/utils/modals/LessonLogFormModal.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Modal } from '../../components/common/Modal';
import { Icon, calculateClassSessions } from '../../utils/helpers';
import StaffNotificationFields from '../../components/Shared/StaffNotificationFields';

export const LessonLogFormModal = ({ isOpen, onClose, onSave, classId, log = null, classes, defaultDate = null, students, logNotification, onDirtyChange = () => {} }) => {
  const selectedClass = classes.find(c => String(c.id) === String(classId));
  
  const sessions = useMemo(() => selectedClass ? calculateClassSessions(selectedClass) : [], [selectedClass, calculateClassSessions]);
  
  const [date, setDate] = useState(defaultDate || '');
  const [progress, setProgress] = useState('');
  const [videos, setVideos] = useState([]);
  const [materialUrl, setMaterialUrl] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [studentNotificationMap, setStudentNotificationMap] = useState({});
  const [staffNotifyMode, setStaffNotifyMode] = useState('none');
  const [staffNotifyTitle, setStaffNotifyTitle] = useState('');
  const [staffNotifyBody, setStaffNotifyBody] = useState('');
  const [staffNotifyScheduledAt, setStaffNotifyScheduledAt] = useState('');

  // ✅ [추가] 파일 첨부 상태 및 Ref
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const videoIdRef = useRef(0);

  const createVideoEntry = useCallback((video = {}) => ({
    id: video.id || `video-${videoIdRef.current++}`,
    title: video.title || '',
    url: video.url || '',
  }), []);

  const normalizeVideosFromLog = useCallback((logItem) => {
    if (logItem?.videos && Array.isArray(logItem.videos)) {
      return logItem.videos.map(v => createVideoEntry(v));
    }

    const fallbackUrl = logItem?.iframeCode || logItem?.videoUrl;
    if (fallbackUrl) {
      return [createVideoEntry({ url: fallbackUrl, title: logItem?.videoTitle || '' })];
    }

    return [];
  }, [createVideoEntry]);

  const [isDirty, setIsDirty] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const SortableVideoItem = ({ video, index, onRemove, onChange }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      setActivatorNodeRef,
      transform,
      transition,
    } = useSortable({ id: video.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <button
              type="button"
              className="cursor-grab text-gray-500 hover:text-gray-700"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
            >
              <Icon name="menu" className="w-4 h-4" />
            </button>
            <span>영상 {index + 1}</span>
          </div>
          <button
            type="button"
            onClick={() => onRemove(video.id)}
            className="text-red-500 hover:text-red-700 text-sm inline-flex items-center"
          >
            <Icon name="trash" className="w-4 h-4 mr-1" /> 삭제
          </button>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">영상 제목</label>
          <input
            type="text"
            value={video.title ?? ''}
            onChange={e => onChange(video.id, 'title', e.target.value)}
            onPointerDown={e => e.stopPropagation()}
            onPointerDownCapture={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            placeholder="예: 3강 - 다항식 연산"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">iframe 코드 또는 URL</label>
          <textarea
            value={video.url}
            onChange={e => onChange(video.id, 'url', e.target.value)}
            onPointerDown={e => e.stopPropagation()}
            onPointerDownCapture={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            rows="2"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            placeholder="유튜브 임베드 코드 또는 공유 링크를 입력하세요."
          />
        </div>
      </div>
    );
  };

  const toDatetimeLocal = (value) => {
    if (!value) return '';
    const date = value instanceof Date
      ? value
      : typeof value?.toDate === 'function'
        ? value.toDate()
        : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offset = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offset.toISOString().slice(0, 16);
  };

  useEffect(() => {
    videoIdRef.current = 0;
    if (log) {
      setDate(log.date);
      setProgress(log.progress);
      setVideos(normalizeVideosFromLog(log));
      setMaterialUrl(log.materialUrl);
      setScheduleTime(log.scheduleTime || '');
      if (log.notifyMode === 'staff' && log.staffNotification) {
        setStaffNotifyMode(log.staffNotification.mode || 'immediate');
        setStaffNotifyTitle(log.staffNotification.title || '');
        setStaffNotifyBody(log.staffNotification.body || '');
        setStaffNotifyScheduledAt(
          log.staffNotification.mode === 'scheduled'
            ? toDatetimeLocal(log.staffNotification.scheduledAt)
            : ''
        );
      } else {
        setStaffNotifyMode('none');
        setStaffNotifyTitle('');
        setStaffNotifyBody('');
        setStaffNotifyScheduledAt('');
      }
    } else {
      setDate(defaultDate || (sessions.length > 0 ? sessions[sessions.length - 1].date : ''));
      setProgress('');
      setVideos([]);
      setMaterialUrl('');
      setScheduleTime('');
      setStaffNotifyMode('none');
      setStaffNotifyTitle('');
      setStaffNotifyBody('');
      setStaffNotifyScheduledAt('');
    }
    
    // 모달이 열릴 때 알림 설정 기본값 초기화
    if (selectedClass && isOpen) {
        const initialMap = {};
        selectedClass.students.forEach(sId => {
            initialMap[sId] = {
                notifyParent: true,
                notifyStudent: true, // ✅ 기본값: 학생에게도 발송
            };
        });
        setStudentNotificationMap(initialMap); 
    } else if (!selectedClass) {
        setStudentNotificationMap({});
    }
    
    // 모달 열릴 때 dirty 상태 초기화
    if (isOpen) {
        setIsDirty(false);
        onDirtyChange(false);
    }
  }, [log, defaultDate, sessions, selectedClass, isOpen, normalizeVideosFromLog, onDirtyChange]);

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleCloseWrapper = () => {
      if (isDirty) {
          if (!window.confirm("작성 중인 내용이 저장되지 않았습니다. 정말 닫으시겠습니까?")) {
              return;
          }
      }
      onDirtyChange(false);
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
    // ✅ 알림 설정 변경 시에도 경고창이 뜨도록 dirty 상태 설정
    setIsDirty(true); 
  };

  // ✅ [추가] 파일 선택 핸들러
  const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (file) {
          setSelectedFile(file);
          // 파일 선택 시 자료 URL 필드에 파일명을 자동으로 입력해 줌 (사용자 편의)
          setMaterialUrl(file.name); 
          setIsDirty(true);
      }
  };

  // ✅ [추가] 파일 선택 버튼 클릭 트리거
  const handleTriggerFileUpload = () => {
      fileInputRef.current?.click();
  };

  // ✅ [추가] 선택된 파일 취소
  const handleClearFile = () => {
      setSelectedFile(null);
      setMaterialUrl('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsDirty(true);
  };

  const handleAddVideo = () => {
      setVideos(prev => [...prev, createVideoEntry()]);
      setIsDirty(true);
  };

  const handleVideoChange = (id, field, value) => {
      setVideos(prev => prev.map(video => video.id === id ? { ...video, [field]: value ?? '' } : video));
      setIsDirty(true);
  };

  const handleRemoveVideo = (id) => {
      setVideos(prev => prev.filter(video => video.id !== id));
      setIsDirty(true);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setVideos(prev => {
      const oldIndex = prev.findIndex(video => video.id === active.id);
      const newIndex = prev.findIndex(video => video.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
    setIsDirty(true);
  };

  const handleChange = (setter, value) => {
      setter(value);
      setIsDirty(true);
  };

  const handleStaffNotifyModeChange = (value) => {
    setStaffNotifyMode(value);
    if (value !== 'scheduled') {
      setStaffNotifyScheduledAt('');
    }
    setIsDirty(true);
  };

  const handleStaffNotifyTitleChange = (value) => {
    setStaffNotifyTitle(value);
    setIsDirty(true);
  };

  const handleStaffNotifyBodyChange = (value) => {
    setStaffNotifyBody(value);
    setIsDirty(true);
  };

  const handleStaffNotifyScheduledAtChange = (value) => {
    setStaffNotifyScheduledAt(value);
    setIsDirty(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!classId || !date || !progress) return;

    if (staffNotifyMode !== 'none') {
      if (!staffNotifyTitle.trim() || !staffNotifyBody.trim()) {
        alert('직원 알림 제목과 내용을 입력해주세요.');
        return;
      }
      if (staffNotifyMode === 'scheduled' && !staffNotifyScheduledAt) {
        alert('직원 알림 예약 시간을 선택해주세요.');
        return;
      }
    }

    const staffNotification = staffNotifyMode === 'none'
      ? null
      : {
        mode: staffNotifyMode,
        title: staffNotifyTitle.trim(),
        body: staffNotifyBody.trim(),
        ...(staffNotifyMode === 'scheduled'
          ? { scheduledAt: new Date(staffNotifyScheduledAt) }
          : {}),
      };

    const logData = {
        id: log ? log.id : null,
        classId,
        date,
        progress,
        videos: videos
            .filter(video => video.url && video.url.trim())
            .map(video => ({
                title: video.title || '',
                url: video.url.trim(),
            })),
        materialUrl, // URL 입력값 또는 파일명
        file: selectedFile, // ✅ 실제 파일 객체 전달 (상위 컴포넌트에서 업로드 처리 필요)
        scheduleTime: scheduleTime || null,
        notifyMode: staffNotifyMode === 'none' ? 'system' : 'staff',
        staffNotification,
    };
    
    try {
      await onSave(logData, !!log);
    } catch (error) {
      alert('수업 일지 저장에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      return;
    }
    
    if (scheduleTime) {
        const studentRecipients = students.filter(s => {
            const prefs = studentNotificationMap[s.id];
            return prefs && (prefs.notifyParent || prefs.notifyStudent);
        });

        if (studentRecipients.length === 0) {
             alert('알림을 받을 대상 학생을 최소 한 명 이상 선택하거나, 학부모/학생 알림 중 하나 이상을 체크해주세요.');
             // 저장만 진행하고 알림 예약은 스킵하거나, return으로 막을 수 있습니다. 여기서는 저장만 진행.
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

    setIsDirty(false); 
    onDirtyChange(false);
    onClose();
  };

  if (!selectedClass) return null;

  return (
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

            <StaffNotificationFields
                mode={staffNotifyMode}
                onModeChange={handleStaffNotifyModeChange}
                title={staffNotifyTitle}
                onTitleChange={handleStaffNotifyTitleChange}
                body={staffNotifyBody}
                onBodyChange={handleStaffNotifyBodyChange}
                scheduledAt={staffNotifyScheduledAt}
                onScheduledAtChange={handleStaffNotifyScheduledAtChange}
            />

            <div>
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">수업 영상</label>
                    <button
                        type="button"
                        onClick={handleAddVideo}
                        className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
                    >
                        <Icon name="plus" className="w-4 h-4 mr-1" /> 영상 추가
                    </button>
                </div>
                <div className="mt-2 space-y-3">
                    {videos.length === 0 && (
                        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                            영상 추가 버튼을 눌러 임베드 코드 또는 URL을 입력하세요.
                        </div>
                    )}
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={videos.map(video => video.id)} strategy={verticalListSortingStrategy}>
                        {videos.map((video, index) => (
                          <SortableVideoItem
                            key={video.id}
                            video={video}
                            index={index}
                            onRemove={handleRemoveVideo}
                            onChange={handleVideoChange}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                </div>
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

            {/* ✅ [수정] 파일 첨부 및 URL 입력 통합 영역 */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">첨부 자료</label>
                <div className="flex gap-2 items-center">
                    {/* 숨겨진 파일 입력 */}
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    
                    {/* 파일 선택 버튼 */}
                    <button 
                        type="button"
                        onClick={handleTriggerFileUpload}
                        className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium shadow-sm transition"
                    >
                        <Icon name="upload" className="w-4 h-4 mr-2" />
                        파일 찾기
                    </button>

                    {/* 파일명/URL 입력 필드 */}
                    <input 
                        type="text" 
                        value={materialUrl} 
                        onChange={e => handleChange(setMaterialUrl, e.target.value)} 
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 border flex-1" 
                        placeholder="파일을 선택하거나 URL을 직접 입력하세요." 
                    />

                    {/* 선택 취소 버튼 (파일이 선택되었을 때만 표시) */}
                    {selectedFile && (
                        <button 
                            type="button" 
                            onClick={handleClearFile}
                            className="text-red-500 hover:text-red-700 p-2"
                            title="첨부 파일 취소"
                        >
                            <Icon name="x" className="w-5 h-5" />
                        </button>
                    )}
                </div>
                {selectedFile && (
                    <p className="text-xs text-indigo-600 mt-1 flex items-center">
                        <Icon name="check" className="w-3 h-3 mr-1" />
                        첨부 대기 중: <b>{selectedFile.name}</b> ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                )}
            </div>

            {scheduleTime && (
                // ✅ 흰색 배경으로 변경 (bg-white)
                <div className="border border-gray-200 p-4 rounded-lg bg-white space-y-3">
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