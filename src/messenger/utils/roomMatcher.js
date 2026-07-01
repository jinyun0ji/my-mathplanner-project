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
