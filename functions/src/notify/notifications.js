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

const notifyUsers = async ({ userIds, payload, fcmData }) => {
    const { notificationIds, targetUserCount } = await createNotificationForUsers(userIds, payload);

    const fcmStats = await sendFcmToUsers(userIds, buildFcmDataPayload(fcmData), notificationIds);

    return {
        notificationIds,
        targetUserCount,
        fcmStats,
    };
};

module.exports = {
    createNotificationForUsers,
    notifyUsers,
};