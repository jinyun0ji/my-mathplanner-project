import { useEffect, useMemo, useState } from 'react';
import {
    collection,
    doc,
    getDoc,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/client';

const DEFAULT_LIMIT = 20;

const mapNotification = (doc) => ({
    id: doc.id,
    ...doc.data(),
});

export default function useNotifications(uid, maxItems = DEFAULT_LIMIT) {
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastReadAt, setLastReadAt] = useState(null);
    const [isMetaLoading, setIsMetaLoading] = useState(false);

    const metaRef = useMemo(() => {
        if (!uid || !db) {
            return null;
        }
        return doc(db, 'notifications', uid, 'meta');
    }, [uid, db]);

    useEffect(() => {
        if (!metaRef) {
            setLastReadAt(null);
            return undefined;
        }

        let isMounted = true;
        setIsMetaLoading(true);

        getDoc(metaRef)
            .then((snapshot) => {
                if (!isMounted) {
                    return;
                }
                const data = snapshot.exists() ? snapshot.data() : {};
                setLastReadAt(data?.lastReadAt || null);
            })
            .catch(() => {
                if (!isMounted) {
                    return;
                }
                setLastReadAt(null);
            })
            .finally(() => {
                if (isMounted) {
                    setIsMetaLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [metaRef]);

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
        () => {
            if (!notifications.length) {
                return false;
            }
            return notifications.some((notification) => {
                if (notification.readAt) {
                    return false;
                }
                if (!notification.createdAt || !lastReadAt) {
                    return true;
                }
                return notification.createdAt.toMillis() > lastReadAt.toMillis();
            });
        },
        [notifications, lastReadAt]
    );

    const unreadCount = useMemo(() => {
        if (!notifications.length) {
            return 0;
        }
        return notifications.reduce((count, notification) => {
            if (notification.readAt) {
                return count;
            }
            if (!notification.createdAt || !lastReadAt) {
                return count + 1;
            }
            return notification.createdAt.toMillis() > lastReadAt.toMillis() ? count + 1 : count;
        }, 0);
    }, [notifications, lastReadAt]);

    const markAllRead = async () => {
        if (!metaRef) {
            return;
        }
        await setDoc(metaRef, { lastReadAt: serverTimestamp(), unreadCount: 0 }, { merge: true });
        setLastReadAt(Timestamp.now());
    };

    return {
        notifications,
        hasUnread,
        isLoading,
        isMetaLoading,
        lastReadAt,
        unreadCount,
        markAllRead,
    };
}