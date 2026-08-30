import React from 'react';

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  required = false,
  helperText,
  error,
  children,
  className = '',
}) => {
  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      </div>
      {children}
      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
      {!error && helperText && <p className="text-[11px] text-slate-500 leading-relaxed">{helperText}</p>}
    </div>
  );
};
