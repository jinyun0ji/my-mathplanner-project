import React from 'react';
import { Icon } from '../utils/helpers';

export default function Sidebar({ page, setPage, onLogout }) {
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
    
    return (
        <aside className="w-64 bg-white h-screen border-r border-gray-200 flex flex-col justify-between flex-shrink-0 z-20 sticky top-0">
            <div>
                {/* 로고 영역 */}
                <div className="h-16 flex items-center px-6 border-b border-gray-100">
                    <div className="flex items-center text-indigo-600">
                        <div className="bg-indigo-600 text-white p-1.5 rounded-lg mr-2.5">
                            <Icon name="school" className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight text-gray-900">채수용 수학</h1>
                            <p className="text-[11px] text-gray-400 font-medium -mt-1 tracking-wide">직원용 페이지</p>
                        </div>
                    </div>
                </div>

                {/* 메뉴 영역 */}
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
                                <Icon 
                                    name={item.icon} 
                                    className={`w-5 h-5 mr-3 transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`} 
                                />
                                {item.name}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* 하단 영역 */}
            <div className="p-4 border-t border-gray-100">
                <button 
                    onClick={onLogout}
                    className="flex items-center justify-center w-full px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors duration-200"
                >
                    <Icon name="logOut" className="w-4 h-4 mr-2" />
                    로그아웃
                </button>
            </div>
        </aside>
    );
};