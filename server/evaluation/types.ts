// Bharat Tender Intelligence (BTI) — Server-Side Evaluation Architecture
// Phase 5: Provider Abstraction & Types

import { EvaluationResult, RiskIndicator, DimensionEvaluation } from '../../src/types/evaluation.js';
import { Proposal } from '../../src/types/proposal.js';
import { Tender, TenderMatchResult } from '../../src/types/tender.js';
import { Organization } from '../../src/types/organization.js';

export interface EvaluationContext {
  proposalId: string;
  tenderId: string;
  organizationId: string;
  proposal: Proposal;
  tender: Tender;
  organization: Organization;
  deterministicMatch?: TenderMatchResult;
  documentAvailabilityNotes?: string[];
  deterministicFinancialAudit?: {
    baseAmount: number;
    taxAmount: number;
    totalProposedAmount: number;
    tenderEstimatedValue?: number;
    expectedTaxAt18Pct: number;
    arithmeticConsistent: boolean;
    deviationFromEstimatePct?: number;
  };
}

export interface EvaluationProvider {
  name: string;
  version: string;
  evaluate(context: EvaluationContext): Promise<Omit<EvaluationResult, 'id' | 'proposalId' | 'tenderId' | 'organizationId' | 'evaluatedAt'>>;
}
