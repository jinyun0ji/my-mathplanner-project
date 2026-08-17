const assert = require('node:assert/strict');
const test = require('node:test');
const { initializeApp } = require('firebase-admin/app');

initializeApp({ projectId: 'identity-resolver-test' });

const {
    createUserIdentityResolver,
} = require('../resolveUserIdentity');
const { createStudentRecipientResolver } = require('../../notify/recipients');
const { buildReservationIdentity } = require('../../clinic/createClinicReservation');

const profiles = {
    'legacy-staff': { role: 'staff' },
    'student-doc-1': { role: 'student', authUid: 'auth-student-1' },
    'parent-doc-1': { role: 'parent', authUid: 'auth-parent-1', studentIds: ['student-doc-1'] },
    'duplicate-parent': { role: 'parent', authUid: 'auth-student-1', studentIds: ['student-doc-1'] },
};

const snapshot = (id, data) => ({
    id,
    exists: Boolean(data),
    data: () => data,
    ref: { id },
});

const createDb = () => {
    const reads = [];
    const db = {
        reads,
        collection(name) {
            if (name === 'userAuthIndex') {
                return { doc: (key) => ({ get: async () => {
                    reads.push(`index:${key}`);
                    const ids = { 'auth-student-1': 'student-doc-1', 'auth-parent-1': 'parent-doc-1' };
                    return snapshot(key, ids[key] ? { userDocId: ids[key] } : null);
                } }) };
            }
            if (name !== 'users') throw new Error(`unexpected collection ${name}`);
            return {
                doc: (key) => ({ get: async () => {
                    reads.push(`user:${key}`);
                    return snapshot(key, profiles[key]);
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
                            const matches = Object.entries(profiles).filter(([, data]) => filters.every((filter) => (
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
    const resolve = createUserIdentityResolver({ db });

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
    const getRecipients = createStudentRecipientResolver({ database: db });

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
    const resolve = createUserIdentityResolver({ db });
    assert.equal(await resolve('invalid-key'), null);
    const readsAfterFirstCall = db.reads.length;
    assert.equal(await resolve('invalid-key'), null);
    assert.equal(db.reads.length, readsAfterFirstCall);
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
