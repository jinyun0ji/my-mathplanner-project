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
import { isDeletionRequestedProfile } from '../accountDeletion';

const AuthContext = createContext(null);

const LOCAL_STORAGE_KEYS = ['parent.activeStudentId'];
const AUTH_INIT_TIMEOUT_MS = 5000;
const IS_DEV = process.env.NODE_ENV === 'development';

const clearAuthStorage = () => {
  try {
    LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {}
};

const normalizeRole = (role) => (ALLOWED_ROLES.includes(role) ? role : null);
const AUTH_INDEX_MISSING_MESSAGE = '심사용 계정 연결 정보가 없습니다. 관리자에게 문의해주세요.';
const PROFILE_MISSING_MESSAGE = '사용자 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.';

const logAuthDebug = (label, payload) => {
  if (!IS_DEV) return;
  console.info(label, payload);
};

const getPlatformInfo = () => {
  const capacitor = window.Capacitor;
  const platform = capacitor?.getPlatform?.() ?? 'web';

  return {
    isNativePlatform: platform !== 'web' || Boolean(capacitor?.isNativePlatform?.()),
    platform,
  };
};

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
    let timeoutId = null;

    const resetProfileState = () => {
      setRole(null);
      setProfileDocId(null);
      setUserProfile(null);
      setProfileError(null);
      setStudentIds([]);
      setActiveStudentId(null);
    };

    const finishLoading = () => {
      if (isMounted) setLoading(false);
    };

    const clearAuthTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const forceUnauthenticated = () => {
      setUser(null);
      resetProfileState();
      finishLoading();
    };

    const logProfileErrorOnce = (err) => {
      if (!errorLoggedRef.current) {
        console.error('[useAuth] profile load error:', err);
        errorLoggedRef.current = true;
      }
    };

    logAuthDebug('[auth:init]', {
      href: window.location.href,
      origin: window.location.origin,
      userAgent: navigator.userAgent,
      ...getPlatformInfo(),
    });

    timeoutId = setTimeout(() => {
      if (!isMounted) return;

      logAuthDebug('[auth:timeout]', { fired: true, hasCurrentUser: Boolean(auth.currentUser) });

      if (!auth.currentUser) {
        forceUnauthenticated();
        return;
      }

      setUser(auth.currentUser);
      setProfileError('인증 초기화 시간이 초과되었습니다. 다시 로그인해주세요.');
      finishLoading();
    }, AUTH_INIT_TIMEOUT_MS);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      let profileTimeoutId = null;

      if (!isMounted) return;

      clearAuthTimeout();
      logAuthDebug('[auth:onAuthStateChanged]', {
        called: true,
        hasUser: Boolean(currentUser),
        uid: currentUser?.uid ?? null,
      });

      setUser(currentUser);
      resetProfileState();
      errorLoggedRef.current = false;

      if (!currentUser) {
        finishLoading();
        return;
      }

      setLoading(true);
      profileTimeoutId = setTimeout(() => {
        if (!isMounted) return;

        logAuthDebug('[auth:timeout]', {
          fired: true,
          scope: 'profile',
          hasCurrentUser: Boolean(auth.currentUser),
          uid: currentUser.uid,
        });
        setProfileError('프로필 초기화 시간이 초과되었습니다. 다시 로그인해주세요.');
        finishLoading();
      }, AUTH_INIT_TIMEOUT_MS);

      try {
        const authUid = currentUser.uid;
        logAuthDebug('[auth:profile]', { start: true, uid: authUid });

        /* =========================================================
           1️⃣ userAuthIndex 먼저 시도 (학생 / 학부모)
        ========================================================= */
        const indexRef = doc(db, 'userAuthIndex', authUid);
        const indexSnap = await getDoc(indexRef);

        if (!isMounted) return;

        if (indexSnap.exists()) {
          const { userDocId, role: indexRole } = indexSnap.data();
          const normalizedRole = normalizeRole(indexRole);

          if (!userDocId || !normalizedRole) {
            throw new Error(AUTH_INDEX_MISSING_MESSAGE);
          }

          const profileSnap = await getDoc(doc(db, 'users', userDocId));
          if (!isMounted) return;
          if (!profileSnap.exists()) {
            throw new Error(PROFILE_MISSING_MESSAGE);
          }

          const data = profileSnap.data();

          setProfileError(null);
          setUserProfile({
            authUid,
            profileDocId: profileSnap.id,
            role: normalizedRole,
            displayName: data.displayName ?? data.name ?? '',
            email: data.email ?? '',
            active: data.active !== false,
            status: data.status ?? null,
            deletionRequested: data.deletionRequested === true,
            deletionAccessBlocked: isDeletionRequestedProfile(data),
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

          logAuthDebug('[auth:profile]', { success: true, source: 'userAuthIndex', uid: authUid });
          return;
        }

        /* =========================================================
           2️⃣ index 없음 → 관리자 / 직원 / 강사 fallback
        ========================================================= */
        const legacySnap = await getDoc(doc(db, 'users', authUid));
        if (!isMounted) return;
        if (!legacySnap.exists()) {
          setProfileError('프로필을 찾을 수 없습니다. 초대 코드로 가입을 진행해주세요.');
          logAuthDebug('[auth:profile]', { failed: true, reason: 'profile-not-found', uid: authUid });
          return;
        }

        const data = legacySnap.data();
        const legacyRole = normalizeRole(data.role);

        if (!legacyRole) {
          setProfileError('프로필 역할 정보가 올바르지 않습니다.');
          logAuthDebug('[auth:profile]', { failed: true, reason: 'invalid-role', uid: authUid });
          return;
        }

        setProfileError(null);
        setUserProfile({
          authUid,
          profileDocId: legacySnap.id,
          role: legacyRole,
          displayName: data.displayName ?? data.name ?? '',
          email: data.email ?? '',
          active: data.active !== false,
          status: data.status ?? null,
          deletionRequested: data.deletionRequested === true,
          deletionAccessBlocked: isDeletionRequestedProfile(data),
        });

        setRole(legacyRole);
        setProfileDocId(legacySnap.id);
        setStudentIds([]);
        setActiveStudentId(null);
        logAuthDebug('[auth:profile]', { success: true, source: 'users', uid: authUid });
      } catch (err) {
        logProfileErrorOnce(err);
        logAuthDebug('[auth:profile]', { failed: true, error: err?.message ?? String(err) });
        setProfileError(err?.message || '프로필을 불러올 수 없습니다.');
      } finally {
        if (profileTimeoutId) clearTimeout(profileTimeoutId);
        logAuthDebug('[auth:profile]', { finally: true, uid: currentUser?.uid ?? null });
        finishLoading();
      }
    });

    return () => {
      isMounted = false;
      clearAuthTimeout();
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
