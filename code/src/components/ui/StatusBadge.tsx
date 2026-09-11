import React from 'react';
import { TenderStatus, ProposalStatus, ProjectStatus } from '../../types';

export interface StatusBadgeProps {
  status: TenderStatus | ProposalStatus | ProjectStatus | string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', className = '' }) => {
  const getStyle = (st: string) => {
    switch (st.toLowerCase()) {
      case 'open':
      case 'active':
      case 'passed':
      case 'verified':
      case 'completed':
      case 'ready':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
          dot: 'bg-emerald-500',
        };
      case 'in evaluation':
      case 'under review':
      case 'under inspection':
      case 'shortlisted':
      case 'in progress':
      case 'evidence gathering':
        return {
          bg: 'bg-amber-50 text-amber-900 border-amber-200/80',
          dot: 'bg-amber-500',
        };
      case 'awarded':
      case 'cleared':
        return {
          bg: 'bg-blue-50 text-blue-800 border-blue-200/80',
          dot: 'bg-blue-600',
        };
      case 'closed':
      case 'draft':
      case 'planning':
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
        };
      case 'delayed':
      case 'halted':
      case 'rejected':
      case 'cancelled':
      case 'action required':
      case 'flagged':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-200/80',
          dot: 'bg-rose-500',
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
        };
    }
  };

  const currentStyle = getStyle(status);
  const sizeClasses = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${currentStyle.bg} ${sizeClasses} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${currentStyle.dot}`} />
      <span className="whitespace-nowrap">{status}</span>
    </span>
  );
};
