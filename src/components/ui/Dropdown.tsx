import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface DropdownItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  align = 'right',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 mt-1.5 w-48 rounded-xl bg-white border border-slate-200 shadow-lg py-1 focus:outline-none ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {items.map((item, idx) => {
              if (item.divider) {
                return <div key={`div-${idx}`} className="my-1 border-t border-slate-100" />;
              }
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.onClick) item.onClick();
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    item.danger
                      ? 'text-rose-600 hover:bg-rose-50'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4 shrink-0" />}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
