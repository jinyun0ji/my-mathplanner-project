import { doc, getDoc } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase/client';

const parseNotificationRef = (ref) => {
    if (!ref || typeof ref !== 'string') {
        return null;
    }

    const parts = ref.split('/').filter(Boolean);

    if (parts.length < 2) {
        return null;
    }

    return {
        refCollection: parts[0],
        refId: parts[1],
    };
};

export default async function openNotification({ notification, db = firestoreDb, onNavigate }) {
    const refInfo = parseNotificationRef(notification?.ref) || (notification?.refCollection && notification?.refId
        ? { refCollection: notification.refCollection, refId: notification.refId }
        : null);

    if (!refInfo || !db) {
        return null;
    }

    const isChatNotification = refInfo.refCollection === 'chatRooms' || refInfo.refCollection === 'chats';
    const data = isChatNotification ? null : await (async () => {
        const docRef = doc(db, refInfo.refCollection, refInfo.refId);
        const snapshot = await getDoc(docRef);
        return snapshot.exists() ? snapshot.data() : null;
    })();

    const payload = {
        ...refInfo,
        data,
        notification,
    };

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('viewerNotificationOpen', { detail: payload }));
    }

    if (onNavigate) {
        await onNavigate(payload);
    }

    return payload;
}
