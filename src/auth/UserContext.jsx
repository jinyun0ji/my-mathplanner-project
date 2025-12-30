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
  const [profile, setProfile] = useState(null); // { role, active, profileDocId } 형태로 확장
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

        const authUid = currentUser.uid;

        // ✅ 1) B안: userAuthIndex 먼저 확인
        const indexSnap = await getDoc(doc(db, 'userAuthIndex', authUid));
        if (!isMounted) return;

        if (indexSnap.exists()) {
          const indexData = indexSnap.data() || {};
          const userDocId = typeof indexData.userDocId === 'string' ? indexData.userDocId : '';
          const indexRole = indexData.role ?? null;

          if (!userDocId) {
            setProfile({ role: null, active: null, profileDocId: null });
            setLoading(false);
            return;
          }

          const userSnap = await getDoc(doc(db, 'users', userDocId));
          if (!isMounted) return;

          if (!userSnap.exists()) {
            setProfile({ role: null, active: null, profileDocId: null });
          } else {
            const data = userSnap.data() || {};
            setProfile({
              role: data?.role ?? indexRole ?? null,
              active: data?.active ?? null,
              profileDocId: userSnap.id, // ✅ 학생이면 studentDocId
            });
          }

          setLoading(false);
          return;
        }

        // ✅ 2) 레거시 fallback: users/{authUid} (관리자/직원/강사)
        const legacySnap = await getDoc(doc(db, 'users', authUid));
        if (!isMounted) return;

        if (!legacySnap.exists()) {
          setProfile({ role: null, active: null, profileDocId: null });
        } else {
          const data = legacySnap.data() || {};
          setProfile({
            role: data?.role ?? null,
            active: data?.active ?? null,
            profileDocId: legacySnap.id, // authUid
          });
        }
      } catch (error) {
        console.error('사용자 프로필을 불러오는 중 오류가 발생했습니다:', error);
        if (isMounted) {
          setProfile({ role: null, active: null, profileDocId: null });
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