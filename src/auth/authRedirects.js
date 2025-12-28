import { ROLE } from '../constants/roles';

export const getDefaultRouteForRole = (role) => {
    switch (role) {
        case ROLE.ADMIN:
        case ROLE.STAFF:
        case ROLE.TEACHER:
            return '/home';
        case ROLE.PARENT:
            return '/parent/home';
        case ROLE.STUDENT:
            return '/student/home';
        default:
            return null;
    }
};