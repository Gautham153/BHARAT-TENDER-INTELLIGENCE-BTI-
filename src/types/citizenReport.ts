// Bharat Tender Intelligence (BTI) — Citizen Report & Social Audit Types
// Phase 10: Citizen Grievance & Participatory Social Audit

export type CitizenReportNature =
  | 'SUBSTANDARD_MATERIAL'
  | 'GHOST_PROJECT'
  | 'UNREASONABLE_DELAY'
  | 'CONTRACTOR_NEGLIGENCE'
  | 'PROGRESS_MISREPRESENTATION'
  | 'WORK_QUALITY_CONCERN'
  | 'FINANCIAL_WORK_MISMATCH'
  | 'OTHER';

export const CITIZEN_REPORT_NATURE_LABELS: Record<CitizenReportNature, { label: string; description: string }> = {
  SUBSTANDARD_MATERIAL: {
    label: 'Substandard Material Quality',
    description: 'Inferior or defective materials observed being used at project site.',
  },
  GHOST_PROJECT: {
    label: 'Ghost Project / No Work on Ground',
    description: 'Official records show progress/completion but no physical work exists on site.',
  },
  UNREASONABLE_DELAY: {
    label: 'Unreasonable Project Delay',
    description: 'Work has halted or is delayed substantially beyond sanctioned timelines.',
  },
  CONTRACTOR_NEGLIGENCE: {
    label: 'Contractor Negligence / Abandonment',
    description: 'Site has been abandoned or left unattended posing safety/public concerns.',
  },
  PROGRESS_MISREPRESENTATION: {
    label: 'Progress Misrepresentation',
    description: 'Reported percentage of completion diverges noticeably from ground reality.',
  },
  WORK_QUALITY_CONCERN: {
    label: 'Work Quality Concern',
    description: 'Structural flaws, poor craftsmanship, or safety hazards observed.',
  },
  FINANCIAL_WORK_MISMATCH: {
    label: 'Financial / Work Mismatch',
    description: 'Reported expenditure appears disproportionate to visible physical assets.',
  },
  OTHER: {
    label: 'Other Implementation Discrepancy',
    description: 'Other non-categorized ground-level implementation concerns.',
  },
};

export type CitizenReportStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'VERIFICATION_REQUIRED'
  | 'VERIFIED'
  | 'VERIFIED_DISCREPANCY'
  | 'NOT_SUBSTANTIATED'
  | 'INCONCLUSIVE'
  | 'DISMISSED'
  | 'DUPLICATE_OR_INVALID'
  | 'ACTIONED'
  | 'CLOSED';

export const CITIZEN_REPORT_STATUS_CONFIG: Record<
  CitizenReportStatus,
  { label: string; variant: 'default' | 'warning' | 'danger' | 'success' | 'info'; colorClass: string; description: string }
> = {
  SUBMITTED: {
    label: 'Submitted',
    variant: 'info',
    colorClass: 'bg-sky-50 text-sky-700 border-sky-200',
    description: 'Report submitted by citizen and awaiting initial government review.',
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    variant: 'warning',
    colorClass: 'bg-amber-50 text-amber-800 border-amber-200',
    description: 'Under examination by district nodal monitoring officers.',
  },
  VERIFICATION_REQUIRED: {
    label: 'Verification Required',
    variant: 'warning',
    colorClass: 'bg-orange-50 text-orange-800 border-orange-200',
    description: 'On-site engineering inspection or physical verification requested.',
  },
  VERIFIED: {
    label: 'Verified Discrepancy',
    variant: 'danger',
    colorClass: 'bg-rose-50 text-rose-800 border-rose-200',
    description: 'Discrepancy officially verified by authorized government officer.',
  },
  VERIFIED_DISCREPANCY: {
    label: 'Verified Discrepancy',
    variant: 'danger',
    colorClass: 'bg-rose-50 text-rose-800 border-rose-200',
    description: 'Discrepancy officially verified by authorized government officer.',
  },
  NOT_SUBSTANTIATED: {
    label: 'Not Substantiated',
    variant: 'default',
    colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    description: 'Government review established that ground conditions match official records.',
  },
  INCONCLUSIVE: {
    label: 'Inconclusive',
    variant: 'warning',
    colorClass: 'bg-slate-100 text-slate-700 border-slate-200',
    description: 'Available evidence is insufficient to establish discrepancy.',
  },
  DUPLICATE_OR_INVALID: {
    label: 'Duplicate / Invalid',
    variant: 'default',
    colorClass: 'bg-slate-100 text-slate-500 border-slate-200',
    description: 'Report is redundant, out of scope, or non-actionable.',
  },
  DISMISSED: {
    label: 'Dismissed',
    variant: 'default',
    colorClass: 'bg-slate-100 text-slate-600 border-slate-200',
    description: 'Report deemed frivolous, out of scope, or non-actionable.',
  },
  ACTIONED: {
    label: 'Actioned',
    variant: 'success',
    colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Corrective action or exception resolution underway.',
  },
  CLOSED: {
    label: 'Closed',
    variant: 'default',
    colorClass: 'bg-slate-100 text-slate-700 border-slate-200',
    description: 'Official verification cycle concluded and recorded.',
  },
};

