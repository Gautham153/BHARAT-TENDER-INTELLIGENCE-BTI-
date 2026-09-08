// Bharat Tender Intelligence (BTI) — Server Evaluation Coordinator
// Phase 5: Provider-Based Proposal Evaluation Service Architecture with Authoritative Backend Data Boundary

import { EvaluationProvider, EvaluationContext } from './types.ts';
import { GeminiEvaluationProvider } from './GeminiEvaluationProvider.ts';
import { EvaluationResult } from '../../src/types/evaluation.ts';
import { Proposal, ProposalAuditEvent, toCanonicalProposalStatus, CanonicalProposalStatus } from '../../src/types/proposal.ts';
import { Tender, TenderMatchResult } from '../../src/types/tender.ts';
import { Organization } from '../../src/types/organization.ts';
import { verifyServerAuth } from './serverAuth.ts';
import {
  getAuthoritativeProposal,
  getAuthoritativeTender,
  getAuthoritativeOrganization,
  saveAuthoritativeEvaluation,
  saveAuthoritativeAuditEvent,
} from './authoritativeDataService.ts';
import { TenderMatchingService } from '../../src/services/matching/tenderMatchingService.ts';

export class ProposalEvaluationServerService {
  private provider: EvaluationProvider;

  constructor(provider?: EvaluationProvider) {
    this.provider = provider || new GeminiEvaluationProvider();
  }

