import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '.';

let currentUser: User | null = null;
let authInitialized = false;
let initialAuthPromise: Promise<User | null> | null = null;

if (auth) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    authInitialized = true;
  });
}

/**
 * Returns a promise that resolves with the current authenticated user.
 * This function waits for the initial auth state to be resolved before returning.
 */
export function getCurrentUser(): Promise<User | null> {
  const currentAuth = auth;
  if (!currentAuth) {
    return Promise.resolve(null);
  }
  if (authInitialized) {
    return Promise.resolve(currentUser);
  }
  if (!initialAuthPromise) {
    initialAuthPromise = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(currentAuth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }
  return initialAuthPromise;
}
