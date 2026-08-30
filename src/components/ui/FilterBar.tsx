import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { Button } from './Button';

export interface FilterOption {
  key: string;
  label: string;
  options: { label: string; value: string }[];
  currentValue: string;
  onChange: (value: string) => void;
}

export interface FilterBarProps {
  filters: FilterOption[];
  onReset?: () => void;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onReset,
  className = '',
}) => {
  const hasActiveFilters = filters.some(
    (f) => f.currentValue && f.currentValue !== 'All' && f.currentValue !== ''
  );

  return (
    <div className={`flex flex-wrap items-center gap-2.5 py-1 ${className}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mr-1">
        <Filter className="w-3.5 h-3.5" />
        <span>Filters:</span>
      </div>

      {filters.map((filter) => (
        <select
          key={filter.key}
          value={filter.currentValue}
          onChange={(e) => filter.onChange(e.target.value)}
          aria-label={`Filter by ${filter.label}`}
          className="text-xs font-medium bg-white border border-slate-200/90 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-[#002B49] focus:ring-1 focus:ring-[#002B49] shadow-2xs cursor-pointer"
        >
          <option value="All">{filter.label}: All</option>
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}

      {hasActiveFilters && onReset && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          icon={RotateCcw}
          className="text-slate-500 hover:text-slate-900 text-xs px-2 py-1"
        >
          Reset
        </Button>
      )}
    </div>
  );
};
