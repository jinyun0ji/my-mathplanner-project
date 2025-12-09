import React from 'react';
import { Icon } from '../utils/helpers';

export default function Sidebar({ page, setPage, onLogout }) {
    const menuItems = [
        { name: '홈', key: 'home', icon: 'dashboard' },
        { name: '수업 관리', key: 'lessons', icon: 'fileText' },
        { name: '출결 관리', key: 'attendance', icon: 'calendar' },
        { name: '학생 관리', key: 'students', icon: 'users' },
        { name: '성적 관리', key: 'grades', icon: 'barChart' },
        { name: '과제 관리', key: 'homework', icon: 'clipboardCheck' },
        { name: '클리닉 관리', key: 'clinic', icon: 'clock' },
        { name: '내부 소통', key: 'communication', icon: 'messageSquare' },
        { name: '교재/수납', key: 'payment', icon: 'wallet' },
    ];
    
    return (
        <div className="w-56 bg-white shadow-2xl flex flex-col justify-between flex-shrink-0">
            <div>
                <div className="p-5 border-b-2 border-indigo-500 bg-indigo-600 text-white rounded-tr-xl">
                    <h2 className="text-xl font-bold flex items-center">
                        <Icon name="school" className="w-6 h-6 mr-2" />
                        <span className="text-yellow-300">A</span>cademy
                    </h2>
                    <p className="text-xs mt-1 text-indigo-200">직원 시스템</p>
                </div>
                <nav className="mt-4 space-y-2 px-3">
                    {menuItems.map(item => (
                        <button
                            key={item.key}
                            onClick={() => setPage(item.key)}
                            className={`flex items-center w-full px-4 py-2.5 rounded-xl transition duration-150 text-sm font-medium ${
                                page === item.key 
                                    ? 'bg-indigo-500 text-white shadow-md'
                                    : 'text-gray-600 hover:bg-indigo-100 hover:text-indigo-600'
                            }`}
                        >
                            <Icon name={item.icon} className="w-5 h-5 mr-3" />
                            {item.name}
                        </button>
                    ))}
                </nav>
            </div>
            <div className="p-4 border-t">
                <button 
                    onClick={onLogout}
                    className="flex items-center w-full px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 bg-red-100 hover:bg-red-200 transition duration-150"
                >
                    <Icon name="logOut" className="w-5 h-5 mr-3" />
                    로그아웃
                </button>
            </div>
        </div>
    );
};