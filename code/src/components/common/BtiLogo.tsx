import React from 'react';

export interface BtiLogoProps {
  portal?: 'main' | 'government' | 'agency' | 'public';
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  showWordmark?: boolean;
  compact?: boolean;
  className?: string;
  theme?: 'light' | 'dark';
}

export const BtiLogo: React.FC<BtiLogoProps> = ({
  portal = 'main',
  size = 'md',
  showSubtitle = true,
  showWordmark = true,
  compact = false,
  className = '',
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const isCompact = compact || !showWordmark;

  const sizeClasses = {
    sm: {
      mark: 'w-7 h-7',
      title: 'text-sm font-extrabold',
      badge: 'text-[9px] px-1 py-0.2',
      sub: 'text-[8.5px]',
    },
    md: {
      mark: 'w-9 h-9',
      title: 'text-base font-extrabold',
      badge: 'text-[10px] px-1.5 py-0.5',
      sub: 'text-[9.5px]',
    },
    lg: {
      mark: 'w-11 h-11',
      title: 'text-xl font-extrabold',
      badge: 'text-xs px-2 py-0.5',
      sub: 'text-[11px]',
    },
  };

  const getPortalLabel = () => {
    switch (portal) {
      case 'government':
        return 'Government Portal';
      case 'agency':
        return 'Agency Workspace';
      case 'public':
        return 'Public Transparency';
      default:
        return 'MPLAD Scheme Intelligence';
    }
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Authoritative BTI Logo Mark */}
      <div
        className={`relative ${sizeClasses[size].mark} shrink-0 rounded-lg flex items-center justify-center shadow-xs overflow-hidden ${
          isDark ? 'bg-slate-900 border border-slate-700/80' : 'bg-white border border-slate-200'
        }`}
      >
        <img
          src="/assets/bti-logo.png"
          alt="Bharat Tender Intelligence (BTI) Logo"
          className="w-full h-full object-contain p-0.5"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.currentTarget;
            if (!target.src.includes('WhatsApp')) {
              target.src = '/assets/WhatsApp Image 2026-08-31 at 9.50.54 PM.jpeg';
            }
          }}
        />
      </div>

      {/* Wordmark (hidden in compact mode) */}
      {!isCompact && (
        <div className="flex flex-col min-w-0 leading-tight">
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={`tracking-tight ${sizeClasses[size].title} ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              BTI
            </span>
            {portal !== 'main' && (
              <span
                className={`rounded font-bold uppercase tracking-wider ${sizeClasses[size].badge} ${
                  portal === 'government'
                    ? 'bg-blue-100/90 text-[#002B49]'
                    : portal === 'agency'
                    ? 'bg-emerald-100/90 text-emerald-900'
                    : 'bg-orange-100/90 text-orange-950'
                }`}
              >
                {portal === 'government' ? 'GOV' : portal === 'agency' ? 'AGENCY' : 'CITIZEN'}
              </span>
            )}
          </div>
          {showSubtitle && (
            <span
              className={`font-medium tracking-wide uppercase mt-0.5 truncate ${sizeClasses[size].sub} ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {getPortalLabel()}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
