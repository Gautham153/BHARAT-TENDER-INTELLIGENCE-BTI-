// Bharat Tender Intelligence (BTI) — Tender Match Badge Component
// Phase 3B: Transparent Compatibility Score Representation (Deterministic Rule-Based)

import React from 'react';
import { Target, CheckCircle2, AlertCircle } from 'lucide-react';
import { TenderMatchTier } from '../../types/tender';

export interface TenderMatchBadgeProps {
  score: number; // 0 to 100
  tier?: TenderMatchTier;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
  onClickExplanation?: () => void;
}

export const TenderMatchBadge: React.FC<TenderMatchBadgeProps> = ({
  score,
  tier = score >= 70 ? 'HIGH' : score >= 40 ? 'MODERATE' : 'LOW',
  size = 'md',
  showIcon = true,
  className = '',
  onClickExplanation,
}) => {
  const getStyle = () => {
    switch (tier) {
      case 'HIGH':
        return {
          bg: 'bg-emerald-50',
          text: 'text-emerald-800',
          border: 'border-emerald-200',
          badgeText: 'High Match',
          iconColor: 'text-emerald-600',
        };
      case 'MODERATE':
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-800',
          border: 'border-blue-200',
          badgeText: 'Moderate Match',
          iconColor: 'text-blue-600',
        };
      case 'LOW':
      default:
        return {
          bg: 'bg-slate-100',
          text: 'text-slate-700',
          border: 'border-slate-200',
          badgeText: 'Low Match',
          iconColor: 'text-slate-500',
        };
    }
  };

  const style = getStyle();

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2',
  }[size];

  const content = (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${style.bg} ${style.text} ${style.border} ${sizeClasses} ${className} ${
        onClickExplanation ? 'cursor-pointer hover:shadow-xs transition-shadow' : ''
      }`}
      title="BTI Deterministic Opportunity Compatibility Score"
    >
      {showIcon && (
        tier === 'HIGH' ? (
          <Target className={`w-3.5 h-3.5 shrink-0 ${style.iconColor}`} />
        ) : tier === 'MODERATE' ? (
          <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${style.iconColor}`} />
        ) : (
          <AlertCircle className={`w-3.5 h-3.5 shrink-0 ${style.iconColor}`} />
        )
      )}
      <span className="font-mono font-bold">{score}%</span>
      <span className="opacity-80">BTI Match</span>
    </span>
  );

  if (onClickExplanation) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClickExplanation();
        }}
        className="focus:outline-none text-left"
        aria-label="View BTI Match Explanation"
      >
        {content}
      </button>
    );
  }

  return content;
};
