// Bharat Tender Intelligence (BTI) — Proposal Management & Audit Service
// Phase 4: Agency Proposal Submission, Government Proposal Inbox & Append-Only Audit Trail

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured, auth } from './firebase';
import {
  Proposal,
  ProposalStatus,
  CanonicalProposalStatus,
  ProposalAuditEvent,
  ProposalAuditAction,
  TechnicalProposal,
  ImplementationPlan,
  FinancialProposal,
  TimelineProposal,
  ExperienceProposal,
  ComplianceDeclarations,
  ProposalDocument,
} from '../../types/proposal';
import { Tender, getEffectiveTenderStatus } from '../../types/tender';
import { Organization } from '../../types/organization';
import { AuthUser } from '../../types/auth';
import { mockProposals } from '../../data/mockData';

const PROPOSALS_COLLECTION = 'proposals';
const PROPOSAL_EVENTS_COLLECTION = 'proposalEvents';
const LOCAL_STORAGE_PROPOSALS_KEY = 'bti_proposals_cache_v1';
const LOCAL_STORAGE_EVENTS_KEY = 'bti_proposal_events_cache_v1';

/**
 * Generates an authoritative unique Proposal Number.
 * Format: BTI/PROP/{YEAR}/{SEQUENCE}
 */
export function generateProposalNumber(): string {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `BTI/PROP/${year}/${randomSuffix}`;
}

/**
 * Validates whether a proposal status transition is legally permitted in the governance lifecycle.
 */
export function isValidProposalTransition(prev: ProposalStatus, next: CanonicalProposalStatus): boolean {
  const p = prev.toUpperCase().replace(/\s+/g, '_');
  const n = next.toUpperCase().replace(/\s+/g, '_');

  if (p === n) return true;

  switch (p) {
    case 'DRAFT':
      return n === 'SUBMITTED';
    case 'SUBMITTED':
      return n === 'UNDER_REVIEW' || n === 'WITHDRAWN';
    case 'UNDER_REVIEW':
      return n === 'SHORTLISTED' || n === 'REJECTED';
    case 'SHORTLISTED':
      return n === 'AWARDED' || n === 'REJECTED';
    case 'WITHDRAWN':
    case 'REJECTED':
    case 'AWARDED':
      return false;
    default:
      return false;
  }
}

