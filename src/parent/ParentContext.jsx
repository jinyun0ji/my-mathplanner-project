import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/client';
import { isParentRole } from '../constants/roles';

const ParentContext = createContext(null);
const STORAGE_KEY = 'parent.activeStudentId';

const readStoredActiveStudentId = () => {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
        return null;
    }
};

const resolveActiveStudentId = (storedId, firestoreId, studentIds) => {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return null;
    }

    const candidate = storedId || firestoreId || studentIds[0] || null;
    if (!candidate) {
        return null;
    }

    if (!studentIds.includes(candidate)) {
        return studentIds[0] || null;
    }

    return candidate;
};

export function ParentProvider({ userId, role, studentIds, firestoreActiveStudentId, children }) {
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
            await setDoc(doc(db, 'users', userId), { activeStudentId: nextStudentId }, { merge: true });
        } catch (error) {
            console.error('activeStudentId 저장 실패:', error);
        }
    }, [userId]);

    const setActiveStudentId = useCallback(async (studentId) => {
        if (!studentId) {
            return;
        }

        const nextStudentId = Array.isArray(studentIds) && studentIds.includes(studentId)
            ? studentId
            : studentIds?.[0];

        if (!nextStudentId) {
            return;
        }

        await persistActiveStudentId(nextStudentId);
    }, [studentIds, persistActiveStudentId]);

    useEffect(() => {
        if (!isParentRole(role)) {
            setActiveStudentIdState(null);
            setLoading(false);
            return;
        }

        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            setActiveStudentIdState(null);
            setLoading(false);
            return;
        }

        const storedId = readStoredActiveStudentId();
        const resolvedId = resolveActiveStudentId(storedId, firestoreActiveStudentId, studentIds);

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
    }, [role, studentIds, firestoreActiveStudentId, activeStudentId, persistActiveStudentId]);

    const value = useMemo(() => ({
        activeStudentId,
        setActiveStudentId,
        studentIds,
        loading,
    }), [activeStudentId, setActiveStudentId, studentIds, loading]);

    return (
        <ParentContext.Provider value={value}>
            {children}
        </ParentContext.Provider>
    );
}

export default ParentContext;