import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const runtimeConfig =
  (typeof window !== "undefined" && window.__FIREBASE_CONFIG__) ||
  {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  };

if (!runtimeConfig || !runtimeConfig.apiKey || !runtimeConfig.projectId) {
  console.warn("Firebase config belum lengkap. Isi VITE_FIREBASE_* atau window.__FIREBASE_CONFIG__ untuk mengaktifkan real-time sync.");
}

const firebaseConfig = runtimeConfig || {};
const app = firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null;
const db = app ? getDatabase(app) : null;

export { firebaseConfig, app, db };