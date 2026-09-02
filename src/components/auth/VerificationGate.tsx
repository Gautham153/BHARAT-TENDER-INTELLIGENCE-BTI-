// Bharat Tender Intelligence (BTI) — Verification Gate Component
// Phase 2A: Reusable Access Protection for Verified-Agency Capabilities

import React from 'react';
import { ShieldAlert, ArrowRight, FileBadge2, Lock, Clock, CheckCircle2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { VerificationBadge } from './VerificationBadge';
import { useAuth } from '../../context/AuthContext';
import { VerificationStatus } from '../../types/organization';

export interface VerificationGateProps {
  children: React.ReactNode;
  requiredStatus?: VerificationStatus;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onNavigate?: (path: string) => void;
}

export const VerificationGate: React.FC<VerificationGateProps> = ({
  children,
  requiredStatus = 'verified',
  fallbackTitle = 'Verified Agency Access Required',
  fallbackDescription,
  onNavigate,
}) => {
  const { user } = useAuth();

  const isVerified =
    user?.role === 'government' || // Government users bypass agency gating
    (user?.role === 'agency' && user.verified && user.verificationStatus === requiredStatus);

  if (isVerified) {
    return <>{children}</>;
  }

  const status = user?.verificationStatus || 'not_started';

  const defaultDescription =
    status === 'pending'
      ? 'Your organization onboarding is currently under review by the District Nodal Officer. Tender bidding, proposal submission, and financial disbursement tools will be unlocked once statutory verification is approved.'
      : status === 'requires_review'
      ? 'Your organization verification flagged items requiring nodal officer scrutiny. Full tender capabilities remain paused until review concludes.'
      : status === 'failed'
      ? 'Organization statutory verification could not be validated. Please review your GSTIN details and submit a controlled verification retry.'
      : 'You must complete statutory organization verification to access this operational workspace feature.';

  return (
    <div className="py-8 px-4 max-w-3xl mx-auto animate-fadeIn">
      <Card className="p-6 sm:p-8 border-slate-300 shadow-sm space-y-6">
        {/* Header with Lock Icon & Status Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <Lock className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {fallbackTitle}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Bharat Tender Intelligence • Regulated Procurement Gateway
              </p>
            </div>
          </div>
          <VerificationBadge status={status} size="md" />
        </div>

        {/* Informative Explanation */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
            {fallbackDescription || defaultDescription}
          </p>

          {user && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Organization Name</span>
                <span className="font-bold text-slate-900">{user.agencyName || user.name}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Registered GSTIN</span>
                <span className="font-mono font-bold text-[#002B49]">{user.gstin || 'Pending Registration'}</span>
              </div>
              {user.applicationId && (
                <div>
                  <span className="text-slate-500 block text-[11px]">Application Reference</span>
                  <span className="font-mono text-slate-700">{user.applicationId}</span>
                </div>
              )}
              <div>
                <span className="text-slate-500 block text-[11px]">Current Access Level</span>
                <span className="font-semibold text-amber-800">Unverified / Onboarding View Only</span>
              </div>
            </div>
          )}
        </div>

        {/* Statutory Policy Notice */}
        <div className="flex items-start gap-2.5 text-xs text-slate-500">
          <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span>
            Statutory Rule: General Financial Rules (GFR) 2017 & Public Procurement Guidelines mandate strict nodal verification of all contractors prior to receiving government scheme bids.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {onNavigate ? (
            <>
              <Button
                variant="outline"
                size="md"
                className="w-full sm:w-auto justify-center"
                icon={FileBadge2}
                onClick={() => onNavigate('/agency/compliance')}
              >
                Review Compliance Profile
              </Button>

              <Button
                variant="gov"
                size="md"
                className="w-full sm:w-auto justify-center bg-[#002B49]"
                icon={ArrowRight}
                iconPosition="right"
                onClick={() => onNavigate('/agency/verification')}
              >
                View Verification Status
              </Button>
            </>
          ) : (
            <div className="text-xs text-slate-500">
              Please visit the Verification Status page to monitor your onboarding.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
