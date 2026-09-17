// Bharat Tender Intelligence (BTI) — Anomaly & Risk Intelligence Types
// Phase 7: MPLAD Anomaly & Risk Intelligence Foundation

export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AnomalyStatus = 'OPEN' | 'UNDER_REVIEW' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';

export type AnomalyType =
  | 'PHYSICAL_FINANCIAL_DIVERGENCE'
  | 'MILESTONE_DELAY'
  | 'REPEATED_MILESTONE_DELAYS'
  | 'MILESTONE_SCHEDULE_PRESSURE'
  | 'EXPENDITURE_ACCELERATION'
  | 'AWARDED_VALUE_OVERRUN'
  | 'LONG_REPORTING_GAP'
  | 'INSPECTION_PROGRESS_DIVERGENCE'
  | 'REPEATED_CORRECTIVE_ACTIONS'
  | 'CONFLICTING_RECORDS'
  | 'PROJECT_STAGNATION';

export interface AnomalyEvidenceReference {
  entityType: 'MILESTONE' | 'PROGRESS_UPDATE' | 'FINANCIAL_RECORD' | 'INSPECTION' | 'PROJECT';
  entityId: string;
  label: string;
  detail?: string;
  date?: string;
}

export interface AnomalySupportingMetrics {
  physicalProgressPercent?: number;
  financialUtilizationPercent?: number;
  divergencePercent?: number;
  daysDelayed?: number;
  delayedMilestoneCount?: number;
  daysRemaining?: number;
  remainingWorkPercent?: number;
  reportingGapDays?: number;
  awardedAmount?: number;
  verifiedExpenditure?: number;
  overrunAmount?: number;
  inspectedProgressPercent?: number;
  reportedProgressPercent?: number;
  correctiveActionsCount?: number;
  inactiveDays?: number;
  accelerationWindowDays?: number;
  acceleratedAmount?: number;
  acceleratedPercentage?: number;
  [key: string]: unknown;
}

export interface ProjectAnomaly {
  id: string;
  projectId: string;
  projectNumber?: string;
  projectTitle?: string;
  organizationId?: string;
  agencyName?: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  explanation: string;
  detectedAt: string;
  status: AnomalyStatus;
  evidence: AnomalyEvidenceReference[];
  metrics: AnomalySupportingMetrics;
  ruleVersion: string;
  ruleKey?: string;
  detectionSource: 'SYSTEM_RULE' | 'AI_ASSISTED';
  createdBy?: string;

  // Condition evaluation state (distinguishes currently active conditions from historical records)
  isConditionActive?: boolean;
  conditionEvaluatedAt?: string;

  // Government Investigation lifecycle fields
  acknowledgedBy?: string;
  acknowledgedByName?: string;
  acknowledgedAt?: string;
  acknowledgementNote?: string;

  underReviewBy?: string;
  underReviewByName?: string;
  underReviewAt?: string;

  resolvedAt?: string;
  resolvedBy?: string;
  resolvedByName?: string;
  resolutionNote?: string;

  dismissedAt?: string;
  dismissedBy?: string;
  dismissedByName?: string;
  dismissalReason?: string;
}

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface ProjectRiskScoreBreakdown {
  financialDivergenceScore: number; // 0-25
  progressDivergenceScore: number;  // 0-20
  milestoneDelaysScore: number;     // 0-20
  reportingGapsScore: number;       // 0-15
  inspectionInconsistenciesScore: number; // 0-10
  budgetAndAccelerationScore: number;     // 0-10
  totalRiskScore: number; // 0-100
  riskLevel: RiskLevel;
  methodology: string;
  calculatedAt: string;
}

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  PHYSICAL_FINANCIAL_DIVERGENCE: 'Financial vs Physical Divergence',
  MILESTONE_DELAY: 'Milestone Execution Delay',
  REPEATED_MILESTONE_DELAYS: 'Chronic / Repeated Milestone Delays',
  MILESTONE_SCHEDULE_PRESSURE: 'Milestone Schedule Pressure (Pre-Deadline)',
  EXPENDITURE_ACCELERATION: 'Unusual Expenditure Acceleration',
  AWARDED_VALUE_OVERRUN: 'Disbursal Exceeds Awarded Value',
  LONG_REPORTING_GAP: 'Extended Reporting Inactivity Gap',
  INSPECTION_PROGRESS_DIVERGENCE: 'Inspection vs Agency Progress Divergence',
  REPEATED_CORRECTIVE_ACTIONS: 'Unresolved Corrective Actions',
  CONFLICTING_RECORDS: 'Conflicting Record Discrepancy',
  PROJECT_STAGNATION: 'Prolonged Project Stagnation',
};

export interface PriorityFinding {
  title: string;
  explanation: string;
  severity: AnomalySeverity;
  reviewRecommendation: string;
  supportingIndicator?: string;
}

export interface RiskIntelligenceResult {
  assessmentId: string;
  projectId: string;
  riskLevel: RiskLevel;
  overallRiskLevel: RiskLevel; // Backward-compatible alias
  riskScore: number;
  summary: string;
  priorityFindings: PriorityFinding[];
  contributingIndicators: string[];
  recommendedReviewAreas: string[];
  limitations: string;
  provider: string;
  model: string;
  version: string;
  timestamp: string;
  confidenceScore?: number;
  aiAnalysisSummary?: string;
  recommendedActionItems?: string[];
  disclaimer?: string;
}

export interface ProjectRiskAssessment {
  id: string;
  projectId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  scoreBreakdown: ProjectRiskScoreBreakdown;
  activeAnomalyCount: number;
  historicalAnomalyCount?: number;
  resolvedAnomalyCount: number;
  dismissedAnomalyCount: number;
  deterministicIndicators: string[];
  aiAssessment?: RiskIntelligenceResult;
  lastAnalysisAt: string;
  updatedAt: string;
}

/**
 * Authoritative lifecycle status transition matrix for Project Anomaly investigations.
 * Governs both client UI options and backend/service validation.
 * - OPEN cannot jump directly to RESOLVED without intermediate review/acknowledgement.
 * - Backward transitions to OPEN are strictly forbidden.
 * - Terminal states (RESOLVED, DISMISSED) cannot transition back into active states.
 */
export const VALID_ANOMALY_STATUS_TRANSITIONS: Record<AnomalyStatus, AnomalyStatus[]> = {
  OPEN: ['ACKNOWLEDGED', 'UNDER_REVIEW', 'DISMISSED'],
  ACKNOWLEDGED: ['UNDER_REVIEW', 'RESOLVED', 'DISMISSED'],
  UNDER_REVIEW: ['ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'],
  RESOLVED: [],
  DISMISSED: [],
};

export function isValidAnomalyTransition(currentStatus: AnomalyStatus, targetStatus: AnomalyStatus): boolean {
  if (currentStatus === targetStatus) return false;
  const allowed = VALID_ANOMALY_STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
}

export const SEVERITY_COLORS: Record<AnomalySeverity, string> = {
  LOW: 'bg-blue-50 text-blue-700 border-blue-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
  HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
  CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const STATUS_COLORS: Record<AnomalyStatus, string> = {
  OPEN: 'bg-rose-50 text-rose-700 border-rose-200',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  ACKNOWLEDGED: 'bg-purple-50 text-purple-700 border-purple-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DISMISSED: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MODERATE: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
  CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200',
};
