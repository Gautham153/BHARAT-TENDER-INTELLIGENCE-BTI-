// Bharat Tender Intelligence (BTI) — Firestore Organizations Repository
// Phase 2A: Organization Data Model & Persistent State Management

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import {
  Organization,
  VerificationStatus,
  VerificationResult,
  VerificationAuditAction,
  VerificationEvent,
} from '../../types/organization';
import { recordVerificationEvent, saveLocalVerificationEvent } from './verificationEvents';

const ORG_STORAGE_PREFIX = 'bti_org_';
const ORG_REGISTRY_KEY = 'bti_org_registry_v1';
const DEMO_STORAGE_KEY = 'bti_demo_session_v1';

// Seed demo organizations for testing & evaluator review desk
export const SEED_DEMO_ORGANIZATIONS: Record<string, Organization> = {
  'ORG-VIKRAM-09A': {
    organizationId: 'ORG-VIKRAM-09A',
    legalName: 'Vikramaditya Infrastructure Ltd',
    displayName: 'Vikramaditya Infrastructure Ltd',
    gstin: '09AABCV9821L1ZS',
    gstStateCode: '09',
    businessCategory: 'Civil Infrastructure',
    registeredAddress: 'Plot 42, Vibhuti Khand, Gomti Nagar, Lucknow, Uttar Pradesh - 226010',
    state: 'Uttar Pradesh',
    verificationStatus: 'verified',
    providerVerificationStatus: 'verified',
    btiAuthorizationStatus: 'approved',
    verificationProvider: 'development-simulation',
    verificationReference: 'DEV-VERIF-09-8812',
    verificationRequestedAt: '2025-02-01T10:00:00Z',
    verificationCompletedAt: '2025-02-01T10:05:00Z',
    contactEmail: 'rajesh@vikramadityainfra.in',
    contactPhone: '+91 98765 43210',
    primaryUserId: 'usr-ag-001',
    verified: true,
    applicationId: 'BTI-REG-2025-1049',
    createdAt: '2025-02-01T10:00:00Z',
    updatedAt: '2025-02-01T10:05:00Z',
  },
  'ORG-APEX-27A': {
    organizationId: 'ORG-APEX-27A',
    legalName: 'Apex BuildTech Enterprises',
    displayName: 'Apex BuildTech Enterprises',
    gstin: '27AABCA1234F1Z9',
    gstStateCode: '27',
    businessCategory: 'Water & Sanitation',
    registeredAddress: 'Level 4, MIDC Industrial Area, Andheri East, Mumbai, Maharashtra - 400093',
    state: 'Maharashtra',
    verificationStatus: 'pending',
    providerVerificationStatus: 'pending',
    btiAuthorizationStatus: 'pending',
    verificationProvider: 'development-simulation',
    verificationReference: 'DEV-VERIF-27-4102',
    verificationRequestedAt: '2026-03-01T08:30:00Z',
    contactEmail: 'contact@apexbuildtech.in',
    contactPhone: '+91 98111 22334',
    primaryUserId: 'usr-ag-002',
    verified: false,
    applicationId: 'BTI-REG-2026-8941',
    createdAt: '2026-03-01T08:30:00Z',
    updatedAt: '2026-03-01T08:30:00Z',
  },
  'ORG-PATLIPUTRA-10A': {
    organizationId: 'ORG-PATLIPUTRA-10A',
    legalName: 'Patliputra Civil Constellation LLP',
    displayName: 'Patliputra Civil Constellation LLP',
    gstin: '10AABCR9999P1ZI',
    gstStateCode: '10',
    businessCategory: 'Civil Infrastructure',
    registeredAddress: 'Ashiana Nagar, Phase 2, Patna, Bihar - 800025',
    state: 'Bihar',
    verificationStatus: 'requires_review',
    providerVerificationStatus: 'requires_review',
    btiAuthorizationStatus: 'under_review',
    verificationProvider: 'development-simulation',
    verificationReference: 'DEV-VERIF-10-9904',
    verificationRequestedAt: '2026-03-02T09:15:00Z',
    reviewNotes: 'Flagged for multiple GST filings under identical PAN. District Nodal verification required.',
    contactEmail: 'patliputra.infra@biharmail.in',
    contactPhone: '+91 94310 55123',
    primaryUserId: 'usr-ag-003',
    verified: false,
    applicationId: 'BTI-REG-2026-4421',
    createdAt: '2026-03-02T09:15:00Z',
    updatedAt: '2026-03-02T09:15:00Z',
  },
  'ORG-BENGAL-19A': {
    organizationId: 'ORG-BENGAL-19A',
    legalName: 'Bengal Heavy Construction Syndicate',
    displayName: 'Bengal Heavy Construction Syndicate',
    gstin: '19AABCF0000X1ZE',
    gstStateCode: '19',
    businessCategory: 'Healthcare Infrastructure',
    registeredAddress: 'Sector V, Salt Lake City, Kolkata, West Bengal - 700091',
    state: 'West Bengal',
    verificationStatus: 'failed',
    providerVerificationStatus: 'failed',
    btiAuthorizationStatus: 'rejected',
    verificationProvider: 'development-simulation',
    verificationReference: 'DEV-VERIF-19-0011',
    verificationRequestedAt: '2026-03-02T11:00:00Z',
    rejectionReason: 'GSTIN reported inactive / composition scheme mismatch during verification.',
    contactEmail: 'admin@bengalheavyinfra.com',
    contactPhone: '+91 98300 44921',
    primaryUserId: 'usr-ag-004',
    verified: false,
    applicationId: 'BTI-REG-2026-1109',
    createdAt: '2026-03-02T11:00:00Z',
    updatedAt: '2026-03-02T11:00:00Z',
  },
};

