// src/utils/modals/MemoModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';

export const MemoModal = ({ isOpen, onClose, onSave, studentId, initialContent, studentName }) => {
    const [content, setContent] = useState(initialContent || '');

    useEffect(() => {
        setContent(initialContent || '');
    }, [initialContent, isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(studentId, content);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${studentName} 학생 메모`} maxWidth="max-w-xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="memoContent" className="block text-sm font-medium text-gray-700">
                        {studentName} 학생에 대한 교직원 공유 메모를 작성하세요.
                    </label>
                    <textarea 
                        id="memoContent"
                        value={content} 
                        onChange={e => setContent(e.target.value)} 
                        rows="8" 
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-3 border focus:ring-blue-500 focus:border-blue-500" 
                        placeholder="예: 클리닉 시 오답 정리 습관 지도 필요, 학부모 피드백 전달 완료."
                    ></textarea>
                </div>
                <div className="pt-4 border-t flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition duration-150">
                        취소
                    </button>
                    <button type="submit" className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition duration-150 shadow-md">
                        메모 저장
                    </button>
                </div>
            </form>
        </Modal>
    );
};