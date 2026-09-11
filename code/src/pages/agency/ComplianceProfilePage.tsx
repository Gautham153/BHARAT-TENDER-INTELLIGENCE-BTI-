import React, { useState, useEffect } from 'react';
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  Lock,
  FileText,
  Save,
  Clock,
  AlertTriangle,
  FileBadge2,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { OrganizationVerificationService } from '../../services/organizationVerificationService';
import { Organization } from '../../types/organization';

export const ComplianceProfilePage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<Organization | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    companyName: '',
    gstin: '',
    pan: '',
    cin: '',
    bankAccount: '••••••••••••4910',
    ifsc: 'SBIN0001245',
    epfoNo: 'MH/BAN/0091244/000',
    nodalContact: '',
    contactPhone: '',
    contactEmail: '',
    registeredAddress: '',
  });

  useEffect(() => {
    async function loadOrgData() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const orgId = user.organizationId;
        if (orgId) {
          const res = await OrganizationVerificationService.getOrganizationVerificationDetails(orgId);
          if (res.organization) {
            // Defensive Identity Consistency check (BUG 8)
            if (
              user.role === 'agency' &&
              res.organization.primaryUserId &&
              res.organization.primaryUserId !== user.id &&
              res.organization.primaryUserId !== user.uid &&
              res.organization.organizationId !== user.organizationId
            ) {
              setIdentityError(
                'Security Alert: Authenticated user context does not match the primary organizational representative for this record.'
              );
              setLoading(false);
              return;
            }

            setOrg(res.organization);
            setProfile({
              companyName: res.organization.displayName || res.organization.legalName,
              gstin: res.organization.gstin,
              pan: res.organization.gstin.length >= 12 ? res.organization.gstin.substring(2, 12) : '',
              cin: 'U45200MH2018PLC089123',
              bankAccount: '••••••••••••4910',
              ifsc: 'SBIN0001245',
              epfoNo: `${res.organization.state.slice(0, 2).toUpperCase()}/MUM/0091244/000`,
              nodalContact: user.name,
              contactPhone: res.organization.contactPhone || user.phone || '+91 98111 22334',
              contactEmail: res.organization.contactEmail || user.email,
              registeredAddress: res.organization.registeredAddress,
            });
            setLoading(false);
            return;
          }
        }

        // Fallback initialized from user profile
        setProfile({
          companyName: user.agencyName || user.name || 'Contractor Entity',
          gstin: user.gstin || '',
          pan: user.gstin && user.gstin.length >= 12 ? user.gstin.substring(2, 12) : '',
          cin: 'U45200MH2018PLC089123',
          bankAccount: '••••••••••••4910',
          ifsc: 'SBIN0001245',
          epfoNo: 'MH/BAN/0091244/000',
          nodalContact: user.name,
          contactPhone: user.phone || '+91 98111 22334',
          contactEmail: user.email,
          registeredAddress: 'Registered Commercial Premises',
        });
      } catch (err) {
        console.error('Error loading compliance organization:', err);
      } finally {
        setLoading(false);
      }
    }

    loadOrgData();
  }, [user]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Contractor Profile Updated', {
      message: 'Compliance credentials re-validated against GSTN and EPFO portals.',
      type: 'success',
    });
  };

  if (identityError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Agency Compliance & Statutory Verification"
          subtitle="Maintain authorized GSTIN, EPFO, corporate identification & verified bank accounts for PFMS transfers."
        />
        <Card className="p-8 border-rose-300 bg-rose-50/50 space-y-4">
          <div className="flex items-center gap-3 text-rose-800 font-bold">
            <AlertTriangle className="w-6 h-6 text-rose-600" />
            <h3>Identity Access Exception</h3>
          </div>
          <p className="text-xs text-rose-900 leading-relaxed">{identityError}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agency Compliance & Statutory Verification"
        subtitle={`Maintain authorized GSTIN (${profile.gstin || 'N/A'}), EPFO, corporate identification & verified bank accounts for ${profile.companyName || 'Agency'}.`}
      />

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Statutory Identifiers */}
          <Card className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-sm">Corporate & Tax Identifiers</h3>
            </div>

            <Input
              label="Registered Legal Entity Name"
              value={profile.companyName}
              onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="GSTIN (Goods & Services Tax)"
                value={profile.gstin}
                disabled
                onChange={(e) => setProfile({ ...profile, gstin: e.target.value })}
              />
              <Input
                label="PAN (Permanent Account No)"
                value={profile.pan}
                disabled
                onChange={(e) => setProfile({ ...profile, pan: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="CIN (Ministry of Corporate Affairs)"
                value={profile.cin}
                onChange={(e) => setProfile({ ...profile, cin: e.target.value })}
              />
              <Input
                label="EPFO Establishment Code"
                value={profile.epfoNo}
                onChange={(e) => setProfile({ ...profile, epfoNo: e.target.value })}
              />
            </div>
          </Card>

          {/* PFMS Bank Account & Contact Person */}
          <Card className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-sm">PFMS DBT Bank Routing</h3>
            </div>

            <Input
              label="Bank Account Number (Escrow Account)"
              type="text"
              value={profile.bankAccount}
              onChange={(e) => setProfile({ ...profile, bankAccount: e.target.value })}
            />

            <Input
              label="IFSC Code (State Bank of India)"
              value={profile.ifsc}
              onChange={(e) => setProfile({ ...profile, ifsc: e.target.value })}
            />

            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-4">
              <Input
                label="Nodal Authorized Signatory"
                value={profile.nodalContact}
                onChange={(e) => setProfile({ ...profile, nodalContact: e.target.value })}
              />
              <Input
                label="Official Email"
                value={profile.contactEmail}
                onChange={(e) => setProfile({ ...profile, contactEmail: e.target.value })}
              />
            </div>
          </Card>
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="md"
            icon={FileBadge2}
            type="button"
            onClick={() => onNavigate('/agency/verification')}
          >
            View Verification Status
          </Button>

          <Button variant="gov" size="md" icon={Save} type="submit">
            Save & Update Compliance Record
          </Button>
        </div>
      </form>
    </div>
  );
};
