// Bharat Tender Intelligence (BTI) — Project Management & Implementation Monitoring Service
// Phase 6: MPLAD Project Implementation, Milestone Tracking, Financial Utilization, Inspections & Audit Trail

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
import { auth, db, isFirebaseConfigured } from './firebase';
import {
  Project,
  ProjectStatus,
  CanonicalProjectStatus,
  toCanonicalProjectStatus,
  ProjectMilestone,
  ProjectProgressUpdate,
  ProjectFinancialRecord,
  ProjectInspection,
  ProjectException,
  ProjectAuditEvent,
  ProjectAuditAction,
  ProjectCompletionChecklist,
  ExpenditureType,
  FinancialVerificationStatus,
  InspectionType,
} from '../../types/project';
import { Proposal, CanonicalProposalStatus } from '../../types/proposal';
import { Tender } from '../../types/tender';
import { Organization } from '../../types/organization';
import { AuthUser } from '../../types/auth';
import { ProposalService } from './proposals';
import { TenderService } from './tenders';
import { OrganizationService } from './organizations';

const PROJECTS_COLLECTION = 'projects';
const MILESTONES_COLLECTION = 'projectMilestones';
const PROGRESS_UPDATES_COLLECTION = 'projectProgressUpdates';
const FINANCIAL_RECORDS_COLLECTION = 'projectFinancialRecords';
const INSPECTIONS_COLLECTION = 'projectInspections';
const EXCEPTIONS_COLLECTION = 'projectExceptions';
const AUDIT_EVENTS_COLLECTION = 'projectAuditEvents';

const LOCAL_STORAGE_PROJECTS_KEY = 'bti_projects_cache_v1';
const LOCAL_STORAGE_MILESTONES_KEY = 'bti_project_milestones_cache_v1';
const LOCAL_STORAGE_UPDATES_KEY = 'bti_project_updates_cache_v1';
const LOCAL_STORAGE_FINANCIAL_KEY = 'bti_project_financial_cache_v1';
const LOCAL_STORAGE_INSPECTIONS_KEY = 'bti_project_inspections_cache_v1';
const LOCAL_STORAGE_EXCEPTIONS_KEY = 'bti_project_exceptions_cache_v1';
const LOCAL_STORAGE_EVENTS_KEY = 'bti_project_audit_events_cache_v1';

const DEMO_STORAGE_KEY = 'bti_demo_session_v1';

export function isDemoSession(): boolean {
  try {
    return localStorage.getItem(DEMO_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function isLiveFirestoreSession(): boolean {
  return Boolean(isFirebaseConfigured && !isDemoSession() && db);
}

export function sanitizeFirestorePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (
      value !== null &&
      typeof value === 'object' &&
      !(value instanceof Timestamp) &&
      !(value instanceof Date) &&
      !Array.isArray(value)
    ) {
      result[key] = sanitizeFirestorePayload(value);
    } else if (Array.isArray(value)) {
      result[key] = value
        .filter((item) => item !== undefined)
        .map((item) =>
          item !== null && typeof item === 'object' && !(item instanceof Timestamp) && !(item instanceof Date)
            ? sanitizeFirestorePayload(item)
            : item
        );
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Generates an authoritative project reference number.
 * Format: BTI/MPLAD/{YEAR}/{SEQUENCE}
 * Produces a collision-resistant deterministic suffix derived from the authoritative proposal ID.
 */
export function generateProjectNumber(authoritativeSeed?: string): string {
  const year = new Date().getFullYear();
  if (authoritativeSeed && authoritativeSeed.trim()) {
    const seed = authoritativeSeed.trim();
    // 32-bit FNV-1a hash with bit-avalanche mixing across the full seed
    let hash = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85ebca6b);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2ae35);
    hash ^= hash >>> 16;
    const suffix = (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
    return `BTI/MPLAD/${year}/${suffix}`;
  }
  let entropy = '';
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    entropy = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  } else {
    entropy = Math.random().toString(36).substring(2, 10).toUpperCase();
  }
  return `BTI/MPLAD/${year}/${entropy}`;
}

/**
 * Validates permitted project lifecycle status transitions.
 * Lifecycle: NOT_STARTED → IN_PROGRESS → ON_HOLD → COMPLETED → CLOSED
 */
export function isValidProjectTransition(prev: ProjectStatus, next: CanonicalProjectStatus): boolean {
  const p = toCanonicalProjectStatus(prev);
  const n = next;
  if (p === n) return true;

  switch (p) {
    case 'NOT_STARTED':
      return n === 'IN_PROGRESS' || n === 'ON_HOLD';
    case 'IN_PROGRESS':
      return n === 'ON_HOLD' || n === 'COMPLETED';
    case 'ON_HOLD':
      return n === 'IN_PROGRESS' || n === 'CLOSED';
    case 'COMPLETED':
      return n === 'CLOSED';
    case 'CLOSED':
      return false;
    default:
      return false;
  }
}

/**
 * Deterministic calculation of physical progress from milestones.
 */
export function calculatePhysicalProgress(milestones: ProjectMilestone[]): {
  progress: number;
  totalWeight: number;
  isCompletePlan: boolean;
  warning?: string;
} {
  if (!milestones || milestones.length === 0) {
    return {
      progress: 0,
      totalWeight: 0,
      isCompletePlan: false,
      warning: 'Progress calculation unavailable — milestone data incomplete.',
    };
  }

  let totalWeight = 0;
  let weightedProgressSum = 0;

  for (const m of milestones) {
    const weight = Math.max(0, Math.min(100, Number(m.weightPercent) || 0));
    const prog = Math.max(0, Math.min(100, Number(m.progressPercent) || 0));
    totalWeight += weight;
    weightedProgressSum += (prog * weight) / 100;
  }

  const isCompletePlan = Math.round(totalWeight) === 100;
  let warning: string | undefined;

  if (!isCompletePlan) {
    warning = `Milestone weight total is ${totalWeight}% (expected 100%). Progress calculation may be partial.`;
  }

  const calculatedProgress = Math.round(weightedProgressSum);

  return {
    progress: Math.min(100, Math.max(0, calculatedProgress)),
    totalWeight,
    isCompletePlan,
    warning,
  };
}

/**
 * Deterministic calculation of financial progress from verified records only.
 */
export function calculateFinancialProgress(
  records: ProjectFinancialRecord[],
  awardedAmount: number
): {
  verifiedAmount: number;
  pendingAmount: number;
  rejectedAmount: number;
  progressPercent: number;
  isOverAward: boolean;
} {
  let verifiedAmount = 0;
  let pendingAmount = 0;
  let rejectedAmount = 0;

  for (const r of records || []) {
    const amt = Number(r.amount) || 0;
    if (r.verificationStatus === 'VERIFIED') {
      verifiedAmount += amt;
    } else if (r.verificationStatus === 'PENDING') {
      pendingAmount += amt;
    } else if (r.verificationStatus === 'REJECTED') {
      rejectedAmount += amt;
    }
  }

  const targetAmount = awardedAmount > 0 ? awardedAmount : 1;
  const rawPercent = Math.round((verifiedAmount / targetAmount) * 100);
  const progressPercent = Math.min(100, Math.max(0, rawPercent));
  const isOverAward = verifiedAmount > awardedAmount && awardedAmount > 0;

  return {
    verifiedAmount,
    pendingAmount,
    rejectedAmount,
    progressPercent,
    isOverAward,
  };
}

// Local storage seed & helpers
function getLocalItems<T>(key: string, defaultItems: T[] = []): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(defaultItems));
      return defaultItems;
    }
    return JSON.parse(raw);
  } catch {
    return defaultItems;
  }
}

function saveLocalItems<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.warn(`Failed saving ${key} to localStorage:`, err);
  }
}

// Initial seed project for reliable demo experience
const INITIAL_DEMO_PROJECT: Project = {
  id: 'proj-mplad-2026-001',
  projectNumber: 'BTI/MPLAD/2026/0001',
  tenderId: 'tnd-003',
  proposalId: 'prop-demo-awarded',
  organizationId: 'org-demo-1',
  title: 'Solar Powered Drinking Water & Community Purification Units',
  description: 'Installation of 45 solar-powered drinking water filtration kiosks across rural drought-prone blocks in Varanasi constituency under MPLAD funding.',
  authorityId: 'gov-user-1',
  authorityName: 'District Planning & MPLAD Monitoring Cell, Varanasi',
  implementingAgencyName: 'National Civil Infra Ltd.',
  sector: 'Water & Sanitation',
  category: 'Civil Works',
  state: 'Uttar Pradesh',
  district: 'Varanasi',
  constituency: 'Varanasi (PC-77)',
  sanctionedAmount: 14500000,
  awardedAmount: 13850000,
  startDate: '2026-01-15T00:00:00Z',
  implementationStartDate: '2026-01-15T00:00:00Z',
  plannedCompletionDate: '2026-08-30T00:00:00Z',
  status: 'IN_PROGRESS',
  physicalProgressPercent: 45,
  financialProgressPercent: 38,
  createdAt: '2026-01-10T10:00:00Z',
  updatedAt: '2026-02-28T14:30:00Z',
  lat: 25.3176,
  lng: 82.9739,
  projectCode: 'BTI/MPLAD/2026/0001',
  executingAgencyName: 'National Civil Infra Ltd.',
  agencyName: 'National Civil Infra Ltd.',
  sanctionedBudget: 14500000,
  amountDisbursed: 5263000,
  disbursedAmount: 5263000,
  utilizedAmount: 5263000,
  physicalProgress: 45,
  financialProgress: 38,
  targetCompletionDate: '2026-08-30',
  mpName: 'Sh. Narendra Modi',
};

