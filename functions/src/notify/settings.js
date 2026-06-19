const functions = require('firebase-functions');

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled']);

const normalizeFlag = (value) => String(value || '').trim().toLowerCase();

const isNotificationSendingEnabled = () => {
    const envValue = normalizeFlag(process.env.NOTIFICATION_SENDING_ENABLED);
    if (envValue) {
        return TRUE_VALUES.has(envValue);
    }

    const configValue = normalizeFlag(functions.config()?.notifications?.sending_enabled);
    if (configValue) {
        return TRUE_VALUES.has(configValue);
    }

    return false;
};

const notificationDisabledResult = () => ({
    success: true,
    sent: false,
    skipped: true,
    reason: 'notification_disabled',
});

module.exports = {
    isNotificationSendingEnabled,
    notificationDisabledResult,
};
