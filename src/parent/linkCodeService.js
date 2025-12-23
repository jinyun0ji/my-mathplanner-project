import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/client';

export const claimStudentLinkCode = async (code) => {
    if (!functions) {
        throw new Error('Firebase가 초기화되지 않았습니다.');
    }

    const normalized = typeof code === 'string' ? code.trim() : '';
    if (!normalized) {
        throw new Error('연결 코드를 입력해주세요.');
    }

    const callable = httpsCallable(functions, 'claimStudentLinkCode');
    const result = await callable({ code: normalized });
    return result.data;
};
