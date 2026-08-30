// Bharat Tender Intelligence (BTI) — Firebase Authentication Gateway
// Phase 1B: Real Authentication & Institutional Identity Management

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
  type Unsubscribe,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';

/**
 * Maps Firebase Auth error codes to user-friendly institutional security messages.
 */
export function mapFirebaseAuthError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'An unexpected authentication error occurred. Please try again.';
  }

  const err = error as { code?: string; message?: string };
  const code = err.code || '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Invalid credentials. Please verify your email and password.';
    case 'auth/email-already-in-use':
      return 'An institutional or agency account is already registered with this email address.';
    case 'auth/weak-password':
      return 'Password security policy: Must be at least 8 characters with numbers and symbols.';
    case 'auth/invalid-email':
      return 'Please enter a valid official email address.';
    case 'auth/user-disabled':
      return 'This account has been administratively suspended by the BTI nodal administrator.';
    case 'auth/too-many-requests':
      return 'Access temporarily restricted due to multiple failed attempts. Please retry later or reset your password.';
    case 'auth/network-request-failed':
      return 'BTI security network connection timed out. Please check your internet connectivity.';
    case 'auth/operation-not-allowed':
      return 'Institutional email authentication is currently restricted by security policy.';
    default:
      return err.message || 'Authentication failed. Please verify your details.';
  }
}

/**
 * Sign in using official email and password with Firebase Authentication.
 */
export async function signInWithEmail(email: string, password: string): Promise<FirebaseUser> {
  if (!auth) {
    throw new Error('Authentication service is not configured.');
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
    return userCredential.user;
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error));
  }
}

/**
 * Register a new Agency user with Firebase Authentication.
 */
export async function createAgencyAccount(
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseUser> {
  if (!auth) {
    throw new Error('Authentication service is not configured.');
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName) {
      await updateProfile(userCredential.user, { displayName });
    }
    return userCredential.user;
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error));
  }
}

/**
 * Dispatch institutional password reset email.
 */
export async function sendResetEmail(email: string): Promise<void> {
  if (!auth) {
    throw new Error('Authentication service is not configured.');
  }

  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error));
  }
}

/**
 * Sign out the currently authenticated user.
 */
export async function signOutUser(): Promise<void> {
  if (!auth) return;
  try {
    await signOut(auth);
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error));
  }
}

/**
 * Subscribe to Firebase auth state changes.
 */
export function subscribeToAuthState(
  callback: (user: FirebaseUser | null) => void
): Unsubscribe {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}
