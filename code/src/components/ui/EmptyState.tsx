import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No records found',
  description = 'There is currently no data matching your criteria.',
  icon: Icon = Inbox,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div className={`p-10 text-center flex flex-col items-center justify-center bg-white border border-slate-200/80 rounded-xl ${className}`}>
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-base font-semibold text-slate-800 tracking-tight mb-1">{title}</h4>
      <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
