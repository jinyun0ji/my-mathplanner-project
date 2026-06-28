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

// const createFirestore = () => {
//   if (!Capacitor.isNativePlatform()) {
//     return getFirestore(firebaseApp);
//   }

//   try {
//     const firestore = initializeFirestore(firebaseApp, {
//       experimentalForceLongPolling: true,
//       experimentalAutoDetectLongPolling: false,
//       useFetchStreams: false,
//     });
//     console.log('[firebase] firestore native long polling initialized');
//     return firestore;
//   } catch (error) {
//     if (String(error.message || '').includes('already been initialized')) {
//       console.warn(
//         '[firebase] firestore native already initialized; using existing Firestore instance',
//         error
//       );
//       return getFirestore(firebaseApp);
//     }

//     throw error;
//   }
// };

// export const db = createFirestore();

const createFirestore = () => {
  // 🌟 주소창에 localhost나 capacitor://가 포함되어 있다면 100% 앱 환경으로 간주합니다.
  const isAppEnvironment = typeof window !== 'undefined' && 
    (!!window.Capacitor || 
     window.location.origin.includes('capacitor://') || 
     window.location.href.includes('localhost'));

  if (!isAppEnvironment) {
    // 일반 크롬, 사파리 웹 브라우저 환경
    return getFirestore(firebaseApp);
  }

  // 🚀 Xcode 시뮬레이터 및 실제 아이폰 앱 환경 (CORS 차단 완벽 우회 강제 가동)
  try {
    console.log('[Firebase] App WebView environment detected. Forcing Long Polling bypass...');
    return initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
      experimentalAutoDetectLongPolling: false,
      useFetchStreams: false
    });
  } catch (error) {
    // 이미 초기화되었다는 에러 발생 시 기존 인스턴스 반환
    return getFirestore(firebaseApp);
  }
};

export const db = createFirestore();

export const functions = getFunctions(firebaseApp, "us-central1");
export const storage = getStorage(firebaseApp);