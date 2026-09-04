// Bharat Tender Intelligence (BTI) — Firestore User Profile Repository
// Phase 1B: Persistent RBAC & Institutional Profile Storage

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { AuthUser, AuthRole, VerificationStatus } from '../../types/auth';

export interface FirestoreUserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: AuthRole;
  organizationId?: string;
  organizationName?: string;
  designation?: string;
  department?: string;
  gstin?: string;
  phone?: string;
  verified: boolean;
  verificationStatus: VerificationStatus;
  applicationId?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export class FirestorePermissionError extends Error {
  constructor(operation: string, path: string) {
    super(`Firestore permission denied during ${operation} at ${path}.`);
    this.name = 'FirestorePermissionError';
  }
}

function handleFirestoreError(error: unknown, operation: string, path: string): never {
  const err = error as { code?: string; message?: string };
  if (err?.code === 'permission-denied') {
    throw new FirestorePermissionError(operation, path);
  }
  throw error;
}

/**
 * Fetch persistent user profile from Firestore /users/{uid}
 */
export async function fetchUserProfile(uid: string): Promise<AuthUser | null> {
  if (!db) return null;

  const path = `users/${uid}`;
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);

    if (!snap.exists()) {
      return null;
    }

    const data = snap.data();
    return {
      id: data.uid || uid,
      uid: data.uid || uid,
      name: data.displayName || data.name || 'BTI User',
      email: data.email || '',
      role: (data.role as AuthRole) || 'agency',
      organizationId: data.organizationId,
      agencyName: data.organizationName || data.agencyName,
      department: data.department,
      designation: data.designation,
      gstin: data.gstin,
      phone: data.phone,
      verified: Boolean(data.verified),
      verificationStatus: (data.verificationStatus as VerificationStatus) || 'pending',
      applicationId: data.applicationId,
      createdAt: data.createdAt ? String(data.createdAt) : new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, 'get', path);
  }
}

function sanitizeFirestorePayload<T extends Record<string, any>>(data: T): Partial<T> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as Partial<T>;
}

/**
 * Create a new user profile document in Firestore upon Agency registration.
 * Role is strictly locked to 'agency' and verificationStatus to 'pending' to satisfy security rules.
 */
export async function createAgencyUserProfile(
  uid: string,
  profile: {
    name: string;
    email: string;
    agencyName: string;
    organizationId?: string;
    gstin?: string;
    phone?: string;
    designation?: string;
    applicationId?: string;
  }
): Promise<AuthUser> {
  if (!db) {
    throw new Error('Database service is not initialized.');
  }

  const path = `users/${uid}`;
  const nowIso = new Date().toISOString();
  const organizationId =
    profile.organizationId ||
    `ORG-${Date.now().toString(36).toUpperCase()}-${uid.slice(0, 4).toUpperCase()}`;

  const firestoreData: Record<string, any> = {
    uid,
    displayName: profile.name?.trim() || '',
    email: profile.email?.toLowerCase().trim() || '',
    role: 'agency' as const,
    organizationId,
    organizationName: profile.agencyName?.trim() || '',
    gstin: profile.gstin?.toUpperCase().trim() || '',
    phone: profile.phone?.trim() || '',
    designation: profile.designation?.trim() || '',
    verified: false,
    verificationStatus: 'pending' as const,
    applicationId: profile.applicationId || `APP-${Date.now()}`,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, sanitizeFirestorePayload(firestoreData));

    return {
      id: uid,
      uid,
      name: profile.name,
      email: profile.email,
      role: 'agency',
      organizationId,
      agencyName: profile.agencyName,
      designation: profile.designation,
      gstin: profile.gstin,
      phone: profile.phone,
      verified: false,
      verificationStatus: 'pending',
      applicationId: firestoreData.applicationId,
      createdAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, 'create', path);
  }
}


/**
 * Update allowed fields for user profile in Firestore
 */
export async function updateUserProfile(
  uid: string,
  updates: Partial<Pick<AuthUser, 'name' | 'phone' | 'designation' | 'agencyName'>>
): Promise<void> {
  if (!db) return;

  const path = `users/${uid}`;
  const firestoreUpdates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (updates.name !== undefined) firestoreUpdates.displayName = updates.name.trim();
  if (updates.phone !== undefined) firestoreUpdates.phone = updates.phone.trim();
  if (updates.designation !== undefined) firestoreUpdates.designation = updates.designation.trim();
  if (updates.agencyName !== undefined) firestoreUpdates.organizationName = updates.agencyName.trim();

  try {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, sanitizeFirestorePayload(firestoreUpdates));
  } catch (error) {
    handleFirestoreError(error, 'update', path);
  }
}
