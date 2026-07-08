import { INSTITUTE_AUTH_UID, ROOM_TYPES, TEACHER_AUTH_UID } from '../constants/messengerConstants';
import { getParticipantIds, uniqueStrings } from '../utils/participantKeys';
import { getStrictTeacherRoomMatch, isLegacySlotRoomTypeMatch, normalizeText, sortRooms } from '../utils/roomMatcher';

const hasTargetParticipant = (room, targetAuthUid) => Boolean(targetAuthUid) && (getParticipantIds(room).includes(String(targetAuthUid)) || String(room?.counterpartUid || '') === String(targetAuthUid) || String(room?.teacherAuthUid || '') === String(targetAuthUid) || String(room?.staffAuthUid || '') === String(targetAuthUid));
const hasStudentIdentity = (room, participantKeys = []) => {
    const keys = uniqueStrings(participantKeys);
    return keys.some((key) => String(room?.studentId || '') === key || String(room?.studentUid || '') === key || String(room?.studentAuthUid || '') === key || getParticipantIds(room).includes(key));
};

const isParentTypedRoom = (room) => [ROOM_TYPES.PARENT_INSTITUTE, ROOM_TYPES.PARENT_TEACHER].some((type) => normalizeText(room?.roomType) === type || normalizeText(room?.channel) === type);

export const isStudentTeacherRoom = (room, authUid = '', participantKeys = []) => getStrictTeacherRoomMatch(room, {
    role: 'student',
    expectedRoomType: ROOM_TYPES.STUDENT_TEACHER,
    viewerKeys: [authUid, participantKeys],
    studentKeys: [authUid, participantKeys],
    parentKeys: [],
    studentId: participantKeys.find((key) => String(room?.studentId || '') === String(key)) || '',
    teacherAuthUid: TEACHER_AUTH_UID,
}).ok;

export const isStudentInstituteRoom = (room, authUid = '', participantKeys = []) => (
    !isParentTypedRoom(room)
    && hasStudentIdentity(room, [authUid, participantKeys])
    && hasTargetParticipant(room, INSTITUTE_AUTH_UID)
    && isLegacySlotRoomTypeMatch(room, ROOM_TYPES.STUDENT_INSTITUTE)
);

export const resolveStudentRooms = ({ rooms = [], authUid = '', participantKeys = [] } = {}) => {
    const sortedRooms = sortRooms([...rooms]);
    return {
        teacherRoom: sortedRooms.find((room) => isStudentTeacherRoom(room, authUid, participantKeys)) || null,
        instituteRoom: sortedRooms.find((room) => isStudentInstituteRoom(room, authUid, participantKeys)) || null,
        rooms: sortedRooms.filter((room) => isStudentTeacherRoom(room, authUid, participantKeys) || isStudentInstituteRoom(room, authUid, participantKeys)),
    };
};
