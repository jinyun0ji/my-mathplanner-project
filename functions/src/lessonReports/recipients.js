const { createUserIdentityResolver } = require('../identity/resolveUserIdentity');

const PARENT_FIELDS = ['parentAuthUid', 'parentAuthUids', 'parentUid', 'parentUids',
    'parentIds', 'parents', 'parentAuthUID', 'parentUID'];
const CHILD_FIELDS = ['studentIds', 'childrenIds', 'studentDocIds', 'students', 'childIds', 'linkedStudentIds'];
const AUTH_FIELDS = ['authUid', 'uid', 'userUid', 'studentUid', 'studentAuthUid'];
const keyOf = (value) => {
    if (typeof value === 'string') return value.trim();
    if (value && typeof value === 'object') return keyOf(value.id || value.path?.split('/').pop());
    return '';
};
const keys = (value) => (Array.isArray(value) ? value : [value]).map(keyOf).filter(Boolean);

// Read-only adapter: shared identity resolution remains unchanged for other features.
// Reverse index lookup includes review-login Auth accounts bound to an older profile.
const createLessonReportRecipientResolver = ({ db, auth, parentLimit = 1000 }) => async (report) => {
    if (!Number.isSafeInteger(parentLimit) || parentLimit < 1) throw new Error('Invalid parent lookup limit');
    const resolveIdentity = createUserIdentityResolver({ db, auth });
    const profileFor = async (rawKey) => {
        const key = keyOf(rawKey);
        if (!key) return null;
        const index = await db.collection('userAuthIndex').doc(key).get();
        if (index.exists) {
            const profileId = keyOf(index.data().userDocId);
            if (!profileId) return null;
            const profile = await db.collection('users').doc(profileId).get();
            return profile.exists ? profile : null;
        }
        const direct = await db.collection('users').doc(key).get();
        if (direct.exists) return direct;
        const identity = await resolveIdentity(key);
        if (!identity) return null;
        const profile = await db.collection('users').doc(identity.profileDocId).get();
        return profile.exists ? profile : null;
    };
    const issues = [];
    const uidsFor = async (profile) => {
        const data = profile.data();
        const indexed = await db.collection('userAuthIndex').where('userDocId', '==', profile.id).get();
        const candidates = new Set([profile.id, ...AUTH_FIELDS.flatMap((field) => keys(data[field])),
            ...indexed.docs.map((doc) => doc.id)]);
        const verified = [];
        for (const uid of candidates) {
            // A UID explicitly bound to another profile must never be borrowed.
            const binding = await db.collection('userAuthIndex').doc(uid).get();
            if (binding.exists && binding.data().userDocId !== profile.id) continue;
            try {
                const user = await auth.getUser(uid);
                if (!user.disabled) verified.push(uid);
            } catch (error) {
                if (error.code !== 'auth/user-not-found') throw error;
            }
        }
        if (!verified.length) issues.push({ profileDocId: profile.id, reason: 'no_verified_auth_uid' });
        return verified;
    };

    const student = await profileFor(report.studentId);
    if (!student || student.data().role !== 'student') {
        return { recipients: [], issues: [], reason: 'student_profile_not_found' };
    }
    const studentUids = await uidsFor(student);
    const studentKeys = new Set([student.id, ...studentUids]);
    const parentProfiles = new Map();
    for (const field of PARENT_FIELDS) {
        for (const candidate of keys(student.data()[field])) {
            const parent = await profileFor(candidate);
            if (parent?.data().role === 'parent') parentProfiles.set(parent.id, parent);
            else issues.push({ reason: 'unresolved_parent_link', field });
        }
    }
    // Legacy child arrays can contain strings, {id} objects or DocumentReferences.
    // A bounded role query preserves those shapes without modifying/indexing data.
    const parents = await db.collection('users').where('role', '==', 'parent').limit(parentLimit + 1).get();
    if (parents.docs.length > parentLimit) throw Object.assign(new Error('Parent lookup limit exceeded'), { code: 'parent-lookup-limit' });
    for (const parent of parents.docs) {
        if (CHILD_FIELDS.some((field) => keys(parent.data()[field]).some((key) => studentKeys.has(key)))) {
            parentProfiles.set(parent.id, parent);
        }
    }
    const targets = new Map();
    const add = (uid, role) => {
        if (!targets.has(uid)) targets.set(uid, new Set());
        targets.get(uid).add(role);
    };
    studentUids.forEach((uid) => add(uid, 'student'));
    for (const parent of parentProfiles.values()) {
        (await uidsFor(parent)).forEach((uid) => add(uid, 'parent'));
    }
    return { recipients: [...targets].map(([uid, roles]) => ({ uid, roles: [...roles].sort() })), issues };
};

module.exports = { createLessonReportRecipientResolver };
