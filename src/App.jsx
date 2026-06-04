// src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import './output.css';

import AuthGate from './app/AuthGate';
import { AuthProvider } from './auth/useAuth';
import SocialCallback from './pages/SocialCallback';
import { UserProvider } from './auth/UserContext';
import LoginPage from './pages/LoginPage';
import InviteSignupPage from './pages/InviteSignupPage';
import { redirectToKakao, redirectToNaver } from './auth/socialRedirect';
import { signInWithGoogle } from './auth/authService';
import StudentLogin from './auth/StudentLogin';
import useAuth from './auth/useAuth';
import { getDefaultRouteForRole } from './auth/authRedirects';
import { DELETION_REQUESTED_MESSAGE } from './accountDeletion';
import { isParentRole, isStudentRole } from './constants/roles';

function LoginRoute() {
    const { user, role, userProfile, loading, logout } = useAuth();
    const navigate = useNavigate();

    const handleSocialLogin = async (providerName) => {
        if (providerName === 'google') return signInWithGoogle();
        if (providerName === 'kakao') return redirectToKakao();
        if (providerName === 'naver') return redirectToNaver();
        throw new Error('지원되지 않는 소셜 로그인입니다.');
    };
    
    useEffect(() => {
        if (loading) return;
        if (!user) return;

        if ((isParentRole(role) || isStudentRole(role)) && userProfile?.deletionAccessBlocked) return;

        const redirectPath = getDefaultRouteForRole(role) || '/home';
        navigate(redirectPath, { replace: true });
    }, [loading, navigate, role, user, userProfile?.deletionAccessBlocked]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-gray-600">
                로그인 상태를 확인하고 있습니다...
            </div>
        );
    }

    if (user && (isParentRole(role) || isStudentRole(role)) && userProfile?.deletionAccessBlocked) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-6 text-center text-gray-700">
                <div className="max-w-sm rounded-2xl border border-rose-100 bg-white p-6 shadow-sm">
                    <p className="text-base font-bold text-gray-900">{DELETION_REQUESTED_MESSAGE}</p>
                    <button
                        type="button"
                        onClick={async () => {
                            await logout();
                            navigate('/login', { replace: true });
                        }}
                        className="mt-5 w-full rounded-xl bg-[#455fab] px-4 py-3 text-sm font-bold text-white"
                    >
                        확인
                    </button>
                </div>
            </div>
        );
    }

    return <LoginPage onSocialLogin={handleSocialLogin} />;
}

function AppRouter() {
    return (
        <Routes>
            <Route path="/auth/callback" element={<SocialCallback />} />
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/student/login" element={<StudentLogin />} />
            <Route path="/student/home" element={<Navigate to="/home" replace />} />
            <Route path="/parent/home" element={<Navigate to="/home" replace />} />
            <Route path="/signup" element={<Navigate to="/signup/invite" replace />} />
            <Route path="/signup/invite" element={<InviteSignupPage />} />
            <Route path="/*" element={<AuthGate />} />
        </Routes>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <UserProvider>
                <AuthProvider>
                    <AppRouter />
                </AuthProvider>
            </UserProvider>
        </BrowserRouter>
    );
}