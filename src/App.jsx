// src/App.jsx
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './output.css';

import AuthGate from './app/AuthGate';
import { AuthProvider } from './auth/useAuth';
import SocialCallback from './pages/SocialCallback';
import { UserProvider } from './auth/UserContext';

function AppRouter() {
    return (
        <Routes>
            <Route path="/auth/callback" element={<SocialCallback />} />
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