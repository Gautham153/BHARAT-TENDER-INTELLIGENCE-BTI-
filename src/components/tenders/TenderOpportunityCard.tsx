// Bharat Tender Intelligence (BTI) — Tender Opportunity Card Component
// Phase 3B: Reusable Agency Discovery Card with Deterministic Match Badge & Rich Metadata

import React, { useState } from 'react';
import {
  MapPin,
  Clock,
  Coins,
  Calendar,
  Layers,
  Building2,
  ChevronRight,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Tender, TenderMatchResult } from '../../types/tender';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { TenderMatchBadge } from './TenderMatchBadge';
import { TenderMatchExplanation } from './TenderMatchExplanation';

export interface TenderOpportunityCardProps {
  tender: Tender;
  matchResult?: TenderMatchResult;
  onNavigate: (path: string) => void;
  organizationName?: string;
  className?: string;
}

export const formatCurrencyINR = (amount?: number): string => {
  if (!amount || isNaN(amount)) return '₹ 0.00';
  if (amount >= 10000000) {
    return `₹ ${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `₹ ${(amount / 100000).toFixed(2)} Lakh`;
  }
  return `₹ ${amount.toLocaleString('en-IN')}`;
};

export const getDaysRemainingInfo = (
  closingDate?: string
): { days: number; isClosingSoon: boolean; label: string; isClosed: boolean } => {
  if (!closingDate) return { days: 0, isClosingSoon: false, label: 'Date pending', isClosed: false };
  const closeTime = new Date(closingDate).getTime();
  if (isNaN(closeTime)) return { days: 0, isClosingSoon: false, label: 'Date pending', isClosed: false };

  const diffMs = closeTime - Date.now();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return { days: 0, isClosingSoon: false, label: 'Bidding Closed', isClosed: true };
  }
  if (diffDays === 1) {
    return { days: 1, isClosingSoon: true, label: 'Closes tomorrow', isClosed: false };
  }
  if (diffDays <= 7) {
    return { days: diffDays, isClosingSoon: true, label: `Closes in ${diffDays} days`, isClosed: false };
  }
  return { days: diffDays, isClosingSoon: false, label: `${diffDays} days remaining`, isClosed: false };
};

export const TenderOpportunityCard: React.FC<TenderOpportunityCardProps> = ({
  tender,
  matchResult,
  onNavigate,
  organizationName,
  className = '',
}) => {
  const [showExplanation, setShowExplanation] = useState(false);
  const closingInfo = getDaysRemainingInfo(tender.closingDate);
  const amountToDisplay = tender.sanctionedAmount || tender.estimatedValue || tender.estimatedCost;

  return (
    <Card
      className={`p-5 sm:p-6 border-slate-200 hover:border-slate-300 transition-all hover:shadow-sm space-y-4 bg-white relative overflow-hidden ${className}`}
    >
      {/* Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="font-mono text-xs font-bold text-[#002B49] bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
            {tender.tenderNumber}
          </span>
          <StatusBadge status={tender.status} size="sm" />
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" />
            <span className="truncate max-w-[200px]">{tender.issuingAuthority}</span>
          </span>
        </div>

        {/* BTI Match Badge */}
        {matchResult && (
          <div className="flex items-center gap-1.5 shrink-0">
            <TenderMatchBadge
              score={matchResult.score}
              tier={matchResult.tier}
              size="md"
              onClickExplanation={() => setShowExplanation(!showExplanation)}
            />
          </div>
        )}
      </div>

      {/* Main Title & Scope */}
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-4">
          <h3
            onClick={() => onNavigate(`/agency/tenders/${tender.id}`)}
            className="text-base sm:text-lg font-black text-slate-900 leading-snug tracking-tight hover:text-[#002B49] cursor-pointer transition-colors"
          >
            {tender.title}
          </h3>
        </div>

        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed font-normal">
          {tender.description}
        </p>
      </div>

      {/* Category & Subcategory Tags */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-[11px] font-semibold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 flex items-center gap-1">
          <Building2 className="w-3 h-3 text-slate-500" />
          <span>{tender.category}</span>
        </span>
        {tender.subCategory && (
          <span className="text-[11px] font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 flex items-center gap-1">
            <Layers className="w-3 h-3 text-slate-500" />
            <span>{tender.subCategory}</span>
          </span>
        )}
        <span className="text-[11px] font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 flex items-center gap-1">
          <MapPin className="w-3 h-3 text-slate-500" />
          <span>
            {tender.district ? `${tender.district}, ` : ''}
            {tender.state}
          </span>
        </span>
      </div>

      {/* Numerical Data Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
        <div>
          <span className="text-slate-500 block text-[11px] font-medium">Sanctioned Value</span>
          <span className="font-bold text-slate-900 text-sm">
            {formatCurrencyINR(amountToDisplay)}
          </span>
        </div>

        <div>
          <span className="text-slate-500 block text-[11px] font-medium">Project Location</span>
          <span className="font-semibold text-slate-800 line-clamp-1" title={tender.projectLocation}>
            {tender.projectLocation || `${tender.constituency}, ${tender.state}`}
          </span>
        </div>

        <div>
          <span className="text-slate-500 block text-[11px] font-medium">Execution Duration</span>
          <span className="font-semibold text-slate-800">
            {tender.durationValue} {tender.durationUnit}
          </span>
        </div>

        <div>
          <span className="text-slate-500 block text-[11px] font-medium">Closing Date</span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-semibold text-slate-900">
              {tender.closingDate}
            </span>
            {closingInfo.isClosingSoon && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-900 shrink-0">
                {closingInfo.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Match Explanation Toggle Section */}
      {showExplanation && matchResult && (
        <div className="pt-2 animate-fadeIn">
          <TenderMatchExplanation
            matchResult={matchResult}
            organizationName={organizationName}
            onClose={() => setShowExplanation(false)}
          />
        </div>
      )}

      {/* Bottom Footer Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs text-slate-500 w-full sm:w-auto">
          {matchResult && (
            <button
              type="button"
              onClick={() => setShowExplanation(!showExplanation)}
              className="text-[#002B49] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>{showExplanation ? 'Hide match factors' : 'Why this matches your profile'}</span>
              {showExplanation ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="gov"
            size="sm"
            className="w-full sm:w-auto bg-[#002B49] text-xs px-4 py-2 font-bold"
            icon={ChevronRight}
            iconPosition="right"
            onClick={() => onNavigate(`/agency/tenders/${tender.id}`)}
          >
            View Tender
          </Button>
        </div>
      </div>
    </Card>
  );
};
