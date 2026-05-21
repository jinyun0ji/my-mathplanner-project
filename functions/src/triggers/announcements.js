const functions = require('firebase-functions');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { getRecipientsForStudent } = require('../notify/recipients');

const db = getFirestore();
const TYPE = 'BOARD_POST';

const collectTargetStudentUids = (data) => ([
    ...(Array.isArray(data.targetAuthUids) ? data.targetAuthUids : []),
    ...(Array.isArray(data.targetStudents) ? data.targetStudents : []),
].map((value) => String(value || '').trim()).filter(Boolean));

const extractClassStudentUids = async (classIds = []) => {
    const uniqueClassIds = [...new Set(classIds.map((value) => String(value || '').trim()).filter(Boolean))];
    if (uniqueClassIds.length === 0) return [];

    const studentUidSet = new Set();
    const snapshots = await Promise.all(uniqueClassIds.map((classId) => db.collection('classes').doc(classId).get()));

    snapshots.forEach((snapshot) => {
        if (!snapshot.exists) return;
        const data = snapshot.data() || {};
        const candidates = [
            ...(Array.isArray(data.studentIds) ? data.studentIds : []),
            ...(Array.isArray(data.studentUids) ? data.studentUids : []),
            ...(Array.isArray(data.students) ? data.students.map((student) => student?.authUid || student?.studentId || student?.id) : []),
        ];
        candidates.forEach((value) => {
            const key = String(value || '').trim();
            if (key) studentUidSet.add(key);
        });
    });

    return [...studentUidSet];
};

const onAnnouncementCreated = functions.firestore
    .document('announcements/{docId}')
    .onWrite(async (change, context) => {
        if (!change.after.exists || change.before.exists) {
            return null;
        }

        const data = change.after.data() || {};
        if (data.isPublic === true) {
            return null;
        }

        const classTargetStudents = await extractClassStudentUids(Array.isArray(data.targetClasses) ? data.targetClasses : []);
        const targetStudentUids = [...new Set([
            ...collectTargetStudentUids(data),
            ...classTargetStudents,
        ])];
        const recipientSet = new Set();

        for (const studentUid of targetStudentUids) {
            const recipients = await getRecipientsForStudent(studentUid);
            if (!recipients) {
                continue;
            }
            if (recipients.studentUid) {
                recipientSet.add(recipients.studentUid);
            }
            recipients.parentUids.forEach((parentUid) => recipientSet.add(parentUid));
        }

        const userIds = [...recipientSet];
        const refId = context.params.docId;

        const title = data.title || '새 게시글이 등록되었습니다.';
        const body = data.content ? String(data.content).replace(/<[^>]*>/g, '').slice(0, 120) : '게시판 글을 확인해 주세요.';
        const batch = db.batch();

        userIds.forEach((uid) => {
            const docRef = db.collection('notifications').doc(uid).collection('items').doc(`boardPost_${refId}`);
            batch.set(docRef, {
                type: TYPE,
                category: 'board_post',
                title,
                body,
                ref: `announcements/${refId}`,
                refCollection: 'announcements',
                refId,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
        });

        await batch.commit();
        await db.collection('notifications').add({
            targetCount: userIds.length,
            successCount: 0,
            failureCount: 0,
            failedTokenCount: 0,
            sentAt: FieldValue.serverTimestamp(),
            eventType: TYPE,
            type: TYPE,
            title,
            body,
            ref: `announcements/${refId}`,
            refCollection: 'announcements',
            refId,
            announcementId: refId,
            targetClasses: Array.isArray(data.targetClasses) ? data.targetClasses : [],
            targetStudentCount: targetStudentUids.length,
            notificationDocPattern: 'notifications/{uid}/items/boardPost_{announcementId}',
            dedupeMode: 'create_only',
        });

        return null;
    });

module.exports = {
    onAnnouncementCreated,
};