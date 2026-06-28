import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-database.js";

// This file no longer contains hard-coded secrets. It expects the Firebase
// configuration to be provided at runtime via `window.__FIREBASE_CONFIG__`
// (recommended for static deployments) or via build-time environment
// variables (e.g. `process.env.FIREBASE_API_KEY`) injected by your bundler/CI.

const runtimeConfig = (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__) || (typeof process !== 'undefined' && process.env && {
			apiKey: "${{ secrets.FIREBASE_API_KEY }}",
			authDomain: "${{ secrets.FIREBASE_AUTH_DOMAIN }}",
			databaseURL: "${{ secrets.FIREBASE_DATABASE_URL }}",
			projectId: "${{ secrets.FIREBASE_PROJECT_ID }}",
			storageBucket: "${{ secrets.FIREBASE_STORAGE_BUCKET }}",
			messagingSenderId: "${{ secrets.FIREBASE_MESSAGING_SENDER_ID }}",
			appId: "${{ secrets.FIREBASE_APP_ID }}"
});

if (!runtimeConfig || !runtimeConfig.apiKey) {
  console.error("Firebase config not found. Provide window.__FIREBASE_CONFIG__ at runtime or set build env vars.");
}

const firebaseConfig = runtimeConfig || {};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { firebaseConfig, app, db };