// src/firebase/client.js
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
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

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

const functionsInstance = getFunctions(firebaseApp);
if (typeof window !== "undefined" && window.location.hostname === "localhost") {
  connectFunctionsEmulator(functionsInstance, "localhost", 5001);
}

export const functions = functionsInstance;
export const storage = getStorage(firebaseApp);