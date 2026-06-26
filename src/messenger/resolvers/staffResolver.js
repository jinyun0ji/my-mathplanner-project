import { ROOM_TYPES } from '../constants/messengerConstants';
import { getParticipantIds, uniqueStrings } from '../utils/participantKeys';
import { getRoomType, sortRooms } from '../utils/roomMatcher';

export const resolveStaffRooms = ({ rooms = [], participantKeys = [] } = {}) => {
    const keys = uniqueStrings(participantKeys);
    return sortRooms([...rooms]).filter((room) => {
        const type = getRoomType(room);
        return keys.some((key) => getParticipantIds(room).includes(key))
            || [ROOM_TYPES.TEACHER, ROOM_TYPES.STUDENT, ROOM_TYPES.PARENT, ROOM_TYPES.STUDENT_TEACHER, ROOM_TYPES.STUDENT_INSTITUTE, ROOM_TYPES.PARENT_TEACHER, ROOM_TYPES.PARENT_INSTITUTE].includes(type);
    });
};
