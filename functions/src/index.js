const { api } = require('./api');
const { adminCreateStaffUser } = require('./admin/createStaffUser');
const { adminCreateLinkCode } = require('./admin/createLinkCode');
const { kakaoLogin } = require('./auth/kakaoLogin');
const { naverLogin } = require('./auth/naverLogin');
const { claimStudentLinkCode } = require('./link/claimStudentLinkCode');

module.exports = {
    api,
    adminCreateStaffUser,
    adminCreateLinkCode,
    kakaoLogin,
    naverLogin,
    claimStudentLinkCode,
};