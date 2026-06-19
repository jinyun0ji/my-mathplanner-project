const functions = require('firebase-functions');
const { getRecipientsForStudent } = require('../notify/recipients');
const { notifyUsers } = require('../notify/notifications');
const { isNotificationSendingEnabled, notificationDisabledResult } = require('../notify/settings');

const TYPE = 'GRADE_PUBLISHED';

const isUnchanged = (before, after) => JSON.stringify(before) === JSON.stringify(after);

const onGradeWritten = functions.firestore
    .document('grades/{id}')
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

        const authUid = afterData.authUid || afterData.studentUid || afterData.studentId;
        const recipients = await getRecipientsForStudent(authUid);

        if (!recipients) {
            await notifyUsers({
                userIds: [],
                payload: {
                    type: TYPE,
                    title: '성적 업데이트',
                    body: '성적이 업데이트되었습니다.',
                    ref: `grades/${context.params.id}`,
                    authUid,
                },
                fcmData: {
                    type: TYPE,
                    refCollection: 'grades',
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
                title: '성적 업데이트',
                body: '성적이 업데이트되었습니다.',
                ref: `grades/${refId}`,
                authUid,
            },
            fcmData: {
                type: TYPE,
                refCollection: 'grades',
                refId,
                authUid,
            },
        });
        return null;
    });

module.exports = {
    onGradeWritten,
};