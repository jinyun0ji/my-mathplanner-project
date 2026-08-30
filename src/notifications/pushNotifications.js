import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { db, firebaseApp } from '../firebase/client';
import { isCapacitorNativeEnvironment } from '../utils/capacitorEnvironment';

const WEB_VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY || '';
const NATIVE_REGISTRATION_TIMEOUT_MS = 30000;
const NativeFcmToken = registerPlugin('NativeFcmToken');
const debugNative = (message, details) => {
  console.info(`[push][native] ${message}`, details || '');
};

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

const waitForNativeRegistration = async (PushNotifications, timeoutMs) => new Promise((resolve) => {
  let settled = false;
  let timeout;
  const handles = [];
  const finish = async (result) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    await Promise.all(handles.map((handle) => handle?.remove?.()));
    resolve(result);
  };

  Promise.all([
    PushNotifications.addListener('registration', (token) => finish({ registered: true, token: token?.value })),
    PushNotifications.addListener('registrationError', (error) => {
      console.warn('[push][native] registration error', error);
      finish({ registered: false });
    }),
  ]).then((listenerHandles) => {
    handles.push(...listenerHandles);
    debugNative('registering');
    PushNotifications.register();
    timeout = setTimeout(() => {
      debugNative('timeout', { timeoutMs });
      finish({ registered: false });
    }, timeoutMs);
  }).catch((error) => {
    console.warn('[push][native] registration error', error);
    finish({ registered: false });
  });
});

export const getNativePushToken = async ({ timeoutMs = NATIVE_REGISTRATION_TIMEOUT_MS } = {}) => {
  if (!isCapacitorNativeEnvironment()) return null;
  const platform = Capacitor.getPlatform();
  debugNative('environment detected', { platform });
  try {
    const permission = await PushNotifications.requestPermissions();
    debugNative('permission status', { receive: permission.receive });
    if (permission.receive !== 'granted') return null;

    const result = await waitForNativeRegistration(PushNotifications, timeoutMs);
    if (!result.registered) return null;
    debugNative('registration success');

    // Android's Capacitor event is already an FCM token. Step 2 changes only
    // the iOS conversion path and leaves this existing behavior untouched.
    if (platform !== 'ios') return result.token || null;

    // Capacitor's iOS registration event proves APNs registration. The native
    // Firebase Messaging bridge then returns the FCM token stored by this app.
    const response = await NativeFcmToken.getToken();
    const token = String(response?.token || '');
    if (!token) return null;
    debugNative('FCM token ready', { tokenLength: token.length });
    return token;
  } catch (error) {
    console.warn('[push][native] registration error', error?.message || error);
    return null;
  }
};

export const createPushTokenRegistry = ({
  isNative = isCapacitorNativeEnvironment,
  getNativeToken = getNativePushToken,
  getWebToken = getBrowserPushToken,
  save = (uid, token, platform) => setDoc(doc(db, 'users', uid, 'fcmTokens', token), {
    token, platform, updatedAt: serverTimestamp(),
  }, { merge: true }),
  remove = (uid, token) => deleteDoc(doc(db, 'users', uid, 'fcmTokens', token)),
} = {}) => ({
  async register(authUid) {
    const uid = String(authUid || '').trim();
    if (!uid) return null;
    const native = isNative();
    const token = native ? await getNativeToken() : await getWebToken();
    if (!token) return null;
    if (native) debugNative('firestore token owner', {
      hasAuthUid: Boolean(uid),
      authUidLength: uid.length,
    });
    try {
      await save(uid, token, native ? 'ios' : 'web');
      if (native) debugNative('firestore token stored');
      return token;
    } catch (error) {
      console.warn('[push] Firestore token write failed', { authUid: uid, error });
      throw error;
    }
  },
  async unregister(authUid, token) {
    const uid = String(authUid || '').trim();
    if (!uid || !token) return;
    await remove(uid, token);
  },
});

const registry = createPushTokenRegistry();
export const registerDevicePushToken = (authUid) => registry.register(authUid);
export const unregisterDevicePushToken = (authUid, token) => registry.unregister(authUid, token);

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