  /**
   * Evaluates a proposal against its tender and organization specifications.
   * Performs authoritative authentication, backend data retrieval, integrity verification,
   * deterministic matching, and financial audits before invoking the AI provider.
   * Records authoritative AI audit events (REQUESTED, FAILED, COMPLETED) and persists
   * the authoritative evaluation record to Firestore server-side.
   */
  async evaluateProposal(params: {
    proposalId: string;
    tenderId: string;
    organizationId: string;
    authHeader?: string;
    token?: string;
    evaluationVersion?: string;
    // Any client-supplied objects/userRole/deterministicMatch are strictly ignored for security
    deterministicMatch?: unknown;
    userRole?: unknown;
    proposal?: unknown;
    tender?: unknown;
    organization?: unknown;
  }): Promise<EvaluationResult> {
    const {
      proposalId,
      tenderId,
      organizationId,
      authHeader,
      token,
      evaluationVersion = '1.0',
    } = params;

    // 1. Authoritative Server-Side Token Authentication & RBAC Check
    // Extracts caller identity from Firebase ID token or verified demo token.
    // Client-provided 'userRole' from request body is strictly ignored.
    const authHeaderToVerify = authHeader || (token ? `Bearer ${token}` : undefined);
    const authenticatedUser = await verifyServerAuth(authHeaderToVerify);

    const userRole = authenticatedUser.role;
    if (userRole !== 'government' && userRole !== 'government_admin' && userRole !== 'government_officer') {
      const err: any = new Error(
        `Access Denied: AI Proposal Intelligence is restricted strictly to authorized government reviewers. Authenticated role: '${userRole}'.`
      );
      err.statusCode = 403;
      throw err;
    }

    // 2. Authoritative Parameter Validation
    if (!proposalId || !tenderId || !organizationId) {
      const err: any = new Error(
        'Invalid Evaluation Request: Missing required proposalId, tenderId, or organizationId identifiers.'
      );
      err.statusCode = 400;
      throw err;
    }

    // 3. Fetch Authoritative Backend Data (Never trust client-supplied proposal/tender/organization objects)
    const rawToken = authHeaderToVerify?.replace(/^Bearer\s+/i, '').trim();
    const authoritativeProposal: Proposal = await getAuthoritativeProposal(proposalId, rawToken);
    const authoritativeTender: Tender = await getAuthoritativeTender(tenderId, rawToken);
    const authoritativeOrganization: Organization = await getAuthoritativeOrganization(
      organizationId,
      authoritativeProposal,
      rawToken
    );

    // 4. Authoritative Data Integrity Validation
    if (authoritativeProposal.id !== proposalId) {
      const err: any = new Error(
        `Data Integrity Violation: Authoritative Proposal ID mismatch ('${authoritativeProposal.id}' vs '${proposalId}').`
      );
      err.statusCode = 400;
      throw err;
    }

    if (authoritativeProposal.tenderId !== tenderId || authoritativeTender.id !== tenderId) {
      const err: any = new Error(
        `Data Integrity Violation: Tender ID mismatch between authoritative proposal ('${authoritativeProposal.tenderId}') and tender ('${tenderId}').`
      );
      err.statusCode = 400;
      throw err;
    }

    const propOrgId = authoritativeProposal.organizationId || authoritativeProposal.agencyId;
    const orgId = authoritativeOrganization.organizationId || (authoritativeOrganization as any).id;

    if (propOrgId !== organizationId || orgId !== organizationId) {
      const err: any = new Error(
        `Data Integrity Violation: Organization ID mismatch between authoritative proposal ('${propOrgId}'), organization ('${orgId}'), and requested organization ('${organizationId}').`
      );
      err.statusCode = 400;
      throw err;
    }

    // Proposals must be in a sealed status eligible for Government evaluation
    const canonicalStatus: CanonicalProposalStatus = toCanonicalProposalStatus(authoritativeProposal.status);
    const ALLOWED_EVALUATION_STATUSES: readonly CanonicalProposalStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED'];

    if (!ALLOWED_EVALUATION_STATUSES.includes(canonicalStatus)) {
      const err: any = new Error(
        `Evaluation Rejected: Proposal status ${canonicalStatus} is not eligible for AI evaluation.`
      );
      err.statusCode = 400;
      throw err;
    }

    // 5. Server-Authoritative Deterministic Match Recomputation
    // Client-supplied deterministicMatch is strictly ignored to eliminate client fabrication risks.
    const authoritativeDeterministicMatch: TenderMatchResult = TenderMatchingService.calculateMatch(
      authoritativeTender,
      authoritativeOrganization
    );

    // 6. Deterministic Financial Arithmetic Audit on Authoritative Data
    const baseAmount = authoritativeProposal.financialProposal?.baseAmount ?? authoritativeProposal.financialBidAmount ?? 0;
    const taxAmount = authoritativeProposal.financialProposal?.taxAmount ?? 0;
    const totalProposedAmount =
      authoritativeProposal.financialProposal?.totalProposedAmount ??
      authoritativeProposal.quotedAmount ??
      (baseAmount + taxAmount);
    const expectedTaxAt18Pct = Math.round(baseAmount * 0.18);
    const arithmeticSum = baseAmount + taxAmount;
    const arithmeticConsistent = Math.abs(totalProposedAmount - arithmeticSum) <= 2; // Allow ₹2 rounding margin

    let deviationFromEstimatePct: number | undefined = undefined;
    if (authoritativeTender.estimatedValue && authoritativeTender.estimatedValue > 0 && totalProposedAmount > 0) {
      deviationFromEstimatePct =
        ((totalProposedAmount - authoritativeTender.estimatedValue) / authoritativeTender.estimatedValue) * 100;
    }

    const effectiveOrgId = authoritativeOrganization.organizationId || organizationId;
    const nowIso = new Date().toISOString();

    // 7. Record Audit Event: AI_EVALUATION_REQUESTED (recorded before Gemini runs)
    const reqEventId = `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const requestAuditEvent: ProposalAuditEvent = {
      eventId: reqEventId,
      proposalId: authoritativeProposal.id,
      tenderId: authoritativeTender.id,
      organizationId: effectiveOrgId,
      action: 'AI_EVALUATION_REQUESTED',
      actorId: authenticatedUser.uid,
      actorRole: 'government',
      actorName: authenticatedUser.name || 'Government Evaluation Committee',
      actorEmail: authenticatedUser.email || '',
      timestamp: nowIso,
      previousStatus: canonicalStatus,
      newStatus: canonicalStatus,
      notes: `AI Proposal Intelligence evaluation requested (version ${evaluationVersion}).`,
      metadata: {
        evaluationVersion,
      },
    };

    await saveAuthoritativeAuditEvent(requestAuditEvent);

    // 8. Construct Authoritative Context & Invoke Provider
    let providerResult;
    try {
      const context: EvaluationContext = {
        proposalId,
        tenderId,
        organizationId,
        proposal: authoritativeProposal,
        tender: authoritativeTender,
        organization: authoritativeOrganization,
        deterministicMatch: authoritativeDeterministicMatch,
        documentAvailabilityNotes: [
          'Document content was not available for AI analysis. Uploaded files must be reviewed manually by the evaluation committee.',
        ],
        deterministicFinancialAudit: {
          baseAmount,
          taxAmount,
          totalProposedAmount,
          tenderEstimatedValue: authoritativeTender.estimatedValue,
          expectedTaxAt18Pct,
          arithmeticConsistent,
          deviationFromEstimatePct,
        },
      };

      providerResult = await this.provider.evaluate(context);
    } catch (evalErr: unknown) {
      // Record Failure Audit Event: AI_EVALUATION_FAILED when evaluation fails
      const failEventId = `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const failureAuditEvent: ProposalAuditEvent = {
        eventId: failEventId,
        proposalId: authoritativeProposal.id,
        tenderId: authoritativeTender.id,
        organizationId: effectiveOrgId,
        action: 'AI_EVALUATION_FAILED',
        actorId: authenticatedUser.uid,
        actorRole: 'government',
        actorName: authenticatedUser.name || 'Government Evaluation Committee',
        actorEmail: authenticatedUser.email || '',
        timestamp: new Date().toISOString(),
        previousStatus: canonicalStatus,
        newStatus: canonicalStatus,
        notes: `AI Proposal Intelligence evaluation failed: ${evalErr instanceof Error ? evalErr.message : 'Unknown failure'}.`,
        metadata: {
          evaluationVersion,
          error: evalErr instanceof Error ? evalErr.message : 'Evaluation failure',
        },
      };

      try {
        await saveAuthoritativeAuditEvent(failureAuditEvent);
      } catch (auditErr) {
        console.error('[ProposalEvaluationServerService] Failed to record AI_EVALUATION_FAILED audit event:', auditErr);
      }

      throw evalErr;
    }

