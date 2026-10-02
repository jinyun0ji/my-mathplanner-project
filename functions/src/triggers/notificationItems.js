const functions = require('firebase-functions');
const { sendFcmToUsers } = require('../notify/fcm');
const { buildFcmDataPayload } = require('../notify/builders');
const { createNotificationLog } = require('../notify/notifications');
const { isNotificationSendingEnabled, isNotificationTestUid } = require('../notify/settings');

const handleNotificationItemCreated = async (snapshot, context, dependencies = {}) => {
    const sendFcm = dependencies.sendFcmToUsers || sendFcmToUsers;
    const createLog = dependencies.createNotificationLog || createNotificationLog;
    const sendingEnabled = (dependencies.isNotificationSendingEnabled || isNotificationSendingEnabled)();
    const testUid = (dependencies.isNotificationTestUid || isNotificationTestUid)(context.params.uid);
    const data = snapshot.data() || {};
    const { uid, notificationId } = context.params;

    if (!sendingEnabled && !testUid) {
        return null;
    }

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
        allowWhenSendingDisabled: testUid,
    });

    await sendFcm(
        [uid],
        buildFcmDataPayload(fcmData),
        {
            notificationIds: { [uid]: notificationId },
            logRef,
            title: data.title,
            body: data.body,
        },
    );
    return null;
};

const onNotificationItemCreated = functions.firestore
    .document('notifications/{uid}/items/{notificationId}')
    .onCreate(handleNotificationItemCreated);

module.exports = { handleNotificationItemCreated, onNotificationItemCreated };
