// src/auth/authService.js
import { Capacitor } from '@capacitor/core';
import { signInWithEmailAndPassword, signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/client';

export const REVIEW_LOGIN_AUTH_INDEX_MISSING_MESSAGE = '심사용 계정 연결 정보가 없습니다. 관리자에게 문의해주세요.';
export const REVIEW_LOGIN_PROFILE_MISSING_MESSAGE = '사용자 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.';
export const NATIVE_GOOGLE_LOGIN_UNAVAILABLE_MESSAGE = '앱에서는 심사용 이메일 로그인을 사용해 주세요. Google 로그인은 웹에서 이용할 수 있습니다.';

const IS_DEV = process.env.NODE_ENV === 'development';

const logEmailLoginDebug = (label, payload) => {
    if (!IS_DEV) return;
    console.info(label, payload);
};

const createReviewLoginError = (message, code) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

export const signInWithGoogle = async () => {
    if (Capacitor.isNativePlatform()) {
        throw createReviewLoginError(NATIVE_GOOGLE_LOGIN_UNAVAILABLE_MESSAGE, 'google-login/native-unavailable');
    }

    const provider = new GoogleAuthProvider();

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
