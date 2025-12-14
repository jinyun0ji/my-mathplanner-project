// src/utils/modals/AnnouncementModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../../components/common/Modal';
import { Icon } from '../../utils/helpers';

export const AnnouncementModal = ({ isOpen, onClose, onSave, announcementToEdit = null, allClasses, allStudents }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isPinned, setIsPinned] = useState(false);
    const [scheduleTime, setScheduleTime] = useState('');
    const [newAttachment, setNewAttachment] = useState('');
    const [targetClasses, setTargetClasses] = useState([]); 
    const [targetStudents, setTargetStudents] = useState([]);
    
    // 선택된 이미지 상태 관리
    const [selectedImage, setSelectedImage] = useState(null);

    // ✅ [수정] 파일 업로드 관련 상태
    const [attachments, setAttachments] = useState([]);
    const fileInputRef = useRef(null);

    const editorRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            if (announcementToEdit) {
                setTitle(announcementToEdit.title);
                setContent(announcementToEdit.content);
                setIsPinned(announcementToEdit.isPinned);
                setScheduleTime(announcementToEdit.scheduleTime || '');
                setAttachments(announcementToEdit.attachments || []);
                setTargetClasses(announcementToEdit.targetClasses || []);
                setTargetStudents(announcementToEdit.targetStudents || []);
                if (editorRef.current) {
                    editorRef.current.innerHTML = announcementToEdit.content;
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
            }
            setSelectedImage(null); 
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
        setTargetClasses(prev => 
            prev.includes(classId) 
                ? prev.filter(id => id !== classId)
                : [...prev, classId]
        );
    };

    const applyFormat = (command, value = null) => {
        document.execCommand(command, false, value);
        if (editorRef.current) {
            editorRef.current.focus();
            setContent(editorRef.current.innerHTML);
        }
    };

    const handleImageInsertion = () => {
        const url = prompt("삽입할 이미지의 URL을 입력하세요:");
        if (url) {
            applyFormat('insertImage', url);
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

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title || !editorRef.current.textContent.trim() && !editorRef.current.querySelector('img')) return;

        // 저장 전 선택 테두리 제거
        if (editorRef.current) {
            const imgs = editorRef.current.querySelectorAll('img');
            imgs.forEach(img => img.style.outline = 'none');
        }
        
        const finalContent = editorRef.current.innerHTML;

        const announcementData = {
            id: announcementToEdit ? announcementToEdit.id : null,
            author: announcementToEdit?.author || '관리자', 
            date: announcementToEdit?.date || new Date().toISOString().slice(0, 10),
            title,
            content: finalContent,
            isPinned,
            scheduleTime: scheduleTime || null,
            attachments,
            targetClasses,
            targetStudents,
        };
        onSave(announcementData, !!announcementToEdit);
        onClose();
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
                    <div className="flex space-x-2 mb-1 p-2 bg-gray-100 border border-gray-300 rounded-t-md flex-wrap items-center">
                        {/* ✅ onMouseDown={(e) => e.preventDefault()} 추가로 포커스 유지 */}
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('bold')} className="p-1.5 hover:bg-gray-200 rounded text-sm font-bold w-8 text-center text-gray-700" title="굵게">B</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('italic')} className="p-1.5 hover:bg-gray-200 rounded text-sm italic w-8 text-center text-gray-700" title="기울임">I</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('underline')} className="p-1.5 hover:bg-gray-200 rounded text-sm underline w-8 text-center text-gray-700" title="밑줄">U</button>
                        
                        <div className="flex border-l border-gray-300 pl-2 space-x-1">
                            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('justifyLeft')} title="왼쪽 정렬" className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><Icon name="alignLeft" className="w-5 h-5"/></button>
                            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('justifyCenter')} title="가운데 정렬" className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><Icon name="alignCenter" className="w-5 h-5"/></button>
                            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('justifyRight')} title="오른쪽 정렬" className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><Icon name="alignRight" className="w-5 h-5"/></button>
                        </div>

                        <div className="flex border-l border-gray-300 pl-2 space-x-2 items-center">
                            <label className="flex items-center space-x-1" title="글씨 색상">
                                <input 
                                    type="color" 
                                    onInput={(e) => applyFormat('foreColor', e.target.value)} 
                                    className="w-6 h-6 p-0 border-0 cursor-pointer rounded"
                                />
                            </label>
                            
                            <select 
                                onChange={(e) => applyFormat('fontSize', e.target.value)} 
                                className="text-sm p-1 rounded border border-gray-300 bg-white text-gray-700 focus:ring-blue-500 focus:border-blue-500 w-24" 
                                title="글씨 크기"
                            >
                                <option value="">글자 크기</option>
                                {fontSizeOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>

                        <div className="flex border-l border-gray-300 pl-2 space-x-1">
                            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleImageInsertion} title="이미지 삽입 (URL)" className="p-1.5 hover:bg-gray-200 rounded text-gray-700">
                                <Icon name="image" className="w-5 h-5"/>
                            </button>
                        </div>

                        {selectedImage && (
                            <div className="flex border-l border-gray-300 pl-2 space-x-1 items-center animate-fade-in bg-blue-50 px-2 rounded">
                                <span className="text-xs text-blue-600 font-bold mr-1">사진 크기:</span>
                                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleResizeImage('25%')} className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-blue-100 text-gray-700">25%</button>
                                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleResizeImage('50%')} className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-blue-100 text-gray-700">50%</button>
                                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleResizeImage('75%')} className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-blue-100 text-gray-700">75%</button>
                                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleResizeImage('100%')} className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-blue-100 text-gray-700">100%</button>
                                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleResizeImage('auto')} className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-blue-100 text-gray-700">원본</button>
                            </div>
                        )}
                    </div>

                    {/* 에디터 영역 */}
                    <div 
                        ref={editorRef}
                        contentEditable
                        onInput={handleInput}
                        onClick={handleEditorClick} 
                        // ✅ [&_img]:inline-block 클래스 추가: 이미지를 인라인 블록으로 처리하여 텍스트 정렬(text-align)의 영향을 받도록 함
                        className="block w-full rounded-b-md border border-gray-300 border-t-0 shadow-sm p-3 min-h-[300px] max-h-[500px] overflow-y-auto focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white prose max-w-none [&_img]:inline-block [&_img]:align-middle"
                        style={{ outline: 'none' }}
                        placeholder="공지 내용을 입력하세요. 텍스트를 드래그하거나 이미지를 붙여넣을 수 있습니다."
                    />
                </div>

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
                        >
                            <Icon name="plus" className="w-4 h-4" />
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
                                    targetClasses.includes(cls.id) 
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
                    <button type="submit" className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition duration-150 shadow-md">
                        {announcementToEdit ? '수정 사항 저장' : (scheduleTime ? '예약 등록' : '즉시 게시')}
                    </button>
                </div>
            </form>
        </Modal>
    );
};