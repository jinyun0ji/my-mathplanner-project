const functions = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');
const { createStudentRecipientResolver } = require('../notify/recipients');
const { createUserIdentityResolver } = require('../identity/resolveUserIdentity');
const { notifyUsers } = require('../notify/notifications');
const { isNotificationSendingEnabled, notificationDisabledResult } = require('../notify/settings');

const TYPE = 'ATTENDANCE_UPDATED';
const db = getFirestore();
const isUnchanged = (before, after) => JSON.stringify(before) === JSON.stringify(after);

const onAttendanceLogWritten = functions.firestore
    .document('attendanceLogs/{id}')
    .onWrite(async (change, context) => {
        if (!change.after.exists) {
            return null;
        }

        const afterData = change.after.data() || {};
        const beforeData = change.before.exists ? change.before.data() : null;

        if (beforeData && isUnchanged(beforeData, afterData)) {
            return null;
        }

        if (!isNotificationSendingEnabled()) {
            console.debug('[notifications] trigger skipped: notification_disabled');
            return notificationDisabledResult();
        }

        const resolveIdentity = createUserIdentityResolver({ db });
        const getRecipients = createStudentRecipientResolver({ database: db, resolveIdentity });
        const authUid = afterData.authUid || afterData.studentUid || afterData.studentId;
        const recipients = await getRecipients(authUid);

        if (!recipients) {
            await notifyUsers({
                userIds: [],
                payload: {
                    type: TYPE,
                    title: '출결 안내',
                    body: '출결 정보가 업데이트되었습니다.',
                    ref: `attendanceLogs/${context.params.id}`,
                    authUid,
                },
                fcmData: {
                    type: TYPE,
                    refCollection: 'attendanceLogs',
                    refId: context.params.id,
                    authUid,
                },
            });
            return null;
        }

        const userIds = [recipients.studentUid];
        const refId = context.params.id;

        await notifyUsers({
            userIds,
            payload: {
                type: TYPE,
                title: '출결 안내',
                body: '출결 정보가 업데이트되었습니다.',
                ref: `attendanceLogs/${refId}`,
                authUid,
            },
            fcmData: {
                type: TYPE,
                refCollection: 'attendanceLogs',
                refId,
                authUid,
            },
        });

        return null;
    });

module.exports = {
    onAttendanceLogWritten,
};
