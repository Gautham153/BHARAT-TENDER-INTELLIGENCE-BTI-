import React, { useState } from 'react';
import {
  ShieldCheck,
  Building2,
  Users,
  ArrowRight,
  Lock,
  Landmark,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BtiLogo } from '../../components/common/BtiLogo';
import { SyntheticDataNotice } from '../../components/common/SyntheticDataNotice';

export interface LoginPageProps {
  onNavigate: (path: string) => void;
  onLoginAsRole?: (role: 'government' | 'agency' | 'public') => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate, onLoginAsRole }) => {
  const [selectedRole, setSelectedRole] = useState<'government' | 'agency' | 'public'>('government');

  const handleLogin = () => {
    if (onLoginAsRole) {
      onLoginAsRole(selectedRole);
    }
    if (selectedRole === 'government') {
      onNavigate('/government/dashboard');
    } else if (selectedRole === 'agency') {
      onNavigate('/agency/dashboard');
    } else {
      onNavigate('/transparency');
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-8 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo & Heading */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <BtiLogo size="lg" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-3">
            Sign In to Bharat Tender Intelligence
          </h2>
          <p className="text-xs text-slate-500">
            Secure Single Sign-On for District Nodal Officers, Contractors & Auditors
          </p>
        </div>

        {/* Synthetic Notice */}
        <SyntheticDataNotice variant="inline" />

        {/* Role Selector Tabs Card */}
        <Card className="p-6 space-y-5 border-slate-300 shadow-sm">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Select Demo Role Profile
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedRole('government')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  selectedRole === 'government'
                    ? 'border-[#002B49] bg-blue-50/70 text-[#002B49] shadow-2xs font-bold'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Landmark className="w-5 h-5 mx-auto mb-1 text-[#002B49]" />
                <div className="text-[11px]">Nodal Officer</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('agency')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  selectedRole === 'agency'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-800 shadow-2xs font-bold'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-5 h-5 mx-auto mb-1 text-emerald-700" />
                <div className="text-[11px]">Contractor</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('public')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  selectedRole === 'public'
                    ? 'border-amber-600 bg-amber-50/70 text-amber-800 shadow-2xs font-bold'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Users className="w-5 h-5 mx-auto mb-1 text-amber-700" />
                <div className="text-[11px]">Citizen Audit</div>
              </button>
            </div>
          </div>

          {/* Role Preview Details Box */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                {selectedRole === 'government'
                  ? 'District Nodal Officer / DM Profile'
                  : selectedRole === 'agency'
                  ? 'Vikramaditya Infra (Tier-1 Contractor)'
                  : 'Citizen / Social Audit Researcher'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {selectedRole === 'government'
                ? 'Full access to tender management, AI bid evaluations, anomaly triage, and CBI/CVC case dossiers.'
                : selectedRole === 'agency'
                ? 'Access to live bidding portal, encrypted proposal submission, and geo-tagged milestone uploads.'
                : 'Access to public transparency records, parliamentary fund trackers, and whistleblower grievance desk.'}
            </p>
          </div>

          <Button
            variant="gov"
            size="lg"
            className="w-full justify-center"
            icon={ArrowRight}
            iconPosition="right"
            onClick={handleLogin}
          >
            Enter {selectedRole === 'government' ? 'Government Portal' : selectedRole === 'agency' ? 'Agency Workspace' : 'Public Portal'}
          </Button>

          <div className="text-center text-[11px] text-slate-400 font-mono">
            National Informatics Centre (NIC) • Single Sign-On Gateway (e-Pramaan)
          </div>
        </Card>
      </div>
    </div>
  );
};
