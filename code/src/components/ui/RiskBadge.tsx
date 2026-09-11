import React from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';

export interface RiskBadgeProps {
  score?: number; // 0-100
  level?: 'Low' | 'Medium' | 'High' | 'Critical' | string;
  showLabel?: boolean;
  showIcon?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  score,
  level,
  showLabel = true,
  showIcon = true,
  size = 'md',
  className = '',
}) => {
  // Determine risk category
  let calculatedLevel: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';

  if (level) {
    const l = level.toLowerCase();
    if (l === 'critical') calculatedLevel = 'Critical';
    else if (l === 'high') calculatedLevel = 'High';
    else if (l === 'medium') calculatedLevel = 'Medium';
    else calculatedLevel = 'Low';
  } else if (typeof score === 'number') {
    if (score >= 80) calculatedLevel = 'Critical';
    else if (score >= 60) calculatedLevel = 'High';
    else if (score >= 35) calculatedLevel = 'Medium';
    else calculatedLevel = 'Low';
  }

  const styles = {
    Low: {
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      dot: 'bg-emerald-500',
      icon: ShieldCheck,
      text: 'Low Risk',
      actionText: 'Verified Compliant',
    },
    Medium: {
      bg: 'bg-amber-50 text-amber-900 border-amber-200',
      dot: 'bg-amber-500',
      icon: AlertTriangle,
      text: 'Medium Risk',
      actionText: 'Requires Verification',
    },
    High: {
      bg: 'bg-orange-50 text-orange-900 border-orange-200',
      dot: 'bg-orange-500',
      icon: AlertTriangle,
      text: 'High Risk',
      actionText: 'Requires Verification',
    },
    Critical: {
      bg: 'bg-rose-50 text-rose-900 border-rose-200',
      dot: 'bg-rose-500',
      icon: ShieldAlert,
      text: 'Critical Risk',
      actionText: 'Urgent Review',
    },
  };

  const current = styles[calculatedLevel];
  const Icon = current.icon;
  const sizeClasses = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${current.bg} ${sizeClasses} ${className}`}>
      {showIcon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      {!showIcon && <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />}
      <span className="whitespace-nowrap font-semibold">
        {typeof score === 'number' && `Risk Score ${score}`}
        {typeof score === 'number' && showLabel && ` • `}
        {showLabel && (typeof score === 'number' ? calculatedLevel : current.text)}
      </span>
    </span>
  );
};
