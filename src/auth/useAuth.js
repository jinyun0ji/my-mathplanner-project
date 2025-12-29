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
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    query,
    where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase/client';
import { signOutUser } from './authService';
import { ALLOWED_ROLES, ROLE, isParentRole } from '../constants/roles';

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
    const [profileDocId, setProfileDocId] = useState(null);
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
            setProfileDocId(null);
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

        const ensureProfileCallable = functions
            ? httpsCallable(functions, 'ensureUserProfileDoc')
            : null;

        const ensureUserProfileDoc = async () => {
            if (!ensureProfileCallable) return null;
            try {
                const response = await ensureProfileCallable();
                return response?.data || null;
            } catch (error) {
                console.error('사용자 프로필 자동 생성 함수 호출 실패:', error);
                return null;
            }
        };

        const fetchUserProfileDoc = async (authDocRef) => {
            const fetchSnapshot = async () => getDoc(authDocRef);

            let authDocSnap = null;
            try {
                authDocSnap = await fetchSnapshot();
            } catch (error) {
                if (error?.code === 'permission-denied') {
                    await ensureUserProfileDoc();
                    try {
                        authDocSnap = await fetchSnapshot();
                    } catch (retryError) {
                        console.error('프로필 문서 권한 오류로 재시도 실패:', retryError);
                        return null;
                    }
                } else {
                    throw error;
                }
            }

            if (!authDocSnap?.exists?.()) {
                await ensureUserProfileDoc();
                try {
                    authDocSnap = await fetchSnapshot();
                } catch (retryError) {
                    console.error('프로필 문서 재시도 실패:', retryError);
                    return null;
                }
            }

            return authDocSnap;
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
            setLoading(true);

            try {
                const authUid = currentUser.uid;
                const authDocRef = doc(db, 'users', authUid);
                const authDocSnap = await fetchUserProfileDoc(authDocRef);
                if (!isMounted) return;

                let resolvedProfile = null;
                let resolvedRole = null;
                let resolvedStudentIds = [];
                let resolvedActiveStudentId = null;
                let resolvedProfileDocId = null;

                if (authDocSnap?.exists()) {
                    const data = authDocSnap.data();
                    const roleFromDoc = normalizeRole(data?.role ?? null);

                    if (roleFromDoc && roleFromDoc !== ROLE.STUDENT) {
                        resolvedProfileDocId = authDocSnap.id;
                        resolvedRole = roleFromDoc;
                        resolvedProfile = {
                            authUid,
                            profileDocId: authDocSnap.id,
                            role: roleFromDoc,
                            active: data?.active !== false,
                            displayName: data?.displayName ?? '',
                            email: data?.email ?? '',
                        };

                        if (isParentRole(roleFromDoc)) {
                            resolvedStudentIds = normalizeStudentIds(data);
                            resolvedActiveStudentId = data?.activeStudentId ?? null;
                        }
                    }
                }

                if (!resolvedProfile) {
                    const studentQuery = query(
                        collection(db, 'users'),
                        where('authUid', '==', authUid),
                        where('role', '==', ROLE.STUDENT),
                        limit(1),
                    );
                    let studentSnap = null;
                    try {
                        studentSnap = await getDocs(studentQuery);
                    } catch (error) {
                        if (error?.code === 'permission-denied') {
                            studentSnap = { empty: true, docs: [] };
                        } else {
                            throw error;
                        }
                    }

                    if (!isMounted) return;

                    if (!studentSnap.empty) {
                        const studentDoc = studentSnap.docs[0];
                        const data = studentDoc.data();
                        resolvedProfileDocId = studentDoc.id;
                        resolvedRole = ROLE.STUDENT;
                        resolvedProfile = {
                            authUid,
                            profileDocId: studentDoc.id,
                            role: ROLE.STUDENT,
                            active: data?.active !== false,
                            displayName: data?.displayName ?? data?.name ?? '',
                            email: data?.email ?? '',
                        };
                    }
                }

                if (!resolvedProfile) {
                    setProfileError('프로필을 찾을 수 없습니다. 초대 코드로 가입을 진행해주세요.');
                    setRole(null);
                    setUserProfile(null);
                    setStudentIds([]);
                    setActiveStudentId(null);
                    setProfileDocId(null);
                    setLoading(false);
                    return;
                }

                setUserProfile(resolvedProfile);
                setRole(resolvedRole);
                setProfileDocId(resolvedProfileDocId);
                if (isParentRole(resolvedRole)) {
                    setStudentIds(resolvedStudentIds);
                    setActiveStudentId(resolvedActiveStudentId);
                } else {
                    setStudentIds([]);
                    setActiveStudentId(null);
                }
            } catch (error) {
                logProfileErrorOnce(error);
                if (isMounted) {
                    setProfileError('프로필을 불러올 수 없습니다.');
                    setRole(null);
                    setProfileDocId(null);
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
            profileDocId,
        }),
        [user, role, userProfile, profileError, studentIds, activeStudentId, loading, logout, profileDocId],
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
