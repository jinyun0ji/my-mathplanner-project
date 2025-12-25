// src/auth/authService.js
import { signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase/client';

export const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();

    const { user } = await signInWithPopup(auth, provider);

    if (!user?.uid) return null;
return user;
};

export const signOutUser = async () => {
    await signOut(auth);
};
