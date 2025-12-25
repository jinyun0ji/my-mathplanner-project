// src/auth/authService.js
import { signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/client';

export const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();

    const { user } = await signInWithPopup(auth, provider);

    if (!user?.uid) return null;

    const userDocRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userDocRef);

    if (!snap.exists()) {
        await setDoc(userDocRef, {
            email: user.email ?? null,
            displayName: user.displayName ?? null,
            role: null,
            active: true,
            createdAt: serverTimestamp(),
        });
    }

    return user.uid;
};

export const signOutUser = async () => {
    await signOut(auth);
};
