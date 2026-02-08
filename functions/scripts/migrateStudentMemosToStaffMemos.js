/* eslint-disable no-console */
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const SOURCE_COLLECTION = 'studentMemos';
const TARGET_COLLECTION = 'staffMemos';

const migrateTopLevelMemos = async () => {
    const snapshot = await db.collection(SOURCE_COLLECTION).get();
    const writes = [];

    snapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const studentId = data.studentId || data.studentDocId || data.studentUid || docSnap.id;
        if (!studentId) return;
        const targetRef = db.collection(TARGET_COLLECTION).doc(String(studentId)).collection('items').doc(docSnap.id);
        writes.push(
            targetRef.get().then((targetSnap) => {
                if (targetSnap.exists) return null;
                return targetRef.set({
                    ...data,
                    migratedFrom: SOURCE_COLLECTION,
                    migratedAt: FieldValue.serverTimestamp(),
                });
            }),
        );

        writes.push(
            docSnap.ref.set({
                migratedToStaffMemos: true,
                migratedAt: FieldValue.serverTimestamp(),
            }, { merge: true }),
        );
    });

    await Promise.all(writes);
};

const migrateNestedMemos = async () => {
    const parentSnapshot = await db.collection(SOURCE_COLLECTION).get();
    const writes = [];

    for (const parentDoc of parentSnapshot.docs) {
        const studentId = parentDoc.id;
        const itemsSnapshot = await parentDoc.ref.collection('items').get();
        itemsSnapshot.forEach((itemSnap) => {
            const data = itemSnap.data() || {};
            const targetRef = db.collection(TARGET_COLLECTION).doc(String(studentId)).collection('items').doc(itemSnap.id);
            writes.push(
                targetRef.get().then((targetSnap) => {
                    if (targetSnap.exists) return null;
                    return targetRef.set({
                        ...data,
                        migratedFrom: `${SOURCE_COLLECTION}/${studentId}/items`,
                        migratedAt: FieldValue.serverTimestamp(),
                    });
                }),
            );
            writes.push(
                itemSnap.ref.set({
                    migratedToStaffMemos: true,
                    migratedAt: FieldValue.serverTimestamp(),
                }, { merge: true }),
            );
        });
    }

    await Promise.all(writes);
};

const run = async () => {
    console.log('[migrate] start student memos -> staff memos');
    await migrateTopLevelMemos();
    await migrateNestedMemos();
    console.log('[migrate] complete');
};

run().catch((error) => {
    console.error('[migrate] failed', error);
    process.exitCode = 1;
});