// Local cache helper functions for demo resilience & offline capabilities
function getLocalProposals(): Proposal[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PROPOSALS_KEY);
    if (!raw) {
      // Seed with initial transformed mock data if empty
      const initial: Proposal[] = (mockProposals as any[]).map((mp, idx) => ({
        id: mp.id || `prop-seed-${idx + 1}`,
        proposalNumber: mp.proposalNumber || `BTI/PROP/2026/000${idx + 1}`,
        tenderId: mp.tenderId,
        tenderNumber: mp.tenderNumber,
        tenderTitle: mp.tenderTitle,
        tenderEstimatedValue: 12500000,
        tenderClosingDate: '2026-11-30',
        organizationId: mp.agencyId || 'org-demo-1',
        organizationName: mp.agencyName || 'National Civil Infra Ltd.',
        organizationGstin: mp.agencyGstin || '27AABCN1234F1Z5',
        submittedBy: 'agency-user-1',
        submittedByName: mp.agencyName || 'Authorized Signatory',
        submittedByEmail: 'contractor@infra.gov.in',
        status: (mp.status === 'Submitted' ? 'SUBMITTED' : mp.status === 'Under Review' ? 'UNDER_REVIEW' : 'SUBMITTED') as CanonicalProposalStatus,
        technicalProposal: {
          technicalApproach: mp.technicalApproach || 'Turnkey EPC execution with standardized pre-cast structural components, SCADA telemetric sensors, and dual-layer waterproof foundations.',
          proposedSolution: 'Automated telemetry water purifiers and high-durability ductile iron distribution channels.',
          scopeUnderstanding: 'Complete civil works, electrical sub-station commissioning, and 5-year maintenance assurance.',
          technicalMethodology: 'PERT/CPM critical path project management with weekly drone orthomosaic site surveys.',
          keyDeliverables: 'Structural design approval, civil foundation, electrical grid connection, operational test run, and hand-over certificate.',
          qualityAssuranceApproach: 'Strict adherence to IS 456:2000 civil standards, daily concrete slump tests, and third-party NABL lab audits.',
          technicalAssumptions: 'Right-of-way approvals and state electricity board utility clearances provided on schedule.',
        },
        implementationPlan: {
          implementationApproach: 'Sequential phased mobilization with parallel civil foundation casting.',
          projectPhases: 'Phase 1: Site survey & excavation; Phase 2: Structural foundation; Phase 3: Mechanical & electrical fit-out; Phase 4: Commissioning.',
          milestones: [
            { id: 'm1', title: 'Mobilization & Geotechnical Survey', description: 'Equipment mobilization and soil bearing tests', expectedCompletion: 'Month 1' },
            { id: 'm2', title: 'Plinth Level Civil Construction', description: 'RCC foundation and retaining walls', expectedCompletion: 'Month 3' },
            { id: 'm3', title: 'Superstructure & Mechanical Fit-out', description: 'Structural steel and pump installations', expectedCompletion: 'Month 5' },
            { id: 'm4', title: 'Final Testing & Commissioning', description: '72-hour continuous test run and hand-over', expectedCompletion: 'Month 6' },
          ],
          resourcePlan: '1 Chief Project Engineer, 4 Civil Site Supervisors, 2 Safety Officers, and 45 certified skilled tradespersons.',
          riskConsiderations: 'Monsoon flooding mitigated by temporary high-capacity dewatering pumps and elevated material storage.',
          completionStrategy: 'Fast-track modular assembly with staggered two-shift working schedules.',
        },
        financialProposal: {
          baseAmount: mp.financialBidAmount || 11800000,
          taxAmount: Math.round((mp.financialBidAmount || 11800000) * 0.18),
          totalProposedAmount: Math.round((mp.financialBidAmount || 11800000) * 1.18),
          costBreakdown: 'Civil Works: 65%, Electro-mechanical: 20%, Engineering & Supervision: 8%, Contingency: 7%',
          paymentMilestones: '10% Advance against Bank Guarantee, 30% on Plinth completion, 40% on Superstructure, 20% on Final Commissioning',
        },
        timeline: {
          proposedDurationValue: 6,
          proposedDurationUnit: 'months',
          proposedStartDate: '2026-10-01',
          proposedCompletionDate: '2027-03-31',
        },
        experience: {
          relevantExperienceSummary: 'Over 12 years executing rural infrastructure, water supply, and public works under state and central programs.',
          yearsOfExperience: 12,
          keyCapabilities: 'Grade-A registered contractor, in-house fleet of earthmovers and concrete batching equipment.',
          availableResources: 'Fully owned batching plants, transit mixers, surveying stations, and mobile testing labs.',
          technicalPersonnel: '12 full-time licensed civil engineers and 3 chartered structural consultants.',
          pastProjects: [
            {
              id: 'p1',
              projectName: 'Regional Rural Water Pipeline Scheme',
              clientAuthority: 'Maharashtra Water Supply Board',
              projectCategory: 'Water & Sanitation',
              value: 18500000,
              year: '2024',
              description: 'Laying 42 km of ductile iron pipeline and constructing 3 overhead reservoir tanks.',
            },
          ],
        },
        complianceDeclarations: {
          accuracyConfirmed: true,
          eligibilitySatisfied: true,
          documentsAuthentic: true,
          termsAgreed: true,
          declaredAt: '2026-08-15T10:30:00Z',
          declaredBy: 'Authorized Director',
        },
        supportingDocuments: [
          {
            id: 'doc-1',
            proposalId: mp.id,
            documentType: 'Statutory GSTIN Certificate',
            fileName: 'GSTIN_Registration_Certificate.pdf',
            fileSize: '1.2 MB',
            uploadedBy: 'agency-user-1',
            uploadedAt: '2026-08-15T10:00:00Z',
            verificationStatus: 'ACCEPTED',
          },
          {
            id: 'doc-2',
            proposalId: mp.id,
            documentType: 'Technical Experience Certificate',
            fileName: 'Works_Completion_Certificate_2024.pdf',
            fileSize: '3.4 MB',
            uploadedBy: 'agency-user-1',
            uploadedAt: '2026-08-15T10:15:00Z',
            verificationStatus: 'ACCEPTED',
          },
        ],
        createdAt: '2026-08-14T09:00:00Z',
        updatedAt: '2026-08-15T10:30:00Z',
        submittedAt: '2026-08-15T10:30:00Z',
        financialBidAmount: mp.financialBidAmount,
        technicalScore: mp.technicalScore,
        aiEvaluationScore: mp.aiEvaluationScore,
        collusionRiskScore: mp.collusionRiskScore,
        collusionRiskLevel: mp.collusionRiskLevel,
        submissionDate: mp.submissionDate,
        agencyName: mp.agencyName,
        agencyGstin: mp.agencyGstin,
      }));
      localStorage.setItem(LOCAL_STORAGE_PROPOSALS_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalProposals(proposals: Proposal[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_PROPOSALS_KEY, JSON.stringify(proposals));
  } catch (err) {
    console.warn('Failed to save proposals to localStorage:', err);
  }
}

function getLocalEvents(): ProposalAuditEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalEvents(events: ProposalAuditEvent[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_EVENTS_KEY, JSON.stringify(events));
  } catch (err) {
    console.warn('Failed to save proposal events to localStorage:', err);
  }
}

