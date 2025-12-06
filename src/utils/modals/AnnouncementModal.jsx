// src/utils/modals/AnnouncementModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/common/Modal';
import { Icon } from '../../utils/helpers';

export const AnnouncementModal = ({ isOpen, onClose, onSave, announcementToEdit = null, allClasses, allStudents }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isPinned, setIsPinned] = useState(false);
    const [scheduleTime, setScheduleTime] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [newAttachment, setNewAttachment] = useState('');
    const [targetClasses, setTargetClasses] = useState([]); 
    const [targetStudents, setTargetStudents] = useState([]);

    useEffect(() => {
        if (announcementToEdit) {
            setTitle(announcementToEdit.title);
            setContent(announcementToEdit.content);
            setIsPinned(announcementToEdit.isPinned);
            setScheduleTime(announcementToEdit.scheduleTime || '');
            setAttachments(announcementToEdit.attachments || []);
            setTargetClasses(announcementToEdit.targetClasses || []);
            setTargetStudents(announcementToEdit.targetStudents || []);
        } else {
            setTitle('');
            setContent('');
            setIsPinned(false);
            setScheduleTime('');
            setAttachments([]);
            setTargetClasses([]);
            setTargetStudents([]);
        }
    }, [announcementToEdit]);

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

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title || !content) return;

        const announcementData = {
            id: announcementToEdit ? announcementToEdit.id : null,
            author: announcementToEdit?.author || '관리자', 
            date: announcementToEdit?.date || new Date().toISOString().slice(0, 10),
            title,
            content,
            isPinned,
            scheduleTime: scheduleTime || null,
            attachments,
            targetClasses,
            targetStudents,
        };
        onSave(announcementData, !!announcementToEdit);
        onClose();
    };

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
                        <div className="flex items-center">
                            <input type="checkbox" id="isPinned" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                            <label htmlFor="isPinned" className="ml-2 block text-sm font-medium text-gray-700">상단 고정</label>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">내용*</label>
                    <textarea value={content} onChange={e => setContent(e.target.value)} rows="6" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" placeholder="HTML 태그(예: <br>, <b>)를 사용하여 서식을 지정할 수 있습니다."></textarea>
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

                <div className="border p-3 rounded-lg bg-gray-50">
                    <label className="block text-sm font-medium text-gray-700 mb-2">첨부 파일/링크 추가 (선택)</label>
                    <div className="flex space-x-2 mb-2">
                        <input type="text" value={newAttachment} onChange={e => setNewAttachment(e.target.value)} className="flex-1 rounded-md border-gray-300 shadow-sm p-2 border text-sm" placeholder="파일 이름 또는 다운로드 URL" />
                        <button type="button" onClick={handleAddAttachment} className="px-3 py-1 text-sm rounded-lg text-white bg-gray-500 hover:bg-gray-600 flex items-center">
                            <Icon name="plus" className="w-4 h-4 mr-1"/> 추가
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {attachments.map((file, index) => (
                            <div key={index} className="flex items-center bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full">
                                {file}
                                <button type="button" onClick={() => handleRemoveAttachment(index)} className="ml-1 text-blue-800 hover:text-red-600">
                                    <Icon name="x" className="w-3 h-3"/>
                                </button>
                            </div>
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