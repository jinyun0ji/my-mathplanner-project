'use strict';

const EXPECTED_HOST = '127.0.0.1:8080';
const EXPECTED_PROJECT = 'demo-lesson-report';

// No SDK imports, environment mutation, credential access or network before this.
function assertEmulatorEnvironment(environment = process.env) {
    if (environment.FIRESTORE_EMULATOR_HOST !== EXPECTED_HOST
        || environment.GCLOUD_PROJECT !== EXPECTED_PROJECT) {
        throw new Error('EMULATOR_SAFETY_STOP: require FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 and GCLOUD_PROJECT=demo-lesson-report; refusing to initialize Firebase or run integration tests.');
    }
    if (environment.GOOGLE_CLOUD_PROJECT && environment.GOOGLE_CLOUD_PROJECT !== EXPECTED_PROJECT) {
        throw new Error('EMULATOR_SAFETY_STOP: conflicting GOOGLE_CLOUD_PROJECT.');
    }
    return Object.freeze({ host: EXPECTED_HOST, projectId: EXPECTED_PROJECT });
}

module.exports = { assertEmulatorEnvironment };
