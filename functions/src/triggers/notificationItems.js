const functions = require('firebase-functions');
const { sendFcmToUsers } = require('../notify/fcm');
const { buildFcmDataPayload } = require('../notify/builders');
const { createNotificationLog } = require('../notify/notifications');

const handleNotificationItemCreated = async (snapshot, context, dependencies = {}) => {
    const sendFcm = dependencies.sendFcmToUsers || sendFcmToUsers;
    const createLog = dependencies.createNotificationLog || createNotificationLog;
    const data = snapshot.data() || {};
    const { uid, notificationId } = context.params;

    const fcmData = {
        type: data.type || 'NOTIFICATION',
        category: data.category || data.payload?.category || data.type || '',
        refCollection: data.refCollection || data.payload?.refCollection || 'notifications',
        refId: data.refId || data.payload?.refId || 'center',
        studentId: data.studentId || data.data?.studentId || null,
    };
    const logRef = await createLog({
        targetCount: 1,
        payload: data,
        fcmData,
        logData: { recipientUid: uid, notificationId },
    });

    await sendFcm(
        [uid],
        buildFcmDataPayload(fcmData),
        { notificationIds: { [uid]: notificationId }, logRef },
    );
    return null;
};

const onNotificationItemCreated = functions.firestore
    .document('notifications/{uid}/items/{notificationId}')
    .onCreate(handleNotificationItemCreated);

module.exports = { handleNotificationItemCreated, onNotificationItemCreated };
