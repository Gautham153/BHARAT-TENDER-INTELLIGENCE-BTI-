import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  icon?: LucideIcon;
  iconColor?: 'blue' | 'emerald' | 'amber' | 'rose' | 'navy';
  indicatorColor?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  trend,
  icon: Icon,
  iconColor = 'navy',
  indicatorColor,
  className = '',
}) => {
  const iconColors = {
    navy: 'bg-blue-50 text-[#002B49]',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className={`bg-white border border-slate-200/90 rounded-xl p-4.5 shadow-xs relative overflow-hidden flex flex-col justify-between ${className}`}
    >
      {indicatorColor && (
        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: indicatorColor }} />
      )}
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        {Icon && (
          <div className={`p-2 rounded-lg ${iconColors[iconColor]}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="mt-1">
        <div className="text-2xl lg:text-[26px] font-bold text-slate-900 tracking-tight leading-none">
          {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
        </div>

        {trend && (
          <div className="flex items-center gap-1.5 mt-2.5 text-xs">
            <span
              className={`inline-flex items-center font-semibold ${
                trend.isPositive ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {trend.isPositive ? (
                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
              )}
              {trend.value}
            </span>
            <span className="text-slate-400 font-normal">{trend.label || 'vs last month'}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};
