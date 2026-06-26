import { INSTITUTE_AUTH_UID, ROOM_TYPES, SLOTS, TEACHER_AUTH_UID } from '../constants/messengerConstants';
import { getParticipantIds } from '../utils/participantKeys';
import { normalizeText, sortRooms } from '../utils/roomMatcher';

const hasAuthParticipant = (room, authUid) => Boolean(authUid) && getParticipantIds(room).includes(String(authUid));
const hasTargetParticipant = (room, targetAuthUid) => Boolean(targetAuthUid) && getParticipantIds(room).includes(String(targetAuthUid));
const hasAnyValue = (room, fields, expectedValues) => {
    const values = new Set(expectedValues.map(String));
    return fields.some((field) => values.has(normalizeText(room?.[field])));
};

export const isStudentTeacherRoom = (room, authUid = '') => (
    hasAuthParticipant(room, authUid)
    && hasTargetParticipant(room, TEACHER_AUTH_UID)
    && hasAnyValue(room, ['channel', 'roomType', 'slot', 'teacherAuthUid', 'counterpartUid'], [
        SLOTS.TEACHER,
        ROOM_TYPES.STUDENT_TEACHER,
        TEACHER_AUTH_UID,
    ])
);

export const isStudentInstituteRoom = (room, authUid = '') => (
    hasAuthParticipant(room, authUid)
    && hasTargetParticipant(room, INSTITUTE_AUTH_UID)
    && hasAnyValue(room, ['channel', 'roomType', 'slot', 'staffAuthUid', 'counterpartUid'], [
        SLOTS.INSTITUTE,
        ROOM_TYPES.STUDENT_INSTITUTE,
        INSTITUTE_AUTH_UID,
    ])
);

export const resolveStudentRooms = ({ rooms = [], authUid = '' } = {}) => {
    const sortedRooms = sortRooms([...rooms]);
    return {
        teacherRoom: sortedRooms.find((room) => isStudentTeacherRoom(room, authUid)) || null,
        instituteRoom: sortedRooms.find((room) => isStudentInstituteRoom(room, authUid)) || null,
        rooms: sortedRooms.filter((room) => isStudentTeacherRoom(room, authUid) || isStudentInstituteRoom(room, authUid)),
    };
};
