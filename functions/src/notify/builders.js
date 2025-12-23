const buildNotificationDocument = ({ type, title, body, ref, studentId }) => ({
    type,
    title,
    body,
    ref,
    studentId: studentId || null,
    readAt: null,
});

const buildFcmDataPayload = ({ type, refCollection, refId, studentId, notificationId }) => {
    const data = {
        type,
        refCollection,
        refId,
        studentId,
        notificationId,
    };

    return Object.entries(data).reduce((acc, [key, value]) => {
        if (value === undefined || value === null || value === '') {
            return acc;
        }
        acc[key] = String(value);
        return acc;
    }, {});
};

module.exports = {
    buildNotificationDocument,
    buildFcmDataPayload,
};
