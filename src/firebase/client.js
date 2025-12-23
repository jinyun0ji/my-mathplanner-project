import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, setLogLevel } from 'firebase/firestore';

const firebaseConfig = typeof window !== 'undefined' && typeof window.__firebase_config !== 'undefined'
    ? JSON.parse(window.__firebase_config)
    : {};

let firebaseApp = null;
let auth = null;
let db = null;

try {
    firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
    setLogLevel('error');
} catch (error) {
    console.error('Firebase initialization error. Using local mock data only:', error);
}

export { firebaseApp, auth, db };