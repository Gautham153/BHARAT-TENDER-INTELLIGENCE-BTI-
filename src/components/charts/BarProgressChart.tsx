import React from 'react';
import { motion } from 'motion/react';

export interface FundItem {
  label: string;
  amount: number;
  amountFormatted: string;
  percentage: number;
  color: string;
}

export interface FundOverviewChartProps {
  totalAllocation: number;
  totalAllocationFormatted: string;
  year?: string;
  utilized: FundItem;
  unutilized: FundItem;
  className?: string;
}

export const BarProgressChart: React.FC<FundOverviewChartProps> = ({
  totalAllocationFormatted,
  year = '2024-25',
  utilized,
  unutilized,
  className = '',
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
          Total Allocation ({year})
        </div>
        <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
          ₹ {totalAllocationFormatted}
        </div>
      </div>

      {/* Dual Segment Progress Bar */}
      <div className="space-y-3">
        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex border border-slate-200/60 p-0.5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${utilized.percentage}%` }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="h-full rounded-l-full"
            style={{ backgroundColor: utilized.color }}
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${unutilized.percentage}%` }}
            transition={{ duration: 0.9, delay: 0.2, ease: 'easeOut' }}
            className="h-full rounded-r-full"
            style={{ backgroundColor: unutilized.color }}
          />
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-2 gap-4 pt-1">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: utilized.color }} />
              <span>{utilized.label}</span>
            </div>
            <div className="text-sm font-bold text-slate-900">₹ {utilized.amountFormatted}</div>
            <div className="text-[11px] font-semibold text-blue-700 mt-0.5">{utilized.percentage}% of sanction</div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: unutilized.color }} />
              <span>{unutilized.label}</span>
            </div>
            <div className="text-sm font-bold text-slate-900">₹ {unutilized.amountFormatted}</div>
            <div className="text-[11px] font-semibold text-amber-700 mt-0.5">{unutilized.percentage}% remaining</div>
          </div>
        </div>
      </div>
    </div>
  );
};
