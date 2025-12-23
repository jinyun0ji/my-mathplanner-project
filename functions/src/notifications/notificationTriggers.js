const functions = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const db = getFirestore();

const NOTIFICATION_TYPES = {
    LESSON_UPDATED: 'LESSON_UPDATED',
    ATTENDANCE_UPDATED: 'ATTENDANCE_UPDATED',
    HOMEWORK_GRADED: 'HOMEWORK_GRADED',
    GRADE_PUBLISHED: 'GRADE_PUBLISHED',
    CHAT_MESSAGE: 'CHAT_MESSAGE',
};

const NOTIFICATION_TITLES = {
    [NOTIFICATION_TYPES.LESSON_UPDATED]: '수업 안내',
    [NOTIFICATION_TYPES.ATTENDANCE_UPDATED]: '출결 안내',
    [NOTIFICATION_TYPES.HOMEWORK_GRADED]: '과제 채점 완료',
    [NOTIFICATION_TYPES.GRADE_PUBLISHED]: '성적 업데이트',
    [NOTIFICATION_TYPES.CHAT_MESSAGE]: '새 메시지',
};

const NOTIFICATION_BODIES = {
    [NOTIFICATION_TYPES.LESSON_UPDATED]: '새 수업 기록이 등록되었습니다.',
    [NOTIFICATION_TYPES.ATTENDANCE_UPDATED]: '출결 정보가 업데이트되었습니다.',
    [NOTIFICATION_TYPES.HOMEWORK_GRADED]: '과제가 채점되었습니다.',
    [NOTIFICATION_TYPES.GRADE_PUBLISHED]: '성적이 업데이트되었습니다.',
    [NOTIFICATION_TYPES.CHAT_MESSAGE]: '새 메시지가 도착했습니다.',
};

const chunk = (items, size) => {
    const results = [];
    for (let i = 0; i < items.length; i += size) {
        results.push(items.slice(i, i + size));
    }
    return results;
};

const buildFcmDataPayload = ({ type, refCollection, refId, studentId, notificationId }) => {
    const data = {
        type,
        refCollection,
        refId,
        notificationId,
    };

    if (studentId) {
        data.studentId = studentId;
    }

    return Object.entries(data).reduce((acc, [key, value]) => {
        if (value === undefined || value === null) {
            return acc;
        }
        acc[key] = String(value);
        return acc;
    }, {});
};

const getRecipientsForStudent = async (studentId) => {
    if (!studentId) {
        return null;
    }

    const studentRef = db.collection('students').doc(String(studentId));
    const snapshot = await studentRef.get();

    if (!snapshot.exists) {
        return null;
    }

    const data = snapshot.data() || {};
    const parentUids = Array.isArray(data.parentUids) ? data.parentUids.filter(Boolean) : [];
    const studentUid = data.uid || studentId;

    return {
        studentUid,
        parentUids,
    };
};

const createNotificationForUsers = async (userIds, payload) => {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];

    if (uniqueIds.length === 0) {
        return {};
    }

    const notificationIds = {};
    const batch = db.batch();

    uniqueIds.forEach((uid) => {
        const docRef = db.collection('notifications').doc(uid).collection('items').doc();
        notificationIds[uid] = docRef.id;
        batch.set(docRef, {
            type: payload.type,
            title: payload.title,
            body: payload.body,
            ref: payload.ref,
            studentId: payload.studentId || null,
            createdAt: FieldValue.serverTimestamp(),
            readAt: null,
        });
    });

    await batch.commit();
    return notificationIds;
};

const sendFcmToUsers = async (userIds, dataPayload, notificationIds = {}) => {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];

    if (uniqueIds.length === 0) {
        return;
    }

    const messaging = getMessaging();

    await Promise.all(uniqueIds.map(async (uid) => {
        const tokenSnapshot = await db.collection('users').doc(uid).collection('fcmTokens').get();
        const tokens = tokenSnapshot.docs
            .map((doc) => doc.data()?.token || doc.id)
            .filter(Boolean);

        if (tokens.length === 0) {
            return;
        }

        const payload = buildFcmDataPayload({
            ...dataPayload,
            notificationId: notificationIds[uid],
        });

        const tokenChunks = chunk(tokens, 500);
        await Promise.all(tokenChunks.map((tokenBatch) => messaging.sendEachForMulticast({
            tokens: tokenBatch,
            data: payload,
        })));
    }));
};

