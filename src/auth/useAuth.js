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

                // ✅ B안: authUid -> userDocId 인덱스 조회
                const indexRef = doc(db, 'userAuthIndex', authUid);
                const indexSnap = await getDoc(indexRef);
                if (!isMounted) return;

                if (!indexSnap.exists()) {
                    // ❌ 여기서 users/{authUid} 자동생성 절대 금지
                    setProfileError('프로필을 찾을 수 없습니다. 초대 코드로 가입을 진행해주세요.');
                    setRole(null);
                    setUserProfile(null);
                    setStudentIds([]);
                    setActiveStudentId(null);
                    setProfileDocId(null);
                    setLoading(false);
                    return;
                }

                const indexData = indexSnap.data() || {};
                const userDocId = typeof indexData.userDocId === 'string' ? indexData.userDocId : '';
                const roleFromIndex = normalizeRole(indexData.role ?? null);

                if (!userDocId || !roleFromIndex) {
                    setProfileError('프로필 연결 정보가 올바르지 않습니다. 담당자에게 문의해주세요.');
                    setRole(null);
                    setUserProfile(null);
                    setStudentIds([]);
                    setActiveStudentId(null);
                    setProfileDocId(null);
                    setLoading(false);
                    return;
                }

                // ✅ 인덱스가 가리키는 실제 users 문서 로드
                const profileRef = doc(db, 'users', userDocId);
                const profileSnap = await getDoc(profileRef);
                if (!isMounted) return;

                if (!profileSnap.exists()) {
                    setProfileError('연결된 사용자 프로필을 찾을 수 없습니다. 담당자에게 문의해주세요.');
                    setRole(null);
                    setUserProfile(null);
                    setStudentIds([]);
                    setActiveStudentId(null);
                    setProfileDocId(null);
                    setLoading(false);
                    return;
                }

                const data = profileSnap.data() || {};
                const roleFromDoc = normalizeRole(data?.role ?? null) || roleFromIndex;

                if (!roleFromDoc) {
                    setProfileError('프로필 역할 정보를 확인할 수 없습니다.');
                    setRole(null);
                    setUserProfile(null);
                    setStudentIds([]);
                    setActiveStudentId(null);
                    setProfileDocId(null);
                    setLoading(false);
                    return;
                }

                // ✅ 공통 프로필 구성
                const resolvedProfile = {
                    authUid,
                    profileDocId: profileSnap.id, // users 문서 id (studentDocId 또는 authUid(부모/직원))
                    role: roleFromDoc,
                    active: data?.active !== false,
                    displayName: data?.displayName ?? data?.name ?? '',
                    email: data?.email ?? '',
                };

                let resolvedStudentIds = [];
                let resolvedActiveStudentId = null;

                if (isParentRole(roleFromDoc)) {
                    resolvedStudentIds = normalizeStudentIds(data);
                    resolvedActiveStudentId = data?.activeStudentId ?? null;
                } else if (roleFromDoc === ROLE.STUDENT) {
                    // ✅ 학생: 너 스키마에서 "uid"가 학생 식별자(초대코드 생성용)라고 했으니 우선 사용
                    // 없으면 users 문서 id(=studentDocId)로 fallback
                    const academyStudentUid =
                        typeof data?.uid === 'string' && data.uid.trim() ? data.uid.trim() : null;

                    const studentDocId = profileSnap.id;

                    const studentKey = academyStudentUid || studentDocId;
                    resolvedStudentIds = studentKey ? [studentKey] : [];
                    resolvedActiveStudentId = studentKey || null;
                }

                setUserProfile(resolvedProfile);
                setRole(roleFromDoc);
                setProfileDocId(profileSnap.id);

                if (isParentRole(roleFromDoc) || roleFromDoc === ROLE.STUDENT) {
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
                if (isMounted) setLoading(false);
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

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('AuthProvider가 필요합니다.');
    }
    return context;
}
