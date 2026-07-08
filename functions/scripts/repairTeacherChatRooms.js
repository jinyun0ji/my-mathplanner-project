/* eslint-disable no-console */
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const dryRun = !process.argv.includes('--write');
const asList = (value) => (Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : []);
const text = (value) => String(value || '').trim();
const isTeacherRelated = (room = {}) => {
    const values = [room.roomType, room.channel, room.slot, room.teacherAuthUid, room.teacherName, room.counterpartUid].map(text);
    return values.some((value) => value === 'teacher' || value.endsWith('_teacher') || value.includes('teacher') || value.includes('선생'));
};
const hasIssue = (room = {}) => {
    const participantIds = asList(room.participantIds);
    const roomType = text(room.roomType || room.channel);
    const slot = text(room.slot);
    const typeMissing = !roomType;
    const typeAmbiguous = roomType === 'teacher' || slot === 'teacher' && !['student_teacher', 'parent_teacher'].includes(roomType);
    const tooManyParticipants = participantIds.length >= 3;
    const parentStudentMixed = Boolean(text(room.parentId) || text(room.parentUid)) && Boolean(text(room.studentAuthUid) || text(room.studentUid)) && roomType !== 'parent_teacher';
    const unclearStudentTeacher = roomType === 'student_teacher' && (text(room.parentId) || text(room.parentUid));
    const unclearParentTeacher = roomType === 'parent_teacher' && (!text(room.parentId) && !text(room.parentUid));
    return typeMissing || typeAmbiguous || tooManyParticipants || parentStudentMixed || unclearStudentTeacher || unclearParentTeacher;
};
const summarize = (roomId, room = {}) => ({
    roomId,
    roomType: text(room.roomType),
    channel: text(room.channel),
    slot: text(room.slot),
    studentId: text(room.studentId),
    parentId: text(room.parentId),
    parentUid: text(room.parentUid),
    studentAuthUid: text(room.studentAuthUid || room.studentUid),
    participantIds: asList(room.participantIds),
    participantUserDocIds: room.participantUserDocIds || {},
    lastMessageText: text(room.lastMessageText || room.lastMessage || room.message),
});

async function main() {
    console.log(`[repair:teacher-chat-rooms] start (${dryRun ? 'dry-run' : 'write disabled/manual-review-only'})`);
    const manualReviewRooms = [];
    const roomSnap = await db.collection('chatRooms').get();
    roomSnap.forEach((doc) => {
        const room = doc.data() || {};
        if (isTeacherRelated(room) && hasIssue(room)) manualReviewRooms.push(summarize(doc.id, room));
    });
    manualReviewRooms.forEach((item) => console.log('[repair:teacher-chat-rooms] manual review room', item));

    const badIndexRefs = [];
    const userSnap = await db.collection('userChatRooms').get();
    for (const userDoc of userSnap.docs) {
        const indexSnap = await userDoc.ref.collection('rooms').get();
        indexSnap.forEach((indexDoc) => {
            const index = indexDoc.data() || {};
            if (isTeacherRelated(index) && (text(index.roomType || index.channel) === 'teacher' || !text(index.roomType || index.channel))) {
                badIndexRefs.push({ ownerUid: userDoc.id, indexRoomDocId: indexDoc.id, ...summarize(text(index.roomId || indexDoc.id), index) });
            }
        });
    }
    badIndexRefs.forEach((item) => console.log('[repair:teacher-chat-rooms] manual review userChatRooms index', item));
    console.log(`[repair:teacher-chat-rooms] complete scannedRooms=${roomSnap.size} manualReviewRooms=${manualReviewRooms.length} manualReviewIndexes=${badIndexRefs.length}`);
}

main().catch((error) => {
    console.error('[repair:teacher-chat-rooms] failed', error);
    process.exitCode = 1;
});
