import React from 'react';
import { motion } from 'motion/react';

export interface RiskMeterProps {
  score: number; // 0 to 100
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  showBreakdown?: boolean;
  className?: string;
}

export const RiskMeter: React.FC<RiskMeterProps> = ({
  score,
  title = 'Risk Assessment Index',
  size = 'md',
  showBreakdown = false,
  className = '',
}) => {
  const clamped = Math.min(Math.max(score, 0), 100);

  const getRiskDetails = (val: number) => {
    if (val >= 80) return { label: 'Critical Risk', color: '#f43f5e', bg: 'bg-rose-50 text-rose-800' };
    if (val >= 60) return { label: 'High Risk', color: '#f97316', bg: 'bg-orange-50 text-orange-800' };
    if (val >= 35) return { label: 'Medium Risk', color: '#f59e0b', bg: 'bg-amber-50 text-amber-800' };
    return { label: 'Low Risk', color: '#10b981', bg: 'bg-emerald-50 text-emerald-800' };
  };

  const details = getRiskDetails(clamped);

  return (
    <div className={`bg-white border border-slate-200/90 rounded-xl p-4.5 shadow-xs ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-700">{title}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${details.bg}`}>
          {details.label}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{clamped}</span>
        <span className="text-xs font-semibold text-slate-400">/ 100</span>
      </div>

      {/* Multi-tier Risk Bar */}
      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden relative border border-slate-200/60 mb-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: details.color }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-slate-400 font-medium">
        <span>0 (Low)</span>
        <span>35</span>
        <span>60</span>
        <span>100 (Critical)</span>
      </div>

      {showBreakdown && (
        <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-500 block text-[11px]">Action Priority</span>
            <span className="font-semibold text-slate-800">
              {clamped >= 60 ? 'Requires Verification' : 'Routine Monitoring'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Model Confidence</span>
            <span className="font-semibold text-slate-800">92% Signal Match</span>
          </div>
        </div>
      )}
    </div>
  );
};
