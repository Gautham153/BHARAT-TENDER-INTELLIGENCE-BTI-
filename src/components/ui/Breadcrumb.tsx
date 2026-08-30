import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  showHome = false,
  className = '',
}) => {
  return (
    <nav className={`flex items-center text-xs text-slate-500 mb-3 overflow-x-auto whitespace-nowrap ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5">
        {showHome && (
          <li className="flex items-center">
            <span className="text-slate-400 hover:text-slate-700 transition-colors">
              <Home className="w-3.5 h-3.5" />
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 mx-1 shrink-0" />
          </li>
        )}
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center">
              {item.onClick ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className={`hover:text-[#002B49] transition-colors cursor-pointer ${
                    isLast || item.active ? 'font-semibold text-slate-900' : 'text-slate-500'
                  }`}
                >
                  {item.label}
                </button>
              ) : item.href ? (
                <a
                  href={item.href}
                  className={`hover:text-[#002B49] transition-colors ${
                    isLast || item.active ? 'font-semibold text-slate-900' : 'text-slate-500'
                  }`}
                >
                  {item.label}
                </a>
              ) : (
                <span className={isLast || item.active ? 'font-semibold text-slate-900' : 'text-slate-500'}>
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRight className="w-3.5 h-3.5 text-slate-300 mx-1 shrink-0" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
