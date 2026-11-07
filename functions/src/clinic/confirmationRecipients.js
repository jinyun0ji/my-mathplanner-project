const { createHash } = require('node:crypto');
const { Timestamp } = require('firebase-admin/firestore');
const { LEGACY_ALIAS_FIELDS: AUTH_FIELDS } = require('../identity/resolveUserIdentity');

// Compatibility field shapes follow lessonReports/recipients, without changing
// its behavior. Clinic delivery additionally rejects inactive/conflicting links.
const PARENT_FIELDS = ['parentAuthUid', 'parentAuthUids', 'parentUid', 'parentUids', 'parentIds', 'parents', 'parentAuthUID', 'parentUID'];
const CHILD_FIELDS = ['studentIds', 'childrenIds', 'studentDocIds', 'students', 'childIds', 'linkedStudentIds'];
const keyOf = (value) => {
    if (typeof value === 'string') return value.trim();
    if (value && typeof value === 'object') return keyOf(value.id || value.path?.split('/').pop());
    return '';
};
const keys = (value) => (Array.isArray(value) ? value : [value]).map(keyOf).filter(Boolean);
const validDocId = (id) => typeof id === 'string' && Boolean(id) && !id.includes('/') && !['.', '..'].includes(id)
    && !/^__.*__$/.test(id) && Buffer.byteLength(id, 'utf8') <= 1500;
const validUid = (uid) => validDocId(uid) && uid.length <= 128;
const stable = (value) => {
    if (value instanceof Timestamp) return ['timestamp', value.seconds, value.nanoseconds];
    if (value instanceof Date) return ['date', value.toISOString()];
    if (value && typeof value.path === 'string' && typeof value.get === 'function') return ['ref', value.path];
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
    return value === undefined ? null : value;
};
const snapshotSignature = (snapshot) => createHash('sha256').update(JSON.stringify(snapshot.exists ? stable(snapshot.data()) : null)).digest('hex');
const evidenceFor = (snapshot) => ({ path: snapshot.ref.path, signature: snapshotSignature(snapshot) });

