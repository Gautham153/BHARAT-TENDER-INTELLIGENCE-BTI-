import React from 'react';
import { Database, Info } from 'lucide-react';

export interface SyntheticDataNoticeProps {
  className?: string;
  variant?: 'subtle' | 'inline' | 'banner';
}

export const SyntheticDataNotice: React.FC<SyntheticDataNoticeProps> = ({
  className = '',
  variant = 'subtle',
}) => {
  if (variant === 'banner') {
    return (
      <div className={`bg-amber-50/90 border border-amber-200/90 px-3.5 py-1.5 rounded-lg flex items-center justify-between text-xs text-amber-950 shadow-2xs ${className}`}>
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>
            <strong className="font-semibold">SIH Demonstration Mode:</strong> All tenders, risk scores, budgets, and agency records are synthetic demo data.
          </span>
        </div>
        <span className="text-[11px] font-mono text-amber-800/80 bg-amber-100/60 px-1.5 py-0.5 rounded">
          Phase 0 Foundation
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 border border-slate-200/80 text-slate-600 select-none ${className}`}
      title="This view contains synthetic mock datasets for demonstration"
    >
      <Database className="w-3 h-3 text-slate-400" />
      <span>Synthetic Demonstration Data</span>
    </div>
  );
};