const INITIAL_DEMO_MILESTONES: ProjectMilestone[] = [
  {
    id: 'ms-001',
    projectId: 'proj-mplad-2026-001',
    sequence: 1,
    title: 'Site Demarcation, Geotechnical Survey & Groundwater Testing',
    description: 'Borewell yield assessment and NABL-certified potability water quality testing at all 45 selected hamlet sites.',
    plannedStartDate: '2026-01-15T00:00:00Z',
    plannedEndDate: '2026-02-15T00:00:00Z',
    actualStartDate: '2026-01-16T00:00:00Z',
    actualEndDate: '2026-02-12T00:00:00Z',
    weightPercent: 20,
    progressPercent: 100,
    status: 'COMPLETED',
    createdAt: '2026-01-10T10:30:00Z',
    updatedAt: '2026-02-12T16:00:00Z',
  },
  {
    id: 'ms-002',
    projectId: 'proj-mplad-2026-001',
    sequence: 2,
    title: 'Civil Kiosk Structure & Reinforced Concrete Foundations',
    description: 'Construction of weatherproof kiosks, raised mounting plinths, and perimeter fencing.',
    plannedStartDate: '2026-02-15T00:00:00Z',
    plannedEndDate: '2026-04-15T00:00:00Z',
    actualStartDate: '2026-02-18T00:00:00Z',
    weightPercent: 30,
    progressPercent: 65,
    status: 'IN_PROGRESS',
    createdAt: '2026-01-10T10:30:00Z',
    updatedAt: '2026-03-01T11:00:00Z',
  },
  {
    id: 'ms-003',
    projectId: 'proj-mplad-2026-001',
    sequence: 3,
    title: 'Solar PV Array & Multi-Stage Filtration Commissioning',
    description: 'Installation of 5kW monocrystalline solar panels, deep-cycle battery banks, and RO/UV filtration units.',
    plannedStartDate: '2026-04-15T00:00:00Z',
    plannedEndDate: '2026-06-30T00:00:00Z',
    weightPercent: 35,
    progressPercent: 15,
    status: 'NOT_STARTED',
    createdAt: '2026-01-10T10:30:00Z',
    updatedAt: '2026-01-10T10:30:00Z',
  },
  {
    id: 'ms-004',
    projectId: 'proj-mplad-2026-001',
    sequence: 4,
    title: 'Nodal Officer Inspection, SCADA Telemetry & Gram Panchayat Handover',
    description: '72-hour continuous test operation, water quality re-certification, remote telemetry activation, and asset handover.',
    plannedStartDate: '2026-07-01T00:00:00Z',
    plannedEndDate: '2026-08-30T00:00:00Z',
    weightPercent: 15,
    progressPercent: 0,
    status: 'NOT_STARTED',
    createdAt: '2026-01-10T10:30:00Z',
    updatedAt: '2026-01-10T10:30:00Z',
  },
];

const INITIAL_DEMO_UPDATES: ProjectProgressUpdate[] = [
  {
    id: 'upd-001',
    projectId: 'proj-mplad-2026-001',
    milestoneId: 'ms-001',
    milestoneTitle: 'Site Demarcation, Geotechnical Survey & Groundwater Testing',
    submittedBy: 'agency-user-1',
    submittedByRole: 'AGENCY',
    submittedByName: 'National Civil Infra Ltd. (Project Manager)',
    updateDate: '2026-02-12T16:00:00Z',
    physicalProgressPercent: 20,
    workCompletedDescription: 'Completed all 45 hydro-geological soil tests. Water samples certified free of heavy metals by Regional NABL lab.',
    issues: [],
    correctiveAction: 'None required. Milestone completed ahead of schedule.',
    createdAt: '2026-02-12T16:00:00Z',
  },
  {
    id: 'upd-002',
    projectId: 'proj-mplad-2026-001',
    milestoneId: 'ms-002',
    milestoneTitle: 'Civil Kiosk Structure & Reinforced Concrete Foundations',
    submittedBy: 'agency-user-1',
    submittedByRole: 'AGENCY',
    submittedByName: 'National Civil Infra Ltd. (Site Engineer)',
    updateDate: '2026-03-01T10:00:00Z',
    physicalProgressPercent: 45,
    workCompletedDescription: 'Plinth casting completed across 32 of 45 village sites. Steel reinforcement cage assembly underway for remaining 13 sites.',
    issues: ['Intermittent cement delivery delay from regional rail siding.'],
    correctiveAction: 'Engaged secondary authorized district vendor to expedite remaining 800 bags of Portland Pozzolana cement.',
    createdAt: '2026-03-01T10:00:00Z',
  },
];

const INITIAL_DEMO_FINANCIAL: ProjectFinancialRecord[] = [
  {
    id: 'fin-001',
    projectId: 'proj-mplad-2026-001',
    entryDate: '2026-01-20T00:00:00Z',
    amount: 1385000,
    expenditureType: 'OTHER',
    description: 'Mobilization advance against statutory irrevocable Bank Guarantee No. BG/2026/8841.',
    referenceNumber: 'VOUCHER-MPLAD-01',
    submittedBy: 'agency-user-1',
    submittedByRole: 'AGENCY',
    submittedByName: 'National Civil Infra Ltd.',
    verificationStatus: 'VERIFIED',
    verifiedBy: 'gov-user-1',
    verifiedByName: 'Sh. Rajesh Kumar (District Nodal Officer)',
    verifiedAt: '2026-01-22T11:00:00Z',
    verificationNotes: 'Bank guarantee verified through SFMS confirmation from SBI Varanasi Main Branch.',
    createdAt: '2026-01-20T10:00:00Z',
  },
  {
    id: 'fin-002',
    projectId: 'proj-mplad-2026-001',
    entryDate: '2026-02-14T00:00:00Z',
    amount: 2770000,
    expenditureType: 'MATERIAL',
    description: 'Milestone 1 completion invoice: Geotechnical survey reports, site boundary demarcation, and plinth steel procurement.',
    referenceNumber: 'TAX-INV-NCIL-4402',
    submittedBy: 'agency-user-1',
    submittedByRole: 'AGENCY',
    submittedByName: 'National Civil Infra Ltd.',
    verificationStatus: 'VERIFIED',
    verifiedBy: 'gov-user-1',
    verifiedByName: 'Sh. Rajesh Kumar (District Nodal Officer)',
    verifiedAt: '2026-02-16T15:30:00Z',
    verificationNotes: 'Certified by Assistant Engineer after scrutiny of test reports and measurement book entries.',
    createdAt: '2026-02-14T12:00:00Z',
  },
  {
    id: 'fin-003',
    projectId: 'proj-mplad-2026-001',
    entryDate: '2026-03-02T00:00:00Z',
    amount: 1108000,
    expenditureType: 'LABOUR',
    description: 'Labour deployment and concrete mixer hire charges for 32 plinth foundations.',
    referenceNumber: 'BILL-LAB-FEB-2026',
    submittedBy: 'agency-user-1',
    submittedByRole: 'AGENCY',
    submittedByName: 'National Civil Infra Ltd.',
    verificationStatus: 'PENDING',
    createdAt: '2026-03-02T09:30:00Z',
  },
];

const INITIAL_DEMO_INSPECTIONS: ProjectInspection[] = [
  {
    id: 'insp-001',
    projectId: 'proj-mplad-2026-001',
    inspectionDate: '2026-02-15T11:00:00Z',
    officerId: 'gov-user-1',
    officerName: 'Sh. Amit Verma',
    officerDesignation: 'Executive Engineer (Rural Public Health)',
    inspectionType: 'MILESTONE',
    physicalProgressObserved: 25,
    observations: 'Physical inspection conducted across 8 sample borewell kiosks in Sevapuri block. Ground water testing records verified on site. Borewell depths verified as per DPR.',
    issues: ['Signboard displaying MPLAD funding details was missing at site #14.'],
    correctiveActions: ['Implementing agency instructed to erect permanent bilingual citizen information board within 7 days.'],
    recommendation: 'Milestone 1 approved for financial disbursal. Quality of civil work conforms to IS standards.',
    createdAt: '2026-02-15T16:00:00Z',
  },
];

const INITIAL_DEMO_EVENTS: ProjectAuditEvent[] = [
  {
    eventId: 'evt-proj-init-1',
    projectId: 'proj-mplad-2026-001',
    action: 'PROJECT_CREATED',
    actorId: 'gov-user-1',
    actorRole: 'government',
    actorName: 'District Nodal Officer (MPLAD)',
    timestamp: '2026-01-10T10:00:00Z',
    newState: { status: 'NOT_STARTED', sanctionedAmount: 14500000, awardedAmount: 13850000 },
    notes: 'Project created from awarded proposal BTI/PROP/2026/0001 pursuant to GFR 2017 sanction order.',
  },
  {
    eventId: 'evt-proj-init-2',
    projectId: 'proj-mplad-2026-001',
    action: 'STATUS_CHANGED',
    actorId: 'gov-user-1',
    actorRole: 'government',
    actorName: 'District Nodal Officer (MPLAD)',
    timestamp: '2026-01-15T09:00:00Z',
    previousState: { status: 'NOT_STARTED' },
    newState: { status: 'IN_PROGRESS' },
    notes: 'Work order handed over and site mobilization authorized.',
  },
];