const notifyStudentAndParents = async ({ studentId, type, refCollection, refId }) => {
    const recipients = await getRecipientsForStudent(studentId);

    if (!recipients) {
        return null;
    }

    const userIds = [recipients.studentUid, ...recipients.parentUids];
    const notificationPayload = {
        type,
        title: NOTIFICATION_TITLES[type],
        body: NOTIFICATION_BODIES[type],
        ref: `${refCollection}/${refId}`,
        studentId,
    };

    const notificationIds = await createNotificationForUsers(userIds, notificationPayload);

    await sendFcmToUsers(userIds, {
        type,
        refCollection,
        refId,
        studentId,
    }, notificationIds);

    return null;
};

const notifyChatParticipants = async ({ chatId, messageData }) => {
    const chatSnapshot = await db.collection('chats').doc(chatId).get();
    const chatData = chatSnapshot.data() || {};
    const participantIds = Array.isArray(chatData.participantIds) ? chatData.participantIds : [];
    const senderId = messageData.senderId;

    const recipients = participantIds.filter((uid) => uid && uid !== senderId);

    if (recipients.length === 0) {
        return null;
    }

    const notificationPayload = {
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        title: NOTIFICATION_TITLES[NOTIFICATION_TYPES.CHAT_MESSAGE],
        body: NOTIFICATION_BODIES[NOTIFICATION_TYPES.CHAT_MESSAGE],
        ref: `chats/${chatId}`,
    };

    const notificationIds = await createNotificationForUsers(recipients, notificationPayload);

    await sendFcmToUsers(recipients, {
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        refCollection: 'chats',
        refId: chatId,
    }, notificationIds);

    return null;
};

const onLessonLogCreate = functions.firestore
    .document('lessonLogs/{id}')
    .onCreate(async (snapshot, context) => {
        const data = snapshot.data() || {};
        const studentId = data.studentId;

        return notifyStudentAndParents({
            studentId,
            type: NOTIFICATION_TYPES.LESSON_UPDATED,
            refCollection: 'lessonLogs',
            refId: context.params.id,
        });
    });

const onAttendanceLogCreate = functions.firestore
    .document('attendanceLogs/{id}')
    .onCreate(async (snapshot, context) => {
        const data = snapshot.data() || {};
        const studentId = data.studentId;

        return notifyStudentAndParents({
            studentId,
            type: NOTIFICATION_TYPES.ATTENDANCE_UPDATED,
            refCollection: 'attendanceLogs',
            refId: context.params.id,
        });
    });

const onHomeworkResultCreate = functions.firestore
    .document('homeworkResults/{id}')
    .onCreate(async (snapshot, context) => {
        const data = snapshot.data() || {};
        const studentId = data.studentId;

        return notifyStudentAndParents({
            studentId,
            type: NOTIFICATION_TYPES.HOMEWORK_GRADED,
            refCollection: 'homeworkResults',
            refId: context.params.id,
        });
    });

const onGradeCreate = functions.firestore
    .document('grades/{id}')
    .onCreate(async (snapshot, context) => {
        const data = snapshot.data() || {};
        const studentId = data.studentId;

        return notifyStudentAndParents({
            studentId,
            type: NOTIFICATION_TYPES.GRADE_PUBLISHED,
            refCollection: 'grades',
            refId: context.params.id,
        });
    });

const onChatMessageCreate = functions.firestore
    .document('chats/{chatId}/messages/{messageId}')
    .onCreate(async (snapshot, context) => {
        const messageData = snapshot.data() || {};

        return notifyChatParticipants({
            chatId: context.params.chatId,
            messageData,
        });
    });

module.exports = {
    getRecipientsForStudent,
    createNotificationForUsers,
    sendFcmToUsers,
    onLessonLogCreate,
    onAttendanceLogCreate,
    onHomeworkResultCreate,
    onGradeCreate,
    onChatMessageCreate,
};