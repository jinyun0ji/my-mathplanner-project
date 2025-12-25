import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import AppRoutes from './AppRoutes';
import OnboardingPage from '../pages/OnboardingPage';
import LoginPage from '../pages/LoginPage';
import useAuth from '../auth/useAuth';
import { claimStudentLinkCode } from '../parent/linkCodeService';
import { ParentProvider } from '../parent';
import { redirectToKakao, redirectToNaver } from '../auth/socialRedirect';
import { signInWithGoogle } from '../auth/authService';
import { initForegroundMessageListener } from '../firebase/messaging';

export default function AuthGate() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const isOnboardingPage = pathname === '/onboarding';
  const isLoginPage = pathname === '/login';
  const isAuthCallbackPage = pathname === '/auth/callback';
  const isStudentDetailPage = pathname.startsWith('/students/');
  const {
      user,
      role,
      linkedStudentUids,
      activeStudentId,
      loading,
      profileError,
      logout,
  } = useAuth();

  useEffect(() => {
      let unsubscribe = null;

      if (!user) {
          return undefined;
      }

      initForegroundMessageListener()
          .then((stop) => {
              unsubscribe = stop;
          })
          .catch(() => {});

      return () => {
          if (typeof unsubscribe === 'function') {
              unsubscribe();
          }
      };
  }, [user]);

  useEffect(() => {
      if (loading) return;

      if (!user) {
          if (!isLoginPage && !isAuthCallbackPage) {
              navigate('/login', { replace: true });
          }
          return;
      }

      if (role === 'pending' && pathname !== '/onboarding') {
          navigate('/onboarding', { replace: true });
          return;
      }

      if (role && role !== 'pending' && !isStudentDetailPage && (isOnboardingPage || isLoginPage)) {
          navigate('/lessons', { replace: true });
      }
  }, [isAuthCallbackPage, isLoginPage, isOnboardingPage, isStudentDetailPage, loading, navigate, pathname, role, user]);

  const handleSocialLogin = async (providerName) => {
      if (providerName === 'google') return signInWithGoogle();
      if (providerName === 'kakao') return redirectToKakao();
      if (providerName === 'naver') return redirectToNaver();
      throw new Error('지원되지 않는 소셜 로그인입니다.');
  };

  const handleClaimLinkCode = async (code) => {
      await claimStudentLinkCode(code);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  if (!user) return <LoginPage onSocialLogin={handleSocialLogin} />;
  if (role === null) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-gray-600">
              <p>{profileError || '프로필을 불러오지 못했습니다. 다시 로그인해주세요.'}</p>
              <button
                  type="button"
                  onClick={async () => {
                      await logout();
                      navigate('/login', { replace: true });
                  }}
                  className="px-4 py-2 rounded-md bg-indigo-600 text-white"
              >
                  로그아웃
              </button>
          </div>
      );
  }
  if (role === 'pending' || isOnboardingPage) return <OnboardingPage onSubmitLinkCode={handleClaimLinkCode} />;

  const appRoutesElement = role === 'parent' ? (
      <ParentProvider
          userId={user?.uid || null}
          role={role}
          linkedStudentUids={linkedStudentUids}
          firestoreActiveStudentId={activeStudentId}
      >
          <AppRoutes
              user={user}
              role={role}
              linkedStudentUids={linkedStudentUids}
              />
      </ParentProvider>
  ) : (
      <AppRoutes
          user={user}
          role={role}
        />
  );

  return appRoutesElement;
}