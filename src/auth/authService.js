// src/auth/authService.js
import { Capacitor, registerPlugin } from '@capacitor/core';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/client';

export const REVIEW_LOGIN_AUTH_INDEX_MISSING_MESSAGE = '심사용 계정 연결 정보가 없습니다. 관리자에게 문의해주세요.';
export const REVIEW_LOGIN_PROFILE_MISSING_MESSAGE = '사용자 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.';
export const NATIVE_GOOGLE_LOGIN_UNAVAILABLE_MESSAGE = 'Google 로그인 연결에 실패했습니다. 다시 시도해주세요.';
export const GOOGLE_LOGIN_CANCELLED_MESSAGE = 'Google 로그인이 취소되었습니다.';

export const isNativePlatform = () => Capacitor.isNativePlatform();
export const isGoogleLoginAvailable = () => true;

const logEmailLoginDebug = (label, payload) => {
    console.info(label, payload);
};

const createReviewLoginError = (message, code) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

export const createNativeGoogleLoginUnavailableError = () => (
    createReviewLoginError(NATIVE_GOOGLE_LOGIN_UNAVAILABLE_MESSAGE, 'google-login/native-unavailable')
);

const createGoogleLoginCancelledError = () => (
    createReviewLoginError(GOOGLE_LOGIN_CANCELLED_MESSAGE, 'google-login/cancelled')
);

const resolveNativeGoogleAuthPlugin = async () => {
    if (Capacitor?.Plugins?.GoogleAuth) {
        return Capacitor.Plugins.GoogleAuth;
    }

    return registerPlugin('GoogleAuth');
};

const extractGoogleIdToken = (googleUser) => (
    googleUser?.authentication?.idToken
    ?? googleUser?.idToken
    ?? googleUser?.serverAuthCode?.idToken
    ?? null
);

const isGoogleLoginCancelError = (error) => {
    const code = String(error?.code ?? error?.error ?? '').toLowerCase();
    const message = String(error?.message ?? '').toLowerCase();

    return code.includes('cancel')
        || code.includes('canceled')
        || message.includes('cancel')
        || message.includes('canceled')
        || message.includes('dismiss');
};

export const signInWithGoogle = async () => {
    const { GoogleAuthProvider, signInWithCredential, signInWithPopup } = await import('firebase/auth');
    const provider = new GoogleAuthProvider();

    if (isNativePlatform()) {
        const GoogleAuth = await resolveNativeGoogleAuthPlugin();

        if (!GoogleAuth?.signIn) {
            throw createNativeGoogleLoginUnavailableError();
        }

        try {
            const googleUser = await GoogleAuth.signIn();
            const idToken = extractGoogleIdToken(googleUser);

            if (!idToken) {
                throw createNativeGoogleLoginUnavailableError();
            }

            const credential = GoogleAuthProvider.credential(idToken);
            const { user } = await signInWithCredential(auth, credential);

            if (!user?.uid) return null;
            return user;
        } catch (error) {
            if (error?.code === 'google-login/native-unavailable') {
                throw error;
            }

            if (isGoogleLoginCancelError(error)) {
                throw createGoogleLoginCancelledError();
            }

            throw createNativeGoogleLoginUnavailableError();
        }
    }

    const { user } = await signInWithPopup(auth, provider);

    if (!user?.uid) return null;
    return user;
};

export const signInWithReviewEmail = async (email, password) => {
    const normalizedEmail = email.trim();
    let signedInUser = null;

    logEmailLoginDebug('[email-login] start', { email: normalizedEmail });

    try {
        const { user } = await signInWithEmailAndPassword(auth, normalizedEmail, password);
        signedInUser = user;

        logEmailLoginDebug('[email-login] auth success', {
            uid: user?.uid ?? null,
            email: user?.email ?? normalizedEmail,
        });

        if (!user?.uid) return null;

        logEmailLoginDebug('[email-login] userAuthIndex start', { uid: user.uid });
        const indexSnap = await getDoc(doc(db, 'userAuthIndex', user.uid));
        const indexData = indexSnap.exists() ? indexSnap.data() : {};
        const userDocId = indexData?.userDocId ?? null;
        const indexRole = indexData?.role ?? null;

        logEmailLoginDebug('[email-login] userAuthIndex result', {
            exists: indexSnap.exists(),
            userDocId,
            role: indexRole,
        });

        if (!indexSnap.exists() || !userDocId) {
            throw createReviewLoginError(REVIEW_LOGIN_AUTH_INDEX_MISSING_MESSAGE, 'review-login/auth-index-missing');
        }

        logEmailLoginDebug('[email-login] user doc start', { userDocId });
        const profileSnap = await getDoc(doc(db, 'users', userDocId));
        const profileRole = profileSnap.exists() ? (profileSnap.data()?.role ?? null) : null;

        logEmailLoginDebug('[email-login] user doc result', {
            exists: profileSnap.exists(),
            role: profileRole,
        });

        if (!profileSnap.exists()) {
            throw createReviewLoginError(REVIEW_LOGIN_PROFILE_MISSING_MESSAGE, 'review-login/profile-missing');
        }

        logEmailLoginDebug('[email-login] redirect start', { role: profileRole ?? indexRole });
        return user;
    } catch (error) {
        logEmailLoginDebug('[email-login] failed', {
            code: error?.code ?? null,
            message: error?.message ?? String(error),
        });

        if (signedInUser?.uid || auth.currentUser?.uid) {
            await signOut(auth);
        }
        throw error;
    } finally {
        logEmailLoginDebug('[email-login] finally');
    }
};

export const signOutUser = async () => {
    await signOut(auth);
};
