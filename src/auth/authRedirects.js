import { ROLE, isStaffOrTeachingRole } from '../constants/roles';
import { isCapacitorNativeEnvironment, STAFF_MOBILE_MESSENGER_ROUTE } from '../utils/capacitorEnvironment';

export const getDefaultRouteForRole = (role) => {
    if (isCapacitorNativeEnvironment() && isStaffOrTeachingRole(role)) {
        return STAFF_MOBILE_MESSENGER_ROUTE;
    }

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