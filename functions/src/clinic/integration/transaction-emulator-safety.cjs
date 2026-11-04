// No Firebase imports, environment mutations or connections in this module.
function assertClinicTransactionEmulatorEnvironment(env) {
    const rawPort = env.CLINIC_EMULATOR_PORT;
    const port = Number(rawPort);
    const projectId = 'demo-clinic-reservation';
    if (typeof rawPort !== 'string' || !/^[1-9]\d{0,4}$/.test(rawPort)
        || !Number.isInteger(port) || port > 65535 || String(port) !== rawPort || port === 8080
        || env.FIRESTORE_EMULATOR_HOST !== `127.0.0.1:${rawPort}`
        || env.GCLOUD_PROJECT !== projectId
        || (env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_CLOUD_PROJECT !== projectId)
        || env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_AUTH_EMULATOR_HOST
        || env.FUNCTIONS_EMULATOR === 'true') {
        throw new Error('CLINIC_TRANSACTION_EMULATOR_SAFETY_STOP: explicit non-8080 loopback port, exact demo project, no credentials/Auth/Functions emulator required.');
    }
    return Object.freeze({ host: `127.0.0.1:${rawPort}`, port, projectId });
}

module.exports = { assertClinicTransactionEmulatorEnvironment };
