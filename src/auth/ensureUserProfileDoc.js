const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

if (!admin.apps.length) {
    admin.initializeApp();
}

const ensureUserProfileDoc = functions.https.onCall(async (_data, context) => {
    if (!context?.auth?.uid) {
        throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const uid = context.auth.uid;
    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);

    const existingSnap = await userRef.get();
    if (existingSnap.exists) {
        return { status: 'exists', profileDocId: existingSnap.id };
    }

    const legacySnap = await db
        .collection('users')
        .where('authUid', '==', uid)
        .limit(1)
        .get();

    if (!legacySnap.empty) {
        const legacyDoc = legacySnap.docs[0];
        const legacyData = legacyDoc.data() || {};
        await userRef.set({ authUid: uid, ...legacyData }, { merge: true });
        return {
            status: 'migrated',
            migratedFromDocId: legacyDoc.id,
            profileDocId: userRef.id,
        };
    }

    return { status: 'no_profile' };
});

module.exports = { ensureUserProfileDoc };