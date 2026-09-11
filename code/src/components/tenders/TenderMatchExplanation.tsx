// Bharat Tender Intelligence (BTI) — Tender Match Explanation Component
// Phase 3B: Explainable Compatibility Breakdown

import React from 'react';
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Building2,
  Info,
  Layers,
  MapPin,
  Award,
  CircleDollarSign,
  TrendingUp,
} from 'lucide-react';
import { TenderMatchResult, TenderMatchFactorItem } from '../../types/tender';

export interface TenderMatchExplanationProps {
  matchResult: TenderMatchResult;
  organizationName?: string;
  className?: string;
  variant?: 'inline' | 'modal' | 'card';
  onClose?: () => void;
}

export const TenderMatchExplanation: React.FC<TenderMatchExplanationProps> = ({
  matchResult,
  organizationName,
  className = '',
  variant = 'card',
  onClose,
}) => {
  const { score, tier, summary, factors, calculatedAt } = matchResult;

  const getFactorIcon = (type: TenderMatchFactorItem['type']) => {
    switch (type) {
      case 'sector_category':
      case 'category':
        return <Building2 className="w-4 h-4 text-slate-600 shrink-0" />;
      case 'geographic_jurisdiction':
      case 'state':
      case 'district':
        return <MapPin className="w-4 h-4 text-slate-600 shrink-0" />;
      case 'operational_capabilities':
      case 'specialization':
      case 'subcategory':
        return <Award className="w-4 h-4 text-slate-600 shrink-0" />;
      case 'financial_capacity':
      case 'financial_tier':
        return <CircleDollarSign className="w-4 h-4 text-slate-600 shrink-0" />;
      default:
        return <Award className="w-4 h-4 text-slate-600 shrink-0" />;
    }
  };

  const getTierColor = () => {
    if (tier === 'HIGH') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (tier === 'MODERATE') return 'text-blue-700 bg-blue-50 border-blue-200';
    return 'text-slate-700 bg-slate-100 border-slate-200';
  };

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-0.5 font-bold rounded-md border font-mono ${getTierColor()}`}
            >
              {score}% Compatibility Score
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Deterministic BTI Match
            </span>
          </div>
          <h4 className="text-sm font-bold text-slate-900 mt-1">
            Why this tender matches {organizationName ? `"${organizationName}"` : 'your organization'}
          </h4>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md text-xs"
          >
            Close
          </button>
        )}
      </div>

      {/* Summary Narrative */}
      <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50/80 p-3 rounded-lg border border-slate-100">
        {summary}
      </p>

      {/* Factor Breakdown */}
      <div className="space-y-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
          Deterministic Criteria Breakdown (Total: 100 pts)
        </span>

        {factors.map((factor) => (
          <div
            key={factor.id}
            className={`p-3 rounded-lg border text-xs flex items-start gap-3 transition-colors ${
              factor.matched
                ? 'bg-white border-slate-200 text-slate-800'
                : 'bg-slate-50/60 border-slate-200/80 text-slate-600'
            }`}
          >
            <div className="mt-0.5">
              {factor.matched ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                  {getFactorIcon(factor.type)}
                  <span>{factor.name}</span>
                </div>
                <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                  {factor.scoreAwarded} / {factor.maxScore} pts
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1 leading-normal">
                {factor.explanation}
              </p>
              {factor.calculationBasis && (
                <div className="mt-1.5 font-mono text-[10.5px] text-slate-600 bg-slate-50 py-1 px-2 rounded border border-slate-200/70 flex items-start gap-1.5">
                  <span className="font-semibold text-slate-500 uppercase tracking-wider text-[9px] shrink-0 mt-0.5">Basis:</span>
                  <span className="leading-snug">{factor.calculationBasis}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Transparent Methodology Notice */}
      <div className="pt-2 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-500">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <span className="leading-snug">
          BTI compatibility scores are deterministically computed across 4 rule-based statutory criteria: Sector Alignment (35%), Jurisdiction (25%), Technical Capabilities (20%), and Financial Capacity Ratio (20%). No AI/ML inference is used in this score. This rating is informational and does not constitute statutory bid qualification.
        </span>
      </div>
    </div>
  );
};
