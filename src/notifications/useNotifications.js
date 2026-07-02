import { useEffect, useMemo, useState } from 'react';
import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import { filterParentNotifications, isNotificationUnread } from './notificationFilters';

const DEFAULT_LIMIT = 20;

const mapNotification = (doc) => ({
    id: doc.id,
    ...doc.data(),
});

export default function useNotifications(uid, maxItems = DEFAULT_LIMIT, options = {}) {
    const { viewerRole = '', unreadOnly = false } = options || {};
    const normalizedUid = String(uid || '').trim();
    const isParentViewer = String(viewerRole).toLowerCase() === 'parent';
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastReadAt, setLastReadAt] = useState(null);
    const [isMetaLoading, setIsMetaLoading] = useState(false);

    const notificationsQuery = useMemo(() => {
        if (!db || !normalizedUid) {
            if (!normalizedUid) {
                console.warn('[notifications] subscribe skipped: missing uid', {
                    uid,
                    viewerRole,
                    unreadOnly,
                    path: null,
                });
            }
            return null;
        }

        return query(
            collection(db, 'notifications', normalizedUid, 'items'),
            orderBy('createdAt', 'desc'),
            limit(isParentViewer ? Math.max(maxItems * 5, maxItems) : maxItems)
        );
    }, [normalizedUid, uid, maxItems, isParentViewer, viewerRole, unreadOnly]);

    const metaRef = useMemo(() => {
        if (!normalizedUid || !db) {
            return null;
        }
        return doc(db, 'notifications', normalizedUid, 'meta', 'meta');
    }, [normalizedUid]);

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
        if (!notificationsQuery) {
            setNotifications([]);
            setIsLoading(false);
            return undefined;
        }

        console.log('[notifications] subscribe path', {
            uid: normalizedUid,
            viewerRole,
            unreadOnly,
            path: `notifications/${normalizedUid}/items`,
        });

        setIsLoading(true);
        const unsubscribe = onSnapshot(
            notificationsQuery,
            (snapshot) => {
                setNotifications(snapshot.docs.map(mapNotification));
                setIsLoading(false);
            },
            (error) => {
                console.error('Failed to subscribe to notifications', error);
                setIsLoading(false);
            }
        );

        return unsubscribe;
    }, [notificationsQuery, normalizedUid, viewerRole, unreadOnly]);

    const visibleNotifications = useMemo(() => {
        if (!isParentViewer) {
            return notifications;
        }
        return filterParentNotifications(notifications, lastReadAt, { unreadOnly });
    }, [notifications, isParentViewer, lastReadAt, unreadOnly]);

    const hasUnread = useMemo(
        () => visibleNotifications.some((notification) => isNotificationUnread(notification, lastReadAt)),
        [visibleNotifications, lastReadAt]
    );

    const unreadCount = useMemo(() => (
        visibleNotifications.reduce((count, notification) => (
            isNotificationUnread(notification, lastReadAt) ? count + 1 : count
        ), 0)
    ), [visibleNotifications, lastReadAt]);

    const markAllRead = async () => {
        if (!metaRef) {
            return;
        }
        await setDoc(metaRef, { lastReadAt: serverTimestamp() }, { merge: true });
        setLastReadAt(Timestamp.now());
    };

    return {
        notifications: visibleNotifications,
        rawNotifications: notifications,
        hasUnread,
        isLoading,
        isMetaLoading,
        lastReadAt,
        unreadCount,
        markAllRead,
        setNotifications,
    };
}