const admin = require('firebase-admin');
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const srcExports = require('./src');
const { onClinicLogsWriteCreateNotifications } = require('./clinicNotifications');
const { onGradeWriteUpdateClassTestStats } = require('./classTestStats');

module.exports = {
    ...srcExports,
    onClinicLogsWriteCreateNotifications,
    onGradeWriteUpdateClassTestStats,
};