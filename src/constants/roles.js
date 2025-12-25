export const ROLE = Object.freeze({
    ADMIN: 'admin',
    STAFF: 'staff',
    TEACHER: 'teacher',
    STUDENT: 'student',
    PARENT: 'parent',
    PENDING: 'pending',
});

export const STAFF_ROLES = [ROLE.STAFF, ROLE.ADMIN, ROLE.TEACHER];