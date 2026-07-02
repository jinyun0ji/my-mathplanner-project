const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { assertCanReadViewerNotifications } = require('./markNotificationRead');

const getRoomIdCandidates = (item = {}) => new Set([
  item.roomId,
  item.chatRoomId,
  item.refCollection === 'chatRooms' || item.refCollection === 'chats' ? item.refId : '',
  typeof item.ref === 'string' && (item.ref.startsWith('chatRooms/') || item.ref.startsWith('chats/')) ? item.ref.split('/').filter(Boolean)[1] : '',
  item.payload?.roomId,
  item.payload?.chatRoomId,
].map((value) => String(value || '').trim()).filter(Boolean));

const markChatRoomNotificationsRead = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
  }

  const viewerUid = String(data?.viewerUid || '').trim();
  const roomId = String(data?.roomId || '').trim();
  if (!viewerUid || !roomId) {
    throw new functions.https.HttpsError('invalid-argument', 'viewerUid와 roomId가 필요합니다.');
  }

  const db = admin.firestore();
  await assertCanReadViewerNotifications({ db, requesterUid: String(context.auth.uid), viewerUid });

  console.log('[chat notification read]', { viewerUid, roomId });

  const itemsRef = db.collection('notifications').doc(viewerUid).collection('items');
  const snap = await itemsRef.orderBy('createdAt', 'desc').limit(500).get();
  const targetDocs = snap.docs.filter((doc) => {
    const item = doc.data() || {};
    const type = String(item.type || item.notificationType || item.payload?.type || '').trim();
    const looksLikeChat = type === 'CHAT_MESSAGE'
      || item.refCollection === 'chatRooms'
      || item.refCollection === 'chats'
      || String(item.ref || '').startsWith('chatRooms/')
      || String(item.ref || '').startsWith('chats/')
      || item.payload?.roomId
      || item.roomId;
    return looksLikeChat && getRoomIdCandidates(item).has(roomId) && item.isRead !== true && !item.readAt;
  });

  if (targetDocs.length === 0) return { updated: 0 };

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  targetDocs.forEach((doc) => batch.update(doc.ref, { isRead: true, readAt: now, updatedAt: now }));
  await batch.commit();
  return { updated: targetDocs.length };
});

module.exports = { markChatRoomNotificationsRead };
