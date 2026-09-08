// Bharat Tender Intelligence (BTI) — AI Proposal Intelligence Component
// Phase 5: Explainable Gemini Evaluation, Dimensional Breakdown, Risk Indicators & Governance Boundary

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCw,
  Cpu,
  Layers,
  DollarSign,
  Briefcase,
  ShieldCheck,
  FileSearch,
  ExternalLink,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Proposal } from '../../types/proposal';
import { Tender, TenderMatchResult } from '../../types/tender';
import { Organization } from '../../types/organization';
import { AuthUser } from '../../types/auth';
import { EvaluationResult, DimensionEvaluation, RiskIndicator } from '../../types/evaluation';
import { ProposalEvaluationService } from '../../services/ai/proposalEvaluationService';
import { TenderMatchingService } from '../../services/matching/tenderMatchingService';
import { fetchOrganizationById } from '../../services/firebase/organizations';
import { TenderService } from '../../services/firebase/tenders';
import { Button } from '../ui/Button';

interface AiProposalIntelligenceProps {
  proposal: Proposal;
  tender?: Tender | null;
  organization?: Organization | null;
  deterministicMatch?: TenderMatchResult | null;
  currentUser: AuthUser;
  onEvaluationCompleted?: (evaluation: EvaluationResult) => void;
}

