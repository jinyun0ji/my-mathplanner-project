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

export function flattenVideoMemos(videoMemos = {}, ownerUid = '') {
  if (!videoMemos || typeof videoMemos !== 'object') return [];
  const key = ownerUid ? String(ownerUid) : '';
  if (key) return Array.isArray(videoMemos[key]) ? videoMemos[key] : [];
  return Object.values(videoMemos).filter(Array.isArray).flat();
}

export function getLessonVideoMemosFromState(videoMemos = {}, ownerUid = '', lessonId = '') {
  if (!lessonId) return [];
  return flattenVideoMemos(videoMemos, ownerUid)
    .filter((memo) => String(memo?.lessonId || '') === String(lessonId));
}

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  return 0;
};

export function buildMemoListForMenu(videoMemos = {}, ownerUid = '', lessonLogs = []) {
  const lessonById = new Map(
    (Array.isArray(lessonLogs) ? lessonLogs : [])
      .filter((lesson) => lesson?.id)
      .map((lesson) => [String(lesson.id), lesson]),
  );

  return flattenVideoMemos(videoMemos, ownerUid)
    .map((memo) => {
      const lesson = lessonById.get(String(memo?.lessonId || ''));
      return {
        ...memo,
        lessonTitle: lesson?.progress || lesson?.title || memo?.lessonTitle || '강의 메모',
        lessonDate: lesson?.date || lesson?.lessonDate || memo?.lessonDate || '',
        classId: lesson?.classId || memo?.classId || memo?.classDocId || '',
        lessonId: lesson?.id || memo?.lessonId,
        updatedAtMs: toMillis(memo?.updatedAt),
      };
    })
    .filter((memo) => memo?.lessonId)
    .sort((a, b) => (b.updatedAtMs - a.updatedAtMs) || ((Number(b.time) || 0) - (Number(a.time) || 0)));
}
