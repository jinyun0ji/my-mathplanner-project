const functions = require('firebase-functions');

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

module.exports = {
    normalizeAnnouncementOnWrite,
};