// src/utils/modals/AnnouncementModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    Bold,
    ImagePlus,
    Italic,
    Link2,
    Palette,
    Paperclip,
    Underline,
} from 'lucide-react';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { Modal } from '../../components/common/Modal';
import { Icon } from '../../utils/helpers';
import StaffNotificationFields from '../../components/Shared/StaffNotificationFields';
import { storage } from '../../firebase/client';

export const AnnouncementModal = ({ isOpen, onClose, onSave, announcementToEdit = null, allClasses, allStudents }) => {
    const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
    const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isPinned, setIsPinned] = useState(false);
    const [scheduleTime, setScheduleTime] = useState('');
    const [newAttachment, setNewAttachment] = useState('');
    const [targetClasses, setTargetClasses] = useState([]); 
    const [targetStudents, setTargetStudents] = useState([]);
    const [staffNotifyMode, setStaffNotifyMode] = useState('none');
    const [staffNotifyTitle, setStaffNotifyTitle] = useState('');
    const [staffNotifyBody, setStaffNotifyBody] = useState('');
    const [staffNotifyScheduledAt, setStaffNotifyScheduledAt] = useState('');
    
    // 선택된 이미지 상태 관리
    const [selectedImage, setSelectedImage] = useState(null);

    // ✅ [수정] 파일 업로드 관련 상태
    const [attachments, setAttachments] = useState([]);
    const fileInputRef = useRef(null);
    const imageFileInputRef = useRef(null);
    const selectionRangeRef = useRef(null);
    const [isImageUploading, setIsImageUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const editorRef = useRef(null);

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
        if (isOpen) {
            if (announcementToEdit) {
                setTitle(announcementToEdit.title);
                setContent(announcementToEdit.content);
                setIsPinned(announcementToEdit.isPinned);
                setScheduleTime(announcementToEdit.scheduleTime || '');
                setAttachments(announcementToEdit.attachments || []);
                setTargetClasses(Array.isArray(announcementToEdit.targetClassIds)
                    ? announcementToEdit.targetClassIds.map((id) => String(id))
                    : Array.isArray(announcementToEdit.targetClasses)
                        ? announcementToEdit.targetClasses.map((id) => String(id))
                        : []);
                setTargetStudents(announcementToEdit.targetStudents || []);
                if (editorRef.current) {
                    editorRef.current.innerHTML = announcementToEdit.content;
                }
                if (announcementToEdit.notifyMode === 'staff' && announcementToEdit.staffNotification) {
                    setStaffNotifyMode(announcementToEdit.staffNotification.mode || 'immediate');
                    setStaffNotifyTitle(announcementToEdit.staffNotification.title || '');
                    setStaffNotifyBody(announcementToEdit.staffNotification.body || '');
                    setStaffNotifyScheduledAt(
                        announcementToEdit.staffNotification.mode === 'scheduled'
                            ? toDatetimeLocal(announcementToEdit.staffNotification.scheduledAt)
                            : ''
                    );
                } else {
                    setStaffNotifyMode('none');
                    setStaffNotifyTitle('');
                    setStaffNotifyBody('');
                    setStaffNotifyScheduledAt('');
                }
            } else {
                setTitle('');
                setContent('');
                setIsPinned(false);
                setScheduleTime('');
                setAttachments([]);
                setTargetClasses([]);
                setTargetStudents([]);
                if (editorRef.current) {
                    editorRef.current.innerHTML = '';
                }
                setStaffNotifyMode('none');
                setStaffNotifyTitle('');
                setStaffNotifyBody('');
                setStaffNotifyScheduledAt('');
            }
            setSelectedImage(null); 
            setIsImageUploading(false);
        }
    }, [isOpen, announcementToEdit]);

    // ✅ [추가] 파일 선택 핸들러
    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files).map(file => file.name);
            setAttachments(prev => [...prev, ...newFiles]);
        }
    };

    // ✅ [추가] 파일 삭제 핸들러
    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddAttachment = () => {
        if (newAttachment.trim()) {
            setAttachments(prev => [...prev, newAttachment.trim()]);
            setNewAttachment('');
        }
    };

    const handleRemoveAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleTargetClassToggle = (classId) => {
        const classKey = String(classId);
        setTargetClasses(prev => 
            prev.includes(classKey) 
                ? prev.filter(id => id !== classKey)
                : [...prev, classKey]
        );
    };

    const applyFormat = (command, value = null) => {
        document.execCommand(command, false, value);
        if (editorRef.current) {
            editorRef.current.focus();
            setContent(editorRef.current.innerHTML);
        }
    };

    const saveSelectionRange = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        selectionRangeRef.current = selection.getRangeAt(0).cloneRange();
    };

    const restoreSelectionRange = () => {
        if (!selectionRangeRef.current) return;
        const selection = window.getSelection();
        if (!selection) return;
        selection.removeAllRanges();
        selection.addRange(selectionRangeRef.current);
    };

    const insertImageAtCursor = (url) => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        restoreSelectionRange();
        document.execCommand('insertImage', false, url);
        setContent(editorRef.current.innerHTML);
    };

    const sanitizeFileName = (fileName) =>
        String(fileName || '')
            .trim()
            .replace(/\s+/g, '_')
            .replace(/[^\w.-]/g, '');

    const handleImageInsertion = () => {
        if (isImageUploading) return;
        saveSelectionRange();
        imageFileInputRef.current?.click();
    };

    const handleImageFileChange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            alert('PNG/JPEG/WEBP/GIF 이미지 파일만 업로드할 수 있습니다.');
            return;
        }

        if (file.size > MAX_IMAGE_SIZE_BYTES) {
            alert('이미지 용량은 최대 10MB까지 업로드할 수 있습니다.');
            return;
        }

        try {
            setIsImageUploading(true);
            const safeFileName = sanitizeFileName(file.name) || 'image';
            const filePath = `announcements/images/${Date.now()}_${safeFileName}`;
            const storageRef = ref(storage, filePath);
            const uploadTask = uploadBytesResumable(storageRef, file, {
                contentType: file.type || 'application/octet-stream',
            });

            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', undefined, reject, resolve);
            });

            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            insertImageAtCursor(downloadUrl);
        } catch (error) {
            console.error('[announcement] image upload failed', error);
            alert('이미지 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setIsImageUploading(false);
        }
    };

    const handleLinkInsertion = () => {
        const url = prompt('삽입할 링크 URL을 입력하세요:');
        if (url) {
            applyFormat('createLink', url);
        }
    };

    // 에디터 클릭 핸들러 (이미지 선택 감지)
    const handleEditorClick = (e) => {
        if (e.target.tagName === 'IMG') {
            setSelectedImage(e.target);
            const imgs = editorRef.current.querySelectorAll('img');
            imgs.forEach(img => img.style.outline = 'none');
            e.target.style.outline = '2px solid #3b82f6'; 
        } else {
            setSelectedImage(null);
            if (editorRef.current) {
                const imgs = editorRef.current.querySelectorAll('img');
                imgs.forEach(img => img.style.outline = 'none');
            }
        }
    };

    // 이미지 크기 조절 핸들러
    const handleResizeImage = (width) => {
        if (selectedImage) {
            selectedImage.style.width = width;
            selectedImage.style.height = 'auto'; 
            // 이미지 정렬을 위해 inline-block 스타일 강제 적용 (안전장치)
            selectedImage.style.display = 'inline-block'; 
            setContent(editorRef.current.innerHTML); 
        }
    };

    const handleInput = (e) => {
        setContent(e.currentTarget.innerHTML);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        if (!title || !editorRef.current.textContent.trim() && !editorRef.current.querySelector('img')) return;

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

        // 저장 전 선택 테두리 제거
        if (editorRef.current) {
            const imgs = editorRef.current.querySelectorAll('img');
            imgs.forEach(img => img.style.outline = 'none');
        }
        
        const finalContent = editorRef.current.innerHTML;

        const selectedClassIds = (targetClasses || []).map((id) => String(id));
        const getStudentClassKeys = (student) => {
            const keys = [
                student?.classId,
                student?.classDocId,
                student?.classCode,
                ...(Array.isArray(student?.classIds) ? student.classIds : []),
                ...(Array.isArray(student?.classes) ? student.classes : []),
            ];
            return keys.filter(Boolean).map((value) => String(value));
        };

        const users = Array.isArray(allStudents) ? allStudents : [];

        const selectedStudents = users.filter((student) => {
            if (String(student?.role || '').toLowerCase() != 'student') return false;
            const classKeys = getStudentClassKeys(student);
            return selectedClassIds.some((classId) => classKeys.includes(String(classId)));
        });

        const studentAuthUids = selectedStudents
            .map((s) => s.authUid || s.uid || s.studentAuthUid)
            .filter(Boolean)
            .map(String);

        const filteredTargetStudents = selectedStudents
            .map((s) => s.id || s.uid || s.authUid)
            .filter(Boolean)
            .map(String);

        const parentAuthUids = users
            .filter((user) => {
                if (String(user?.role || '').toLowerCase() !== 'parent') return false;
                const linkedStudentIds = Array.isArray(user?.studentIds) ? user.studentIds.map(String) : [];
                return linkedStudentIds.some((sid) => filteredTargetStudents.includes(sid));
            })
            .map((p) => p.authUid || p.uid)
            .filter(Boolean)
            .map(String);

        const isPublic = selectedClassIds.length === 0;
        const audienceAuthUids = isPublic
            ? []
            : Array.from(new Set([...studentAuthUids, ...parentAuthUids])).filter((v) => Boolean(String(v).trim()));

        const announcementData = {
            id: announcementToEdit ? announcementToEdit.id : null,
            author: announcementToEdit?.author || '관리자',
            date: announcementToEdit?.date || new Date().toISOString().slice(0, 10),
            title,
            content: finalContent,
            isPinned,
            scheduleTime: scheduleTime || null,
            attachments,
            isPublic,
            targetClasses: selectedClassIds,
            targetClassIds: selectedClassIds,
            targetAuthUids: isPublic ? [] : studentAuthUids,
            targetStudents: isPublic ? [] : filteredTargetStudents,
            audienceAuthUids,
            notifyMode: staffNotifyMode === 'none' ? 'system' : 'staff',
            staffNotification,
        };
        console.log('[announcement] save payload', announcementData);
        setIsSubmitting(true);
        try {
            await onSave(announcementData, !!announcementToEdit);
            onClose();
        } catch (error) {
            alert('공지사항 저장에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStaffNotifyModeChange = (value) => {
        setStaffNotifyMode(value);
        if (value !== 'scheduled') {
            setStaffNotifyScheduledAt('');
        }
    };

    const fontSizeOptions = [
        { value: 1, label: '1 (가장 작게)' },
        { value: 2, label: '2 (작게)' },
        { value: 3, label: '3 (기본)' },
        { value: 4, label: '4 (크게)' },
        { value: 5, label: '5 (더 크게)' },
        { value: 6, label: '6 (제목)' },
        { value: 7, label: '7 (가장 크게)' },
    ];

    const toolbarButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={announcementToEdit ? '공지사항 수정' : '새 공지사항 등록'} maxWidth="max-w-4xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">제목*</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                    </div>
                    <div className="flex items-end space-x-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700">예약 발송 시간 (선택)</label>
                            <input type="datetime-local" value={scheduleTime || ''} onChange={e => setScheduleTime(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                        </div>
                        <div className="flex items-center mb-2">
                            <input type="checkbox" id="isPinned" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                            <label htmlFor="isPinned" className="ml-2 block text-sm font-medium text-gray-700">상단 고정</label>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">내용*</label>
                    
                    {/* 서식 툴바 */}
                    <div className="mb-1 flex flex-wrap items-center gap-1 rounded-t-md border border-gray-300 bg-gray-100 p-2">
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('bold')} className={toolbarButtonClass} title="굵게" aria-label="굵게">
                            <Bold className="h-4 w-4" />
                        </button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('italic')} className={toolbarButtonClass} title="기울임" aria-label="기울임">
                            <Italic className="h-4 w-4" />
                        </button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('underline')} className={toolbarButtonClass} title="밑줄" aria-label="밑줄">
                            <Underline className="h-4 w-4" />
                        </button>

                        <div className="mx-1 h-6 w-px bg-gray-300" aria-hidden="true" />

                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('justifyLeft')} title="왼쪽 정렬" aria-label="왼쪽 정렬" className={toolbarButtonClass}>
                            <AlignLeft className="h-4 w-4" />
                        </button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('justifyCenter')} title="가운데 정렬" aria-label="가운데 정렬" className={toolbarButtonClass}>
                            <AlignCenter className="h-4 w-4" />
                        </button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('justifyRight')} title="오른쪽 정렬" aria-label="오른쪽 정렬" className={toolbarButtonClass}>
                            <AlignRight className="h-4 w-4" />
                        </button>

                        <div className="mx-1 h-6 w-px bg-gray-300" aria-hidden="true" />

                        <label className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-gray-700 hover:bg-gray-200" title="글씨 색상" aria-label="글씨 색상">
                            <Palette className="h-4 w-4" />
                            <input 
                                type="color" 
                                onInput={(e) => applyFormat('foreColor', e.target.value)} 
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                aria-label="글씨 색상 선택"
                            />
                        </label>
                            
                        <select 
                            onChange={(e) => applyFormat('fontSize', e.target.value)} 
                            className="h-8 w-28 rounded border border-gray-300 bg-white px-1 text-sm text-gray-700 focus:border-blue-500 focus:ring-blue-500" 
                            title="글씨 크기"
                            aria-label="글씨 크기"
                        >
                            <option value="">글자 크기</option>
                            {fontSizeOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>

                        <div className="mx-1 h-6 w-px bg-gray-300" aria-hidden="true" />

                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleLinkInsertion} title="링크 삽입" aria-label="링크 삽입" className={toolbarButtonClass}>
                            <Link2 className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                saveSelectionRange();
                            }}
                            onClick={handleImageInsertion}
                            title={isImageUploading ? '이미지 업로드 중...' : '이미지 삽입'}
                            aria-label="이미지 삽입"
                            className={toolbarButtonClass}
                            disabled={isImageUploading}
                        >
                            <ImagePlus className="h-4 w-4" />
                        </button>
                        <input
                            ref={imageFileInputRef}
                            type="file"
                            accept={ALLOWED_IMAGE_TYPES.join(',')}
                            className="hidden"
                            onChange={handleImageFileChange}
                        />
                        {isImageUploading && (
                            <span className="text-xs text-blue-600 font-medium">업로드 중...</span>
                        )}

                        {selectedImage && (
                            <div className="ml-2 flex items-center gap-1 rounded bg-blue-50 px-2 py-1 animate-fade-in">
                                <span className="mr-1 text-xs font-bold text-blue-600">사진 크기:</span>
                                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleResizeImage('25%')} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-blue-100">25%</button>
                                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleResizeImage('50%')} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-blue-100">50%</button>
                                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleResizeImage('75%')} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-blue-100">75%</button>
                                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleResizeImage('100%')} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-blue-100">100%</button>
                                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleResizeImage('auto')} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-blue-100">원본</button>
                            </div>
                        )}
                    </div>

                    {/* 에디터 영역 */}
                    <div 
                        ref={editorRef}
                        contentEditable
                        onInput={handleInput}
                        onMouseUp={saveSelectionRange}
                        onKeyUp={saveSelectionRange}
                        onClick={handleEditorClick} 
                        // ✅ [&_img]:inline-block 클래스 추가: 이미지를 인라인 블록으로 처리하여 텍스트 정렬(text-align)의 영향을 받도록 함
                        className="block w-full rounded-b-md border border-gray-300 border-t-0 shadow-sm p-3 min-h-[300px] max-h-[500px] overflow-y-auto focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white prose max-w-none [&_img]:inline-block [&_img]:align-middle"
                        style={{ outline: 'none' }}
                        placeholder="공지 내용을 입력하세요. 텍스트를 드래그하거나 이미지를 붙여넣을 수 있습니다."
                    />
                </div>

                <StaffNotificationFields
                    mode={staffNotifyMode}
                    onModeChange={handleStaffNotifyModeChange}
                    title={staffNotifyTitle}
                    onTitleChange={setStaffNotifyTitle}
                    body={staffNotifyBody}
                    onBodyChange={setStaffNotifyBody}
                    scheduledAt={staffNotifyScheduledAt}
                    onScheduledAtChange={setStaffNotifyScheduledAt}
                />

                {/* ✅ [수정] 파일 첨부 영역 */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">첨부파일</label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="file" 
                            multiple 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            className="hidden" 
                        />
                        <button 
                            type="button" 
                            onClick={() => fileInputRef.current.click()}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors border border-gray-300"
                            title="첨부파일 추가"
                            aria-label="첨부파일 추가"
                        >
                            <Paperclip className="h-4 w-4" />
                            파일 추가
                        </button>
                        <span className="text-xs text-gray-400">PDF, HWP, JPG 등 업로드 가능</span>
                    </div>

                    {/* 첨부된 파일 리스트 */}
                    {attachments.length > 0 && (
                        <div className="mt-3 space-y-2">
                            {attachments.map((file, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-700">
                                    <div className="flex items-center gap-2">
                                        <Icon name="fileText" className="w-4 h-4" />
                                        <span>{file}</span>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => removeAttachment(index)} 
                                        className="text-gray-400 hover:text-red-500 p-1"
                                    >
                                        <Icon name="x" className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                 <div className="border p-3 rounded-lg bg-yellow-50">
                    <h4 className="text-sm font-semibold mb-2 text-gray-700">대상 설정 (선택 사항)</h4>
                    <p className="text-xs text-gray-600 mb-2">특정 클래스에만 노출되도록 설정할 수 있습니다. 설정하지 않으면 전체에게 노출됩니다.</p>
                    <div className="flex flex-wrap gap-2">
                        {allClasses.map(cls => (
                            <button
                                key={cls.id}
                                type="button"
                                onClick={() => handleTargetClassToggle(cls.id)}
                                className={`px-3 py-1 text-xs rounded-full border transition duration-150 ${
                                    targetClasses.includes(String(cls.id)) 
                                        ? 'bg-orange-500 text-white border-orange-600 shadow-sm'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-orange-50'
                                }`}
                            >
                                {cls.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="pt-4 border-t flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition duration-150">
                        취소
                    </button>
                    <button type="submit" disabled={isSubmitting} className={`px-4 py-2 text-sm font-medium rounded-lg text-white transition duration-150 shadow-md ${isSubmitting ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        {isSubmitting ? '게시 중...' : (announcementToEdit ? '수정 사항 저장' : (scheduleTime ? '예약 등록' : '즉시 게시'))}
                    </button>
                </div>
            </form>
        </Modal>
    );
};