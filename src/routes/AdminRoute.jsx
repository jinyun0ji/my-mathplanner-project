import React from 'react';
import useAuth from '../auth/useAuth';

export default function AdminRoute({ children }) {
    const { user, role, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-gray-600">
                로딩 중...
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center text-gray-600">
                로그인 후 이용해주세요.
            </div>
        );
    }

    if (role !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center text-gray-600">
                관리자 전용 페이지입니다.
            </div>
        );
    }

    return <>{children}</>;
}
