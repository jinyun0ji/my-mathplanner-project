import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/client';

export const retryNotification = async ({ logId }) => {
    if (!functions) {
        throw new Error('Firebase가 초기화되지 않았습니다. 관리자에게 문의해주세요.');
    }

    const callable = httpsCallable(functions, 'retryNotification');
    const result = await callable({ logId });
    return result.data;
};