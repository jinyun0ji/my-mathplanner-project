import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase/client';

export const DELETION_REQUESTED_MESSAGE = '탈퇴 요청이 접수된 계정입니다. 재이용을 원하시면 학원에 문의해주세요.';

export const isDeletionRequestedProfile = (profile) => Boolean(
  profile?.deletionRequested === true
  || profile?.active === false
  || profile?.status === 'deletion_requested'
);

export const ACCOUNT_DELETION_SUCCESS_MESSAGE = '계정 연결 및 개인정보 삭제 요청이 접수되었습니다. 처리에는 영업일 기준 최대 7일이 소요될 수 있습니다.';

const resolveDisplayName = (profile = {}, fallbackUser = null) => (
  profile.displayName
  || profile.name
  || fallbackUser?.displayName
  || ''
);

export const requestAccountDeletion = async ({ user = auth.currentUser, userProfile = null, role = '', profileDocId = '' } = {}) => {
  if (!user?.uid) {
    throw new Error('로그인 정보가 없어 계정 삭제 요청을 접수할 수 없습니다.');
  }

  const requesterRole = role || userProfile?.role || '';
  const userDocId = profileDocId || userProfile?.profileDocId || userProfile?.userDocId || user.uid;

  await addDoc(collection(db, 'accountDeletionRequests'), {
    requesterAuthUid: user.uid,
    userDocId,
    role: requesterRole,
    email: userProfile?.email || user.email || '',
    displayName: resolveDisplayName(userProfile, user),
    status: 'pending',
    requestedAt: serverTimestamp(),
    source: 'mobile_app',
  });

  return { success: true };
};
