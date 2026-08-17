const assert = require('node:assert/strict');
const test = require('node:test');
const { initializeApp } = require('firebase-admin/app');

initializeApp({ projectId: 'identity-resolver-test' });

const {
    createUserIdentityResolver,
} = require('../resolveUserIdentity');
const { createStudentRecipientResolver } = require('../../notify/recipients');
const { buildReservationIdentity } = require('../../clinic/createClinicReservation');
const { resolveChatRecipientAuthUids } = require('../../triggers/chatMessages');

const profiles = {
    'legacy-staff': { role: 'staff' },
    'student-doc-1': { role: 'student', authUid: 'auth-student-1' },
    'student-doc-2': { role: 'student', authUid: 'auth-student-2' },
    'parent-doc-1': { role: 'parent', authUid: 'auth-parent-1', studentIds: ['student-doc-1'] },
    'duplicate-parent': { role: 'parent', authUid: 'auth-student-1', studentIds: ['student-doc-1'] },
    'unlinked-parent-doc': { role: 'parent', studentIds: ['student-doc-1'] },
    'legacy-parent-auth-uid': { role: 'parent', studentIds: ['student-doc-2'] },
};

const createAuth = (validUids = ['legacy-staff']) => ({
    getUser: async (uid) => {
        if (validUids.includes(uid)) return { uid };
        const error = new Error('user not found');
        error.code = 'auth/user-not-found';
        throw error;
    },
});

const snapshot = (id, data) => ({
    id,
    exists: Boolean(data),
    data: () => data,
    ref: { id },
});

const createDb = () => {
    const reads = [];
    const state = {
        profiles: structuredClone(profiles),
        indexes: { 'auth-student-1': 'student-doc-1', 'auth-student-2': 'student-doc-2', 'auth-parent-1': 'parent-doc-1' },
    };
    const db = {
        reads,
        state,
        collection(name) {
            if (name === 'userAuthIndex') {
                return { doc: (key) => ({ get: async () => {
                    reads.push(`index:${key}`);
                    return snapshot(key, state.indexes[key] ? { userDocId: state.indexes[key] } : null);
                } }) };
            }
            if (name !== 'users') throw new Error(`unexpected collection ${name}`);
            return {
                doc: (key) => ({ get: async () => {
                    reads.push(`user:${key}`);
                    return snapshot(key, state.profiles[key]);
                } }),
                where(field, operator, key) {
                    const filters = [{ field, operator, key }];
                    const query = {
                        where(nextField, nextOperator, nextKey) {
                            filters.push({ field: nextField, operator: nextOperator, key: nextKey });
                            return query;
                        },
                        limit: () => query,
                        get: async () => {
                            const matches = Object.entries(state.profiles).filter(([, data]) => filters.every((filter) => (
                                filter.operator === 'array-contains'
                                    ? data[filter.field]?.includes(filter.key)
                                    : data[filter.field] === filter.key
                            )));
                            return {
                                empty: matches.length === 0,
                                docs: matches.map(([id, data]) => snapshot(id, data)),
                            };
                        },
                    };
                    return query;
                },
            };
        },
    };
    return db;
};

test('resolves legacy equal IDs and distinct student/parent Auth UIDs', async () => {
    const db = createDb();
    const resolve = createUserIdentityResolver({ db, auth: createAuth() });

    assert.deepEqual(await resolve('legacy-staff'), {
        authUid: 'legacy-staff', profileDocId: 'legacy-staff', role: 'staff', studentDocId: null,
    });
    const expectedStudent = {
        authUid: 'auth-student-1', profileDocId: 'student-doc-1', role: 'student', studentDocId: 'student-doc-1',
    };
    assert.deepEqual(await resolve('student-doc-1'), expectedStudent);
    assert.deepEqual(await resolve('auth-student-1'), expectedStudent);
    assert.deepEqual(await resolve('auth-parent-1'), {
        authUid: 'auth-parent-1', profileDocId: 'parent-doc-1', role: 'parent', studentDocId: null,
    });
});

