import React, { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import AppRoutes from './AppRoutes';
import OnboardingPage from '../pages/OnboardingPage';
import LoginPage from '../pages/LoginPage';
import InviteSignupPage from '../pages/InviteSignupPage';
import useAuth from '../auth/useAuth';
import { isParentRole, isStudentRole } from '../constants/roles';
import { claimStudentLinkCode } from '../parent/linkCodeService';
import { ParentProvider } from '../parent';
import { redirectToKakao, redirectToNaver } from '../auth/socialRedirect';
import { signInWithGoogle } from '../auth/authService';
import { initForegroundMessageListener } from '../firebase/messaging';
import { getDefaultRouteForRole } from '../auth/authRedirects';
import { DELETION_REQUESTED_MESSAGE } from '../accountDeletion';

export default function AuthGate() {
    const navigate = useNavigate();
    const location = useLocation();
    const pathname = location.pathname;

    const isOnboardingPage = pathname === '/onboarding';
    const isLoginPage = pathname === '/login';
    const isSignupPage = pathname.startsWith('/signup');
    const isAuthCallbackPage = pathname === '/auth/callback';
    const isStudentDetailPage = pathname.startsWith('/students/');
    const isMessengerRoute = pathname.startsWith('/chat') || pathname.startsWith('/messages');
    const isFormulaQrRoute = pathname === '/classroom' && new URLSearchParams(location.search).get('conceptId');

    const {
        user,
        role,
        studentIds,
        activeStudentId,
        loading,
        profileError,
        userProfile,
        logout,
    } = useAuth();

    const needsParentOnboarding =
        isParentRole(role) && (!Array.isArray(studentIds) || studentIds.length === 0);

    const isDeletionBlockedViewer = (isParentRole(role) || isStudentRole(role))
        && Boolean(userProfile?.deletionAccessBlocked);

    useEffect(() => {
        let unsubscribe = null;

        if (!user) return undefined;

        initForegroundMessageListener()
            .then((stop) => { unsubscribe = stop; })
            .catch(() => {});

        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, [user]);

    useEffect(() => {
        if (loading) return;

        const redirectPath = role ? (getDefaultRouteForRole(role) || '/home') : null;

        if (!user) {
            if (!isLoginPage && !isSignupPage && !isAuthCallbackPage) {
                if (isFormulaQrRoute) sessionStorage.setItem('formulaQrRedirect', `${pathname}${location.search}`);
                navigate('/login', { replace: true });
            }
            return;
        }

        if (isDeletionBlockedViewer) return;

        if (needsParentOnboarding && pathname !== '/onboarding') {
            navigate('/onboarding', { replace: true });
            return;
        }

        if (role && isMessengerRoute && (isParentRole(role) || isStudentRole(role))) {
            navigate(redirectPath || '/home', { replace: true });
            return;
        }

        if (
            role &&
            !needsParentOnboarding &&
            !isStudentDetailPage &&
            (isOnboardingPage || isLoginPage || isSignupPage)
        ) {
            const formulaQrRedirect = sessionStorage.getItem('formulaQrRedirect');
            if (formulaQrRedirect && isStudentRole(role)) {
                sessionStorage.removeItem('formulaQrRedirect');
                const params = new URLSearchParams(formulaQrRedirect.split('?')[1] || '');
                navigate(`/student/home?tab=class&mode=book&conceptId=${encodeURIComponent(params.get('conceptId') || '')}`, { replace: true });
                return;
            }
            navigate(redirectPath || '/home', { replace: true });
        }
    }, [
        isAuthCallbackPage,
        isLoginPage,
        isMessengerRoute,
        isOnboardingPage,
        isSignupPage,
        isStudentDetailPage,
        isFormulaQrRoute,
        location.search,
        loading,
        navigate,
        needsParentOnboarding,
        pathname,
        isDeletionBlockedViewer,
        role,
        user,
    ]);

    const handleSocialLogin = async (providerName) => {
        if (providerName === 'google') return signInWithGoogle();
        if (providerName === 'kakao') return redirectToKakao();
        if (providerName === 'naver') return redirectToNaver();
        throw new Error('지원되지 않는 소셜 로그인입니다.');
    };

    const handleClaimLinkCode = async (code) => {
        await claimStudentLinkCode(code);
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
    }

    if (!user) {
        return (
            <Routes>
                <Route path="/login" element={<LoginPage onSocialLogin={handleSocialLogin} />} />
                <Route path="/signup" element={<Navigate to="/signup/invite" replace />} />
                <Route path="/signup/invite" element={<InviteSignupPage />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        );
    }

    // ✅ 로그인은 됐는데 프로필(역할) 로딩 중 또는 아직 연결 안 된 상태
    if (role === null) {
        if (profileError) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-gray-600">
                    <p>{profileError || '프로필을 불러오지 못했습니다. 다시 로그인해주세요.'}</p>
                    <button
                        type="button"
                        onClick={async () => {
                            await logout();
                            navigate('/login', { replace: true });
                        }}
                        className="px-4 py-2 rounded-md bg-[#455fab] text-white"
                    >
                        로그아웃
                    </button>
                </div>
            );
        }

        return (
            <div className="min-h-screen flex items-center justify-center text-gray-600">
                프로필 설정 중입니다...
            </div>
        );
    }


    if (isDeletionBlockedViewer) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-6 text-center text-gray-700">
                <div className="max-w-sm rounded-2xl border border-rose-100 bg-white p-6 shadow-sm">
                    <p className="text-base font-bold text-gray-900">{DELETION_REQUESTED_MESSAGE}</p>
                    <button
                        type="button"
                        onClick={async () => {
                            await logout();
                            navigate('/login', { replace: true });
                        }}
                        className="mt-5 w-full rounded-xl bg-[#455fab] px-4 py-3 text-sm font-bold text-white"
                    >
                        로그인 화면으로 이동
                    </button>
                </div>
            </div>
        );
    }

    if (needsParentOnboarding || isOnboardingPage) {
        return <OnboardingPage onSubmitLinkCode={handleClaimLinkCode} />;
    }

    const appRoutesElement = isParentRole(role) ? (
        <ParentProvider
            userId={user?.uid || null}
            role={role}
            studentIds={studentIds}
            firestoreActiveStudentId={activeStudentId}
        >
            <AppRoutes user={user} role={role} studentIds={studentIds} />
        </ParentProvider>
    ) : (
        <AppRoutes user={user} role={role} studentIds={studentIds} />
    );

    return appRoutesElement;
}