export const AiProposalIntelligence: React.FC<AiProposalIntelligenceProps> = ({
  proposal,
  tender,
  organization,
  deterministicMatch: propDeterministicMatch,
  currentUser,
  onEvaluationCompleted,
}) => {
  const [evaluations, setEvaluations] = useState<EvaluationResult[]>([]);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);

  // Authoritative organization state when not passed as prop
  const [loadedOrg, setLoadedOrg] = useState<Organization | null>(organization || null);
  const [, setLoadingOrg] = useState<boolean>(false);

  // Authoritative tender state when not passed as prop
  const [loadedTender, setLoadedTender] = useState<Tender | null>(tender || null);
  const [, setLoadingTender] = useState<boolean>(false);

  // Fetch authoritative organization if not provided via props
  useEffect(() => {
    if (organization) {
      setLoadedOrg(organization);
      return;
    }

    const orgId = proposal.organizationId || proposal.agencyId;
    if (!orgId) {
      setLoadedOrg(null);
      return;
    }

    let cancelled = false;
    setLoadingOrg(true);

    fetchOrganizationById(orgId)
      .then((org) => {
        if (!cancelled) {
          setLoadedOrg(org);
        }
      })
      .catch((err) => {
        console.warn('[AiProposalIntelligence] Failed to load authoritative organization:', err);
        if (!cancelled) {
          setLoadedOrg(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingOrg(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [organization, proposal.organizationId, proposal.agencyId]);

  // Fetch authoritative tender if not provided via props
  useEffect(() => {
    if (tender) {
      setLoadedTender(tender);
      return;
    }

    const tenderId = proposal.tenderId;
    if (!tenderId) {
      setLoadedTender(null);
      return;
    }

    let cancelled = false;
    setLoadingTender(true);

    TenderService.getTenderById(tenderId, currentUser.role || 'government')
      .then((t) => {
        if (!cancelled) {
          setLoadedTender(t);
        }
      })
      .catch((err) => {
        console.warn('[AiProposalIntelligence] Failed to load authoritative tender:', err);
        if (!cancelled) {
          setLoadedTender(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingTender(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tender, proposal.tenderId, currentUser.role]);

  // Compute deterministic match using authoritative tender and authoritative organization only
  const deterministicMatch = React.useMemo(() => {
    const effectiveTender = tender || loadedTender;
    const effectiveOrg = organization || loadedOrg;
    if (effectiveTender && effectiveOrg) {
      try {
        return TenderMatchingService.calculateMatch(effectiveTender, effectiveOrg);
      } catch {
        return null;
      }
    }
    return null;
  }, [tender, loadedTender, organization, loadedOrg]);

  // Load existing evaluation history
  const loadEvaluations = useCallback(async () => {
    if (!proposal.id) return;
    setLoadingHistory(true);
    try {
      const history = await ProposalEvaluationService.getEvaluationsForProposal(proposal.id);
      setEvaluations(history);
      if (history.length > 0 && !selectedEvaluationId) {
        setSelectedEvaluationId(history[0].id);
      }
    } catch (err) {
      console.warn('[AiProposalIntelligence] Failed to load evaluation history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [proposal.id, selectedEvaluationId]);

  useEffect(() => {
    loadEvaluations();
  }, [loadEvaluations]);

  const activeEvaluation: EvaluationResult | null = React.useMemo(() => {
    if (!evaluations || evaluations.length === 0) return null;
    if (selectedEvaluationId) {
      const found = evaluations.find((e) => e.id === selectedEvaluationId);
      if (found) return found;
    }
    return evaluations[0];
  }, [evaluations, selectedEvaluationId]);

  // Trigger evaluation
  const handleRunEvaluation = async () => {
    if (isEvaluating) return;
    setIsEvaluating(true);
    setEvalError(null);

    try {
      // 1. Resolve authoritative Organization strictly from props or authoritative Firestore
      let targetOrg = organization || loadedOrg;
      const targetOrgId = proposal.organizationId || proposal.agencyId;

      if (!targetOrg && targetOrgId) {
        try {
          targetOrg = await fetchOrganizationById(targetOrgId);
          if (targetOrg) {
            setLoadedOrg(targetOrg);
          }
        } catch (fetchErr) {
          console.warn('[AiProposalIntelligence] Direct organization fetch failed:', fetchErr);
        }
      }

      // If authoritative organization could not be loaded, strictly abort evaluation without synthetic fallback
      if (!targetOrg) {
        throw new Error(
          `Authoritative organization data could not be loaded for organization ID '${
            targetOrgId || 'unspecified'
          }'. Live AI evaluation cannot proceed without verified organization data.`
        );
      }

      // 2. Resolve authoritative Tender strictly from props or authoritative Firestore
      let targetTender = tender || loadedTender;
      const targetTenderId = proposal.tenderId;

      if (!targetTender && targetTenderId) {
        try {
          targetTender = await TenderService.getTenderById(targetTenderId, currentUser.role || 'government');
          if (targetTender) {
            setLoadedTender(targetTender);
          }
        } catch (fetchErr) {
          console.warn('[AiProposalIntelligence] Direct tender fetch failed:', fetchErr);
        }
      }

      // If authoritative tender could not be loaded, strictly abort evaluation without synthetic fallback
      if (!targetTender) {
        throw new Error(
          'Authoritative tender data could not be loaded. AI evaluation cannot proceed without verified tender data.'
        );
      }

      // 3. Compute deterministic match with authoritative tender and organization
      const matchResult =
        targetTender && targetOrg ? TenderMatchingService.calculateMatch(targetTender, targetOrg) : undefined;

      // Calculate next version
      const nextVersionNumber = evaluations.length + 1;
      const versionStr = `${nextVersionNumber}.0`;

      const result = await ProposalEvaluationService.evaluateProposal({
        proposal,
        tender: targetTender,
        organization: targetOrg,
        deterministicMatch: matchResult || undefined,
        user: currentUser,
        evaluationVersion: versionStr,
      });

      // Update state
      setEvaluations((prev) => [result, ...prev]);
      setSelectedEvaluationId(result.id);
      if (onEvaluationCompleted) {
        onEvaluationCompleted(result);
      }
    } catch (err: unknown) {
      console.error('[AiProposalIntelligence] Evaluation failed:', err);
      setEvalError(err instanceof Error ? err.message : 'AI proposal evaluation could not be completed.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 60) return 'text-blue-700 bg-blue-50 border-blue-200';
    if (score >= 40) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  const getScoreProgressBar = (score: number) => {
    if (score >= 80) return 'bg-emerald-600';
    if (score >= 60) return 'bg-blue-600';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-rose-600';
  };

  const getSeverityBadge = (severity: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (severity) {
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            High Severity
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            Medium Severity
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium uppercase bg-slate-100 text-slate-700 border border-slate-200">
            <Info className="w-3 h-3 text-slate-500" />
            Low Severity
          </span>
        );
    }
  };

  const toggleDimension = (dimKey: string) => {
    setExpandedDimension(expandedDimension === dimKey ? null : dimKey);
  };

  return (
    <div className="space-y-4 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#002B49]" />
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              AI Proposal Intelligence & Explainable Evaluation
            </h4>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
              GFR Advisory Model
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Evidence-grounded decision support for authorized government review committees.
          </p>
        </div>

        {/* Action / Version Controls */}
        <div className="flex items-center gap-2">
          {evaluations.length > 1 && (
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-slate-400 font-medium">Version:</span>
              <select
                value={activeEvaluation?.id || ''}
                onChange={(e) => setSelectedEvaluationId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#002B49]"
              >
                {evaluations.map((ev, idx) => (
                  <option key={ev.id} value={ev.id}>
                    v{ev.evaluationVersion || `${evaluations.length - idx}.0`} {idx === 0 ? '(Latest)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeEvaluation ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunEvaluation}
              disabled={isEvaluating}
              icon={isEvaluating ? RotateCw : Sparkles}
              className="text-xs px-2.5 py-1 text-[#002B49] border-slate-300 hover:bg-slate-50"
            >
              {isEvaluating ? 'Evaluating...' : 'Run New Evaluation'}
            </Button>
          ) : (
            <Button
              variant="gov"
              size="sm"
              onClick={handleRunEvaluation}
              disabled={isEvaluating}
              icon={isEvaluating ? RotateCw : Sparkles}
              className="text-xs px-3 py-1 bg-[#002B49] hover:bg-[#001D33] text-white"
            >
              {isEvaluating ? 'Evaluating Proposal...' : 'Run AI Evaluation'}
            </Button>
          )}
        </div>
      </div>

      {/* 2. Loading State */}
      {isEvaluating && (
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-slate-800 font-medium text-xs">
            <RotateCw className="w-4 h-4 text-[#002B49] animate-spin" />
            <span>Evaluating proposal against tender specifications across 5 analytical dimensions...</span>
          </div>
          <p className="text-[11px] text-slate-500 max-w-lg mx-auto">
            Auditing financial arithmetic, checking technical alignment, synthesizing risk indicators, and formulating explainable evaluation findings.
          </p>
        </div>
      )}

      {/* 3. Error / Failure State */}
      {evalError && !isEvaluating && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <strong className="font-bold block">AI evaluation could not be completed:</strong>
              <p className="mt-0.5 text-rose-800">{evalError}</p>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunEvaluation}
              className="text-xs px-3 py-1 bg-white border-rose-300 text-rose-800 hover:bg-rose-100"
            >
              Retry AI Evaluation
            </Button>
          </div>
        </div>
      )}

      {/* 4. Empty State (Not Evaluated Yet) */}
      {!activeEvaluation && !isEvaluating && !evalError && (
        <div className="p-6 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 mx-auto flex items-center justify-center">
            <Cpu className="w-4 h-4" />
          </div>
          <h5 className="font-bold text-slate-800 text-xs">Proposal Not Evaluated</h5>
          <p className="text-[11px] text-slate-500 max-w-md mx-auto">
            This proposal has not been analyzed by the AI Intelligence engine yet. Authorized officers can trigger an explainable evaluation across Technical, Feasibility, Financial, Experience, and Compliance dimensions.
          </p>
          <div className="pt-2">
            <Button
              variant="gov"
              size="sm"
              onClick={handleRunEvaluation}
              icon={Sparkles}
              className="text-xs px-3 py-1.5 bg-[#002B49] text-white"
            >
              Run AI Evaluation
            </Button>
          </div>
        </div>
      )}

      {/* 5. Completed Evaluation View */}
      {activeEvaluation && !isEvaluating && (
        <div className="space-y-4 pt-1">
          {/* Top Row: Overall Score & Match Context */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Overall AI Score Card */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  AI Proposal Intelligence Score
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-slate-900 font-mono">
                    {activeEvaluation.overallScore}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">/ 100</span>
                  <span
                    className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getScoreColor(
                      activeEvaluation.overallScore
                    )}`}
                  >
                    {activeEvaluation.overallScore >= 80
                      ? 'Strong Alignment'
                      : activeEvaluation.overallScore >= 60
                      ? 'Moderate Alignment'
                      : 'Review Scrutiny Needed'}
                  </span>
                </div>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-3">
                <div
                  className={`h-full rounded-full ${getScoreProgressBar(activeEvaluation.overallScore)}`}
                  style={{ width: `${activeEvaluation.overallScore}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-2 block">
                Weighted synthesis across all 5 analytical dimensions.
              </span>
            </div>

            {/* Deterministic Tender Match Context (Phase 3B) */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-medium">
                    Agency Tender Match Context
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 uppercase">
                    Phase 3B Rule Engine
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-slate-900 font-mono">
                    {deterministicMatch ? deterministicMatch.score : '—'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">/ 100</span>
                  {deterministicMatch && (
                    <span className="ml-auto px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-800 border border-blue-200">
                      {deterministicMatch.tier} Match
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-slate-500 mt-2 block leading-tight">
                <strong>Deterministic eligibility context:</strong> Computed from sector, geography, operational capacity, and turnover ratios. <em>NOT an AI score.</em>
              </span>
            </div>

            {/* Evaluation Model & Audit Metadata */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between text-[11px] text-slate-600 space-y-1">
              <span className="text-[11px] text-slate-500 font-medium block border-b border-slate-200 pb-1">
                Model & Audit Traceability
              </span>
              <div className="flex justify-between">
                <span className="text-slate-400">Provider:</span>
                <span className="font-medium text-slate-800">{activeEvaluation.modelProvider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Model:</span>
                <span className="font-mono text-slate-800">{activeEvaluation.modelVersion || 'gemini-3.8-flash'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Evaluated At:</span>
                <span className="font-mono text-slate-800">
                  {new Date(activeEvaluation.evaluatedAt).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Evaluation Version:</span>
                <span className="font-mono font-bold text-[#002B49]">
                  v{activeEvaluation.evaluationVersion || '1.0'}
                </span>
              </div>
            </div>
          </div>

          {/* 5 Analytical Dimensions Breakdown */}
          <div className="space-y-2">
            <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 pt-1">
              <Layers className="w-3.5 h-3.5 text-[#002B49]" />
              <span>Dimensional Analysis & Grounded Evaluation</span>
            </h5>

            <div className="grid grid-cols-1 gap-2">
              {/* A. Technical Alignment */}
              <DimensionRow
                title="A. Technical Alignment"
                subtitle="Scope comprehension, methodology, materials, and quality assurance framework"
                dimension={activeEvaluation.dimensions.technicalAlignment}
                isExpanded={expandedDimension === 'technical'}
                onToggle={() => toggleDimension('technical')}
                scoreColor={getScoreColor(activeEvaluation.dimensions.technicalAlignment.score)}
              />

              {/* B. Implementation Feasibility */}
              <DimensionRow
                title="B. Implementation Feasibility"
                subtitle="Milestones, project phases, sequencing, resource plan, and delivery timeline"
                dimension={activeEvaluation.dimensions.implementationFeasibility}
                isExpanded={expandedDimension === 'feasibility'}
                onToggle={() => toggleDimension('feasibility')}
                scoreColor={getScoreColor(activeEvaluation.dimensions.implementationFeasibility.score)}
              />

              {/* C. Financial Reasonableness */}
              <DimensionRow
                title="C. Financial Reasonableness"
                subtitle="Base price, GST arithmetic verification, and relative deviation from tender estimate"
                dimension={activeEvaluation.dimensions.financialReasonableness}
                isExpanded={expandedDimension === 'financial'}
                onToggle={() => toggleDimension('financial')}
                scoreColor={getScoreColor(activeEvaluation.dimensions.financialReasonableness.score)}
              />

              {/* D. Experience & Capability */}
              <DimensionRow
                title="D. Experience & Capability"
                subtitle="Stated public works track record, technical personnel, and plant & machinery"
                dimension={activeEvaluation.dimensions.experienceCapability}
                isExpanded={expandedDimension === 'experience'}
                onToggle={() => toggleDimension('experience')}
                scoreColor={getScoreColor(activeEvaluation.dimensions.experienceCapability.score)}
                advisoryNote="Based strictly on declared proposal information."
              />

              {/* E. Compliance */}
              <DimensionRow
                title="E. Compliance (AI-Observed Status)"
                subtitle="Statutory declarations, eligibility statements, and tender acceptance"
                dimension={activeEvaluation.dimensions.compliance}
                isExpanded={expandedDimension === 'compliance'}
                onToggle={() => toggleDimension('compliance')}
                scoreColor={getScoreColor(activeEvaluation.dimensions.compliance.score)}
                advisoryNote="AI-observed compliance status — does not constitute legal certification."
              />
            </div>
          </div>

          {/* Explainable Risk Indicators */}
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Explainable Risk Indicators Requiring Committee Scrutiny</span>
              </h5>
              <span className="text-[10px] text-slate-500 font-mono">
                {activeEvaluation.riskIndicators.length} identified
              </span>
            </div>

            {activeEvaluation.riskIndicators.length > 0 ? (
              <div className="space-y-2">
                {activeEvaluation.riskIndicators.map((risk, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded bg-white border border-slate-200 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(risk.severity)}
                        <span className="font-bold text-slate-900">{risk.title}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">{risk.category}</span>
                    </div>
                    <p className="text-slate-700 text-[11px] leading-relaxed mt-1">
                      {risk.explanation}
                    </p>
                    {risk.evidence && (
                      <div className="bg-slate-50 p-1.5 rounded border border-slate-100 text-[10px] text-slate-600 font-mono mt-1">
                        <strong className="text-slate-700">Proposal Reference / Evidence: </strong>
                        {risk.evidence}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-2.5 rounded bg-white border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>No high-severity risk indicators observed in proposal submission.</span>
              </div>
            )}
          </div>

          {/* Key Strengths & Concerns Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Key Strengths */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Key Observed Strengths</span>
              </h5>
              <ul className="space-y-1.5 text-[11px] text-slate-700">
                {activeEvaluation.strengths.map((str, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold shrink-0 mt-0.5">•</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Key Concerns */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 text-amber-800">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Key Reviewer Concerns</span>
              </h5>
              <ul className="space-y-1.5 text-[11px] text-slate-700">
                {activeEvaluation.concerns.map((con, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-600 font-bold shrink-0 mt-0.5">•</span>
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Narrative Synthesis */}
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
            <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <FileSearch className="w-3.5 h-3.5 text-[#002B49]" />
              <span>Executive Synthesis & Evaluation Summary</span>
            </h5>
            <p className="text-[11px] text-slate-800 whitespace-pre-line leading-relaxed">
              {activeEvaluation.explanation}
            </p>
          </div>

          {/* Limitations & Statutory GFR Disclaimer */}
          <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-[10px] text-slate-600 space-y-1.5">
            <div className="font-bold text-slate-700 flex items-center gap-1">
              <Info className="w-3 h-3 text-slate-500" />
              <span>Model Limitations & Analytical Transparency:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-slate-600">
              {activeEvaluation.limitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
            <div className="border-t border-slate-200 pt-1.5 text-slate-500 italic">
              <strong>Statutory Advisory: </strong>
              This evaluation is generated by AI to assist authorized government officers. Final procurement decisions remain the statutory responsibility of the competent authority under the General Financial Rules (GFR).
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface DimensionRowProps {
  title: string;
  subtitle: string;
  dimension: DimensionEvaluation;
  isExpanded: boolean;
  onToggle: () => void;
  scoreColor: string;
  advisoryNote?: string;
}

const DimensionRow: React.FC<DimensionRowProps> = ({
  title,
  subtitle,
  dimension,
  isExpanded,
  onToggle,
  scoreColor,
  advisoryNote,
}) => {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
      >
        <div className="space-y-0.5 flex-1 pr-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-xs">{title}</span>
            {advisoryNote && (
              <span className="text-[10px] text-slate-400 italic hidden sm:inline">
                ({advisoryNote})
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 line-clamp-1">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono border ${scoreColor}`}>
              {dimension.score}/100
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs space-y-2">
          <div>
            <strong className="text-slate-700 text-[11px] block">Dimension Assessment:</strong>
            <p className="text-slate-800 text-[11px] leading-relaxed mt-0.5">
              {dimension.summary}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {dimension.strengths.length > 0 && (
              <div className="bg-white p-2 rounded border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                  Observed Strengths:
                </span>
                <ul className="space-y-1 text-[11px] text-slate-700">
                  {dimension.strengths.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {dimension.concerns.length > 0 && (
              <div className="bg-white p-2 rounded border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-amber-800 uppercase block">
                  Observed Concerns / Gaps:
                </span>
                <ul className="space-y-1 text-[11px] text-slate-700">
                  {dimension.concerns.map((c, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
