const { api } = require('./api');
const { adminCreateStaffUser } = require('./admin/createStaffUser');
const { adminCreateLinkCode } = require('./admin/createLinkCode');
const { kakaoLogin } = require('./auth/kakaoLogin');
const { naverLogin } = require('./auth/naverLogin');
const { claimStudentLinkCode } = require('./link/claimStudentLinkCode');
const { onLessonLogWritten } = require('./triggers/lessonLogs');
const { onAttendanceLogWritten } = require('./triggers/attendanceLogs');
const { onHomeworkResultWritten } = require('./triggers/homeworkResults');
const { onGradeWritten } = require('./triggers/grades');
const { onChatMessageCreated } = require('./triggers/chatMessages');

module.exports = {
    api,
    adminCreateStaffUser,
    adminCreateLinkCode,
    kakaoLogin,
    naverLogin,
    claimStudentLinkCode,
    onLessonLogWritten,
    onAttendanceLogWritten,
    onHomeworkResultWritten,
    onGradeWritten,
    onChatMessageCreated,
};