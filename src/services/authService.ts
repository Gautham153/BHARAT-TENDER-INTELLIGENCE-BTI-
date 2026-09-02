// Bharat Tender Intelligence (BTI) — Authentication Service
// Phase 1B: Real Firebase Authentication & Persistent RBAC Infrastructure

import {
  AuthRole,
  AuthSession,
  AuthUser,
  LoginCredentials,
  AgencyRegistrationData,
  VerificationResult,
} from '../types/auth';
import { OrganizationVerificationService } from './organizationVerificationService';
import { createOrganizationRecord } from './firebase/organizations';
import { isFirebaseConfigured } from './firebase/firebase';
import {
  signInWithEmail,
  createAgencyAccount,
  sendResetEmail,
  signOutUser,
  subscribeToAuthState,
  mapFirebaseAuthError,
} from './firebase/auth';
import {
  fetchUserProfile,
  createAgencyUserProfile,
} from './firebase/users';

const AUTH_STORAGE_KEY = 'bti_auth_session_v1';
const DEMO_STORAGE_KEY = 'bti_demo_session_v1';


// Pre-defined synthetic demo profiles for evaluation and development
export const DEMO_USERS: Record<string, AuthUser> = {
  government: {
    id: 'usr-gov-001',
    uid: 'usr-gov-001',
    name: 'Dr. Alok Verma, IAS',
    email: 'alok.verma@gov.in',
    role: 'government',
    designation: 'District Magistrate & Nodal Officer',
    department: 'District Collectorate & MoSPI Nodal Desk',
    verified: true,
    verificationStatus: 'verified',
    createdAt: '2025-01-15T10:00:00Z',
  },
  agency: {
    id: 'usr-ag-001',
    uid: 'usr-ag-001',
    name: 'Er. Rajesh V. Sharma',
    email: 'rajesh@vikramadityainfra.in',
    role: 'agency',
    designation: 'Chief Project Engineer',
    agencyName: 'Vikramaditya Infrastructure Ltd',
    organizationId: 'ORG-VIKRAM-09A',
    gstin: '09AABCV9821L1ZS',
    phone: '+91 98765 43210',
    verified: true,
    verificationStatus: 'verified',
    createdAt: '2025-02-01T14:30:00Z',
  },
  pending_agency: {
    id: 'usr-ag-002',
    uid: 'usr-ag-002',
    name: 'Suresh Chandra Mehta',
    email: 'contact@apexbuildtech.in',
    role: 'agency',
    designation: 'Managing Director',
    agencyName: 'Apex BuildTech Enterprises',
    organizationId: 'ORG-APEX-27A',
    gstin: '27AABCA1234F1Z9',
    phone: '+91 98111 22334',
    verified: false,
    verificationStatus: 'pending',
    applicationId: 'BTI-REG-2026-8941',
    createdAt: new Date().toISOString(),
  },
};

