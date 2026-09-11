import React from 'react';
import { Search, X } from 'lucide-react';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  className?: string;
  size?: 'sm' | 'md';
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search tenders, projects, agencies...',
  onClear,
  className = '',
  size = 'md',
}) => {
  const sizeClasses = size === 'sm' ? 'py-1.5 pl-8 pr-7 text-xs' : 'py-2 pl-9 pr-8 text-sm';
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5 left-2.5' : 'w-4 h-4 left-3';

  return (
    <div className={`relative w-full ${className}`}>
      <div className={`absolute top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 ${iconSize}`}>
        <Search className="w-full h-full" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-white border border-slate-200/90 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#002B49] focus:ring-2 focus:ring-slate-200 transition-all shadow-2xs ${sizeClasses}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            if (onClear) onClear();
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
