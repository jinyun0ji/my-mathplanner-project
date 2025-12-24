// src/layout/Sidebar.jsx
import React from 'react';
import { Icon } from '../utils/helpers';
import useAuth from '../auth/useAuth';

export default function Sidebar({ page, setPage, onLogout, isOpen, onClose }) {
    const { role } = useAuth();
    const isAdmin = role === 'admin';
    // ... (menuItems는 그대로 유지) ...
    const menuItems = [
        { name: '대시보드', key: 'home', icon: 'dashboard' },
        { name: '수업 관리', key: 'lessons', icon: 'fileText' },
        { name: '학생 관리', key: 'students', icon: 'users' },
        { name: '출결 관리', key: 'attendance', icon: 'calendar' },
        { name: '성적 관리', key: 'grades', icon: 'barChart' },
        { name: '과제 관리', key: 'homework', icon: 'clipboardCheck' },
        { name: '클리닉 관리', key: 'clinic', icon: 'clock' },
        { name: '교재/수납', key: 'payment', icon: 'wallet' },
        { name: '내부 소통', key: 'communication', icon: 'messageSquare' },
    ];
    const adminMenuItems = [
        { name: '직원 관리', key: '/admin/staff', icon: 'users' },
        { name: '알림 로그', key: '/admin/notifications', icon: 'bell' },
        { name: '결제 관리', key: '/admin/payments', icon: 'creditCard' },
        { name: '시스템 설정', key: '/admin/settings', icon: 'settings' },
    ];
    
    return (
        <aside 
            className={`
                /* 기본 스타일 (모바일/태블릿 세로 모드) */
                fixed inset-y-0 left-0 z-50 w-64 bg-white h-screen border-r border-gray-200 
                flex flex-col justify-between transition-transform duration-300 ease-in-out
                
                /* 닫혀있으면 왼쪽으로 숨김, 열리면 보임 */
                ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
                
                /* ✅ [수정] md(768px) 이상이면 항상 보이고 제자리(static) 차지 */
                md:!translate-x-0 md:static md:shadow-none md:transform-none
            `}
        >
            <div>
                {/* 로고 영역 */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
                    <div className="flex items-center text-indigo-600">
                        <div className="bg-indigo-600 text-white p-1.5 rounded-lg mr-2.5">
                            <Icon name="school" className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight text-gray-900">채수용 수학</h1>
                            <p className="text-[11px] text-gray-400 font-medium -mt-1 tracking-wide">직원용 페이지</p>
                        </div>
                    </div>
                    {/* 닫기 버튼: md 이상에서는 숨김 */}
                    <button onClick={onClose} className="md:hidden text-gray-400 hover:text-gray-600">
                        <Icon name="x" className="w-6 h-6" />
                    </button>
                </div>

                {/* 메뉴 영역 (기존 유지) */}
                <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
                    <p className="px-4 text-xs font-semibold text-gray-400 mb-2 mt-2 uppercase tracking-wider">Menu</p>
                    {menuItems.map(item => {
                        const isActive = page === item.key;
                        return (
                            <button
                                key={item.key}
                                onClick={() => setPage(item.key, null, true)}
                                className={`flex items-center w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                                    isActive 
                                        ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                            >
                                <Icon name={item.icon} className={`w-5 h-5 mr-3 transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                                {item.name}
                            </button>
                        );
                    })}
                    {isAdmin && (
                        <>
                            <p className="px-4 text-xs font-semibold text-gray-400 mb-2 mt-6 uppercase tracking-wider">Admin</p>
                            {adminMenuItems.map(item => {
                                const isActive = page === item.key;
                                return (
                                    <button
                                        key={item.key}
                                        onClick={() => setPage(item.key, null, true)}
                                        className={`flex items-center w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                                            isActive
                                                ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                    >
                                        <Icon name={item.icon} className={`w-5 h-5 mr-3 transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                                        {item.name}
                                    </button>
                                );
                            })}
                        </>
                    )}
                </nav>
            </div>

            {/* 하단 영역 (기존 유지) */}
            <div className="p-4 border-t border-gray-100">
                <button onClick={onLogout} className="flex items-center justify-center w-full px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors duration-200">
                    <Icon name="logOut" className="w-4 h-4 mr-2" />
                    로그아웃
                </button>
            </div>
        </aside>
    );
};