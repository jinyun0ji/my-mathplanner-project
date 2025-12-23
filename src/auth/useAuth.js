import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';

const loadInitialSession = () => {
    if (typeof localStorage === 'undefined') return null;
    try {
        return JSON.parse(localStorage.getItem('session')) || null;
    } catch (error) {
        console.error('세션 정보를 불러오지 못했습니다:', error);
        return null;
    }
};

export default function useAuth(authInstance) {
    const initialSession = loadInitialSession();

    const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(initialSession?.isLoggedIn));
    const [userRole, setUserRole] = useState(() => initialSession?.userRole || null);
    const [userId, setUserId] = useState(() => initialSession?.userId || null);

    useEffect(() => {
        if (!authInstance) return undefined;
        const unsubscribe = onAuthStateChanged(authInstance, (user) => { if (user) setUserId(user.uid); });
        return () => unsubscribe();
    }, [authInstance]);

    useEffect(() => {
        if (typeof localStorage === 'undefined') return;
        if (isLoggedIn && userRole && userId !== null) {
            try {
                localStorage.setItem('session', JSON.stringify({ isLoggedIn: true, userRole, userId }));
            } catch (error) {
                console.error('세션 정보를 저장하지 못했습니다:', error);
            }
        } else {
            try {
                localStorage.removeItem('session');
            } catch (error) {
                console.error('세션 정보를 삭제하지 못했습니다:', error);
            }
        }
    }, [isLoggedIn, userRole, userId]);

    const handleLoginSuccess = (role, id) => {
        setIsLoggedIn(true);
        setUserRole(role);
        setUserId(id);
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        setUserRole(null);
        setUserId(null);
    };

    return {
        isLoggedIn,
        userRole,
        userId,
        handleLoginSuccess,
        handleLogout,
    };
}