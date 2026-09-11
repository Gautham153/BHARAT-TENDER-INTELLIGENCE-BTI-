import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuthRole } from '../../types/auth';
import { AccessDenied } from './AccessDenied';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { BtiLogo } from '../common/BtiLogo';
import { Lock, ArrowRight, Home } from 'lucide-react';
import { SyntheticDataNotice } from '../common/SyntheticDataNotice';

export interface ProtectedRouteProps {
  requiredRole: AuthRole;
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredRole,
  currentPath,
  onNavigate,
  children,
}) => {
  const { user, status, isAuthenticated } = useAuth();

  // 1. Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-10 h-10 rounded-full border-3 border-blue-100 border-t-[#002B49] animate-spin" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Verifying BTI Security Session...
        </p>
      </div>
    );
  }

  // 2. Unauthenticated state — Direct clean authentication prompt with contextual portal information
  if (!isAuthenticated || !user) {
    const portalName = requiredRole === 'government' ? 'Government & Nodal Portal' : 'Agency Workspace';

    return (
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 bg-slate-50">
        <Card className="max-w-md w-full p-8 border-slate-300 shadow-sm text-center space-y-6">
          <div className="flex justify-center">
            <BtiLogo size="md" />
          </div>

          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 text-[#002B49] flex items-center justify-center mx-auto shadow-2xs">
            <Lock className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#002B49] bg-blue-100/70 px-2.5 py-1 rounded-full">
              Authentication Required
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Sign In to Access {portalName}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {requiredRole === 'government'
                ? 'Authorized government personnel, Nodal Officers, and District Collectors must sign in to view administrative dossiers and audit controls.'
                : 'Registered executing agencies and contractors must sign in with verified credentials to participate in tenders and view milestones.'}
            </p>
          </div>

          <SyntheticDataNotice variant="inline" />

          <div className="space-y-3 pt-2">
            <Button
              variant="gov"
              size="lg"
              className="w-full justify-center bg-[#002B49]"
              icon={ArrowRight}
              iconPosition="right"
              onClick={() => onNavigate(`/login?portal=${requiredRole}`)}
            >
              Sign In with Institutional ID
            </Button>

            {requiredRole === 'agency' && (
              <Button
                variant="outline"
                size="md"
                className="w-full justify-center border-slate-300"
                onClick={() => onNavigate('/register/agency')}
              >
                Register Your Organization
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-slate-600"
              icon={Home}
              onClick={() => onNavigate('/')}
            >
              Return to Public Portal
            </Button>
          </div>

          <div className="text-[10px] text-slate-400 font-mono">
            Security Gate: AUTH_REQUIRED_401 • BTI Architecture
          </div>
        </Card>
      </div>
    );
  }

  // 3. Unauthorized Role Mismatch
  if (user.role !== requiredRole) {
    return (
      <AccessDenied
        requiredRole={requiredRole}
        reason="role_mismatch"
        currentPath={currentPath}
        onNavigate={onNavigate}
      />
    );
  }

  // 4. Agency Statutory Verification & Operational Access Gate
  // Operational routes (dashboard, tenders, proposals, milestones, disbursements) require BOTH verified === true AND verificationStatus === 'verified'
  // Status & compliance review routes (/agency/verification, /agency/compliance) are accessible to pending/unverified agency users
  if (requiredRole === 'agency') {
    const STATUS_AND_ONBOARDING_ROUTES = ['/agency/verification', '/agency/compliance'];
    const isStatusOrOnboardingRoute = STATUS_AND_ONBOARDING_ROUTES.includes(currentPath);
    const isFullyVerified = Boolean(user.verified && user.verificationStatus === 'verified');

    if (!isFullyVerified && !isStatusOrOnboardingRoute) {
      return (
        <AccessDenied
          requiredRole="agency"
          reason="verification_pending"
          currentPath={currentPath}
          onNavigate={onNavigate}
        />
      );
    }
  }

  // 5. Authorized
  return <>{children}</>;
};
