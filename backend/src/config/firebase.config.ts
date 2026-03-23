import {
  cert,
  initializeApp as initAdminApp,
  App as AdminApp,
} from 'firebase-admin/app';
import {
  getFirestore as getFirestoreAdmin,
  Firestore as AdminFirestore,
} from 'firebase-admin/firestore';

export interface FirebaseConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
  storageBucket: string;
}

let adminApp: AdminApp | null = null;
let adminDb: AdminFirestore | null = null;
let isInitialized = false;

export function initializeFirebase(config: FirebaseConfig): void {
  if (!config.projectId || !config.privateKey || !config.clientEmail) {
    console.warn(
      'Firebase credentials not fully configured - running in mock mode',
    );
    isInitialized = false;
    return;
  }

  // Initialize Firebase Admin with service account credentials
  try {
    adminApp = initAdminApp({
      credential: cert({
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: config.privateKey.replace(/\\n/g, '\n'),
      }),
    });
    adminDb = getFirestoreAdmin(adminApp);
    adminDb.settings({ ignoreUndefinedProperties: true });
    isInitialized = true;
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    isInitialized = false;
  }
}

export function isFirebaseInitialized(): boolean {
  return isInitialized;
}

import { getStorage, Storage } from 'firebase-admin/storage';

export function getFirebaseAdminDb(): AdminFirestore {
  if (!adminDb) {
    throw new Error('Firebase not initialized. Call initializeFirebase first.');
  }
  return adminDb;
}

export function getFirebaseAdminStorage(): Storage {
  if (!adminApp) {
    throw new Error('Firebase not initialized. Call initializeFirebase first.');
  }
  return getStorage(adminApp);
}
