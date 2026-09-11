import React from 'react';

export type BadgeVariant = 'default' | 'navy' | 'emerald' | 'amber' | 'rose' | 'slate' | 'tricolor';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  dot = false,
}) => {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-medium',
  };

  const variantStyles = {
    default: 'bg-slate-100 text-slate-700 border border-slate-200',
    navy: 'bg-blue-50 text-[#002B49] border border-blue-200/80',
    emerald: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    amber: 'bg-amber-50 text-amber-900 border border-amber-200',
    rose: 'bg-rose-50 text-rose-800 border border-rose-200',
    slate: 'bg-slate-100 text-slate-600 border border-slate-200',
    tricolor: 'bg-gradient-to-r from-orange-50 via-white to-emerald-50 text-slate-800 border border-slate-200',
  };

  const dotStyles = {
    default: 'bg-slate-400',
    navy: 'bg-[#002B49]',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    slate: 'bg-slate-400',
    tricolor: 'bg-orange-500',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full whitespace-nowrap ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[variant]}`} />}
      <span>{children}</span>
    </span>
  );
};
