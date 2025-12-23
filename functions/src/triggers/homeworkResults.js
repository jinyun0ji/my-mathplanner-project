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

        if (beforeData && isUnchanged(beforeData, afterData)) {
            return null;
        }

        const studentId = afterData.studentId;
        const recipients = await getRecipientsForStudent(studentId);

        if (!recipients) {
            return null;
        }

        const userIds = [recipients.studentUid, ...recipients.parentUids];
        const refId = context.params.id;

        return notifyUsers({
            userIds,
            payload: {
                type: TYPE,
                title: '과제 채점 완료',
                body: '과제가 채점되었습니다.',
                ref: `homeworkResults/${refId}`,
                studentId,
            },
            fcmData: {
                type: TYPE,
                refCollection: 'homeworkResults',
                refId,
                studentId,
            },
        });
    });

module.exports = {
    onHomeworkResultWritten,
};
