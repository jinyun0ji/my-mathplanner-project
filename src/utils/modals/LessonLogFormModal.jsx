// src/utils/modals/LessonLogFormModal.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { Modal } from '../../components/common/Modal';
import { Icon, calculateClassSessions } from '../../utils/helpers';
import StaffNotificationFields from '../../components/Shared/StaffNotificationFields';
import { auth, storage } from '../../firebase/client';

const SortableVideoItem = React.memo(({ video, index, onRemove, onChange }) => {
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
});

const normalizeLessonDate = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const date = value instanceof Date
    ? value
    : typeof value?.toDate === 'function'
      ? value.toDate()
      : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const normalizeStorageSegment = (value) =>
  String(value || '').trim().replace(/\s+/g, '_');

export const LessonLogFormModal = ({ isOpen, onClose, onSave, classId, log = null, classes, defaultDate = null, students, logNotification, onDirtyChange = () => {} }) => {
  const selectedClass = classes.find(c => String(c.id) === String(classId));
  
  const sessions = useMemo(() => selectedClass ? calculateClassSessions(selectedClass) : [], [selectedClass, calculateClassSessions]);
  const classStudents = useMemo(() => {
    if (!classId) return [];
    return students.filter((student) => {
      const classIds = Array.isArray(student.classIds)
        ? student.classIds
        : (student.classes || []);
      return classIds.map(String).includes(String(classId));
    });
  }, [students, classId]);
  
  const [date, setDate] = useState(defaultDate || '');
  const [progress, setProgress] = useState('');
  const [videos, setVideos] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [scheduleTime, setScheduleTime] = useState('');
  const [studentNotificationMap, setStudentNotificationMap] = useState({});
  const [staffNotifyMode, setStaffNotifyMode] = useState('none');
  const [staffNotifyTitle, setStaffNotifyTitle] = useState('');
  const [staffNotifyBody, setStaffNotifyBody] = useState('');
  const [staffNotifyScheduledAt, setStaffNotifyScheduledAt] = useState('');

  const videoIdRef = useRef(0);
  const attachmentIdRef = useRef(0);
  const materialFileInputRef = useRef(null);

  const createVideoEntry = useCallback((video = {}) => ({
    id: video.id || `video-${videoIdRef.current++}`,
    title: video.title || '',
    url: video.url || '',
  }), []);

  const createAttachmentEntry = useCallback((material = {}) => ({
    id: material.id || `attachment-${attachmentIdRef.current++}`,
    name: material.name || '',
    url: material.url || '',
    path: material.path || '',
    size: material.size ?? null,
    type: material.type || '',
    uploadedAt: material.uploadedAt || null,
    uploaderUid: material.uploaderUid || '',
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

  const uploadLessonMaterials = useCallback(async ({
    storage,
    files: selectedFiles,
    className,
    lessonDate,
    uid,
  }) => {
    if (!selectedFiles || selectedFiles.length === 0) return [];

    const uploadResults = [];
    const safeClassName = normalizeStorageSegment(className);
    const safeLessonDate = normalizeLessonDate(lessonDate) || new Date().toISOString().slice(0, 10);

    for (const file of selectedFiles) {
      // ✅ 방어: File/size 확인
      if (!(file instanceof File) || !Number.isFinite(file.size) || file.size <= 0) {
        console.warn('[materials] skip invalid file:', file);
        continue;
      }

      const safeFileName = normalizeStorageSegment(file.name).replace(/_+/g, '_');
      const filePath = `lesson-materials/${safeClassName}/${safeLessonDate}/${Date.now()}-${safeFileName}`;
      const storageRef = ref(storage, filePath);

      // ✅ contentType 지정 (PDF 등에서 특히 중요)
      const metadata = {
        contentType: file.type || 'application/octet-stream',
      };

      const task = uploadBytesResumable(storageRef, file, metadata);

      await new Promise((resolve, reject) => {
        task.on(
          'state_changed',
          (snapshot) => {
            const total = snapshot.totalBytes || file.size || 1;
            const percent = Math.round((snapshot.bytesTransferred / total) * 100);
            setUploadProgress((prev) => ({
              ...prev,
              [file.name]: percent,
            }));
          },
          (err) => reject(err),
          () => resolve()
        );
      });

      // ✅ 업로드 결과 검증 (0바이트 방지)
      const uploadedBytes = task.snapshot?.totalBytes ?? 0;
      if (!uploadedBytes || uploadedBytes <= 0) {
        console.error('[materials] uploaded 0 bytes (abort saving url). file=', file.name, 'path=', filePath);
        throw new Error(`Uploaded 0 bytes: ${file.name}`);
      }

      const downloadURL = await getDownloadURL(task.snapshot.ref);
      uploadResults.push({
        name: file.name,
        path: filePath,
        url: downloadURL,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        uploaderUid: uid,
      });
    }

    return uploadResults;
  }, []);

  const [isDirty, setIsDirty] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

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

  const resetForm = useCallback(() => {
    setDate(defaultDate || (sessions.length > 0 ? sessions[sessions.length - 1].date : ''));
    setProgress('');
    setVideos([]);
    setAttachments([]);
    setFiles([]);
    setUploadProgress({});
    setUploading(false);
    setScheduleTime('');
    setStaffNotifyMode('none');
    setStaffNotifyTitle('');
    setStaffNotifyBody('');
    setStaffNotifyScheduledAt('');
  }, [defaultDate, sessions]);

  const loadExistingLesson = useCallback(() => {
    if (!log) return;
    setDate(log.date || '');
    setProgress(log.progress || '');
    setVideos(normalizeVideosFromLog(log));
    if (Array.isArray(log.attachments)) {
      setAttachments(log.attachments.map(item => createAttachmentEntry(item)));
    } else if (Array.isArray(log.materials)) {
      setAttachments(log.materials.map(item => createAttachmentEntry(item)));
    } else if (log.materialUrl) {
      setAttachments([createAttachmentEntry({ name: log.materialUrl, url: log.materialUrl })]);
    } else {
      setAttachments([]);
    }
    setFiles([]);
    setUploadProgress({});
    setUploading(false);
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
    }, [log, normalizeVideosFromLog, createAttachmentEntry]);

  useEffect(() => {
    if (!isOpen) return;

    const isNew = !log?.id;
    videoIdRef.current = 0;
    attachmentIdRef.current = 0;

    if (isNew) {
      resetForm();
    } else {
      loadExistingLesson();
    }
    
    // 모달이 열릴 때 알림 설정 기본값 초기화
    if (selectedClass) {
        const initialMap = {};
        classStudents.forEach((student) => {
            initialMap[student.id] = {
                notifyParent: true,
                notifyStudent: true, // ✅ 기본값: 학생에게도 발송
            };
        });
        setStudentNotificationMap(initialMap); 
    } else {
        setStudentNotificationMap({});
    }
    
    // 모달 열릴 때 dirty 상태 초기화
    setIsDirty(false);
    onDirtyChange(false);
  }, [classStudents, isOpen, loadExistingLesson, log?.id, onDirtyChange, resetForm, selectedClass]);

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

  const handleMaterialFilesChange = (event) => {
    const picked = Array.from(event.target.files || []);

    // ✅ 0바이트/비정상 파일 방어
    const valid = picked.filter((f) => f instanceof File && Number.isFinite(f.size) && f.size > 0);
    const invalidCount = picked.length - valid.length;
    if (invalidCount > 0) {
      console.warn('[materials] ignored invalid files:', picked.filter(f => !(f instanceof File) || !Number.isFinite(f.size) || f.size <= 0));
      alert('0바이트(빈 파일) 또는 잘못된 파일이 포함되어 있어 제외했습니다. 다시 선택해주세요.');
    }

    setFiles(valid);
    setUploadProgress({});
    if (valid.length > 0) {
      setIsDirty(true);
    }
    event.target.value = '';
  };

  const handleRemoveAttachment = (id) => {
    setAttachments(prev => prev.filter(attachment => attachment.id !== id));
    setIsDirty(true);
  };

  const handleRemoveFile = (fileName) => {
    setFiles(prev => prev.filter(file => file.name !== fileName));
    setUploadProgress(prev => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });
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

      const currentUser = auth.currentUser;
    if (!currentUser?.uid) {
      alert('로그인이 필요합니다.');
      return;
    }

    setUploading(true);
    setUploadProgress({});
    let uploadedFiles = [];

    try {
      uploadedFiles = await uploadLessonMaterials({
        storage,
        files,
        className: selectedClass?.name || classId,
        lessonDate: date,
        uid: currentUser.uid,
      });
    } catch (error) {
      console.error('Failed to upload lesson materials', error);
      alert('파일 업로드 실패');
      setUploading(false);
      return;
    }

    const attachmentsForSave = [...attachments, ...uploadedFiles]
      .map(({ id, ...rest }) => rest)
      .filter(attachment => attachment.url && attachment.name);

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
        attachments: attachmentsForSave,
        scheduleTime: scheduleTime || null,
        notifyMode: staffNotifyMode === 'none' ? 'system' : 'staff',
        staffNotification,
    };
    
    try {
      await onSave(logData, !!log);
    } catch (error) {
      alert('수업 일지 저장에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
      setUploading(false);
      return;
    }

    setFiles([]);
    setUploadProgress({});
    setAttachments(attachmentsForSave.map(item => createAttachmentEntry(item)));
    setUploading(false);
    
    if (scheduleTime) {
        const studentRecipients = classStudents.filter(s => {
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
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">첨부 자료</label>
                    <div className="flex items-center gap-2">
                        <input
                            ref={materialFileInputRef}
                            type="file"
                            multiple
                            onChange={handleMaterialFilesChange}
                            disabled={uploading}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => materialFileInputRef.current?.click()}
                            disabled={uploading}
                            className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
                        >
                            <Icon name="folder" className="w-4 h-4 mr-1" /> 파일 첨부
                        </button>
                    </div>
                  </div>
                  <div className="mt-2 space-y-3">
                    {attachments.length === 0 && files.length === 0 && (
                        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                            파일 첨부 버튼을 눌러 로컬 파일을 업로드하세요.
                        </div>
                    )}
                    {files.length > 0 && (
                        <div className="rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-700 space-y-2">
                            <div className="text-xs font-semibold text-gray-500">선택된 파일</div>
                            {files.map((file) => (
                                <div key={file.name} className="flex items-center justify-between gap-2">
                                    <span className="truncate">{file.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveFile(file.name)}
                                        className="text-xs text-red-500 hover:text-red-700"
                                    >
                                        제거
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    {uploading && (
                        <div className="rounded-md border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-600 flex items-center gap-2">
                            <Icon name="refreshCw" className="w-4 h-4 animate-spin" />
                            <span>파일을 업로드하는 중입니다...</span>
                        </div>
                    )}
                    {Object.entries(uploadProgress).map(([name, percent]) => (
                      <div key={name} className="text-xs text-gray-600">
                        {name} ({percent}%)
                      </div>
                    ))}
                    {attachments.map((attachment, index) => (
                        <div key={attachment.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-gray-700">자료 {index + 1}</div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveAttachment(attachment.id)}
                                    className="text-red-500 hover:text-red-700 text-sm inline-flex items-center"
                                >
                                    <Icon name="trash" className="w-4 h-4 mr-1" /> 삭제
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => window.open(attachment.url, '_blank', 'noopener,noreferrer')}
                                className="text-left text-sm text-indigo-600 hover:text-indigo-700"
                            >
                                {attachment.name || attachment.url}
                            </button>
                        </div>
                    ))}
                </div>
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
                                {classStudents.map((student) => {
                                    const prefs = studentNotificationMap[student.id];
                                    if (!prefs) return null;

                                    return (
                                        <tr key={student.id} className="hover:bg-gray-50">
                                            <td className="p-2 font-medium text-gray-900">{student.name}</td>
                                            <td className="p-2 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={prefs.notifyParent} 
                                                    onChange={() => handleNotificationToggle(student.id, 'notifyParent')}
                                                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer" 
                                                />
                                            </td>
                                            <td className="p-2 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={prefs.notifyStudent} 
                                                    onChange={() => handleNotificationToggle(student.id, 'notifyStudent')}
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
                <button
                    type="submit"
                    disabled={uploading}
                    className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 transition duration-150 shadow-md flex items-center disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Icon name="save" className="w-4 h-4 mr-2" />
                    {uploading
                      ? '파일 업로드 중...'
                      : (scheduleTime ? (log ? '일지 수정 & 예약 유지' : '일지 등록 & 알림 예약') : (log ? '수정 사항 저장' : '일지 등록'))}
                </button>
            </div>
        </form>
    </Modal>
  );
};