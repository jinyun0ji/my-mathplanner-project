// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { Icon } from '../utils/helpers'; 

export default function LoginPage({ onLogin }) { 
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');

        if (id === 'employee' && password === 'academy') {
            onLogin('staff', 'employee-id');
        } 
        else if (id === 'student' && password === '1234') {
            onLogin('student', 1); 
        }
        else if (id === 'parent' && password === '1234') {
            onLogin('parent', 'parent-id'); 
        }
        else {
            setError('아이디 또는 비밀번호가 올바르지 않습니다.');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="w-full max-w-md bg-white shadow-2xl rounded-2xl overflow-hidden border border-gray-200">
                <div className="bg-indigo-900 p-10 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="bg-white/10 p-4 rounded-full backdrop-blur-sm border border-white/20">
                            <Icon name="graduationCap" className="w-12 h-12 text-white" />
                        </div>
                    </div>
                    {/* ✅ [수정] 텍스트 변경: 학원 관리 시스템 -> 채수용 수학 */}
                    <h1 className="text-3xl font-bold text-white tracking-tight">채수용 수학</h1>
                    <p className="text-indigo-200 text-sm mt-2 font-medium">학생 / 학부모 / 직원 통합 로그인</p>
                </div>

                <form onSubmit={handleLogin} className="p-10 space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2" htmlFor="username">
                            아이디
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Icon name="user" className="h-5 w-5 text-gray-400" />
                            </div>
                            <input 
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-900 focus:border-transparent transition-all" 
                                id="username" 
                                type="text" 
                                placeholder="아이디를 입력하세요" 
                                value={id} 
                                onChange={(e) => setId(e.target.value)} 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2" htmlFor="password">
                            비밀번호
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Icon name="lock" className="h-5 w-5 text-gray-400" />
                            </div>
                            <input 
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-900 focus:border-transparent transition-all" 
                                id="password" 
                                type="password" 
                                placeholder="비밀번호를 입력하세요" 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                            />
                        </div>
                        {error && (
                            <div className="flex items-center mt-2 text-red-600 text-xs font-medium animate-pulse">
                                <Icon name="alertCircle" className="w-4 h-4 mr-1" />
                                {error}
                            </div>
                        )}
                    </div>

                    <button 
                        className="w-full bg-indigo-900 hover:bg-indigo-800 text-white font-bold py-3.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-900 shadow-lg transition-all duration-200 transform active:scale-[0.98]" 
                        type="submit"
                    >
                        로그인
                    </button>
                    
                     <div className="text-center mt-4">
                        <p className="text-xs text-gray-400">
                             학생/학부모 초기 비밀번호는 1234입니다.
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}