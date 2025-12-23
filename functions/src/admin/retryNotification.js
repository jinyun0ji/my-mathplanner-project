const functions = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { assertAdmin } = require('../_utils/assertAdmin');
const { notifyUsers } = require('../notify/notifications');

const db = getFirestore();

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

    const logRef = db.collection('notificationLogs').doc(logId);
    const logSnapshot = await logRef.get();

    if (!logSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'notification log not found.');
    }

    const logData = logSnapshot.data() || {};

    if (logData.retry?.attempted) {
        throw new functions.https.HttpsError('failed-precondition', 'Retry already attempted for this log.');
    }

    const failedUids = Array.isArray(logData.failedUids) ? logData.failedUids.filter(Boolean) : [];

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

    const { targetUserCount, fcmStats } = await notifyUsers({
        userIds: eligibleUids,
        payload,
        fcmData,
    });

    const retryLogRef = await db.collection('notificationLogs').add({
        type: logData.type,
        refCollection: logData.refCollection,
        refId: logData.refId,
        title: logData.title,
        body: logData.body,
        ref: logData.ref,
        studentId: logData.studentId || null,
        targetUserCount,
        successCount: fcmStats?.successCount || 0,
        failureCount: fcmStats?.failureCount || 0,
        failedTokenCount: fcmStats?.failedTokenCount || 0,
        failedUids: (fcmStats?.failedUids || []).slice(0, 200),
        retryOf: logId,
        createdAt: FieldValue.serverTimestamp(),
    });

    await logRef.update({
        retry: {
            attempted: true,
            attemptedAt: FieldValue.serverTimestamp(),
            retryLogId: retryLogRef.id,
            retrySuccessCount: fcmStats?.successCount || 0,
            retryFailureCount: fcmStats?.failureCount || 0,
        },
    });

    return {
        retryLogId: retryLogRef.id,
        targetUserCount,
        successCount: fcmStats?.successCount || 0,
        failureCount: fcmStats?.failureCount || 0,
    };
});

module.exports = { retryNotification };