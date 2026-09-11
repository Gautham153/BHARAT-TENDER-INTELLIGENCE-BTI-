// Bharat Tender Intelligence (BTI) — Forgot Password Page
// Phase 1A: Institutional Password Recovery Request

import React, { useState } from 'react';
import { ArrowLeft, Mail, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { BtiLogo } from '../../components/common/BtiLogo';
import { SyntheticDataNotice } from '../../components/common/SyntheticDataNotice';
import { useAuth } from '../../context/AuthContext';

export interface ForgotPasswordPageProps {
  onNavigate: (path: string) => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onNavigate }) => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid official email address.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process reset request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <BtiLogo size="md" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-3">
            Account Recovery
          </h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Statutory credential recovery gateway for Bharat Tender Intelligence
          </p>
        </div>

        <SyntheticDataNotice variant="inline" />

        <Card className="p-6 border-slate-300 shadow-sm space-y-5">
          {submitted ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">
                  Password Reset Request Received
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                  If an account exists for <span className="font-semibold text-slate-900">{email}</span>, institutional password reset instructions have been dispatched.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs text-slate-500 space-y-1">
                <div className="font-semibold text-slate-700">Security Note:</div>
                <p className="text-[11px] leading-relaxed">
                  For government officers, reset links are routed through NIC/e-Pramaan nodal directory. Check your official inbox or spam folder.
                </p>
              </div>

              <Button
                variant="gov"
                size="md"
                className="w-full justify-center bg-[#002B49]"
                onClick={() => onNavigate('/login')}
              >
                Return to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Enter your registered institutional or agency email address to receive password reset instructions.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}

              <Input
                label="Registered Email Address"
                type="email"
                placeholder="name@gov.in or contractor@agency.in"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                disabled={loading}
                icon={Mail}
                required
              />

              <Button
                type="submit"
                variant="gov"
                size="lg"
                className="w-full justify-center bg-[#002B49]"
                disabled={loading}
              >
                {loading ? 'Dispatched Instructions...' : 'Send Password Reset Link'}
              </Button>

              <div className="text-center pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onNavigate('/login')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#002B49] hover:underline cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};
