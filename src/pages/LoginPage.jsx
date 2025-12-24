// src/pages/LoginPage.jsx
import React from 'react';
import { Icon } from '../utils/helpers';

export default function LoginPage({ onSocialLogin }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
                <div className="text-center">
                    {/* ✅ [수정] 로고 변경 */}
                    <div className="mx-auto h-16 w-16 bg-indigo-600 rounded-xl flex items-center justify-center mb-4 shadow-lg transform rotate-3 text-white">
                        <Icon name="book" className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">채수용 수학</h2>
                    <p className="mt-2 text-sm text-gray-500">통합 학습 관리 시스템</p>
                </div>

                <div className="mt-8">
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                        <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">간편 로그인</span></div>
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-3">
                        {['google', 'kakao', 'naver'].map((provider) => (
                            <button
                                key={provider}
                                type="button"
                                onClick={() => onSocialLogin(provider)}
                                className="w-full inline-flex justify-center py-2.5 px-4 border border-gray-300 rounded-xl shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                            >
                                <span className="sr-only">Sign in with {provider}</span>
                                <div className="w-5 h-5 bg-gray-400 rounded-full" /> {/* 아이콘 대체 */}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <p className="fixed bottom-6 text-xs text-gray-400">© 2025 Chaesooyong Math Academy. All rights reserved.</p>
        </div>
    );
}