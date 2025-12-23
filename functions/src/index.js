const { api } = require('./api');
const { adminCreateStaffUser } = require('./admin/createStaffUser');
const { adminCreateLinkCode } = require('./admin/createLinkCode');
const { kakaoLogin } = require('./auth/kakaoLogin');
const { naverLogin } = require('./auth/naverLogin');
const { claimStudentLinkCode } = require('./link/claimStudentLinkCode');
const {
    onLessonLogCreate,
    onAttendanceLogCreate,
    onHomeworkResultCreate,
    onGradeCreate,
    onChatMessageCreate,
} = require('./notifications/notificationTriggers');

module.exports = {
    api,
    adminCreateStaffUser,
    adminCreateLinkCode,
    kakaoLogin,
    naverLogin,
    claimStudentLinkCode,
    onLessonLogCreate,
    onAttendanceLogCreate,
    onHomeworkResultCreate,
    onGradeCreate,
    onChatMessageCreate,
};