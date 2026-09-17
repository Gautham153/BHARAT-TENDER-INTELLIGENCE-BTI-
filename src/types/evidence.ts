// Bharat Tender Intelligence (BTI) — Evidence Chain & Investigation Intelligence Types
// Phase 8: Authoritative Evidence Graph, Stable Finding Identity & Investigation Workstation

import { AnomalyType, AnomalySeverity, AnomalyStatus } from './anomaly.js';
import { ProjectAuditEvent } from './project.js';

export type EvidenceSourceType =
  | 'PROJECT'
  | 'MILESTONE'
  | 'PROGRESS_UPDATE'
  | 'FINANCIAL_RECORD'
  | 'INSPECTION'
  | 'EXCEPTION'
  | 'AUDIT_EVENT'
  | 'ANOMALY'
  | 'RISK_ASSESSMENT'
  | 'PROPOSAL'
  | 'TENDER'
  | 'ORGANIZATION';

export type EvidenceClassification = 'DIRECT' | 'CALCULATED' | 'RELATED' | 'MISSING';

export interface EvidenceReference {
  evidenceId: string;
  sourceType: EvidenceSourceType;
  sourceId: string;
  projectId: string;
  timestamp?: string;
  title: string;
  description: string;
  relevance: string;
  classification: EvidenceClassification;
  metrics?: Record<string, unknown>;
  recordSnippet?: Record<string, unknown>;
}

export interface WhyFlaggedBreakdown {
  ruleName: string;
  ruleKey?: string;
  description: string;
  inputs: Array<{
    label: string;
    value: string | number;
    source: string;
  }>;
  calculation: string;
  threshold: string;
  result: string;
}

export interface ProjectTimelineEvent {
  eventId: string;
  date: string;
  eventType:
    | 'PROJECT_CREATED'
    | 'MILESTONE_PLANNED'
    | 'PROGRESS_UPDATE'
    | 'FINANCIAL_VERIFIED'
    | 'INSPECTION_CONDUCTED'
    | 'ANOMALY_DETECTED'
    | 'INVESTIGATION_ACTION';
  title: string;
  description: string;
  sourceType: EvidenceSourceType;
  sourceId: string;
  badgeText: string;
  badgeColor: string;
  isDirectlySupportingFinding?: boolean;
}

export interface RelatedFinding {
  findingId: string;
  occurrenceId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  title: string;
  isConditionActive?: boolean;
}

export interface InvestigationNote {
  noteId: string;
  findingId: string;
  occurrenceId?: string;
  projectId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  timestamp: string;
  note: string;
  actionReference?: string;
}

export interface InvestigationAdvisory {
  summary: string;
  evidenceSummary: string;
  relatedSignals: string[];
  recommendedReviewAreas: string[];
  missingEvidence: string[];
  limitations: string;
  provider: string;
  model: string;
  version: string;
  timestamp: string;
}

export interface EvidenceChain {
  findingId: string;
  occurrenceId: string;
  projectId: string;
  projectTitle?: string;
  projectNumber?: string;
  agencyName?: string;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  title: string;
  detectedAt: string;
  isConditionActive?: boolean;
  whyFlagged: WhyFlaggedBreakdown;
  evidenceItems: EvidenceReference[];
  timeline: ProjectTimelineEvent[];
  relatedFindings: RelatedFinding[];
  investigationNotes: InvestigationNote[];
  auditEvents: ProjectAuditEvent[];
  aiAdvisory?: InvestigationAdvisory;
}

/**
 * Deterministically derives the stable logical finding ID.
 * The SAME logical finding for the same project and rule maps to the EXACT SAME finding_id across rescans and occurrences.
 */
export function getStableFindingId(anomaly: {
  type: AnomalyType;
  projectId: string;
  id?: string;
  ruleKey?: string;
  metrics?: Record<string, unknown>;
  evidence?: Array<{ entityType?: string; entityId?: string }>;
}): string {
  const typeSlugs: Record<AnomalyType, string> = {
    PHYSICAL_FINANCIAL_DIVERGENCE: 'physical-financial-divergence',
    MILESTONE_DELAY: 'milestone-delay',
    REPEATED_MILESTONE_DELAYS: 'repeated-milestone-delays',
    MILESTONE_SCHEDULE_PRESSURE: 'milestone-schedule-pressure',
    EXPENDITURE_ACCELERATION: 'expenditure-acceleration',
    AWARDED_VALUE_OVERRUN: 'awarded-value-overrun',
    LONG_REPORTING_GAP: 'long-reporting-gap',
    INSPECTION_PROGRESS_DIVERGENCE: 'inspection-progress-divergence',
    REPEATED_CORRECTIVE_ACTIONS: 'repeated-corrective-actions',
    CONFLICTING_RECORDS: 'conflicting-records',
    PROJECT_STAGNATION: 'project-stagnation',
  };

  const slug = typeSlugs[anomaly.type] || anomaly.type.toLowerCase().replace(/_/g, '-');
  const entityId =
    (anomaly.metrics?.milestoneId as string) ||
    (anomaly.metrics?.targetMilestoneId as string) ||
    (anomaly.evidence?.find((e) => e.entityType === 'MILESTONE')?.entityId) ||
    '';

  if (
    (anomaly.type === 'MILESTONE_DELAY' || anomaly.type === 'MILESTONE_SCHEDULE_PRESSURE') &&
    entityId
  ) {
    return `risk-intelligence|${slug}|${anomaly.projectId}|${entityId}`;
  }

  return `risk-intelligence|${slug}|${anomaly.projectId}`;
}
