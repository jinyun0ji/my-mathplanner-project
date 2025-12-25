const functions = require('firebase-functions');
const { getRecipientsForStudent } = require('../notify/recipients');
const { notifyUsers } = require('../notify/notifications');

const TYPE = 'HOMEWORK_GRADED';

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

        const authUid = afterData.authUid || afterData.studentUid || afterData.studentId;
        const recipients = await getRecipientsForStudent(authUid);

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

        const userIds = [recipients.studentUid, ...recipients.parentUids];
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