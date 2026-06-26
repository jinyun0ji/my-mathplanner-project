export const uniqueStrings = (values) => Array.from(new Set(
    values.flat(Infinity).filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())
));

export const buildStudentParticipantKeys = ({ authUid = '', student = {}, studentId = '' } = {}) => uniqueStrings([
    authUid,
    studentId,
    student?.id,
    student?.studentId,
    student?.authUid,
    student?.uid,
    student?.userUid,
    student?.studentUid,
]);

export const buildParentParticipantKeys = ({ authUid = '', parent = {}, student = {}, studentId = '' } = {}) => uniqueStrings([
    authUid,
    parent?.id,
    parent?.uid,
    parent?.authUid,
    parent?.parentId,
    parent?.parentDocId,
    parent?.parentUid,
    studentId,
    student?.parentId,
    student?.parentDocId,
    student?.parentUid,
]);

export const getParticipantIds = (room) => (Array.isArray(room?.participantIds) ? room.participantIds.map(String) : []);
