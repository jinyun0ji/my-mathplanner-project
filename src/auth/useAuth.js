import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/client';
import { signOutUser } from './authService';

const AuthContext = createContext(null);

const LOCAL_STORAGE_KEYS = ['videoBookmarks', 'parent.activeStudentId'];

const clearAuthStorage = () => {
    try {
        LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
        // ignore
    }
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [linkedStudentIds, setLinkedStudentIds] = useState([]);
    const [activeStudentId, setActiveStudentId] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return undefined;
        }

        let isMounted = true;
        let userDocUnsub = null;
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!isMounted) return;
            setUser(currentUser);
            setRole(null);
            setLinkedStudentIds([]);
            setActiveStudentId(null);

            if (userDocUnsub) {
                userDocUnsub();
                userDocUnsub = null;
            }

            if (!currentUser) {
                setLoading(false);
                return;
            }

            if (!db) {
                console.error('Firestore가 초기화되지 않았습니다.');
                setLoading(false);
                return;
            }

            const userDocRef = doc(db, 'users', currentUser.uid);
            userDocUnsub = onSnapshot(userDocRef, (userDoc) => {
                if (!isMounted) return;

                if (!userDoc.exists()) {
                    setRole('pending');
                    setLinkedStudentIds([]);
                    setActiveStudentId(null);
                } else {
                    const data = userDoc.data();
                    setRole(data?.role || 'pending');
                    const ids = Array.isArray(data?.linkedStudentIds)
                        ? data.linkedStudentIds.filter((id) => id !== undefined && id !== null)
                        : Array.isArray(data?.studentIds)
                            ? data.studentIds.filter((id) => id !== undefined && id !== null)
                            : [];
                    setLinkedStudentIds(ids);
                    setActiveStudentId(data?.activeStudentId || null);
                }
            setLoading(false);
            }, (error) => {
                console.error('사용자 역할을 불러오는 중 오류가 발생했습니다:', error);
                if (isMounted) {
                    setRole(null);
                    setLinkedStudentIds([]);
                    setActiveStudentId(null);
                    setLoading(false);
                }
            });

        });

        return () => {
            isMounted = false;
            if (userDocUnsub) userDocUnsub();
            unsubscribe();
        };
    }, []);

    const logout = useCallback(async () => {
        if (!auth) {
            clearAuthStorage();
            setUser(null);
            setRole(null);
            setLinkedStudentIds([]);
            setActiveStudentId(null);
            return;
        }

        try {
            await signOutUser();
        } finally {
            clearAuthStorage();
        }
    }, []);

    const value = useMemo(() => ({
        user,
        role,
        linkedStudentIds,
        activeStudentId,
        loading,
        logout,
    }), [user, role, linkedStudentIds, activeStudentId, loading, logout]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export default function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('AuthProvider가 필요합니다.');
    }
    return context;
}
