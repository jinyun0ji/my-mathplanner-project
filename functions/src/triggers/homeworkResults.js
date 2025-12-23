const functions = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getRecipientsForStudent } = require('../notify/recipients');
const { notifyUsers } = require('../notify/notifications');

const TYPE = 'HOMEWORK_GRADED';
const MAX_FAILED_UIDS = 200;

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

        if (beforeData && isUnchanged(beforeData, afterData)) {
            return null;
        }

        const studentId = afterData.studentId;
        const recipients = await getRecipientsForStudent(studentId);

        if (!recipients) {
            return db.collection('notificationLogs').add({
                type: TYPE,
                refCollection: 'homeworkResults',
                refId: context.params.id,
                title: '과제 채점 완료',
                body: '과제가 채점되었습니다.',
                ref: `homeworkResults/${context.params.id}`,
                studentId: studentId || null,
                targetUserCount: 0,
                successCount: 0,
                failureCount: 0,
                failedTokenCount: 0,
                failedUids: [],
                createdAt: FieldValue.serverTimestamp(),
            });
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

        return db.collection('notificationLogs').add({
            type: TYPE,
            refCollection: 'homeworkResults',
            refId,
            title: '과제 채점 완료',
            body: '과제가 채점되었습니다.',
            ref: `homeworkResults/${refId}`,
            studentId: studentId || null,
            targetUserCount,
            successCount: fcmStats?.successCount || 0,
            failureCount: fcmStats?.failureCount || 0,
            failedTokenCount: fcmStats?.failedTokenCount || 0,
            failedUids: (fcmStats?.failedUids || []).slice(0, MAX_FAILED_UIDS),
            createdAt: FieldValue.serverTimestamp(),
        });
    });

module.exports = {
    onHomeworkResultWritten,
};
