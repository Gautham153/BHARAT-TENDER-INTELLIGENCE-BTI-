import React from 'react';

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  badge,
  className = '',
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-1 ${className}`}>
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {typeof title === 'string' ? (
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          ) : (
            title
          )}
          {badge}
        </div>
        {subtitle && (
          <div className="text-xs sm:text-sm text-slate-500 mt-1">{subtitle}</div>
        )}
      </div>
      {actions && <div className="flex items-center gap-2.5 flex-wrap">{actions}</div>}
    </div>
  );
};
