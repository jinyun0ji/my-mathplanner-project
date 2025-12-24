import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, setLogLevel } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = (() => {
    if (typeof window === 'undefined') {
        return {};
    }

    const config = window.__firebase_config;

    if (!config) {
        return {};
    }

    if (typeof config === 'string') {
        try {
            return JSON.parse(config);
        } catch (error) {
            console.error('Invalid Firebase config string in window.__firebase_config:', error);
            return {};
        }
    }

    if (typeof config === 'object') {
        return config;
    }

    return {};
})();

let firebaseApp = null;
let auth = null;
let db = null;
let functions = null;
let googleProvider = null;

const getFirebaseApp = () => {
    const canInitialize = Object.keys(firebaseConfig).length > 0;
    if (!canInitialize) {
        return null;
    }
    return getApps().length ? getApp() : initializeApp(firebaseConfig);
};

    try {
    firebaseApp = getFirebaseApp();

    if (firebaseApp) {
        auth = getAuth(firebaseApp);
        db = getFirestore(firebaseApp);
        functions = getFunctions(firebaseApp);
        googleProvider = new GoogleAuthProvider();
        setLogLevel('error');
    }
} catch (error) {
    console.error('Firebase initialization error. Using local mock data only:', error);
}

export { firebaseApp, auth, db, functions, googleProvider, getAuth, getFirestore, getFunctions, GoogleAuthProvider };