export class ProjectService {
  /**
   * Section 25: Project Creation Validation & Execution
   * Before creating a project, strictly verifies:
   * 1. Tender exists
   * 2. Proposal exists
   * 3. Proposal status is AWARDED
   * 4. Proposal tenderId matches tender
   * 5. Proposal organizationId matches organization
   * 6. Organization exists
   * 7. Organization is the awarded organization
   * 8. No project already exists for the proposal
   */
  static async createProjectFromAwardedProposal(params: {
    proposalId: string;
    user: AuthUser;
    initialTitle?: string;
    initialDescription?: string;
  }): Promise<Project> {
    const { proposalId, user, initialTitle, initialDescription } = params;

    // RBAC: Only government officers can create/establish projects
    const userRole = (user.role || '').toLowerCase();
    if (!userRole.includes('gov')) {
      throw new Error('Access Denied: Only authorized government officers can establish official projects.');
    }

    // 1. Fetch Authoritative Proposal
    const proposal = await ProposalService.getProposalById(proposalId);
    if (!proposal) {
      throw new Error(`Validation Error: Proposal with ID "${proposalId}" does not exist.`);
    }

    // 3. Proposal status must be AWARDED
    const canonStatus = (proposal.status || '').toUpperCase().replace(/\s+/g, '_');
    if (canonStatus !== 'AWARDED') {
      throw new Error(
        `Statutory Rule: A project can only be created from an AWARDED proposal. Current proposal status is "${proposal.status}".`
      );
    }

    // 8. Prevent duplicate projects for the same proposal
    const projectId = proposalId.startsWith('proj-') ? proposalId : `proj-${proposalId}`;
    const existingProject = (await this.getProjectById(projectId)) || (await this.getProjectByProposalId(proposalId));
    if (existingProject) {
      throw new Error(
        `Duplicate Prevention: Project "${existingProject.projectNumber || existingProject.id}" already exists for proposal ${proposal.proposalNumber || proposalId}.`
      );
    }

    // 1. Tender must exist
    if (!proposal.tenderId) {
      throw new Error('Validation Error: Proposal does not reference a valid tenderId.');
    }
    const tender = await TenderService.getTenderById(proposal.tenderId);
    if (!tender) {
      throw new Error(`Validation Error: Authoritative Tender "${proposal.tenderId}" does not exist.`);
    }

    // 4. Proposal tenderId matches tender
    if (proposal.tenderId !== tender.id) {
      throw new Error('Validation Error: Proposal tenderId does not match the referenced tender.');
    }

    // 5 & 6. Organization must exist and match
    const orgId = proposal.organizationId || (proposal as any).agencyId;
    if (!orgId) {
      throw new Error('Validation Error: Proposal does not reference a valid organizationId.');
    }
    const org = await OrganizationService.getOrganizationById(orgId);
    if (!org) {
      throw new Error(`Validation Error: Awarded Organization "${orgId}" does not exist in authoritative records.`);
    }

    // Prepare authoritative Project Data
    const projectNumber = generateProjectNumber(proposalId);
    const nowIso = new Date().toISOString();

    const sanctionedAmount = Number(tender.sanctionedAmount || tender.estimatedCost || tender.budget || 0);
    const awardedAmount = Number(
      proposal.financialProposal?.totalProposedAmount ||
        proposal.financialProposal?.baseAmount ||
        (proposal as any).financialBidAmount ||
        (proposal as any).quotedAmount ||
        sanctionedAmount
    );

    const title =
      initialTitle?.trim() ||
      proposal.tenderTitle ||
      tender.title ||
      `MPLAD Project — ${proposal.proposalNumber || projectNumber}`;

    const description =
      initialDescription?.trim() ||
      proposal.technicalProposal?.scopeUnderstanding ||
      tender.description ||
      'Implementation project under Member of Parliament Local Area Development Scheme (MPLAD).';

    const agencyName = org.legalName || proposal.organizationName || 'Awarded Implementing Agency';
    const orgIdentifier = org.organizationId || (org as any).id || orgId;

    const newProject: Project = {
      id: projectId,
      projectNumber,
      tenderId: tender.id,
      proposalId: proposal.id,
      organizationId: orgIdentifier,
      title,
      description,
      authorityId: user.id || user.uid,
      authorityName: user.name || 'District Nodal Authority',
      implementingAgencyName: agencyName,
      sector: tender.category || 'Infrastructure',
      category: tender.category || 'Civil Works',
      state: tender.state || 'National',
      district: tender.district || 'General',
      constituency: tender.constituency || 'MPLAD Constituency',
      sanctionedAmount,
      awardedAmount,
      startDate: nowIso,
      plannedCompletionDate: proposal.timeline?.proposedCompletionDate?.trim() || (proposal as any).proposedCompletionDate?.trim() || undefined,
      status: 'NOT_STARTED',
      physicalProgressPercent: 0,
      financialProgressPercent: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      // Compatibility fields
      projectCode: projectNumber,
      tenderNumber: tender.tenderNumber,
      assignedAgencyId: orgIdentifier,
      executingAgencyName: agencyName,
      agencyName,
      sanctionedBudget: sanctionedAmount,
      amountDisbursed: 0,
      disbursedAmount: 0,
      utilizedAmount: 0,
      physicalProgress: 0,
      financialProgress: 0,
      targetCompletionDate: proposal.timeline?.proposedCompletionDate?.trim() || (proposal as any).proposedCompletionDate?.trim() || undefined,
    };

    // Extract initial milestones from proposal's implementation plan if available
    const initialMilestones: ProjectMilestone[] = [];
    const proposalMilestones = proposal.implementationPlan?.milestones || [];

    if (proposalMilestones.length > 0) {
      const defaultWeight = Math.floor(100 / proposalMilestones.length);
      const remainder = 100 - defaultWeight * proposalMilestones.length;

      proposalMilestones.forEach((pms, idx) => {
        const weight = idx === proposalMilestones.length - 1 ? defaultWeight + remainder : defaultWeight;
        initialMilestones.push({
          id: `ms-${projectId}-${idx + 1}`,
          projectId,
          sequence: idx + 1,
          title: pms.title || `Milestone ${idx + 1}`,
          description: pms.description || '',
          weightPercent: weight,
          progressPercent: 0,
          status: 'NOT_STARTED',
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      });
    }

    newProject.milestonesSummary = initialMilestones.map((m) => ({
      id: m.id,
      sequence: m.sequence,
      title: m.title,
      weightPercent: m.weightPercent,
      progressPercent: m.progressPercent,
      status: m.status,
    }));

    // Persist to Live Firestore or Local Storage
    if (isLiveFirestoreSession() && db) {
      const batch = writeBatch(db);
      const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
      batch.set(projectRef, sanitizeFirestorePayload(newProject));

      for (const ms of initialMilestones) {
        const msRef = doc(db, MILESTONES_COLLECTION, ms.id);
        batch.set(msRef, sanitizeFirestorePayload(ms));
      }

      // Record Audit Event
      const eventId = `evt-proj-create-${projectId}`;
      const auditEvent: ProjectAuditEvent = {
        eventId,
        projectId,
        action: 'PROJECT_CREATED',
        actorId: user.id || user.uid,
        actorRole: 'government',
        actorName: user.name || 'Authorized Officer',
        timestamp: nowIso,
        newState: { status: 'NOT_STARTED', projectNumber, awardedAmount },
        notes: `Project ${projectNumber} established from awarded proposal ${proposal.proposalNumber}.`,
      };
      const evtRef = doc(db, AUDIT_EVENTS_COLLECTION, eventId);
      batch.set(evtRef, sanitizeFirestorePayload(auditEvent));

      await batch.commit();
    } else {
      this.saveProjectLocally(newProject, initialMilestones, user);
    }

    return newProject;
  }

  private static saveProjectLocally(
    project: Project,
    initialMilestones: ProjectMilestone[],
    user: AuthUser
  ): void {
    const projects = getLocalItems<Project>(LOCAL_STORAGE_PROJECTS_KEY, [INITIAL_DEMO_PROJECT]);
    projects.unshift(project);
    saveLocalItems(LOCAL_STORAGE_PROJECTS_KEY, projects);

    if (initialMilestones.length > 0) {
      const milestones = getLocalItems<ProjectMilestone>(LOCAL_STORAGE_MILESTONES_KEY, INITIAL_DEMO_MILESTONES);
      milestones.push(...initialMilestones);
      saveLocalItems(LOCAL_STORAGE_MILESTONES_KEY, milestones);
    }

    const eventId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId: project.id,
      action: 'PROJECT_CREATED',
      actorId: user.id || user.uid,
      actorRole: 'government',
      actorName: user.name || 'Authorized Officer',
      timestamp: new Date().toISOString(),
      newState: { status: project.status, projectNumber: project.projectNumber, awardedAmount: project.awardedAmount },
      notes: `Project ${project.projectNumber} established from proposal ${project.proposalId}.`,
    };
    const events = getLocalItems<ProjectAuditEvent>(LOCAL_STORAGE_EVENTS_KEY, INITIAL_DEMO_EVENTS);
    events.unshift(auditEvent);
    saveLocalItems(LOCAL_STORAGE_EVENTS_KEY, events);
  }

  /**
   * Retrieves all projects accessible to the caller.
   * Agencies are strictly filtered to their own organizationId.
   */
  static async getProjects(options: {
    role?: 'government' | 'agency' | string;
    organizationId?: string;
  } = {}): Promise<Project[]> {
    const { role, organizationId } = options;

    if (isLiveFirestoreSession() && db) {
      let q;
      if (role === 'agency' && organizationId) {
        q = query(collection(db, PROJECTS_COLLECTION), where('organizationId', '==', organizationId));
      } else {
        q = query(collection(db, PROJECTS_COLLECTION), orderBy('createdAt', 'desc'));
      }
      const snap = await getDocs(q);
      const list: Project[] = [];
      snap.forEach((d) => list.push(d.data() as Project));
      return list;
    }

    const localProjects = getLocalItems<Project>(LOCAL_STORAGE_PROJECTS_KEY, [INITIAL_DEMO_PROJECT]);
    if (role === 'agency' && organizationId) {
      return localProjects.filter((p) => p.organizationId === organizationId);
    }
    return localProjects;
  }

  static async getProjectById(projectId: string): Promise<Project | null> {
    if (!projectId) return null;

    if (isLiveFirestoreSession() && db) {
      const snap = await getDoc(doc(db, PROJECTS_COLLECTION, projectId));
      if (snap.exists()) {
        return snap.data() as Project;
      }
      return null;
    }

    const localProjects = getLocalItems<Project>(LOCAL_STORAGE_PROJECTS_KEY, [INITIAL_DEMO_PROJECT]);
    return localProjects.find((p) => p.id === projectId || p.projectNumber === projectId) || null;
  }

  static async getProjectByProposalId(proposalId: string): Promise<Project | null> {
    if (!proposalId) return null;

    if (isLiveFirestoreSession() && db) {
      const directId = proposalId.startsWith('proj-') ? proposalId : `proj-${proposalId}`;
      const directSnap = await getDoc(doc(db, PROJECTS_COLLECTION, directId));
      if (directSnap.exists()) {
        return directSnap.data() as Project;
      }

      const q = query(collection(db, PROJECTS_COLLECTION), where('proposalId', '==', proposalId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].data() as Project;
      }
      return null;
    }

    const localProjects = getLocalItems<Project>(LOCAL_STORAGE_PROJECTS_KEY, [INITIAL_DEMO_PROJECT]);
    const directId = proposalId.startsWith('proj-') ? proposalId : `proj-${proposalId}`;
    return localProjects.find((p) => p.proposalId === proposalId || p.id === directId) || null;
  }

  /**
   * Government-only project status transition.
   * Requires completion checklist verification before marking COMPLETED.
   */
  static async updateProjectStatus(params: {
    projectId: string;
    newStatus: CanonicalProjectStatus;
    user: AuthUser;
    notes?: string;
    completionChecklist?: ProjectCompletionChecklist;
  }): Promise<Project> {
    const { projectId, newStatus, user, notes, completionChecklist } = params;

    // RBAC: Only government officers can change official project status
    const userRole = (user.role || '').toLowerCase();
    if (!userRole.includes('gov')) {
      throw new Error('Access Denied: Only authorized government officers can update official project status.');
    }

    const project = await this.getProjectById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found.`);
    }

    if (!isValidProjectTransition(project.status, newStatus)) {
      throw new Error(
        `Invalid status transition from "${project.status}" to "${newStatus}". Permitted transitions: NOT_STARTED → IN_PROGRESS → ON_HOLD → COMPLETED → CLOSED.`
      );
    }

    // Section 28: Completion Checklist Enforcement
    if (newStatus === 'COMPLETED') {
      if (
        !completionChecklist ||
        !completionChecklist.physicalWorkCompleted ||
        !completionChecklist.finalMilestoneCompleted ||
        !completionChecklist.financialRecordsReviewed ||
        !completionChecklist.finalInspectionCompleted ||
        !completionChecklist.supportingInformationAvailable
      ) {
        throw new Error(
          'Statutory Completion Checklist Incomplete: All mandatory verification checks must be explicitly confirmed before marking a project COMPLETED.'
        );
      }
    }

    const nowIso = new Date().toISOString();
    const eventId = `evt-proj-status-${projectId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const updated: Project = {
      ...project,
      status: newStatus,
      updatedAt: nowIso,
      implementationStartDate: project.implementationStartDate || (newStatus === 'IN_PROGRESS' ? nowIso : undefined),
      actualCompletionDate: newStatus === 'COMPLETED' ? (project.actualCompletionDate || nowIso) : project.actualCompletionDate,
      completionChecklist: newStatus === 'COMPLETED' ? (completionChecklist || project.completionChecklist) : project.completionChecklist,
      lastStatusChangeEventId: eventId,
    };

    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId,
      action: 'STATUS_CHANGED',
      actorId: user.id || user.uid,
      actorRole: 'government',
      actorName: user.name || 'Authorized Officer',
      timestamp: nowIso,
      previousState: { status: project.status },
      newState: { status: newStatus },
      notes: notes || `Project status updated to ${newStatus}.`,
      metadata: completionChecklist ? { checklist: completionChecklist } : undefined,
    };

    if (isLiveFirestoreSession() && db) {
      const batch = writeBatch(db);
      batch.update(doc(db, PROJECTS_COLLECTION, projectId), sanitizeFirestorePayload(updated));
      batch.set(doc(db, AUDIT_EVENTS_COLLECTION, eventId), sanitizeFirestorePayload(auditEvent));
      await batch.commit();
    } else {
      this.updateProjectLocally(updated, auditEvent);
    }

    return updated;
  }

  private static updateProjectLocally(project: Project, auditEvent: ProjectAuditEvent): void {
    const projects = getLocalItems<Project>(LOCAL_STORAGE_PROJECTS_KEY, [INITIAL_DEMO_PROJECT]);
    const idx = projects.findIndex((p) => p.id === project.id);
    if (idx !== -1) {
      projects[idx] = project;
    } else {
      projects.unshift(project);
    }
    saveLocalItems(LOCAL_STORAGE_PROJECTS_KEY, projects);

    const events = getLocalItems<ProjectAuditEvent>(LOCAL_STORAGE_EVENTS_KEY, INITIAL_DEMO_EVENTS);
    events.unshift(auditEvent);
    saveLocalItems(LOCAL_STORAGE_EVENTS_KEY, events);
  }

  // ==========================================
  // MILESTONES
  // ==========================================

  static async getMilestones(projectId: string): Promise<ProjectMilestone[]> {
    if (!projectId) return [];

    if (isLiveFirestoreSession() && db) {
      const q = query(
        collection(db, MILESTONES_COLLECTION),
        where('projectId', '==', projectId),
        orderBy('sequence', 'asc')
      );
      const snap = await getDocs(q);
      const list: ProjectMilestone[] = [];
      snap.forEach((d) => list.push(d.data() as ProjectMilestone));
      return list;
    }

    const localMilestones = getLocalItems<ProjectMilestone>(LOCAL_STORAGE_MILESTONES_KEY, INITIAL_DEMO_MILESTONES);
    return localMilestones
      .filter((m) => m.projectId === projectId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  /**
   * Government-only: Create a new milestone
   */
  static async createMilestone(params: {
    projectId: string;
    milestone: Omit<ProjectMilestone, 'id' | 'createdAt' | 'updatedAt' | 'projectId'>;
    user: AuthUser;
  }): Promise<ProjectMilestone> {
    const { projectId, milestone, user } = params;

    const userRole = (user.role || '').toLowerCase();
    if (!userRole.includes('gov')) {
      throw new Error('Access Denied: Only authorized government officers can create or configure project milestones.');
    }

    const project = await this.getProjectById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found.`);
    }

    const weight = Number(milestone.weightPercent);
    if (isNaN(weight) || weight < 0 || weight > 100) {
      throw new Error('Validation Error: Milestone weight must be between 0 and 100%.');
    }

    const id = `ms-${projectId}-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const newMilestone: ProjectMilestone = {
      ...milestone,
      id,
      projectId,
      weightPercent: weight,
      progressPercent: Number(milestone.progressPercent) || 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const currentList = await this.getMilestones(projectId);
    const nextMilestones = [...currentList, newMilestone];
    const { progress } = calculatePhysicalProgress(nextMilestones);
    const nextSummary = nextMilestones.map((m) => ({
      id: m.id,
      sequence: m.sequence,
      title: m.title,
      weightPercent: m.weightPercent,
      progressPercent: m.progressPercent,
      status: m.status,
    }));

    const updatedProject: Project = {
      ...project,
      physicalProgressPercent: progress,
      physicalProgress: progress,
      updatedAt: nowIso,
      lastMilestoneId: id,
      milestonesSummary: nextSummary,
    };

    const eventId = `evt-ms-create-${id}`;
    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId,
      action: 'MILESTONE_CREATED',
      actorId: user.id || user.uid,
      actorRole: 'government',
      actorName: user.name || 'Authorized Officer',
      timestamp: nowIso,
      newState: { milestoneId: id, title: newMilestone.title, weight: newMilestone.weightPercent },
      notes: `Milestone created: "${newMilestone.title}" (${newMilestone.weightPercent}% weight).`,
    };

    if (isLiveFirestoreSession() && db) {
      const batch = writeBatch(db);
      batch.set(doc(db, MILESTONES_COLLECTION, id), sanitizeFirestorePayload(newMilestone));
      batch.update(doc(db, PROJECTS_COLLECTION, projectId), sanitizeFirestorePayload(updatedProject));
      batch.set(doc(db, AUDIT_EVENTS_COLLECTION, eventId), sanitizeFirestorePayload(auditEvent));
      await batch.commit();
    } else {
      const local = getLocalItems<ProjectMilestone>(LOCAL_STORAGE_MILESTONES_KEY, INITIAL_DEMO_MILESTONES);
      local.push(newMilestone);
      saveLocalItems(LOCAL_STORAGE_MILESTONES_KEY, local);

      const localProjects = getLocalItems<Project>(LOCAL_STORAGE_PROJECTS_KEY, [INITIAL_DEMO_PROJECT]);
      const pIdx = localProjects.findIndex((p) => p.id === projectId);
      if (pIdx !== -1) {
        localProjects[pIdx] = updatedProject;
        saveLocalItems(LOCAL_STORAGE_PROJECTS_KEY, localProjects);
      }

      const localEvents = getLocalItems<ProjectAuditEvent>(LOCAL_STORAGE_EVENTS_KEY, INITIAL_DEMO_EVENTS);
      localEvents.unshift(auditEvent);
      saveLocalItems(LOCAL_STORAGE_EVENTS_KEY, localEvents);
    }

    return newMilestone;
  }

  /**
   * Update milestone progress or details with role validation
   */
  static async updateMilestone(params: {
    projectId: string;
    milestoneId: string;
    updates: Partial<ProjectMilestone>;
    user: AuthUser;
  }): Promise<ProjectMilestone> {
    const { projectId, milestoneId, updates, user } = params;

    const userRoleLower = (user.role || '').toLowerCase();
    const isGov = userRoleLower.includes('gov') || userRoleLower === 'government';
    const isAgency = userRoleLower === 'agency';

    if (!isGov && !isAgency) {
      throw new Error('Access Denied: Unauthorized user role for milestone updates.');
    }

    const project = await this.getProjectById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found.`);
    }

    if (isAgency) {
      const userOrgId = user.organizationId;
      if (!userOrgId || project.organizationId !== userOrgId) {
        throw new Error('Access Denied: Agency can only update milestones for projects assigned to their organization.');
      }

      // Agency users are restricted to operational progress updates only
      const forbiddenKeys = Object.keys(updates).filter(
        (k) => !['progressPercent', 'status', 'actualStartDate', 'actualEndDate'].includes(k)
      );
      if (forbiddenKeys.length > 0) {
        throw new Error(
          `Access Denied: Agency users cannot modify structural milestone properties (${forbiddenKeys.join(', ')}).`
        );
      }
    }

    const currentList = await this.getMilestones(projectId);
    const existing = currentList.find((m) => m.id === milestoneId);
    if (!existing) {
      throw new Error(`Milestone ${milestoneId} not found.`);
    }

    const nowIso = new Date().toISOString();
    const updated: ProjectMilestone = {
      ...existing,
      ...updates,
      updatedAt: nowIso,
    };

    if (updates.progressPercent !== undefined) {
      const prog = Number(updates.progressPercent);
      updated.progressPercent = Math.max(0, Math.min(100, prog));
      if (updated.progressPercent === 100) {
        updated.status = 'COMPLETED';
        if (!updated.actualEndDate) updated.actualEndDate = nowIso;
      } else if (updated.progressPercent > 0 && updated.status === 'NOT_STARTED') {
        updated.status = 'IN_PROGRESS';
        if (!updated.actualStartDate) updated.actualStartDate = nowIso;
      }
    }

    const nextMilestones = currentList.map((m) => (m.id === milestoneId ? updated : m));
    const { progress } = calculatePhysicalProgress(nextMilestones);
    const nextSummary = nextMilestones.map((m) => ({
      id: m.id,
      sequence: m.sequence,
      title: m.title,
      weightPercent: m.weightPercent,
      progressPercent: m.progressPercent,
      status: m.status,
    }));

    const updatedProject: Project = {
      ...project,
      physicalProgressPercent: progress,
      physicalProgress: progress,
      updatedAt: nowIso,
      lastMilestoneId: milestoneId,
      milestonesSummary: nextSummary,
    };

    const eventId = `evt-ms-update-${milestoneId}`;
    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId,
      action: 'MILESTONE_UPDATED',
      actorId: user.id || user.uid,
      actorRole: isGov ? 'government' : 'agency',
      actorName: user.name || 'User',
      timestamp: nowIso,
      previousState: { progress: existing.progressPercent, status: existing.status },
      newState: { milestoneId, progress: updated.progressPercent, status: updated.status },
      notes: `Milestone "${updated.title}" updated to ${updated.progressPercent}% progress.`,
    };

    if (isLiveFirestoreSession() && db) {
      const batch = writeBatch(db);
      batch.update(doc(db, MILESTONES_COLLECTION, milestoneId), sanitizeFirestorePayload(updated));
      if (updatedProject) {
        batch.update(doc(db, PROJECTS_COLLECTION, projectId), sanitizeFirestorePayload(updatedProject));
      }
      batch.set(doc(db, AUDIT_EVENTS_COLLECTION, eventId), sanitizeFirestorePayload(auditEvent));
      await batch.commit();
    } else {
      const local = getLocalItems<ProjectMilestone>(LOCAL_STORAGE_MILESTONES_KEY, INITIAL_DEMO_MILESTONES);
      const idx = local.findIndex((m) => m.id === milestoneId);
      if (idx !== -1) local[idx] = updated;
      saveLocalItems(LOCAL_STORAGE_MILESTONES_KEY, local);

      const localProjects = getLocalItems<Project>(LOCAL_STORAGE_PROJECTS_KEY, [INITIAL_DEMO_PROJECT]);
      const pIdx = localProjects.findIndex((p) => p.id === projectId);
      if (pIdx !== -1) {
        localProjects[pIdx] = updatedProject;
        saveLocalItems(LOCAL_STORAGE_PROJECTS_KEY, localProjects);
      }

      const localEvents = getLocalItems<ProjectAuditEvent>(LOCAL_STORAGE_EVENTS_KEY, INITIAL_DEMO_EVENTS);
      localEvents.unshift(auditEvent);
      saveLocalItems(LOCAL_STORAGE_EVENTS_KEY, localEvents);
    }

    return updated;
  }

  // ==========================================
  // PROGRESS UPDATES (Append-only)
  // ==========================================

  static async getProgressUpdates(projectId: string): Promise<ProjectProgressUpdate[]> {
    if (!projectId) return [];

    if (isLiveFirestoreSession() && db) {
      const q = query(
        collection(db, PROGRESS_UPDATES_COLLECTION),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list: ProjectProgressUpdate[] = [];
      snap.forEach((d) => list.push(d.data() as ProjectProgressUpdate));
      return list;
    }

    const localUpdates = getLocalItems<ProjectProgressUpdate>(LOCAL_STORAGE_UPDATES_KEY, INITIAL_DEMO_UPDATES);
    return localUpdates.filter((u) => u.projectId === projectId).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  }

  static async submitProgressUpdate(params: {
    projectId: string;
    milestoneId?: string;
    milestoneStatus?: any;
    physicalProgressPercent?: number;
    workCompletedDescription: string;
    issues?: string[];
    correctiveAction?: string;
    user: AuthUser;
    role: 'AGENCY' | 'GOVERNMENT';
  }): Promise<ProjectProgressUpdate> {
    const { projectId, milestoneId, milestoneStatus, physicalProgressPercent, workCompletedDescription, issues, correctiveAction, user, role } = params;

    const userRoleLower = (user.role || '').toLowerCase();
    const isGov = userRoleLower.includes('gov') || userRoleLower === 'government';
    const isAgency = userRoleLower === 'agency';

    if (!isGov && !isAgency) {
      throw new Error('Access Denied: Unrecognized or unauthorized user role for progress submission.');
    }

    const effectiveRole: 'GOVERNMENT' | 'AGENCY' = isGov ? 'GOVERNMENT' : 'AGENCY';
    if (role && role !== effectiveRole) {
      throw new Error(`Role Mismatch: Caller specified role "${role}" does not match authenticated user role "${effectiveRole}".`);
    }

    const project = await this.getProjectById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found.`);
    }

    if (isAgency) {
      const userOrgId = user.organizationId;
      if (!userOrgId || project.organizationId !== userOrgId) {
        throw new Error('Access Denied: Agency can only submit progress updates for projects assigned to their organization.');
      }
    }

    if (!workCompletedDescription || workCompletedDescription.trim().length < 10) {
      throw new Error('Validation Error: A descriptive summary of work completed (min 10 chars) is mandatory.');
    }

    const nowIso = new Date().toISOString();
    const id = `upd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    let milestoneTitle: string | undefined;
    let updatedMilestone: ProjectMilestone | undefined;
    let milestoneAuditEvent: ProjectAuditEvent | undefined;
    let msEventId: string | undefined;
    let updatedProject: Project | undefined;

    if (milestoneId) {
      const milestones = await this.getMilestones(projectId);
      const ms = milestones.find((m) => m.id === milestoneId);
      if (!ms) {
        throw new Error(`Milestone ${milestoneId} not found.`);
      }
      milestoneTitle = ms.title;

      if (physicalProgressPercent !== undefined) {
        const prog = Number(physicalProgressPercent);
        const validProg = Math.max(0, Math.min(100, isNaN(prog) ? 0 : prog));

        let computedStatus = ms.status;
        if (validProg === 0) {
          computedStatus = 'NOT_STARTED';
        } else if (validProg === 100) {
          computedStatus = 'COMPLETED';
        } else if (milestoneStatus === 'DELAYED') {
          computedStatus = 'DELAYED';
        } else {
          computedStatus = 'IN_PROGRESS';
        }

        updatedMilestone = {
          ...ms,
          progressPercent: validProg,
          status: computedStatus,
          updatedAt: nowIso,
        };

        if (computedStatus === 'COMPLETED') {
          if (!updatedMilestone.actualEndDate) updatedMilestone.actualEndDate = nowIso;
        } else if (computedStatus === 'IN_PROGRESS' || computedStatus === 'DELAYED') {
          if (!updatedMilestone.actualStartDate) updatedMilestone.actualStartDate = nowIso;
        }

        const nextMilestones = milestones.map((m) => (m.id === milestoneId ? updatedMilestone! : m));
        const { progress } = calculatePhysicalProgress(nextMilestones);
        const nextSummary = nextMilestones.map((m) => ({
          id: m.id,
          sequence: m.sequence,
          title: m.title,
          weightPercent: m.weightPercent,
          progressPercent: m.progressPercent,
          status: m.status,
        }));
        updatedProject = {
          ...project,
          physicalProgressPercent: progress,
          physicalProgress: progress,
          updatedAt: nowIso,
          lastProgressUpdateId: id,
          lastMilestoneId: milestoneId,
          milestonesSummary: nextSummary,
        };

        msEventId = `evt-ms-update-${milestoneId}`;
        milestoneAuditEvent = {
          eventId: msEventId,
          projectId,
          action: 'MILESTONE_UPDATED',
          actorId: user.id || user.uid,
          actorRole: isGov ? 'government' : 'agency',
          actorName: user.name || 'User',
          timestamp: nowIso,
          previousState: { progress: ms.progressPercent, status: ms.status },
          newState: { milestoneId, progress: updatedMilestone.progressPercent, status: updatedMilestone.status },
          notes: `Milestone "${updatedMilestone.title}" updated to ${updatedMilestone.progressPercent}% progress.`,
        };
      }
    }

    const newUpdate: ProjectProgressUpdate = {
      id,
      projectId,
      milestoneId,
      milestoneTitle,
      submittedBy: user.id || user.uid,
      submittedByRole: effectiveRole,
      submittedByName: user.name || (effectiveRole === 'GOVERNMENT' ? 'Government Officer' : 'Contractor Representative'),
      updateDate: nowIso,
      physicalProgressPercent,
      workCompletedDescription: workCompletedDescription.trim(),
      issues: issues?.filter((i) => i.trim().length > 0) || [],
      correctiveAction: correctiveAction?.trim() || undefined,
      createdAt: nowIso,
    };

    const eventId = `evt-prog-submit-${id}`;
    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId,
      action: 'PROGRESS_UPDATE_SUBMITTED',
      actorId: user.id || user.uid,
      actorRole: effectiveRole === 'GOVERNMENT' ? 'government' : 'agency',
      actorName: user.name || 'User',
      timestamp: nowIso,
      newState: { updateId: id, milestoneId, physicalProgressPercent },
      notes: `Progress update recorded: ${workCompletedDescription.slice(0, 80)}...`,
    };

    if (isLiveFirestoreSession() && db) {
      const batch = writeBatch(db);
      if (updatedMilestone && milestoneAuditEvent && msEventId && milestoneId) {
        batch.update(doc(db, MILESTONES_COLLECTION, milestoneId), sanitizeFirestorePayload(updatedMilestone));
        if (updatedProject) {
          batch.update(doc(db, PROJECTS_COLLECTION, projectId), sanitizeFirestorePayload(updatedProject));
        }
        batch.set(doc(db, AUDIT_EVENTS_COLLECTION, msEventId), sanitizeFirestorePayload(milestoneAuditEvent));
      }
      batch.set(doc(db, PROGRESS_UPDATES_COLLECTION, id), sanitizeFirestorePayload(newUpdate));
      batch.set(doc(db, AUDIT_EVENTS_COLLECTION, eventId), sanitizeFirestorePayload(auditEvent));
      await batch.commit();
    } else {
      if (updatedMilestone && milestoneAuditEvent && milestoneId) {
        const localMs = getLocalItems<ProjectMilestone>(LOCAL_STORAGE_MILESTONES_KEY, INITIAL_DEMO_MILESTONES);
        const idx = localMs.findIndex((m) => m.id === milestoneId);
        if (idx !== -1) localMs[idx] = updatedMilestone;
        saveLocalItems(LOCAL_STORAGE_MILESTONES_KEY, localMs);

        if (updatedProject) {
          const localProjects = getLocalItems<Project>(LOCAL_STORAGE_PROJECTS_KEY, [INITIAL_DEMO_PROJECT]);
          const pIdx = localProjects.findIndex((p) => p.id === projectId);
          if (pIdx !== -1) {
            localProjects[pIdx] = updatedProject;
            saveLocalItems(LOCAL_STORAGE_PROJECTS_KEY, localProjects);
          }
        }

        const localEvents = getLocalItems<ProjectAuditEvent>(LOCAL_STORAGE_EVENTS_KEY, INITIAL_DEMO_EVENTS);
        localEvents.unshift(milestoneAuditEvent);
        saveLocalItems(LOCAL_STORAGE_EVENTS_KEY, localEvents);
      }
      const local = getLocalItems<ProjectProgressUpdate>(LOCAL_STORAGE_UPDATES_KEY, INITIAL_DEMO_UPDATES);
      local.unshift(newUpdate);
      saveLocalItems(LOCAL_STORAGE_UPDATES_KEY, local);

      const localEvents = getLocalItems<ProjectAuditEvent>(LOCAL_STORAGE_EVENTS_KEY, INITIAL_DEMO_EVENTS);
      localEvents.unshift(auditEvent);
      saveLocalItems(LOCAL_STORAGE_EVENTS_KEY, localEvents);
    }

    // Run deterministic exception checks only for government-authorized callers
    if (isGov) {
      await this.runDeterministicExceptionChecks(projectId);
    }

    return newUpdate;
  }

  // ==========================================
  // FINANCIAL RECORDS (Utilization)
  // ==========================================

  static async getFinancialRecords(projectId: string): Promise<ProjectFinancialRecord[]> {
    if (!projectId) return [];

    if (isLiveFirestoreSession() && db) {
      const q = query(
        collection(db, FINANCIAL_RECORDS_COLLECTION),
        where('projectId', '==', projectId),
        orderBy('entryDate', 'desc')
      );
      const snap = await getDocs(q);
      const list: ProjectFinancialRecord[] = [];
      snap.forEach((d) => list.push(d.data() as ProjectFinancialRecord));
      return list;
    }

    const localFinancial = getLocalItems<ProjectFinancialRecord>(LOCAL_STORAGE_FINANCIAL_KEY, INITIAL_DEMO_FINANCIAL);
    return localFinancial.filter((f) => f.projectId === projectId).sort((a, b) => (b.entryDate > a.entryDate ? 1 : -1));
  }

  static async submitFinancialRecord(params: {
    projectId: string;
    amount: number;
    expenditureType: ExpenditureType;
    description: string;
    referenceNumber?: string;
    user: AuthUser;
    role: 'AGENCY' | 'GOVERNMENT';
  }): Promise<ProjectFinancialRecord> {
    const { projectId, amount, expenditureType, description, referenceNumber, user, role } = params;

    const userRoleLower = (user.role || '').toLowerCase();
    const isGov = userRoleLower.includes('gov') || userRoleLower === 'government';
    const isAgency = userRoleLower === 'agency';

    if (!isGov && !isAgency) {
      throw new Error('Access Denied: Unrecognized or unauthorized user role for financial record submission.');
    }

    const effectiveRole: 'GOVERNMENT' | 'AGENCY' = isGov ? 'GOVERNMENT' : 'AGENCY';
    if (role && role !== effectiveRole) {
      throw new Error(`Role Mismatch: Caller specified role "${role}" does not match authenticated user role "${effectiveRole}".`);
    }

    const project = await this.getProjectById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found.`);
    }

