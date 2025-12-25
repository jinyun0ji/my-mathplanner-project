const functions = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { assertAdmin } = require('../_utils/assertAdmin');
const { notifyUsers } = require('../notify/notifications');

const db = getFirestore();
const RETRY_LIMIT = 50;

const getUidsWithTokens = async (uids) => {
    const checks = await Promise.all(uids.map(async (uid) => {
        const snapshot = await db.collection('users').doc(uid).collection('fcmTokens').limit(1).get();
        return snapshot.empty ? null : uid;
    }));

    return checks.filter(Boolean);
};

const retryNotification = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);

    const logId = typeof data?.logId === 'string' ? data.logId.trim() : '';

    if (!logId) {
        throw new functions.https.HttpsError('invalid-argument', 'logId is required.');
    }

    const logRef = db.collection('notifications').doc(logId);
    const logSnapshot = await logRef.get();

    if (!logSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'notification log not found.');
    }

    const logData = logSnapshot.data() || {};

    if (logData.retry?.attempted) {
        throw new functions.https.HttpsError('failed-precondition', 'Retry already attempted for this log.');
    }

    const failedSnapshot = await logRef.collection('deliveries')
        .where('status', '==', 'failed')
        .limit(RETRY_LIMIT)
        .get();
    const failedUids = failedSnapshot.docs.map((doc) => doc.id).filter(Boolean);

    if (failedUids.length === 0) {
        throw new functions.https.HttpsError('failed-precondition', 'No failed users to retry.');
    }

    const eligibleUids = await getUidsWithTokens(failedUids);

    if (eligibleUids.length === 0) {
        throw new functions.https.HttpsError('failed-precondition', 'No users with valid tokens to retry.');
    }

    const payload = {
        type: logData.type,
        title: logData.title,
        body: logData.body,
        ref: logData.ref,
        studentId: logData.studentId || null,
    };

    const fcmData = {
        type: logData.type,
        refCollection: logData.refCollection,
        refId: logData.refId,
        studentId: logData.studentId || null,
    };

    const { targetCount, fcmStats, notificationLogId } = await notifyUsers({
        userIds: eligibleUids,
        payload,
        fcmData,
        logData: {
            retryOf: logId,
        },
    });

    const failedUidSet = new Set(fcmStats?.failedUids || []);
    const retrySuccessUids = eligibleUids.filter((uid) => !failedUidSet.has(uid));

    if (retrySuccessUids.length > 0 || failedUidSet.size > 0) {
        const deliveryUpdates = [
            ...retrySuccessUids.map((uid) => ({
                uid,
                data: {
                    status: 'success',
                    errorCode: FieldValue.delete(),
                    succeededAt: FieldValue.serverTimestamp(),
                    lastAttemptedAt: FieldValue.serverTimestamp(),
                    retryLogId: notificationLogId,
                },
            })),
            ...(fcmStats?.failedEntries || []).map((entry) => ({
                uid: entry.uid,
                data: {
                    status: 'failed',
                    errorCode: entry.errorCode,
                    failedAt: FieldValue.serverTimestamp(),
                    lastAttemptedAt: FieldValue.serverTimestamp(),
                    retryLogId: notificationLogId,
                },
            })),
        ];

        for (let i = 0; i < deliveryUpdates.length; i += 450) {
            const batch = db.batch();
            deliveryUpdates.slice(i, i + 450).forEach(({ uid, data }) => {
                batch.set(logRef.collection('deliveries').doc(uid), data, { merge: true });
            });
            await batch.commit();
        }
    }

    await logRef.update({
        retry: {
            attempted: true,
            attemptedAt: FieldValue.serverTimestamp(),
            retryLogId: notificationLogId,
            retrySuccessCount: fcmStats?.successCount || 0,
            retryFailureCount: fcmStats?.failureCount || 0,
        },
        successCount: FieldValue.increment(fcmStats?.successCount || 0),
        failureCount: FieldValue.increment(-(fcmStats?.successCount || 0)),
    });

    return {
        retryLogId: notificationLogId,
        targetCount,
        successCount: fcmStats?.successCount || 0,
        failureCount: fcmStats?.failureCount || 0,
    };
});

module.exports = { retryNotification };