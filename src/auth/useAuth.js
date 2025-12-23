import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/client';

export default function useAuth() {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return undefined;
        }

        let isMounted = true;
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!isMounted) return;
            setUser(currentUser);
            setRole(null);

            if (!currentUser) {
                setLoading(false);
                return;
            }

            if (!db) {
                console.error('Firestore가 초기화되지 않았습니다.');
                setLoading(false);
                return;
            }

            try {
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (!isMounted) return;

                if (!userDoc.exists()) {
                    setRole('pending');
                } else {
                    const data = userDoc.data();
                    setRole(data?.role || 'pending');
                }
            } catch (error) {
                console.error('사용자 역할을 불러오는 중 오류가 발생했습니다:', error);
                if (isMounted) setRole(null);
            } finally {
                if (isMounted) setLoading(false);
            }
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []);

    return { user, role, loading };
}
