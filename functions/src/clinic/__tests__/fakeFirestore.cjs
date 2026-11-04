// Local-only optimistic transaction double. Never initializes Firebase or uses a network.
const clone = (value) => {
    if (Array.isArray(value)) return value.map(clone);
    if (value && Object.getPrototypeOf(value) === Object.prototype) {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    }
    return value;
};

function createFakeFirestore(initial = {}) {
    const state = new Map(Object.entries(initial).map(([path, data]) => [path, clone(data)]));
    const versions = new Map();
    const writes = [];
    let nextId = 0;
    let failure = false;
    const snapshot = (path) => ({ id: path.split('/').pop(), ref: doc(path), exists: state.has(path), data: () => clone(state.get(path)) });
    const doc = (path) => ({ path, id: path.split('/').pop(), get: async () => snapshot(path) });
    const collection = (path, filters = [], count = Infinity) => ({
        path,
        doc: (id = `generated-${++nextId}`) => doc(`${path}/${id}`),
        where: (field, operator, value) => {
            if (operator !== '==') throw new Error('Only equality queries are supported');
            return collection(path, [...filters, { field, value }], count);
        },
        limit: (size) => collection(path, filters, size),
        get: async () => {
            const docs = [...state.keys()].filter((key) => key.startsWith(`${path}/`) && key.split('/').length === 2)
                .filter((key) => filters.every(({ field, value }) => state.get(key)[field] === value)).slice(0, count).map(snapshot);
            return { docs, empty: !docs.length };
        },
    });
    return {
        collection, writes,
        read: (path) => clone(state.get(path)),
        paths: () => [...state.keys()],
        failNextCommit: () => { failure = true; },
        runTransaction: async (callback) => {
            for (let attempt = 0; attempt < 20; attempt++) {
                const reads = new Map();
                const pending = [];
                const tx = {
                    get: async (ref) => {
                        if (pending.length) throw new Error('Reads after writes are forbidden');
                        if (!ref.where) {
                            reads.set(ref.path, versions.get(ref.path) || 0);
                            return snapshot(ref.path);
                        }
                        const result = await ref.get();
                        result.docs.forEach((item) => reads.set(item.ref.path, versions.get(item.ref.path) || 0));
                        return result;
                    },
                    update: (ref, data) => pending.push({ path: ref.path, data, merge: true }),
                    set: (ref, data) => pending.push({ path: ref.path, data }),
                    create: (ref, data) => pending.push({ path: ref.path, data, create: true }),
                };
                const result = await callback(tx);
                if ([...reads].some(([key, version]) => (versions.get(key) || 0) !== version)) continue;
                if (failure) { failure = false; throw Object.assign(new Error('Injected commit failure'), { code: 'unavailable' }); }
                for (const write of pending) {
                    if (write.create && state.has(write.path)) throw Object.assign(new Error('Document already exists'), { code: 6 });
                    if (write.merge && !state.has(write.path)) throw new Error('Missing document');
                }
                for (const write of pending) {
                    state.set(write.path, clone(write.merge ? { ...state.get(write.path), ...write.data } : write.data));
                    versions.set(write.path, (versions.get(write.path) || 0) + 1);
                    writes.push(write);
                }
                return result;
            }
            throw new Error('Transaction contention limit');
        },
    };
}

module.exports = { createFakeFirestore };
