// src/App.jsx
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './output.css';

import AuthGate from './app/AuthGate';
import { AuthProvider } from './auth/useAuth';
import SocialCallback from './pages/SocialCallback';
import { UserProvider } from './auth/UserContext';
import LoginPage from './pages/LoginPage';
import InviteSignupPage from './pages/InviteSignupPage';
import { redirectToKakao, redirectToNaver } from './auth/socialRedirect';
import { signInWithGoogle } from './auth/authService';

function LoginRoute() {
    const handleSocialLogin = async (providerName) => {
        if (providerName === 'google') return signInWithGoogle();
        if (providerName === 'kakao') return redirectToKakao();
        if (providerName === 'naver') return redirectToNaver();
        throw new Error('지원되지 않는 소셜 로그인입니다.');
    };

    return <LoginPage onSocialLogin={handleSocialLogin} />;
}

function AppRouter() {
    return (
        <Routes>
            <Route path="/auth/callback" element={<SocialCallback />} />
            <Route path="/login" element={<LoginRoute />} />
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