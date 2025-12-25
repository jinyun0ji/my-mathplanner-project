const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { buildNotificationDocument, buildFcmDataPayload } = require('./builders');
const { sendFcmToUsers } = require('./fcm');

const db = getFirestore();

const createNotificationForUsers = async (userIds, payload) => {
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
    const { notificationIds, targetUserCount } = await createNotificationForUsers(userIds, payload);
    const logRef = await createNotificationLog({
        targetCount: targetUserCount,
        payload,
        fcmData,
        logData,
    });

    if (targetUserCount === 0) {
        return {
            notificationIds,
            targetCount: targetUserCount,
            notificationLogId: logRef.id,
            fcmStats: { successCount: 0, failureCount: 0, failedTokenCount: 0, failedUids: [] },
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
        notificationLogId: logRef.id,
        fcmStats,
    };
};

module.exports = {
    createNotificationForUsers,
    notifyUsers,
};