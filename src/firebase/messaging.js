import { getMessaging, isSupported, onMessage } from 'firebase/messaging';
import { firebaseApp } from './client';

export const initForegroundMessageListener = async () => {
    if (!firebaseApp) {
        return () => {};
    }

    const supported = await isSupported();

    if (!supported) {
        return () => {};
    }

    const messaging = getMessaging(firebaseApp);

    return onMessage(messaging, () => {
        // Foreground FCM messages should not render UI; notifications are sourced from Firestore only.
    });
};