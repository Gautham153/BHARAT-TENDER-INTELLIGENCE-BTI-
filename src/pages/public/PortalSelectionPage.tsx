// Bharat Tender Intelligence (BTI) — Workspace & Portal Selection
// Phase 1A: Role-Restricted Workspace Launcher

import React from 'react';
import {
  Shield,
  Building2,
  Users,
  ArrowRight,
  LogOut,
  CheckCircle2,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BtiLogo } from '../../components/common/BtiLogo';
import { VerificationBadge } from '../../components/auth/VerificationBadge';
import { SyntheticDataNotice } from '../../components/common/SyntheticDataNotice';
import { useAuth } from '../../context/AuthContext';

export interface PortalSelectionPageProps {
  onNavigate: (path: string) => void;
}

export const PortalSelectionPage: React.FC<PortalSelectionPageProps> = ({ onNavigate }) => {
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    onNavigate('/login');
  };

  return (
    <div className="min-h-[82vh] py-12 px-4 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <BtiLogo size="lg" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-3">
          Choose Your BTI Workspace
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          Access is strictly routed according to your authenticated institutional profile and statutory clearance.
        </p>
      </div>

      <SyntheticDataNotice variant="inline" />

      {/* Authenticated Identity Pill */}
      {isAuthenticated && user && (
        <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#002B49] text-white flex items-center justify-center font-bold text-sm">
              {user.name.charAt(0)}
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span>{user.name}</span>
                {user.role === 'agency' && (
                  <VerificationBadge status={user.verificationStatus} size="sm" />
                )}
              </div>
              <div className="text-slate-500">
                {user.department || user.agencyName || user.email} • Role:{' '}
                <span className="font-semibold text-slate-800 uppercase">{user.role}</span>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="text-slate-600 hover:text-rose-700"
            icon={LogOut}
            onClick={handleLogout}
          >
            Sign Out
          </Button>
        </div>
      )}

      {/* Workspace Selection Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Government Portal Card (Only active/available for Government users) */}
        <Card
          variant="elevated"
          className={`p-7 flex flex-col justify-between border-t-4 ${
            user?.role === 'government'
              ? 'border-t-[#002B49] bg-white ring-2 ring-blue-100 shadow-md'
              : 'border-t-slate-300 bg-slate-50 opacity-70'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  user?.role === 'government'
                    ? 'bg-blue-50 text-[#002B49]'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                <Shield className="w-6 h-6" />
              </div>

              {user?.role === 'government' ? (
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Authorized Access
                </span>
              ) : (
                <span className="text-[11px] font-bold text-slate-500 bg-slate-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Restricted (Gov Only)
                </span>
              )}
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">Government Intelligence</h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Monitor live MPLAD scheme tenders, evaluate bids with AI risk matrices, triage anomaly flags, and oversee district execution.
              </p>
            </div>

            <ul className="space-y-2 text-xs text-slate-600 font-medium pt-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                <span>Executive Decision Dashboard</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                <span>Automated Cartel & Collusion Detection</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                <span>Vigilance & Audit Trail Reports</span>
              </li>
            </ul>
          </div>

          <div className="pt-6">
            {user?.role === 'government' ? (
              <Button
                variant="gov"
                size="lg"
                className="w-full justify-between bg-[#002B49]"
                icon={ArrowRight}
                iconPosition="right"
                onClick={() => onNavigate('/government/dashboard')}
              >
                Open Government Portal
              </Button>
            ) : (
              <Button
                variant="outline"
                size="md"
                className="w-full justify-center"
                onClick={() => onNavigate('/login?portal=government')}
              >
                Sign In with Government ID
              </Button>
            )}
          </div>
        </Card>

        {/* 2. Agency Workspace Card (Only active/available for Agency users) */}
        <Card
          variant="elevated"
          className={`p-7 flex flex-col justify-between border-t-4 ${
            user?.role === 'agency'
              ? 'border-t-emerald-600 bg-white ring-2 ring-emerald-100 shadow-md'
              : 'border-t-slate-300 bg-slate-50 opacity-70'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  user?.role === 'agency'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                <Building2 className="w-6 h-6" />
              </div>

              {user?.role === 'agency' ? (
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Authorized Workspace
                </span>
              ) : (
                <span className="text-[11px] font-bold text-slate-500 bg-slate-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Restricted (Agency Only)
                </span>
              )}
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">Agency & Vendor Workspace</h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Discover live tenders, prepare and submit transparent proposals, upload geo-tagged milestone proofs, and claim disbursements.
              </p>
            </div>

            <ul className="space-y-2 text-xs text-slate-600 font-medium pt-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>MPLAD Scheme Tender Discovery</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Proposal Drafting & AI Compliance Check</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Geo-Tagged Milestone Evidence Submissions</span>
              </li>
            </ul>
          </div>

          <div className="pt-6">
            {user?.role === 'agency' ? (
              <Button
                variant="gov"
                size="lg"
                className="w-full justify-between bg-emerald-700 hover:bg-emerald-800 text-white"
                icon={ArrowRight}
                iconPosition="right"
                onClick={() => onNavigate('/agency/dashboard')}
              >
                Open Agency Workspace
              </Button>
            ) : (
              <Button
                variant="outline"
                size="md"
                className="w-full justify-center"
                onClick={() => onNavigate('/login?portal=agency')}
              >
                Sign In with Agency ID
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Public Hub Alternative Link */}
      <div className="p-5 bg-white rounded-xl border border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">Looking for Public Transparency Data?</div>
            <div className="text-xs text-slate-500">
              Browse public records, parliamentary fund allocations, and national GIS map without authentication.
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="md"
          className="border-orange-300 text-orange-950 hover:bg-orange-50 shrink-0"
          icon={ExternalLink}
          iconPosition="right"
          onClick={() => onNavigate('/transparency')}
        >
          Explore Public Data
        </Button>
      </div>
    </div>
  );
};
