const { Timestamp } = require('firebase-admin/firestore');
const { createFakeFirestore } = require('./fakeFirestore.cjs');
const { createClinicConfirmationService, confirmationEventKey } = require('../confirmationService');
const { createClinicConfirmationOutboxService, notificationIdFor } = require('../confirmationOutbox');
const { createClinicConfirmationRecipientResolver } = require('../confirmationRecipients');

const studentId = 'fictional-student-doc';
const studentUid = 'fictional-student-auth';
const parentUid = 'fictional-parent-auth';
const context = { auth: { uid: 'fictional-staff-auth' } };
const refAt = (db, path) => {
    const parts = path.split('/');
    let ref = db.collection(parts[0]).doc(parts[1]);
    for (let i = 2; i < parts.length; i += 2) ref = ref.collection(parts[i]).doc(parts[i + 1]);
    return ref;
};
async function setup({ extra = {}, remove = [], accounts = {}, source = 'clinicReservations', options = {} } = {}) {
    const initial = {
        'users/fictional-staff-doc': { role: 'staff', authUid: context.auth.uid },
        [`userAuthIndex/${context.auth.uid}`]: { userDocId: 'fictional-staff-doc' },
        [`users/${studentId}`]: { role: 'student', authUid: studentUid },
        [`userAuthIndex/${studentUid}`]: { userDocId: studentId },
        'users/fictional-parent-doc': { role: 'parent', authUid: parentUid, studentIds: [studentId] },
        [`userAuthIndex/${parentUid}`]: { userDocId: 'fictional-parent-doc' },
        [`${source}/booking`]: { studentDocId: studentId, date: '2030-02-01', plannedTime: '14:00', status: 'pending', comment: 'keep' },
        ...extra,
    };
    remove.forEach((path) => delete initial[path]);
    const db = createFakeFirestore(initial);
    const records = new Map(Object.entries({ [studentUid]: {}, [parentUid]: {}, ...accounts }));
    const failures = new Map();
    const authCalls = [];
    const auth = { getUser: async (uid) => {
        authCalls.push(uid);
        if (failures.has(uid)) throw Object.assign(new Error('Fictional injected Auth failure'), { code: failures.get(uid) });
        if (!records.has(uid) || records.get(uid) === null) throw Object.assign(new Error('No fictional Auth account'), { code: 'auth/user-not-found' });
        return { uid, disabled: false, ...records.get(uid) };
    } };
    let millis = Date.parse('2030-01-01T00:00:00Z');
    let enabled = true;
    const now = () => Timestamp.fromMillis(millis);
    const item = { sourceCollection: source, reservationId: 'booking', expectedRevision: 0 };
    const confirmation = await createClinicConfirmationService({ db, now, serverTimestamp: now }).confirmReservations({ reservations: [item] }, context);
    if (confirmation.results[0].status !== 'confirmed') throw new Error(JSON.stringify(confirmation));
    const eventKey = confirmationEventKey(item);
    const jobPath = `clinicConfirmationOutbox/${eventKey}`;
    const historyPath = `clinicReservationConfirmations/${eventKey}`;
    const base = { db, auth, now, sendingEnabled: () => enabled, ...options };
    const service = (overrides = {}) => createClinicConfirmationOutboxService({ ...base, ...overrides });
    return { db, auth, records, failures, authCalls, now, eventKey, jobPath, historyPath,
        sourcePath: `${source}/booking`, item, context, service,
        process: (overrides) => service(overrides).process(eventKey),
        resolve: createClinicConfirmationRecipientResolver({ db, auth }),
        advance: (ms = 30001) => { millis += ms; }, enable: (value) => { enabled = value; },
        inboxPath: (uid) => `notifications/${uid}/items/${notificationIdFor(eventKey, uid)}`,
        receiptPath: (uid) => `clinicConfirmationDeliveries/${notificationIdFor(eventKey, uid)}`,
        mutate: (path, patch) => db.runTransaction(async (tx) => { tx.update(refAt(db, path), patch); }),
    };
}

module.exports = { setup, refAt, studentId, studentUid, parentUid };
