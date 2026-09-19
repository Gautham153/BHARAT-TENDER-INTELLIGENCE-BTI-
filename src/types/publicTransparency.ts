// Bharat Tender Intelligence (BTI) — Public Transparency Domain Types
// Phase 9: Public Transparency & Citizen Social Audit Layer
// Strictly allowlisted public data projection schema — internal risk intelligence is prohibited.

import { CanonicalProjectStatus } from './project';

export interface PublicMilestoneSummaryDTO {
  sequence: number;
  title: string;
  progressPercent: number;
  status: string;
  weightPercent: number;
}

export interface PublicMilestoneDTO {
  sequence: number;
  title: string;
  description?: string;
  plannedEndDate?: string;
  actualEndDate?: string;
  weightPercent: number;
  progressPercent: number;
  status: string;
}

export interface PublicProgressUpdateDTO {
  date: string;
  progressPercentage: number;
  summary: string;
  implementationStatus: string;
}

export interface PublicInspectionDTO {
  inspectionDate: string;
  observedProgress: number;
  qualityObservation: string;
  publicDirective?: string;
}

export interface PublicTimelineEventDTO {
  id: string;
  type: 'SANCTION' | 'AWARD' | 'START' | 'MILESTONE' | 'INSPECTION' | 'UPDATE' | 'STATUS_CHANGE';
  title: string;
  date: string;
  description: string;
  progressPercent?: number;
  rawDate?: string;
}

export interface PublicAccountabilityDTO {
  lastUpdated: string;
  lastInspectionDate: string;
  milestonesCompletedCount: number;
  milestonesTotalCount: number;
  financialUtilizationPercent: number;
  physicalProgressPercent: number;
  statusLabel: string;
}

export interface PublicDataProvenanceDTO {
  sourceCategories: string[];
  explanation: string;
  disclaimer: string;
}

/**
 * Authoritative Public-Safe Projection DTO
 * MUST contain ONLY fields explicitly approved for public disclosure.
 * Internal anomaly findings, risk scores, AI advisories, investigation notes,
 * and confidential comments are strictly excluded by design.
 */
export interface PublicProjectDTO {
  projectId: string;
  projectNumber?: string;
  projectName: string;
  description?: string;
  category: string;
  sector?: string;
  location: {
    state?: string;
    district?: string;
    constituency?: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
  status: CanonicalProjectStatus;
  statusLabel: string;
  implementingAgencyName?: string;
  authorityName?: string;
  mpName?: string;

  // Authoritative numeric financials
  sanctionedAmount: number;
  awardedAmount?: number;
  verifiedExpenditure: number; // Verified public fund disbursal
  hasVerifiedExpenditureRecords?: boolean;
  remainingAwardedBalance?: number; // awardedAmount - verifiedExpenditure
  isFinancialIncomplete?: boolean;

  // Progress
  physicalProgressPercent: number;
  milestonesSummary: PublicMilestoneSummaryDTO[];
  milestones: PublicMilestoneDTO[];
  publicUpdates: PublicProgressUpdateDTO[];
  publicInspections: PublicInspectionDTO[];
  publicTimeline: PublicTimelineEventDTO[];
  accountabilityIndicators: PublicAccountabilityDTO;
  dataProvenance: PublicDataProvenanceDTO;

  // Verification & Metadata
  isDemonstrationData: boolean;
  isPubliclyVisible: boolean;
  publicDisclosureStatus?: 'PUBLIC';
  lastUpdated?: string;
  startDate?: string;
  plannedCompletionDate?: string;
  actualCompletionDate?: string;
}

export interface PublicTransparencyFilterParams {
  search?: string;
  status?: string;
  state?: string;
  district?: string;
  category?: string;
  sortBy?: 'lastUpdated' | 'sanctionedAmount' | 'physicalProgress' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}