export class AuthService {
  /**
   * Read stored cached session
   */
  static getSession(): AuthSession {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const user = JSON.parse(stored) as AuthUser;
        return {
          user,
          status: 'authenticated',
          token: `bti-token-${user.id || user.uid}`,
        };
      }
    } catch {
      // Fallback if storage access is restricted
    }
    return {
      user: null,
      status: 'unauthenticated',
      token: null,
    };
  }

  /**
   * Get current cached user
   */
  static getCurrentUser(): AuthUser | null {
    return this.getSession().user;
  }

  /**
   * Sign in with official credentials
   */
  static async signIn(credentials: LoginCredentials): Promise<AuthUser> {
    const { email, password, portal } = credentials;
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      throw new Error('Email address and password are required.');
    }

    // 1. Direct Demo Evaluator Bypass
    if (cleanEmail === DEMO_USERS.government.email) {
      const user = DEMO_USERS.government;
      try {
        localStorage.setItem(DEMO_STORAGE_KEY, 'true');
      } catch {
        // Storage unavailable
      }
      this.persistSession(user);
      return user;
    }
    if (cleanEmail === DEMO_USERS.agency.email) {
      if (portal === 'government') {
        throw new Error('This agency account is not authorized for the Government Portal. Please sign in via Agency Workspace.');
      }
      const user = DEMO_USERS.agency;
      try {
        localStorage.setItem(DEMO_STORAGE_KEY, 'true');
      } catch {
        // Storage unavailable
      }
      this.persistSession(user);
      return user;
    }
    if (cleanEmail === DEMO_USERS.pending_agency.email) {
      if (portal === 'government') {
        throw new Error('This account does not have government portal clearance.');
      }
      const user = DEMO_USERS.pending_agency;
      try {
        localStorage.setItem(DEMO_STORAGE_KEY, 'true');
      } catch {
        // Storage unavailable
      }
      this.persistSession(user);
      return user;
    }

    // 2. Real Firebase Authentication if configured
    if (isFirebaseConfigured) {
      try {
        const fbUser = await signInWithEmail(cleanEmail, password);
        
        // Remove demo session marker upon authenticating with real Firebase credentials
        try {
          localStorage.removeItem(DEMO_STORAGE_KEY);
        } catch {
          // Ignore
        }

        // Retrieve authoritative persistent user profile from Firestore /users/{uid}
        const profile = await fetchUserProfile(fbUser.uid);

        if (!profile) {
          // If no Firestore profile document exists, strictly deny access rather than inferring roles
          throw new Error('Account profile not found. Your institutional account has not been provisioned in the BTI Nodal Directory. Please contact your nodal administrator.');
        }

        // Validate portal role eligibility
        if (portal === 'government' && profile.role !== 'government') {
          throw new Error('Access Denied: This account is not authorized for the Government Intelligence Portal. Please sign in via the Agency Workspace.');
        }

        this.persistSession(profile);
        return profile;
      } catch (error) {
        throw new Error(mapFirebaseAuthError(error));
      }
    }

    // 3. Fallback when Firebase is not configured in the environment
    await new Promise((resolve) => setTimeout(resolve, 200));
    throw new Error(
      'Authentication service is not configured. For evaluation, please use the 1-Click Demo accounts or configure Firebase credentials.'
    );
  }

  /**
   * Fast Demo Login Helper (for SIH evaluators)
   */
  static async demoLogin(roleKey: 'government' | 'agency' | 'pending_agency'): Promise<AuthUser> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const user = DEMO_USERS[roleKey];
    if (!user) {
      throw new Error('Requested demo role profile not found.');
    }

    // If a real Firebase user session is currently active, terminate Firebase state before entering demo mode
    if (isFirebaseConfigured) {
      try {
        await signOutUser();
      } catch {
        // Safe to ignore in demo mode
      }
    }

    try {
      localStorage.setItem(DEMO_STORAGE_KEY, 'true');
    } catch {
      // Ignore
    }

    this.persistSession(user);
    return user;
  }

  /**
   * Register a new Agency user with Firebase Auth, Organization record, and Firestore profile
   */
  static async registerAgency(
    data: AgencyRegistrationData
  ): Promise<{ user: AuthUser; verificationResult: VerificationResult }> {
    // 1. Normalize GSTIN
    const cleanGstin = OrganizationVerificationService.normalizeGSTIN(data.gstin);

    // 2. Verify GSTIN format
    const formatCheck = OrganizationVerificationService.validateGSTINFormat(cleanGstin);
    if (!formatCheck.isValid) {
      throw new Error(formatCheck.error || 'Invalid GSTIN format. 15-character statutory format required.');
    }

    // 3. Duplicate Registration Check
    const duplicateCheck = await OrganizationVerificationService.checkDuplicateGSTIN(cleanGstin);
    if (duplicateCheck.isDuplicate && duplicateCheck.existingOrg) {
      if (duplicateCheck.existingOrg.verificationStatus !== 'failed') {
        throw new Error(
          duplicateCheck.message ||
            `An organization with GSTIN ${cleanGstin} is already registered on Bharat Tender Intelligence.`
        );
      }
    }

    // 4. Run Verification Check through Provider Abstraction
    const verification = await OrganizationVerificationService.verifyOrganization(cleanGstin, {
      legalName: data.companyName,
      businessCategory: data.businessCategory,
      state: data.state,
    });
    const applicationId = `BTI-REG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    if (isFirebaseConfigured) {
      try {
        // Remove demo session marker upon real registration
        try {
          localStorage.removeItem(DEMO_STORAGE_KEY);
        } catch {
          // Ignore
        }

        // Create user in Firebase Auth
        const fbUser = await createAgencyAccount(data.email, data.password, data.companyName);

        const orgId = `ORG-${cleanGstin}`;

        // Create persistent user profile in Firestore first (satisfies role == 'agency' requirement in firestore.rules)
        const profile = await createAgencyUserProfile(fbUser.uid, {
          name: data.companyName,
          email: data.email,
          agencyName: data.businessName || data.companyName,
          organizationId: orgId,
          gstin: cleanGstin,
          phone: data.phone,
          applicationId,
        });

        // Create Organization document in Firestore
        const org = await createOrganizationRecord(
          {
            organizationId: orgId,
            legalName: data.companyName,
            displayName: data.businessName || data.companyName,
            gstin: cleanGstin,
            state: data.state,
            businessCategory: data.businessCategory,
            registeredAddress: data.address,
            primaryUserId: fbUser.uid,
            contactEmail: data.email,
            contactPhone: data.phone,
            applicationId,
          },
          verification
        );

        verification.applicationId = applicationId;
        this.persistSession(profile);
        return { user: profile, verificationResult: verification };
      } catch (error) {
        throw new Error(mapFirebaseAuthError(error));
      }
    }

    // Fallback registration for local prototype
    await new Promise((resolve) => setTimeout(resolve, 350));
    const tempUid = `usr-ag-${Date.now().toString().slice(-5)}`;

    const org = await createOrganizationRecord(
      {
        legalName: data.companyName,
        displayName: data.businessName || data.companyName,
        gstin: cleanGstin,
        state: data.state,
        businessCategory: data.businessCategory,
        registeredAddress: data.address,
        primaryUserId: tempUid,
        contactEmail: data.email,
        contactPhone: data.phone,
        applicationId,
      },
      verification
    );

    const newUser: AuthUser = {
      id: tempUid,
      uid: tempUid,
      name: data.companyName,
      email: data.email.trim().toLowerCase(),
      role: 'agency',
      organizationId: org.organizationId,
      agencyName: data.businessName || data.companyName,
      gstin: cleanGstin,
      phone: data.phone,
      verified: verification.status === 'verified',
      verificationStatus: verification.status,
      applicationId,
      createdAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(DEMO_STORAGE_KEY, 'true');
    } catch {
      // Ignore
    }

    verification.applicationId = applicationId;
    this.persistSession(newUser);
    return { user: newUser, verificationResult: verification };
  }


  /**
   * Send password reset email
   */
  static async resetPassword(email: string): Promise<{ success: boolean; message: string }> {
    if (!email || !email.includes('@')) {
      throw new Error('Please provide a valid official email address.');
    }

    if (isFirebaseConfigured) {
      try {
        await sendResetEmail(email);
      } catch {
        // Maintain neutral security response
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return {
      success: true,
      message: 'If an account exists for this email, password reset instructions will be sent.',
    };
  }

  /**
   * Sign out and terminate active session
   */
  static async signOut(): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        await signOutUser();
      } catch {
        // Continue clearing local storage
      }
    }
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(DEMO_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }

  /**
   * Subscribe to real-time auth changes
   */
  static subscribeToAuthChanges(callback: (user: AuthUser | null) => void): () => void {
    if (isFirebaseConfigured) {
      return subscribeToAuthState(async (fbUser) => {
        if (!fbUser) {
          // If no Firebase user is authenticated, check if an explicit demo session is active
          try {
            const isDemo = localStorage.getItem(DEMO_STORAGE_KEY) === 'true';
            const currentUser = AuthService.getCurrentUser();
            if (isDemo && currentUser) {
              // Preserve evaluator demo session across page reloads
              callback(currentUser);
              return;
            }
          } catch {
            // Ignore
          }
          callback(null);
          return;
        }

        // Real Firebase user is authenticated
        try {
          try {
            localStorage.removeItem(DEMO_STORAGE_KEY);
          } catch {
            // Ignore
          }

          const profile = await fetchUserProfile(fbUser.uid);
          if (profile) {
            this.persistSession(profile);
            callback(profile);
          } else {
            // Profile not found in Firestore for authenticated Firebase user
            try {
              localStorage.removeItem(AUTH_STORAGE_KEY);
              localStorage.removeItem(DEMO_STORAGE_KEY);
            } catch {
              // Ignore
            }
            callback(null);
          }
        } catch {
          callback(null);
        }
      });
    }

    // Default no-op unsubscribe when Firebase is not connected
    return () => {};
  }

  /**
   * Persist session helper
   */
  static persistSession(user: AuthUser): void {
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Storage unavailable
    }
  }
}
