import React, { useEffect } from 'react';

import AppRoutes from './AppRoutes';
import OnboardingPage from '../pages/OnboardingPage';
import LoginPage from '../pages/LoginPage';
import SocialCallback from '../pages/SocialCallback';
import useAuth from '../auth/useAuth';
import { claimStudentLinkCode } from '../parent/linkCodeService';
import { redirectToKakao, redirectToNaver } from '../auth/socialRedirect';
import { signInWithEmail, signInWithGoogle } from '../auth/authService';
import { initForegroundMessageListener } from '../firebase/messaging';

export default function AuthGate() {
  const isSocialCallbackPage = typeof window !== 'undefined' && window.location.pathname === '/auth/callback';
  const { user, role, linkedStudentIds, activeStudentId, loading } = useAuth();

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

  const handleEmailLogin = async (email, password) => {
      await signInWithEmail(email, password);
  };

  const handleSocialLogin = async (providerName) => {
      if (providerName === 'google') return signInWithGoogle();
      if (providerName === 'kakao') return redirectToKakao();
      if (providerName === 'naver') return redirectToNaver();
      throw new Error('지원되지 않는 소셜 로그인입니다.');
  };

  const handleClaimLinkCode = async (code) => {
      await claimStudentLinkCode(code);
  };

  if (isSocialCallbackPage) return <SocialCallback />;
  if (loading) return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  if (!user) return <LoginPage onEmailLogin={handleEmailLogin} onSocialLogin={handleSocialLogin} />;
  if (role === 'pending') return <OnboardingPage onSubmitLinkCode={handleClaimLinkCode} />;

  return (
      <AppRoutes
          user={user}
          role={role}
          linkedStudentIds={linkedStudentIds}
          activeStudentId={activeStudentId}
      />
  );
}