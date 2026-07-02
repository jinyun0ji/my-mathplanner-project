const functions = require('firebase-functions');
const admin = require('firebase-admin');

const assertCanReadViewerNotifications = async ({ db, requesterUid, viewerUid }) => {
  const indexSnap = await db.collection('userAuthIndex').doc(requesterUid).get();
  const linkedUserDocId = indexSnap.exists ? String(indexSnap.data()?.userDocId || '') : '';
  if (requesterUid !== viewerUid && linkedUserDocId !== viewerUid) {
    throw new functions.https.HttpsError('permission-denied', '본인 알림만 처리할 수 있습니다.');
  }
};

const markNotificationRead = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
  }

  const viewerUid = String(data?.viewerUid || '');
  const notificationId = String(data?.notificationId || '');
  if (!viewerUid || !notificationId) {
    throw new functions.https.HttpsError('invalid-argument', 'viewerUid와 notificationId가 필요합니다.');
  }

  const db = admin.firestore();
  await assertCanReadViewerNotifications({ db, requesterUid: String(context.auth.uid), viewerUid });

  const now = admin.firestore.FieldValue.serverTimestamp();
  await db.collection('notifications').doc(viewerUid).collection('items').doc(notificationId).set({
    isRead: true,
    readAt: now,
    updatedAt: now,
  }, { merge: true });
  return { updated: 1 };
});

module.exports = { markNotificationRead, assertCanReadViewerNotifications };
