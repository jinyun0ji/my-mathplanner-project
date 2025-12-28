import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../auth/useAuth';
import { ROLE } from '../constants/roles';
import { getDefaultRouteForRole } from '../auth/authRedirects';

export default function ParentHomeLanding() {
    const { user, role, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (loading) return;

        if (!user) {
            navigate('/student/login', { replace: true });
            return;
        }

        if (role && role !== ROLE.PARENT) {
            const redirectPath = getDefaultRouteForRole(role) || '/home';
            navigate(redirectPath, { replace: true });
        }
    }, [loading, navigate, role, user]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
    }

    if (!user || role !== ROLE.PARENT) {
        return null;
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-gray-900">학부모 홈</h1>
                <p className="text-gray-600">학부모 전용 홈 화면입니다.</p>
            </div>
        </div>
    );
}