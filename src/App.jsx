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
import StudentHomeLanding from './pages/StudentHomeLanding';
import ParentHomeLanding from './pages/ParentHomeLanding';
import useAuth from './auth/useAuth';
import { getDefaultRouteForRole } from './auth/authRedirects';

function LoginRoute() {
    const { user, role, loading } = useAuth();
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

        const redirectPath = getDefaultRouteForRole(role) || '/home';
        navigate(redirectPath, { replace: true });
    }, [loading, navigate, role, user]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-gray-600">
                로그인 상태를 확인하고 있습니다...
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
            <Route path="/student/home" element={<StudentHomeLanding />} />
            <Route path="/parent/home" element={<ParentHomeLanding />} />
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