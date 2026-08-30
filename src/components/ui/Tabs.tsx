import React from 'react';
import { motion } from 'motion/react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'pills' | 'segmented';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'underline',
  className = '',
}) => {
  if (variant === 'segmented') {
    return (
      <div className={`inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 ${className}`}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap ${
                isActive ? 'text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="segmented-tab-active"
                  className="absolute inset-0 bg-white rounded-lg border border-slate-200/60"
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                {tab.label}
                {typeof tab.count === 'number' && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-slate-100 text-slate-800' : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`border-b border-slate-200 flex items-center gap-6 overflow-x-auto ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative py-3 text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer select-none whitespace-nowrap ${
              isActive ? 'text-[#002B49]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" />}
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isActive ? 'bg-blue-100/70 text-[#002B49]' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            )}
            {isActive && (
              <motion.div
                layoutId="underline-tab-active"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#002B49]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
