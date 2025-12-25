import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../auth/useAuth';
import { isAdminRole } from '../constants/roles';

export default function AdminRoute({ children }) {
    const { user, role, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (loading) return;
        if (!user) {
            navigate('/login', { replace: true });
            return;
        }
        if (role === null) {
            return;
        }
        if (!isAdminRole(role)) {
            navigate('/home', { replace: true });
        }
    }, [loading, navigate, role, user]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-gray-600">
                로딩 중...
            </div>
        );
    }

    if (!user || role === null || !isAdminRole(role)) {
        return null;
    }

    return <>{children}</>;
}
