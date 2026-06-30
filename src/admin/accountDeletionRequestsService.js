import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebase/client';

const REQUEST_COLLECTION = 'accountDeletionRequests';

export const getPendingAccountDeletionRequests = async () => {
  const snapshot = await getDocs(query(
    collection(db, REQUEST_COLLECTION),
    where('status', '==', 'pending')
  ));

  return snapshot.docs
    .map((requestDoc) => ({ id: requestDoc.id, ...requestDoc.data() }))
    .sort((a, b) => {
      const aMs = a.requestedAt?.toMillis?.() || 0;
      const bMs = b.requestedAt?.toMillis?.() || 0;
      return bMs - aMs;
    });
};

export const completeAccountDeletionRequest = async (requestId, completedBy = auth.currentUser?.uid || '') => {
  if (!requestId) {
    throw new Error('삭제 요청 문서 ID가 없습니다.');
  }

  await updateDoc(doc(db, REQUEST_COLLECTION, requestId), {
    status: 'completed',
    completedAt: serverTimestamp(),
    completedBy,
  });
};
