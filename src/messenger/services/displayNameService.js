import { DISPLAY_NAMES } from '../constants/messengerConstants';
import { normalizeText } from '../utils/roomMatcher';

export const getInstituteDisplayName = () => DISPLAY_NAMES.institute;
export const getTeacherDisplayName = () => DISPLAY_NAMES.teacher;
export const getStudentDisplayName = (student = {}) => normalizeText(student?.name || student?.studentName) || '이름 미등록';
export const getParentDisplayName = (student = {}) => `${getStudentDisplayName(student)} 학부모`;

export const getRoomDisplayName = ({ role, slot, student, room } = {}) => {
    if (slot === 'institute') return getInstituteDisplayName();
    if (slot === 'teacher') return getTeacherDisplayName();
    if (role === 'parent') return getParentDisplayName(student);
    if (role === 'student') return getStudentDisplayName(student);
    return normalizeText(room?.name || room?.title) || getInstituteDisplayName();
};
