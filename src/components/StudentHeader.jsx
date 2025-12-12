// src/components/StudentHeader.jsx
import React from 'react';
import { Icon } from '../utils/helpers';

export default function StudentHeader({ onLogout }) {
    return (
        <header className="bg-white h-14 border-b border-gray-100 flex items-center justify-between px-4 sticky top-0 z-30 shadow-sm shrink-0">
            <div className="flex items-center gap-2 text-indigo-600">
                <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
                    <Icon name="school" className="w-5 h-5" />
                </div>
                <h1 className="text-lg font-extrabold tracking-tight text-gray-900">
                    채수용 수학
                </h1>
            </div>
            
            <button 
                onClick={onLogout}
                className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-gray-50"
                title="로그아웃"
            >
                <Icon name="logOut" className="w-5 h-5" />
            </button>
        </header>
    );
}