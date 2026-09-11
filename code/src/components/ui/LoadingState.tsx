import React from 'react';

export interface LoadingStateProps {
  type?: 'card' | 'table' | 'chart' | 'stats' | 'content';
  rows?: number;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  type = 'content',
  rows = 4,
  className = '',
}) => {
  if (type === 'stats') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4.5 ${className}`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4.5 animate-pulse">
            <div className="h-3 bg-slate-200 rounded w-24 mb-3" />
            <div className="h-7 bg-slate-200 rounded w-20 mb-2" />
            <div className="h-3 bg-slate-100 rounded w-28" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-4 animate-pulse ${className}`}>
        <div className="h-9 bg-slate-100 rounded mb-4" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3.5 border-b border-slate-100 gap-4">
            <div className="h-4 bg-slate-200 rounded w-1/4" />
            <div className="h-4 bg-slate-100 rounded w-1/5" />
            <div className="h-4 bg-slate-200 rounded w-1/6" />
            <div className="h-4 bg-slate-100 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'chart') {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-5 animate-pulse ${className}`}>
        <div className="flex justify-between items-center mb-6">
          <div className="h-4 bg-slate-200 rounded w-32" />
          <div className="h-3 bg-slate-100 rounded w-16" />
        </div>
        <div className="h-48 bg-slate-50 rounded-lg flex items-end justify-between p-4 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="bg-slate-200 rounded-t w-full"
              style={{ height: `${25 + (i % 4) * 20}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-5 animate-pulse space-y-3 ${className}`}>
        <div className="h-4 bg-slate-200 rounded w-2/3" />
        <div className="h-3 bg-slate-100 rounded w-full" />
        <div className="h-3 bg-slate-100 rounded w-4/5" />
        <div className="pt-2 flex justify-between items-center">
          <div className="h-4 bg-slate-200 rounded w-20" />
          <div className="h-7 bg-slate-200 rounded w-24" />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-6 animate-pulse space-y-4 ${className}`}>
      <div className="h-5 bg-slate-200 rounded w-1/3" />
      <div className="space-y-2">
        <div className="h-3.5 bg-slate-100 rounded w-full" />
        <div className="h-3.5 bg-slate-100 rounded w-5/6" />
        <div className="h-3.5 bg-slate-100 rounded w-2/3" />
      </div>
    </div>
  );
};
