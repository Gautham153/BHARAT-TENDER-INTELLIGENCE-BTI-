import React from 'react';
import { ShieldAlert, ArrowRight, Home, LogOut, Clock, FileText } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { VerificationBadge } from './VerificationBadge';
import { useAuth } from '../../context/AuthContext';
import { AuthRole } from '../../types/auth';

export interface AccessDeniedProps {
  requiredRole: AuthRole;
  reason?: 'role_mismatch' | 'verification_pending';
  currentPath?: string;
  onNavigate: (path: string) => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  requiredRole,
  reason,
  onNavigate,
}) => {
  const { user, logout } = useAuth();

  const isVerificationPending =
    reason === 'verification_pending' ||
    (user?.role === 'agency' && (!user.verified || user.verificationStatus !== 'verified'));

  const getAuthorizedPortalPath = (): string => {
    if (user?.role === 'government') return '/government/dashboard';
    if (user?.role === 'agency' && user.verified && user.verificationStatus === 'verified') {
      return '/agency/dashboard';
    }
    return '/transparency';
  };

  const getAuthorizedPortalName = (): string => {
    if (user?.role === 'government') return 'Government Portal';
    if (user?.role === 'agency' && user.verified && user.verificationStatus === 'verified') {
      return 'Agency Workspace';
    }
    return 'Public Transparency Hub';
  };

  const handleLogoutAndSwitch = async () => {
    await logout();
    onNavigate('/login');
  };

  // Dedicated Pending Agency Verification UI
  if (isVerificationPending) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <Card className="max-w-lg w-full p-8 border-slate-300 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto shadow-2xs">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-800 bg-amber-100/80 border border-amber-200 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-700" />
              Verification Pending
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-2">
              Agency Verification Still Pending
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
              Your organization has been registered, but statutory verification by the District Nodal Officer has not yet been completed. Full Agency Workspace access remains locked until verification is complete.
            </p>
          </div>

          {/* Pending Organization Summary */}
          {user && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="text-slate-500 font-medium">Organization Application</div>
                <VerificationBadge status={user.verificationStatus || 'pending'} size="sm" />
              </div>

              <div className="space-y-1.5">
                <div className="font-bold text-slate-900 text-sm">
                  {user.agencyName || user.name}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-slate-600">
                  {user.gstin && (
                    <span className="font-mono text-[11px] bg-slate-200/80 px-2 py-0.5 rounded text-slate-800">
                      GSTIN: {user.gstin}
                    </span>
                  )}
                  {user.applicationId && (
                    <span className="font-mono text-[11px] bg-blue-100/80 px-2 py-0.5 rounded text-blue-900">
                      App ID: {user.applicationId}
                    </span>
                  )}
                  <span className="truncate text-slate-500">{user.email}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 leading-relaxed">
                Once the District Nodal Officer confirms your statutory GSTIN and business credentials, tender bidding, milestone submissions, and payment claims will be enabled.
              </p>
            </div>
          )}

          {/* Action Controls */}
          <div className="space-y-3 pt-2">
            <Button
              variant="gov"
              size="lg"
              className="w-full justify-center bg-[#002B49] hover:bg-[#003B64]"
              icon={ArrowRight}
              iconPosition="right"
              onClick={() => onNavigate('/agency/verification')}
            >
              View Verification Status & Next Steps
            </Button>

            <Button
              variant="outline"
              size="md"
              className="w-full justify-center border-slate-300"
              icon={ArrowRight}
              onClick={() => onNavigate('/transparency')}
            >
              Return to Public Transparency Hub
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center border-slate-300"
                icon={Home}
                onClick={() => onNavigate('/')}
              >
                Public Home
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center text-slate-700 hover:text-rose-700"
                icon={LogOut}
                onClick={handleLogoutAndSwitch}
              >
                Sign Out
              </Button>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            Security Ref: STATUTORY_GATE_403 • Verification Incomplete
          </div>
        </Card>
      </div>
    );
  }

  // Standard Role Mismatch Access Denied UI
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <Card className="max-w-lg w-full p-8 border-slate-300 shadow-sm text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center mx-auto shadow-2xs">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-rose-700 bg-rose-100/70 px-2.5 py-1 rounded-full">
            Access Restricted
          </span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-2">
            Authorization Required
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            {requiredRole === 'government'
              ? 'This section is restricted to authorized Government Nodal Officers, District Collectors, and statutory vigilance personnel.'
              : 'This section is reserved for verified executing agencies and contractors.'}
          </p>
        </div>

        {/* User Identity Box */}
        {user && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-2 text-xs">
            <div className="text-slate-500 font-medium">Currently signed in as:</div>
            <div className="font-bold text-slate-900 text-sm">{user.name}</div>
            <div className="flex items-center gap-2 text-slate-600">
              <span className="font-mono text-[11px] bg-slate-200/80 px-2 py-0.5 rounded">
                Role: {user.role.toUpperCase()}
              </span>
              <span>•</span>
              <span className="truncate">{user.email}</span>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="space-y-3 pt-2">
          <Button
            variant="gov"
            size="lg"
            className="w-full justify-center bg-[#002B49]"
            icon={ArrowRight}
            iconPosition="right"
            onClick={() => onNavigate(getAuthorizedPortalPath())}
          >
            Go to {getAuthorizedPortalName()}
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="md"
              className="w-full justify-center"
              icon={Home}
              onClick={() => onNavigate('/')}
            >
              Public Home
            </Button>
            <Button
              variant="ghost"
              size="md"
              className="w-full justify-center text-slate-700 hover:text-rose-700"
              icon={LogOut}
              onClick={handleLogoutAndSwitch}
            >
              Sign In Different Account
            </Button>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 font-mono">
          Security Ref: ERR_ROLE_MISMATCH_403 • Bharat Tender Intelligence
        </div>
      </Card>
    </div>
  );
};
