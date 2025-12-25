const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const db = getFirestore();

const chunk = (items, size) => {
    const results = [];
    for (let i = 0; i < items.length; i += size) {
        results.push(items.slice(i, i + size));
    }
    return results;
};

const isInvalidTokenError = (error) => {
    if (!error || !error.code) {
        return false;
    }

    return [
        'messaging/invalid-registration-token',
        'messaging/registration-token-not-registered',
    ].includes(error.code);
};

const resolveTokenEntries = (tokenSnapshot) => tokenSnapshot.docs.map((doc) => {
    const token = doc.data()?.token || doc.id;
    return token ? { token, ref: doc.ref } : null;
}).filter(Boolean);

const sendFcmToUsers = async (userIds, dataPayload, { notificationIds = {}, logRef } = {}) => {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];

    if (uniqueIds.length === 0) {
        return { successCount: 0, failureCount: 0, failedTokenCount: 0, failedUids: [] };
    }

    const messaging = getMessaging();

    const results = await Promise.all(uniqueIds.map(async (uid) => {
        const tokenSnapshot = await db.collection('users').doc(uid).collection('fcmTokens').get();
        const tokenEntries = resolveTokenEntries(tokenSnapshot);

        if (tokenEntries.length === 0) {
            return {
                uid,
                success: false,
                failedTokenCount: 0,
                errorCode: 'no-token',
            };
        }

        const payload = {
            ...dataPayload,
            notificationId: notificationIds[uid],
        };

        const tokenChunks = chunk(tokenEntries, 500);

        let uidFailed = false;
        let uidErrorCode = '';
        let failedTokenCount = 0;

        await Promise.all(tokenChunks.map(async (entryBatch) => {
            const tokens = entryBatch.map((entry) => entry.token);
            const response = await messaging.sendEachForMulticast({
                tokens,
                data: payload,
            });

            if (response.failureCount > 0) {
                uidFailed = true;
            }

            const failedResponses = response.responses
                .map((result, index) => (result.success ? null : { error: result.error, ref: entryBatch[index].ref }))
                .filter(Boolean);

            if (!uidErrorCode) {
                const firstError = failedResponses.find((entry) => entry.error);
                uidErrorCode = firstError?.error?.code || '';
            }

            const invalidRefs = failedResponses.filter((entry) => isInvalidTokenError(entry.error));

            if (invalidRefs.length > 0) {
                failedTokenCount += invalidRefs.length;
                await Promise.all(invalidRefs.map((entry) => entry.ref.delete()));
            }
        }));

        return {
            uid,
            success: !uidFailed,
            failedTokenCount,
            errorCode: uidFailed ? (uidErrorCode || 'send-failed') : '',
        };
    }));

    const totals = results.reduce((acc, result) => {
        if (result.success) {
            acc.successCount += 1;
        } else {
            acc.failureCount += 1;
            acc.failedUids.push(result.uid);
            acc.failedEntries.push({ uid: result.uid, errorCode: result.errorCode || 'send-failed' });
        }

        acc.failedTokenCount += result.failedTokenCount;
        return acc;
    }, {
        successCount: 0,
        failureCount: 0,
        failedTokenCount: 0,
        failedUids: [],
        failedEntries: [],
    });

    const { failedEntries } = totals;

    if (logRef) {
        await logRef.update({
            successCount: FieldValue.increment(totals.successCount),
            failureCount: FieldValue.increment(totals.failureCount),
            failedTokenCount: FieldValue.increment(totals.failedTokenCount),
        });
    }

    if (logRef && failedEntries.length > 0) {
        for (let i = 0; i < failedEntries.length; i += 450) {
            const batch = db.batch();
            failedEntries.slice(i, i + 450).forEach((entry) => {
                const deliveryRef = logRef.collection('deliveries').doc(entry.uid);
                batch.set(deliveryRef, {
                    errorCode: entry.errorCode,
                    status: 'failed',
                    failedAt: FieldValue.serverTimestamp(),
                    lastAttemptedAt: FieldValue.serverTimestamp(),
                });
            });
            await batch.commit();
        }
    }

    return {
        successCount: totals.successCount,
        failureCount: totals.failureCount,
        failedTokenCount: totals.failedTokenCount,
        failedUids: totals.failedUids,
        failedEntries,
    };
};

module.exports = {
    sendFcmToUsers,
};