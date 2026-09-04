// Bharat Tender Intelligence (BTI) — Authentication Login Interface
// Phase 1A: Institutional Single Sign-On Gateway with Role Segregation

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  ArrowRight,
  Landmark,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  UserCheck,
  LogOut,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/auth/PasswordInput';
import { BtiLogo } from '../../components/common/BtiLogo';
import { SyntheticDataNotice } from '../../components/common/SyntheticDataNotice';
import { useAuth } from '../../context/AuthContext';
import { AuthRole } from '../../types/auth';

export interface LoginPageProps {
  onNavigate: (path: string) => void;
  initialPortal?: AuthRole;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onNavigate,
  initialPortal = 'government',
}) => {
  const { login, loginDemo, logout, isAuthenticated, user } = useAuth();

  // Detect portal from URL parameter if available
  const [selectedPortal, setSelectedPortal] = useState<AuthRole>(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('portal');
    if (p === 'agency' || p === 'government' || p === 'public') return p;
    return initialPortal;
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  // If already authenticated with the selected portal role, redirect to its dashboard
  useEffect(() => {
    if (isAuthenticated && user && user.role === selectedPortal) {
      if (user.role === 'government') {
        onNavigate('/government/dashboard');
      } else if (user.role === 'agency') {
        onNavigate('/agency/dashboard');
      }
    }
  }, [isAuthenticated, user, selectedPortal, onNavigate]);

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = 'Official email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address format.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!validateForm()) return;

    setLoading(true);
    try {
      const authenticatedUser = await login({
        email,
        password,
        portal: selectedPortal,
        rememberMe,
      });

      if (authenticatedUser.role === 'government') {
        onNavigate('/government/dashboard');
      } else if (authenticatedUser.role === 'agency') {
        onNavigate('/agency/dashboard');
      } else {
        onNavigate('/portal-selection');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to sign in with these credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async (roleKey: 'government' | 'agency' | 'pending_agency') => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const demoUser = await loginDemo(roleKey);
      if (demoUser.role === 'government') {
        onNavigate('/government/dashboard');
      } else if (demoUser.role === 'agency') {
        onNavigate('/agency/dashboard');
      } else {
        onNavigate('/portal-selection');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Demo sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[82vh] flex flex-col items-center justify-center py-8 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <BtiLogo size="lg" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-3">
            {selectedPortal === 'government' ? 'Government & Nodal Officer Access' : 'Agency & Contractor Workspace'}
          </h1>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            {selectedPortal === 'government'
              ? 'Authorized single sign-on gateway for District Magistrates, Nodal Desks, and Vigilance auditors.'
              : 'Secure authentication for registered executing agencies, infrastructure vendors, and PSUs.'}
          </p>
        </div>

        {/* Synthetic Notice */}
        <SyntheticDataNotice variant="inline" />

        {/* Portal Mode Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/80 rounded-xl border border-slate-300">
          <button
            type="button"
            onClick={() => {
              setSelectedPortal('government');
              setErrorMessage(null);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              selectedPortal === 'government'
                ? 'bg-[#002B49] text-white shadow-2xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Government Portal</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedPortal('agency');
              setErrorMessage(null);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              selectedPortal === 'agency'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Agency Workspace</span>
          </button>
        </div>

        {/* Main Authentication Card */}
        <Card className="p-6 space-y-5 border-slate-300 shadow-sm">
          {/* Institutional Banner */}
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              selectedPortal === 'government'
                ? 'bg-blue-50/70 border-blue-200 text-[#002B49]'
                : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold">
                {selectedPortal === 'government'
                  ? 'Authorized Personnel Only'
                  : 'Verified Organization Access'}
              </div>
              <div className="text-[11px] opacity-90 leading-relaxed">
                {selectedPortal === 'government'
                  ? 'Access is strictly monitored under statutory governance protocols. Self-registration is restricted.'
                  : 'Verified organizations can access live MPLAD tenders, submit bids, and upload proof of milestones.'}
              </div>
            </div>
          </div>

          {/* Active Session Warning / Switcher */}
          {isAuthenticated && user && (
            <div className="p-3 bg-blue-50/90 border border-blue-200 rounded-xl flex items-center justify-between gap-3 text-xs text-[#002B49]">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 font-bold">
                  <UserCheck className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                  <span className="truncate">Active: {user.name || user.email}</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-mono bg-blue-200/70 text-blue-900">
                    {user.role}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 truncate">
                  {user.role === selectedPortal
                    ? 'Currently signed in to this portal.'
                    : `Currently signed in as ${user.role}. Sign in below to switch to ${selectedPortal}.`}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  await logout();
                }}
                className="text-xs shrink-0 border-slate-300 text-rose-700 hover:text-rose-800 hover:bg-rose-50"
              >
                <LogOut className="w-3 h-3 mr-1" /> Sign Out
              </Button>
            </div>
          )}

          {/* Error Message Box */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div>{errorMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSignIn} className="space-y-4">
            <Input
              label="Official Email Address"
              type="email"
              placeholder={selectedPortal === 'government' ? 'officer@gov.in or dm@nic.in' : 'contractor@enterprise.in'}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
              }}
              error={fieldErrors.email}
              disabled={loading}
              autoComplete="email"
              helperText={
                selectedPortal === 'government'
                  ? 'Official institutional address (@gov.in, @nic.in, or provisioned Government email)'
                  : 'Registered organizational email ID'
              }
            />

            <div className="space-y-1">
              <PasswordInput
                label="Account Password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
                }}
                error={fieldErrors.password}
                disabled={loading}
                autoComplete="current-password"
              />

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-[#002B49] focus:ring-[#002B49]"
                  />
                  <span>Remember Session</span>
                </label>

                <button
                  type="button"
                  onClick={() => onNavigate('/forgot-password')}
                  className="text-xs font-semibold text-[#002B49] hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant={selectedPortal === 'government' ? 'gov' : 'default'}
              size="lg"
              className={`w-full justify-center ${
                selectedPortal === 'agency' ? 'bg-emerald-700 hover:bg-emerald-800 text-white' : 'bg-[#002B49]'
              }`}
              disabled={loading}
              icon={ArrowRight}
              iconPosition="right"
            >
              {loading ? 'Authenticating...' : `Sign In to ${selectedPortal === 'government' ? 'Government Portal' : 'Agency Workspace'}`}
            </Button>
          </form>

          {/* Agency Registration Link (ONLY FOR AGENCY) */}
          {selectedPortal === 'agency' && (
            <div className="pt-2 text-center border-t border-slate-100">
              <p className="text-xs text-slate-600">
                Don't have a verified vendor account?{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('/register/agency')}
                  className="font-bold text-emerald-800 hover:underline cursor-pointer"
                >
                  Register your organization →
                </button>
              </p>
            </div>
          )}

          {/* Quick Demo Access Bar for Evaluators */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/90 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>1-Click Evaluator Demo Sign-In</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Prototype Mode</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {selectedPortal === 'government' ? (
                <button
                  type="button"
                  onClick={() => handleDemoSignIn('government')}
                  className="p-2 rounded-lg bg-white border border-slate-200 text-left hover:border-[#002B49] hover:bg-blue-50/50 transition-all cursor-pointer text-xs space-y-0.5"
                >
                  <div className="font-bold text-[#002B49] truncate">Dr. Alok Verma, IAS</div>
                  <div className="text-[10px] text-slate-500 truncate">District Magistrate & Nodal Officer</div>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleDemoSignIn('agency')}
                    className="p-2 rounded-lg bg-white border border-slate-200 text-left hover:border-emerald-600 hover:bg-emerald-50/50 transition-all cursor-pointer text-xs space-y-0.5"
                  >
                    <div className="font-bold text-emerald-800 truncate">Vikramaditya Infra</div>
                    <div className="text-[10px] text-slate-500 truncate">Statutory Verified (Tier-1)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDemoSignIn('pending_agency')}
                    className="p-2 rounded-lg bg-white border border-slate-200 text-left hover:border-amber-600 hover:bg-amber-50/50 transition-all cursor-pointer text-xs space-y-0.5"
                  >
                    <div className="font-bold text-amber-800 truncate">Apex BuildTech</div>
                    <div className="text-[10px] text-slate-500 truncate">Verification Pending</div>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer font-medium"
            >
              ← Back to Public Transparency Hub
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};
