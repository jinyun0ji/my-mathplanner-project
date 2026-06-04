const functions = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const ALLOWED_SELF_DELETE_ROLES = new Set(['student', 'parent']);

const requestAccountDeletion = functions.https.onCall(async (_data, context) => {
    const authUid = context?.auth?.uid;
    if (!authUid) {
        throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const db = getFirestore();
    const indexRef = db.collection('userAuthIndex').doc(authUid);
    const legacyUserRef = db.collection('users').doc(authUid);

    let targetUserRef = legacyUserRef;
    let roleFromIndex = null;

    const indexSnap = await indexRef.get();
    if (indexSnap.exists) {
        const indexData = indexSnap.data() || {};
        if (typeof indexData.userDocId === 'string' && indexData.userDocId.trim()) {
            targetUserRef = db.collection('users').doc(indexData.userDocId.trim());
        }
        roleFromIndex = indexData.role || null;
    }

    const targetSnap = await targetUserRef.get();
    if (!targetSnap.exists) {
        throw new functions.https.HttpsError('not-found', '사용자 프로필을 찾을 수 없습니다.');
    }

    const profile = targetSnap.data() || {};
    const role = profile.role || roleFromIndex;
    if (!ALLOWED_SELF_DELETE_ROLES.has(role)) {
        throw new functions.https.HttpsError('permission-denied', '학생/학부모 계정만 탈퇴 요청을 할 수 있습니다.');
    }

    const profileAuthUid = profile.authUid || profile.uid || authUid;
    if (profileAuthUid !== authUid && targetUserRef.id !== authUid) {
        throw new functions.https.HttpsError('permission-denied', '본인 계정만 탈퇴 요청을 할 수 있습니다.');
    }

    await targetUserRef.set({
        status: 'deletion_requested',
        deletionRequested: true,
        deletionRequestedAt: FieldValue.serverTimestamp(),
        deletionRequestedBy: authUid,
        active: false,
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { success: true, userDocId: targetUserRef.id };
});

module.exports = { requestAccountDeletion };
