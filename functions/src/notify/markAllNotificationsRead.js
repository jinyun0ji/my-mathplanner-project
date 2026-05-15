const functions = require('firebase-functions');
const admin = require('firebase-admin');

const markAllNotificationsRead = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
  }

  const viewerUid = String(data?.viewerUid || '');
  if (!viewerUid) {
    throw new functions.https.HttpsError('invalid-argument', 'viewerUid가 필요합니다.');
  }

  const requesterUid = String(context.auth.uid);
  const role = String(context.auth.token?.role || '');
  const isPrivileged = ['staff', 'admin', 'teacher'].includes(role);
  if (!isPrivileged && requesterUid !== viewerUid) {
    throw new functions.https.HttpsError('permission-denied', '본인 알림만 처리할 수 있습니다.');
  }

  const db = admin.firestore();
  const itemsRef = db.collection('notifications').doc(viewerUid).collection('items');
  const snap = await itemsRef.orderBy('createdAt', 'desc').limit(500).get();
  const unreadDocs = snap.docs.filter((d) => {
    const item = d.data() || {};
    return item.isRead !== true && !item.readAt;
  });

  const now = admin.firestore.FieldValue.serverTimestamp();
  const metaRef = db.collection('notifications').doc(viewerUid).collection('meta').doc('meta');

  if (unreadDocs.length === 0) {
    await metaRef.set({ lastReadAt: now, updatedAt: now }, { merge: true });
    return { updated: 0 };
  }

  const batch = db.batch();
  unreadDocs.forEach((d) => {
    batch.update(d.ref, { isRead: true, readAt: now, updatedAt: now });
  });
  batch.set(metaRef, { lastReadAt: now, updatedAt: now }, { merge: true });
  await batch.commit();
  return { updated: unreadDocs.length };
});

module.exports = { markAllNotificationsRead };