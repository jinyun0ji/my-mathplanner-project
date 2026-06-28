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
  // 🌟 시뮬레이터 CORS 차단을 원천 봉쇄하기 위해 무조건 true(앱 환경)로 강제 설정합니다.
  const isAppEnvironment = true; 

  if (!isAppEnvironment) {
    return getFirestore(firebaseApp);
  }

  // 🚀 Xcode 시뮬레이터 전용 강제 롱 폴링 우회 가동!
  try {
    console.log('[Firebase] Forcing Long Polling bypass for iOS Simulator...');
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