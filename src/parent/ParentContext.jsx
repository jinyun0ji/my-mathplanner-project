import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/client';

const ParentContext = createContext(null);
const STORAGE_KEY = 'parent.activeStudentId';

const readStoredActiveStudentId = () => {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
        return null;
    }
};

const resolveActiveStudentId = (storedId, firestoreId, linkedStudentUids) => {
    if (!Array.isArray(linkedStudentUids) || linkedStudentUids.length === 0) {
        return null;
    }

    const candidate = storedId || firestoreId || linkedStudentUids[0] || null;
    if (!candidate) {
        return null;
    }

    if (!linkedStudentUids.includes(candidate)) {
        return linkedStudentUids[0] || null;
    }

    return candidate;
};

export function ParentProvider({ userId, role, linkedStudentUids, firestoreActiveStudentId, children }) {
    const [activeStudentId, setActiveStudentIdState] = useState(null);
    const [loading, setLoading] = useState(true);

    const persistActiveStudentId = useCallback(async (nextStudentId) => {
        if (!nextStudentId) {
            return;
        }

        try {
            localStorage.setItem(STORAGE_KEY, nextStudentId);
        } catch (error) {
            // ignore
        }

        setActiveStudentIdState(nextStudentId);

        if (!db || !userId) {
            return;
        }

        try {
            await setDoc(doc(db, 'users', userId), { activeStudentUid: nextStudentId }, { merge: true });
        } catch (error) {
            console.error('activeStudentUid 저장 실패:', error);
        }
    }, [userId]);

    const setActiveStudentId = useCallback(async (studentId) => {
        if (!studentId) {
            return;
        }

        const nextStudentId = Array.isArray(linkedStudentUids) && linkedStudentUids.includes(studentId)
            ? studentId
            : linkedStudentUids?.[0];

        if (!nextStudentId) {
            return;
        }

        await persistActiveStudentId(nextStudentId);
    }, [linkedStudentUids, persistActiveStudentId]);

    useEffect(() => {
        if (role !== 'parent') {
            setActiveStudentIdState(null);
            setLoading(false);
            return;
        }

        if (!Array.isArray(linkedStudentUids) || linkedStudentUids.length === 0) {
            setActiveStudentIdState(null);
            setLoading(false);
            return;
        }

        const storedId = readStoredActiveStudentId();
         const resolvedId = resolveActiveStudentId(storedId, firestoreActiveStudentId, linkedStudentUids);

        setLoading(false);

        if (!resolvedId || resolvedId === activeStudentId) {
            return;
        }

        const shouldPersist = resolvedId !== storedId || resolvedId !== firestoreActiveStudentId;

        if (shouldPersist) {
            persistActiveStudentId(resolvedId);
        } else {
            setActiveStudentIdState(resolvedId);
        }
    }, [role, linkedStudentUids, firestoreActiveStudentId, activeStudentId, persistActiveStudentId]);

    const value = useMemo(() => ({
        activeStudentId,
        setActiveStudentId,
        linkedStudentUids,
        loading,
    }), [activeStudentId, setActiveStudentId, linkedStudentUids, loading]);

    return (
        <ParentContext.Provider value={value}>
            {children}
        </ParentContext.Provider>
    );
}

export default ParentContext;