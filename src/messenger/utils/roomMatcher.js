import { SLOTS } from '../constants/messengerConstants';

export const normalizeText = (value) => String(value || '').trim();

export const toDate = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getRoomType = (room) => normalizeText(room?.roomType || room?.channel);
export const hasRoomTypeOrChannel = (room, expectedRoomType) => normalizeText(room?.roomType) === expectedRoomType || normalizeText(room?.channel) === expectedRoomType;
export const getRoomId = (room) => normalizeText(room?.roomId || room?.id);

export const getExpectedRoomType = (role, slotOrType) => {
    const normalizedRole = normalizeText(role);
    const normalized = normalizeText(slotOrType);
    if (['student_institute', 'student_teacher', 'parent_institute', 'parent_teacher'].includes(normalized)) return normalized;
    if (normalizedRole === 'student' && normalized === SLOTS.INSTITUTE) return 'student_institute';
    if (normalizedRole === 'student' && normalized === SLOTS.TEACHER) return 'student_teacher';
    if (normalizedRole === 'parent' && normalized === SLOTS.INSTITUTE) return 'parent_institute';
    if (normalizedRole === 'parent' && normalized === SLOTS.TEACHER) return 'parent_teacher';
    return '';
};

export const isStrictRoomTypeMatch = (room, expectedRoomType) => Boolean(expectedRoomType) && hasRoomTypeOrChannel(room, expectedRoomType);

export const getExpectedSlot = (expectedRoomType) => {
    const normalized = normalizeText(expectedRoomType);
    if (normalized.endsWith('_institute') || normalized === SLOTS.INSTITUTE) return SLOTS.INSTITUTE;
    if (normalized.endsWith('_teacher') || normalized === SLOTS.TEACHER) return SLOTS.TEACHER;
    return '';
};

export const getExpectedRole = (expectedRoomType) => {
    const normalized = normalizeText(expectedRoomType);
    if (normalized.startsWith('student_')) return 'student';
    if (normalized.startsWith('parent_')) return 'parent';
    return '';
};

export const isLegacySlotRoomTypeMatch = (room, expectedRoomType) => {
    const expectedSlot = getExpectedSlot(expectedRoomType);
    const expectedRole = getExpectedRole(expectedRoomType);
    const roomType = normalizeText(room?.roomType);
    const channel = normalizeText(room?.channel);
    const slot = normalizeText(room?.slot);

    if (!expectedSlot || !expectedRole) return false;
    if (roomType === expectedRoomType || channel === expectedRoomType) return true;

    const explicitType = roomType || channel;
    if (explicitType.startsWith('student_') && expectedRole !== 'student') return false;
    if (explicitType.startsWith('parent_') && expectedRole !== 'parent') return false;
    if (explicitType.endsWith('_institute') && expectedSlot !== SLOTS.INSTITUTE) return false;
    if (explicitType.endsWith('_teacher') && expectedSlot !== SLOTS.TEACHER) return false;

    return roomType === expectedSlot || channel === expectedSlot || slot === expectedSlot;
};

export const getRoomDebugInfo = (room) => ({
    id: getRoomId(room),
    roomType: normalizeText(room?.roomType),
    channel: normalizeText(room?.channel),
    slot: normalizeText(room?.slot),
    studentId: normalizeText(room?.studentId),
    parentId: normalizeText(room?.parentId),
});

export const getRoomSlot = (room) => {
    const explicitSlot = normalizeText(room?.slot);
    if (explicitSlot) return explicitSlot;
    const roomType = getRoomType(room);
    if (roomType === SLOTS.INSTITUTE || roomType.endsWith('_institute')) return SLOTS.INSTITUTE;
    if (roomType === SLOTS.TEACHER || roomType.endsWith('_teacher')) return SLOTS.TEACHER;
    return '';
};

export const getRoomSortTime = (room) => (
    toDate(room?.lastMessageAt)?.getTime()
    || toDate(room?.updatedAt)?.getTime()
    || toDate(room?.createdAt)?.getTime()
    || 0
);

export const sortRooms = (roomList) => roomList.sort((a, b) => getRoomSortTime(b) - getRoomSortTime(a));

const collectStrings = (value) => {
    if (Array.isArray(value)) return value.flatMap(collectStrings);
    if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
    const text = normalizeText(value);
    return text ? [text] : [];
};

