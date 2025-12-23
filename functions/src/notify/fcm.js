const { getFirestore } = require('firebase-admin/firestore');
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

const sendFcmToUsers = async (userIds, dataPayload, notificationIds = {}) => {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];

    if (uniqueIds.length === 0) {
        return { successCount: 0, failureCount: 0, failedTokenCount: 0 };
    }

    const messaging = getMessaging();
    const totals = {
        successCount: 0,
        failureCount: 0,
        failedTokenCount: 0,
    };

    await Promise.all(uniqueIds.map(async (uid) => {
        const tokenSnapshot = await db.collection('users').doc(uid).collection('fcmTokens').get();
        const tokenEntries = resolveTokenEntries(tokenSnapshot);

        if (tokenEntries.length === 0) {
            return;
        }

        const payload = {
            ...dataPayload,
            notificationId: notificationIds[uid],
        };

        const tokenChunks = chunk(tokenEntries, 500);

        await Promise.all(tokenChunks.map(async (entryBatch) => {
            const tokens = entryBatch.map((entry) => entry.token);
            const response = await messaging.sendEachForMulticast({
                tokens,
                data: payload,
            });

            totals.successCount += response.successCount;
            totals.failureCount += response.failureCount;

            const invalidRefs = response.responses
                .map((result, index) => (result.success ? null : { error: result.error, ref: entryBatch[index].ref }))
                .filter((entry) => entry && isInvalidTokenError(entry.error));

            if (invalidRefs.length > 0) {
                totals.failedTokenCount += invalidRefs.length;
                await Promise.all(invalidRefs.map((entry) => entry.ref.delete()));
            }
        }));
    }));

    return totals;
};

module.exports = {
    sendFcmToUsers,
};