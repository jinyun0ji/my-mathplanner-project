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
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
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

const normalizeProfile = (currentUser, data) => ({
    uid: currentUser?.uid ?? null,
    role: data?.role ?? null,
    active: data?.active ?? true,
    displayName: data?.displayName ?? currentUser?.displayName ?? '',
    name: data?.name ?? '',
    email: data?.email ?? currentUser?.email ?? '',
});

const normalizeLinkedStudentIds = (data) => {
    if (Array.isArray(data?.linkedStudentIds)) {
        return data.linkedStudentIds.filter((id) => id !== undefined && id !== null);
    }
    if (Array.isArray(data?.studentIds)) {
        return data.studentIds.filter((id) => id !== undefined && id !== null);
    }
    return [];
};

export function AuthProvider({ children, listenToProfile = false }) {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [profileError, setProfileError] = useState(null);
    const [linkedStudentIds, setLinkedStudentIds] = useState([]);
    const [activeStudentId, setActiveStudentId] = useState(null);
    const [loading, setLoading] = useState(true);
    const errorLoggedRef = useRef(false);

    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return undefined;
        }

        let isMounted = true;
        let userDocUnsub = null;

        const resetProfileState = () => {
            setRole(null);
            setUserProfile(null);
            setProfileError(null);
            setLinkedStudentIds([]);
            setActiveStudentId(null);
        };

        const stopUserDocListener = () => {
            if (userDocUnsub) {
                userDocUnsub();
                userDocUnsub = null;
            }
            };

        const logProfileErrorOnce = (error) => {
            if (!errorLoggedRef.current) {
                console.error('사용자 프로필을 불러오는 중 오류가 발생했습니다:', error);
                errorLoggedRef.current = true;
            }
        };

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!isMounted) return;
            setUser(currentUser);
            resetProfileState();
            errorLoggedRef.current = false;

            stopUserDocListener();

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

            if (listenToProfile) {
                // 비용/안정성 요구에 따라 필요할 때만 실시간 구독을 사용합니다.
                userDocUnsub = onSnapshot(
                    userDocRef,
                    (userDoc) => {
                        if (!isMounted) return;
                        const data = userDoc.exists() ? userDoc.data() : null;
                        const profile = normalizeProfile(currentUser, data);
                        setUserProfile(profile);
                        setRole(profile.role);
                        setLinkedStudentIds(normalizeLinkedStudentIds(data));
                        setActiveStudentId(data?.activeStudentId ?? null);
                        setLoading(false);
                    },
                    (error) => {
                        logProfileErrorOnce(error);
                        if (isMounted) {
                            setUserProfile(normalizeProfile(currentUser, null));
                            setRole(null);
                            setProfileError('프로필을 불러올 수 없습니다.');
                            setLinkedStudentIds([]);
                            setActiveStudentId(null);
                            setLoading(false);
                        }
                    },
                );
                return;
            }

            // 기본값은 단발 getDoc으로 프로필을 로드합니다.
            getDoc(userDocRef)
                .then((userDoc) => {
                    if (!isMounted) return;
                    const data = userDoc.exists() ? userDoc.data() : null;
                    const profile = normalizeProfile(currentUser, data);
                    setUserProfile(profile);
                    setRole(profile.role);
                    setLinkedStudentIds(normalizeLinkedStudentIds(data));
                    setActiveStudentId(data?.activeStudentId ?? null);
                })
                .catch((error) => {
                    logProfileErrorOnce(error);
                    if (isMounted) {
                        setUserProfile(normalizeProfile(currentUser, null));
                        setRole(null);
                        setProfileError('프로필을 불러올 수 없습니다.');
                        setLinkedStudentIds([]);
                        setActiveStudentId(null);
                    }
                })
                .finally(() => {
                    if (isMounted) {
                        setLoading(false);
                    }
                });
        });

        return () => {
            isMounted = false;
            stopUserDocListener();
            unsubscribe();
        };
    }, [listenToProfile]);

    const logout = useCallback(async () => {
        if (!auth) {
            clearAuthStorage();
            setUser(null);
            setRole(null);
            setUserProfile(null);
            setProfileError(null);
            setLinkedStudentIds([]);
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
            linkedStudentIds,
            activeStudentId,
            loading,
            logout,
        }),
        [user, role, userProfile, profileError, linkedStudentIds, activeStudentId, loading, logout],
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
