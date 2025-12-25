export const ROLE = Object.freeze({
    ADMIN: 'admin',
    STAFF: 'staff',
    TEACHER: 'teacher',
    STUDENT: 'student',
    PARENT: 'parent',
});

export const ALLOWED_ROLES = Object.freeze([
    ROLE.ADMIN,
    ROLE.STAFF,
    ROLE.TEACHER,
    ROLE.STUDENT,
    ROLE.PARENT,
]);

export const ROLE_GROUP = Object.freeze({
    ADMIN_ONLY: [ROLE.ADMIN],
    STAFF_GROUP: [ROLE.ADMIN, ROLE.STAFF],
    TEACHING_GROUP: [ROLE.TEACHER],
    VIEWER_GROUP: [ROLE.STUDENT, ROLE.PARENT],
});

export const isRoleInGroup = (role, group) => group.includes(role);

export const isAdminRole = (role) => isRoleInGroup(role, ROLE_GROUP.ADMIN_ONLY);
export const isStaffGroupRole = (role) => isRoleInGroup(role, ROLE_GROUP.STAFF_GROUP);
export const isTeachingGroupRole = (role) => isRoleInGroup(role, ROLE_GROUP.TEACHING_GROUP);
export const isViewerGroupRole = (role) => isRoleInGroup(role, ROLE_GROUP.VIEWER_GROUP);
export const isStaffOrTeachingRole = (role) => isStaffGroupRole(role) || isTeachingGroupRole(role);
export const isParentRole = (role) => role === ROLE.PARENT;
export const isStudentRole = (role) => role === ROLE.STUDENT;
export const isStaffRole = (role) => role === ROLE.STAFF;
export const isTeacherRole = (role) => role === ROLE.TEACHER;