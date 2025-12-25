const functions = require('firebase-functions');
const { getRecipientsForStudent } = require('../notify/recipients');
const { notifyUsers } = require('../notify/notifications');

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

        const studentId = afterData.studentId;
        const recipients = await getRecipientsForStudent(studentId);

        if (!recipients) {
            await notifyUsers({
                userIds: [],
                payload: {
                    type: TYPE,
                    title: '성적 업데이트',
                    body: '성적이 업데이트되었습니다.',
                    ref: `grades/${context.params.id}`,
                    studentId,
                },
                fcmData: {
                    type: TYPE,
                    refCollection: 'grades',
                    refId: context.params.id,
                    studentId,
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
                title: '성적 업데이트',
                body: '성적이 업데이트되었습니다.',
                ref: `grades/${refId}`,
                studentId,
            },
            fcmData: {
                type: TYPE,
                refCollection: 'grades',
                refId,
                studentId,
            },
        });
        return null;
    });

module.exports = {
    onGradeWritten,
};