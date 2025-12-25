const ROLE = Object.freeze({
    ADMIN: 'admin',
    STAFF: 'staff',
    TEACHER: 'teacher',
    STUDENT: 'student',
    PARENT: 'parent',
});

const ROLE_GROUP = Object.freeze({
    ADMIN_ONLY: [ROLE.ADMIN],
    STAFF_GROUP: [ROLE.ADMIN, ROLE.STAFF],
    TEACHING_GROUP: [ROLE.TEACHER],
    VIEWER_GROUP: [ROLE.STUDENT, ROLE.PARENT],
});

const isRoleInGroup = (role, group) => group.includes(role);

const isAdminRole = (role) => isRoleInGroup(role, ROLE_GROUP.ADMIN_ONLY);
const isStaffGroupRole = (role) => isRoleInGroup(role, ROLE_GROUP.STAFF_GROUP);
const isTeachingGroupRole = (role) => isRoleInGroup(role, ROLE_GROUP.TEACHING_GROUP);
const isViewerGroupRole = (role) => isRoleInGroup(role, ROLE_GROUP.VIEWER_GROUP);

module.exports = {
    ROLE,
    ROLE_GROUP,
    isRoleInGroup,
    isAdminRole,
    isStaffGroupRole,
    isTeachingGroupRole,
    isViewerGroupRole,
};