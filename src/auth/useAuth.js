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
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/client';
import { signOutUser } from './authService';
import { ALLOWED_ROLES, isParentRole } from '../constants/roles';

const AuthContext = createContext(null);

const LOCAL_STORAGE_KEYS = ['videoBookmarks', 'parent.activeStudentId'];

const clearAuthStorage = () => {
    try {
        LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
        // ignore
    }
};

const normalizeStudentIds = (data) => {
    if (Array.isArray(data?.studentIds)) {
        return data.studentIds.filter((id) => id !== undefined && id !== null);
    }
    return [];
};

const normalizeRole = (role) => (ALLOWED_ROLES.includes(role) ? role : null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [profileError, setProfileError] = useState(null);
    const [studentIds, setStudentIds] = useState([]);
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
            setStudentIds([]);
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

                if (!userDoc || !userDoc.exists()) {
                    setProfileError('초대 기반 가입이 필요합니다.');
                    setRole(null);
                    setUserProfile(null);
                    setStudentIds([]);
                    setActiveStudentId(null);
                    await signOutUser();
                    setLoading(false);
                    return;
                }

                const data = userDoc.data();
                const profile = {
                    uid: currentUser.uid,
                    role: normalizeRole(data?.role ?? null),
                    active: data?.active !== false,
                    displayName: data?.displayName ?? '',
                    email: data?.email ?? '',
                };
                setUserProfile(profile);
                setRole(profile.role);
                if (isParentRole(profile.role)) {
                    setStudentIds(normalizeStudentIds(data));
                    setActiveStudentId(data?.activeStudentId ?? null);
                } else {
                    setStudentIds([]);
                    setActiveStudentId(null);
                }
            } catch (error) {
                logProfileErrorOnce(error);
                if (isMounted) {
                    setProfileError('프로필을 불러올 수 없습니다.');
                    setRole(null);
                    setUserProfile(null);
                    setStudentIds([]);
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
            setStudentIds([]);
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
            studentIds,
            activeStudentId,
            loading,
            logout,
        }),
        [user, role, userProfile, profileError, studentIds, activeStudentId, loading, logout],
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
