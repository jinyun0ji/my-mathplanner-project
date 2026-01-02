import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';

export async function addVideoMemo(db, authUid, { lessonId, time, note }) {
  const ref = collection(db, 'videoMemos', authUid, 'items');
  const payload = {
    lessonId: String(lessonId),
    time: Number(time) || 0,
    note: String(note || '').trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const created = await addDoc(ref, payload);
  return { id: created.id, ...payload };
}

export async function updateVideoMemo(db, authUid, memoId, patch) {
  const ref = doc(db, 'videoMemos', authUid, 'items', memoId);
  const payload = {
    ...patch,
    ...(patch.time !== undefined ? { time: Number(patch.time) || 0 } : {}),
    ...(patch.note !== undefined ? { note: String(patch.note || '').trim() } : {}),
    updatedAt: serverTimestamp(),
  };
  await updateDoc(ref, payload);
}

export async function deleteVideoMemo(db, authUid, memoId) {
  const ref = doc(db, 'videoMemos', authUid, 'items', memoId);
  await deleteDoc(ref);
}

export async function fetchMyVideoMemos(db, authUid) {
  const q = query(
    collection(db, 'videoMemos', authUid, 'items'),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchLessonVideoMemos(db, authUid, lessonId) {
  const q = query(
    collection(db, 'videoMemos', authUid, 'items'),
    where('lessonId', '==', String(lessonId)),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}