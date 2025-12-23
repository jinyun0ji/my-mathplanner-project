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

export const createLinkCode = async ({ studentId }) => {
    if (!functions) {
        throw new Error('Firebase가 초기화되지 않았습니다. 관리자에게 문의해주세요.');
    }

    const callable = httpsCallable(functions, 'adminCreateLinkCode');
    const result = await callable({ studentId });
    return result.data;
};