// Input, Textarea & Select Components
import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  icon: Icon,
  iconPosition = 'left',
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && iconPosition === 'left' && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          id={inputId}
          className={`w-full rounded-lg border text-sm transition-all shadow-xs px-3.5 py-2 bg-white text-slate-900 placeholder:text-slate-400
            ${Icon && iconPosition === 'left' ? 'pl-9' : ''}
            ${Icon && iconPosition === 'right' ? 'pr-9' : ''}
            ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200' : 'border-slate-300 focus:border-[#002B49] focus:ring-2 focus:ring-slate-200'}
            disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed outline-none ${className}`}
          {...props}
        />
        {Icon && iconPosition === 'right' && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>}
      {!error && helperText && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
    </div>
  );
};

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  helperText,
  error,
  className = '',
  id,
  ...props
}) => {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textareaId} className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`w-full rounded-lg border text-sm transition-all shadow-xs px-3.5 py-2 bg-white text-slate-900 placeholder:text-slate-400
          ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200' : 'border-slate-300 focus:border-[#002B49] focus:ring-2 focus:ring-slate-200'}
          disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed outline-none ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>}
      {!error && helperText && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
    </div>
  );
};

export interface SelectOption {
  label: string;
  value: string | number;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  helperText?: string;
  error?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  helperText,
  error,
  className = '',
  id,
  ...props
}) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full rounded-lg border text-sm transition-all shadow-xs px-3.5 py-2 bg-white text-slate-900
          ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200' : 'border-slate-300 focus:border-[#002B49] focus:ring-2 focus:ring-slate-200'}
          disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed outline-none ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>}
      {!error && helperText && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
    </div>
  );
};
