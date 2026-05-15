const functions = require('firebase-functions');
const { getRecipientsForStudent } = require('../notify/recipients');
const { notifyUsers } = require('../notify/notifications');

const TYPE = 'ANNOUNCEMENT';

const normalizeAnnouncement = (data) => {
    const patch = {};
    const targetClasses = Array.isArray(data.targetClasses) ? data.targetClasses : [];
    const targetStudents = Array.isArray(data.targetStudents) ? data.targetStudents : [];
    let nextTargetClasses = targetClasses;

    if (!Array.isArray(data.targetClasses)) {
        patch.targetClasses = targetClasses;
        nextTargetClasses = targetClasses;
    }

    if (data.classId && targetClasses.length === 0) {
        nextTargetClasses = [String(data.classId)];
        patch.targetClasses = nextTargetClasses;
    }

    if (!Array.isArray(data.targetStudents)) {
        patch.targetStudents = targetStudents;
    }

    const hasIsPublic = typeof data.isPublic === 'boolean';
    const computedIsPublic = (patch.targetClasses || nextTargetClasses).length > 0 ? false : true;

    if (!hasIsPublic) {
        patch.isPublic = computedIsPublic;
    }

    if (!data.__normalized) {
        patch.__normalized = true;
    }

    return {
        patch,
        changed: Object.keys(patch).length > 0,
    };
};

const normalizeAnnouncementOnWrite = functions.firestore
    .document('announcements/{docId}')
    .onWrite(async (change) => {
        if (!change.after.exists) {
            return null;
        }

        const after = change.after.data() || {};
        const { patch, changed } = normalizeAnnouncement(after);

        if (!changed) {
            return null;
        }

        await change.after.ref.set(patch, { merge: true });
        return null;
    });

    const collectTargetStudentUids = (data) => ([
    ...(Array.isArray(data.targetAuthUids) ? data.targetAuthUids : []),
    ...(Array.isArray(data.targetStudents) ? data.targetStudents : []),
].map((value) => String(value || '').trim()).filter(Boolean));

const onAnnouncementCreated = functions.firestore
    .document('announcements/{docId}')
    .onCreate(async (snapshot, context) => {
        const data = snapshot.data() || {};
        if (data.isPublic === true) {
            return null;
        }

        const targetStudentUids = [...new Set(collectTargetStudentUids(data))];
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

        await notifyUsers({
            userIds,
            payload: {
                type: TYPE,
                category: 'announcement',
                title: data.title || '새 공지사항이 등록되었습니다.',
                body: data.content ? String(data.content).replace(/<[^>]*>/g, '').slice(0, 120) : '공지사항을 확인해 주세요.',
                ref: `announcements/${refId}`,
            },
            fcmData: {
                type: TYPE,
                refCollection: 'announcements',
                refId,
            },
            logData: {
                announcementId: refId,
                targetClasses: Array.isArray(data.targetClasses) ? data.targetClasses : [],
                targetStudentCount: targetStudentUids.length,
            },
        });

        return null;
    });

module.exports = {
    normalizeAnnouncementOnWrite,
    onAnnouncementCreated,
};