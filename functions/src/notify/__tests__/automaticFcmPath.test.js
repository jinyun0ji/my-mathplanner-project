const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const Module = require('node:module');

const functionsRoot = path.resolve(__dirname, '../../..');

const loadWithMocks = (relativePath, mocks) => {
    const target = path.resolve(functionsRoot, relativePath);
    delete require.cache[target];
    const originalLoad = Module._load;
    Module._load = function mockedLoad(request, parent, isMain) {
        if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
        return originalLoad.call(this, request, parent, isMain);
    };
    try {
        return require(target);
    } finally {
        Module._load = originalLoad;
    }
};

const firestoreFunctionsMock = {
    firestore: {
        document: (documentPath) => ({
            onCreate: (handler) => ({ documentPath, run: handler }),
        }),
    },
};

test('notifyUsers creates one item per unique recipient and has exactly once automatic FCM path', async () => {
    const writes = [];
    const db = {
        collection: (collectionName) => ({
            doc: (uid) => ({
                collection: (subcollection) => ({
                    doc: () => ({ id: `item-${uid}`, path: `${collectionName}/${uid}/${subcollection}/item-${uid}` }),
                }),
            }),
        }),
        batch: () => ({
            set: (ref, data) => writes.push({ ref, data }),
            commit: async () => undefined,
        }),
    };
    let directFcmCalls = 0;
    const notifications = loadWithMocks('src/notify/notifications.js', {
        'firebase-admin/firestore': { getFirestore: () => db, FieldValue: { serverTimestamp: () => 'timestamp' } },
        './settings': {
            isNotificationSendingEnabled: () => true,
            notificationDisabledResult: () => ({ skipped: true }),
        },
        './fcm': { sendFcmToUsers: async () => { directFcmCalls += 1; } },
    });

    const result = await notifications.notifyUsers({
        userIds: ['student', 'parent', 'student'],
        payload: { type: 'GRADE_PUBLISHED', title: 'title', body: 'body' },
        fcmData: { type: 'GRADE_PUBLISHED', refCollection: 'grades', refId: 'grade-1' },
    });

    assert.equal(writes.length, 2);
    assert.deepEqual(Object.keys(result.notificationIds).sort(), ['parent', 'student']);
    assert.equal(directFcmCalls, 0, 'notifyUsers must never dispatch FCM directly');
    assert.equal(result.sent, false);
});

test('one item create invokes exactly once automatic FCM path and writes a delivery log', async () => {
    const dispatches = [];
    const logs = [];
    const { handleNotificationItemCreated, onNotificationItemCreated } = loadWithMocks('src/triggers/notificationItems.js', {
        'firebase-functions': firestoreFunctionsMock,
        '../notify/fcm': { sendFcmToUsers: async () => undefined },
        '../notify/notifications': { createNotificationLog: async () => undefined },
    });
    const logRef = { id: 'delivery-log' };

    await handleNotificationItemCreated(
        { data: () => ({ type: 'clinic', refCollection: 'clinicLogs', refId: 'clinic-1' }) },
        { params: { uid: 'parent', notificationId: 'clinic-1_created' } },
        {
            createNotificationLog: async (input) => { logs.push(input); return logRef; },
            sendFcmToUsers: async (...args) => { dispatches.push(args); },
        },
    );

    assert.equal(onNotificationItemCreated.documentPath, 'notifications/{uid}/items/{notificationId}');
    assert.equal(logs.length, 1);
    assert.equal(dispatches.length, 1);
    assert.deepEqual(dispatches[0][0], ['parent']);
    assert.equal(dispatches[0][1].refCollection, 'clinicLogs');
    assert.deepEqual(dispatches[0][2], {
        notificationIds: { parent: 'clinic-1_created' },
        logRef,
    });
});

test('multiple recipient items each retain exactly once automatic FCM path', async () => {
    const calls = [];
    const { handleNotificationItemCreated } = loadWithMocks('src/triggers/notificationItems.js', {
        'firebase-functions': firestoreFunctionsMock,
        '../notify/fcm': { sendFcmToUsers: async () => undefined },
        '../notify/notifications': { createNotificationLog: async () => undefined },
    });
    const dependencies = {
        createNotificationLog: async () => ({ id: 'log' }),
        sendFcmToUsers: async (uids) => calls.push(uids),
    };

    await Promise.all(['student', 'parent'].map((uid) => handleNotificationItemCreated(
        { data: () => ({ type: 'BOARD_POST', refCollection: 'announcements', refId: 'post-1' }) },
        { params: { uid, notificationId: 'boardPost_post-1' } },
        dependencies,
    )));

    assert.deepEqual(calls, [['student'], ['parent']]);
});

