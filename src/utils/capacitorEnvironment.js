import { Capacitor } from '@capacitor/core';

export const STAFF_MOBILE_MESSENGER_ROUTE = '/staff-mobile-messenger';

const getWindowCapacitor = () => {
  if (typeof window === 'undefined') return null;
  return window.Capacitor || null;
};

export const getCapacitorEnvironmentSnapshot = () => {
  const windowCapacitor = getWindowCapacitor();
  const location = typeof window !== 'undefined' ? window.location : null;
  const capacitorPlatform = typeof Capacitor.getPlatform === 'function'
    ? Capacitor.getPlatform()
    : null;
  const windowCapacitorPlatform = typeof windowCapacitor?.getPlatform === 'function'
    ? windowCapacitor.getPlatform()
    : null;
  const capacitorIsNative = typeof Capacitor.isNativePlatform === 'function'
    ? Capacitor.isNativePlatform()
    : false;
  const windowCapacitorIsNative = typeof windowCapacitor?.isNativePlatform === 'function'
    ? windowCapacitor.isNativePlatform()
    : false;
  const protocol = location?.protocol || '';

  return {
    origin: location?.origin || '',
    protocol,
    hostname: location?.hostname || '',
    href: location?.href || '',
    capacitorPlatform,
    windowCapacitorPlatform,
    capacitorIsNative,
    windowCapacitorIsNative,
    hasWindowCapacitor: Boolean(windowCapacitor),
    hasNativeBridge: Boolean(windowCapacitor?.isNative || windowCapacitor?.nativePromise),
    hasCapacitorProtocol: protocol === 'capacitor:',
  };
};

export const isCapacitorNativeEnvironment = () => {
  const snapshot = getCapacitorEnvironmentSnapshot();

  return snapshot.capacitorIsNative
    || snapshot.windowCapacitorIsNative
    || snapshot.hasCapacitorProtocol
    || snapshot.capacitorPlatform === 'ios'
    || snapshot.capacitorPlatform === 'android'
    || snapshot.windowCapacitorPlatform === 'ios'
    || snapshot.windowCapacitorPlatform === 'android'
    || snapshot.hasNativeBridge;
};

export const logCapacitorEnvironment = (scope = 'app') => {
  if (typeof console === 'undefined') return;

  const snapshot = getCapacitorEnvironmentSnapshot();
  console.info(`[capacitor:${scope}] environment`, {
    ...snapshot,
    isNativeApp: isCapacitorNativeEnvironment(),
  });
};