export class ProposalService {
  /**
   * Retrieves a single proposal by its authoritative ID.
   */
  static async getProposalById(proposalId: string): Promise<Proposal | null> {
    if (!proposalId) return null;

    if (isFirebaseConfigured && db) {
      try {
        const ref = doc(db, PROPOSALS_COLLECTION, proposalId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() } as Proposal;
        }
      } catch (err) {
        console.warn('Firestore getProposalById failed, checking local cache:', err);
      }
    }

    const local = getLocalProposals();
    return local.find((p) => p.id === proposalId) || null;
  }

  /**
   * Retrieves all proposals submitted for a specific Tender (Government Inbox).
   */
  static async getProposalsByTenderId(tenderId: string): Promise<Proposal[]> {
    if (!tenderId) return [];

    if (isFirebaseConfigured && db) {
      try {
        const ref = collection(db, PROPOSALS_COLLECTION);
        const q = query(ref, where('tenderId', '==', tenderId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const list: Proposal[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Proposal));
          return list.sort(
            (a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
          );
        }
      } catch (err) {
        console.warn('Firestore getProposalsByTenderId failed, falling back to local cache:', err);
      }
    }

    const local = getLocalProposals();
    return local
      .filter((p) => p.tenderId === tenderId)
      .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
  }

  /**
   * Retrieves all proposals submitted by or belonging to an Organization (Agency "My Proposals").
   */
  static async getProposalsByOrganizationId(organizationId: string): Promise<Proposal[]> {
    if (!organizationId) return [];

    if (isFirebaseConfigured && db) {
      try {
        const ref = collection(db, PROPOSALS_COLLECTION);
        const q = query(ref, where('organizationId', '==', organizationId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const list: Proposal[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Proposal));
          return list.sort(
            (a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
          );
        }
      } catch (err) {
        console.warn('Firestore getProposalsByOrganizationId failed, falling back to local cache:', err);
      }
    }

    const local = getLocalProposals();
    return local
      .filter((p) => p.organizationId === organizationId)
      .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
  }

  /**
   * Retrieves all proposals (Government Review Portal).
   */
  static async getAllProposals(): Promise<Proposal[]> {
    if (isFirebaseConfigured && db) {
      try {
        const ref = collection(db, PROPOSALS_COLLECTION);
        const snap = await getDocs(ref);
        if (!snap.empty) {
          const list: Proposal[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Proposal));
          return list.sort(
            (a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
          );
        }
      } catch (err) {
        console.warn('Firestore getAllProposals failed, falling back to local cache:', err);
      }
    }

    const local = getLocalProposals();
    return local.sort(
      (a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
    );
  }

  /**
   * Checks for an active proposal for a given tender and organization (Duplicate Prevention).
   * Returns the active proposal (DRAFT or SUBMITTED) if one exists.
   */
  static async getActiveProposalForTenderAndOrg(
    tenderId: string,
    organizationId: string
  ): Promise<Proposal | null> {
    if (!tenderId || !organizationId) return null;

    if (isFirebaseConfigured && db) {
      try {
        const ref = collection(db, PROPOSALS_COLLECTION);
        const q = query(
          ref,
          where('tenderId', '==', tenderId),
          where('organizationId', '==', organizationId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const proposals: Proposal[] = [];
          snap.forEach((d) => proposals.push({ id: d.id, ...d.data() } as Proposal));
          // Return non-withdrawn proposal
          const active = proposals.find((p) => p.status !== 'WITHDRAWN');
          if (active) return active;
        }
      } catch (err) {
        console.warn('Firestore getActiveProposalForTenderAndOrg error, checking local:', err);
      }
    }

    const local = getLocalProposals();
    return (
      local.find(
        (p) => p.tenderId === tenderId && p.organizationId === organizationId && p.status !== 'WITHDRAWN'
      ) || null
    );
  }

  /**
   * Creates an initial DRAFT proposal for a verified agency on a LIVE tender.
   * Enforces verification requirements, tender status, and deadline.
   */
  static async createDraftProposal(params: {
    tender: Tender;
    organization: Organization;
    user: AuthUser;
    initialData?: Partial<Proposal>;
  }): Promise<Proposal> {
    const { tender, organization, user, initialData } = params;

    // 1. Verify organization status
    if (organization.verificationStatus !== 'verified') {
      throw new Error(
        'Proposal creation blocked: Your organization must be verified by the Nodal Authority before preparing or submitting proposals.'
      );
    }

    // 2. Verify tender is LIVE and not closed or expired
    const effectiveStatus = getEffectiveTenderStatus(tender);
    if (effectiveStatus !== 'LIVE' && tender.status !== 'PUBLISHED' && tender.status !== 'Open') {
      throw new Error(
        `Proposal creation blocked: Tender ${tender.tenderNumber} is currently in '${effectiveStatus}' status and is not accepting proposals.`
      );
    }

    // 3. Deadline verification
    if (tender.closingDate) {
      const deadline = new Date(tender.closingDate).getTime();
      if (!isNaN(deadline) && Date.now() >= deadline) {
        throw new Error(
          'Proposal creation blocked: The submission deadline for this tender has elapsed.'
        );
      }
    }

    // 4. Duplicate Check: Ensure no active draft or submission already exists
    const existingActive = await this.getActiveProposalForTenderAndOrg(tender.id, organization.organizationId);
    if (existingActive) {
      return existingActive;
    }

    const proposalId = `prop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const proposalNumber = generateProposalNumber();
    const nowIso = new Date().toISOString();
    const userUid = user.uid || user.id;

    const newProposal: Proposal = {
      id: proposalId,
      proposalNumber,
      tenderId: tender.id,
      tenderNumber: tender.tenderNumber,
      tenderTitle: tender.title,
      tenderEstimatedValue: tender.estimatedValue || tender.sanctionedAmount,
      tenderClosingDate: tender.closingDate,
      organizationId: organization.organizationId,
      organizationName: organization.legalName,
      organizationGstin: organization.gstin,
      submittedBy: userUid,
      submittedByName: user.name || organization.legalName,
      submittedByEmail: user.email || '',
      status: 'DRAFT',
      technicalProposal: initialData?.technicalProposal || {
        technicalApproach: '',
        proposedSolution: '',
        scopeUnderstanding: '',
        technicalMethodology: '',
        keyDeliverables: '',
        qualityAssuranceApproach: '',
        technicalAssumptions: '',
      },
      implementationPlan: initialData?.implementationPlan || {
        implementationApproach: '',
        projectPhases: '',
        milestones: [
          {
            id: 'ms-1',
            title: 'Initial Mobilization & Survey',
            description: 'Site survey, mobilization of equipment, and statutory approvals.',
            expectedCompletion: 'Month 1',
          },
        ],
        resourcePlan: '',
        riskConsiderations: '',
        completionStrategy: '',
      },
      financialProposal: initialData?.financialProposal || {
        baseAmount: 0,
        taxAmount: 0,
        totalProposedAmount: 0,
        costBreakdown: '',
        paymentMilestones: '',
      },
      timeline: initialData?.timeline || {
        proposedDurationValue: tender.durationValue || 6,
        proposedDurationUnit: tender.durationUnit || 'months',
      },
      experience: initialData?.experience || {
        relevantExperienceSummary: '',
        yearsOfExperience: 0,
        keyCapabilities: '',
        availableResources: '',
        technicalPersonnel: '',
        pastProjects: [],
      },
      complianceDeclarations: initialData?.complianceDeclarations || {
        accuracyConfirmed: false,
        eligibilitySatisfied: false,
        documentsAuthentic: false,
        termsAgreed: false,
      },
      supportingDocuments: initialData?.supportingDocuments || [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const auditEventId = `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const auditEvent: ProposalAuditEvent = {
      eventId: auditEventId,
      proposalId,
      tenderId: tender.id,
      organizationId: organization.organizationId,
      action: 'CREATED',
      actorId: userUid,
      actorRole: 'agency',
      actorName: user.name || organization.legalName,
      actorEmail: user.email || '',
      timestamp: nowIso,
      newStatus: 'DRAFT',
      notes: `Draft proposal initialized for tender ${tender.tenderNumber}`,
    };

    if (isFirebaseConfigured && db) {
      try {
        const batch = writeBatch(db);
        const propRef = doc(db, PROPOSALS_COLLECTION, proposalId);
        const eventRef = doc(db, PROPOSAL_EVENTS_COLLECTION, auditEventId);

        batch.set(propRef, newProposal);
        batch.set(eventRef, auditEvent);
        await batch.commit();
      } catch (err) {
        console.warn('Firestore createDraftProposal failed, saving to local cache:', err);
      }
    }

    // Update local cache
    const local = getLocalProposals();
    local.push(newProposal);
    saveLocalProposals(local);

    const localEvents = getLocalEvents();
    localEvents.push(auditEvent);
    saveLocalEvents(localEvents);

    return newProposal;
  }

  /**
   * Updates an existing DRAFT proposal.
   * If the proposal has already been SUBMITTED, edits are strictly rejected (immutability rule).
   */
  static async updateDraftProposal(
    proposalId: string,
    updates: Partial<Proposal>,
    user: AuthUser
  ): Promise<Proposal> {
    const existing = await this.getProposalById(proposalId);
    if (!existing) {
      throw new Error('Proposal not found.');
    }

    if (existing.status !== 'DRAFT') {
      throw new Error(
        'Submission Lock: This proposal has already been submitted and cannot be edited. Its contents are sealed and immutable.'
      );
    }

    const nowIso = new Date().toISOString();
    const userUid = user.uid || user.id;
    const updatedProposal: Proposal = {
      ...existing,
      ...updates,
      id: existing.id,
      proposalNumber: existing.proposalNumber,
      tenderId: existing.tenderId,
      organizationId: existing.organizationId,
      submittedBy: existing.submittedBy,
      status: 'DRAFT', // Keep draft status
      updatedAt: nowIso,
    };

    const auditEventId = `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const auditEvent: ProposalAuditEvent = {
      eventId: auditEventId,
      proposalId: existing.id,
      tenderId: existing.tenderId,
      organizationId: existing.organizationId || '',
      action: 'UPDATED',
      actorId: userUid,
      actorRole: 'agency',
      actorName: user.name || 'Agency Contributor',
      actorEmail: user.email || '',
      timestamp: nowIso,
      previousStatus: 'DRAFT',
      newStatus: 'DRAFT',
      notes: 'Draft proposal sections updated and persisted.',
    };

    if (isFirebaseConfigured && db) {
      try {
        const batch = writeBatch(db);
        const propRef = doc(db, PROPOSALS_COLLECTION, proposalId);
        const eventRef = doc(db, PROPOSAL_EVENTS_COLLECTION, auditEventId);

        batch.set(propRef, updatedProposal, { merge: true });
        batch.set(eventRef, auditEvent);
        await batch.commit();
      } catch (err) {
        console.warn('Firestore updateDraftProposal failed, updating local cache:', err);
      }
    }

    const local = getLocalProposals();
    const idx = local.findIndex((p) => p.id === proposalId);
    if (idx !== -1) {
      local[idx] = updatedProposal;
    } else {
      local.push(updatedProposal);
    }
    saveLocalProposals(local);

    const localEvents = getLocalEvents();
    localEvents.push(auditEvent);
    saveLocalEvents(localEvents);

    return updatedProposal;
  }

  /**
   * Submits a completed proposal.
   * Performs rigorous deadline, completeness, and eligibility checks.
   * Locks the proposal upon transition to 'SUBMITTED'.
   */
  static async submitProposal(params: {
    proposalId: string;
    tender: Tender;
    user: AuthUser;
  }): Promise<Proposal> {
    const { proposalId, tender, user } = params;

    const existing = await this.getProposalById(proposalId);
    if (!existing) {
      throw new Error('Proposal not found.');
    }

    if (existing.status !== 'DRAFT') {
      throw new Error(`This proposal cannot be submitted because it is currently in '${existing.status}' status.`);
    }

    // 1. Tender Status Enforcement
    const effectiveStatus = getEffectiveTenderStatus(tender);
    if (effectiveStatus !== 'LIVE' && tender.status !== 'PUBLISHED' && tender.status !== 'Open') {
      throw new Error(
        `Submission blocked: Tender ${tender.tenderNumber} is no longer live (current status: ${effectiveStatus}). Proposals are not accepted.`
      );
    }

    // 2. Deadline Enforcement
    if (tender.closingDate) {
      const deadline = new Date(tender.closingDate).getTime();
      if (!isNaN(deadline) && Date.now() >= deadline) {
        throw new Error(
          'Submission blocked: The submission window for this tender has officially closed. The deadline has elapsed.'
        );
      }
    }

    // 3. Validation: Financial Proposal
    const financial = existing.financialProposal;
    if (!financial || !financial.baseAmount || financial.baseAmount <= 0) {
      throw new Error('Submission blocked: A valid quoted financial amount greater than ₹0 is required.');
    }

    // 4. Validation: Technical Proposal
    const tech = existing.technicalProposal;
    if (!tech || !tech.technicalApproach?.trim() || !tech.proposedSolution?.trim()) {
      throw new Error('Submission blocked: Mandatory Technical Approach and Proposed Solution must be completed.');
    }

    // 5. Validation: Compliance Declarations
    const compliance = existing.complianceDeclarations;
    if (
      !compliance ||
      !compliance.accuracyConfirmed ||
      !compliance.eligibilitySatisfied ||
      !compliance.documentsAuthentic ||
      !compliance.termsAgreed
    ) {
      throw new Error('Submission blocked: All statutory compliance declarations must be explicitly accepted.');
    }

    const nowIso = new Date().toISOString();
    const userUid = user.uid || user.id;
    const submittedProposal: Proposal = {
      ...existing,
      status: 'SUBMITTED',
      submittedAt: nowIso,
      updatedAt: nowIso,
      financialBidAmount: financial.totalProposedAmount || financial.baseAmount,
      quotedAmount: financial.baseAmount,
      submissionDate: nowIso.split('T')[0],
      complianceDeclarations: {
        ...compliance,
        declaredAt: nowIso,
        declaredBy: user.name || user.email || 'Authorized Signatory',
      },
    };

    const auditEventId = `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const auditEvent: ProposalAuditEvent = {
      eventId: auditEventId,
      proposalId: existing.id,
      tenderId: existing.tenderId,
      organizationId: existing.organizationId || '',
      action: 'SUBMITTED',
      actorId: userUid,
      actorRole: 'agency',
      actorName: user.name || 'Authorized Agency Signatory',
      actorEmail: user.email || '',
      timestamp: nowIso,
      previousStatus: 'DRAFT',
      newStatus: 'SUBMITTED',
      notes: `Proposal officially submitted and locked. Quoted Amount: ₹ ${financial.baseAmount.toLocaleString('en-IN')}`,
    };

    if (isFirebaseConfigured && db) {
      try {
        const batch = writeBatch(db);
        const propRef = doc(db, PROPOSALS_COLLECTION, proposalId);
        const eventRef = doc(db, PROPOSAL_EVENTS_COLLECTION, auditEventId);

        batch.update(propRef, {
          status: 'SUBMITTED',
          submittedAt: nowIso,
          updatedAt: nowIso,
          financialBidAmount: financial.totalProposedAmount || financial.baseAmount,
          quotedAmount: financial.baseAmount,
          submissionDate: nowIso.split('T')[0],
          complianceDeclarations: submittedProposal.complianceDeclarations,
        });

        batch.set(eventRef, auditEvent);
        await batch.commit();
      } catch (err) {
        console.warn('Firestore submitProposal failed, updating local cache:', err);
      }
    }

    const local = getLocalProposals();
    const idx = local.findIndex((p) => p.id === proposalId);
    if (idx !== -1) {
      local[idx] = submittedProposal;
    } else {
      local.push(submittedProposal);
    }
    saveLocalProposals(local);

    const localEvents = getLocalEvents();
    localEvents.push(auditEvent);
    saveLocalEvents(localEvents);

    return submittedProposal;
  }

  /**
   * Government Review Action: Transitions proposal status (e.g. UNDER_REVIEW, SHORTLISTED, REJECTED, AWARDED).
   * Generates authoritative audit events. Does NOT mutate agency proposal content.
   */
  static async updateProposalStatus(params: {
    proposalId: string;
    newStatus: CanonicalProposalStatus;
    user: AuthUser;
    notes?: string;
  }): Promise<Proposal> {
    const { proposalId, newStatus, user, notes } = params;

    const existing = await this.getProposalById(proposalId);
    if (!existing) {
      throw new Error('Proposal record not found.');
    }

    // Role check: Only government users can perform review transitions (agency can only withdraw)
    if (user.role !== 'government') {
      if (newStatus !== 'WITHDRAWN') {
        throw new Error('Unauthorized: Only authorized government reviewers may update proposal evaluation status.');
      }
    }

    if (!isValidProposalTransition(existing.status, newStatus)) {
      throw new Error(
        `Illegal status transition: Proposal in status '${existing.status}' cannot transition to '${newStatus}'.`
      );
    }

    const nowIso = new Date().toISOString();
    const userUid = user.uid || user.id;
    const updatedProposal: Proposal = {
      ...existing,
      status: newStatus,
      updatedAt: nowIso,
      reviewStatus: newStatus,
      reviewerNotes: notes || existing.reviewerNotes,
      reviewedBy: userUid,
      reviewedByName: user.name || user.email || 'Government Officer',
      reviewedAt: nowIso,
    };

    const actionMap: Record<CanonicalProposalStatus, ProposalAuditAction> = {
      DRAFT: 'CREATED',
      SUBMITTED: 'SUBMITTED',
      UNDER_REVIEW: 'UNDER_REVIEW',
      SHORTLISTED: 'SHORTLISTED',
      REJECTED: 'REJECTED',
      WITHDRAWN: 'WITHDRAWN',
      AWARDED: 'AWARDED',
    };

    const auditEventId = `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const auditEvent: ProposalAuditEvent = {
      eventId: auditEventId,
      proposalId: existing.id,
      tenderId: existing.tenderId,
      organizationId: existing.organizationId || '',
      action: actionMap[newStatus] || 'UPDATED',
      actorId: userUid,
      actorRole: user.role === 'government' ? 'government' : 'agency',
      actorName: user.name || user.email || 'Reviewer',
      actorEmail: user.email || '',
      timestamp: nowIso,
      previousStatus: existing.status,
      newStatus,
      notes: notes || `Status changed from ${existing.status} to ${newStatus}`,
    };

    if (isFirebaseConfigured && db) {
      try {
        const batch = writeBatch(db);
        const propRef = doc(db, PROPOSALS_COLLECTION, proposalId);
        const eventRef = doc(db, PROPOSAL_EVENTS_COLLECTION, auditEventId);

        batch.update(propRef, {
          status: newStatus,
          updatedAt: nowIso,
          reviewStatus: newStatus,
          reviewerNotes: notes || existing.reviewerNotes || '',
          reviewedBy: userUid,
          reviewedByName: user.name || user.email || 'Government Officer',
          reviewedAt: nowIso,
        });

        batch.set(eventRef, auditEvent);
        await batch.commit();
      } catch (err) {
        console.warn('Firestore updateProposalStatus failed, updating local cache:', err);
      }
    }

    const local = getLocalProposals();
    const idx = local.findIndex((p) => p.id === proposalId);
    if (idx !== -1) {
      local[idx] = updatedProposal;
    } else {
      local.push(updatedProposal);
    }
    saveLocalProposals(local);

    const localEvents = getLocalEvents();
    localEvents.push(auditEvent);
    saveLocalEvents(localEvents);

    return updatedProposal;
  }

  /**
   * Retrieves the immutable audit trail for a proposal.
   */
  static async getProposalAuditEvents(proposalId: string): Promise<ProposalAuditEvent[]> {
    if (!proposalId) return [];

    if (isFirebaseConfigured && db) {
      try {
        const ref = collection(db, PROPOSAL_EVENTS_COLLECTION);
        const q = query(ref, where('proposalId', '==', proposalId), orderBy('timestamp', 'asc'));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const events: ProposalAuditEvent[] = [];
          snap.forEach((d) => events.push(d.data() as ProposalAuditEvent));
          return events;
        }
      } catch (err) {
        console.warn('Firestore getProposalAuditEvents query failed, using local events:', err);
      }
    }

    const local = getLocalEvents();
    return local
      .filter((e) => e.proposalId === proposalId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
}
