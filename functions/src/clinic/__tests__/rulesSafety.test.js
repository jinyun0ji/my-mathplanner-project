const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');

const integrationFile = path.resolve(__dirname, '../integration/reservationRules.emulator.test.cjs');
const integrationSource = fs.readFileSync(integrationFile, 'utf8');
const validBinding = { CLINIC_EMULATOR_PORT: '18080', FIRESTORE_EMULATOR_HOST: '127.0.0.1:18080',
    GCLOUD_PROJECT: 'demo-clinic-reservation' };
const guardConfig = (env) => vm.runInNewContext(
    integrationSource.split('// Import SDKs only AFTER the safety check.')[0] + '\n({ host, port, projectId });',
    { require, process: { env } },
);

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
    const script = `const Module = require('node:module');
        const load = Module._load;
        Module._load = function (name, ...args) {
            if (name.startsWith('firebase')) throw new Error('UNEXPECTED_SDK_IMPORT');
            return load.call(this, name, ...args);
        };
        require(${JSON.stringify(integrationFile)});`;
    for (const binding of [{}, { ...validBinding, CLINIC_EMULATOR_PORT: undefined },
        { ...validBinding, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
        { ...validBinding, FIRESTORE_EMULATOR_HOST: 'not-loopback:18080' },
        { ...validBinding, GCLOUD_PROJECT: 'not-a-demo-project' }]) {
        const env = { ...process.env };
        delete env.FIRESTORE_EMULATOR_HOST;
        delete env.GCLOUD_PROJECT;
        delete env.CLINIC_EMULATOR_PORT;
        delete env.GOOGLE_CLOUD_PROJECT;
        delete env.FIREBASE_AUTH_EMULATOR_HOST;
        Object.assign(env, binding);
        const result = spawnSync(process.execPath, ['-e', script], { env, encoding: 'utf8', timeout: 5000 });
        assert.equal(result.error, undefined);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /CLINIC_EMULATOR_SAFETY_STOP/);
        assert.doesNotMatch(result.stderr, /UNEXPECTED_SDK_IMPORT/);
    }
});

test('port must be explicit, canonical and within TCP port range', () => {
    for (const port of [undefined, '', '0', '-1', '65536', '1.5', '8081junk', ' 8081', '8081 ', '08081', '8081\n', '1e4']) {
        assert.throws(() => guardConfig({ ...validBinding, CLINIC_EMULATOR_PORT: port,
            FIRESTORE_EMULATOR_HOST: `127.0.0.1:${port}` }), /CLINIC_EMULATOR_SAFETY_STOP/);
    }
});

test('only the exact IPv4 loopback host and selected port are accepted', () => {
    for (const host of ['127.0.0.1:8080', 'localhost:18080', '0.0.0.0:18080', '[::1]:18080',
        'http://127.0.0.1:18080', '127.0.0.1:18080/', 'firestore.googleapis.com:443', 'example.com:18080']) {
        assert.throws(() => guardConfig({ ...validBinding, FIRESTORE_EMULATOR_HOST: host }), /CLINIC_EMULATOR_SAFETY_STOP/);
    }
});

test('missing or conflicting project and Auth emulator bindings fail closed', () => {
    for (const patch of [{ GCLOUD_PROJECT: undefined }, { GCLOUD_PROJECT: 'production-project' },
        { GOOGLE_CLOUD_PROJECT: 'production-project' }, { FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' }]) {
        assert.throws(() => guardConfig({ ...validBinding, ...patch }), /CLINIC_EMULATOR_SAFETY_STOP/);
    }
});

test('explicit alternate ports pass the guard without SDK imports or network access', () => {
    for (const rawPort of ['1', '8081', '18080', '65535']) {
        const config = guardConfig({ ...validBinding, CLINIC_EMULATOR_PORT: rawPort,
            FIRESTORE_EMULATOR_HOST: `127.0.0.1:${rawPort}`, GOOGLE_CLOUD_PROJECT: validBinding.GCLOUD_PROJECT });
        assert.equal(config.port, Number(rawPort));
        assert.equal(config.host, `127.0.0.1:${rawPort}`);
        assert.equal(config.projectId, 'demo-clinic-reservation');
    }
});
