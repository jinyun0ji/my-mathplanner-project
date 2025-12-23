import { useEffect, useState } from 'react';
import {
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithCustomToken as firebaseSignInWithCustomToken,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function useAuth(authInstance, dbInstance) {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userRole, setUserRole] = useState(null);
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        if (!authInstance) return undefined;
        
        let isCancelled = false;
        const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
            if (isCancelled) return;

            setIsLoggedIn(Boolean(user));
            setUserId(user?.uid || null);

            if (!user) {
                setUserRole(null);
                return;
            }

            if (!dbInstance) {
                setUserRole(null);
                return;
            }

            try {
                const snap = await getDoc(doc(dbInstance, 'users', user.uid));
                if (isCancelled) return;
                const role = snap.exists() ? snap.data()?.role ?? null : null;
                setUserRole(role);
            } catch (error) {
                console.error('사용자 역할을 불러오는 중 오류가 발생했습니다:', error);
                if (!isCancelled) setUserRole(null);
            }
        });

        return () => {
            isCancelled = true;
            unsubscribe();
        };
    }, [authInstance, dbInstance]);

    const signInWithEmail = async (email, password) => {
        if (!authInstance) throw new Error('Firebase가 초기화되지 않았습니다.');
        const { user } = await signInWithEmailAndPassword(authInstance, email, password);
        return user?.uid;
    };

    const signInWithGoogle = async () => {
        if (!authInstance) throw new Error('Firebase가 초기화되지 않았습니다.');
        const provider = new GoogleAuthProvider();
        const { user } = await signInWithPopup(authInstance, provider);
        return user?.uid;
    };

    const signInWithCustomToken = async (customToken) => {
        if (!authInstance) throw new Error('Firebase가 초기화되지 않았습니다.');
        if (!customToken) throw new Error('커스텀 토큰이 필요합니다.');
        const { user } = await firebaseSignInWithCustomToken(authInstance, customToken);
        return user?.uid;
    };

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
        handleLogout,
        signInWithEmail,
        signInWithGoogle,
        signInWithCustomToken,
    };
}