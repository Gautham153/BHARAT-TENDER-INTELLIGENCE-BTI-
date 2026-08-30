import React from 'react';

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
  rows = 4,
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
        rows={rows}
        className={`w-full rounded-lg border text-sm transition-all shadow-xs px-3.5 py-2.5 bg-white text-slate-900 placeholder:text-slate-400
          ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200' : 'border-slate-300 focus:border-[#002B49] focus:ring-2 focus:ring-slate-200'}
          disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed outline-none resize-y ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>}
      {!error && helperText && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
    </div>
  );
};
