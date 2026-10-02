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
        '../notify/settings': { isNotificationSendingEnabled: () => true, isNotificationTestUid: () => false },
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
        title: undefined,
        body: undefined,
    });
});

test('notification item title and body are delivered as distinct FCM notification fields', async () => {
    const multicastMessages = [];
    const db = {
        collection: () => ({
            doc: () => ({
                collection: () => ({
                    get: async () => ({
                        docs: [{ data: () => ({ token: 'ios-token' }), ref: {} }],
                    }),
                }),
            }),
        }),
    };
    const fcm = loadWithMocks('src/notify/fcm.js', {
        'firebase-admin/firestore': { getFirestore: () => db, FieldValue: { increment: (value) => value } },
        'firebase-admin/messaging': {
            getMessaging: () => ({
                sendEachForMulticast: async (message) => {
                    multicastMessages.push(message);
                    return { failureCount: 0, responses: [{ success: true }] };
                },
            }),
        },
        './settings': {
            isNotificationSendingEnabled: () => true,
            isNotificationTestUid: () => false,
            notificationDisabledResult: () => ({ skipped: true }),
        },
    });
    const { handleNotificationItemCreated } = loadWithMocks('src/triggers/notificationItems.js', {
        'firebase-functions': firestoreFunctionsMock,
        '../notify/fcm': fcm,
        '../notify/notifications': { createNotificationLog: async () => null },
        '../notify/settings': { isNotificationSendingEnabled: () => true, isNotificationTestUid: () => false },
    });

    await handleNotificationItemCreated(
        { data: () => ({ type: 'NOTICE', title: '공지 제목', body: '공지 본문', studentId: 123 }) },
        { params: { uid: 'ios-test-user', notificationId: 'item-1' } },
    );

    assert.equal(multicastMessages.length, 1);
    assert.deepEqual(multicastMessages[0].notification, {
        title: '공지 제목',
        body: '공지 본문',
    });
    assert.ok(Object.values(multicastMessages[0].data).every((value) => typeof value === 'string'));
    assert.equal(multicastMessages[0].data.studentId, '123');
});

test('FCM retains chat and lesson report defaults when notification text is blank', async () => {
    const multicastMessages = [];
    const db = {
        collection: () => ({
            doc: () => ({
                collection: () => ({
                    get: async () => ({ docs: [{ data: () => ({ token: 'token' }), ref: {} }] }),
                }),
            }),
        }),
    };
    const fcm = loadWithMocks('src/notify/fcm.js', {
        'firebase-admin/firestore': { getFirestore: () => db, FieldValue: { increment: (value) => value } },
        'firebase-admin/messaging': {
            getMessaging: () => ({
                sendEachForMulticast: async (message) => {
                    multicastMessages.push(message);
                    return { failureCount: 0, responses: [{ success: true }] };
                },
            }),
        },
        './settings': {
            isNotificationSendingEnabled: () => true,
            isNotificationTestUid: () => false,
            notificationDisabledResult: () => ({ skipped: true }),
        },
    });

    await fcm.sendFcmToUsers(['user'], { type: 'CHAT_MESSAGE' }, { title: '', body: '   ' });
    await fcm.sendFcmToUsers(['user'], { type: 'lesson_report' });

    assert.deepEqual(multicastMessages.map((message) => message.notification), [
        { title: '새 메시지가 있습니다.', body: '새 메시지가 있습니다.' },
        { title: '학습리포트가 도착했습니다.', body: '학습리포트가 도착했습니다.' },
    ]);
});

