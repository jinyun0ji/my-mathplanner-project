const functions = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getRecipientsForStudent } = require('../notify/recipients');
const { notifyUsers } = require('../notify/notifications');

const TYPE = 'LESSON_UPDATED';

const db = getFirestore();

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
            return db.collection('notificationLogs').add({
                type: TYPE,
                refCollection: 'lessonLogs',
                refId: context.params.id,
                targetUserCount: 0,
                successCount: 0,
                failureCount: 0,
                failedTokenCount: 0,
                createdAt: FieldValue.serverTimestamp(),
            });
        }

        const userIds = [recipients.studentUid, ...recipients.parentUids];
        const refId = context.params.id;

        const { targetUserCount, fcmStats } = await notifyUsers({
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

        return db.collection('notificationLogs').add({
            type: TYPE,
            refCollection: 'lessonLogs',
            refId,
            targetUserCount,
            successCount: fcmStats?.successCount || 0,
            failureCount: fcmStats?.failureCount || 0,
            failedTokenCount: fcmStats?.failedTokenCount || 0,
            createdAt: FieldValue.serverTimestamp(),
        });
    });

module.exports = {
    onLessonLogWritten,
};