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
      {/* Geometric Emblem: Ashoka & Modern Tech Grid */}
      <div
        className={`relative ${sizeClasses[size].mark} shrink-0 rounded-lg flex items-center justify-center shadow-xs overflow-hidden ${
          isDark ? 'bg-slate-900 border border-slate-700/80' : 'bg-white border border-slate-200'
        }`}
      >
        {/* Tricolor edge accent */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#FF671F] via-white to-[#046A38]" />

        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4/5 h-4/5">
          {/* Geometric mandala / 24-spoke stylized chakra center */}
          <circle cx="20" cy="20" r="14" stroke="#002B49" strokeWidth="1.5" strokeOpacity={isDark ? '0.6' : '0.3'} />
          <circle cx="20" cy="20" r="9" stroke="#FF671F" strokeWidth="1.2" />
          <circle cx="20" cy="20" r="4.5" fill="#046A38" fillOpacity="0.85" />

          {/* Geometrical quadrant tick points */}
          <line x1="20" y1="2" x2="20" y2="7" stroke="#002B49" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="20" y1="33" x2="20" y2="38" stroke="#002B49" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="2" y1="20" x2="7" y2="20" stroke="#002B49" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="33" y1="20" x2="38" y2="20" stroke="#002B49" strokeWidth="1.5" strokeLinecap="round" />

          {/* Angular tech diamond */}
          <path d="M20 10L30 20L20 30L10 20Z" stroke="#002B49" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
        </svg>
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
