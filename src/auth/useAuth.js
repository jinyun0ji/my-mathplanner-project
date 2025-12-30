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
  } catch {}
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
    let isMounted = true;

    const resetProfileState = () => {
      setRole(null);
      setProfileDocId(null);
      setUserProfile(null);
      setProfileError(null);
      setStudentIds([]);
      setActiveStudentId(null);
    };

    const logProfileErrorOnce = (err) => {
      if (!errorLoggedRef.current) {
        console.error('[useAuth] profile load error:', err);
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

      setLoading(true);

      try {
        const authUid = currentUser.uid;

        /* =========================================================
           1️⃣ userAuthIndex 먼저 시도 (학생 / 학부모)
        ========================================================= */
        const indexRef = doc(db, 'userAuthIndex', authUid);
        const indexSnap = await getDoc(indexRef);

        if (indexSnap.exists()) {
          const { userDocId, role: indexRole } = indexSnap.data();
          const normalizedRole = normalizeRole(indexRole);

          if (!userDocId || !normalizedRole) {
            throw new Error('Invalid userAuthIndex');
          }

          const profileSnap = await getDoc(doc(db, 'users', userDocId));
          if (!profileSnap.exists()) {
            throw new Error('Linked user profile not found');
          }

          const data = profileSnap.data();

          setUserProfile({
            authUid,
            profileDocId: profileSnap.id,
            role: normalizedRole,
            displayName: data.displayName ?? data.name ?? '',
            email: data.email ?? '',
            active: data.active !== false,
          });

          setRole(normalizedRole);
          setProfileDocId(profileSnap.id);

          if (normalizedRole === ROLE.STUDENT) {
            setStudentIds([profileSnap.id]);
            setActiveStudentId(profileSnap.id);
          } else if (isParentRole(normalizedRole)) {
            setStudentIds(data.studentIds ?? []);
            setActiveStudentId(data.activeStudentId ?? null);
          }

          setLoading(false);
          return;
        }

        /* =========================================================
           2️⃣ index 없음 → 관리자 / 직원 / 강사 fallback
        ========================================================= */
        const legacySnap = await getDoc(doc(db, 'users', authUid));
        if (!legacySnap.exists()) {
          setProfileError('프로필을 찾을 수 없습니다. 초대 코드로 가입을 진행해주세요.');
          setLoading(false);
          return;
        }

        const data = legacySnap.data();
        const legacyRole = normalizeRole(data.role);

        if (!legacyRole) {
          setProfileError('프로필 역할 정보가 올바르지 않습니다.');
          setLoading(false);
          return;
        }

        setUserProfile({
          authUid,
          profileDocId: legacySnap.id,
          role: legacyRole,
          displayName: data.displayName ?? data.name ?? '',
          email: data.email ?? '',
          active: data.active !== false,
        });

        setRole(legacyRole);
        setProfileDocId(legacySnap.id);
        setStudentIds([]);
        setActiveStudentId(null);
        setLoading(false);
      } catch (err) {
        logProfileErrorOnce(err);
        setProfileError('프로필을 불러올 수 없습니다.');
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const logout = useCallback(async () => {
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
    [user, role, userProfile, profileError, studentIds, activeStudentId, loading, logout, profileDocId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthProvider가 필요합니다.');
  return ctx;
}
