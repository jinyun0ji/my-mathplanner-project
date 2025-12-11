// src/components/common/Modal.jsx

import React from 'react';
import { Icon } from '../../utils/helpers'; 

// --- 모달 컴포넌트 ---
export const Modal = ({ children, isOpen, onClose, title, maxWidth = 'max-w-2xl' }) => {
    if (!isOpen) return null;

    const handleContentClick = (e) => {
        e.stopPropagation();
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={onClose} 
        >
            <div 
                // ✅ [수정] max-h-[90vh] overflow-y-auto 추가로 모달 내용 스크롤 처리
                className={`bg-white rounded-xl shadow-2xl w-full ${maxWidth} p-6 relative max-h-[90vh] overflow-y-auto`}
                onClick={handleContentClick} 
            >
                <h3 className="text-lg font-bold mb-4 border-b pb-2">{title}</h3> 
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
                >
                    <Icon name="x" className="w-5 h-5" /> 
                </button>
                {children}
            </div>
        </div>
    );
};