// src/components/StudentHeader.jsx
import React from 'react';
import { Icon } from '../utils/helpers';

export default function StudentHeader({ onLogout }) {
    return (
        <header className="bg-white h-14 border-b border-brand-gray/30 flex items-center justify-between px-4 sticky top-0 z-30 shadow-sm shrink-0">
            <div className="flex items-center gap-2 text-brand-dark">
                <div className="bg-brand-dark text-white p-1.5 rounded-lg">
                    <Icon name="school" className="w-5 h-5" />
                </div>
                {/* 브랜드 컬러(#0001AE)와 굵은 폰트로 로고 강조 */}
                <h1 className="text-lg font-extrabold tracking-tight text-brand-dark">
                    채수용 수학
                </h1>
            </div>
            
            <button 
                onClick={onLogout}
                className="text-brand-gray hover:text-brand-red transition-colors p-2 rounded-full hover:bg-brand-bg"
                title="로그아웃"
            >
                <Icon name="logOut" className="w-5 h-5" />
            </button>
        </header>
    );
}