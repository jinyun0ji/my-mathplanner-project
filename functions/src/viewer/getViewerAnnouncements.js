const functions = require('firebase-functions');
const admin = require('firebase-admin');

const MAX_RESULTS = 100;
const RETURN_FIELDS = [
  'title',
  'content',
  'author',
  'date',
  'createdAt',
  'updatedAt',
  'isPinned',
  'isPublic',
  'attachments',
  'targetClassIds',
];

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const projectAnnouncement = (docSnap) => {
  const data = docSnap.data() || {};
  const projected = { id: docSnap.id };
  RETURN_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      projected[field] = data[field];
    }
  });
  return projected;
};

const getViewerAnnouncements = functions.https.onCall(async (_data, context) => {
  const authUid = String(context?.auth?.uid || '').trim();
  if (!authUid) {
    throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
  }

  const db = admin.firestore();
  const baseRef = db.collection('announcements');

  const [publicSnap, targetedSnap] = await Promise.all([
    baseRef.where('isPublic', '==', true).limit(MAX_RESULTS).get(),
    baseRef.where('audienceAuthUids', 'array-contains', authUid).limit(MAX_RESULTS).get(),
  ]);

  const merged = new Map();
  publicSnap.docs.forEach((docSnap) => {
    merged.set(docSnap.id, projectAnnouncement(docSnap));
  });
  targetedSnap.docs.forEach((docSnap) => {
    merged.set(docSnap.id, projectAnnouncement(docSnap));
  });

  const announcements = Array.from(merged.values())
    .sort((a, b) => {
      const pinGap = Number(Boolean(b?.isPinned)) - Number(Boolean(a?.isPinned));
      if (pinGap !== 0) return pinGap;
      const bTime = toMillis(b?.createdAt) || toMillis(b?.date);
      const aTime = toMillis(a?.createdAt) || toMillis(a?.date);
      return bTime - aTime;
    })
    .slice(0, MAX_RESULTS);

  return { announcements };
});

module.exports = { getViewerAnnouncements };