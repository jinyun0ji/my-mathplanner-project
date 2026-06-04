import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase/client';

export const DELETION_REQUESTED_MESSAGE = '탈퇴 요청이 접수된 계정입니다. 재이용을 원하시면 학원에 문의해주세요.';

export const isDeletionRequestedProfile = (profile) => Boolean(
  profile?.deletionRequested === true
  || profile?.active === false
  || profile?.status === 'deletion_requested'
);

export const requestAccountDeletion = async () => {
  const callable = httpsCallable(functions, 'requestAccountDeletion');
  const result = await callable();
  return result?.data || { success: true };
};
