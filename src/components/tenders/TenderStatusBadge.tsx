// Bharat Tender Intelligence (BTI) — Tender Status Badge
// Phase 3A: Government Tender Lifecycle Visual Indicators

import React from 'react';
import { TenderStatus } from '../../types/tender';
import {
  FileText,
  Radio,
  Clock,
  Search,
  Award,
  XCircle,
  Archive,
} from 'lucide-react';

interface TenderStatusBadgeProps {
  status: TenderStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const TenderStatusBadge: React.FC<TenderStatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
}) => {
  // Normalize legacy status names
  const normalized = (status === 'Open' ? 'LIVE' : status.toUpperCase().replace(/\s+/g, '_'));

  let config = {
    label: 'DRAFT',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    icon: FileText,
  };

  switch (normalized) {
    case 'DRAFT':
      config = {
        label: 'Draft',
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-300',
        icon: FileText,
      };
      break;

    case 'PUBLISHED':
    case 'LIVE':
      config = {
        label: 'Live / Bidding',
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        border: 'border-emerald-300',
        icon: Radio,
      };
      break;

    case 'CLOSED':
      config = {
        label: 'Bidding Closed',
        bg: 'bg-amber-50',
        text: 'text-amber-900',
        border: 'border-amber-300',
        icon: Clock,
      };
      break;

    case 'UNDER_EVALUATION':
    case 'IN_EVALUATION':
      config = {
        label: 'Under Evaluation',
        bg: 'bg-indigo-50',
        text: 'text-indigo-800',
        border: 'border-indigo-300',
        icon: Search,
      };
      break;

    case 'AWARDED':
      config = {
        label: 'Contract Awarded',
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        border: 'border-blue-300',
        icon: Award,
      };
      break;

    case 'CANCELLED':
      config = {
        label: 'Cancelled',
        bg: 'bg-rose-50',
        text: 'text-rose-800',
        border: 'border-rose-300',
        icon: XCircle,
      };
      break;

    case 'ARCHIVED':
      config = {
        label: 'Archived',
        bg: 'bg-zinc-100',
        text: 'text-zinc-700',
        border: 'border-zinc-300',
        icon: Archive,
      };
      break;

    default:
      config = {
        label: status,
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-300',
        icon: FileText,
      };
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1.5 gap-2 font-semibold',
  };

  const IconComponent = config.icon;

  return (
    <span
      id={`tender-status-badge-${normalized.toLowerCase()}`}
      className={`inline-flex items-center rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses[size]} tracking-tight whitespace-nowrap shadow-xs`}
    >
      {showIcon && (
        <IconComponent
          className={`${size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'}`}
        />
      )}
      <span>{config.label}</span>
    </span>
  );
};
