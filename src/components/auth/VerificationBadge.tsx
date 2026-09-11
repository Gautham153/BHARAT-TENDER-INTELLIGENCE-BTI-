import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { VerificationStatus } from '../../types/auth';

export interface VerificationBadgeProps {
  status: VerificationStatus;
  className?: string;
  size?: 'sm' | 'md';
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  status,
  className = '',
  size = 'md',
}) => {
  const config = {
    verified: {
      label: 'Statutory Verified',
      icon: CheckCircle2,
      color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      dot: 'bg-emerald-500',
    },
    pending: {
      label: 'Verification Pending',
      icon: Clock,
      color: 'bg-amber-50 text-amber-800 border-amber-200',
      dot: 'bg-amber-500',
    },
    requires_review: {
      label: 'Requires Additional Review',
      icon: AlertTriangle,
      color: 'bg-blue-50 text-[#002B49] border-blue-200',
      dot: 'bg-[#002B49]',
    },
    failed: {
      label: 'Verification Failed',
      icon: XCircle,
      color: 'bg-rose-50 text-rose-800 border-rose-200',
      dot: 'bg-rose-500',
    },
    not_started: {
      label: 'Unverified Organization',
      icon: Clock,
      color: 'bg-slate-100 text-slate-700 border-slate-200',
      dot: 'bg-slate-400',
    },
  }[status] || {
    label: status,
    icon: Clock,
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  };

  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-tight ${config.color} ${sizeClasses} ${className}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{config.label}</span>
    </span>
  );
};