export const CITIZEN_REPORT_STATUS_LABELS = CITIZEN_REPORT_STATUS_CONFIG;

export type CitizenReporterMode = 'ANONYMOUS' | 'IDENTIFIED';

export interface CitizenReportMedia {
  mediaId: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  storagePath?: string;
  uploadedAt: string;
  caption?: string;
}

export interface CitizenProjectReport {
  reportId: string;
  projectId: string;
  projectNameSnapshot: string;
  projectLocationSnapshot: string;
  constituencySnapshot: string;
  projectNumberSnapshot?: string;

  // Convenience aliases for flexible display
  projectTitle?: string;
  constituency?: string;
  location?: string;
  projectSnapshot?: {
    status?: string;
    physicalProgressPercent?: number;
    sanctionedAmount?: number;
    implementingAgency?: string;
  };

  reporterMode: CitizenReporterMode;
  reporterName?: string;
  reporterMobile?: string;

  natureOfAnomaly: CitizenReportNature;
  specificEvidence: string;
  locationDetails: string;

  media?: CitizenReportMedia[];

  submittedAt: string;
  updatedAt: string;

  status: CitizenReportStatus;

  // Government Review & Verification fields
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;

  verificationDecision?: 'VERIFIED' | 'NOT_SUBSTANTIATED' | 'DISMISSED' | 'MORE_INFO_REQUESTED';
  verificationNotes?: string;
  reviewNotes?: string;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;

  // AI comparator advisory
  aiAdvisory?: any;

  // Provenance linking to existing Phase 7 finding & Phase 6/7 exception
  linkedFindingId?: string;
  linkedFindingTitle?: string;
  linkedExceptionId?: string;
  linkedExceptionTitle?: string;

  auditHistory?: {
    action: string;
    performedByName: string;
    performedById?: string;
    timestamp: string;
    notes?: string;
  }[];

  relatedReportIds?: string[];
  isDemonstrationData?: boolean;
}

export interface CitizenReportSubmissionInput {
  projectId: string;
  reporterMode: CitizenReporterMode;
  reporterName?: string;
  reporterMobile?: string;
  natureOfAnomaly: CitizenReportNature;
  specificEvidence: string;
  locationDetails: string;
  media?: CitizenReportMedia[];
}

export interface CitizenReportVerificationInput {
  status: CitizenReportStatus;
  verificationDecision?: 'VERIFIED' | 'NOT_SUBSTANTIATED' | 'DISMISSED' | 'MORE_INFO_REQUESTED';
  verificationNotes: string;
  linkedFindingId?: string;
  linkedFindingTitle?: string;
  createProjectException?: boolean;
  exceptionSeverity?: 'LOW' | 'MEDIUM' | 'HIGH';
  relatedReportIds?: string[];
}

export interface CitizenReportAdvisoryComparison {
  milestoneComparison?: {
    claimedDiscrepancy: string;
    officialReportedProgress: number;
    completedMilestones: string[];
    pendingMilestones: string[];
  };
  financialComparison?: {
    sanctionedAmount: number;
    verifiedExpenditure: number;
    utilizationPercent: number;
  };
  inspectionComparison?: {
    lastInspectionDate?: string;
    lastInspectedProgress?: number;
    findingsSummary?: string;
  };
}

export interface CitizenReportAdvisoryResult {
  advisorySummary: string;
  evidenceConsistency: 'CONSISTENT' | 'INCONCLUSIVE' | 'INCONSISTENT' | 'INSUFFICIENT_EVIDENCE';
  visualEvidenceAssessment?: string;
  officialComparison: CitizenReportAdvisoryComparison;
  recommendedVerificationAreas: string[];
  missingEvidence: string[];
  limitations: string;
  generatedAt: string;
}

/**
 * Sanitized, public-safe DTO for citizen report tracking.
 * Strictly excludes reporter identity, officer names, investigation notes,
 * internal AI advisory/risk scores, and evidence chain data.
 */
export interface PublicCitizenReportStatusDTO {
  reportId: string;
  submittedAt: string;
  projectTitle: string;
  projectId: string;
  status: CitizenReportStatus;
  statusLabel: string;
  statusDescription: string;
  statusColorClass: string;
  updatedAt: string;
  natureOfAnomalyLabel: string;
  locationSnapshot?: string;
  isDemonstrationData?: boolean;
}