const createClinicConfirmationRecipientResolver = ({ db, auth, parentLimit = 1000, authsPerProfile = 50, maxAuthLookups = 500 }) => {
    if (!db || typeof auth?.getUser !== 'function') throw new Error('Explicit Firestore and Auth dependencies required');
    if (!Number.isSafeInteger(parentLimit) || parentLimit < 1 || parentLimit > 1000
        || !Number.isSafeInteger(authsPerProfile) || authsPerProfile < 1 || authsPerProfile > 100
        || !Number.isSafeInteger(maxAuthLookups) || maxAuthLookups < 1 || maxAuthLookups > 2000) throw new Error('Invalid recipient limits');
    return async ({ studentProfileDocId }) => {
        const issues = [];
        const excluded = [];
        const proofs = new Map();
        const reads = new Map();
        const authReads = new Map();
        const issue = (reason, details = {}, retryable = false) => issues.push({ reason, ...details, retryable });
        const read = (collection, id) => {
            if (!validDocId(id)) throw Object.assign(new Error('Invalid profile/link key'), { code: 'invalid-link' });
            const path = `${collection}/${id}`;
            if (!reads.has(path)) reads.set(path, db.collection(collection).doc(id).get());
            return reads.get(path);
        };
        const getAuth = (uid) => {
            if (!authReads.has(uid) && authReads.size >= maxAuthLookups) throw Object.assign(new Error('Auth lookup budget exhausted'), { code: 'clinic/auth-lookup-limit' });
            if (!authReads.has(uid)) authReads.set(uid, auth.getUser(uid));
            return authReads.get(uid);
        };
        const profileFor = async (key) => {
            const [index, direct] = await Promise.all([read('userAuthIndex', key), read('users', key)]);
            if (index.exists) {
                const id = keyOf(index.data().userDocId);
                if (!validDocId(id) || (direct.exists && direct.id !== id)) {
                    issue('profile_reference_conflict', { key }); return null;
                }
                const profile = await read('users', id);
                if (!profile.exists) issue('parent_link_not_found', { key });
                return profile.exists ? { profile, evidence: [evidenceFor(index), evidenceFor(profile), evidenceFor(direct)] } : null;
            }
            if (direct.exists) return { profile: direct, evidence: [evidenceFor(index), evidenceFor(direct)] };
            const matches = new Map();
            for (const result of await Promise.all(AUTH_FIELDS.map((field) => db.collection('users').where(field, '==', key).limit(2).get()))) {
                result.docs.forEach((profile) => matches.set(profile.id, profile));
            }
            if (matches.size !== 1) {
                issue(matches.size > 1 ? 'profile_reference_conflict' : 'parent_link_not_found', { key }); return null;
            }
            const profile = [...matches.values()][0];
            return { profile, evidence: [evidenceFor(index), evidenceFor(direct), evidenceFor(profile)] };
        };

        const student = await read('users', studentProfileDocId);
        if (!student.exists || student.data().role !== 'student') {
            return { recipients: [], issues: [{ reason: 'student_profile_not_found', retryable: false }], excluded: [] };
        }
        const uidsFor = async (profile, role, linkEvidence = []) => {
            const data = profile.data();
            const profileId = profile.id;
            if (data.active === false) {
                excluded.push({ profileDocId: profileId, reason: 'profile_inactive' }); return [];
            }
            let indexed;
            try { indexed = await db.collection('userAuthIndex').where('userDocId', '==', profileId).limit(authsPerProfile + 1).get(); }
            catch (_) { issue('index_lookup_failed', { profileDocId: profileId }, true); return []; }
            const explicit = new Set(AUTH_FIELDS.flatMap((field) => keys(data[field])));
            const candidates = new Set([profileId, ...explicit, ...indexed.docs.map((doc) => doc.id)]);
            if (indexed.docs.length > authsPerProfile || candidates.size > authsPerProfile + 1) {
                issue('profile_auth_limit', { profileDocId: profileId }); return [];
            }
            const verified = [];
            const excludedBefore = excluded.length;
            for (const uid of candidates) {
                if (!validUid(uid)) {
                    if (uid !== profileId || explicit.has(uid)) issue('invalid_auth_uid', { profileDocId: profileId });
                    continue;
                }
                try {
                    const binding = await read('userAuthIndex', uid);
                    if (binding.exists && binding.data().userDocId !== profileId) {
                        issue('auth_binding_conflict', { profileDocId: profileId, uid }); continue;
                    }
                    // An equal profile ID is only a candidate, NEVER a fallback:
                    // the real Auth lookup must succeed even for legacy equal IDs.
                    const account = await getAuth(uid);
                    if (account.uid !== uid) { issue('auth_uid_mismatch', { profileDocId: profileId, uid }); continue; }
                    if (account.disabled === true) { excluded.push({ profileDocId: profileId, uid, reason: 'auth_disabled' }); continue; }
                    if (!binding.exists) {
                        const owners = new Set([profileId]);
                        for (const matches of await Promise.all(AUTH_FIELDS.map((field) => db.collection('users').where(field, '==', uid).limit(2).get()))) {
                            matches.docs.forEach((match) => owners.add(match.id));
                        }
                        if (owners.size > 1) { issue('ambiguous_auth_binding', { profileDocId: profileId, uid }); continue; }
                    }
                    const evidence = [...linkEvidence, evidenceFor(student), evidenceFor(profile), evidenceFor(binding)];
                    if (!proofs.has(uid)) proofs.set(uid, []);
                    proofs.get(uid).push({ uid, role, profileId, evidence });
                    verified.push(uid);
                } catch (cause) {
                    if (cause.code === 'auth/user-not-found') {
                        if (uid !== profileId || explicit.has(uid) || indexed.docs.some((doc) => doc.id === uid)) {
                            issue('auth_user_not_found', { profileDocId: profileId, uid });
                        }
                    } else if (cause.code === 'clinic/auth-lookup-limit') issue('auth_lookup_limit', { profileDocId: profileId });
                    else issue('auth_or_binding_lookup_failed', { profileDocId: profileId, uid }, true);
                }
            }
            if (!verified.length && excluded.length === excludedBefore) issue('no_verified_auth_uid', { profileDocId: profileId });
            return verified;
        };
        const studentUids = await uidsFor(student, 'student');
        const studentKeys = new Set([student.id, ...studentUids]);
        const studentLinkEvidence = [];
        // Include only index-backed legacy child aliases when they are not a
        // currently deliverable student account (e.g. disabled student login).
        try {
            const aliases = await db.collection('userAuthIndex').where('userDocId', '==', student.id).limit(authsPerProfile + 1).get();
            if (aliases.docs.length > authsPerProfile) issue('student_alias_limit');
            else aliases.docs.forEach((doc) => { studentKeys.add(doc.id); studentLinkEvidence.push(evidenceFor(doc)); });
        } catch (_) { issue('student_alias_lookup_failed', {}, true); }
        const declared = PARENT_FIELDS.some((field) => Object.hasOwn(student.data(), field));
        const directParents = new Map();
        for (const field of PARENT_FIELDS) for (const key of keys(student.data()[field])) {
            try {
                const linked = await profileFor(key);
                if (!linked) continue;
                if (linked.profile.data().role !== 'parent') { issue('invalid_parent_role', { key, field }); continue; }
                const previous = directParents.get(linked.profile.id);
                directParents.set(linked.profile.id, { profile: linked.profile, evidence: [...(previous?.evidence || []), ...linked.evidence] });
            } catch (_) { issue('parent_link_lookup_failed', { field }, true); }
        }
        const parents = new Map(directParents);
        try {
            const result = await db.collection('users').where('role', '==', 'parent').limit(parentLimit + 1).get();
            if (result.docs.length > parentLimit) issue('parent_lookup_limit');
            else for (const profile of result.docs) {
                if (CHILD_FIELDS.some((field) => keys(profile.data()[field]).some((key) => studentKeys.has(key)))) {
                    if (!parents.has(profile.id)) parents.set(profile.id, { profile, evidence: [] });
                }
            }
        } catch (_) { issue('parent_lookup_failed', {}, true); }
        for (const { profile, evidence } of parents.values()) {
            const fields = CHILD_FIELDS.filter((field) => Object.hasOwn(profile.data(), field));
            const matches = fields.map((field) => keys(profile.data()[field]).some((key) => studentKeys.has(key)));
            if ((declared && !directParents.has(profile.id)) || (fields.length && !matches.every(Boolean))) {
                issue('parent_link_conflict', { profileDocId: profile.id }); continue;
            }
            await uidsFor(profile, 'parent', [...evidence, ...studentLinkEvidence]);
        }
        const recipients = [];
        for (const [uid, claims] of proofs) {
            if (new Set(claims.map((claim) => claim.profileId)).size > 1) {
                issue('ambiguous_auth_binding', { uid }); continue;
            }
            const evidence = new Map(claims.flatMap((claim) => claim.evidence).map((item) => [item.path, item]));
            recipients.push({ uid, roles: [...new Set(claims.map((claim) => claim.role))].sort(),
                profileIds: [...new Set(claims.map((claim) => claim.profileId))], evidence: [...evidence.values()] });
        }
        return { recipients, issues, excluded };
    };
};

module.exports = { createClinicConfirmationRecipientResolver, AUTH_FIELDS, keyOf, keys, validDocId, validUid, snapshotSignature };
