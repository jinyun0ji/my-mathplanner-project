import { signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/client';

const ensureAuthReady = () => {
    if (!auth) {
        throw new Error('Firebase가 초기화되지 않았습니다.');
    }
};

const ensureDbReady = () => {
    if (!db) {
        throw new Error('Firestore가 초기화되지 않았습니다.');
    }
};

export const signInWithGoogle = async () => {
    ensureAuthReady();
    ensureDbReady();
    if (!googleProvider) {
        throw new Error('Google 인증이 준비되지 않았습니다.');
    }
    const { user } = await signInWithPopup(auth, googleProvider);
    if (user?.uid) {
        const userDocRef = doc(db, 'users', user.uid);
        const userSnapshot = await getDoc(userDocRef);
        if (!userSnapshot.exists()) {
            await setDoc(userDocRef, {
                uid: user.uid,
                email: user.email ?? null,
                displayName: user.displayName ?? null,
                photoURL: user.photoURL ?? null,
                provider: 'google',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        }
    }
    return user?.uid;
};

export const signOutUser = async () => {
    ensureAuthReady();
    await signOut(auth);
};