    // 9. Assemble Full Evaluation Record
    const evaluationId = `eval-${proposalId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const evalTimestamp = new Date().toISOString();

    const result: EvaluationResult = {
      id: evaluationId,
      proposalId,
      tenderId,
      organizationId,
      overallScore: providerResult.overallScore,
      dimensions: providerResult.dimensions,
      strengths: providerResult.strengths,
      concerns: providerResult.concerns,
      riskIndicators: providerResult.riskIndicators,
      explanation: providerResult.explanation,
      limitations: providerResult.limitations,
      modelProvider: providerResult.modelProvider || this.provider.name,
      modelVersion: providerResult.modelVersion || this.provider.version,
      evaluatedAt: evalTimestamp,
      evaluatedBy: 'AI',
      evaluationVersion,
    };

    // 10. Persist Evaluation Authoritatively to Firestore
    // Ensures write authority remains strictly server-side and immutable.
    try {
      await saveAuthoritativeEvaluation(result);
    } catch (saveErr: unknown) {
      // Record Failure Audit Event: AI_EVALUATION_FAILED if save fails
      const failEventId = `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const failureAuditEvent: ProposalAuditEvent = {
        eventId: failEventId,
        proposalId: authoritativeProposal.id,
        tenderId: authoritativeTender.id,
        organizationId: effectiveOrgId,
        action: 'AI_EVALUATION_FAILED',
        actorId: authenticatedUser.uid,
        actorRole: 'government',
        actorName: authenticatedUser.name || 'Government Evaluation Committee',
        actorEmail: authenticatedUser.email || '',
        timestamp: new Date().toISOString(),
        previousStatus: canonicalStatus,
        newStatus: canonicalStatus,
        notes: `AI Proposal Intelligence evaluation persistence failed: ${saveErr instanceof Error ? saveErr.message : 'Unknown failure'}.`,
        metadata: {
          evaluationVersion,
          error: saveErr instanceof Error ? saveErr.message : 'Persistence failure',
        },
      };

      try {
        await saveAuthoritativeAuditEvent(failureAuditEvent);
      } catch (auditErr) {
        console.error('[ProposalEvaluationServerService] Failed to record AI_EVALUATION_FAILED audit event:', auditErr);
      }

      throw saveErr;
    }

    // 11. Record Completion Audit Event: AI_EVALUATION_COMPLETED (only recorded after evaluation persistence succeeds)
    const compEventId = `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const completedAuditEvent: ProposalAuditEvent = {
      eventId: compEventId,
      proposalId: authoritativeProposal.id,
      tenderId: authoritativeTender.id,
      organizationId: effectiveOrgId,
      action: 'AI_EVALUATION_COMPLETED',
      actorId: authenticatedUser.uid,
      actorRole: 'government',
      actorName: authenticatedUser.name || 'Government Evaluation Committee',
      actorEmail: authenticatedUser.email || '',
      timestamp: new Date().toISOString(),
      previousStatus: canonicalStatus,
      newStatus: canonicalStatus,
      notes: `AI Proposal Intelligence completed. Overall Synthesis Score: ${result.overallScore}/100.`,
      metadata: {
        evaluationId: result.id,
        evaluationVersion: result.evaluationVersion,
        overallScore: result.overallScore,
        modelProvider: result.modelProvider,
        modelVersion: result.modelVersion,
        riskIndicatorsCount: result.riskIndicators?.length || 0,
      },
    };

    await saveAuthoritativeAuditEvent(completedAuditEvent);

    return result;
  }
}