    if (isAgency) {
      const userOrgId = user.organizationId;
      if (!userOrgId || project.organizationId !== userOrgId) {
        throw new Error('Access Denied: Agency can only submit expenditure claims for projects assigned to their organization.');
      }
    }

    const numAmt = Number(amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      throw new Error('Validation Error: Expenditure amount must be a positive numeric value in INR.');
    }
    if (!description || description.trim().length < 5) {
      throw new Error('Validation Error: Description of expenditure is required (min 5 chars).');
    }

    const id = `fin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const newRecord: ProjectFinancialRecord = {
      id,
      projectId,
      entryDate: nowIso,
      amount: numAmt,
      expenditureType,
      description: description.trim(),
      referenceNumber: referenceNumber?.trim() || undefined,
      submittedBy: user.id || user.uid,
      submittedByRole: effectiveRole,
      submittedByName: user.name || (effectiveRole === 'GOVERNMENT' ? 'Government Officer' : 'Contractor'),
      verificationStatus: 'PENDING',
      createdAt: nowIso,
    };

    const eventId = `evt-fin-submit-${id}`;
    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId,
      action: 'FINANCIAL_RECORD_SUBMITTED',
      actorId: user.id || user.uid,
      actorRole: effectiveRole === 'GOVERNMENT' ? 'government' : 'agency',
      actorName: user.name || 'User',
      timestamp: nowIso,
      newState: { recordId: id, amount: numAmt, type: expenditureType },
      notes: `Financial expenditure submitted: ₹${numAmt.toLocaleString('en-IN')} (${expenditureType}) — Pending Verification.`,
    };

    if (isLiveFirestoreSession() && db) {
      const batch = writeBatch(db);
      batch.set(doc(db, FINANCIAL_RECORDS_COLLECTION, id), sanitizeFirestorePayload(newRecord));
      batch.set(doc(db, AUDIT_EVENTS_COLLECTION, eventId), sanitizeFirestorePayload(auditEvent));
      await batch.commit();
    } else {
      const local = getLocalItems<ProjectFinancialRecord>(LOCAL_STORAGE_FINANCIAL_KEY, INITIAL_DEMO_FINANCIAL);
      local.unshift(newRecord);
      saveLocalItems(LOCAL_STORAGE_FINANCIAL_KEY, local);
    }

    return newRecord;
  }

  /**
   * Government-only verification of submitted financial records.
   * Only VERIFIED records contribute toward official financial progress.
   */
  static async verifyFinancialRecord(params: {
    projectId: string;
    recordId: string;
    status: 'VERIFIED' | 'REJECTED';
    notes?: string;
    user: AuthUser;
  }): Promise<ProjectFinancialRecord> {
    const { projectId, recordId, status, notes, user } = params;

    const userRole = (user.role || '').toLowerCase();
    if (!userRole.includes('gov')) {
      throw new Error('Access Denied: Only authorized government officers can verify or reject financial expenditure records.');
    }

    const project = await this.getProjectById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found.`);
    }

    const records = await this.getFinancialRecords(projectId);
    const existing = records.find((r) => r.id === recordId);
    if (!existing) {
      throw new Error(`Financial record ${recordId} not found.`);
    }

    if (existing.verificationStatus !== 'PENDING') {
      throw new Error(
        `Invalid Transition: Financial record ${recordId} is already ${existing.verificationStatus}. Verification status transitions are terminal and cannot be modified once set.`
      );
    }

    if (status !== 'VERIFIED' && status !== 'REJECTED') {
      throw new Error('Invalid Status: Verification status must transition to either VERIFIED or REJECTED.');
    }

    const nowIso = new Date().toISOString();
    const updated: ProjectFinancialRecord = {
      ...existing,
      verificationStatus: status,
      verifiedBy: user.id || user.uid,
      verifiedByName: user.name || 'District Nodal Officer',
      verifiedAt: nowIso,
      verificationNotes: notes?.trim() || undefined,
    };

    const nextRecords = records.map((r) => (r.id === recordId ? updated : r));
    const awardedAmount = project.awardedAmount || project.sanctionedAmount || 1;
    const { verifiedAmount, progressPercent } = calculateFinancialProgress(nextRecords, awardedAmount);

    const updatedProject: Project = {
      ...project,
      financialProgressPercent: progressPercent,
      financialProgress: progressPercent,
      utilizedAmount: verifiedAmount,
      amountDisbursed: verifiedAmount,
      disbursedAmount: verifiedAmount,
      updatedAt: nowIso,
      lastVerifiedRecordId: recordId,
    };

    const eventId = `evt-fin-verify-${recordId}`;
    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId,
      action: status === 'VERIFIED' ? 'FINANCIAL_RECORD_VERIFIED' : 'FINANCIAL_RECORD_REJECTED',
      actorId: user.id || user.uid,
      actorRole: 'government',
      actorName: user.name || 'Authorized Officer',
      timestamp: nowIso,
      previousState: { verificationStatus: existing.verificationStatus },
      newState: { recordId, verificationStatus: status },
      notes: notes || `Financial expenditure record ${recordId} was ${status.toLowerCase()}.`,
    };

    if (isLiveFirestoreSession() && db) {
      const batch = writeBatch(db);
      batch.update(doc(db, FINANCIAL_RECORDS_COLLECTION, recordId), sanitizeFirestorePayload(updated));
      batch.update(doc(db, PROJECTS_COLLECTION, projectId), sanitizeFirestorePayload(updatedProject));
      batch.set(doc(db, AUDIT_EVENTS_COLLECTION, eventId), sanitizeFirestorePayload(auditEvent));
      await batch.commit();
    } else {
      const local = getLocalItems<ProjectFinancialRecord>(LOCAL_STORAGE_FINANCIAL_KEY, INITIAL_DEMO_FINANCIAL);
      const idx = local.findIndex((r) => r.id === recordId);
      if (idx !== -1) local[idx] = updated;
      saveLocalItems(LOCAL_STORAGE_FINANCIAL_KEY, local);

      const localProjects = getLocalItems<Project>(LOCAL_STORAGE_PROJECTS_KEY, [INITIAL_DEMO_PROJECT]);
      const pIdx = localProjects.findIndex((p) => p.id === projectId);
      if (pIdx !== -1) {
        localProjects[pIdx] = updatedProject;
        saveLocalItems(LOCAL_STORAGE_PROJECTS_KEY, localProjects);
      }

      const localEvents = getLocalItems<ProjectAuditEvent>(LOCAL_STORAGE_EVENTS_KEY, INITIAL_DEMO_EVENTS);
      localEvents.unshift(auditEvent);
      saveLocalItems(LOCAL_STORAGE_EVENTS_KEY, localEvents);
    }

    // Check exceptions
    await this.runDeterministicExceptionChecks(projectId);

    return updated;
  }

  // ==========================================
  // INSPECTIONS (Government-controlled, append-only)
  // ==========================================

  static async getInspections(projectId: string): Promise<ProjectInspection[]> {
    if (!projectId) return [];

    if (isLiveFirestoreSession() && db) {
      const q = query(
        collection(db, INSPECTIONS_COLLECTION),
        where('projectId', '==', projectId),
        orderBy('inspectionDate', 'desc')
      );
      const snap = await getDocs(q);
      const list: ProjectInspection[] = [];
      snap.forEach((d) => list.push(d.data() as ProjectInspection));
      return list;
    }

    const localInspections = getLocalItems<ProjectInspection>(LOCAL_STORAGE_INSPECTIONS_KEY, INITIAL_DEMO_INSPECTIONS);
    return localInspections.filter((i) => i.projectId === projectId).sort((a, b) => (b.inspectionDate > a.inspectionDate ? 1 : -1));
  }

  static async createInspection(params: {
    projectId: string;
    inspectionDate: string;
    officerName: string;
    officerDesignation?: string;
    inspectionType: InspectionType;
    physicalProgressObserved?: number;
    observations: string;
    issues?: string[];
    correctiveActions?: string[];
    recommendation?: string;
    user: AuthUser;
  }): Promise<ProjectInspection> {
    const { projectId, inspectionDate, officerName, officerDesignation, inspectionType, physicalProgressObserved, observations, issues, correctiveActions, recommendation, user } = params;

    const userRole = (user.role || '').toLowerCase();
    if (!userRole.includes('gov')) {
      throw new Error('Access Denied: Only authorized government officers can record official inspections.');
    }

    if (!observations || observations.trim().length < 10) {
      throw new Error('Validation Error: Inspection observations are required (minimum 10 characters).');
    }

    const id = `insp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const newInspection: ProjectInspection = {
      id,
      projectId,
      inspectionDate: inspectionDate || nowIso,
      officerId: user.id || user.uid,
      officerName: officerName?.trim() || user.name || 'Inspecting Officer',
      officerDesignation: officerDesignation?.trim() || 'Nodal Technical Officer',
      inspectionType,
      physicalProgressObserved: physicalProgressObserved !== undefined ? Number(physicalProgressObserved) : undefined,
      observations: observations.trim(),
      issues: issues?.filter((i) => i.trim().length > 0) || [],
      correctiveActions: correctiveActions?.filter((c) => c.trim().length > 0) || [],
      recommendation: recommendation?.trim() || undefined,
      createdAt: nowIso,
    };

    const eventId = `evt-insp-create-${id}`;
    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId,
      action: 'INSPECTION_CREATED',
      actorId: user.id || user.uid,
      actorRole: 'government',
      actorName: user.name || 'Inspecting Officer',
      timestamp: nowIso,
      newState: { inspectionId: id, type: inspectionType, observedProgress: physicalProgressObserved },
      notes: `Official ${inspectionType} inspection recorded by ${newInspection.officerName}.`,
    };

    if (isLiveFirestoreSession() && db) {
      const batch = writeBatch(db);
      batch.set(doc(db, INSPECTIONS_COLLECTION, id), sanitizeFirestorePayload(newInspection));
      batch.set(doc(db, AUDIT_EVENTS_COLLECTION, eventId), sanitizeFirestorePayload(auditEvent));
      await batch.commit();
    } else {
      const local = getLocalItems<ProjectInspection>(LOCAL_STORAGE_INSPECTIONS_KEY, INITIAL_DEMO_INSPECTIONS);
      local.unshift(newInspection);
      saveLocalItems(LOCAL_STORAGE_INSPECTIONS_KEY, local);

      const localEvents = getLocalItems<ProjectAuditEvent>(LOCAL_STORAGE_EVENTS_KEY, INITIAL_DEMO_EVENTS);
      localEvents.unshift(auditEvent);
      saveLocalItems(LOCAL_STORAGE_EVENTS_KEY, localEvents);
    }

    // Run deterministic exception checks
    await this.runDeterministicExceptionChecks(projectId);

    return newInspection;
  }

  // ==========================================
  // DETERMINISTIC MONITORING EXCEPTIONS
  // ==========================================

  static async getExceptions(projectId: string): Promise<ProjectException[]> {
    if (!projectId) return [];

    if (isLiveFirestoreSession() && db) {
      const q = query(
        collection(db, EXCEPTIONS_COLLECTION),
        where('projectId', '==', projectId)
      );
      const snap = await getDocs(q);
      const list: ProjectException[] = [];
      snap.forEach((d) => list.push(d.data() as ProjectException));
      return list;
    }

    const localExceptions = getLocalItems<ProjectException>(LOCAL_STORAGE_EXCEPTIONS_KEY, []);
    return localExceptions.filter((e) => e.projectId === projectId);
  }

  /**
   * Evaluates Section 18 deterministic monitoring rules:
   * A. Schedule Delay (Milestone overdue)
   * B. Physical Progress Delay (Planned milestone schedule vs actual progress)
   * C. Financial Progress Mismatch (Financial > Physical + 25%)
   * D. Progress Variance (Physical > Financial + 40%)
   * E. Expenditure Over Award (Verified expenditure > awarded amount)
   * F. Stalled Project (IN_PROGRESS with no update for > 30 days)
   */
  static async runDeterministicExceptionChecks(projectId: string): Promise<ProjectException[]> {
    const project = await this.getProjectById(projectId);
    if (!project) return [];

    const milestones = await this.getMilestones(projectId);
    const financialRecords = await this.getFinancialRecords(projectId);
    const updates = await this.getProgressUpdates(projectId);
    const existingExceptions = await this.getExceptions(projectId);

    const now = new Date();
    const newExceptions: ProjectException[] = [];

    // Rule A: Schedule Delay (Milestone overdue)
    for (const ms of milestones) {
      if (ms.plannedEndDate && ms.status !== 'COMPLETED') {
        const plannedEnd = new Date(ms.plannedEndDate);
        if (now > plannedEnd) {
          const daysOverdue = Math.floor((now.getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24));
          const type = `SCHEDULE_DELAY_${ms.id}`;
          if (!existingExceptions.some((e) => e.type === type && e.status !== 'RESOLVED')) {
            newExceptions.push({
              id: `exc-sched-${ms.id}-${Date.now()}`,
              projectId,
              type,
              severity: daysOverdue > 30 ? 'HIGH' : 'MEDIUM',
              title: `Milestone Overdue: ${ms.title}`,
              description: `Milestone #${ms.sequence} planned end date was ${plannedEnd.toLocaleDateString('en-IN')} (${daysOverdue} days overdue) with ${ms.progressPercent}% progress.`,
              detectedAt: now.toISOString(),
              source: 'SYSTEM_RULE',
              status: 'OPEN',
            });
          }
        }
      }
    }

    // Rule B: Physical Progress Delay (Milestone actual progress vs elapsed schedule)
    for (const ms of milestones) {
      if (ms.status !== 'COMPLETED' && ms.plannedStartDate && ms.plannedEndDate) {
        const plannedStart = new Date(ms.plannedStartDate);
        const plannedEnd = new Date(ms.plannedEndDate);

        // Guard against invalid dates, before planned start, or non-positive duration
        if (!isNaN(plannedStart.getTime()) && !isNaN(plannedEnd.getTime()) && now >= plannedStart && plannedEnd > plannedStart) {
          const totalDuration = plannedEnd.getTime() - plannedStart.getTime();
          const elapsedDuration = now.getTime() - plannedStart.getTime();
          const expectedProgress = Math.min(100, Math.max(0, (elapsedDuration / totalDuration) * 100));
          const actualProgress = ms.progressPercent || 0;
          const progressLag = expectedProgress - actualProgress;

          // Flag if actual progress is materially behind the elapsed planned schedule (> 25 percentage points)
          if (progressLag > 25) {
            const type = `PHYSICAL_PROGRESS_DELAY_${ms.id}`;
            if (!existingExceptions.some((e) => e.type === type && e.status !== 'RESOLVED')) {
              newExceptions.push({
                id: `exc-phys-delay-${ms.id}-${Date.now()}`,
                projectId,
                type,
                severity: progressLag > 50 ? 'HIGH' : 'MEDIUM',
                title: `Physical Progress Delay: ${ms.title}`,
                description: `Milestone #${ms.sequence} is at ${actualProgress}% progress vs expected schedule progress of ${Math.round(expectedProgress)}% (${Math.round(progressLag)}% behind schedule).`,
                detectedAt: now.toISOString(),
                source: 'SYSTEM_RULE',
                status: 'OPEN',
              });
            }
          }
        }
      }
    }

    // Rule C, D & E: Financial Calculations
    const awardedAmount = project.awardedAmount || project.sanctionedAmount || 0;
    const { verifiedAmount, progressPercent: finProgPercent } = calculateFinancialProgress(financialRecords, awardedAmount);
    const physProgPercent = project.physicalProgressPercent || 0;

    // Rule C: Financial Progress Mismatch (financial > physical + 25%)
    if (finProgPercent > physProgPercent + 25) {
      const type = 'FINANCIAL_PROGRESS_MISMATCH';
      if (!existingExceptions.some((e) => e.type === type && e.status !== 'RESOLVED')) {
        newExceptions.push({
          id: `exc-fin-mismatch-${Date.now()}`,
          projectId,
          type,
          severity: 'MEDIUM',
          title: 'Financial Disbursal Ahead of Physical Progress',
          description: `Verified financial utilization (${finProgPercent}%) significantly exceeds recorded physical progress (${physProgPercent}%). Variance requires review.`,
          detectedAt: now.toISOString(),
          source: 'SYSTEM_RULE',
          status: 'OPEN',
        });
      }
    }

    // Rule D: Progress Variance (Physical progress > verified financial progress + 40%)
    if (physProgPercent > finProgPercent + 40) {
      const type = 'PROGRESS_VARIANCE';
      if (!existingExceptions.some((e) => e.type === type && e.status !== 'RESOLVED')) {
        const variance = physProgPercent - finProgPercent;
        newExceptions.push({
          id: `exc-prog-variance-${Date.now()}`,
          projectId,
          type,
          severity: variance > 60 ? 'HIGH' : 'MEDIUM',
          title: 'Physical Progress Substantially Ahead of Financial Disbursal',
          description: `Recorded physical progress (${physProgPercent}%) exceeds verified financial progress (${finProgPercent}%) by ${variance} percentage points. Requires verification of unbilled works or disbursement backlog.`,
          detectedAt: now.toISOString(),
          source: 'SYSTEM_RULE',
          status: 'OPEN',
        });
      }
    }

    // Rule E: Expenditure Over Award
    if (awardedAmount > 0 && verifiedAmount > awardedAmount) {
      const type = 'EXPENDITURE_OVER_AWARD';
      if (!existingExceptions.some((e) => e.type === type && e.status !== 'RESOLVED')) {
        const excess = verifiedAmount - awardedAmount;
        newExceptions.push({
          id: `exc-fin-over-${Date.now()}`,
          projectId,
          type,
          severity: 'HIGH',
          title: 'Verified Expenditure Exceeds Awarded Contract Value',
          description: `Total verified expenditure (₹${verifiedAmount.toLocaleString('en-IN')}) exceeds the awarded contract value (₹${awardedAmount.toLocaleString('en-IN')}) by ₹${excess.toLocaleString('en-IN')}. Requires administrative scrutiny.`,
          detectedAt: now.toISOString(),
          source: 'SYSTEM_RULE',
          status: 'OPEN',
        });
      }
    }

    // Rule F: Stalled Project (IN_PROGRESS but no update for > 30 days)
    if (project.status === 'IN_PROGRESS') {
      const referenceDateStr = updates.length > 0
        ? (updates[0].createdAt || updates[0].updateDate)
        : project.implementationStartDate;

      if (referenceDateStr) {
        const referenceDate = new Date(referenceDateStr);
        if (!isNaN(referenceDate.getTime())) {
          const daysSinceReference = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceReference > 30) {
            const type = 'STALLED_PROJECT';
            if (!existingExceptions.some((e) => e.type === type && e.status !== 'RESOLVED')) {
              newExceptions.push({
                id: `exc-stalled-${Date.now()}`,
                projectId,
                type,
                severity: 'MEDIUM',
                title: 'No Recent Implementation Update',
                description: `Project is marked IN_PROGRESS but no progress updates have been recorded in the past ${daysSinceReference} days.`,
                detectedAt: now.toISOString(),
                source: 'SYSTEM_RULE',
                status: 'OPEN',
              });
            }
          }
        }
      }
    }

    // Persist any newly detected exceptions and their corresponding audit events
    if (newExceptions.length > 0) {
      const nowIso = now.toISOString();
      const currentActorId = auth?.currentUser?.uid || 'gov-system';
      const currentActorName = auth?.currentUser?.displayName || 'Authorized Monitoring Officer';

      const auditEvents: ProjectAuditEvent[] = newExceptions.map((exc) => ({
        eventId: `evt-exc-detect-${exc.id}`,
        projectId,
        action: 'EXCEPTION_DETECTED',
        actorId: currentActorId,
        actorRole: 'government',
        actorName: currentActorName,
        timestamp: exc.detectedAt || nowIso,
        newState: {
          exceptionId: exc.id,
          type: exc.type,
          severity: exc.severity,
          status: exc.status,
        },
        metadata: {
          source: 'SYSTEM_RULE',
          type: exc.type,
          severity: exc.severity,
        },
        notes: `System rule detected exception: ${exc.title}`,
      }));

      if (isLiveFirestoreSession() && db) {
        const batch = writeBatch(db);
        for (let i = 0; i < newExceptions.length; i++) {
          const exc = newExceptions[i];
          const evt = auditEvents[i];
          batch.set(doc(db, EXCEPTIONS_COLLECTION, exc.id), sanitizeFirestorePayload(exc));
          batch.set(doc(db, AUDIT_EVENTS_COLLECTION, evt.eventId), sanitizeFirestorePayload(evt));
        }
        await batch.commit();
      } else {
        const local = getLocalItems<ProjectException>(LOCAL_STORAGE_EXCEPTIONS_KEY, []);
        local.unshift(...newExceptions);
        saveLocalItems(LOCAL_STORAGE_EXCEPTIONS_KEY, local);

        const localEvents = getLocalItems<ProjectAuditEvent>(LOCAL_STORAGE_EVENTS_KEY, INITIAL_DEMO_EVENTS);
        localEvents.unshift(...auditEvents);
        saveLocalItems(LOCAL_STORAGE_EVENTS_KEY, localEvents);
      }
    }

    return [...existingExceptions, ...newExceptions];
  }

  static async acknowledgeException(params: {
    projectId: string;
    exceptionId: string;
    user: AuthUser;
  }): Promise<ProjectException> {
    const { projectId, exceptionId, user } = params;

    const userRole = (user.role || '').toLowerCase();
    if (!userRole.includes('gov')) {
      throw new Error('Access Denied: Only authorized government officers can acknowledge monitoring exceptions.');
    }

    const exceptions = await this.getExceptions(projectId);
    const existing = exceptions.find((e) => e.id === exceptionId);
    if (!existing) {
      throw new Error(`Exception ${exceptionId} not found.`);
    }

    if (existing.status !== 'OPEN') {
      throw new Error(`Invalid Transition: Only OPEN exceptions can be ACKNOWLEDGED. Current status is ${existing.status}.`);
    }

    const nowIso = new Date().toISOString();
    const updated: ProjectException = {
      ...existing,
      status: 'ACKNOWLEDGED',
    };

    const eventId = `evt-exc-ack-${exceptionId}`;
    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId,
      action: 'EXCEPTION_ACKNOWLEDGED',
      actorId: user.id || user.uid,
      actorRole: 'government',
      actorName: user.name || 'Authorized Officer',
      timestamp: nowIso,
      newState: { exceptionId, status: 'ACKNOWLEDGED' },
      notes: `Monitoring exception "${existing.title}" acknowledged by ${user.name || 'Authorized Officer'}.`,
    };

    if (isLiveFirestoreSession() && db) {
      const batch = writeBatch(db);
      batch.update(doc(db, EXCEPTIONS_COLLECTION, exceptionId), sanitizeFirestorePayload(updated));
      batch.set(doc(db, AUDIT_EVENTS_COLLECTION, eventId), sanitizeFirestorePayload(auditEvent));
      await batch.commit();
    } else {
      const local = getLocalItems<ProjectException>(LOCAL_STORAGE_EXCEPTIONS_KEY, []);
      const idx = local.findIndex((e) => e.id === exceptionId);
      if (idx !== -1) {
        local[idx] = updated;
        saveLocalItems(LOCAL_STORAGE_EXCEPTIONS_KEY, local);
      }
      const localEvents = getLocalItems<ProjectAuditEvent>(LOCAL_STORAGE_EVENTS_KEY, INITIAL_DEMO_EVENTS);
      localEvents.unshift(auditEvent);
      saveLocalItems(LOCAL_STORAGE_EVENTS_KEY, localEvents);
    }

    return updated;
  }

  static async resolveException(params: {
    projectId: string;
    exceptionId: string;
    resolutionNote: string;
    user: AuthUser;
  }): Promise<ProjectException> {
    const { projectId, exceptionId, resolutionNote, user } = params;

    const userRole = (user.role || '').toLowerCase();
    if (!userRole.includes('gov')) {
      throw new Error('Access Denied: Only authorized government officers can resolve monitoring exceptions.');
    }

    if (!resolutionNote || resolutionNote.trim().length < 10) {
      throw new Error('Validation Error: A mandatory administrative resolution note (min 10 chars) is required.');
    }

    const exceptions = await this.getExceptions(projectId);
    const existing = exceptions.find((e) => e.id === exceptionId);
    if (!existing) {
      throw new Error(`Exception ${exceptionId} not found.`);
    }

    if (existing.status !== 'ACKNOWLEDGED') {
      throw new Error(
        `Invalid Transition: Exception ${exceptionId} must be in ACKNOWLEDGED status before it can be marked RESOLVED. Current status is ${existing.status}.`
      );
    }

    const nowIso = new Date().toISOString();
    const updated: ProjectException = {
      ...existing,
      status: 'RESOLVED',
      resolvedBy: user.id || user.uid,
      resolvedByName: user.name || 'Authorized Officer',
      resolvedAt: nowIso,
      resolutionNote: resolutionNote.trim(),
    };

    const eventId = `evt-exc-resolve-${exceptionId}`;
    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId,
      action: 'EXCEPTION_RESOLVED',
      actorId: user.id || user.uid,
      actorRole: 'government',
      actorName: user.name || 'Authorized Officer',
      timestamp: nowIso,
      newState: { exceptionId, resolutionNote: updated.resolutionNote },
      notes: `Monitoring exception "${existing.title}" resolved: ${updated.resolutionNote}`,
    };

    if (isLiveFirestoreSession() && db) {
      const batch = writeBatch(db);
      batch.update(doc(db, EXCEPTIONS_COLLECTION, exceptionId), sanitizeFirestorePayload(updated));
      batch.set(doc(db, AUDIT_EVENTS_COLLECTION, eventId), sanitizeFirestorePayload(auditEvent));
      await batch.commit();
    } else {
      const local = getLocalItems<ProjectException>(LOCAL_STORAGE_EXCEPTIONS_KEY, []);
      const idx = local.findIndex((e) => e.id === exceptionId);
      if (idx !== -1) {
        local[idx] = updated;
        saveLocalItems(LOCAL_STORAGE_EXCEPTIONS_KEY, local);
      }
      const localEvents = getLocalItems<ProjectAuditEvent>(LOCAL_STORAGE_EVENTS_KEY, INITIAL_DEMO_EVENTS);
      localEvents.unshift(auditEvent);
      saveLocalItems(LOCAL_STORAGE_EVENTS_KEY, localEvents);
    }

    return updated;
  }

  // ==========================================
  // AUDIT TRAIL (Append-only)
  // ==========================================

  static async getAuditEvents(projectId: string): Promise<ProjectAuditEvent[]> {
    if (!projectId) return [];

    if (isLiveFirestoreSession() && db) {
      const q = query(
        collection(db, AUDIT_EVENTS_COLLECTION),
        where('projectId', '==', projectId),
        orderBy('timestamp', 'desc')
      );
      const snap = await getDocs(q);
      const list: ProjectAuditEvent[] = [];
      snap.forEach((d) => list.push(d.data() as ProjectAuditEvent));
      return list;
    }

    const localEvents = getLocalItems<ProjectAuditEvent>(LOCAL_STORAGE_EVENTS_KEY, INITIAL_DEMO_EVENTS);
    return localEvents.filter((e) => e.projectId === projectId).sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
  }
}
