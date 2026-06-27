// src/auth/authService.js
import { signInWithEmailAndPassword, signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/client';

export const REVIEW_LOGIN_AUTH_INDEX_MISSING_MESSAGE = '심사용 계정 연결 정보가 없습니다. 관리자에게 문의해주세요.';
export const REVIEW_LOGIN_PROFILE_MISSING_MESSAGE = '사용자 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.';

const createReviewLoginError = (message, code) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

export const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();

    const { user } = await signInWithPopup(auth, provider);

    if (!user?.uid) return null;
    return user;
};

export const signInWithReviewEmail = async (email, password) => {
    const { user } = await signInWithEmailAndPassword(auth, email, password);

    if (!user?.uid) return null;

    try {
        const indexSnap = await getDoc(doc(db, 'userAuthIndex', user.uid));
        if (!indexSnap.exists()) {
            throw createReviewLoginError(REVIEW_LOGIN_AUTH_INDEX_MISSING_MESSAGE, 'review-login/auth-index-missing');
        }

        const { userDocId } = indexSnap.data();
        if (!userDocId) {
            throw createReviewLoginError(REVIEW_LOGIN_AUTH_INDEX_MISSING_MESSAGE, 'review-login/auth-index-invalid');
        }

        const profileSnap = await getDoc(doc(db, 'users', userDocId));
        if (!profileSnap.exists()) {
            throw createReviewLoginError(REVIEW_LOGIN_PROFILE_MISSING_MESSAGE, 'review-login/profile-missing');
        }
    } catch (error) {
        await signOut(auth);
        throw error;
    }

    return user;
};

export const signOutUser = async () => {
    await signOut(auth);
};
