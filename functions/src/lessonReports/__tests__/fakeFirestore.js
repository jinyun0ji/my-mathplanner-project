// In-memory Firestore with optimistic transaction retries and atomic commits.
// Deliberately no Admin app, credentials, emulator host or network connection.
const clone = (value) => {
    if (Array.isArray(value)) return value.map(clone);
    if (value && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    return value;
};
const createFakeFirestore = (initial = {}) => {
    const data = new Map(Object.entries(initial).map(([path, value]) => [path, clone(value)]));
    const versions = new Map();
    const failures = new Map();
    const writes = [];
    const commits = [];
    const createEvents = [];
    const createObservers = [];
    let beforeCommit = () => {};
    let afterCommit = () => {};
    const snapshot = (path) => ({ id: path.split('/').pop(), exists: data.has(path), ref: doc(path), data: () => clone(data.get(path)) });
    const doc = (path) => ({ path, id: path.split('/').pop(), get: async () => snapshot(path), collection: (name) => collection(`${path}/${name}`) });
    const collection = (path, filters = [], count = Infinity) => ({
        path,
        doc: (id) => doc(`${path}/${id}`),
        where: (field, op, value) => collection(path, [...filters, { field, op, value }], count),
        limit: (limit) => collection(path, filters, limit),
        get: async () => {
            const docs = [...data.keys()].filter((key) => key.startsWith(`${path}/`) && key.split('/').length === path.split('/').length + 1)
                .filter((key) => filters.every(({ field, op, value }) => {
                    if (op !== '==') throw new Error('Unsupported mock query');
                    return data.get(key)[field] === value;
                })).slice(0, count).map(snapshot);
            return { docs, empty: !docs.length };
        },
    });
    const db = {
        collection,
        read: (path) => clone(data.get(path)),
        paths: () => [...data.keys()],
        writes,
        commits,
        createEvents,
        onCreate: (observer) => createObservers.push(observer),
        beforeCommit: (hook) => { beforeCommit = hook; },
        afterCommit: (hook) => { afterCommit = hook; },
        failNext: (path, count = 1) => failures.set(path, count),
        // Simulate another client without running application/production code.
        seed: (path, value) => { data.set(path, clone(value)); versions.set(path, (versions.get(path) || 0) + 1); },
        runTransaction: async (fn) => {
            for (let attempt = 0; attempt < 30; attempt += 1) {
                const reads = new Map();
                const pending = [];
                const tx = {
                    get: async (ref) => {
                        if (pending.length) throw new Error('Firestore forbids reads after writes');
                        reads.set(ref.path, versions.get(ref.path) || 0);
                        return snapshot(ref.path);
                    },
                    set: (ref, value, options) => pending.push({ path: ref.path, value, merge: options?.merge, op: 'set' }),
                    update: (ref, value) => pending.push({ path: ref.path, value, merge: true, op: 'update' }),
                    create: (ref, value) => pending.push({ path: ref.path, value, op: 'create' }),
                };
                const result = await fn(tx);
                await beforeCommit(pending);
                if ([...reads].some(([path, version]) => (versions.get(path) || 0) !== version)) continue;
                for (const write of pending) {
                    if (failures.get(write.path) > 0) {
                        failures.set(write.path, failures.get(write.path) - 1);
                        throw Object.assign(new Error('Injected atomic commit failure'), { code: 'unavailable' });
                    }
                    if (write.op === 'create' && data.has(write.path)) throw new Error('Already exists');
                    if (write.op === 'update' && !data.has(write.path)) throw new Error('Missing document');
                }
                for (const write of pending) {
                    data.set(write.path, clone(write.merge ? { ...data.get(write.path), ...write.value } : write.value));
                    versions.set(write.path, (versions.get(write.path) || 0) + 1);
                    writes.push(write);
                }
                const commit = { writes: pending, readCount: reads.size };
                commits.push(commit);
                // Firestore events observe committed state, never staged writes.
                for (const write of pending.filter(({ op }) => op === 'create')) {
                    const event = { path: write.path, data: clone(write.value), commit };
                    createEvents.push(event);
                    createObservers.forEach((observe) => observe(event));
                }
                await afterCommit(pending);
                return result;
            }
            throw new Error('Mock transaction contention limit exceeded');
        },
    };
    return db;
};
const createFakeAuth = (uids) => ({
    getUser: async (uid) => {
        if (!uids.includes(uid)) throw Object.assign(new Error('No mock Auth user'), { code: 'auth/user-not-found' });
        return { uid, disabled: false };
    },
});

module.exports = { createFakeFirestore, createFakeAuth };
