import { httpsCallable } from 'firebase/functions';
import { functions as firebaseFunctions } from '../firebase/client';

const normalizeId = (value) => String(value || '').trim();

export const markNotificationRead = async ({ viewerUid, notificationId, functions = firebaseFunctions, setNotifications = null }) => {
    const normalizedViewerUid = normalizeId(viewerUid);
    const normalizedNotificationId = normalizeId(notificationId);
    if (!normalizedViewerUid || !normalizedNotificationId) return false;

    const now = new Date();
    if (setNotifications) {
        setNotifications((prev) => prev.map((item) => (
            String(item.id || '') === normalizedNotificationId
                ? { ...item, isRead: true, readAt: item.readAt || now }
                : item
        )));
    }

    const callable = httpsCallable(functions, 'markNotificationRead');
    console.log('[notification read]', { viewerUid: normalizedViewerUid, notificationId: normalizedNotificationId });
    await callable({ viewerUid: normalizedViewerUid, notificationId: normalizedNotificationId });
    return true;
};

export const markAllNotificationsRead = async ({ viewerUid, functions = firebaseFunctions, setNotifications = null }) => {
    const normalizedViewerUid = normalizeId(viewerUid);
    if (!normalizedViewerUid) return null;

    const now = new Date();
    if (setNotifications) {
        setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true, readAt: item.readAt || now })));
    }

    const callable = httpsCallable(functions, 'markAllNotificationsRead');
    const result = await callable({ viewerUid: normalizedViewerUid });
    return result;
};

export const getChatNotificationRoomId = (notification) => {
    const ref = normalizeId(notification?.ref);
    if (ref.startsWith('chatRooms/') || ref.startsWith('chats/')) {
        return normalizeId(ref.split('/')[1]);
    }
    const collection = normalizeId(notification?.refCollection);
    if (collection === 'chatRooms' || collection === 'chats') {
        return normalizeId(notification?.refId);
    }
    return normalizeId(notification?.roomId || notification?.chatRoomId || notification?.payload?.roomId || notification?.payload?.chatRoomId);
};

export const markChatRoomNotificationsRead = async ({ viewerUid, roomId, notifications = [], functions = firebaseFunctions, setNotifications = null }) => {
    const normalizedViewerUid = normalizeId(viewerUid);
    const normalizedRoomId = normalizeId(roomId);
    if (!normalizedViewerUid || !normalizedRoomId) return 0;

    console.log('[chat notification read]', { viewerUid: normalizedViewerUid, roomId: normalizedRoomId });

    const targets = (Array.isArray(notifications) ? notifications : [])
        .filter((item) => item?.isRead !== true && !item?.readAt)
        .filter((item) => getChatNotificationRoomId(item) === normalizedRoomId);

    if (setNotifications && targets.length > 0) {
        const targetIds = new Set(targets.map((item) => String(item.id || '')));
        const now = new Date();
        setNotifications((prev) => prev.map((item) => (
            targetIds.has(String(item.id || ''))
                ? { ...item, isRead: true, readAt: item.readAt || now }
                : item
        )));
    }

    const callable = httpsCallable(functions, 'markChatRoomNotificationsRead');
    const result = await callable({ viewerUid: normalizedViewerUid, roomId: normalizedRoomId });
    return result?.data?.updated ?? targets.length;
};
