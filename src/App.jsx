// src/App.jsx
import React, { useEffect, useState } from 'react';
import './output.css';

import AuthGate from './app/AuthGate';
import { AuthProvider } from './auth/useAuth';
import AdminRoute from './routes/AdminRoute';
import StaffManagement from './pages/admin/StaffManagement';

function AppRouter() {
    const [pathname, setPathname] = useState(() => window.location.pathname);

    useEffect(() => {
        const handleLocationChange = () => setPathname(window.location.pathname);
        window.addEventListener('popstate', handleLocationChange);
        return () => window.removeEventListener('popstate', handleLocationChange);
    }, []);

    if (pathname === '/admin/staff') {
        return (
            <AdminRoute>
                <StaffManagement />
            </AdminRoute>
        );
    }

    return <AuthGate />;
}

export default function App() {
    return (
        <AuthProvider>
            <AppRouter />
        </AuthProvider>
    );
}