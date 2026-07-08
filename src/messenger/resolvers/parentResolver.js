import { INSTITUTE_AUTH_UID, ROOM_TYPES, SLOTS, TEACHER_AUTH_UID } from '../constants/messengerConstants';
import { getParticipantIds, uniqueStrings } from '../utils/participantKeys';
import { getStrictTeacherRoomMatch, isLegacySlotRoomTypeMatch, sortRooms } from '../utils/roomMatcher';

const hasParticipant = (room, keys) => uniqueStrings(keys).some((key) => getParticipantIds(room).includes(key));
const hasTarget = (room, target, fields) => fields.some((field) => String(room?.[field] || '') === target) || getParticipantIds(room).includes(target);
const isParentRoom = (room, type, slot, target, fields, participantKeys) => (
    hasParticipant(room, participantKeys)
    && hasTarget(room, target, fields)
    && isLegacySlotRoomTypeMatch(room, type)
);

export const resolveParentRooms = ({ rooms = [], participantKeys = [] } = {}) => {
    const sortedRooms = sortRooms([...rooms]);
    return {
        teacherRoom: sortedRooms.find((room) => getStrictTeacherRoomMatch(room, { role: 'parent', expectedRoomType: ROOM_TYPES.PARENT_TEACHER, viewerKeys: participantKeys, parentKeys: participantKeys, studentId: String(room?.studentId || ''), teacherAuthUid: TEACHER_AUTH_UID }).ok) || null,
        instituteRoom: sortedRooms.find((room) => isParentRoom(room, ROOM_TYPES.PARENT_INSTITUTE, SLOTS.INSTITUTE, INSTITUTE_AUTH_UID, ['staffAuthUid', 'counterpartUid'], participantKeys)) || null,
        rooms: sortedRooms.filter((room) => getStrictTeacherRoomMatch(room, { role: 'parent', expectedRoomType: ROOM_TYPES.PARENT_TEACHER, viewerKeys: participantKeys, parentKeys: participantKeys, studentId: String(room?.studentId || ''), teacherAuthUid: TEACHER_AUTH_UID }).ok || isParentRoom(room, ROOM_TYPES.PARENT_INSTITUTE, SLOTS.INSTITUTE, INSTITUTE_AUTH_UID, ['staffAuthUid', 'counterpartUid'], participantKeys)),
    };
};
