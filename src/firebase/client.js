// src/firebase/client.js
import { Capacitor } from '@capacitor/core';
import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
} from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { isCapacitorNativeEnvironment } from '../utils/capacitorEnvironment';

const firebaseConfig = {
  apiKey: "AIzaSyAjjR2yJwmwGeOMjxr_jGumpkchXpFzmcQ",
  authDomain: "my-mathplanner-project.firebaseapp.com",
  projectId: "my-mathplanner-project",
  storageBucket: "my-mathplanner-project.firebasestorage.app",
  messagingSenderId: "197602408828",
  appId: "1:197602408828:web:c0eae7df35a06fbe070cf9",
  measurementId: "G-ZH2BMBYE86"
};

export const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const createAuth = () => {
  if (!Capacitor.isNativePlatform()) {
    return getAuth(firebaseApp);
  }

  try {
    return initializeAuth(firebaseApp, {
      persistence: indexedDBLocalPersistence,
    });
  } catch (error) {
    return getAuth(firebaseApp);
  }
};

export const auth = createAuth();

if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  console.log('[capacitor] origin =', window.location.origin);
}

const createFirestore = () => {
  const isAppEnvironment = isCapacitorNativeEnvironment();

  if (!isAppEnvironment) {
    return getFirestore(firebaseApp);
  }

  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Firebase] Forcing Long Polling bypass for iOS Simulator...');
    }
    return initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
      experimentalAutoDetectLongPolling: false,
      useFetchStreams: false
    });
  } catch (error) {
    return getFirestore(firebaseApp);
  }
};

export const db = createFirestore();

export const functions = getFunctions(firebaseApp, "us-central1");
export const storage = getStorage(firebaseApp);