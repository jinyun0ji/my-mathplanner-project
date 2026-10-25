const assert = require('node:assert/strict');
const test = require('node:test');
const { createLessonReportRecipientResolver } = require('../recipients');
const { createFakeFirestore, createFakeAuth } = require('./fakeFirestore');

const resolve = (data, uids, studentId = 'student-profile') => createLessonReportRecipientResolver({
    db: createFakeFirestore(data), auth: createFakeAuth(uids),
})({ studentId });

test('ordinary equal-ID student requires actual Auth verification', async () => {
    const result = await resolve({ 'users/student-profile': { role: 'student' } }, ['student-profile']);
    assert.deepEqual(result.recipients, [{ uid: 'student-profile', roles: ['student'] }]);
    const invalid = await resolve({ 'users/student-profile': { role: 'student' } }, []);
    assert.deepEqual(invalid.recipients, []);
    assert.equal(invalid.issues[0].reason, 'no_verified_auth_uid');
});

test('distinct profile IDs and Auth UIDs resolve from either report key', async () => {
    const data = {
        'users/student-profile': { role: 'student', authUid: 'student-auth' },
        'userAuthIndex/student-auth': { userDocId: 'student-profile' },
        'users/parent-profile': { role: 'parent', authUid: 'parent-auth', studentIds: ['student-profile'] },
    };
    for (const key of ['student-profile', 'student-auth']) {
        const result = await resolve(data, ['student-auth', 'parent-auth'], key);
        assert.deepEqual(result.recipients.map(({ uid }) => uid).sort(), ['parent-auth', 'student-auth']);
        assert.deepEqual(result.issues, []);
    }
});

test('review logins reverse-map to existing student/parent profiles without altering links', async () => {
    const data = {
        'users/student-profile': { role: 'student', authUid: 'old-student-auth' },
        'users/parent-profile': { role: 'parent', studentIds: ['student-profile'] },
        'userAuthIndex/review-student-auth': { userDocId: 'student-profile', role: 'student' },
        'userAuthIndex/review-parent-auth': { userDocId: 'parent-profile', role: 'parent' },
        'users/institute-profile': { role: 'staff' },
        'userAuthIndex/review-institute-auth': { userDocId: 'institute-profile', role: 'staff' },
    };
    const db = createFakeFirestore(data);
    const result = await createLessonReportRecipientResolver({ db, auth: createFakeAuth([
        'old-student-auth', 'review-student-auth', 'review-parent-auth', 'review-institute-auth',
    ]) })({ studentId: 'student-profile' });
    assert.deepEqual(result.recipients.map(({ uid }) => uid).sort(), ['old-student-auth', 'review-parent-auth', 'review-student-auth']);
    assert.equal(db.writes.length, 0);
    for (const [path, value] of Object.entries(data)) assert.deepEqual(db.read(path), value);
});

test('all legacy parent link fields and child-array shapes retain compatibility', async () => {
    const data = { 'users/student-profile': { role: 'student', authUid: 'student-auth',
        parentIds: ['direct-profile'], parents: [{ id: 'object-profile' }], parentUID: 'upper-auth' },
    'users/direct-profile': { role: 'parent', authUid: 'direct-auth' },
    'users/object-profile': { role: 'parent', authUid: 'object-auth' },
    'users/upper-profile': { role: 'parent', authUid: 'upper-auth' } };
    const fields = ['studentIds', 'childrenIds', 'studentDocIds', 'students', 'childIds', 'linkedStudentIds'];
    fields.forEach((field, i) => {
        data[`users/parent-${i}`] = { role: 'parent', authUid: `parent-auth-${i}`,
            [field]: [i % 3 === 0 ? 'student-profile' : i % 3 === 1 ? { id: 'student-profile' } : { path: 'users/student-profile' }] };
    });
    const uids = ['student-auth', 'direct-auth', 'object-auth', 'upper-auth', ...fields.map((_, i) => `parent-auth-${i}`)];
    const result = await resolve(data, uids);
    assert.deepEqual(result.recipients.map(({ uid }) => uid).sort(), uids.sort());
    assert.deepEqual(result.issues, []);
});

test('aliases and shared student/parent UIDs are deduplicated and roles retained', async () => {
    const result = await resolve({
        'users/student-profile': { role: 'student', authUid: 'shared-auth', uid: 'shared-auth', parentIds: ['parent-profile'] },
        'users/parent-profile': { role: 'parent', authUid: 'shared-auth', studentIds: ['student-profile'] },
    }, ['shared-auth']);
    assert.deepEqual(result.recipients, [{ uid: 'shared-auth', roles: ['parent', 'student'] }]);
});

test('a UID indexed to another profile is not borrowed; unknown parent links are reported', async () => {
    const result = await resolve({
        'users/student-profile': { role: 'student', authUid: 'wrong-auth', parentIds: ['missing-profile'] },
        'userAuthIndex/wrong-auth': { userDocId: 'other-profile' },
    }, ['wrong-auth']);
    assert.deepEqual(result.recipients, []);
    assert.equal(result.issues.length, 2);
});

test('parent scan fails explicitly at its bound instead of silently dropping recipients', async () => {
    const db = createFakeFirestore({
        'users/student-profile': { role: 'student', authUid: 'student-auth' },
        'users/p1': { role: 'parent' }, 'users/p2': { role: 'parent' },
    });
    await assert.rejects(createLessonReportRecipientResolver({ db, auth: createFakeAuth(['student-auth']), parentLimit: 1 })({ studentId: 'student-profile' }),
        { code: 'parent-lookup-limit' });
});

test('disabled Auth accounts are excluded and Auth outages never fall back to profile IDs', async () => {
    const db = createFakeFirestore({ 'users/student-profile': { role: 'student', authUid: 'student-auth' } });
    const disabled = await createLessonReportRecipientResolver({ db, auth: { getUser: async () => ({ disabled: true }) } })({ studentId: 'student-profile' });
    assert.deepEqual(disabled.recipients, []);
    assert.equal(disabled.issues[0].reason, 'no_verified_auth_uid');
    await assert.rejects(createLessonReportRecipientResolver({ db, auth: { getUser: async () => {
        throw Object.assign(new Error('Mock Auth outage'), { code: 'auth/internal-error' });
    } } })({ studentId: 'student-profile' }), { code: 'auth/internal-error' });
    assert.equal(db.writes.length, 0);
});
