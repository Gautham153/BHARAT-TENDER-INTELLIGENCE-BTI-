import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  showStrength?: boolean;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  label = 'Password',
  helperText,
  error,
  showStrength = false,
  value,
  id,
  className = '',
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || 'password-input';

  const calculateStrength = (pwd: string): { score: number; label: string; color: string } => {
    if (!pwd) return { score: 0, label: 'Empty', color: 'bg-slate-200' };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-rose-500' };
    if (score === 2) return { score: 2, label: 'Moderate', color: 'bg-amber-500' };
    if (score === 3) return { score: 3, label: 'Good', color: 'bg-blue-500' };
    return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
  };

  const strValue = typeof value === 'string' ? value : '';
  const strength = calculateStrength(strValue);

  return (
    <div className="w-full space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
          {label}
        </label>
      )}

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Lock className="w-4 h-4" />
        </div>

        <input
          id={inputId}
          type={showPassword ? 'text' : 'password'}
          value={value}
          className={`w-full rounded-lg border text-sm transition-all shadow-xs pl-9 pr-10 py-2 bg-white text-slate-900 placeholder:text-slate-400
            ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200' : 'border-slate-300 focus:border-[#002B49] focus:ring-2 focus:ring-slate-200'}
            disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed outline-none ${className}`}
          {...props}
        />

        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer focus:outline-none"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {showStrength && strValue.length > 0 && (
        <div className="pt-1.5 space-y-1">
          <div className="grid grid-cols-4 gap-1.5 h-1">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`h-full rounded-full transition-all ${
                  step <= strength.score ? strength.color : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          <p className="text-[10px] text-slate-500 text-right">
            Security Strength: <span className="font-semibold text-slate-700">{strength.label}</span>
          </p>
        </div>
      )}

      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
      {!error && helperText && <p className="text-xs text-slate-500">{helperText}</p>}
    </div>
  );
};
