// src/pages/LoginPage.jsx
import React from 'react';
import { Icon } from '../utils/helpers';
import { Link } from 'react-router-dom';

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
                    <div className="mt-6">
                        <button
                            type="button"
                            onClick={() => onSocialLogin('google')}
                            className="w-full inline-flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 rounded-xl shadow-sm bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <span className="sr-only">Sign in with Google</span>
                            <svg
                                className="h-5 w-5"
                                viewBox="0 0 48 48"
                                aria-hidden="true"
                            >
                                <path
                                    fill="#EA4335"
                                    d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.6 2.3 30.1 0 24 0 14.6 0 6.5 5.4 2.5 13.2l7.8 6.1C12.2 13.1 17.7 9.5 24 9.5z"
                                />
                                <path
                                    fill="#4285F4"
                                    d="M47.6 24.6c0-1.6-.1-2.8-.4-4H24v7.6h13.5c-.3 2.1-1.8 5.3-5.1 7.4l7.8 6.1c4.6-4.3 7.4-10.7 7.4-17.1z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M10.3 28.9c-.6-1.8-1-3.7-1-5.7s.4-3.9 1-5.7L2.5 11.4C.9 14.6 0 18.2 0 22c0 3.8.9 7.4 2.5 10.6l7.8-3.7z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M24 48c6.1 0 11.6-2 15.5-5.4l-7.8-6.1c-2.1 1.4-5 2.4-7.7 2.4-6.3 0-11.8-3.6-13.7-8.8l-7.8 3.7C6.5 42.6 14.6 48 24 48z"
                                />
                            </svg>
                            Google로 로그인
                        </button>
                    </div>
                </div>
                <div className="mt-6 text-center text-sm text-gray-500">
                        <span>초대 코드로 가입하시나요?</span>{' '}
                        <Link to="/signup/invite" className="font-semibold text-indigo-600 hover:text-indigo-700">
                            초대 코드로 가입하기
                        </Link>
                    </div>
            </div>
            <p className="fixed bottom-6 text-xs text-gray-400">© 2025 Chaesooyong Math Academy. All rights reserved.</p>
        </div>
    );
}