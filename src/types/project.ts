// Bharat Tender Intelligence (BTI) — Project Domain Types & Interfaces
// Phase 6: MPLAD Project & Implementation Monitoring Foundation

import { CanonicalProposalStatus } from './proposal';

export type CanonicalProjectStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CLOSED';

export type LegacyProjectStatus = 'Planning' | 'In Progress' | 'Under Inspection' | 'Completed' | 'Delayed' | 'Halted';

export type ProjectStatus = CanonicalProjectStatus | LegacyProjectStatus;

export function toCanonicalProjectStatus(status?: string): CanonicalProjectStatus {
  const norm = (status || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (norm === 'PLANNING') return 'NOT_STARTED';
  if (norm === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (norm === 'UNDER_INSPECTION' || norm === 'DELAYED' || norm === 'HALTED') return 'ON_HOLD';
  if (norm === 'COMPLETED') return 'COMPLETED';
  if (norm === 'CLOSED') return 'CLOSED';
  return (norm as CanonicalProjectStatus) || 'NOT_STARTED';
}

export type ProjectMilestoneStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DELAYED';

export interface ProjectSupportingDocument {
  id: string;
  fileName: string;
  documentType?: string;
  fileUrl?: string;
  fileSize?: string;
  uploadedAt?: string;
  uploadedBy?: string;
}

/**
 * Authoritative Master Project Record
 */
export interface Project {
  id: string;
  projectNumber?: string; // e.g. BTI/MPLAD/2026/0001

  tenderId?: string;
  proposalId?: string;
  organizationId?: string;

  title: string;
  description?: string;

  authorityId?: string;
  authorityName?: string;
  implementingAgencyName?: string;

  sector?: string;
  category?: string | any;

  state?: string;
  district?: string;
  constituency?: string;

  // Authoritative numeric financial values (in INR)
  sanctionedAmount?: number;
  awardedAmount?: number;

  startDate?: string;
  implementationStartDate?: string;
  plannedCompletionDate?: string;
  actualCompletionDate?: string;
  completionChecklist?: ProjectCompletionChecklist;

  status: ProjectStatus;

  // Calculated deterministic progress percentages (0-100)
  physicalProgressPercent?: number;
  financialProgressPercent?: number;

  createdAt?: string;
  updatedAt?: string;
  lastProgressUpdateId?: string;
  lastMilestoneId?: string;
  lastVerifiedRecordId?: string;
  lastStatusChangeEventId?: string;
  milestonesSummary?: ProjectMilestoneSummary[];

  // Compatibility fields for GIS maps and existing dashboards
  lat?: number;
  lng?: number;
  locationCoordinates?: {
    lat: number;
    lng: number;
    address: string;
  };
  projectCode?: string;
  tenderNumber?: string;
  assignedAgencyId?: string;
  executingAgencyName?: string;
  agencyName?: string;
  sanctionedBudget?: number;
  amountDisbursed?: number;
  disbursedAmount?: number;
  utilizedAmount?: number;
  physicalProgress?: number;
  financialProgress?: number;
  targetCompletionDate?: string;
  mpName?: string;
  riskScore?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'Low' | 'Medium' | 'High' | 'Critical';
  riskSignals?: string[];
  beneficiariesCount?: number;
  lastUpdated?: string;
  updates?: any[];
  images?: any[];
  inspections?: any[];
}

/**
 * Implementation Milestones
 */
export interface ProjectMilestone {
  id: string;
  projectId: string;
  sequence: number;
  title: string;
  description?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  weightPercent: number; // 0 to 100
  progressPercent: number; // 0 to 100
  status: ProjectMilestoneStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMilestoneSummary {
  id: string;
  sequence: number;
  title: string;
  weightPercent: number;
  progressPercent: number;
  status: ProjectMilestoneStatus;
}

/**
 * Progress Update Submissions
 */
export interface ProjectProgressUpdate {
  id: string;
  projectId: string;
  milestoneId?: string;
  milestoneTitle?: string;

  submittedBy: string; // Auth UID
  submittedByRole: 'AGENCY' | 'GOVERNMENT';
  submittedByName?: string;

  updateDate: string;
  physicalProgressPercent?: number;

  workCompletedDescription: string;
  issues?: string[];
  correctiveAction?: string;

  supportingDocuments?: ProjectSupportingDocument[];
  createdAt: string;
}

/**
 * Financial Utilization Records
 */
export type ExpenditureType = 'MATERIAL' | 'LABOUR' | 'EQUIPMENT' | 'OTHER';
export type FinancialVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface ProjectFinancialRecord {
  id: string;
  projectId: string;

  entryDate: string;
  amount: number; // > 0, numeric INR
  expenditureType: ExpenditureType;
  description: string;
  referenceNumber?: string; // Voucher / Invoice / Bank ref

  submittedBy: string;
  submittedByRole: 'AGENCY' | 'GOVERNMENT';
  submittedByName?: string;

  verificationStatus: FinancialVerificationStatus;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  verificationNotes?: string;

  createdAt: string;
}

/**
 * Official Inspection Records (Government-controlled, append-only)
 */
export type InspectionType = 'ROUTINE' | 'MILESTONE' | 'COMPLAINT' | 'FINAL';

export interface ProjectInspection {
  id: string;
  projectId: string;

  inspectionDate: string;
  officerId: string;
  officerName: string;
  officerDesignation?: string;

  inspectionType: InspectionType;
  physicalProgressObserved?: number;

  observations: string;
  issues?: string[];
  correctiveActions?: string[];
  recommendation?: string;

  supportingDocuments?: ProjectSupportingDocument[];
  createdAt: string;
}

/**
 * Deterministic Monitoring Exceptions
 * (Rule-based condition markers requiring human review — NOT fraud declarations)
 */
export type ProjectExceptionSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type ProjectExceptionStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
export type ProjectExceptionType =
  | 'SCHEDULE_DELAY'
  | 'PHYSICAL_PROGRESS_DELAY'
  | 'FINANCIAL_PROGRESS_MISMATCH'
  | 'PROGRESS_VARIANCE'
  | 'EXPENDITURE_OVER_AWARD'
  | 'STALLED_PROJECT';

export interface ProjectException {
  id: string;
  projectId: string;

  type: ProjectExceptionType | string;
  severity: ProjectExceptionSeverity;

  title: string;
  description: string;

  detectedAt: string;
  source: 'SYSTEM_RULE';

  status: ProjectExceptionStatus;

  resolvedBy?: string;
  resolvedByName?: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

/**
 * Append-Only Project Audit Trail
 */
export type ProjectAuditAction =
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'STATUS_CHANGED'
  | 'MILESTONE_CREATED'
  | 'MILESTONE_UPDATED'
  | 'PROGRESS_UPDATE_SUBMITTED'
  | 'FINANCIAL_RECORD_SUBMITTED'
  | 'FINANCIAL_RECORD_VERIFIED'
  | 'FINANCIAL_RECORD_REJECTED'
  | 'INSPECTION_CREATED'
  | 'EXCEPTION_DETECTED'
  | 'EXCEPTION_ACKNOWLEDGED'
  | 'EXCEPTION_RESOLVED';

export interface ProjectAuditEvent {
  eventId: string;
  projectId: string;
  action: ProjectAuditAction;
  actorId: string;
  actorRole: 'agency' | 'government' | 'system';
  actorName?: string;
  timestamp: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  notes?: string;
}

/**
 * Project Completion Verification Checklist
 */
export interface ProjectCompletionChecklist {
  physicalWorkCompleted: boolean;
  finalMilestoneCompleted: boolean;
  financialRecordsReviewed: boolean;
  finalInspectionCompleted: boolean;
  supportingInformationAvailable: boolean;
}
