const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const LEGACY_ALIAS_FIELDS = ['authUid', 'uid', 'userUid', 'studentUid', 'studentAuthUid'];

const clean = (value) => String(value || '').trim();

const identityFromProfile = (snapshot, { indexedAuthUid = '', matchedField = '', matchedKey = '', verifiedEqualId = false } = {}) => {
    if (!snapshot?.exists) return null;
    const data = snapshot.data() || {};
    const profileDocId = snapshot.id || clean(snapshot.ref?.id);
    const authUid = clean(data.authUid)
        || clean(indexedAuthUid)
        || clean(data.uid)
        || clean(data.userUid)
        || clean(data.studentAuthUid)
        || (matchedField === 'authUid' ? clean(matchedKey) : '')
        // Only an Auth lookup (or an index hit above) may prove the legacy equal-ID shape.
        || (verifiedEqualId && profileDocId === clean(matchedKey) ? profileDocId : '');

    if (!authUid || !profileDocId) return null;
    const role = clean(data.role) || null;
    return {
        authUid,
        profileDocId,
        role,
        studentDocId: role === 'student' ? profileDocId : null,
    };
};

const createUserIdentityResolver = ({ db = getFirestore(), auth = getAuth(), cache = new Map() } = {}) => {
    const isFirebaseAuthUid = async (uid) => {
        try {
            await auth.getUser(uid);
            return true;
        } catch (error) {
            if (error?.code === 'auth/user-not-found') return false;
            throw error;
        }
    };

    const resolveUncached = async (rawKey) => {
        const key = clean(rawKey);
        if (!key) return null;

        // An index hit proves that key is an Auth UID and avoids collection queries.
        const indexSnapshot = await db.collection('userAuthIndex').doc(key).get();
        if (indexSnapshot.exists) {
            const profileDocId = clean(indexSnapshot.data()?.userDocId);
            if (profileDocId) {
                const profile = await db.collection('users').doc(profileDocId).get();
                const identity = identityFromProfile(profile, { indexedAuthUid: key, matchedKey: key });
                if (identity) return identity;
            }
        }

        // The key may instead be the profile/student document ID.
        const directProfile = await db.collection('users').doc(key).get();
        const explicitDirectIdentity = identityFromProfile(directProfile, { matchedKey: key });
        if (explicitDirectIdentity) return explicitDirectIdentity;
        const verifiedEqualId = directProfile.exists && await isFirebaseAuthUid(key);
        const directIdentity = identityFromProfile(directProfile, { matchedKey: key, verifiedEqualId });
        if (directIdentity) return directIdentity;

        // Queries are a last-resort compatibility path and stop at the first match.
        for (const field of LEGACY_ALIAS_FIELDS) {
            const result = await db.collection('users').where(field, '==', key).limit(1).get();
            if (!result.empty) {
                const identity = identityFromProfile(result.docs[0], { matchedField: field, matchedKey: key });
                if (identity) return identity;
            }
        }
        return null;
    };

    return (rawKey) => {
        const key = clean(rawKey);
        if (!key) return Promise.resolve(null);
        if (!cache.has(key)) cache.set(key, resolveUncached(key));
        return cache.get(key);
    };
};

// Convenience only: deliberately creates a fresh resolver so no cache survives a call.
const resolveUserIdentity = (rawKey, options) => createUserIdentityResolver(options)(rawKey);

module.exports = {
    LEGACY_ALIAS_FIELDS,
    createUserIdentityResolver,
    identityFromProfile,
    resolveUserIdentity,
};
