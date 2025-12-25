import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/client';
import { signOutUser } from './authService';

const UserContext = createContext(null);

export function UserProvider({ children }) {
    const [authUser, setAuthUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return undefined;
        }

        let isMounted = true;
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!isMounted) return;

            if (!currentUser) {
                setAuthUser(null);
                setProfile(null);
                setLoading(false);
                return;
            }

            setAuthUser({
                uid: currentUser.uid,
                email: currentUser.email ?? null,
                displayName: currentUser.displayName ?? null,
            });
            setLoading(true);

            try {
                if (!db) {
                    throw new Error('Firestore가 초기화되지 않았습니다.');
                }

                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (!isMounted) return;

                if (!userDoc.exists()) {
                    setProfile({ role: null, active: null });
                } else {
                    const data = userDoc.data();
                    setProfile({
                        role: data?.role ?? null,
                        active: data?.active ?? null,
                    });
                }
            } catch (error) {
                console.error('사용자 프로필을 불러오는 중 오류가 발생했습니다:', error);
                if (isMounted) {
                    setProfile({ role: null, active: null });
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []);

    const logout = useCallback(async () => {
        await signOutUser();
    }, []);

    const value = useMemo(
        () => ({
            authUser,
            profile,
            loading,
            logout,
        }),
        [authUser, profile, loading, logout],
    );

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('UserProvider가 필요합니다.');
    }
    return context;
}