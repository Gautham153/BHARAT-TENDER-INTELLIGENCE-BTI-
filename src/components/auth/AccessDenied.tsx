import React from 'react';
import { ShieldAlert, ArrowRight, Home, LogOut } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { AuthRole } from '../../types/auth';

export interface AccessDeniedProps {
  requiredRole: AuthRole;
  currentPath?: string;
  onNavigate: (path: string) => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  requiredRole,
  onNavigate,
}) => {
  const { user, logout } = useAuth();

  const getAuthorizedPortalPath = (): string => {
    if (user?.role === 'government') return '/government/dashboard';
    if (user?.role === 'agency') return '/agency/dashboard';
    return '/transparency';
  };

  const getAuthorizedPortalName = (): string => {
    if (user?.role === 'government') return 'Government Portal';
    if (user?.role === 'agency') return 'Agency Workspace';
    return 'Public Transparency Hub';
  };

  const handleLogoutAndSwitch = async () => {
    await logout();
    onNavigate('/login');
  };

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
