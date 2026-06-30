import { Capacitor } from '@capacitor/core';

export const STAFF_MOBILE_MESSENGER_ROUTE = '/staff-mobile-messenger';

export const isCapacitorNativeEnvironment = () => {
  if (Capacitor.isNativePlatform()) return true;
  if (typeof window === 'undefined') return false;

  return window.location.protocol === 'capacitor:'
    || window.location.origin === 'https://localhost';
};
