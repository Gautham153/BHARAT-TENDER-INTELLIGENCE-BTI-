// Bharat Tender Intelligence (BTI) — Firebase Client Configuration
// Phase 1B: Real Authentication & Persistent RBAC Infrastructure

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const getEnvVar = (key: string): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.[key]) {
    return (import.meta as any).env[key];
  }
  if (typeof process !== 'undefined' && process?.env?.[key]) {
    return process.env[key] as string;
  }
  return '';
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY') || getEnvVar('FIREBASE_API_KEY'),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN') || getEnvVar('FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID') || getEnvVar('FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET') || getEnvVar('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID') || getEnvVar('FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('VITE_FIREBASE_APP_ID') || getEnvVar('FIREBASE_APP_ID'),
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.warn('[BTI Firebase] Initialization failed:', error);
  }
}

export { app, auth, db };
