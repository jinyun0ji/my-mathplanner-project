import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { db, firebaseApp } from '../firebase/client';
import { isCapacitorNativeEnvironment } from '../utils/capacitorEnvironment';

const WEB_VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY || '';

const getBrowserPushToken = async () => {
  if (!firebaseApp || !(await isSupported())) return null;
  if (typeof Notification === 'undefined') return null;
  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') return null;
  if (!WEB_VAPID_KEY) {
    console.info('[push] REACT_APP_FIREBASE_VAPID_KEY is required for web FCM token registration.');
    return null;
  }
  return getToken(getMessaging(firebaseApp), { vapidKey: WEB_VAPID_KEY });
};

const getNativePushToken = async () => {
  if (!isCapacitorNativeEnvironment()) return null;
  try {
    const importNativePlugin = new Function('specifier', 'return import(specifier)');
    const mod = await importNativePlugin('@capacitor/push-notifications');
    const PushNotifications = mod.PushNotifications;
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return null;

    return await new Promise((resolve) => {
      let settled = false;
      const finish = async (value) => {
        if (settled) return;
        settled = true;
        resolve(value || null);
      };
      PushNotifications.addListener('registration', (token) => finish(token?.value));
      PushNotifications.addListener('registrationError', (error) => {
        console.warn('[push] native registration failed', error);
        finish(null);
      });
      PushNotifications.register();
      setTimeout(() => finish(null), 10000);
    });
  } catch (error) {
    console.info('[push] native push plugin not ready. Install @capacitor/push-notifications and configure APNs/FCM.', error?.message || error);
    return null;
  }
};

export const initializePushNotificationInteractions = async (onOpenNotificationCenter) => {
  const openCenter = (payload) => {
    if (typeof onOpenNotificationCenter === 'function') {
      onOpenNotificationCenter(payload);
    } else if (window.location.pathname !== '/home' || window.location.search !== '?tab=notifications') {
      window.history.pushState({}, '', '/home?tab=notifications');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  if (isCapacitorNativeEnvironment()) {
    try {
      const importNativePlugin = new Function('specifier', 'return import(specifier)');
      const mod = await importNativePlugin('@capacitor/push-notifications');
      const PushNotifications = mod.PushNotifications;
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.info('[push] foreground notification received', notification);
      });
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => openCenter(action?.notification?.data));
    } catch (error) {
      console.info('[push] native push listeners unavailable', error?.message || error);
    }
    return;
  }

  window.addEventListener('appNotificationClick', (event) => openCenter(event?.detail));
};

export const registerDevicePushToken = async (authUid) => {
  const uid = String(authUid || '').trim();
  if (!uid) return null;
  const token = isCapacitorNativeEnvironment() ? await getNativePushToken() : await getBrowserPushToken();
  if (!token) return null;
  await setDoc(doc(db, 'users', uid, 'fcmTokens', token), {
    token,
    platform: isCapacitorNativeEnvironment() ? 'capacitor' : 'web',
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return token;
};

export const unregisterDevicePushToken = async (authUid, token) => {
  const uid = String(authUid || '').trim();
  if (!uid || !token) return;
  await deleteDoc(doc(db, 'users', uid, 'fcmTokens', token));
};

export const PUSH_SETUP_TODOS = [
  'Firebase Console: iOS 앱에 APNs Authentication Key 등록',
  'Xcode: Signing & Capabilities에서 Push Notifications 및 Background Modes(Remote notifications) 활성화',
  '앱 패키지: @capacitor/push-notifications 설치 후 npx cap sync 실행',
  '웹 푸시: REACT_APP_FIREBASE_VAPID_KEY 환경변수 설정 및 firebase-messaging-sw.js 배포 확인',
];
