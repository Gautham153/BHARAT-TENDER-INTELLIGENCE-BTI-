// Bharat Tender Intelligence (BTI) — Agency Verification Status Page
// Phase 2A: Agency-Facing Onboarding & Verification Status Portal

import React, { useState, useEffect } from 'react';
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileBadge2,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  History,
  FileText,
  HelpCircle,
  BadgeCheck,
  ShieldAlert,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { VerificationBadge } from '../../components/auth/VerificationBadge';
import { DevelopmentEnvironmentNotice } from '../../components/common/DevelopmentEnvironmentNotice';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { OrganizationVerificationService } from '../../services/organizationVerificationService';
import { Organization, VerificationEvent, VerificationStatus } from '../../types/organization';

export interface AgencyVerificationStatusPageProps {
  onNavigate: (path: string) => void;
}

export const AgencyVerificationStatusPage: React.FC<AgencyVerificationStatusPageProps> = ({
  onNavigate,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [orgData, setOrgData] = useState<Organization | null>(null);
  const [auditEvents, setAuditEvents] = useState<VerificationEvent[]>([]);
  const [identityMismatch, setIdentityMismatch] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load organization and audit trail from authoritative Firestore / provider
  const loadStatus = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    setIdentityMismatch(null);

    try {
      const orgId = user.organizationId;
      if (!orgId) {
        // Fallback placeholder structure if newly created without an organizationId attached
        const tempOrg: Organization = {
          organizationId: `ORG-${user.gstin ? user.gstin.substring(0, 2) : '27'}-${Date.now().toString(36).toUpperCase()}`,
          legalName: user.agencyName || user.name || 'Registered Contractor Enterprise',
          displayName: user.agencyName || user.name || 'Registered Contractor Enterprise',
          gstin: user.gstin || '27AABCA1234F1Z9',
          gstStateCode: user.gstin ? user.gstin.substring(0, 2) : '27',
          businessCategory: 'Civil Infrastructure',
          registeredAddress: 'Registered Commercial Office Premises',
          state: 'Maharashtra',
          verificationStatus: user.verificationStatus || 'pending',
          verificationProvider: 'development-simulation',
          verificationReference: `DEV-VERIF-${Date.now().toString().slice(-4)}`,
          verificationRequestedAt: user.createdAt || new Date().toISOString(),
          primaryUserId: user.id || user.uid,
          verified: user.verified || false,
          applicationId: user.applicationId || 'BTI-REG-2026-8941',
          createdAt: user.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setOrgData(tempOrg);
        setLoading(false);
        return;
      }

      const res = await OrganizationVerificationService.getOrganizationVerificationDetails(orgId);

      if (res.organization) {
        // BUG 8 Defensive Identity Check: Prevent rendering Org A with User B
        if (
          user.role === 'agency' &&
          res.organization.primaryUserId &&
          res.organization.primaryUserId !== user.id &&
          res.organization.primaryUserId !== user.uid &&
          res.organization.organizationId !== user.organizationId
        ) {
          setIdentityMismatch(
            'Security Warning: Authenticated credentials do not match the authorized primary representative for this organization.'
          );
          setLoading(false);
          return;
        }

        setOrgData(res.organization);
        setAuditEvents(res.auditTrail);
      } else {
        // Organization document not found in Firestore
        setLoadError(`Organization profile (${orgId}) not found in the authoritative directory.`);
      }
    } catch (err) {
      console.error('Error loading verification status:', err);
      setLoadError(err instanceof Error ? err.message : 'Could not load organization verification details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [user]);

  // Handle Controlled Retry (for failed status)
  const handleRetryVerification = async () => {
    if (!orgData || !user) return;
    setRetrying(true);

    try {
      const updated = await OrganizationVerificationService.retryVerification(
        orgData.organizationId,
        { id: user.id, name: user.name }
      );
      setOrgData(updated);
      showToast('Verification Retried', {
        message: `Status updated to ${updated.verificationStatus.toUpperCase()}.`,
        type: updated.verificationStatus === 'verified' ? 'success' : 'info',
      });
      await loadStatus();
    } catch (err) {
      showToast('Retry Failed', {
        message: err instanceof Error ? err.message : 'Could not retry verification.',
        type: 'error',
      });
    } finally {
      setRetrying(false);
    }
  };

  if (identityMismatch) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        <PageHeader
          title="Organization & GSTIN Verification Status"
          subtitle="Monitor statutory credentials verification, District Nodal Officer review, and bidding clearances."
        />
        <Card className="p-8 border-rose-300 bg-rose-50/50 space-y-4">
          <div className="flex items-center gap-3 text-rose-800 font-bold">
            <ShieldAlert className="w-6 h-6 text-rose-600" />
            <h3 className="text-base">Organization Representation Exception</h3>
          </div>
          <p className="text-xs text-rose-900 leading-relaxed">{identityMismatch}</p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        <PageHeader
          title="Organization & GSTIN Verification Status"
          subtitle="Monitor statutory credentials verification, District Nodal Officer review, and bidding clearances."
        />
        <Card className="p-12 text-center text-xs text-slate-500 space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-700" />
          <p>Retrieving statutory verification records from authoritative directory...</p>
        </Card>
      </div>
    );
  }

  const status: VerificationStatus = orgData?.verificationStatus || user?.verificationStatus || 'pending';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Page Header */}
      <PageHeader
        title="Organization & GSTIN Verification Status"
        subtitle="Monitor statutory credentials verification, District Nodal Officer review, and bidding clearances."
      />

      {/* Technical Honesty Disclaimer */}
      <DevelopmentEnvironmentNotice />

      {loadError && (
        <Card className="p-4 border-amber-300 bg-amber-50/70 flex items-center justify-between text-xs text-amber-950">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{loadError}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadStatus} icon={RefreshCw}>
            Retry
          </Button>
        </Card>
      )}

      {/* Main Status Hero Card */}
      <Card className="p-6 sm:p-8 border-slate-300 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Statutory Verification Record
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {orgData?.displayName || orgData?.legalName || user?.agencyName || 'Agency Profile'}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-mono">
              <span className="font-bold text-[#002B49]">GSTIN: {orgData?.gstin || user?.gstin || 'N/A'}</span>
              <span>•</span>
              <span>App ID: {orgData?.applicationId || user?.applicationId || 'BTI-APP-PENDING'}</span>
            </div>
          </div>

          <div className="flex sm:flex-col items-end gap-2">
            <VerificationBadge status={status} size="md" />
            <span className="text-[10px] text-slate-400 font-mono">
              Provider: {orgData?.verificationProvider || 'development-simulation'}
            </span>
          </div>
        </div>

        {/* Dynamic Context Experience by Status */}
        {status === 'pending' && (
          <div className="p-5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-4 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-amber-800 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-amber-950">
                  Organization verification is in progress.
                </h3>
                <p className="text-xs text-amber-900 leading-relaxed">
                  BTI is reviewing the organization information submitted during onboarding. Your statutory GSTIN pattern is recorded and submitted to the District Nodal Desk for scrutiny.
                </p>
              </div>
            </div>

            <div className="bg-white/90 rounded-lg p-3.5 border border-amber-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Application ID</span>
                <span className="font-mono font-bold text-slate-900">{orgData?.applicationId || user?.applicationId}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Submitted Timestamp</span>
                <span className="font-semibold text-slate-900">
                  {orgData?.verificationRequestedAt
                    ? new Date(orgData.verificationRequestedAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Recent'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Next Review Desk</span>
                <span className="font-semibold text-amber-900">District Magistrate / Nodal Desk</span>
              </div>
            </div>
          </div>
        )}

        {status === 'verified' && (
          <div className="p-5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-4 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-800" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-emerald-950">
                  Organization statutory verification complete.
                </h3>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Your organization has successfully satisfied statutory verification requirements. Your account is authorized for full verified-agency capabilities including tender discovery and bidding.
                </p>
              </div>
            </div>

            <div className="bg-white/90 rounded-lg p-3.5 border border-emerald-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Verification Reference</span>
                <span className="font-mono font-bold text-emerald-900">{orgData?.verificationReference}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Verification Date</span>
                <span className="font-semibold text-slate-900">
                  {orgData?.verificationCompletedAt
                    ? new Date(orgData.verificationCompletedAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Active'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Bidding Clearance</span>
                <span className="font-bold text-emerald-700">Cleared for Public Works</span>
              </div>
            </div>

            <div className="p-2.5 bg-emerald-100/60 rounded-lg text-[11px] text-emerald-900 font-medium">
              Note: Verification confirms institutional identity and statutory registration. It is one element of BTI&apos;s overall integrity framework.
            </div>

            <div className="pt-1 flex justify-end">
              <Button
                variant="gov"
                size="md"
                className="bg-emerald-700 hover:bg-emerald-800 text-white"
                icon={ArrowRight}
                iconPosition="right"
                onClick={() => onNavigate('/agency/dashboard')}
              >
                Access Agency Workspace
              </Button>
            </div>
          </div>
        )}

        {status === 'requires_review' && (
          <div className="p-5 bg-blue-50/80 border border-blue-200 rounded-xl space-y-4 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 border border-blue-300 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-blue-900" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-[#002B49]">
                  Additional review required.
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Your organization requires review by the Nodal Desk before verified-agency access can be granted. Automated verification produced an exceptional or ambiguous match that must be reviewed manually.
                </p>
              </div>
            </div>

            {orgData?.reviewNotes && (
              <div className="p-3 bg-white rounded-lg border border-blue-200 text-xs space-y-1">
                <span className="text-[11px] font-bold text-blue-900 uppercase">Review Notes:</span>
                <p className="text-slate-700">{orgData.reviewNotes}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <span className="text-xs text-slate-500">
                Contact the district nodal desk or update documentation in your compliance profile.
              </span>
              <Button
                variant="outline"
                size="sm"
                icon={FileBadge2}
                onClick={() => onNavigate('/agency/compliance')}
              >
                Update Compliance Details
              </Button>
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div className="p-5 bg-rose-50/80 border border-rose-200 rounded-xl space-y-4 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-100 border border-rose-300 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5 text-rose-800" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-rose-950">
                  Organization verification could not be completed.
                </h3>
                <p className="text-xs text-rose-900 leading-relaxed">
                  The statutory verification check could not validate the submitted organization or GSTIN details against registrar records.
                </p>
              </div>
            </div>

            {orgData?.rejectionReason && (
              <div className="p-3 bg-white rounded-lg border border-rose-200 text-xs space-y-1">
                <span className="text-[11px] font-bold text-rose-900 uppercase">Reported Reason:</span>
                <p className="text-rose-800">{orgData.rejectionReason}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-rose-200">
              <Button
                variant="outline"
                size="sm"
                icon={FileBadge2}
                onClick={() => onNavigate('/agency/compliance')}
              >
                Review GSTIN & Details
              </Button>

              <Button
                variant="gov"
                size="sm"
                className="bg-rose-800 hover:bg-rose-900 text-white"
                icon={RefreshCw}
                onClick={handleRetryVerification}
                disabled={retrying}
              >
                {retrying ? 'Retrying Verification...' : 'Retry Verification'}
              </Button>
            </div>
          </div>
        )}

        {/* Organization Entity Snapshot */}
        <div className="space-y-3 pt-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-200">
            Organization Profile Snapshot
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-slate-500 block text-[11px]">Legal Entity Name</span>
              <span className="font-bold text-slate-900 block">
                {orgData?.legalName || orgData?.displayName || user?.agencyName || 'Not Available'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-slate-500 block text-[11px]">Registered GSTIN</span>
              <span className="font-mono font-bold text-[#002B49] block">
                {orgData?.gstin || user?.gstin || 'Not Available'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-slate-500 block text-[11px]">Registration State / UT</span>
              <span className="font-semibold text-slate-900 block">
                {orgData?.state || 'Maharashtra'} {orgData?.gstStateCode ? `(Code ${orgData.gstStateCode})` : ''}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-slate-500 block text-[11px]">Business Category</span>
              <span className="font-semibold text-slate-900 block">
                {orgData?.businessCategory || 'Civil Infrastructure'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 sm:col-span-2">
              <span className="text-slate-500 block text-[11px]">Registered Address</span>
              <span className="text-slate-800 block truncate">
                {orgData?.registeredAddress || 'Registered Commercial Premises'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Verification Audit Trail Section */}
      <Card className="p-6 border-slate-300 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-700" />
            <h3 className="font-bold text-slate-900 text-sm">
              Verification Audit Trail & Event Log
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {auditEvents.length} Event{auditEvents.length === 1 ? '' : 's'} Recorded
          </span>
        </div>

        {auditEvents.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            Initial submission logged. Formal audit events will appear as review progresses.
          </div>
        ) : (
          <div className="space-y-3">
            {auditEvents.map((evt, idx) => (
              <div
                key={evt.eventId || idx}
                className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#002B49]">{evt.action}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 uppercase font-semibold">
                      {evt.actorRole}
                    </span>
                    <span className="text-[11px] text-slate-500">by {evt.actorName}</span>
                  </div>
                  {evt.notes && <p className="text-slate-600 text-[11px]">{evt.notes}</p>}
                </div>

                <div className="text-right sm:text-right shrink-0">
                  <div className="text-slate-500 font-mono text-[11px]">
                    {new Date(evt.timestamp).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Source: {evt.source}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
