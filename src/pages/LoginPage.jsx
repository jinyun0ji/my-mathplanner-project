// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import logoHorizontal from '../assets/logo/logo-horizontal.png';
import { Link } from 'react-router-dom';

const getLoginMessage = (error) => {
    if (error?.code === 'google-login/native-unavailable') {
        return error.message;
    }

    return getReviewLoginMessage(error);
};

const getReviewLoginMessage = (error) => {
    const code = error?.code || '';
    if (code.startsWith('review-login/')) {
        return error?.message || '심사용 계정 정보를 확인할 수 없습니다. 관리자에게 문의해주세요.';
    }
    if (code === 'auth/user-disabled') {
        return '심사용 계정이 아직 활성화되지 않았습니다. 관리자에게 문의해주세요.';
    }
    return '이메일 또는 비밀번호를 확인해주세요.';
};

export default function LoginPage({ onSocialLogin, onEmailLogin }) {
    const [isReviewLoginOpen, setIsReviewLoginOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSocialSubmitting, setIsSocialSubmitting] = useState(false);

    const handleReviewLogin = async (event) => {
        event.preventDefault();
        if (!onEmailLogin || isSubmitting) return;

        setErrorMessage('');
        setIsSubmitting(true);

        try {
            await onEmailLogin(email.trim(), password);
        } catch (error) {
            setErrorMessage(getReviewLoginMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    };


    const handleGoogleLogin = async () => {
        if (!onSocialLogin || isSocialSubmitting) return;

        setErrorMessage('');
        setIsSocialSubmitting(true);

        try {
            await onSocialLogin('google');
        } catch (error) {
            setErrorMessage(getLoginMessage(error));
        } finally {
            setIsSocialSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
                <div className="text-center">
                    <img
                        src={logoHorizontal}
                        alt="채수용 수학"
                        className="mx-auto max-h-[72px] w-auto max-w-[280px] object-contain"
                    />
                    <h2 className="sr-only">채수용 수학</h2>
                    <p className="mt-3 text-sm text-gray-500">통합 학습 관리 시스템</p>
                </div>

                <div className="mt-8">
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                        <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">간편 로그인</span></div>
                    </div>
                    <div className="mt-6">
                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={isSocialSubmitting}
                            className="w-full inline-flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 rounded-xl shadow-sm bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
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
                            {isSocialSubmitting ? '로그인 중...' : 'Google로 로그인'}
                        </button>
                        {errorMessage && !isReviewLoginOpen && (
                            <p className="mt-3 text-xs font-semibold text-rose-600" role="alert">
                                {errorMessage}
                            </p>
                        )}
                    </div>
                </div>

                <div className="mt-4 border-t border-gray-100 pt-4">
                    <button
                        type="button"
                        onClick={() => {
                            setIsReviewLoginOpen((current) => !current);
                            setErrorMessage('');
                        }}
                        className="mx-auto flex items-center justify-center text-xs font-semibold text-gray-500 underline-offset-4 hover:text-[#455fab] hover:underline"
                        aria-expanded={isReviewLoginOpen}
                    >
                        심사용 이메일 로그인
                    </button>

                    {isReviewLoginOpen && (
                        <form onSubmit={handleReviewLogin} className="mt-4 space-y-3 rounded-xl bg-gray-50 p-4 text-left">
                            <div>
                                <label htmlFor="review-email" className="block text-xs font-semibold text-gray-600">
                                    이메일
                                </label>
                                <input
                                    id="review-email"
                                    type="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#455fab] focus:outline-none focus:ring-2 focus:ring-[#455fab]/20"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="review-password" className="block text-xs font-semibold text-gray-600">
                                    비밀번호
                                </label>
                                <input
                                    id="review-password"
                                    type="password"
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#455fab] focus:outline-none focus:ring-2 focus:ring-[#455fab]/20"
                                    required
                                />
                            </div>
                            {errorMessage && (
                                <p className="text-xs font-semibold text-rose-600" role="alert">
                                    {errorMessage}
                                </p>
                            )}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full rounded-lg bg-gray-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                            >
                                {isSubmitting ? '로그인 중...' : '로그인'}
                            </button>
                        </form>
                    )}
                </div>

                <div className="mt-6 text-center text-sm text-gray-500 space-y-1">
                    <div>
                        <span>처음 이용하시나요?</span>{' '}
                        <Link to="/signup/invite" className="font-semibold text-[#455fab] hover:text-[#334a91]">
                            초대 코드로 가입하기
                        </Link>
                    </div>
                    <p className="text-xs text-gray-400">학생/학부모는 초대 코드로 최초 1회 가입 후 이용합니다.</p>
                </div>
            </div>
            <p className="fixed bottom-6 text-xs text-gray-400">© 2025 Chaesooyong Math Academy. All rights reserved.</p>
        </div>
    );
}
