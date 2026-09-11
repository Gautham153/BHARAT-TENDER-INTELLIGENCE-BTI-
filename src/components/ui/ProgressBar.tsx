import React from 'react';
import { motion } from 'motion/react';

export interface ProgressBarProps {
  value: number; // 0 to 100
  label?: string;
  subLabel?: string;
  color?: 'default' | 'emerald' | 'blue' | 'amber' | 'rose' | 'tricolor';
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  animate?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  subLabel,
  color = 'blue',
  size = 'md',
  showPercentage = true,
  animate = true,
  className = '',
}) => {
  const clampedValue = Math.min(Math.max(value, 0), 100);

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const colorClasses = {
    default: 'bg-slate-700',
    blue: 'bg-[#002B49]',
    emerald: 'bg-emerald-600',
    amber: 'bg-amber-500',
    rose: 'bg-rose-600',
    tricolor: 'bg-gradient-to-r from-orange-500 via-blue-600 to-emerald-600',
  };

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-xs mb-1.5 font-medium text-slate-700">
          <div className="flex items-center gap-2">
            <span>{label}</span>
            {subLabel && <span className="text-slate-400 font-normal">({subLabel})</span>}
          </div>
          {showPercentage && <span className="font-semibold text-slate-900">{clampedValue}%</span>}
        </div>
      )}
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 ${sizeClasses[size]}`}>
        {animate ? (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${clampedValue}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full rounded-full ${colorClasses[color]}`}
          />
        ) : (
          <div className={`h-full rounded-full ${colorClasses[color]}`} style={{ width: `${clampedValue}%` }} />
        )}
      </div>
    </div>
  );
};
