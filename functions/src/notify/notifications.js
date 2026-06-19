const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { buildNotificationDocument, buildFcmDataPayload } = require('./builders');
const { sendFcmToUsers } = require('./fcm');
const { isNotificationSendingEnabled, notificationDisabledResult } = require('./settings');

const db = getFirestore();

const createNotificationForUsers = async (userIds, payload) => {
    if (!isNotificationSendingEnabled()) {
        return { notificationIds: {}, targetUserCount: 0, ...notificationDisabledResult() };
    }

    const uniqueIds = [...new Set(userIds.filter(Boolean))];

    if (uniqueIds.length === 0) {
        return { notificationIds: {}, targetUserCount: 0 };
    }

    const notificationIds = {};
    const batch = db.batch();

    uniqueIds.forEach((uid) => {
        const docRef = db.collection('notifications').doc(uid).collection('items').doc();
        notificationIds[uid] = docRef.id;
        batch.set(docRef, {
            ...buildNotificationDocument(payload),
            createdAt: FieldValue.serverTimestamp(),
        });
    });

    await batch.commit();
    return { notificationIds, targetUserCount: uniqueIds.length };
};

const createNotificationLog = async ({ targetCount, payload, fcmData, logData = {} }) => {
    if (!isNotificationSendingEnabled()) {
        return null;
    }

    const logRef = db.collection('notifications').doc();
    await logRef.set({
        targetCount,
        successCount: 0,
        failureCount: 0,
        failedTokenCount: 0,
        sentAt: FieldValue.serverTimestamp(),
        eventType: fcmData?.type || payload?.type || null,
        type: fcmData?.type || payload?.type || null,
        title: payload?.title || null,
        body: payload?.body || null,
        ref: payload?.ref || null,
        refCollection: fcmData?.refCollection || null,
        refId: fcmData?.refId || null,
        studentId: fcmData?.studentId || payload?.studentId || null,
        ...logData,
    });
    return logRef;
};

const notifyUsers = async ({ userIds, payload, fcmData, logData }) => {
    if (!isNotificationSendingEnabled()) {
        console.debug('[notifications] sending skipped: notification_disabled');
        return {
            notificationIds: {},
            targetCount: 0,
            notificationLogId: null,
            fcmStats: { successCount: 0, failureCount: 0, failedTokenCount: 0, failedUids: [], failedEntries: [] },
            ...notificationDisabledResult(),
        };
    }

    const notificationPayload = {
        ...payload,
        refCollection: fcmData?.refCollection || payload?.refCollection || null,
        refId: fcmData?.refId || payload?.refId || null,
        studentId: fcmData?.studentId || payload?.studentId || payload?.authUid || null,
    };
    const { notificationIds, targetUserCount } = await createNotificationForUsers(userIds, notificationPayload);
    const logRef = await createNotificationLog({
        targetCount: targetUserCount,
        payload: notificationPayload,
        fcmData,
        logData,
    });

    if (targetUserCount === 0) {
        return {
            notificationIds,
            targetCount: targetUserCount,
            notificationLogId: logRef?.id || null,
            fcmStats: { successCount: 0, failureCount: 0, failedTokenCount: 0, failedUids: [], failedEntries: [] },
            success: true,
            sent: false,
        };
    }

    const fcmStats = await sendFcmToUsers(
        userIds,
        buildFcmDataPayload(fcmData),
        { notificationIds, logRef },
    );

    return {
        notificationIds,
        targetCount: targetUserCount,
        notificationLogId: logRef?.id || null,
        fcmStats,
        success: (fcmStats?.failureCount || 0) === 0,
        sent: (fcmStats?.successCount || 0) > 0,
    };
};

module.exports = {
    createNotificationForUsers,
    createNotificationLog,
    notifyUsers,
    isNotificationSendingEnabled,
};