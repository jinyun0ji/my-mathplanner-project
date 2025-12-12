// src/components/StudentHeader.jsx
import React from 'react';
// import { Icon } from '../utils/helpers'; // 더 이상 사용하지 않음
import SchoolIcon from '@mui/icons-material/School';

export default function StudentHeader() {
    return (
        <header className="bg-white h-14 border-b border-brand-gray/30 flex items-center justify-between px-4 sticky top-0 z-30 shadow-sm shrink-0">
            {/* 좌측 로고 영역 */}
            <div className="flex items-center gap-2 text-brand-dark">
                <div className="bg-brand-dark text-white p-1.5 rounded-lg flex items-center justify-center">
                    <SchoolIcon className="w-5 h-5 text-white" style={{ fontSize: 20 }} />
                </div>
                <h1 className="text-lg font-extrabold tracking-tight text-brand-dark">
                    채수용 수학
                </h1>
            </div>
            
            {/* 우측 영역 (비워둠) */}
            <div className="flex items-center gap-1">
                {/* 로그아웃 버튼 삭제됨 */}
            </div>
        </header>
    );
}