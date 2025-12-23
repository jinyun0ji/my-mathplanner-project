const functions = require('firebase-functions');
const { getAuth } = require('firebase-admin/auth');

const parseAllowlist = (rawAllowlist) => {
    if (!rawAllowlist) return [];
    if (Array.isArray(rawAllowlist)) return rawAllowlist.map((email) => String(email).toLowerCase());
    if (typeof rawAllowlist === 'string') {
        return rawAllowlist
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
            .map((email) => email.toLowerCase());
    }
    return [];
};

const assertAdmin = async (context) => {
    if (!context?.auth?.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication is required.');
    }

    const auth = getAuth();
    const { uid } = context.auth;
    const user = await auth.getUser(uid);

    const allowlist = parseAllowlist(functions.config().admin?.allowlist);
    const email = user.email?.toLowerCase();

    if (!email || !allowlist.includes(email)) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access denied.');
    }

    return { uid, email };
};

module.exports = { assertAdmin };