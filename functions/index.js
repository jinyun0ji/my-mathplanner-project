const admin = require('firebase-admin');
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const srcExports = require('./src');
const { onClinicLogsWriteCreateNotifications } = require('./clinicNotifications');
const { onGradeWriteUpdateClassTestStats } = require('./classTestStats');
const { onGradesWriteUpdateClassTestStats } = require('./classTestStatsTrigger');

module.exports = {
    ...srcExports,
    onClinicLogsWriteCreateNotifications,
    onGradeWriteUpdateClassTestStats,
    onGradesWriteUpdateClassTestStats,
};