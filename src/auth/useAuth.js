import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';

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

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userRole, setUserRole] = useState(() => initialSession?.userRole || null);
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        if (!authInstance) return undefined;
        const unsubscribe = onAuthStateChanged(authInstance, (user) => {
            setIsLoggedIn(Boolean(user));
            setUserId(user?.uid || null);
            if (!user) setUserRole(null);
        });
        return () => unsubscribe();
    }, [authInstance]);

    useEffect(() => {
        if (typeof localStorage === 'undefined') return;
        if (userRole && userId !== null) {
            try {
                localStorage.setItem('session', JSON.stringify({ userRole }));
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
    }, [userRole, userId]);

    const handleLogout = async () => {
        if (authInstance) await signOut(authInstance);
        setIsLoggedIn(false);
        setUserRole(null);
        setUserId(null);
    };

    return {
        isLoggedIn,
        userRole,
        userId,
        setUserRole,
        handleLogout,
    };
}