// Bharat Tender Intelligence (BTI) — Development Environment Notice
// Phase 2A: Institutional Technical Honesty Banner for Simulated GST Verification

import React from 'react';
import { Info, ShieldAlert } from 'lucide-react';

export interface DevelopmentEnvironmentNoticeProps {
  className?: string;
  compact?: boolean;
}

export const DevelopmentEnvironmentNotice: React.FC<DevelopmentEnvironmentNoticeProps> = ({
  className = '',
  compact = false,
}) => {
  if (compact) {
    return (
      <div
        className={`px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-2 text-[11px] text-slate-700 ${className}`}
      >
        <Info className="w-3.5 h-3.5 text-blue-700 shrink-0" />
        <span className="truncate">
          <strong className="font-semibold">Development / Simulation Environment:</strong> Results shown do not query live GOI GST databases.
        </span>
      </div>
    );
  }

  return (
    <div
      className={`p-3.5 bg-blue-50/70 border border-blue-200/90 rounded-xl flex items-start gap-2.5 text-xs text-[#002B49] ${className}`}
    >
      <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-800" />
      <div className="space-y-1">
        <div className="font-bold tracking-tight">
          Development & Evaluation Verification Environment
        </div>
        <p className="text-slate-600 leading-relaxed text-[11px]">
          Organization verification and GSTIN status checks displayed in this session are generated via BTI&apos;s pluggable development simulation provider. Results do not represent a live query against the Government of India GST or MCA databases.
        </p>
      </div>
    </div>
  );
};
