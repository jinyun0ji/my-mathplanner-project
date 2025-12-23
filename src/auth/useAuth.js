import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';

export default function useAuth(authInstance) {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userRole, setUserRole] = useState(null);
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