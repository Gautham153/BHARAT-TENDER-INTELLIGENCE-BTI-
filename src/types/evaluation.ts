// Bharat Tender Intelligence (BTI) — AI Proposal Intelligence Types
// Phase 5: Explainable AI Evaluation, Risk Indicators, and Governance Boundaries

export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskIndicator {
  category: string;
  severity: RiskSeverity;
  title: string;
  explanation: string;
  evidence?: string;
}

export interface DimensionEvaluation {
  score: number; // 0–100 integer
  summary: string;
  strengths: string[];
  concerns: string[];
}

export interface EvaluationDimensions {
  technicalAlignment: DimensionEvaluation;
  implementationFeasibility: DimensionEvaluation;
  financialReasonableness: DimensionEvaluation;
  experienceCapability: DimensionEvaluation;
  compliance: DimensionEvaluation;
}

export interface EvaluationResult {
  id: string;
  proposalId: string;
  tenderId: string;
  organizationId: string;

  overallScore: number; // 0–100 integer

  dimensions: EvaluationDimensions;

  strengths: string[];
  concerns: string[];
  riskIndicators: RiskIndicator[];
  explanation: string;
  limitations: string[];

  modelProvider: string;
  modelVersion?: string;
  evaluatedAt: string; // ISO 8601 string
  evaluatedBy: 'AI';
  evaluationVersion: string; // e.g. "1.0", "2.0"
}

export type EvaluationStatusState = 'NOT_EVALUATED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface EvaluationRequestPayload {
  proposalId: string;
  tenderId: string;
  organizationId: string;
  userRole: string;
  evaluationVersion?: string;
}
