import React from 'react';
import useAuth from '../auth/useAuth';

export default function Header({ page }) {
    const { user, role, userProfile } = useAuth();

    const fallbackName = userProfile?.email || user?.email ? (userProfile?.email || user?.email).split('@')[0] : '';
    const displayName = userProfile?.displayName?.trim() || user?.displayName?.trim() || fallbackName || '사용자';
    const roleLabel = role === 'admin' ? '관리자' : role === 'staff' ? '직원' : role === 'parent' ? '학부모' : role === 'student' ? '학생' : '권한 확인 중';
    const avatarLabel = displayName?.[0] || '?';

    const getPageTitle = (pageKey) => {
        const titles = {
            home: '대시보드',
            students: '학생 관리',
            lessons: '수업 관리',
            attendance: '출결 관리',
            grades: '성적 관리',
            homework: '과제 관리',
            clinic: '클리닉 관리',
            communication: '내부 소통',
            payment: '교재 및 수납',
            '/admin/staff': '직원 관리',
            '/admin/notifications': '알림 로그',
            '/admin/payments': '결제 관리',
            '/admin/settings': '시스템 설정',
        };
        return titles[pageKey] || '페이지';
    };

    return (
        <header className="h-14 sm:h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-10 shadow-sm">
            {/* 좌측: 페이지 타이틀 */}
            <div className="flex items-center">
                <h2 className="text-xl font-bold text-gray-800 tracking-tight">
                    {getPageTitle(page)}
                </h2>
            </div>

            {/* 우측: 유틸리티 버튼 */}
            <div className="flex items-center space-x-3 sm:space-x-4">

                <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer p-1.5 rounded-lg hover:bg-gray-50 transition">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm border border-indigo-200">
                        {avatarLabel}
                    </div>
                    <div className="text-sm">
                        <p className="font-bold text-gray-700 leading-none">{displayName}</p>
                        <p className="text-xs text-gray-400 mt-0.5 sm:mt-1">{roleLabel}</p>
                    </div>
                </div>
            </div>
        </header>
    );
}