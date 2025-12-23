import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/client';

const DEFAULT_LIMIT = 20;

const mapNotification = (doc) => ({
    id: doc.id,
    ...doc.data(),
});

export default function useNotifications(uid, maxItems = DEFAULT_LIMIT) {
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!uid || !db) {
            setNotifications([]);
            return undefined;
        }

        setIsLoading(true);

        const itemsRef = collection(db, 'notifications', uid, 'items');
        const notificationsQuery = query(
            itemsRef,
            orderBy('createdAt', 'desc'),
            limit(maxItems)
        );

        const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
            setNotifications(snapshot.docs.map(mapNotification));
            setIsLoading(false);
        }, () => {
            setNotifications([]);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [uid, maxItems]);

    const hasUnread = useMemo(
        () => notifications.some((notification) => !notification.readAt),
        [notifications]
    );

    return {
        notifications,
        hasUnread,
        isLoading,
    };
}