import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/client';

export const createStaffUser = async ({ email, tempPassword }) => {
    if (!functions) {
        throw new Error('Firebase가 초기화되지 않았습니다. 관리자에게 문의해주세요.');
    }

    const callable = httpsCallable(functions, 'adminCreateStaffUser');
    const result = await callable({ email, tempPassword });
    return result.data;
};