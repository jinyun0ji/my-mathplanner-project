import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithCustomToken as firebaseSignInWithCustomToken, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/client';
import { signInWithEmail as signInWithEmailService, signInWithGooglePopup as signInWithGooglePopupService } from './authService';

export default function useAuth() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userRole, setUserRole] = useState(null);
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        if (!auth) return undefined;
        
        let isCancelled = false;
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (isCancelled) return;

            setIsLoggedIn(Boolean(user));
            setUserId(user?.uid || null);

            if (!user) {
                setUserRole(null);
                return;
            }

            if (!db) {
                setUserRole(null);
                return;
            }

            try {
                const snap = await getDoc(doc(db, 'users', user.uid));
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
    }, []);

    const signInWithEmail = async (email, password) => signInWithEmailService(email, password);

    const signInWithGooglePopup = async () => signInWithGooglePopupService();

    const signInWithCustomToken = async (customToken) => {
        if (!auth) throw new Error('Firebase가 초기화되지 않았습니다.');
        if (!customToken) throw new Error('커스텀 토큰이 필요합니다.');
        const { user } = await firebaseSignInWithCustomToken(auth, customToken);
        return user?.uid;
    };

    const handleLogout = async () => {
        if (auth) await signOut(auth);
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
        signInWithGooglePopup,
        signInWithCustomToken,
    };
}