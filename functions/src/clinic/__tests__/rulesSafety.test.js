const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('Rules source uses affectedKeys for protected additions/removals and retains signed-in reads/activity updates', () => {
    // Source regression assertion only; actual Rules authorization requires the opt-in emulator suite.
    const rules = fs.readFileSync(path.resolve(__dirname, '../../../../firestore.rules'), 'utf8');
    assert.match(rules, /diff\(resource.data\)\.affectedKeys\(\)\.hasAny\(clinicManagedFields\(\)\)/);
    for (const source of ['clinicLogs', 'clinicReservations']) {
        const block = rules.split(`match /${source}/{docId} {`)[1].split('\n    }')[0];
        assert.match(block, /allow read: if signedIn\(\)/);
        assert.match(block, /allow update: if isStaffOrAdminOrTeacher\(\) && clinicManagedFieldsUnchanged\(\)/);
        assert.match(block, /affectedKeys\(\)\.hasAny\(clinicBookingFields\(\)\)/);
        assert.match(block, /allow delete: if isStaffOrAdminOrTeacher\(\)/);
    }
});

test('Rules integration entry fails before SDK loading unless exact isolated emulator bindings are provided', () => {
    const filename = path.resolve(__dirname, '../integration/reservationRules.emulator.test.cjs');
    const script = `const Module = require('node:module');
        const load = Module._load;
        Module._load = function (name, ...args) {
            if (name.startsWith('firebase')) throw new Error('UNEXPECTED_SDK_IMPORT');
            return load.call(this, name, ...args);
        };
        require(${JSON.stringify(filename)});`;
    for (const binding of [{}, { FIRESTORE_EMULATOR_HOST: 'not-loopback:8080', GCLOUD_PROJECT: 'demo-clinic-reservation' },
        { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', GCLOUD_PROJECT: 'not-a-demo-project' }]) {
        const env = { ...process.env };
        delete env.FIRESTORE_EMULATOR_HOST;
        delete env.GCLOUD_PROJECT;
        Object.assign(env, binding);
        const result = spawnSync(process.execPath, ['-e', script], { env, encoding: 'utf8', timeout: 5000 });
        assert.equal(result.error, undefined);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /CLINIC_EMULATOR_SAFETY_STOP/);
        assert.doesNotMatch(result.stderr, /UNEXPECTED_SDK_IMPORT/);
    }
});
