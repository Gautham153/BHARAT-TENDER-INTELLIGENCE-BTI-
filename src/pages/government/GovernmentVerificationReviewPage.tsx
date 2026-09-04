// Bharat Tender Intelligence (BTI) — Government Verification Review Desk
// Phase 2A: Nodal Officer Scrutiny & Organization Verification Authorization

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  FileBadge2,
  FileText,
  UserCheck,
  History,
  Eye,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { VerificationBadge } from '../../components/auth/VerificationBadge';
import { DevelopmentEnvironmentNotice } from '../../components/common/DevelopmentEnvironmentNotice';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { OrganizationVerificationService } from '../../services/organizationVerificationService';
import {
  Organization,
  VerificationStatus,
  VerificationEvent,
} from '../../types/organization';

export interface GovernmentVerificationReviewPageProps {
  onNavigate?: (path: string) => void;
}

export const GovernmentVerificationReviewPage: React.FC<GovernmentVerificationReviewPageProps> = ({
  onNavigate,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [auditTrail, setAuditTrail] = useState<VerificationEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Action Modal State
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    type: 'APPROVE' | 'REQUIRE_REVIEW' | 'REJECT';
    org: Organization | null;
  }>({
    isOpen: false,
    type: 'APPROVE',
    org: null,
  });
  const [actionNotes, setActionNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Load Organization Queue
  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await OrganizationVerificationService.listOrganizations(
        statusFilter === 'all' ? undefined : statusFilter
      );
      setOrganizations(list);
      if (list.length > 0) {
        const stillSelected = selectedOrg ? list.find((o) => o.organizationId === selectedOrg.organizationId) : null;
        const toSelect = stillSelected || list[0];
        setSelectedOrg(toSelect);
        loadOrgAudit(toSelect.organizationId);
      } else {
        setSelectedOrg(null);
        setAuditTrail([]);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[BTI Gov Review Queue] Error loading verification queue:', err);
      setError(errMsg);
      setOrganizations([]);
      setSelectedOrg(null);
      setAuditTrail([]);
    } finally {
      setLoading(false);
    }
  };

  const loadOrgAudit = async (orgId: string) => {
    try {
      const res = await OrganizationVerificationService.getOrganizationVerificationDetails(orgId);
      setAuditTrail(res.auditTrail);
    } catch (err) {
      console.error('Error loading audit trail:', err);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [statusFilter]);

  const handleSelectOrg = (org: Organization) => {
    setSelectedOrg(org);
    loadOrgAudit(org.organizationId);
  };

  // Filtered organizations by search
  const filteredOrgs = organizations.filter((org) => {
    const q = searchQuery.toLowerCase();
    return (
      org.legalName.toLowerCase().includes(q) ||
      org.gstin.toLowerCase().includes(q) ||
      org.organizationId.toLowerCase().includes(q) ||
      org.state.toLowerCase().includes(q) ||
      (org.applicationId && org.applicationId.toLowerCase().includes(q))
    );
  });

  // Handle Review Submission
  const handleExecuteAction = async () => {
    if (!actionModal.org || !user) return;
    setSubmittingAction(true);

    try {
      let targetStatus: VerificationStatus = 'verified';
      if (actionModal.type === 'REQUIRE_REVIEW') targetStatus = 'requires_review';
      if (actionModal.type === 'REJECT') targetStatus = 'failed';

      const updated = await OrganizationVerificationService.reviewOrganization(
        actionModal.org.organizationId,
        targetStatus,
        {
          actorId: user.id,
          actorName: user.name,
          actorRole: 'government',
          notes: actionNotes.trim() || undefined,
          reason: actionModal.type === 'REJECT' ? actionNotes.trim() : undefined,
        }
      );

      showToast('Nodal Action Executed', {
        message: `Organization status updated to ${targetStatus.toUpperCase()}.`,
        type: targetStatus === 'verified' ? 'success' : 'info',
      });

      setActionModal({ isOpen: false, type: 'APPROVE', org: null });
      setActionNotes('');
      setSelectedOrg(updated);
      await loadQueue();
      await loadOrgAudit(updated.organizationId);
    } catch (err) {
      showToast('Action Failed', {
        message: err instanceof Error ? err.message : 'Could not update verification status.',
        type: 'error',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title="District Nodal Verification Desk"
        subtitle="Authorize statutory contractor registrations, adjudicate flagged GSTINs, and manage verification audit records."
      />

      <DevelopmentEnvironmentNotice />

      {/* Authoritative Queue Retrieval Error Notification */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-red-800">Authoritative Queue Retrieval Error</div>
              <p className="font-mono text-[11px] text-red-700 break-all">{error}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={loadQueue}
            className="text-xs shrink-0 bg-white hover:bg-red-100/50 border border-red-300 text-red-900 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
          </Button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'pending', 'requires_review', 'verified', 'failed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-[#002B49] text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {st === 'all'
                ? 'All Submissions'
                : st === 'requires_review'
                ? 'Requires Review'
                : st.charAt(0).toUpperCase() + st.slice(1)}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search GSTIN, entity name, state..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#002B49]"
          />
        </div>
      </div>

      {/* Main Split Grid: Left = Queue, Right = Detailed Review & Action */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Organization Queue List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 flex justify-between items-center">
            <span>Contractor Verification Queue</span>
            <span className="font-mono text-slate-400">{filteredOrgs.length} records</span>
          </div>

          <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
            {filteredOrgs.length === 0 ? (
              <Card className="p-8 text-center text-xs text-slate-500 border-dashed">
                No organizations matching the selected filter criteria.
              </Card>
            ) : (
              filteredOrgs.map((org) => {
                const isSelected = selectedOrg?.organizationId === org.organizationId;
                return (
                  <div
                    key={org.organizationId}
                    onClick={() => handleSelectOrg(org)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer text-left space-y-2 ${
                      isSelected
                        ? 'bg-blue-50/50 border-[#002B49] shadow-sm ring-1 ring-[#002B49]'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <h4 className="font-bold text-xs text-slate-900 line-clamp-1">
                          {org.legalName}
                        </h4>
                        <div className="text-[11px] font-mono text-slate-500">
                          {org.gstin}
                        </div>
                      </div>
                      <VerificationBadge status={org.verificationStatus} size="sm" />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>{org.state} • {org.businessCategory}</span>
                      <span className="font-mono text-[10px]">
                        {new Date(org.updatedAt || org.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Organization Review Card & Action Desk (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {selectedOrg ? (
            <>
              <Card className="p-6 border-slate-300 shadow-sm space-y-6">
                {/* Header with Title and Current Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      Entity Dossier
                    </span>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">
                      {selectedOrg.legalName}
                    </h3>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      ID: {selectedOrg.organizationId} • App Ref: {selectedOrg.applicationId}
                    </div>
                  </div>
                  <VerificationBadge status={selectedOrg.verificationStatus} size="md" />
                </div>

                {/* Statutory Registration Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Normalized GSTIN</span>
                    <span className="font-mono font-bold text-[#002B49] text-sm">
                      {selectedOrg.gstin}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Jurisdiction State / UT</span>
                    <span className="font-bold text-slate-900">
                      {selectedOrg.state} (Code {selectedOrg.gstStateCode})
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Business Category</span>
                    <span className="font-semibold text-slate-800">
                      {selectedOrg.businessCategory}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Verification Reference</span>
                    <span className="font-mono text-slate-700">
                      {selectedOrg.verificationReference}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 sm:col-span-2">
                    <span className="text-slate-500 block text-[11px]">Registered Commercial Address</span>
                    <span className="text-slate-800">{selectedOrg.registeredAddress}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Primary Contact</span>
                    <span className="text-slate-800 block">{selectedOrg.contactEmail}</span>
                    <span className="text-slate-500 text-[11px] block">{selectedOrg.contactPhone}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Last Updated</span>
                    <span className="font-mono text-slate-700">
                      {new Date(selectedOrg.updatedAt || selectedOrg.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Review Notes / Rejection Reason if present */}
                {selectedOrg.reviewNotes && (
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1">
                    <span className="font-bold text-blue-900 uppercase text-[10px]">
                      Active Review Scrutiny Notes:
                    </span>
                    <p className="text-slate-700">{selectedOrg.reviewNotes}</p>
                  </div>
                )}

                {selectedOrg.rejectionReason && (
                  <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl text-xs space-y-1">
                    <span className="font-bold text-rose-900 uppercase text-[10px]">
                      Recorded Rejection Ground:
                    </span>
                    <p className="text-rose-800">{selectedOrg.rejectionReason}</p>
                  </div>
                )}

                {/* Action Buttons for Nodal Officer */}
                <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-700 border-rose-200 hover:bg-rose-50"
                    icon={XCircle}
                    onClick={() =>
                      setActionModal({ isOpen: true, type: 'REJECT', org: selectedOrg })
                    }
                  >
                    Reject / Fail Verification
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="text-blue-800 border-blue-200 hover:bg-blue-50"
                    icon={AlertTriangle}
                    onClick={() =>
                      setActionModal({ isOpen: true, type: 'REQUIRE_REVIEW', org: selectedOrg })
                    }
                  >
                    Mark for Additional Scrutiny
                  </Button>

                  <Button
                    variant="gov"
                    size="sm"
                    className="bg-emerald-700 hover:bg-emerald-800 text-white"
                    icon={CheckCircle2}
                    onClick={() =>
                      setActionModal({ isOpen: true, type: 'APPROVE', org: selectedOrg })
                    }
                  >
                    Approve Verification
                  </Button>
                </div>
              </Card>

              {/* Organization Audit Trail Card */}
              <Card className="p-6 border-slate-300 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-700" />
                    <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                      Statutory Audit Trail
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {auditTrail.length} Event{auditTrail.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="space-y-2">
                  {auditTrail.map((evt, idx) => (
                    <div
                      key={evt.eventId || idx}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex flex-col sm:flex-row justify-between gap-1"
                    >
                      <div>
                        <span className="font-mono font-bold text-[#002B49] mr-2">
                          {evt.action}
                        </span>
                        <span className="text-slate-600 text-[11px]">
                          by {evt.actorName} ({evt.actorRole})
                        </span>
                        {evt.notes && (
                          <div className="text-slate-500 text-[11px] mt-0.5">{evt.notes}</div>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0">
                        {new Date(evt.timestamp).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-12 text-center text-xs text-slate-500 border-dashed">
              Select an organization from the queue to view registration credentials and audit records.
            </Card>
          )}
        </div>
      </div>

      {/* Review Action Confirmation Modal */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="space-y-1">
                <h3 className="font-black text-base text-slate-900">
                  {actionModal.type === 'APPROVE' && 'Approve Organization Statutory Verification'}
                  {actionModal.type === 'REQUIRE_REVIEW' && 'Flag Organization for Nodal Review'}
                  {actionModal.type === 'REJECT' && 'Reject Organization Statutory Verification'}
                </h3>
                <p className="text-xs text-slate-500">
                  {actionModal.org?.legalName} (GSTIN: {actionModal.org?.gstin})
                </p>
              </div>
              <button
                onClick={() => setActionModal({ isOpen: false, type: 'APPROVE', org: null })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed">
              {actionModal.type === 'APPROVE' &&
                'Authorizing verification will grant this organization full access to verified-agency features including tender proposal submissions and milestone filings.'}
              {actionModal.type === 'REQUIRE_REVIEW' &&
                'Flagging this organization will keep tender proposal actions paused while requiring clarification or review notes.'}
              {actionModal.type === 'REJECT' &&
                'Rejecting verification will mark the record as failed. The agency will be notified of the rejection reason.'}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {actionModal.type === 'REJECT'
                  ? 'Statutory Rejection Reason (Mandatory)'
                  : 'Nodal Officer Notes / Justification (Optional)'}
              </label>
              <textarea
                rows={3}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={
                  actionModal.type === 'REJECT'
                    ? 'State statutory reason (e.g., GST registration suspended, name mismatch)...'
                    : 'Add audit notes regarding physical inspection, registrar cross-verification...'
                }
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#002B49]"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActionModal({ isOpen: false, type: 'APPROVE', org: null })}
                disabled={submittingAction}
              >
                Cancel
              </Button>

              <Button
                variant="gov"
                size="sm"
                className={
                  actionModal.type === 'APPROVE'
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    : actionModal.type === 'REJECT'
                    ? 'bg-rose-800 hover:bg-rose-900 text-white'
                    : 'bg-blue-800 hover:bg-blue-900 text-white'
                }
                onClick={handleExecuteAction}
                disabled={
                  submittingAction || (actionModal.type === 'REJECT' && !actionNotes.trim())
                }
              >
                {submittingAction ? 'Processing...' : 'Confirm Action'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
