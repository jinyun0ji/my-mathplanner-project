const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const functionsRoot = path.resolve(__dirname, '../../..');
const removedNames = ['onLessonLogWritten', 'onAttendanceLogWritten', 'onHomeworkResultWritten', 'onClinicLogsWriteCreateNotifications'];
const removedPaths = ['lessonLogs', 'attendanceLogs', 'homeworkResults'].map((name) => `./triggers/${name}`);
const remainingExports = [
    'acceptInviteAndCreateProfile', 'adminCreateLinkCode', 'api', 'auditAttendanceLogs', 'auditClinicLogs',
    'auditGrades', 'auditHomeworkResults', 'auditPayments', 'broadcastChatMessage', 'claimStudentLinkCode',
    'createClinicReservation', 'createOrGetChatRoom', 'createStaffUser', 'deactivateStaff', 'ensureUserProfileDoc',
    'getStaffList', 'getViewerAnnouncements', 'markAllNotificationsRead', 'markChatRoomNotificationsRead',
    'markNotificationRead', 'onAnnouncementCreated', 'onChatMessageCreated', 'onChatRoomMessageCreated',
    'onChatRoomWritten', 'onGradeWriteUpdateClassTestStats',
    'onGradeWritten', 'onNotificationItemCreated', 'requestAccountDeletion', 'resolveInviteCode',
    'retryNotification', 'sendChatMessage', 'updateStaffRole', 'updateClinicReservationTime',
].sort();

// Evaluate the actual two entry modules, substituting dependency modules only.
// No SDK initialization or Cloud Function/network execution is performed.
const exportSurface = (relativePath) => {
    const module = { exports: {} };
    const filename = path.join(functionsRoot, relativePath);
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        module, exports: module.exports,
        require(name) {
            assert.ok(!removedPaths.includes(name), `Retired trigger is still imported: ${name}`);
            assert.notEqual(name, './clinicNotifications', 'Clinic automatic notifications must not be registered');
            if (name === 'firebase-admin') return { apps: [{}] };
            if (relativePath === 'index.js' && name === './src') return exportSurface('src/index.js');
            assert.ok(name.startsWith('./'), `Unexpected entry dependency: ${name}`);
            return new Proxy({}, { get: (_, key) => Object.freeze({ module: name, export: key }) });
        },
    }, { filename });
    return module.exports;
};

test('Functions exports preserve stage 1 policy and audit, replace clinic auto alerts with time-edit callable', () => {
    const exports = exportSurface('index.js');
    assert.deepEqual(Object.keys(exports).sort(), remainingExports);
    for (const name of removedNames) assert.equal(Object.hasOwn(exports, name), false);
    assert.equal(exports.onGradeWritten.module, './triggers/grades');
    assert.equal(exports.onGradeWriteUpdateClassTestStats.module, './classTestStats');
    assert.equal(exports.auditClinicLogs.module, './auditLogs');
    assert.equal(exports.updateClinicReservationTime.module, './clinic/updateClinicReservationTime');
});

test('retired notification-only modules are absent and production JS has no four retired event types', () => {
    for (const name of ['lessonLogs', 'attendanceLogs', 'homeworkResults']) {
        assert.equal(fs.existsSync(path.join(functionsRoot, 'src/triggers', `${name}.js`)), false);
    }
    const retiredTypes = /\b(?:LESSON_UPDATED|ATTENDANCE_UPDATED|HOMEWORK_GRADED|GRADE_PUBLISHED)\b/;
    const inspect = (directory) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (['node_modules', '__tests__', 'integration'].includes(entry.name)) continue;
            const filename = path.join(directory, entry.name);
            if (entry.isDirectory()) inspect(filename);
            else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
                assert.doesNotMatch(fs.readFileSync(filename, 'utf8'), retiredTypes, filename);
            }
        }
    };
    inspect(path.join(functionsRoot, 'src'));
});
