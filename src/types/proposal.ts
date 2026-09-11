// Bharat Tender Intelligence (BTI) — Proposal Domain Types & Interfaces
// Phase 4: Agency Proposal Submission & Government Proposal Inbox

import { Document } from './tender';

export type CanonicalProposalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'SHORTLISTED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'AWARDED';

export type LegacyProposalStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Under Evaluation'
  | 'Shortlisted'
  | 'Awarded'
  | 'Rejected';

export type ProposalStatus = CanonicalProposalStatus | LegacyProposalStatus;

export interface ProposalDocument {
  id: string;
  proposalId: string;
  documentType: string;
  fileName: string;
  storagePath?: string;
  uploadedBy: string;
  uploadedAt: string;
  fileSize?: string;
  fileUrl?: string;
  verificationStatus: 'NOT_REVIEWED' | 'ACCEPTED' | 'REQUIRES_REVIEW' | 'REJECTED';
}

export interface ProposalMilestone {
  id: string;
  title: string;
  description: string;
  expectedCompletion: string; // e.g. "Month 2" or "45 Days"
  deliverables?: string;
}

export interface PastExperienceItem {
  id: string;
  projectName: string;
  clientAuthority: string;
  projectCategory: string;
  value: number; // in INR
  year: string;
  description: string;
}

export type ProjectMilestone = ProposalMilestone;
export type PastProjectExperience = PastExperienceItem;

export interface TechnicalProposal {
  technicalApproach: string;
  proposedSolution: string;
  scopeUnderstanding: string;
  technicalMethodology: string;
  keyDeliverables: string;
  qualityAssuranceApproach: string;
  technicalAssumptions?: string;
}

export interface ImplementationPlan {
  implementationApproach: string;
  projectPhases?: string;
  milestones: ProposalMilestone[];
  resourcePlan: string;
  riskConsiderations: string;
  completionStrategy: string;
}

export interface FinancialProposal {
  baseAmount: number; // Quoted base amount in INR (> 0)
  taxAmount: number; // GST/Tax amount in INR (>= 0)
  totalProposedAmount: number; // baseAmount + taxAmount in INR
  costBreakdown?: string;
  paymentMilestones?: string;
}

export interface TimelineProposal {
  proposedDurationValue: number;
  proposedDurationUnit: 'days' | 'weeks' | 'months';
  proposedStartDate?: string;
  proposedCompletionDate?: string;
}

export interface ExperienceProposal {
  relevantExperienceSummary: string;
  yearsOfExperience: number;
  keyCapabilities: string;
  availableResources?: string;
  technicalPersonnel?: string;
  pastProjects: PastExperienceItem[];
}

export interface ComplianceDeclarations {
  accuracyConfirmed: boolean;
  eligibilitySatisfied: boolean;
  documentsAuthentic: boolean;
  termsAgreed: boolean;
  declaredAt?: string;
  declaredBy?: string;
}

export interface Proposal {
  id: string;
  proposalNumber: string; // e.g. BTI/PROP/2026/0001
  tenderId: string;
  tenderNumber?: string;
  tenderTitle?: string;
  tenderCategory?: string;
  tenderEstimatedValue?: number;
  tenderClosingDate?: string;
  organizationId?: string;
  organizationName?: string;
  organizationGstin?: string;
  submittedBy?: string; // user UID
  submittedByName?: string;
  submittedByEmail?: string;
  status: ProposalStatus;
  technicalProposal?: TechnicalProposal;
  implementationPlan?: ImplementationPlan;
  financialProposal?: FinancialProposal;
  timeline?: TimelineProposal;
  experience?: ExperienceProposal;
  complianceDeclarations?: ComplianceDeclarations;
  supportingDocuments?: ProposalDocument[];
  createdAt?: string;
  updatedAt?: string;
  submittedAt?: string;

  // Review & Governance fields (Human review foundation)
  reviewStatus?: string;
  reviewerNotes?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;

  // Opportunity Context (from matching engine, clearly designated as Match, not AI Score)
  matchScore?: number;
  matchGrade?: string;

  // Compatibility fields for legacy views
  agencyId?: string;
  agencyName?: string;
  agencyGstin?: string;
  agencyGst?: string;
  agencyRating?: number;
  financialBidAmount?: number;
  quotedAmount?: number;
  submissionDate?: string;
  technicalScore?: number;
  aiEvaluationScore?: number;
  collusionRiskScore?: number;
  collusionRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'Low' | 'Medium' | 'High' | 'Critical';
  flags?: string[];
  documents?: Document[];
}

export function toCanonicalProposalStatus(status: ProposalStatus | string): CanonicalProposalStatus {
  const norm = (status || '').toUpperCase().replace(/\s+/g, '_');
  if (norm === 'UNDER_EVALUATION') return 'UNDER_REVIEW';
  if (norm === 'IN_EVALUATION') return 'UNDER_REVIEW';
  return (norm as CanonicalProposalStatus) || 'DRAFT';
}

export type ProposalAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'SUBMITTED'
  | 'WITHDRAWN'
  | 'UNDER_REVIEW'
  | 'SHORTLISTED'
  | 'REJECTED'
  | 'AWARDED'
  | 'AI_EVALUATION_REQUESTED'
  | 'AI_EVALUATION_COMPLETED'
  | 'AI_EVALUATION_FAILED';

export interface ProposalAuditEvent {
  eventId: string;
  proposalId: string;
  tenderId: string;
  organizationId: string;
  action: ProposalAuditAction;
  actorId: string;
  actorRole: 'agency' | 'government' | 'system';
  actorName?: string;
  actorEmail?: string;
  timestamp: string;
  previousStatus?: string;
  newStatus: CanonicalProposalStatus;
  notes?: string;
  metadata?: Record<string, unknown>;
}
