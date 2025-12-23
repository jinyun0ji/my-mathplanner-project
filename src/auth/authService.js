import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase/client';

export const signInWithEmail = async (email, password) => {
    if (!auth) throw new Error('Firebase가 초기화되지 않았습니다.');
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    return user?.uid;
};

export const signInWithGooglePopup = async () => {
    if (!auth) throw new Error('Firebase가 초기화되지 않았습니다.');
    const provider = new GoogleAuthProvider();
    const { user } = await signInWithPopup(auth, provider);
    return user?.uid;
};