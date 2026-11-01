const admin = require('firebase-admin');
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const srcExports = require('./src');
const { onGradeWriteUpdateClassTestStats } = require('./classTestStats');

module.exports = {
    ...srcExports,
    onGradeWriteUpdateClassTestStats,
};
