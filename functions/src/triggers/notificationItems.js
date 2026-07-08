const functions = require('firebase-functions');
const { sendFcmToUsers } = require('../notify/fcm');

const onNotificationItemCreated = functions.firestore
    .document('notifications/{uid}/items/{notificationId}')
    .onCreate(async (snapshot, context) => {
        const data = snapshot.data() || {};
        const { uid, notificationId } = context.params;
        if (data.fcmSent === true || data.skipFcm === true) return null;

        const category = data.category || data.payload?.category || data.type || '';
        await sendFcmToUsers([uid], {
            type: data.type || 'NOTIFICATION',
            category,
            refCollection: 'notifications',
            refId: 'center',
            url: '/home?tab=notifications',
        }, { notificationIds: { [uid]: notificationId } });
        return null;
    });

module.exports = { onNotificationItemCreated };
