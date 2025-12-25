import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/client';

export const createStaffUser = async ({ email, role, tempPassword }) => {
    if (!functions) {
        throw new Error('Firebase가 초기화되지 않았습니다. 관리자에게 문의해주세요.');
    }

    const callable = httpsCallable(functions, 'createStaffUser');
    const result = await callable({ email, role, tempPassword });
    return result.data;
};

export const getStaffList = async () => {
    if (!functions) {
        throw new Error('Firebase가 초기화되지 않았습니다. 관리자에게 문의해주세요.');
    }

    const callable = httpsCallable(functions, 'getStaffList');
    const result = await callable();
    return result.data;
};

export const deactivateStaff = async ({ uid }) => {
    if (!functions) {
        throw new Error('Firebase가 초기화되지 않았습니다. 관리자에게 문의해주세요.');
    }

    const callable = httpsCallable(functions, 'deactivateStaff');
    const result = await callable({ uid });
    return result.data;
};

export const updateStaffRole = async ({ uid, role }) => {
    if (!functions) {
        throw new Error('Firebase가 초기화되지 않았습니다. 관리자에게 문의해주세요.');
    }

    const callable = httpsCallable(functions, 'updateStaffRole');
    const result = await callable({ uid, role });
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