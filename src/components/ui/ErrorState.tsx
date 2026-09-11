import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to load information',
  message = 'An unexpected error occurred while fetching the requested records. Please check your connection and retry.',
  onRetry,
  className = '',
}) => {
  return (
    <div className={`p-8 text-center flex flex-col items-center justify-center bg-rose-50/40 border border-rose-200/80 rounded-xl ${className}`}>
      <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h4 className="text-base font-semibold text-rose-950 tracking-tight mb-1">{title}</h4>
      <p className="text-xs text-rose-800/80 max-w-sm mb-4 leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} icon={RefreshCw} className="border-rose-300 text-rose-900 hover:bg-rose-100/50">
          Try Again
        </Button>
      )}
    </div>
  );
};
