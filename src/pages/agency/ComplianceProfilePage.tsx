import React, { useState } from 'react';
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  Lock,
  FileText,
  Save,
  Clock,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../context/ToastContext';

export const ComplianceProfilePage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [profile, setProfile] = useState({
    companyName: 'Vikramaditya Infrastructure Ltd',
    gstin: '09AABCV9821L1ZS',
    pan: 'AABCV9821L',
    cin: 'U45200UP2016PLC089123',
    bankAccount: '9812002100049102',
    ifsc: 'SBIN0001245',
    epfoNo: 'UP/VNS/0091244/000',
    nodalContact: 'Er. Rajesh V. Sharma',
    contactPhone: '+91 98390 12845',
    contactEmail: 'contact@vikramadityainfra.co.in',
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Contractor Profile Updated', {
      message: 'Compliance credentials re-validated against GSTN and EPFO portals.',
      type: 'success',
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agency Compliance & Statutory Verification"
        subtitle="Maintain authorized GSTIN, EPFO, corporate identification & verified bank accounts for PFMS transfers."
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
                onChange={(e) => setProfile({ ...profile, gstin: e.target.value })}
              />
              <Input
                label="PAN (Permanent Account No)"
                value={profile.pan}
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
              type="password"
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

        <div className="flex justify-end">
          <Button variant="gov" size="md" icon={Save} type="submit">
            Save & Update Compliance Record
          </Button>
        </div>
      </form>
    </div>
  );
};