test('normalizes student and parent recipients to unique Auth UIDs', async () => {
    const db = createDb();
    const resolveIdentity = createUserIdentityResolver({ db, auth: createAuth() });
    const getRecipients = createStudentRecipientResolver({ database: db, resolveIdentity });

    assert.deepEqual(await getRecipients('student-doc-1'), {
        studentUid: 'auth-student-1',
        parentUids: ['auth-parent-1'],
        studentIdentity: {
            authUid: 'auth-student-1', profileDocId: 'student-doc-1', role: 'student', studentDocId: 'student-doc-1',
        },
    });
    assert.equal((await getRecipients('auth-student-1')).studentUid, 'auth-student-1');
});

test('does not pass an unresolved key through as an Auth UID and caches repeated lookup', async () => {
    const db = createDb();
    const resolve = createUserIdentityResolver({ db, auth: createAuth() });
    assert.equal(await resolve('invalid-key'), null);
    const readsAfterFirstCall = db.reads.length;
    assert.equal(await resolve('invalid-key'), null);
    assert.equal(db.reads.length, readsAfterFirstCall);
});

test('a fresh resolver does not inherit an earlier unresolved cache entry', async () => {
    const db = createDb();
    const auth = createAuth();
    const firstInvocationResolver = createUserIdentityResolver({ db, auth });
    assert.equal(await firstInvocationResolver('new-auth-uid'), null);

    db.state.profiles['new-profile-doc'] = { role: 'student', authUid: 'new-auth-uid' };
    db.state.indexes['new-auth-uid'] = 'new-profile-doc';
    const secondInvocationResolver = createUserIdentityResolver({ db, auth });
    assert.deepEqual(await secondInvocationResolver('new-auth-uid'), {
        authUid: 'new-auth-uid', profileDocId: 'new-profile-doc', role: 'student', studentDocId: 'new-profile-doc',
    });
});

test('excludes a parent profile whose Auth UID cannot be proven', async () => {
    const db = createDb();
    const resolveIdentity = createUserIdentityResolver({ db, auth: createAuth() });
    const getRecipients = createStudentRecipientResolver({ database: db, resolveIdentity });
    const recipients = await getRecipients('student-doc-1');
    assert.deepEqual(recipients.parentUids, ['auth-parent-1']);
    assert.ok(!recipients.parentUids.includes('unlinked-parent-doc'));
});

test('accepts a legacy equal-ID parent only after Firebase Auth verification', async () => {
    const db = createDb();
    const resolveIdentity = createUserIdentityResolver({ db, auth: createAuth(['legacy-parent-auth-uid']) });
    const getRecipients = createStudentRecipientResolver({ database: db, resolveIdentity });
    const recipients = await getRecipients('student-doc-2');
    assert.deepEqual(recipients.parentUids, ['legacy-parent-auth-uid']);
});

test('normalizes chat profile IDs and alias-only participants and excludes the sender in either ID form', async () => {
    const db = createDb();
    const resolveIdentity = createUserIdentityResolver({ db, auth: createAuth() });
    const roomData = {
        participantIds: ['student-doc-1'],
        parentId: 'parent-doc-1',
    };
    const fromStudentProfileId = await resolveChatRecipientAuthUids({ roomData, senderId: 'student-doc-1', resolveIdentity });
    assert.deepEqual(fromStudentProfileId.recipientAuthUids, ['auth-parent-1']);
    const fromParentAuthUid = await resolveChatRecipientAuthUids({ roomData, senderId: 'auth-parent-1', resolveIdentity });
    assert.deepEqual(fromParentAuthUid.recipientAuthUids, ['auth-student-1']);
});

test('clinic reservation canonical identity wins over an invalid request value', () => {
    assert.deepEqual(buildReservationIdentity({
        resolvedStudentAuthUid: 'auth-student-1', requestAuthUid: 'wrong-request-uid',
    }), { authUid: 'auth-student-1' });
    assert.deepEqual(buildReservationIdentity({
        resolvedStudentAuthUid: 'auth-student-1', requestAuthUid: null,
    }), { authUid: 'auth-student-1' });
});

test('canonical recipient Auth UID maps to the existing token registry path', () => {
    const recipientAuthUid = 'auth-student-1';
    assert.equal(`users/${recipientAuthUid}/fcmTokens`, 'users/auth-student-1/fcmTokens');
});
