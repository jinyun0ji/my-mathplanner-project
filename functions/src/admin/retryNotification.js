const functions = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { assertAdmin } = require('../_utils/assertAdmin');
const { sendFcmToUsers } = require('../notify/fcm');
const { buildFcmDataPayload } = require('../notify/builders');
const { isNotificationSendingEnabled, notificationDisabledResult } = require('../notify/settings');

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

    if (!isNotificationSendingEnabled()) {
        console.debug('[notifications] retry skipped: notification_disabled');
        return notificationDisabledResult();
    }

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

    const fcmData = {
        type: logData.type,
        refCollection: logData.refCollection,
        refId: logData.refId,
        studentId: logData.studentId || null,
    };

    // A retry re-dispatches the failed delivery. It must not create a new
    // notification item, because item creation is the automatic-send trigger.
    const fcmStats = await sendFcmToUsers(eligibleUids, buildFcmDataPayload(fcmData));
    const notificationLogId = logId;

    const failedUidSet = new Set(fcmStats?.failedUids || []);
    const retrySuccessUids = eligibleUids.filter((uid) => !failedUidSet.has(uid));

    if (retrySuccessUids.length > 0 || failedUidSet.size > 0) {
        const failedEntries = fcmStats?.failedEntries || [];

        for (let i = 0; i < retrySuccessUids.length; i += 450) {
            const batch = db.batch();
            retrySuccessUids.slice(i, i + 450).forEach((uid) => {
                batch.delete(logRef.collection('deliveries').doc(uid));
            });
            await batch.commit();
        }

        for (let i = 0; i < failedEntries.length; i += 450) {
            const batch = db.batch();
            failedEntries.slice(i, i + 450).forEach((entry) => {
                batch.set(logRef.collection('deliveries').doc(entry.uid), {
                    status: 'failed',
                    errorCode: entry.errorCode,
                    failedAt: FieldValue.serverTimestamp(),
                    lastAttemptedAt: FieldValue.serverTimestamp(),
                    retryLogId: notificationLogId,
                }, { merge: true });
            });
            await batch.commit();
        }
    }

    await logRef.update({
        retry: {
            attempted: true,
            attemptedAt: FieldValue.serverTimestamp(),
            retryLogId: logId,
            retrySuccessCount: fcmStats?.successCount || 0,
            retryFailureCount: fcmStats?.failureCount || 0,
        },
        successCount: FieldValue.increment(fcmStats?.successCount || 0),
        failureCount: FieldValue.increment(-(fcmStats?.successCount || 0)),
        failedTokenCount: FieldValue.increment(fcmStats?.failedTokenCount || 0),
    });

    return {
        retryLogId: notificationLogId,
        targetCount: eligibleUids.length,
        successCount: fcmStats?.successCount || 0,
        failureCount: fcmStats?.failureCount || 0,
    };
});

module.exports = { retryNotification };
