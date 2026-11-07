const test = require('node:test');
const assert = require('node:assert/strict');
const { Timestamp } = require('firebase-admin/firestore');
const { setup, refAt, studentId, studentUid, parentUid } = require('./outboxFixtures.cjs');
const { createUpdateClinicReservationTime } = require('../updateClinicReservationTime');

test('student and linked parent get atomic paired inbox/receipts at real Auth UID paths, without changing confirmation', async () => {
    const c = await setup();
    const source = c.db.read(c.sourcePath);
    const history = c.db.read(c.historyPath);
    const from = c.db.writes.length;
    const result = await c.process();
    assert.equal(result.state, 'completed');
    assert.equal(result.newItemCount, 2);
    for (const uid of [studentUid, parentUid]) {
        const inbox = c.db.read(c.inboxPath(uid));
        const receipt = c.db.read(c.receiptPath(uid));
        assert.equal(inbox.title, '클리닉 예약 완료');
        assert.equal(inbox.body, '2030-02-01 14:00');
        assert.equal(inbox.eventKey, c.eventKey);
        assert.equal(inbox.ref, c.sourcePath);
        assert.equal(inbox.studentId, studentId);
        assert.equal(inbox.recipientAuthUid, uid);
        assert.equal(inbox.isRead, false);
        assert.equal(receipt.inboxPath, c.inboxPath(uid));
        assert.equal(receipt.inboxState, 'created');
        assert.equal(receipt.pushState, 'pending');
        assert.equal(receipt.pushAttempts, 0);
    }
    assert.equal(c.db.paths().some((path) => path.startsWith(`notifications/${studentId}/`)), false);
    assert.deepEqual(c.db.read(c.sourcePath), source);
    assert.deepEqual(c.db.read(c.historyPath), history);
    assert.ok(c.db.writes.slice(from).every((write) => write.path.startsWith('notifications/')
        || write.path.startsWith('clinicConfirmationDeliveries/') || write.path === c.jobPath));
});
test('legacy clinicLogs source remains exact in every inbox', async () => {
    const c = await setup({ source: 'clinicLogs' });
    assert.equal((await c.process()).state, 'completed');
    assert.equal(c.db.read(c.inboxPath(studentUid)).refCollection, 'clinicLogs');
});
test('concurrent workers claim once; inbox and receipt counts stay unique', async () => {
    const c = await setup();
    const results = await Promise.all([c.process(), c.process()]);
    assert.deepEqual(results.map((result) => result.state).sort(), ['busy', 'completed']);
    assert.equal(c.db.paths().filter((path) => path.startsWith('notifications/')).length, 2);
    assert.equal(c.db.paths().filter((path) => path.startsWith('clinicConfirmationDeliveries/')).length, 2);
    assert.equal(c.db.read(c.jobPath).attempts, 1);
});
test('retry preserves readAt/isRead/createdAt and future accepted/unknown push receipts', async () => {
    const c = await setup();
    await c.process();
    await c.mutate(c.inboxPath(studentUid), { isRead: true, readAt: c.now() });
    await c.mutate(c.receiptPath(studentUid), { pushState: 'accepted', pushAttempts: 1, pushAcceptedAt: c.now() });
    await c.mutate(c.receiptPath(parentUid), { pushState: 'unknown', pushAttempts: 1 });
    const documents = [c.inboxPath(studentUid), c.inboxPath(parentUid), c.receiptPath(studentUid), c.receiptPath(parentUid)]
        .map((path) => [path, c.db.read(path)]);
    await c.mutate(c.jobPath, { state: 'partial', nextAttemptAt: null });
    c.advance();
    const result = await c.process();
    assert.equal(result.state, 'completed');
    assert.equal(result.newItemCount, 0);
    for (const [path, data] of documents) assert.deepEqual(c.db.read(path), data);
});
test('OFF defers without Auth/inbox work, preserving confirmation; retry when due resumes', async () => {
    const c = await setup();
    const source = c.db.read(c.sourcePath);
    const history = c.db.read(c.historyPath);
    c.enable(false);
    assert.equal((await c.process()).state, 'deferred');
    assert.equal(c.authCalls.length, 0);
    assert.equal(c.db.paths().some((path) => path.startsWith('notifications/')), false);
    assert.equal(c.db.read(c.jobPath).attempts, 0);
    assert.ok(c.db.read(c.jobPath).nextAttemptAt instanceof Timestamp);
    c.enable(true);
    assert.equal((await c.process()).state, 'not_due');
    c.advance();
    assert.equal((await c.process()).state, 'completed');
    assert.deepEqual(c.db.read(c.sourcePath), source);
    assert.deepEqual(c.db.read(c.historyPath), history);
});
test('OFF after claim and recipient lookup creates no inbox, including any test-UID exception', async () => {
    const c = await setup();
    const result = await c.process({ resolveRecipients: async (input) => {
        const resolution = await c.resolve(input); c.enable(false); return resolution;
    } });
    assert.equal(result.state, 'deferred');
    assert.equal(c.db.paths().some((path) => path.startsWith('notifications/')), false);
});
test('old owner is fenced after lease expiry and replacement owner completion', async () => {
    const c = await setup({ options: { leaseMs: 1000 } });
    let notify;
    let resume;
    const claimed = new Promise((resolve) => { notify = resolve; });
    const wait = new Promise((resolve) => { resume = resolve; });
    const first = c.process({ resolveRecipients: async (input) => {
        const resolution = await c.resolve(input); notify(); await wait; return resolution;
    } });
    await claimed;
    const owner = c.db.read(c.jobPath).owner;
    assert.equal((await c.process()).state, 'busy');
    c.advance(1001);
    assert.equal((await c.process()).state, 'completed');
    const saved = c.db.read(c.jobPath);
    assert.equal(saved.owner, null);
    assert.equal(saved.attempts, 2);
    assert.ok(owner);
    const writes = c.db.writes.length;
    resume();
    assert.equal((await first).state, 'lease_lost');
    assert.equal(c.db.writes.length, writes);
    assert.deepEqual(c.db.read(c.jobPath), saved);
});
test('expired owner cannot publish even when no replacement worker has claimed yet', async () => {
    const c = await setup({ options: { leaseMs: 1000 } });
    const result = await c.process({ resolveRecipients: async (input) => {
        const resolution = await c.resolve(input); c.advance(1001); return resolution;
    } });
    assert.equal(result.state, 'lease_lost');
    assert.equal(c.db.read(c.inboxPath(studentUid)), undefined);
    assert.equal((await c.process()).state, 'completed');
});
for (const patch of [{ reservationRevision: 1 }, { status: 'cancelled' }, { status: 'completed' },
    { status: 'no-show' }, { status: 'noshow' }, { checkIn: '14:00' }, { isDeleted: true },
    { confirmationStatus: 'reconfirmation_required' }, { date: '2030-02-02' }, { confirmedBy: 'different-actor' }]) {
    test(`obsolete or inactive reservation is superseded: ${JSON.stringify(patch)}`, async () => {
        const c = await setup();
        await c.mutate(c.sourcePath, patch);
        assert.equal((await c.process()).state, 'superseded');
        assert.equal(c.db.read(c.inboxPath(studentUid)), undefined);
        assert.equal(c.authCalls.length, 0);
    });
}
test('past start time supersedes work', async () => {
    const c = await setup(); c.advance(32 * 86400000);
    assert.equal((await c.process()).state, 'superseded');
});
test('actual 2-A time update during recipient resolution prevents old revision publication', async () => {
    const c = await setup();
    const update = createUpdateClinicReservationTime({ db: c.db, auth: c.auth, now: c.now });
    const result = await c.process({ resolveRecipients: async (input) => {
        const resolution = await c.resolve(input);
        await update({ ...c.item, date: '2030-02-02', plannedTime: '15:00' }, c.context);
        return resolution;
    } });
    assert.equal(result.state, 'superseded');
    assert.equal(c.db.read(c.inboxPath(studentUid)), undefined);
    assert.equal(c.db.read(c.sourcePath).reservationRevision, 1);
});
test('binding or parent link changes between lookup and creation skip affected parent and preserve normal student', async () => {
    const c = await setup();
    const result = await c.process({ resolveRecipients: async (input) => {
        const resolution = await c.resolve(input);
        await c.mutate('users/fictional-parent-doc', { studentIds: [] });
        return resolution;
    } });
    assert.equal(result.state, 'partial');
    assert.ok(c.db.read(c.inboxPath(studentUid)));
    assert.equal(c.db.read(c.inboxPath(parentUid)), undefined);
    assert.equal(result.issueCount, 1);
});
test('rejected inbox transaction rolls back pairs and retry succeeds without resetting attempts', async () => {
    const c = await setup();
    const result = await c.process({ resolveRecipients: async (input) => {
        const resolution = await c.resolve(input); c.db.failNextCommit(); return resolution;
    } });
    assert.equal(result.state, 'partial');
    assert.equal(c.db.read(c.inboxPath(studentUid)), undefined);
    assert.equal(c.db.read(c.receiptPath(studentUid)), undefined);
    assert.equal(c.db.read(c.inboxPath(parentUid)), undefined);
    c.advance();
    assert.equal((await c.process()).state, 'completed');
    assert.equal(c.db.read(c.jobPath).attempts, 2);
});
test('partial batches survive a later commit failure and are reused on retry', async () => {
    const c = await setup({ options: { batchSize: 1 } });
    const run = c.db.runTransaction;
    let calls = 0;
    c.db.runTransaction = async (callback) => {
        if (++calls === 3) c.db.failNextCommit(); // claim, student, then parent.
        return run(callback);
    };
    assert.equal((await c.process()).state, 'partial');
    const saved = c.db.read(c.inboxPath(studentUid));
    assert.ok(saved);
    assert.equal(c.db.read(c.inboxPath(parentUid)), undefined);
    c.db.runTransaction = run;
    c.advance();
    assert.equal((await c.process()).state, 'completed');
    assert.deepEqual(c.db.read(c.inboxPath(studentUid)), saved);
});
test('transient Auth errors permit normal recipient then safe retry of missing UID', async () => {
    const c = await setup();
    c.failures.set(parentUid, 'auth/internal-error');
    const first = await c.process();
    assert.equal(first.state, 'partial');
    assert.ok(c.db.read(c.inboxPath(studentUid)));
    assert.equal(c.db.read(c.inboxPath(parentUid)), undefined);
    assert.ok(c.db.read(c.jobPath).recipientResolution.issues.some((issue) => issue.retryable));
    c.failures.clear(); c.advance();
    assert.equal((await c.process()).state, 'completed');
    assert.equal(c.db.paths().filter((path) => path.startsWith('notifications/')).length, 2);
});
test('unpaired preexisting inbox fails closed; normal recipients still publish', async () => {
    const c = await setup();
    await c.db.runTransaction(async (tx) => { tx.create(refAt(c.db, c.inboxPath(parentUid)), { isRead: true, marker: 'preserve' }); });
    assert.equal((await c.process()).state, 'partial');
    assert.deepEqual(c.db.read(c.inboxPath(parentUid)), { isRead: true, marker: 'preserve' });
    assert.equal(c.db.read(c.receiptPath(parentUid)), undefined);
    assert.ok(c.db.read(c.inboxPath(studentUid)));
});
test('global lookup failure is recorded without consuming or changing confirmation', async () => {
    const c = await setup();
    const source = c.db.read(c.sourcePath);
    const result = await c.process({ resolveRecipients: async () => { throw Object.assign(new Error('Injected lookup outage'), { code: 'unavailable' }); } });
    assert.equal(result.state, 'partial');
    assert.equal(c.db.read(c.jobPath).lastError.code, 'recipient_lookup_failed');
    assert.deepEqual(c.db.read(c.sourcePath), source);
    assert.equal(c.db.read(c.inboxPath(studentUid)), undefined);
});
test('owner replacement after staged inbox writes forces transaction retry and fences the old owner', async () => {
    const c = await setup();
    const run = c.db.runTransaction;
    let calls = 0;
    let replaced = false;
    c.db.runTransaction = (callback) => {
        const publication = ++calls === 2;
        return run(async (tx) => {
            const result = await callback(tx);
            if (publication && !replaced) {
                replaced = true;
                await run(async (other) => { other.update(refAt(c.db, c.jobPath), {
                    owner: 'fictional-replacement-owner', leaseUntil: Timestamp.fromMillis(c.now().toMillis() + 120000), state: 'processing' }); });
            }
            return result;
        });
    };
    assert.equal((await c.process()).state, 'lease_lost');
    assert.equal(c.db.read(c.inboxPath(studentUid)), undefined);
    assert.equal(c.db.read(c.receiptPath(parentUid)), undefined);
    assert.equal(c.db.read(c.jobPath).owner, 'fictional-replacement-owner');
});
test('source change after publication reads forces retry, supersedes the event and rolls back staged inboxes', async () => {
    const c = await setup();
    const run = c.db.runTransaction;
    let calls = 0;
    let changed = false;
    c.db.runTransaction = (callback) => {
        const publication = ++calls === 2;
        return run(async (tx) => {
            const result = await callback(tx);
            if (publication && !changed) {
                changed = true;
                await run(async (other) => { other.update(refAt(c.db, c.sourcePath), { reservationRevision: 1, confirmationStatus: 'reconfirmation_required' }); });
            }
            return result;
        });
    };
    assert.equal((await c.process()).state, 'superseded');
    assert.equal(c.db.read(c.inboxPath(studentUid)), undefined);
    assert.equal(c.db.read(c.receiptPath(parentUid)), undefined);
});
test('lost publication acknowledgement retries paired records without a second creation', async () => {
    const c = await setup();
    const run = c.db.runTransaction;
    let calls = 0;
    c.db.runTransaction = async (callback) => {
        const publication = ++calls === 2;
        const result = await run(callback);
        if (publication) throw Object.assign(new Error('Lost commit response'), { code: 'unavailable' });
        return result;
    };
    assert.equal((await c.process()).state, 'partial');
    const sourceInbox = c.db.read(c.inboxPath(studentUid));
    const receipt = c.db.read(c.receiptPath(studentUid));
    assert.ok(sourceInbox);
    c.db.runTransaction = run; c.advance();
    const result = await c.process();
    assert.equal(result.state, 'completed');
    assert.equal(result.newItemCount, 0);
    assert.deepEqual(c.db.read(c.inboxPath(studentUid)), sourceInbox);
    assert.deepEqual(c.db.read(c.receiptPath(studentUid)), receipt);
});
test('delivery identity conflict preserves existing receipt and remaining good recipients', async () => {
    const c = await setup();
    await c.process();
    await c.mutate(c.receiptPath(parentUid), { eventKey: 'fictional-wrong-event' });
    const saved = c.db.read(c.receiptPath(parentUid));
    await c.mutate(c.jobPath, { state: 'partial', nextAttemptAt: null });
    const result = await c.process();
    assert.equal(result.state, 'partial');
    assert.equal(result.newItemCount, 0);
    assert.deepEqual(c.db.read(c.receiptPath(parentUid)), saved);
    assert.ok(c.db.read(c.inboxPath(studentUid)));
});
test('recipient cap fails explicitly and does not truncate into a false completed result', async () => {
    const c = await setup({ options: { maxRecipients: 1 } });
    assert.equal((await c.process()).reason, 'recipient_limit_exceeded');
    assert.equal(c.db.read(c.inboxPath(studentUid)), undefined);
});
test('zero verified recipients remains partial and never falls back to profile ID', async () => {
    const c = await setup({ accounts: { [studentUid]: null, [parentUid]: null } });
    const result = await c.process();
    assert.equal(result.state, 'partial');
    assert.equal(result.reason, 'no_recipients');
    assert.equal(c.db.paths().some((path) => path.startsWith('notifications/')), false);
});
test('oversized historical result maps do not exceed document/request budgets', async () => {
    const c = await setup();
    await c.mutate(c.jobPath, { recipientResults: Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`uid-${i}`, { reason: 'x'.repeat(400) }])) });
    const result = await c.process();
    assert.equal(result.state, 'partial');
    assert.equal(result.reason, 'atomic_payload_limit');
    assert.equal(c.db.read(c.inboxPath(studentUid)), undefined);
});
test('many recipients are written in bounded paired batches below transaction write limits', async () => {
    const extra = {};
    const accounts = {};
    for (let i = 0; i < 60; i++) {
        extra[`users/fictional-extra-parent-${i}`] = { role: 'parent', authUid: `fictional-extra-auth-${i}`, studentIds: [studentId] };
        extra[`userAuthIndex/fictional-extra-auth-${i}`] = { userDocId: `fictional-extra-parent-${i}` };
        accounts[`fictional-extra-auth-${i}`] = {};
    }
    const c = await setup({ extra, accounts });
    const run = c.db.runTransaction;
    const commitSizes = [];
    c.db.runTransaction = async (callback) => {
        const before = c.db.writes.length;
        const result = await run(callback);
        commitSizes.push(c.db.writes.length - before);
        return result;
    };
    const result = await c.process();
    assert.equal(result.state, 'completed');
    assert.equal(result.targetCount, 62);
    assert.equal(c.db.paths().filter((path) => path.startsWith('notifications/')).length, 62);
    assert.equal(c.db.paths().filter((path) => path.startsWith('clinicConfirmationDeliveries/')).length, 62);
    assert.ok(commitSizes.every((count) => count <= 51)); // <= 25 inbox + 25 receipts + 1 job update.
});
test('actual server flag OFF never inherits the FCM test UID bypass', async () => {
    const names = ['NOTIFICATION_SENDING_ENABLED', 'NOTIFICATION_TEST_UID'];
    const old = names.map((name) => process.env[name]);
    process.env.NOTIFICATION_SENDING_ENABLED = 'false';
    process.env.NOTIFICATION_TEST_UID = studentUid;
    try {
        const c = await setup();
        assert.equal((await c.process({ sendingEnabled: undefined })).state, 'deferred');
        assert.equal(c.db.read(c.inboxPath(studentUid)), undefined);
    } finally {
        names.forEach((name, i) => { if (old[i] === undefined) delete process.env[name]; else process.env[name] = old[i]; });
    }
});
test('invalid event references cannot redirect publication to arbitrary collections', async () => {
    const c = await setup();
    await c.mutate(c.jobPath, { sourceCollection: 'users', sourcePath: `users/${studentId}` });
    assert.equal((await c.process()).reason, 'invalid_outbox');
    assert.equal(c.db.read(c.inboxPath(studentUid)), undefined);
});