function isDemoSession(): boolean {
  try {
    return localStorage.getItem(DEMO_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function getLocalRegistry(): Record<string, Organization> {
  try {
    const raw = localStorage.getItem(ORG_REGISTRY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...SEED_DEMO_ORGANIZATIONS, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...SEED_DEMO_ORGANIZATIONS };
}

function saveLocalRegistry(registry: Record<string, Organization>) {
  try {
    localStorage.setItem(ORG_REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // ignore
  }
}

/**
 * Fetch Organization by ID from authoritative Firestore
 */
export async function fetchOrganizationById(organizationId: string): Promise<Organization | null> {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'organizations', organizationId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as Organization;
        return data;
      }

      // If not in Firestore and an explicit demo session is active, check seed organizations
      if (isDemoSession() && SEED_DEMO_ORGANIZATIONS[organizationId]) {
        return SEED_DEMO_ORGANIZATIONS[organizationId];
      }

      return null;
    } catch (err) {
      // If demo session active and permission denied on Firestore, fall back to seed data
      if (isDemoSession() && SEED_DEMO_ORGANIZATIONS[organizationId]) {
        return SEED_DEMO_ORGANIZATIONS[organizationId];
      }

      throw new Error(
        `Failed to fetch organization ${organizationId} from authoritative Firestore: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  // Explicit local/demo fallback
  const localRegistry = getLocalRegistry();
  return localRegistry[organizationId] || null;
}

/**
 * Fetch Organization by normalized GSTIN (for duplicate detection)
 * Enforces authoritative Firestore validation and cryptographic uniqueness.
 */
export async function fetchOrganizationByGstin(gstin: string): Promise<Organization | null> {
  const cleanGstin = gstin.trim().toUpperCase();

  if (isFirebaseConfigured && db) {
    // If user is not authenticated in Firebase, Firestore security rules reject all reads.
    // An unauthenticated pre-registration check must NOT misinterpret missing auth as "organization exists" (BTI-EXISTING).
    if (!auth?.currentUser) {
      if (isDemoSession()) {
        const localRegistry = getLocalRegistry();
        const match = Object.values(localRegistry).find(
          (o) => o.gstin.trim().toUpperCase() === cleanGstin
        );
        return match || null;
      }
      return null;
    }

    try {
      // 1. Direct deterministic document check on /organizations/ORG-{GSTIN}
      const docRef = doc(db, 'organizations', `ORG-${cleanGstin}`);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as Organization;
        return data;
      }
      return null;
    } catch (err: unknown) {
      // In Firestore security rules, an authenticated agency can read a non-existent document (snap.exists() === false),
      // but if the document exists and belongs to another agency, Firestore returns 'permission-denied'.
      // For an authenticated caller, permission-denied cryptographically confirms the GSTIN is already registered.
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isPermissionDenied =
        (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'permission-denied') ||
        errorMsg.includes('permission-denied') ||
        errorMsg.includes('Missing or insufficient permissions');

      if (isPermissionDenied) {
        // Return duplicate sentinel record to block registration without exposing private tenant fields
        return {
          organizationId: `ORG-${cleanGstin}`,
          legalName: 'Registered Entity',
          displayName: 'Registered Entity',
          gstin: cleanGstin,
          gstStateCode: cleanGstin.substring(0, 2),
          businessCategory: 'Contractor',
          registeredAddress: '',
          state: '',
          verificationStatus: 'pending',
          btiAuthorizationStatus: 'pending',
          verificationProvider: 'statutory',
          verificationReference: 'STAT-EXISTING',
          verificationRequestedAt: new Date().toISOString(),
          contactEmail: '',
          primaryUserId: 'registered-representative',
          verified: false,
          applicationId: 'BTI-EXISTING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      // If in demo session and Firestore fails, check local registry
      if (isDemoSession()) {
        const localRegistry = getLocalRegistry();
        const match = Object.values(localRegistry).find(
          (o) => o.gstin.trim().toUpperCase() === cleanGstin
        );
        return match || null;
      }

      // Real non-permission Firestore fatal error must throw, not silently convert to null
      throw new Error(
        `Authoritative Firestore duplicate verification query failed: ${errorMsg}`
      );
    }
  }

  // Explicit local/demo fallback (only when genuinely in demo mode or Firebase not configured)
  if (isDemoSession() || !isFirebaseConfigured) {
    const localRegistry = getLocalRegistry();
    const match = Object.values(localRegistry).find(
      (o) => o.gstin.trim().toUpperCase() === cleanGstin
    );
    return match || null;
  }

  return null;
}

/**
 * Utility to strip undefined properties from an object so Firestore SDK does not reject it.
 * Preserves clean document representation and satisfies Firestore SDK constraints.
 */
export function sanitizeFirestorePayload<T extends Record<string, any>>(data: T): Partial<T> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as Partial<T>;
}

/**
 * Create new persistent Organization record
 */
export async function createOrganizationRecord(
  params: {
    organizationId?: string;
    legalName: string;
    displayName: string;
    gstin: string;
    state: string;
    businessCategory: string;
    registeredAddress: string;
    primaryUserId: string;
    contactEmail: string;
    contactPhone?: string;
    applicationId?: string;
  },
  verification: VerificationResult
): Promise<Organization> {
  const cleanGstin = params.gstin.trim().toUpperCase();
  const gstStateCode = cleanGstin.substring(0, 2);
  const nowIso = new Date().toISOString();
  const orgId = params.organizationId || `ORG-${cleanGstin}`;
  const applicationId = params.applicationId || `BTI-REG-${Date.now().toString().slice(-4)}`;

  // Determine BTI Authorization vs Provider Outcome:
  const providerVerificationStatus = verification.status;
  let btiAuthorizationStatus: 'pending' | 'approved' | 'rejected' | 'under_review' = 'pending';
  let operationalStatus: VerificationStatus = 'pending';

  if (verification.status === 'failed') {
    btiAuthorizationStatus = 'rejected';
    operationalStatus = 'failed';
  } else if (verification.status === 'requires_review') {
    btiAuthorizationStatus = 'under_review';
    operationalStatus = 'requires_review';
  } else {
    btiAuthorizationStatus = 'pending';
    operationalStatus = 'pending';
  }

  // Construct clean organization record omitting optional fields when undefined
  const newOrg: Organization = {
    organizationId: orgId,
    legalName: params.legalName.trim(),
    displayName: params.displayName.trim() || params.legalName.trim(),
    gstin: cleanGstin,
    gstStateCode,
    businessCategory: params.businessCategory,
    registeredAddress: params.registeredAddress.trim(),
    state: params.state,
    verificationStatus: operationalStatus,
    providerVerificationStatus,
    btiAuthorizationStatus,
    verificationProvider: verification.provider || 'development-simulation',
    verificationReference: verification.reference || `DEV-VERIF-${Date.now()}`,
    verificationRequestedAt: nowIso,
    contactEmail: params.contactEmail.trim().toLowerCase(),
    primaryUserId: params.primaryUserId,
    verified: false,
    applicationId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  if (params.contactPhone?.trim()) {
    newOrg.contactPhone = params.contactPhone.trim();
  }

  // 1. Persist to Firestore first if configured — must be authoritative in Firebase mode
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'organizations', orgId);
      const firestorePayload = sanitizeFirestorePayload(newOrg);
      await setDoc(docRef, firestorePayload);
    } catch (err) {
      throw new Error(
        `Failed to persist organization to authoritative Firestore: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  // 2. Save to local registry for cache / local mode support
  const registry = getLocalRegistry();
  registry[orgId] = newOrg;
  saveLocalRegistry(registry);

  // 3. Record Audit Event (await authoritative audit trail)
  await recordVerificationEvent({
    organizationId: orgId,
    action: 'SUBMITTED',
    actorId: params.primaryUserId,
    actorName: params.displayName || params.legalName,
    actorRole: 'agency',
    previousStatus: 'not_started',
    newStatus: operationalStatus,
    source: 'onboarding-wizard',
    reference: verification.reference,
    notes: `Organization registered with GSTIN ${cleanGstin}. Statutory provider outcome: ${providerVerificationStatus.toUpperCase()}. Nodal review pending.`,
  });

  return newOrg;
}

/**
 * Update verification status (Gov Nodal Desk / Review Action)
 */
export async function updateOrganizationVerificationStatus(
  organizationId: string,
  newStatus: VerificationStatus,
  reviewer: {
    actorId: string;
    actorName: string;
    actorRole: 'government' | 'agency' | 'system';
    notes?: string;
    reason?: string;
  }
): Promise<Organization> {
  const current = await fetchOrganizationById(organizationId);
  if (!current) {
    throw new Error(`Organization ${organizationId} not found.`);
  }

  const nowIso = new Date().toISOString();
  const previousStatus = current.verificationStatus;
  const isVerified = newStatus === 'verified';

  let btiAuthorizationStatus: 'pending' | 'approved' | 'rejected' | 'under_review' = current.btiAuthorizationStatus || 'pending';
  if (newStatus === 'verified') btiAuthorizationStatus = 'approved';
  else if (newStatus === 'failed') btiAuthorizationStatus = 'rejected';
  else if (newStatus === 'requires_review') btiAuthorizationStatus = 'under_review';
  else if (newStatus === 'pending') btiAuthorizationStatus = 'pending';

  const updatedOrg: Organization = {
    ...current,
    verificationStatus: newStatus,
    btiAuthorizationStatus,
    verified: isVerified,
    updatedAt: nowIso,
  };

  if (isVerified) {
    updatedOrg.verificationCompletedAt = nowIso;
  } else if (current.verificationCompletedAt) {
    updatedOrg.verificationCompletedAt = current.verificationCompletedAt;
  }

  if (newStatus === 'failed' && reviewer.reason?.trim()) {
    updatedOrg.rejectionReason = reviewer.reason.trim();
  } else if (current.rejectionReason && newStatus !== 'verified') {
    updatedOrg.rejectionReason = current.rejectionReason;
  }

  if (reviewer.notes?.trim()) {
    updatedOrg.reviewNotes = reviewer.notes.trim();
  } else if (current.reviewNotes) {
    updatedOrg.reviewNotes = current.reviewNotes;
  }

  // 1. Prepare Audit Trail Event Record
  let auditAction: VerificationAuditAction = 'MARKED_FOR_REVIEW';
  if (newStatus === 'verified') auditAction = 'APPROVED';
  if (newStatus === 'failed') auditAction = 'REJECTED';
  if (newStatus === 'requires_review') auditAction = 'MARKED_FOR_REVIEW';
  if (newStatus === 'pending' && previousStatus === 'failed') auditAction = 'RETRY_REQUESTED';

  const auditEventId = `EVT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const auditEvent: VerificationEvent = {
    eventId: auditEventId,
    organizationId,
    action: auditAction,
    actorId: reviewer.actorId,
    actorName: reviewer.actorName,
    actorRole: reviewer.actorRole,
    previousStatus,
    newStatus,
    timestamp: nowIso,
    source: reviewer.actorRole === 'government' ? 'gov-nodal-desk' : 'organization-service',
    notes: reviewer.notes || reviewer.reason || `Status updated from ${previousStatus} to ${newStatus}.`,
  };

  // 2. Perform Atomic Write via Firestore writeBatch if Firebase is configured
  if (isFirebaseConfigured && db) {
    try {
      const batch = writeBatch(db);

      // (a) Organization document update — restricted strictly to permitted adjudication fields
      const orgDocRef = doc(db, 'organizations', organizationId);
      const orgUpdatePayload: Record<string, any> = {
        verificationStatus: newStatus,
        btiAuthorizationStatus,
        verified: isVerified,
        updatedAt: nowIso,
      };

      if (isVerified) {
        orgUpdatePayload.verificationCompletedAt = nowIso;
      }
      if (updatedOrg.rejectionReason) {
        orgUpdatePayload.rejectionReason = updatedOrg.rejectionReason;
      }
      if (updatedOrg.reviewNotes) {
        orgUpdatePayload.reviewNotes = updatedOrg.reviewNotes;
      }

      batch.update(orgDocRef, sanitizeFirestorePayload(orgUpdatePayload));

      // (b) Linked user document update — synchronize role profile
      if (current.primaryUserId) {
        const userDocRef = doc(db, 'users', current.primaryUserId);
        batch.update(userDocRef, sanitizeFirestorePayload({
          verified: isVerified,
          verificationStatus: newStatus,
          updatedAt: nowIso,
        }));
      }

      // (c) Verification audit event document create — append immutable trace log
      const auditDocRef = doc(db, 'verificationEvents', auditEventId);
      batch.set(auditDocRef, sanitizeFirestorePayload(auditEvent));

      // Commit all 3 document operations atomically
      await batch.commit();
    } catch (err) {
      console.error('Authoritative batch adjudication commit failed in Firestore:', err);
      if (!isDemoSession()) {
        throw new Error(
          `Adjudication update could not be committed to authoritative Firestore: ${
            err instanceof Error ? err.message : String(err)
          }. No partial state changes were applied.`
        );
      }
    }
  }

  // 3. Update local caches only after successful authoritative persistence
  const registry = getLocalRegistry();
  registry[organizationId] = updatedOrg;
  saveLocalRegistry(registry);

  saveLocalVerificationEvent(auditEvent);

  return updatedOrg;
}

/**
 * List all organizations for Government Verification Review Queue
 */
export async function listOrganizationsForGovReview(
  filterStatus?: VerificationStatus | 'all'
): Promise<Organization[]> {
  if (isFirebaseConfigured && db) {
    try {
      const orgsRef = collection(db, 'organizations');
      const snap = await getDocs(orgsRef);
      const firestoreList: Organization[] = [];
      snap.forEach((d) => {
        firestoreList.push(d.data() as Organization);
      });

      firestoreList.sort(
        (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
      );

      // In real Firebase mode (!isDemoSession), return ONLY authentic Firestore records (no synthetic mixing)
      if (!isDemoSession()) {
        if (!filterStatus || filterStatus === 'all') {
          return firestoreList;
        }
        return firestoreList.filter((o) => o.verificationStatus === filterStatus);
      }

      // In Demo Mode (isDemoSession), return demo records (merged with any local Firestore records if present)
      const firestoreIds = new Set(firestoreList.map((o) => o.organizationId));
      const demoExtras = Object.values(SEED_DEMO_ORGANIZATIONS).filter(
        (s) => !firestoreIds.has(s.organizationId)
      );
      const combined = [...firestoreList, ...demoExtras];
      combined.sort(
        (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
      );

      if (!filterStatus || filterStatus === 'all') {
        return combined;
      }
      return combined.filter((o) => o.verificationStatus === filterStatus);
    } catch (err) {
      // If Firestore fails in demo mode, fall back to seed data
      if (isDemoSession()) {
        const seedList = Object.values(SEED_DEMO_ORGANIZATIONS);
        seedList.sort(
          (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
        );
        if (!filterStatus || filterStatus === 'all') {
          return seedList;
        }
        return seedList.filter((o) => o.verificationStatus === filterStatus);
      }

      throw new Error(
        `Failed to fetch organization review queue from authoritative Firestore: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  // Explicit local/demo fallback
  const localRegistry = getLocalRegistry();
  const orgList = Object.values(localRegistry);
  orgList.sort(
    (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
  );

  if (!filterStatus || filterStatus === 'all') {
    return orgList;
  }

  return orgList.filter((o) => o.verificationStatus === filterStatus);
}
