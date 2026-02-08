export const getLinkedParentAuthUids = (student, parents = []) => {
    if (!student) return [];

    const directCandidates = []
        .concat(student.parentAuthUid || [])
        .concat(student.parentUid || [])
        .concat(student.parentAuthUids || [])
        .concat(student.parentUids || [])
        .concat(student.parents || [])
        .concat(student.parentAuthUID || [])
        .concat(student.parentUID || [])
        .filter(Boolean)
        .map(String);

    if (directCandidates.length > 0) {
        return Array.from(new Set(directCandidates));
    }

    const studentId = String(student.id);

    const normalizeLinkedIds = (value) => {
        const values = Array.isArray(value) ? value : (value ? [value] : []);
        return values
            .map((item) => {
                if (!item) return null;
                if (typeof item === 'string') return item;
                if (typeof item === 'object') {
                    if (item.id) return item.id;
                    if (item.path) {
                        const parts = item.path.split('/');
                        return parts[parts.length - 1];
                    }
                }
                return null;
            })
            .filter(Boolean)
            .map(String);
    };

    const pickArray = (parent, keys) => {
        for (const key of keys) {
            const value = parent?.[key];
            const normalized = normalizeLinkedIds(value);
            if (normalized.length > 0) return normalized;
        }
        return [];
    };

    const matchedParents = (parents || []).filter((parent) => {
        const ids = pickArray(parent, ['studentIds', 'childrenIds', 'studentDocIds', 'students', 'childIds', 'linkedStudentIds']);
        return ids.includes(studentId);
    });

    const uids = matchedParents
        .flatMap((parent) => [parent?.authUid, parent?.uid, parent?.id].filter(Boolean))
        .map(String);

    return Array.from(new Set(uids));
};