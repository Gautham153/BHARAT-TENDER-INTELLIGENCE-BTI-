// Bharat Tender Intelligence (BTI) — Authentication & Verification Types
// Phase 1 & 2A: Master Authentication & Organization Verification Types

import { VerificationStatus, VerificationResult } from './organization';

export type AuthRole = 'government' | 'agency' | 'public';

export type { VerificationStatus, VerificationResult } from './organization';
export type {
  Organization,
  VerificationEvent,
  VerificationAuditAction,
  VerificationProvider,
  GSTINValidationResult,
} from './organization';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthUser {
  id: string;
  uid?: string;
  name: string;
  email: string;
  role: AuthRole;
  designation?: string;
  department?: string;
  agencyName?: string;
  organizationId?: string;
  gstin?: string;
  phone?: string;
  avatarUrl?: string;
  verified: boolean;
  verificationStatus: VerificationStatus;
  applicationId?: string;
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser | null;
  status: AuthStatus;
  token?: string | null;
  expiresAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  portal?: AuthRole;
  rememberMe?: boolean;
}

export interface AgencyRegistrationData {
  companyName: string;
  email: string;
  phone: string;
  password: string;
  gstin: string;
  businessName: string;
  address: string;
  state: string;
  businessCategory: string;
  termsAccepted: boolean;
}