test('multiple recipient items each retain exactly once automatic FCM path', async () => {
    const calls = [];
    const { handleNotificationItemCreated } = loadWithMocks('src/triggers/notificationItems.js', {
        'firebase-functions': firestoreFunctionsMock,
        '../notify/fcm': { sendFcmToUsers: async () => undefined },
        '../notify/notifications': { createNotificationLog: async () => undefined },
        '../notify/settings': { isNotificationSendingEnabled: () => true, isNotificationTestUid: () => false },
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
    const previousTestUid = process.env.NOTIFICATION_TEST_UID;
    delete process.env.NOTIFICATION_SENDING_ENABLED;
    delete process.env.NOTIFICATION_TEST_UID;
    try {
        const settings = loadWithMocks('src/notify/settings.js', {
            'firebase-functions': { config: () => ({}) },
        });
        assert.equal(settings.isNotificationSendingEnabled(), false);
        assert.equal(settings.isNotificationTestUid('student'), false);

        process.env.NOTIFICATION_TEST_UID = '  ios-test-user  ';
        assert.equal(settings.isNotificationSendingEnabled(), false);
        assert.equal(settings.isNotificationTestUid('ios-test-user'), true);
        assert.equal(settings.isNotificationTestUid('student'), false);

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
        if (previousTestUid === undefined) delete process.env.NOTIFICATION_TEST_UID;
        else process.env.NOTIFICATION_TEST_UID = previousTestUid;
    }
});

test('disabled global sending filters FCM recipients to the configured test UID', async () => {
    const requestedUids = [];
    const multicastMessages = [];
    const db = {
        collection: (name) => {
            assert.equal(name, 'users');
            return {
                doc: (uid) => {
                    requestedUids.push(uid);
                    return {
                        collection: (subcollection) => {
                            assert.equal(subcollection, 'fcmTokens');
                            return {
                                get: async () => ({
                                    docs: [{ data: () => ({ token: `token-${uid}` }), ref: { delete: async () => undefined } }],
                                }),
                            };
                        },
                    };
                },
            };
        },
    };
    const fcm = loadWithMocks('src/notify/fcm.js', {
        'firebase-admin/firestore': { getFirestore: () => db, FieldValue: { increment: (value) => value } },
        'firebase-admin/messaging': {
            getMessaging: () => ({
                sendEachForMulticast: async (message) => {
                    multicastMessages.push(message);
                    return { failureCount: 0, responses: [{ success: true }] };
                },
            }),
        },
        './settings': {
            isNotificationSendingEnabled: () => false,
            isNotificationTestUid: (uid) => uid === 'ios-test-user',
            notificationDisabledResult: () => ({ skipped: true, reason: 'notification_disabled' }),
        },
    });

    const result = await fcm.sendFcmToUsers(
        ['other-user', 'ios-test-user', 'other-user'],
        { type: 'TEST' },
        { notificationIds: { 'other-user': 'other-item', 'ios-test-user': 'test-item' } },
    );

    assert.deepEqual(requestedUids, ['ios-test-user']);
    assert.equal(multicastMessages.length, 1);
    assert.deepEqual(multicastMessages[0].tokens, ['token-ios-test-user']);
    assert.equal(multicastMessages[0].data.notificationId, 'test-item');
    assert.equal(result.successCount, 1);
});

test('log bypass rejects a non-test recipient even when explicitly requested', async () => {
    let logWrites = 0;
    const notifications = loadWithMocks('src/notify/notifications.js', {
        'firebase-admin/firestore': {
            getFirestore: () => ({
                collection: () => {
                    logWrites += 1;
                    throw new Error('log collection must not be accessed');
                },
            }),
            FieldValue: { serverTimestamp: () => 'timestamp' },
        },
        './builders': { buildNotificationDocument: (payload) => payload },
        './settings': {
            isNotificationSendingEnabled: () => false,
            isNotificationTestUid: (uid) => uid === 'ios-test-user',
            notificationDisabledResult: () => ({ skipped: true }),
        },
    });

    const result = await notifications.createNotificationLog({
        targetCount: 1,
        payload: { type: 'TEST' },
        fcmData: { type: 'TEST' },
        logData: { recipientUid: 'other-user' },
        allowWhenSendingDisabled: true,
    });

    assert.equal(result, null);
    assert.equal(logWrites, 0);
});

test('notification item trigger skips non-test users while global sending is disabled', async () => {
    const calls = [];
    const { handleNotificationItemCreated } = loadWithMocks('src/triggers/notificationItems.js', {
        'firebase-functions': firestoreFunctionsMock,
        '../notify/fcm': { sendFcmToUsers: async () => undefined },
        '../notify/notifications': { createNotificationLog: async () => undefined },
        '../notify/settings': { isNotificationSendingEnabled: () => false, isNotificationTestUid: () => false },
    });

    await handleNotificationItemCreated(
        { data: () => ({ type: 'TEST' }) },
        { params: { uid: 'other-user', notificationId: 'item-1' } },
        {
            createNotificationLog: async () => calls.push('log'),
            sendFcmToUsers: async () => calls.push('send'),
        },
    );

    assert.deepEqual(calls, []);
});

test('notification item trigger logs and sends for the configured test UID', async () => {
    const logs = [];
    const sends = [];
    const logRef = { id: 'test-log' };
    const { handleNotificationItemCreated } = loadWithMocks('src/triggers/notificationItems.js', {
        'firebase-functions': firestoreFunctionsMock,
        '../notify/fcm': { sendFcmToUsers: async () => undefined },
        '../notify/notifications': { createNotificationLog: async () => undefined },
        '../notify/settings': { isNotificationSendingEnabled: () => false, isNotificationTestUid: (uid) => uid === 'ios-test-user' },
    });

    await handleNotificationItemCreated(
        { data: () => ({ type: 'TEST' }) },
        { params: { uid: 'ios-test-user', notificationId: 'item-1' } },
        {
            createNotificationLog: async (input) => { logs.push(input); return logRef; },
            sendFcmToUsers: async (...args) => sends.push(args),
        },
    );

    assert.equal(logs.length, 1);
    assert.equal(logs[0].allowWhenSendingDisabled, true);
    assert.equal(logs[0].logData.recipientUid, 'ios-test-user');
    assert.equal(sends.length, 1);
    assert.deepEqual(sends[0][0], ['ios-test-user']);
    assert.equal(sends[0][2].logRef, logRef);
});
