'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const { assertEmulatorEnvironment } = require('./emulator-safety.cjs');

test('missing or different emulator/project bindings fail closed', () => {
    for (const environment of [
        {},
        { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
        { GCLOUD_PROJECT: 'demo-lesson-report' },
        { FIRESTORE_EMULATOR_HOST: 'localhost:8080', GCLOUD_PROJECT: 'demo-lesson-report' },
        { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', GCLOUD_PROJECT: 'another-project' },
        { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', GCLOUD_PROJECT: 'demo-lesson-report', GOOGLE_CLOUD_PROJECT: 'another-project' },
    ]) assert.throws(() => assertEmulatorEnvironment(environment), /EMULATOR_SAFETY_STOP/);
});

test('exact demo/loopback bindings are accepted without changing environment', () => {
    const environment = Object.freeze({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', GCLOUD_PROJECT: 'demo-lesson-report' });
    assert.deepEqual(assertEmulatorEnvironment(environment), { host: '127.0.0.1:8080', projectId: 'demo-lesson-report' });
});

test('integration entry point stops before SDK imports when bindings are absent', () => {
    const environment = { ...process.env };
    delete environment.FIRESTORE_EMULATOR_HOST;
    delete environment.GCLOUD_PROJECT;
    const script = `
        const Module = require('node:module');
        const load = Module._load;
        Module._load = function (name, ...args) {
            if (name.startsWith('firebase-')) throw new Error('UNEXPECTED_FIREBASE_IMPORT');
            return load.call(this, name, ...args);
        };
        require(${JSON.stringify(require.resolve('./dispatch.emulator.test.js'))});
    `;
    const result = spawnSync(process.execPath, ['-e', script], { env: environment, encoding: 'utf8', timeout: 5000 });
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /EMULATOR_SAFETY_STOP/);
    assert.doesNotMatch(result.stderr, /UNEXPECTED_FIREBASE_IMPORT/);
});
