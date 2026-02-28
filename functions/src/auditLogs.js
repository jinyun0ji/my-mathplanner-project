const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function buildAuditDoc({ collectionName, docId, change, context }) {
    const beforeExists = change.before.exists;
    const afterExists = change.after.exists;

    let op = 'update';
    if (!beforeExists && afterExists) op = 'create';
    else if (beforeExists && !afterExists) op = 'delete';

    const before = beforeExists ? change.before.data() : null;
    const after = afterExists ? change.after.data() : null;

    const sanitize = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        const copy = { ...obj };
        delete copy.memo;
        delete copy.comment;
        delete copy.notes;
        delete copy.note;
        return copy;
    };

    return {
        op,
        target: { collection: collectionName, id: docId },
        actorUid: (after && (after.updatedBy || after.createdBy)) || (before && (before.updatedBy || before.createdBy)) || null,
        at: admin.firestore.FieldValue.serverTimestamp(),
        before: sanitize(before),
        after: sanitize(after),
        meta: {
            function: context?.eventType || '',
            eventId: context?.eventId || '',
        },
    };
}

async function writeAudit(collectionName, change, context) {
    const docId = context.params.docId;
    const audit = buildAuditDoc({ collectionName, docId, change, context });

    if (audit.op === 'update') {
        const before = JSON.stringify(audit.before || {});
        const after = JSON.stringify(audit.after || {});
        if (before === after) return null;
    }

    return db.collection('auditLogs').add(audit);
}

exports.auditClinicLogs = functions.region('us-central1')
    .firestore.document('clinicLogs/{docId}')
    .onWrite((change, context) => writeAudit('clinicLogs', change, context));

exports.auditAttendanceLogs = functions.region('us-central1')
    .firestore.document('attendanceLogs/{docId}')
    .onWrite((change, context) => writeAudit('attendanceLogs', change, context));

exports.auditHomeworkResults = functions.region('us-central1')
    .firestore.document('homeworkResults/{docId}')
    .onWrite((change, context) => writeAudit('homeworkResults', change, context));

exports.auditGrades = functions.region('us-central1')
    .firestore.document('grades/{docId}')
    .onWrite((change, context) => writeAudit('grades', change, context));

exports.auditPayments = functions.region('us-central1')
    .firestore.document('payments/{docId}')
    .onWrite((change, context) => writeAudit('payments', change, context));