const functions = require('firebase-functions');
const { getRecipientsForStudent } = require('../notify/recipients');
const { notifyUsers } = require('../notify/notifications');

const TYPE = 'LESSON_UPDATED';

const isUnchanged = (before, after) => JSON.stringify(before) === JSON.stringify(after);

const onLessonLogWritten = functions.firestore
    .document('lessonLogs/{id}')
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
                title: '수업 안내',
                body: '새 수업 기록이 등록되었습니다.',
                ref: `lessonLogs/${refId}`,
                studentId,
            },
            fcmData: {
                type: TYPE,
                refCollection: 'lessonLogs',
                refId,
                studentId,
            },
        });
    });

module.exports = {
    onLessonLogWritten,
};