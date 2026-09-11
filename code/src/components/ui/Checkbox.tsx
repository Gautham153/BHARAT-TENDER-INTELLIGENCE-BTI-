import React from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: React.ReactNode;
  description?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  description,
  className = '',
  id,
  ...props
}) => {
  const checkboxId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="flex items-start gap-2.5">
      <div className="flex items-center h-5">
        <input
          id={checkboxId}
          type="checkbox"
          className={`w-4 h-4 rounded text-[#002B49] border-slate-300 focus:ring-[#002B49] cursor-pointer transition-colors ${className}`}
          {...props}
        />
      </div>
      <div className="text-sm">
        <label htmlFor={checkboxId} className="font-medium text-slate-800 cursor-pointer select-none">
          {label}
        </label>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
    </div>
  );
};
