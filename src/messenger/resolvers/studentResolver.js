import { INSTITUTE_AUTH_UID, ROOM_TYPES, SLOTS, TEACHER_AUTH_UID } from '../constants/messengerConstants';
import { getParticipantIds, uniqueStrings } from '../utils/participantKeys';
import { getRoomSlot, hasRoomTypeOrChannel, sortRooms } from '../utils/roomMatcher';

const hasParticipant = (room, keys) => uniqueStrings(keys).some((key) => getParticipantIds(room).includes(key));
const hasTarget = (room, target, fields) => fields.some((field) => String(room?.[field] || '') === target) || getParticipantIds(room).includes(target);

export const isStudentTeacherRoom = (room, participantKeys = []) => (
    hasParticipant(room, participantKeys)
    && !hasRoomTypeOrChannel(room, ROOM_TYPES.STUDENT_INSTITUTE)
    && getRoomSlot(room) !== SLOTS.INSTITUTE
    && (hasRoomTypeOrChannel(room, ROOM_TYPES.STUDENT_TEACHER) || getRoomSlot(room) === SLOTS.TEACHER || hasTarget(room, TEACHER_AUTH_UID, ['teacherAuthUid', 'counterpartUid']))
    && hasTarget(room, TEACHER_AUTH_UID, ['teacherAuthUid', 'counterpartUid'])
);

export const isStudentInstituteRoom = (room, participantKeys = []) => (
    hasParticipant(room, participantKeys)
    && !hasRoomTypeOrChannel(room, ROOM_TYPES.STUDENT_TEACHER)
    && getRoomSlot(room) !== SLOTS.TEACHER
    && (hasRoomTypeOrChannel(room, ROOM_TYPES.STUDENT_INSTITUTE) || getRoomSlot(room) === SLOTS.INSTITUTE || hasTarget(room, INSTITUTE_AUTH_UID, ['staffAuthUid', 'counterpartUid']))
    && hasTarget(room, INSTITUTE_AUTH_UID, ['staffAuthUid', 'counterpartUid'])
);

export const resolveStudentRooms = ({ rooms = [], participantKeys = [] } = {}) => {
    const sortedRooms = sortRooms([...rooms]);
    return {
        teacherRoom: sortedRooms.find((room) => isStudentTeacherRoom(room, participantKeys)) || null,
        instituteRoom: sortedRooms.find((room) => isStudentInstituteRoom(room, participantKeys)) || null,
        rooms: sortedRooms.filter((room) => isStudentTeacherRoom(room, participantKeys) || isStudentInstituteRoom(room, participantKeys)),
    };
};
