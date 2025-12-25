import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase/client';
import { signOutUser } from './authService';

const AuthContext = createContext(null);

const LOCAL_STORAGE_KEYS = ['videoBookmarks', 'parent.activeStudentId'];

const clearAuthStorage = () => {
    try {
        LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
        // ignore
    }
};

const normalizeLinkedStudentUids = (data) => {
    if (Array.isArray(data?.linkedStudentUids)) {
        return data.linkedStudentUids.filter((id) => id !== undefined && id !== null);
    }
    return [];
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [profileError, setProfileError] = useState(null);
    const [linkedStudentUids, setLinkedStudentUids] = useState([]);
    const [activeStudentId, setActiveStudentId] = useState(null);
    const [loading, setLoading] = useState(true);
    const errorLoggedRef = useRef(false);

    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return undefined;
        }

        let isMounted = true;

        const resetProfileState = () => {
            setRole(null);
            setUserProfile(null);
            setProfileError(null);
            setLinkedStudentUids([]);
            setActiveStudentId(null);
        };

        const logProfileErrorOnce = (error) => {
            if (!errorLoggedRef.current) {
                console.error('사용자 프로필을 불러오는 중 오류가 발생했습니다:', error);
                errorLoggedRef.current = true;
            }
        };

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!isMounted) return;
            setUser(currentUser);
            resetProfileState();
            errorLoggedRef.current = false;

            if (!currentUser) {
                setLoading(false);
                return;
            }

            if (!db) {
                console.error('Firestore가 초기화되지 않았습니다.');
                setProfileError('Firestore가 초기화되지 않았습니다.');
                setLoading(false);
                return;
            }

            const userDocRef = doc(db, 'users', currentUser.uid);
            setLoading(true);

            try {
                let userDoc = await getDoc(userDocRef);
                if (!isMounted) return;

                if (!userDoc.exists()) {
                    const fallbackQuery = query(
                        collection(db, 'users'),
                        where('authUid', '==', currentUser.uid),
                        limit(1),
                    );
                    const fallbackSnap = await getDocs(fallbackQuery);
                    if (!isMounted) return;
                    userDoc = fallbackSnap.docs[0] || null;
                }

                if (!userDoc || !userDoc.exists()) {
                    setRole(null);
                    setUserProfile(null);
                    setLinkedStudentUids([]);
                    setActiveStudentId(null);
                    setLoading(false);
                    return;
                }

                const data = userDoc.data();
                if (data?.invited === true) {
                    setProfileError('초대가 완료되지 않은 계정입니다.');
                    setRole(null);
                    setUserProfile(null);
                    setLinkedStudentUids([]);
                    setActiveStudentId(null);
                    await signOutUser();
                    setLoading(false);
                    return;
                }

                if (data?.role === 'student' && data?.authUid !== currentUser.uid) {
                    setProfileError('학생 계정 정보가 일치하지 않습니다.');
                    setRole(null);
                    setUserProfile(null);
                    setLinkedStudentUids([]);
                    setActiveStudentId(null);
                    await signOutUser();
                    setLoading(false);
                    return;
                }

                if (data?.role === 'parent' && data?.authUid !== currentUser.uid) {
                    setProfileError('학부모 계정 정보가 일치하지 않습니다.');
                    setRole(null);
                    setUserProfile(null);
                    setLinkedStudentUids([]);
                    setActiveStudentId(null);
                    await signOutUser();
                    setLoading(false);
                    return;
                }

                const profile = {
                    uid: currentUser.uid,
                    role: data?.role ?? null,
                    active: data?.active !== false,
                    displayName: data?.displayName ?? '',
                    name: data?.name ?? '',
                    email: data?.email ?? '',
                };
                setUserProfile(profile);
                setRole(profile.role);
                if (profile.role === 'parent') {
                    setLinkedStudentUids(normalizeLinkedStudentUids(data));
                    setActiveStudentId(data?.activeStudentUid ?? null);
                } else {
                    setLinkedStudentUids([]);
                    setActiveStudentId(null);
                }
            } catch (error) {
                logProfileErrorOnce(error);
                if (isMounted) {
                    setProfileError('프로필을 불러올 수 없습니다.');
                    setRole(null);
                    setUserProfile(null);
                    setLinkedStudentUids([]);
                    setActiveStudentId(null);
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
        if (!auth) {
            clearAuthStorage();
            setUser(null);
            setRole(null);
            setUserProfile(null);
            setProfileError(null);
            setLinkedStudentUids([]);
            setActiveStudentId(null);
            return;
        }

        try {
            await signOutUser();
        } finally {
            clearAuthStorage();
        }
    }, []);

    const value = useMemo(
        () => ({
            user,
            role,
            userProfile,
            profileError,
            linkedStudentUids,
            activeStudentId,
            loading,
            logout,
        }),
        [user, role, userProfile, profileError, linkedStudentUids, activeStudentId, loading, logout],
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export default function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('AuthProvider가 필요합니다.');
    }
    return context;
}
