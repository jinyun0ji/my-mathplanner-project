// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { Icon } from '../utils/helpers';
// ✅ Google Icon import (없으면 설치: npm install @mui/icons-material)
import CalculateIcon from '@mui/icons-material/Calculate'; 

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
                {/* 상단 디자인 변경: 전문적인 느낌 */}
                <div className="bg-brand-dark p-10 text-center relative overflow-hidden">
                    {/* 배경 장식 (수학적 도형 느낌) */}
                    <div className="absolute top-[-20px] left-[-20px] w-24 h-24 rounded-full border-4 border-white/10"></div>
                    <div className="absolute bottom-[-10px] right-[-10px] w-32 h-32 rounded-full border-4 border-white/5"></div>
                    
                    <div className="flex justify-center mb-4 relative z-10">
                        <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-lg">
                            {/* ✅ [수정] 전문적인 로고 아이콘 */}
                            <CalculateIcon className="text-white" style={{ fontSize: 48 }} />
                        </div>
                    </div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight relative z-10">채수용 수학</h1>
                    <p className="text-brand-light/80 text-sm mt-2 font-medium relative z-10">학생 / 학부모 / 직원 통합 로그인</p>
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
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-dark focus:border-transparent transition-all" 
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
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-dark focus:border-transparent transition-all" 
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
                        className="w-full bg-brand-dark hover:bg-brand-dark/90 text-white font-bold py-3.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-dark shadow-lg transition-all duration-200 transform active:scale-[0.98]" 
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