test('manual retry executes its direct FCM path without creating notification items', async () => {
    const fcmCalls = [];
    let notificationItemCollectionAccesses = 0;
    const deliveryRef = { id: 'failed-user' };
    const logRef = {
        get: async () => ({
            exists: true,
            data: () => ({
                type: 'GRADE_PUBLISHED',
                refCollection: 'grades',
                refId: 'grade-1',
                retry: {},
            }),
        }),
        collection: (name) => {
            assert.equal(name, 'deliveries');
            return {
                doc: () => deliveryRef,
                where: () => ({
                    limit: () => ({
                        get: async () => ({ docs: [{ id: 'failed-user' }] }),
                    }),
                }),
            };
        },
        update: async () => undefined,
    };
    const db = {
        collection: (name) => {
            if (name === 'notifications') return { doc: () => logRef };
            if (name === 'users') {
                return {
                    doc: () => ({
                        collection: (subcollection) => {
                            if (subcollection === 'items') notificationItemCollectionAccesses += 1;
                            assert.equal(subcollection, 'fcmTokens');
                            return { limit: () => ({ get: async () => ({ empty: false }) }) };
                        },
                    }),
                };
            }
            throw new Error(`unexpected collection: ${name}`);
        },
        batch: () => ({
            delete: () => undefined,
            set: () => undefined,
            commit: async () => undefined,
        }),
    };
    const functionsMock = {
        https: {
            onCall: (handler) => ({ run: handler }),
            HttpsError: class HttpsError extends Error {},
        },
    };
    const { retryNotification } = loadWithMocks('src/admin/retryNotification.js', {
        'firebase-functions': functionsMock,
        'firebase-admin/firestore': {
            getFirestore: () => db,
            FieldValue: { serverTimestamp: () => 'timestamp', increment: (value) => value },
        },
        '../_utils/assertAdmin': { assertAdmin: async () => undefined },
        '../notify/fcm': {
            sendFcmToUsers: async (...args) => {
                fcmCalls.push(args);
                return { successCount: 1, failureCount: 0, failedTokenCount: 0, failedUids: [], failedEntries: [] };
            },
        },
        '../notify/settings': {
            isNotificationSendingEnabled: () => true,
            notificationDisabledResult: () => ({ skipped: true }),
        },
    });

    const result = await retryNotification.run({ logId: 'delivery-log' }, {});

    assert.equal(fcmCalls.length, 1);
    assert.deepEqual(fcmCalls[0][0], ['failed-user']);
    assert.equal(notificationItemCollectionAccesses, 0);
    assert.equal(result.successCount, 1);
});

test('announcement and clinic producers retain deterministic item-only writes', () => {
    const announcementSource = fs.readFileSync(path.resolve(functionsRoot, 'src/triggers/announcements.js'), 'utf8');
    const clinicSource = fs.readFileSync(path.resolve(functionsRoot, 'clinicNotifications.js'), 'utf8');
    assert.match(announcementSource, /doc\(`boardPost_\$\{refId\}`\)/);
    assert.doesNotMatch(announcementSource, /sendFcmToUsers/);
    assert.match(clinicSource, /notificationId = `\$\{logId\}_\$\{event\}\$\{completedSuffix\}`/);
    assert.doesNotMatch(clinicSource, /sendFcmToUsers/);
});

test('feature flag remains default-off and FCM helper skips delivery', async () => {
    const previousFlag = process.env.NOTIFICATION_SENDING_ENABLED;
    delete process.env.NOTIFICATION_SENDING_ENABLED;
    try {
        const settings = loadWithMocks('src/notify/settings.js', {
            'firebase-functions': { config: () => ({}) },
        });
        assert.equal(settings.isNotificationSendingEnabled(), false);

        const fcm = loadWithMocks('src/notify/fcm.js', {
            'firebase-admin/firestore': { getFirestore: () => ({}), FieldValue: {} },
            'firebase-admin/messaging': { getMessaging: () => { throw new Error('messaging should not initialize'); } },
            './settings': settings,
        });
        const result = await fcm.sendFcmToUsers(['student'], { type: 'TEST' });
        assert.equal(result.skipped, true);
        assert.equal(result.reason, 'notification_disabled');
    } finally {
        if (previousFlag === undefined) delete process.env.NOTIFICATION_SENDING_ENABLED;
        else process.env.NOTIFICATION_SENDING_ENABLED = previousFlag;
    }
});
