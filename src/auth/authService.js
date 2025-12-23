import { signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase/client';

const ensureAuthReady = () => {
    if (!auth) {
        throw new Error('Firebase가 초기화되지 않았습니다.');
    }
};

export const signInWithEmail = async (email, password) => {
    ensureAuthReady();
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    return user?.uid;
};

export const signInWithGoogle = async () => {
    ensureAuthReady();
    if (!googleProvider) {
        throw new Error('Google 인증이 준비되지 않았습니다.');
    }
    const { user } = await signInWithPopup(auth, googleProvider);
    return user?.uid;
};

export const signOutUser = async () => {
    ensureAuthReady();
    await signOut(auth);
};