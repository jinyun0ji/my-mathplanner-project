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
    await callable({ viewerUid: normalizedViewerUid, notificationId: normalizedNotificationId });
    return true;
};

export const markAllNotificationsRead = async ({ viewerUid, functions = firebaseFunctions, setNotifications = null }) => {
    const normalizedViewerUid = normalizeId(viewerUid);
    if (!normalizedViewerUid) return null;

    const callable = httpsCallable(functions, 'markAllNotificationsRead');
    const result = await callable({ viewerUid: normalizedViewerUid });
    const now = new Date();
    if (setNotifications) {
        setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true, readAt: item.readAt || now })));
    }
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
    return normalizeId(notification?.roomId || notification?.chatRoomId);
};

export const markChatRoomNotificationsRead = async ({ viewerUid, roomId, notifications = [], functions = firebaseFunctions, setNotifications = null }) => {
    const normalizedRoomId = normalizeId(roomId);
    if (!normalizeId(viewerUid) || !normalizedRoomId) return 0;

    const targets = (Array.isArray(notifications) ? notifications : [])
        .filter((item) => item?.isRead !== true && !item?.readAt)
        .filter((item) => getChatNotificationRoomId(item) === normalizedRoomId);

    await Promise.all(targets.map((item) => markNotificationRead({ viewerUid, notificationId: item.id, functions, setNotifications })));
    return targets.length;
};
