const functions = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getRecipientsForStudent } = require('../notify/recipients');
const { notifyUsers } = require('../notify/notifications');

const TYPE = 'GRADE_PUBLISHED';
const MAX_FAILED_UIDS = 200;

const db = getFirestore();

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
            return db.collection('notificationLogs').add({
                type: TYPE,
                refCollection: 'grades',
                refId: context.params.id,
                title: '성적 업데이트',
                body: '성적이 업데이트되었습니다.',
                ref: `grades/${context.params.id}`,
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

        const { targetUserCount, fcmStats } = await notifyUsers({
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

        return db.collection('notificationLogs').add({
            type: TYPE,
            refCollection: 'grades',
            refId,
            title: '성적 업데이트',
            body: '성적이 업데이트되었습니다.',
            ref: `grades/${refId}`,
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
    onGradeWritten,
};