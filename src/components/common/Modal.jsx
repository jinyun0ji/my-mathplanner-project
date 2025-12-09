// src/components/common/Modal.jsx

import React from 'react';
import { Icon } from '../../utils/helpers'; 

// --- 모달 컴포넌트 ---
export const Modal = ({ children, isOpen, onClose, title, maxWidth = 'max-w-2xl' }) => {
    if (!isOpen) return null;

    // ✅ 1. 모달 내용 클릭 시, 이벤트 전파를 차단하는 핸들러
    const handleContentClick = (e) => {
        // 이 코드가 핵심입니다. 내부에서 발생하는 클릭이 부모(배경)로 넘어가지 않게 막습니다.
        e.stopPropagation();
    };

    return (
        // ✅ 2. 배경 DIV에 onClose를 명시적으로 추가하여 배경 클릭 시 닫히도록 만듭니다.
        // 그리고 내부 콘텐츠 클릭 시 이 이벤트가 호출되지 않도록 차단하는 것이 목표입니다.
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={onClose} // 👈 배경 클릭 시 닫히는 로직
        >
            <div 
                className={`bg-white rounded-xl shadow-2xl w-full ${maxWidth} p-6 relative`}
                onClick={handleContentClick} // 👈 내부 콘텐츠에서 발생하는 모든 클릭을 여기서 차단!
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