import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '.';

let currentUser: User | null = null;
let authInitialized = false;

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
  return new Promise((resolve) => {
    if (!auth) {
      return resolve(null);
    }
    if (authInitialized) {
      return resolve(currentUser);
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}
