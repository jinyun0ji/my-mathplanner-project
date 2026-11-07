const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, studentId, studentUid, parentUid } = require('./outboxFixtures.cjs');
const { createClinicConfirmationRecipientResolver } = require('../confirmationRecipients');

const targetUids = (resolution) => resolution.recipients.map((item) => item.uid).sort();
test('normal student and parent resolve to actual Auth UIDs; document IDs are not fallback recipients', async () => {
    const c = await setup();
    const result = await c.resolve({ studentProfileDocId: studentId });
    assert.deepEqual(targetUids(result), [parentUid, studentUid].sort());
    assert.equal(result.issues.length, 0);
    assert.ok(result.recipients.every((item) => item.evidence.length > 0));
    assert.ok(c.authCalls.includes(studentId)); // Equal-ID candidates still require actual Auth proof.
    assert.ok(!result.recipients.some((item) => item.uid === studentId));
});
test('multiple parents and verified review/legacy Auth accounts are supported and deduplicated', async () => {
    const c = await setup({ extra: {
        [`users/${studentId}`]: { role: 'student', authUid: studentUid, userUid: 'fictional-old-auth',
            parentIds: ['fictional-parent-doc', 'fictional-parent-doc', 'second-parent-doc'] },
        'userAuthIndex/fictional-review-auth': { userDocId: studentId },
        'users/second-parent-doc': { role: 'parent', authUid: 'second-parent-auth', childrenIds: [{ id: studentId }] },
        'userAuthIndex/second-parent-auth': { userDocId: 'second-parent-doc' },
        'userAuthIndex/parent-review-auth': { userDocId: 'fictional-parent-doc' },
    }, accounts: { 'fictional-review-auth': {}, 'fictional-old-auth': {}, 'second-parent-auth': {}, 'parent-review-auth': {} } });
    const result = await c.resolve({ studentProfileDocId: studentId });
    assert.deepEqual(targetUids(result), [studentUid, parentUid, 'fictional-review-auth', 'fictional-old-auth', 'second-parent-auth', 'parent-review-auth'].sort());
    assert.equal(result.issues.length, 0);
    assert.equal(new Set(result.recipients.map((item) => item.uid)).size, result.recipients.length);
    assert.ok(c.authCalls.filter((uid) => uid === parentUid).length === 1);
});
test('Auth-verified legacy equal IDs work, with no invented UID for unlinked students', async () => {
    const c = await setup({ extra: { [`users/${studentId}`]: { role: 'student' } },
        remove: [`userAuthIndex/${studentUid}`], accounts: { [studentId]: {} } });
    const valid = await c.resolve({ studentProfileDocId: studentId });
    assert.ok(targetUids(valid).includes(studentId));
    c.records.delete(studentId);
    const absent = await c.resolve({ studentProfileDocId: studentId });
    assert.deepEqual(targetUids(absent), [parentUid]);
    assert.ok(absent.issues.some((issue) => issue.reason === 'no_verified_auth_uid'));
});
test('inactive profiles and disabled Auth accounts are excluded per recipient without blocking active family', async () => {
    const c = await setup({ extra: { 'users/fictional-parent-doc': { role: 'parent', active: false, authUid: parentUid, studentIds: [studentId] } } });
    let result = await c.resolve({ studentProfileDocId: studentId });
    assert.deepEqual(targetUids(result), [studentUid]);
    assert.ok(result.excluded.some((item) => item.reason === 'profile_inactive'));
    assert.ok(!c.authCalls.includes(parentUid));
    await c.mutate('users/fictional-parent-doc', { active: true });
    c.records.set(studentUid, { disabled: true });
    result = await c.resolve({ studentProfileDocId: studentId });
    assert.deepEqual(targetUids(result), [parentUid]);
    assert.ok(result.excluded.some((item) => item.reason === 'auth_disabled' && item.uid === studentUid));
    assert.equal((await c.process()).state, 'completed'); // Policy exclusion is not an unresolved lookup error.
});
test('an inactive student login is excluded while a separately active connected parent remains eligible', async () => {
    const c = await setup();
    await c.mutate(`users/${studentId}`, { active: false });
    const result = await c.resolve({ studentProfileDocId: studentId });
    assert.deepEqual(targetUids(result), [parentUid]);
});
test('wrong index binding is not borrowed; normal student survives partial parent failure', async () => {
    const c = await setup({ extra: { [`userAuthIndex/${parentUid}`]: { userDocId: 'different-parent-doc' } } });
    const result = await c.resolve({ studentProfileDocId: studentId });
    assert.deepEqual(targetUids(result), [studentUid]);
    assert.ok(result.issues.some((item) => item.reason === 'auth_binding_conflict'));
    const delivery = await c.process();
    assert.equal(delivery.state, 'partial');
    assert.ok(c.db.read(c.inboxPath(studentUid)));
    assert.equal(c.db.read(c.inboxPath(parentUid)), undefined);
});
test('two profiles claiming one unindexed Auth UID are an error, not an arbitrary choice', async () => {
    const c = await setup({ remove: [`userAuthIndex/${parentUid}`], extra: {
        'users/another-profile': { role: 'parent', authUid: parentUid, studentIds: [studentId] },
    } });
    const result = await c.resolve({ studentProfileDocId: studentId });
    assert.deepEqual(targetUids(result), [studentUid]);
    assert.ok(result.issues.some((item) => item.reason === 'ambiguous_auth_binding'));
});
test('explicit forward index keeps the rightful UID and excludes a conflicting duplicate profile', async () => {
    const c = await setup({ extra: {
        'users/conflicting-parent': { role: 'parent', authUid: studentUid, studentIds: [studentId] },
    } });
    const result = await c.resolve({ studentProfileDocId: studentId });
    assert.deepEqual(targetUids(result), [studentUid, parentUid].sort());
    assert.ok(result.issues.some((item) => item.reason === 'auth_binding_conflict'));
});
test('stale direct-parent link contradicting an explicit child unlink is excluded', async () => {
    const c = await setup({ extra: {
        [`users/${studentId}`]: { role: 'student', authUid: studentUid, parentIds: ['fictional-parent-doc'] },
        'users/fictional-parent-doc': { role: 'parent', authUid: parentUid, studentIds: [] },
    } });
    const result = await c.resolve({ studentProfileDocId: studentId });
    assert.deepEqual(targetUids(result), [studentUid]);
    assert.ok(result.issues.some((item) => item.reason === 'parent_link_conflict'));
});
test('explicit empty student parent list conflicts with remaining reverse link; no guess is made', async () => {
    const c = await setup({ extra: { [`users/${studentId}`]: { role: 'student', authUid: studentUid, parentIds: [] } } });
    const result = await c.resolve({ studentProfileDocId: studentId });
    assert.deepEqual(targetUids(result), [studentUid]);
    assert.ok(result.issues.some((item) => item.reason === 'parent_link_conflict'));
});
test('missing, wrong-role and ambiguous direct parent references are recorded individually', async () => {
    const c = await setup({ extra: {
        [`users/${studentId}`]: { role: 'student', authUid: studentUid, parentIds: ['missing-parent', 'wrong-role', 'ambiguous-alias'] },
        'users/wrong-role': { role: 'staff', authUid: 'not-a-parent' },
        'users/ambiguous-one': { role: 'parent', userUid: 'ambiguous-alias' },
        'users/ambiguous-two': { role: 'parent', userUid: 'ambiguous-alias' },
    } });
    const result = await c.resolve({ studentProfileDocId: studentId });
    assert.deepEqual(targetUids(result), [studentUid]);
    for (const reason of ['parent_link_not_found', 'invalid_parent_role', 'profile_reference_conflict']) {
        assert.ok(result.issues.some((item) => item.reason === reason), reason);
    }
});
test('parent-only direct link supports verified profiles without a reverse child array', async () => {
    const c = await setup({ extra: {
        [`users/${studentId}`]: { role: 'student', authUid: studentUid, parentAuthUids: [parentUid] },
        'users/fictional-parent-doc': { role: 'parent', authUid: parentUid },
    } });
    assert.deepEqual(targetUids(await c.resolve({ studentProfileDocId: studentId })), [studentUid, parentUid].sort());
});
test('Auth outage is distinct from missing account, disabled account and disconnected parent', async () => {
    const c = await setup();
    c.failures.set(parentUid, 'auth/internal-error');
    let result = await c.resolve({ studentProfileDocId: studentId });
    assert.ok(result.issues.some((item) => item.reason === 'auth_or_binding_lookup_failed' && item.retryable));
    c.failures.clear(); c.records.delete(parentUid);
    result = await c.resolve({ studentProfileDocId: studentId });
    assert.ok(result.issues.some((item) => item.reason === 'auth_user_not_found' && !item.retryable));
    await c.mutate('users/fictional-parent-doc', { studentIds: [] });
    result = await c.resolve({ studentProfileDocId: studentId });
    assert.deepEqual(targetUids(result), [studentUid]);
    assert.equal(result.issues.length, 0);
});
test('parent scan and Auth request budgets fail partially rather than silently truncate recipients', async () => {
    const c = await setup({ extra: { 'users/other-parent': { role: 'parent', authUid: 'other-auth' } } });
    const bounded = createClinicConfirmationRecipientResolver({ db: c.db, auth: c.auth, parentLimit: 1 });
    let result = await bounded({ studentProfileDocId: studentId });
    assert.deepEqual(targetUids(result), [studentUid]);
    assert.ok(result.issues.some((item) => item.reason === 'parent_lookup_limit'));
    const authBudget = createClinicConfirmationRecipientResolver({ db: c.db, auth: c.auth, maxAuthLookups: 1 });
    result = await authBudget({ studentProfileDocId: studentId });
    assert.ok(result.issues.some((item) => item.reason === 'auth_lookup_limit'));
});
