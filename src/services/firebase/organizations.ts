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
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import {
  Organization,
  VerificationStatus,
  VerificationResult,
  VerificationAuditAction,
} from '../../types/organization';
import { recordVerificationEvent } from './verificationEvents';

const ORG_STORAGE_PREFIX = 'bti_org_';
const ORG_REGISTRY_KEY = 'bti_org_registry_v1';

// Seed demo organizations for testing & evaluator fallback
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
 * Fetch Organization by ID
 */
export async function fetchOrganizationById(organizationId: string): Promise<Organization | null> {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'organizations', organizationId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        return null;
      }
      const data = snap.data() as Organization;
      // Sync local cache
      const localRegistry = getLocalRegistry();
      localRegistry[organizationId] = data;
      saveLocalRegistry(localRegistry);
      return data;
    } catch (err) {
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
 */
export async function fetchOrganizationByGstin(gstin: string): Promise<Organization | null> {
  const cleanGstin = gstin.trim().toUpperCase();

  if (isFirebaseConfigured && db) {
    try {
      const orgsRef = collection(db, 'organizations');
      const q = query(orgsRef, where('gstin', '==', cleanGstin), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) {
        return null;
      }
      const data = snap.docs[0].data() as Organization;
      const localRegistry = getLocalRegistry();
      localRegistry[data.organizationId] = data;
      saveLocalRegistry(localRegistry);
      return data;
    } catch (err) {
      throw new Error(
        `Failed to query organization by GSTIN from authoritative Firestore: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  // Explicit local/demo fallback
  const localRegistry = getLocalRegistry();
  const match = Object.values(localRegistry).find(
    (o) => o.gstin.trim().toUpperCase() === cleanGstin
  );
  return match || null;
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
  const orgId =
    params.organizationId ||
    `ORG-${gstStateCode}-${Date.now().toString(36).toUpperCase()}-${params.primaryUserId.slice(0, 4).toUpperCase()}`;
  const applicationId = params.applicationId || `BTI-REG-${Date.now().toString().slice(-4)}`;

  // Determine BTI Authorization vs Provider Outcome:
  // Statutory provider check result:
  const providerVerificationStatus = verification.status;
  // BTI District Nodal clearance status:
  let btiAuthorizationStatus: 'pending' | 'approved' | 'rejected' | 'under_review' = 'pending';
  let operationalStatus: VerificationStatus = 'pending';

  if (verification.status === 'failed') {
    btiAuthorizationStatus = 'rejected';
    operationalStatus = 'failed';
  } else if (verification.status === 'requires_review') {
    btiAuthorizationStatus = 'under_review';
    operationalStatus = 'requires_review';
  } else {
    // Both 'verified' and 'pending' provider results require Nodal Officer authorization before operational workspace access
    btiAuthorizationStatus = 'pending';
    operationalStatus = 'pending';
  }

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
    verificationCompletedAt: undefined,
    contactEmail: params.contactEmail.trim().toLowerCase(),
    contactPhone: params.contactPhone?.trim(),
    primaryUserId: params.primaryUserId,
    verified: false,
    applicationId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // 1. Persist to Firestore first if configured — must be authoritative in Firebase mode
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'organizations', orgId);
      await setDoc(docRef, newOrg);
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
    verificationCompletedAt: isVerified ? nowIso : current.verificationCompletedAt,
    rejectionReason: newStatus === 'failed' ? reviewer.reason : undefined,
    reviewNotes: reviewer.notes || current.reviewNotes,
    updatedAt: nowIso,
  };

  // 1. Update Firestore if configured — must be authoritative in Firebase mode
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'organizations', organizationId);
      await updateDoc(docRef, {
        verificationStatus: newStatus,
        btiAuthorizationStatus,
        verified: isVerified,
        verificationCompletedAt: isVerified ? nowIso : null,
        rejectionReason: updatedOrg.rejectionReason || null,
        reviewNotes: updatedOrg.reviewNotes || null,
        updatedAt: nowIso,
      });

      // Synchronize linked user profile in Firestore (mandatory in authoritative RBAC architecture)
      if (current.primaryUserId) {
        try {
          const userDocRef = doc(db, 'users', current.primaryUserId);
          await updateDoc(userDocRef, {
            verified: isVerified,
            verificationStatus: newStatus,
            updatedAt: nowIso,
          });
        } catch (userErr) {
          throw new Error(
            `Failed to synchronize user profile verification state in authoritative Firestore: ${
              userErr instanceof Error ? userErr.message : String(userErr)
            }`
          );
        }
      }
    } catch (err) {
      throw new Error(
        `Failed to update organization verification status in authoritative Firestore: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  // 2. Update local registry for cache / local mode support
  const registry = getLocalRegistry();
  registry[organizationId] = updatedOrg;
  saveLocalRegistry(registry);

  // 3. Record Audit Trail Action
  let auditAction: VerificationAuditAction = 'MARKED_FOR_REVIEW';
  if (newStatus === 'verified') auditAction = 'APPROVED';
  if (newStatus === 'failed') auditAction = 'REJECTED';
  if (newStatus === 'requires_review') auditAction = 'MARKED_FOR_REVIEW';
  if (newStatus === 'pending' && previousStatus === 'failed') auditAction = 'RETRY_REQUESTED';

  await recordVerificationEvent({
    organizationId,
    action: auditAction,
    actorId: reviewer.actorId,
    actorName: reviewer.actorName,
    actorRole: reviewer.actorRole,
    previousStatus,
    newStatus,
    source: reviewer.actorRole === 'government' ? 'gov-nodal-desk' : 'organization-service',
    notes: reviewer.notes || reviewer.reason || `Status updated from ${previousStatus} to ${newStatus}.`,
  });

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

      if (!filterStatus || filterStatus === 'all') {
        return firestoreList;
      }
      return firestoreList.filter((o) => o.verificationStatus === filterStatus);
    } catch (err) {
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