const hasAny = (values, keys) => {
    const set = new Set(collectStrings(values));
    return collectStrings(keys).some((key) => set.has(key));
};

const roomValues = (room, fields) => fields.flatMap((field) => collectStrings(room?.[field]));

const teacherShapeOk = (room, expectedRoomType) => {
    const typeValues = collectStrings([room?.roomType, room?.channel, room?.slot]);
    if (typeValues.includes(expectedRoomType)) return true;
    if (expectedRoomType === 'student_teacher') return typeValues.every((value) => !value || ['student_teacher', 'student', 'teacher'].includes(value));
    if (expectedRoomType === 'parent_teacher') return typeValues.every((value) => !value || ['parent_teacher', 'parent', 'teacher'].includes(value));
    return false;
};

export const getStrictTeacherRoomMatch = (room, {
    role = '',
    expectedRoomType = '',
    viewerKeys = [],
    studentKeys = [],
    parentKeys = [],
    studentId = '',
    teacherAuthUid = '',
} = {}) => {
    const roomId = getRoomId(room);
    const participantIds = Array.isArray(room?.participantIds) ? room.participantIds.map(String) : [];
    const roomType = normalizeText(room?.roomType);
    const channel = normalizeText(room?.channel);
    const slot = normalizeText(room?.slot);
    const debug = { roomId, reason: '', roomType, channel, slot, participantIds, studentId: normalizeText(room?.studentId), parentId: normalizeText(room?.parentId), parentUid: normalizeText(room?.parentUid) };
    const reject = (reason) => ({ ok: false, ...debug, reason });
    if (!room) return reject('missing room');
    if (!expectedRoomType || !expectedRoomType.endsWith('_teacher')) return reject('not a teacher expectedRoomType');
    if (!teacherShapeOk(room, expectedRoomType)) return reject('roomType/channel/slot mismatch');
    const counterpartValues = roomValues(room, ['counterpartUid', 'teacherAuthUid', 'staffAuthUid', 'participantIds']);
    if (teacherAuthUid && !hasAny(counterpartValues, [teacherAuthUid])) return reject('teacher uid mismatch');
    const activeStudentKeys = collectStrings([studentId, studentKeys]);
    const roomStudentValues = roomValues(room, ['studentId', 'studentDocId', 'studentIds', 'studentParticipantKeys', 'studentUid', 'studentAuthUid', 'participantUserDocIds']);
    const roomParentValues = roomValues(room, ['parentId', 'parentUid', 'parentDocId', 'parentAuthUid', 'participantUserDocIds']);
    if (expectedRoomType === 'student_teacher' || role === 'student') {
        if (roomType === 'parent_teacher' || channel === 'parent_teacher') return reject('parent_teacher excluded for student slot');
        if (normalizeText(room?.parentId) || normalizeText(room?.parentUid) || normalizeText(room?.parentAuthUid)) return reject('parent fields excluded for student slot');
        if (hasAny(participantIds, parentKeys) || hasAny(roomParentValues, parentKeys)) return reject('parent participant excluded for student slot');
        if (!hasAny([participantIds, roomStudentValues], [viewerKeys, activeStudentKeys])) return reject('student participant mismatch');
        if (studentId && normalizeText(room?.studentId) && normalizeText(room?.studentId) !== normalizeText(studentId)) return reject('studentId mismatch');
    }
    if (expectedRoomType === 'parent_teacher' || role === 'parent') {
        if (roomType === 'student_teacher' || channel === 'student_teacher') return reject('student_teacher excluded for parent slot');
        if (!hasAny([participantIds, roomParentValues], [viewerKeys, parentKeys])) return reject('parent participant mismatch');
        if (!studentId) return reject('active studentId missing');
        if (!hasAny(roomStudentValues, [studentId])) return reject('studentId mismatch');
        if (normalizeText(room?.studentUid) && hasAny([room?.studentUid, room?.studentAuthUid], viewerKeys)) return reject('student owner excluded for parent slot');
    }
    if (participantIds.length > 2) return reject('teacher room has extra participants');
    return { ok: true, ...debug, reason: 'matched' };
};

export const isStrictTeacherRoomMatch = (room, options = {}) => getStrictTeacherRoomMatch(room, options).ok;
