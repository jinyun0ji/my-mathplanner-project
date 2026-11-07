const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { assertClinicTransactionEmulatorEnvironment: guard } = require('../integration/transaction-emulator-safety.cjs');

const valid = Object.freeze({ CLINIC_EMULATOR_PORT: '18080', FIRESTORE_EMULATOR_HOST: '127.0.0.1:18080',
    GCLOUD_PROJECT: 'demo-clinic-reservation' });
const stop = /CLINIC_TRANSACTION_EMULATOR_SAFETY_STOP/;

test('transaction suite requires an explicit canonical non-8080 TCP port', () => {
    for (const port of [undefined, '', '0', '-1', '65536', '1.5', '8080', '08081', '8081 ', '8081\n', '1e4']) {
        assert.throws(() => guard({ ...valid, CLINIC_EMULATOR_PORT: port, FIRESTORE_EMULATOR_HOST: `127.0.0.1:${port}` }), stop);
    }
});
test('transaction suite accepts matching alternate ports without mutating environment', () => {
    for (const port of ['1', '8081', '18080', '65535']) {
        const env = Object.freeze({ ...valid, CLINIC_EMULATOR_PORT: port, FIRESTORE_EMULATOR_HOST: `127.0.0.1:${port}` });
        assert.deepEqual(guard(env), { host: `127.0.0.1:${port}`, port: Number(port), projectId: valid.GCLOUD_PROJECT });
    }
});
test('transaction suite rejects host mismatch, localhost, IPv6 and external services', () => {
    for (const host of [undefined, '127.0.0.1:8080', 'localhost:18080', '0.0.0.0:18080', '[::1]:18080',
        'http://127.0.0.1:18080', '127.0.0.1:18080/', 'firestore.googleapis.com:443', 'external.invalid:18080']) {
        assert.throws(() => guard({ ...valid, FIRESTORE_EMULATOR_HOST: host }), stop);
    }
});
test('transaction suite requires exact demo project and rejects a conflicting secondary project', () => {
    for (const patch of [{ GCLOUD_PROJECT: undefined }, { GCLOUD_PROJECT: 'production-project' },
        { GOOGLE_CLOUD_PROJECT: 'production-project' }]) assert.throws(() => guard({ ...valid, ...patch }), stop);
    assert.equal(guard({ ...valid, GOOGLE_CLOUD_PROJECT: valid.GCLOUD_PROJECT }).projectId, valid.GCLOUD_PROJECT);
});
test('transaction suite refuses credential files and Auth/Functions emulator bindings', () => {
    for (const patch of [{ GOOGLE_APPLICATION_CREDENTIALS: '/fictional/credential.json' },
        { FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' }, { FUNCTIONS_EMULATOR: 'true' }]) {
        assert.throws(() => guard({ ...valid, ...patch }), stop);
    }
});

function entryWithSdkFence(binding, entry = 'reservationTransactions.emulator.test.cjs') {
    const filename = path.resolve(__dirname, '../integration', entry);
    const env = { ...process.env };
    for (const name of [...Object.keys(valid), 'GOOGLE_CLOUD_PROJECT', 'GOOGLE_APPLICATION_CREDENTIALS',
        'FIREBASE_AUTH_EMULATOR_HOST', 'FUNCTIONS_EMULATOR']) delete env[name];
    Object.assign(env, binding);
    return spawnSync(process.execPath, ['-e', `
        const Module = require('node:module');
        const load = Module._load;
        Module._load = function (name, ...args) {
            if (name.startsWith('firebase')) throw new Error('SDK_IMPORT_FENCE');
            return load.call(this, name, ...args);
        };
        require(${JSON.stringify(filename)});
    `], { env, encoding: 'utf8', timeout: 5000 });
}
test('actual transaction entry rejects unsafe bindings before importing or initializing any Firebase SDK', () => {
    for (const binding of [{}, { ...valid, CLINIC_EMULATOR_PORT: undefined },
        { ...valid, CLINIC_EMULATOR_PORT: '8080', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
        { ...valid, GCLOUD_PROJECT: 'production-project' }, { ...valid, FIRESTORE_EMULATOR_HOST: 'outside.invalid:18080' }]) {
        const result = entryWithSdkFence(binding);
        assert.equal(result.error, undefined);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, stop);
        assert.doesNotMatch(result.stderr, /SDK_IMPORT_FENCE/);
    }
});
test('safe bindings reach the SDK import fence without opening a network connection', () => {
    const result = entryWithSdkFence(valid);
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0); // Deliberate SDK-import sentinel, not an emulator test run.
    assert.match(result.stderr, /SDK_IMPORT_FENCE/);
    assert.doesNotMatch(result.stderr, stop);
});
for (const entry of ['confirmationTransactions.emulator.test.cjs', 'confirmationRules.emulator.test.cjs',
    'confirmationOutbox.emulator.test.cjs', 'confirmationInboxRules.emulator.test.cjs']) {
    test(`${entry}: invalid bindings stop before SDK import; valid bindings reach only the SDK fence`, () => {
        const unsafe = entryWithSdkFence({}, entry);
        assert.equal(unsafe.error, undefined);
        assert.match(unsafe.stderr, stop);
        assert.doesNotMatch(unsafe.stderr, /SDK_IMPORT_FENCE/);
        const safe = entryWithSdkFence(valid, entry);
        assert.equal(safe.error, undefined);
        assert.match(safe.stderr, /SDK_IMPORT_FENCE/);
        assert.doesNotMatch(safe.stderr, stop);
    });
}
