const functions = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');
const { createStudentRecipientResolver } = require('../notify/recipients');
const { createUserIdentityResolver } = require('../identity/resolveUserIdentity');
const { notifyUsers } = require('../notify/notifications');
const { isNotificationSendingEnabled, notificationDisabledResult } = require('../notify/settings');

const TYPE = 'HOMEWORK_GRADED';
const db = getFirestore();

const isUnchanged = (before, after) => JSON.stringify(before) === JSON.stringify(after);

const onHomeworkResultWritten = functions.firestore
    .document('homeworkResults/{id}')
    .onWrite(async (change, context) => {
        if (!change.after.exists) {
            return null;
        }

        const afterData = change.after.data() || {};
        const beforeData = change.before.exists ? change.before.data() : null;

        if (afterData.notifyMode === 'staff') {
            return null;
        }

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
                    title: '과제 채점 완료',
                    body: '과제가 채점되었습니다.',
                    ref: `homeworkResults/${context.params.id}`,
                    authUid,
                },
                fcmData: {
                    type: TYPE,
                    refCollection: 'homeworkResults',
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
                title: '과제 채점 완료',
                body: '과제가 채점되었습니다.',
                ref: `homeworkResults/${refId}`,
                authUid,
            },
            fcmData: {
                type: TYPE,
                refCollection: 'homeworkResults',
                refId,
                authUid,
            },
        });
        return null;
    });

module.exports = {
    onHomeworkResultWritten,
};
