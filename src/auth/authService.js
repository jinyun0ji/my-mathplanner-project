import { GoogleAuthProvider, signInWithCustomToken, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase/client';

const postJson = async (url, body) => {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || '요청에 실패했습니다.');
    }

    return response.json();
};

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

export const signInWithKakao = async (code) => {
    if (!auth) throw new Error('Firebase가 초기화되지 않았습니다.');
    if (!code) throw new Error('인가 코드가 필요합니다.');

    const { token } = await postJson('/auth/kakao', { code });
    const { user } = await signInWithCustomToken(auth, token);
    return user?.uid;
};

export const signInWithNaver = async (code, state) => {
    if (!auth) throw new Error('Firebase가 초기화되지 않았습니다.');
    if (!code) throw new Error('인가 코드가 필요합니다.');

    const { token } = await postJson('/auth/naver', { code, state });
    const { user } = await signInWithCustomToken(auth, token);
    return user?.uid;
};