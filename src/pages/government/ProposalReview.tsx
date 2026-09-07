// Bharat Tender Intelligence (BTI) — Government Proposal Inbox & Human Review
// Phase 4: Structured Proposal Evaluation, Human Adjudication & Append-Only Audit Trail

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCheck2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Award,
  Building2,
  Eye,
  History,
  ArrowRight,
  Clock,
  Coins,
  FileText,
  ShieldCheck,
  XCircle,
  Filter,
  Layers,
  Calendar,
  User,
  CheckSquare,
  Lock,
  Briefcase,
  Paperclip,
  Info,
  ExternalLink,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { Drawer } from '../../components/ui/Drawer';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ProposalService, isLiveFirestoreSession } from '../../services/firebase/proposals';
import { TenderService } from '../../services/firebase/tenders';
import { Proposal, ProposalAuditEvent, CanonicalProposalStatus } from '../../types/proposal';
import { Tender } from '../../types/tender';
import { mockProposals } from '../../data/mockData';
import { formatCurrencyINR } from '../../components/tenders/TenderOpportunityCard';

export interface ProposalReviewProps {
  onNavigate: (path: string) => void;
  initialTenderId?: string;
}

export const ProposalReview: React.FC<ProposalReviewProps> = ({
  onNavigate,
  initialTenderId,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [tenders, setTenders] = useState<Tender[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState<string>(initialTenderId || 'ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  // Inspection Drawer State
  const [inspectedProposal, setInspectedProposal] = useState<Proposal | null>(null);

  // Audit Events Modal State
  const [auditProposal, setAuditProposal] = useState<Proposal | null>(null);
  const [auditEvents, setAuditEvents] = useState<ProposalAuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Adjudication Modal State
  const [actionModalType, setActionModalType] = useState<'REJECT' | 'AWARD' | null>(null);
  const [activeProposalForAction, setActiveProposalForAction] = useState<Proposal | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [actionProcessing, setActionProcessing] = useState<boolean>(false);

  // Load live tenders and proposals
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch live tenders for filter dropdown
      const tenderList = await TenderService.getTenders('government');
      setTenders(tenderList);

      // 2. Fetch proposals
      let data: Proposal[] = [];
      if (selectedTenderId && selectedTenderId !== 'ALL') {
        data = await ProposalService.getProposalsByTenderId(selectedTenderId);
      } else {
        data = await ProposalService.getAllProposals();
      }

      // In demo/offline mode only, if no records exist yet, fall back to mock data
      if (!isLiveFirestoreSession() && data.length === 0) {
        data = (mockProposals as unknown as Proposal[]) || [];
      }

      setProposals(data);
    } catch (err) {
      console.error('[BTI Gov] Error loading proposals:', err);
      if (!isLiveFirestoreSession()) {
        setProposals((mockProposals as unknown as Proposal[]) || []);
      } else {
        setProposals([]);
        showToast('Failed to Load Proposals', {
          message: err instanceof Error ? err.message : 'Could not fetch authoritative proposals from Firestore.',
          type: 'error',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [selectedTenderId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle State Transitions
  const handleTransitionStatus = async (
    proposal: Proposal,
    newStatus: CanonicalProposalStatus,
    reason?: string
  ) => {
    if (!user) return;
    setActionProcessing(true);
    try {
      const updated = await ProposalService.updateProposalStatus({
        proposalId: proposal.id,
        newStatus,
        notes: reason || `Status transitioned to ${newStatus} by ${user.name} (${user.role})`,
        user,
      });

      // Update local proposals list
      setProposals((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      if (inspectedProposal?.id === updated.id) {
        setInspectedProposal(updated);
      }

      showToast('Status Updated', {
        message: `Proposal ${proposal.proposalNumber} transitioned to ${newStatus}.`,
        type: 'success',
      });

      setActionModalType(null);
      setActiveProposalForAction(null);
      setRejectionReason('');
    } catch (err: unknown) {
      console.error('Transition error:', err);
      showToast('Action Failed', {
        message: err instanceof Error ? err.message : 'Could not transition proposal status.',
        type: 'error',
      });
    } finally {
      setActionProcessing(false);
    }
  };

  // Open Audit Trail Modal
  const handleOpenAudit = async (proposal: Proposal) => {
    setAuditProposal(proposal);
    setAuditLoading(true);
    setAuditError(null);
    try {
      const events = await ProposalService.getProposalAuditEvents(proposal.id);
      setAuditEvents(events);
    } catch (err) {
      console.error('Error fetching audit trail:', err);
      setAuditEvents([]);
      setAuditError(err instanceof Error ? err.message : 'Unable to retrieve the authoritative audit trail.');
    } finally {
      setAuditLoading(false);
    }
  };

  // Filtered Proposals
  const filteredProposals = proposals.filter((p) => {
    if (selectedTenderId !== 'ALL' && p.tenderId !== selectedTenderId) {
      return false;
    }
    const s = (p.status || '').toUpperCase().replace(/\s+/g, '_');
    if (statusFilter === 'SUBMITTED') return s === 'SUBMITTED';
    if (statusFilter === 'UNDER_REVIEW') return s === 'UNDER_REVIEW';
    if (statusFilter === 'SHORTLISTED') return s === 'SHORTLISTED';
    if (statusFilter === 'AWARDED') return s === 'AWARDED';
    if (statusFilter === 'REJECTED') return s === 'REJECTED';
    return true;
  });

  const columns: Column<Proposal>[] = [
    {
      key: 'proposalNumber',
      header: 'Bid Ref ID',
      width: '130px',
      render: (p) => (
        <div>
          <span className="font-mono text-xs font-bold text-slate-900">{p.proposalNumber}</span>
          <span className="block text-[10px] text-slate-400 font-mono">
            {p.submittedAt ? new Date(p.submittedAt).toLocaleDateString('en-IN') : 'Sealed'}
          </span>
        </div>
      ),
    },
    {
      key: 'agencyName',
      header: 'Bidding Agency & Identity',
      render: (p) => (
        <div>
          <div className="font-bold text-slate-900 text-xs line-clamp-1">{p.agencyName}</div>
          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
            <span>GSTIN: {p.agencyGstin || 'VERIFIED'}</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
          </div>
        </div>
      ),
    },
    {
      key: 'tenderTitle',
      header: 'Target Tender Opportunity',
      render: (p) => (
        <div className="max-w-xs">
          <div className="font-semibold text-slate-900 text-xs line-clamp-1">{p.tenderTitle}</div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">{p.tenderNumber}</div>
        </div>
      ),
    },
    {
      key: 'financialBidAmount',
      header: 'Firm Quoted Price (₹)',
      align: 'right',
      render: (p) => {
        const val = p.financialBidAmount || p.quotedAmount || p.financialProposal?.totalProposedAmount || 0;
        return (
          <div className="text-right">
            <span className="font-bold text-slate-900 font-mono text-xs">
              {formatCurrencyINR(val)}
            </span>
            <span className="block text-[10px] text-slate-400 font-mono">Inclusive GST</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Evaluation Status',
      align: 'center',
      render: (p) => <StatusBadge status={p.status} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Human Adjudication',
      align: 'right',
      render: (p) => {
        const s = (p.status || '').toUpperCase().replace(/\s+/g, '_');
        return (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setInspectedProposal(p)}
              icon={Eye}
              className="text-xs px-2.5 py-1"
            >
              Inspect
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenAudit(p)}
              icon={History}
              className="text-xs px-2 py-1 text-slate-500"
              title="View Proposal Audit Trail"
            >
              Audit
            </Button>

            {s === 'SUBMITTED' && (
              <Button
                variant="gov"
                size="sm"
                onClick={() => handleTransitionStatus(p, 'UNDER_REVIEW')}
                className="text-xs px-2.5 py-1"
              >
                Begin Review
              </Button>
            )}

            {s === 'UNDER_REVIEW' && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTransitionStatus(p, 'SHORTLISTED')}
                  className="text-xs px-2 py-1 text-blue-700 border-blue-300 hover:bg-blue-50"
                >
                  Shortlist
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveProposalForAction(p);
                    setActionModalType('REJECT');
                  }}
                  className="text-xs px-2 py-1 text-rose-700 border-rose-300 hover:bg-rose-50"
                >
                  Reject
                </Button>
              </div>
            )}

            {s === 'SHORTLISTED' && (
              <div className="flex items-center gap-1">
                <Button
                  variant="gov"
                  size="sm"
                  onClick={() => {
                    setActiveProposalForAction(p);
                    setActionModalType('AWARD');
                  }}
                  icon={Award}
                  className="text-xs px-2.5 py-1 bg-emerald-800 hover:bg-emerald-900 text-white"
                >
                  Award
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveProposalForAction(p);
                    setActionModalType('REJECT');
                  }}
                  className="text-xs px-2 py-1 text-rose-700 border-rose-300 hover:bg-rose-50"
                >
                  Reject
                </Button>
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div id="government-proposal-review-page" className="space-y-6 max-w-7xl mx-auto pb-16">
      <PageHeader
        title="Government Proposal Inbox & Adjudication"
        subtitle="Authoritative repository of sealed agency bids, technical specifications evaluation, and statutory GFR adjudication."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Filter Tender:</span>
            <select
              value={selectedTenderId}
              onChange={(e) => setSelectedTenderId(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#002B49]"
            >
              <option value="ALL">All Active Procurement Tenders ({tenders.length})</option>
              {tenders.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tenderNumber} — {t.title.substring(0, 40)}...
                </option>
              ))}
            </select>
          </div>
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-[#002B49] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Proposals ({proposals.length})
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('SUBMITTED')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
            statusFilter === 'SUBMITTED'
              ? 'bg-[#002B49] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Awaiting Review (
          {proposals.filter((p) => (p.status || '').toUpperCase() === 'SUBMITTED').length}
          )
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('UNDER_REVIEW')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
            statusFilter === 'UNDER_REVIEW'
              ? 'bg-[#002B49] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Under Examination (
          {
            proposals.filter(
              (p) => (p.status || '').toUpperCase().replace(/\s+/g, '_') === 'UNDER_REVIEW'
            ).length
          }
          )
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('SHORTLISTED')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
            statusFilter === 'SHORTLISTED'
              ? 'bg-[#002B49] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Shortlisted (
          {proposals.filter((p) => (p.status || '').toUpperCase() === 'SHORTLISTED').length}
          )
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('AWARDED')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
            statusFilter === 'AWARDED'
              ? 'bg-[#002B49] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Awarded (
          {proposals.filter((p) => (p.status || '').toUpperCase() === 'AWARDED').length}
          )
        </button>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-slate-500 text-xs animate-pulse">
          Loading proposal records...
        </Card>
      ) : filteredProposals.length === 0 ? (
        <Card className="p-12 text-center space-y-3 border-slate-200">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-[#002B49] flex items-center justify-center mx-auto">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">No Proposals in Selected Category</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No agency submissions match the current tender and status filter criteria.
          </p>
        </Card>
      ) : (
        <Table
          data={filteredProposals}
          columns={columns}
          keyExtractor={(p) => p.id}
          onRowClick={(p) => setInspectedProposal(p)}
        />
      )}

      {/* INSPECTION DRAWER */}
      <Drawer
        isOpen={Boolean(inspectedProposal)}
        onClose={() => setInspectedProposal(null)}
        title={
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
              {inspectedProposal?.proposalNumber}
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-bold text-slate-800">Proposal Specification Audit</span>
          </div>
        }
        description={`Authoritative sealed bid from ${inspectedProposal?.agencyName}`}
        width="2xl"
        footer={
          inspectedProposal && (
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenAudit(inspectedProposal)}
                icon={History}
              >
                Audit Timeline
              </Button>

              <div className="flex items-center gap-2">
                {inspectedProposal.status === 'SUBMITTED' && (
                  <Button
                    variant="gov"
                    size="sm"
                    onClick={() => handleTransitionStatus(inspectedProposal, 'UNDER_REVIEW')}
                  >
                    Mark Under Review
                  </Button>
                )}

                {(inspectedProposal.status === 'UNDER_REVIEW' ||
                  inspectedProposal.status === 'SHORTLISTED') && (
                  <Button
                    variant="gov"
                    size="sm"
                    onClick={() => {
                      setActiveProposalForAction(inspectedProposal);
                      setActionModalType('AWARD');
                    }}
                    icon={Award}
                    className="bg-emerald-800 hover:bg-emerald-900 text-white"
                  >
                    Award Contract
                  </Button>
                )}
              </div>
            </div>
          )
        }
      >
        {inspectedProposal && (
          <div className="space-y-6 text-xs text-slate-800 pb-8">
            {/* Header Status & Price Snapshot */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[11px]">Evaluation Status</span>
                <div className="mt-1">
                  <StatusBadge status={inspectedProposal.status} size="sm" />
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Firm Quoted Price</span>
                <span className="font-black text-slate-900 text-base font-mono block mt-0.5">
                  {formatCurrencyINR(
                    inspectedProposal.financialProposal?.totalProposedAmount ||
                      inspectedProposal.financialBidAmount ||
                      inspectedProposal.quotedAmount ||
                      0
                  )}
                </span>
                <span className="text-[10px] text-slate-500">All-Inclusive of GST</span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Sealed Timestamp</span>
                <span className="font-mono font-medium text-slate-800 block mt-0.5">
                  {inspectedProposal.submittedAt
                    ? new Date(inspectedProposal.submittedAt).toLocaleString('en-IN')
                    : inspectedProposal.submissionDate || 'Sealed Record'}
                </span>
              </div>
            </div>

            {/* 1. CONTRACTOR IDENTITY & VERIFICATION */}
            <div className="space-y-3 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Building2 className="w-4 h-4 text-[#002B49]" />
                <span>1. Contractor Identity & Verification</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <span className="text-slate-400 block text-[11px]">Organization / Agency Name:</span>
                  <span className="font-bold text-slate-900">
                    {inspectedProposal.organizationName || inspectedProposal.agencyName || 'Not provided'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Statutory GSTIN:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {inspectedProposal.organizationGstin ||
                      inspectedProposal.agencyGstin ||
                      inspectedProposal.agencyGst ||
                      'Not provided'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Submitted By (Authorized Signatory):</span>
                  <span className="text-slate-800 font-medium">
                    {inspectedProposal.submittedByName
                      ? `${inspectedProposal.submittedByName}${
                          inspectedProposal.submittedByEmail ? ` (${inspectedProposal.submittedByEmail})` : ''
                        }`
                      : inspectedProposal.submittedByEmail ||
                        inspectedProposal.submittedBy ||
                        'Authorized Signatory'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Authoritative Proposal Reference:</span>
                  <span className="font-mono font-bold text-[#002B49]">
                    {inspectedProposal.proposalNumber}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Submission Timestamp:</span>
                  <span className="font-mono text-slate-700">
                    {inspectedProposal.submittedAt
                      ? new Date(inspectedProposal.submittedAt).toLocaleString('en-IN')
                      : inspectedProposal.submissionDate || 'Sealed'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Current Evaluation Status:</span>
                  <div className="mt-0.5">
                    <StatusBadge status={inspectedProposal.status} size="sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. TECHNICAL PROPOSAL */}
            <div className="space-y-3 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <FileText className="w-4 h-4 text-[#002B49]" />
                <span>2. Technical Proposal</span>
              </h4>

              <div className="space-y-3 pt-1">
                <div>
                  <strong className="block text-slate-700 text-[11px]">Technical Approach:</strong>
                  <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1 whitespace-pre-line leading-relaxed">
                    {inspectedProposal.technicalProposal?.technicalApproach || 'Not provided'}
                  </p>
                </div>

                <div>
                  <strong className="block text-slate-700 text-[11px]">Proposed Solution & Materials Concept:</strong>
                  <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1 whitespace-pre-line leading-relaxed">
                    {inspectedProposal.technicalProposal?.proposedSolution || 'Not provided'}
                  </p>
                </div>

                <div>
                  <strong className="block text-slate-700 text-[11px]">Understanding of Scope & Specifications:</strong>
                  <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1 whitespace-pre-line leading-relaxed">
                    {inspectedProposal.technicalProposal?.scopeUnderstanding || 'Not provided'}
                  </p>
                </div>

                <div>
                  <strong className="block text-slate-700 text-[11px]">Technical Methodology & Standards:</strong>
                  <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1 whitespace-pre-line leading-relaxed">
                    {inspectedProposal.technicalProposal?.technicalMethodology || 'Not provided'}
                  </p>
                </div>

                <div>
                  <strong className="block text-slate-700 text-[11px]">Key Deliverables & Acceptance Criteria:</strong>
                  <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1 whitespace-pre-line leading-relaxed">
                    {inspectedProposal.technicalProposal?.keyDeliverables || 'Not provided'}
                  </p>
                </div>

                <div>
                  <strong className="block text-slate-700 text-[11px]">Quality Assurance & Testing Protocol:</strong>
                  <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1 whitespace-pre-line leading-relaxed">
                    {inspectedProposal.technicalProposal?.qualityAssuranceApproach || 'Not provided'}
                  </p>
                </div>

                <div>
                  <strong className="block text-slate-700 text-[11px]">Technical Assumptions & Dependencies:</strong>
                  <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1 whitespace-pre-line leading-relaxed">
                    {inspectedProposal.technicalProposal?.technicalAssumptions || 'Not provided'}
                  </p>
                </div>
              </div>
            </div>

            {/* 3. IMPLEMENTATION & EXECUTION PLAN */}
            <div className="space-y-3 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Layers className="w-4 h-4 text-[#002B49]" />
                <span>3. Implementation & Execution Plan</span>
              </h4>

              <div className="space-y-3 pt-1">
                <div>
                  <strong className="block text-slate-700 text-[11px]">Implementation Approach:</strong>
                  <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1 whitespace-pre-line leading-relaxed">
                    {inspectedProposal.implementationPlan?.implementationApproach || 'Not provided'}
                  </p>
                </div>

                <div>
                  <strong className="block text-slate-700 text-[11px]">Project Phases & Work Breakdown:</strong>
                  <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1 whitespace-pre-line leading-relaxed">
                    {inspectedProposal.implementationPlan?.projectPhases || 'Not provided'}
                  </p>
                </div>

                <div>
                  <strong className="block text-slate-700 text-[11px] mb-1.5">Milestones Breakdown:</strong>
                  {inspectedProposal.implementationPlan?.milestones &&
                  inspectedProposal.implementationPlan.milestones.length > 0 ? (
                    <div className="space-y-2">
                      {inspectedProposal.implementationPlan.milestones.map((m, idx) => (
                        <div
                          key={m.id || idx}
                          className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded bg-[#002B49] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <div className="space-y-1">
                              <strong className="text-slate-900 block font-semibold">{m.title}</strong>
                              <p className="text-slate-600 text-[11px] leading-relaxed">{m.description}</p>
                              {m.deliverables && (
                                <p className="text-[11px] text-slate-500">
                                  <span className="font-semibold text-slate-700">Deliverables:</span> {m.deliverables}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="font-mono text-[#002B49] bg-blue-50/80 px-2 py-0.5 rounded border border-blue-200 text-[11px] font-bold shrink-0">
                            {m.expectedCompletion}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 italic text-xs bg-slate-50 p-2.5 rounded border border-slate-200">
                      No milestones specified.
                    </p>
                  )}
                </div>

                <div>
                  <strong className="block text-slate-700 text-[11px]">Resource Plan & Allocation:</strong>
                  <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1 whitespace-pre-line leading-relaxed">
                    {inspectedProposal.implementationPlan?.resourcePlan || 'Not provided'}
                  </p>
                </div>

                <div>
                  <strong className="block text-slate-700 text-[11px]">Risk Considerations & Mitigation:</strong>
                  <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1 whitespace-pre-line leading-relaxed">
                    {inspectedProposal.implementationPlan?.riskConsiderations || 'Not provided'}
                  </p>
                </div>

                <div>
                  <strong className="block text-slate-700 text-[11px]">Completion Strategy & Handover:</strong>
                  <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1 whitespace-pre-line leading-relaxed">
                    {inspectedProposal.implementationPlan?.completionStrategy || 'Not provided'}
                  </p>
                </div>
              </div>
            </div>

            {/* 4. PROPOSED TIMELINE */}
            <div className="space-y-3 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Calendar className="w-4 h-4 text-[#002B49]" />
                <span>4. Proposed Timeline</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Proposed Duration</span>
                  <span className="font-mono font-bold text-slate-900 block mt-0.5">
                    {inspectedProposal.timeline?.proposedDurationValue
                      ? `${inspectedProposal.timeline.proposedDurationValue} ${
                          inspectedProposal.timeline.proposedDurationUnit || 'days'
                        }`
                      : 'Not provided'}
                  </span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Proposed Start Date</span>
                  <span className="font-mono font-bold text-slate-900 block mt-0.5">
                    {inspectedProposal.timeline?.proposedStartDate || 'Not provided'}
                  </span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Proposed Completion Date</span>
                  <span className="font-mono font-bold text-slate-900 block mt-0.5">
                    {inspectedProposal.timeline?.proposedCompletionDate || 'Not provided'}
                  </span>
                </div>
              </div>
            </div>

            {/* 5. FINANCIAL BID */}
            <div className="space-y-3 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Coins className="w-4 h-4 text-[#002B49]" />
                <span>5. Financial Bid</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs pt-1">
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Base Quoted Amount</span>
                  <span className="font-mono font-bold text-slate-900 block mt-0.5">
                    {formatCurrencyINR(
                      inspectedProposal.financialProposal?.baseAmount ??
                        inspectedProposal.quotedAmount ??
                        0
                    )}
                  </span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Statutory GST / Tax</span>
                  <span className="font-mono font-bold text-slate-900 block mt-0.5">
                    {formatCurrencyINR(inspectedProposal.financialProposal?.taxAmount ?? 0)}
                  </span>
                </div>

                <div className="p-2.5 bg-blue-50/70 rounded border border-blue-200">
                  <span className="text-blue-900 block text-[10px] font-bold">Total Firm Bid (All-Inclusive)</span>
                  <span className="font-mono font-black text-blue-950 block mt-0.5">
                    {formatCurrencyINR(
                      inspectedProposal.financialProposal?.totalProposedAmount ??
                        inspectedProposal.financialBidAmount ??
                        inspectedProposal.quotedAmount ??
                        0
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div>
                  <strong className="block text-slate-700 text-[11px]">Cost Breakdown / Line Items:</strong>
                  <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1 whitespace-pre-line leading-relaxed">
                    {inspectedProposal.financialProposal?.costBreakdown || 'Not provided'}
                  </p>
                </div>

                <div>
                  <strong className="block text-slate-700 text-[11px]">Payment Milestones & Commercial Terms:</strong>
                  <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1 whitespace-pre-line leading-relaxed">
                    {inspectedProposal.financialProposal?.paymentMilestones || 'Not provided'}
                  </p>
                </div>
              </div>
            </div>

            {/* 6. EXPERIENCE & TRACK RECORD (PROMINENT) */}
            <div className="space-y-3 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Briefcase className="w-4 h-4 text-[#002B49]" />
                <span>6. Experience & Track Record</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <span className="text-slate-400 block text-[11px]">Total Public/Civil Experience:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {inspectedProposal.experience?.yearsOfExperience !== undefined
                      ? `${inspectedProposal.experience.yearsOfExperience} Years`
                      : 'Not provided'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Key Capabilities & Specializations:</span>
                  <span className="text-slate-800 font-medium">
                    {inspectedProposal.experience?.keyCapabilities || 'Not provided'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div>
                  <strong className="block text-slate-700 text-[11px]">Relevant Experience Summary:</strong>
                  <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1 whitespace-pre-line leading-relaxed">
                    {inspectedProposal.experience?.relevantExperienceSummary || 'Not provided'}
                  </p>
                </div>

                <div>
                  <strong className="block text-slate-700 text-[11px]">Available Resources & Plant/Machinery:</strong>
                  <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1 whitespace-pre-line leading-relaxed">
                    {inspectedProposal.experience?.availableResources || 'Not provided'}
                  </p>
                </div>

                <div>
                  <strong className="block text-slate-700 text-[11px]">Technical Personnel & Dedicated Team:</strong>
                  <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1 whitespace-pre-line leading-relaxed">
                    {inspectedProposal.experience?.technicalPersonnel || 'Not provided'}
                  </p>
                </div>
              </div>

              {/* Past Projects List */}
              <div className="pt-2">
                <strong className="block text-slate-800 text-[11px] mb-2 font-bold flex items-center justify-between">
                  <span>Executed Projects & Past Contracts</span>
                  <span className="text-[10px] font-normal text-slate-500">
                    {inspectedProposal.experience?.pastProjects?.length || 0} Project(s) on Record
                  </span>
                </strong>

                {inspectedProposal.experience?.pastProjects &&
                inspectedProposal.experience.pastProjects.length > 0 ? (
                  <div className="space-y-2.5">
                    {inspectedProposal.experience.pastProjects.map((p, pIdx) => (
                      <div
                        key={p.id || pIdx}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-slate-900 block text-xs">{p.projectName}</span>
                            <span className="text-slate-600 text-[11px]">
                              Client Authority: <strong className="text-slate-800">{p.clientAuthority}</strong>
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-slate-900 block text-xs">
                              {formatCurrencyINR(p.value || 0)}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">FY {p.year}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="px-2 py-0.5 rounded bg-slate-200/80 text-slate-700 font-medium text-[10px]">
                            {p.projectCategory}
                          </span>
                        </div>

                        {p.description && (
                          <p className="text-slate-600 text-[11px] leading-relaxed pt-1 border-t border-slate-200/60">
                            {p.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 italic text-xs bg-slate-50 p-2.5 rounded border border-slate-200">
                    No past project records provided.
                  </p>
                )}
              </div>
            </div>

            {/* 7. STATUTORY COMPLIANCE DECLARATIONS */}
            <div className="space-y-3 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>7. Statutory Compliance Declarations</span>
              </h4>

              <div className="space-y-2 pt-1 text-xs">
                {/* 1. Accuracy of information */}
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-800 font-medium">
                    1. Accuracy of technical specifications and pricing certified
                  </span>
                  {inspectedProposal.complianceDeclarations?.accuracyConfirmed ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> ACCEPTED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                      <XCircle className="w-3.5 h-3.5 text-amber-600" /> NOT ACCEPTED
                    </span>
                  )}
                </div>

                {/* 2. Eligibility */}
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-800 font-medium">
                    2. Mandatory eligibility & non-debarment criteria satisfied
                  </span>
                  {inspectedProposal.complianceDeclarations?.eligibilitySatisfied ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> ACCEPTED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                      <XCircle className="w-3.5 h-3.5 text-amber-600" /> NOT ACCEPTED
                    </span>
                  )}
                </div>

                {/* 3. Supporting documents authentic */}
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-800 font-medium">
                    3. Supporting technical & financial documents declared authentic
                  </span>
                  {inspectedProposal.complianceDeclarations?.documentsAuthentic ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> ACCEPTED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                      <XCircle className="w-3.5 h-3.5 text-amber-600" /> NOT ACCEPTED
                    </span>
                  )}
                </div>

                {/* 4. Terms and conditions */}
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-800 font-medium">
                    4. General Conditions of Contract (GCC) & tender terms unconditionally accepted
                  </span>
                  {inspectedProposal.complianceDeclarations?.termsAgreed ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> ACCEPTED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                      <XCircle className="w-3.5 h-3.5 text-amber-600" /> NOT ACCEPTED
                    </span>
                  )}
                </div>
              </div>

              {/* Declaration Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[11px]">Declared By:</span>
                  <span className="text-slate-800 font-medium">
                    {inspectedProposal.complianceDeclarations?.declaredBy ||
                      inspectedProposal.submittedByName ||
                      inspectedProposal.submittedBy ||
                      'Authorized Signatory'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Declaration Timestamp:</span>
                  <span className="font-mono text-slate-700">
                    {inspectedProposal.complianceDeclarations?.declaredAt
                      ? new Date(inspectedProposal.complianceDeclarations.declaredAt).toLocaleString('en-IN')
                      : inspectedProposal.submittedAt
                      ? new Date(inspectedProposal.submittedAt).toLocaleString('en-IN')
                      : 'At submission'}
                  </span>
                </div>
              </div>
            </div>

            {/* 8. SUPPORTING DOCUMENTS */}
            <div className="space-y-3 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Paperclip className="w-4 h-4 text-[#002B49]" />
                <span>8. Supporting Documents</span>
              </h4>

              {inspectedProposal.supportingDocuments && inspectedProposal.supportingDocuments.length > 0 ? (
                <div className="space-y-2 pt-1">
                  {inspectedProposal.supportingDocuments.map((doc, dIdx) => (
                    <div
                      key={doc.id || dIdx}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{doc.fileName}</span>
                          <span className="px-2 py-0.2 rounded bg-slate-200 text-slate-700 font-mono text-[10px]">
                            {doc.documentType}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-3">
                          {doc.fileSize && <span>Size: {doc.fileSize}</span>}
                          <span>
                            Uploaded:{' '}
                            {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString('en-IN') : 'At submission'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            doc.verificationStatus === 'ACCEPTED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : doc.verificationStatus === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {doc.verificationStatus || 'NOT_REVIEWED'}
                        </span>

                        {doc.fileUrl && (
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
                            title="Open document"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 italic text-xs bg-slate-50 p-2.5 rounded border border-slate-200">
                  No supporting documents uploaded.
                </p>
              )}
            </div>

            {/* 9. PROPOSAL / TENDER CONTEXT */}
            <div className="space-y-3 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Info className="w-4 h-4 text-[#002B49]" />
                <span>9. Proposal & Tender Opportunity Context</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <span className="text-slate-400 block text-[11px]">Tender Number:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {inspectedProposal.tenderNumber || 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Tender Category:</span>
                  <span className="text-slate-800 font-medium">
                    {inspectedProposal.tenderCategory || 'Not specified'}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 block text-[11px]">Tender Title:</span>
                  <span className="text-slate-900 font-medium">
                    {inspectedProposal.tenderTitle || 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Tender Estimated Value:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {inspectedProposal.tenderEstimatedValue
                      ? formatCurrencyINR(inspectedProposal.tenderEstimatedValue)
                      : 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Tender Closing Date:</span>
                  <span className="font-mono text-slate-800">
                    {inspectedProposal.tenderClosingDate
                      ? new Date(inspectedProposal.tenderClosingDate).toLocaleDateString('en-IN')
                      : 'Not specified'}
                  </span>
                </div>
              </div>

              {/* Deterministic Match Information if available */}
              {(inspectedProposal.matchScore !== undefined || inspectedProposal.matchGrade) && (
                <div className="mt-2 p-3 bg-blue-50/60 rounded-lg border border-blue-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-900 font-bold text-xs">
                      Deterministic Capability Compatibility Match: Grade {inspectedProposal.matchGrade || 'N/A'} (
                      {inspectedProposal.matchScore || 0}% Score)
                    </span>
                  </div>
                  <p className="text-[10px] text-blue-700">
                    Deterministic criteria compatibility matching based on verified contractor capability profile — NOT AI evaluation.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* AUDIT TRAIL MODAL */}
      <Modal
        isOpen={Boolean(auditProposal)}
        onClose={() => {
          setAuditProposal(null);
          setAuditError(null);
        }}
        title={
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#002B49]" />
            <span>Proposal Audit Trail — Ref: {auditProposal?.proposalNumber}</span>
          </div>
        }
        description="Statutory chronological history of all state changes, officer reviews, and timestamps."
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs">
          {auditLoading ? (
            <div className="py-8 text-center text-slate-500 animate-pulse">
              Retrieving immutable audit events...
            </div>
          ) : auditError ? (
            <div className="p-4 bg-rose-50 rounded-lg border border-rose-200 text-rose-800 space-y-1">
              <div className="flex items-center gap-2 font-bold text-rose-900">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Unable to retrieve the authoritative audit trail.</span>
              </div>
              <p className="text-[11px] text-rose-700 pl-6">
                {auditError}
              </p>
            </div>
          ) : auditEvents.length === 0 ? (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 text-center">
              No audit events are recorded for this proposal.
            </div>
          ) : (
            <div className="space-y-3">
              {auditEvents.map((evt, idx) => (
                <div
                  key={evt.eventId || idx}
                  className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{evt.action}</span>
                      {evt.previousStatus && evt.newStatus && (
                        <span className="text-[11px] font-mono text-slate-500">
                          ({evt.previousStatus} → <strong className="text-slate-900">{evt.newStatus}</strong>)
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      {new Date(evt.timestamp).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-600">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>
                      Actor: <strong>{evt.actorName || evt.actorEmail || evt.actorId}</strong> ({evt.actorRole})
                    </span>
                  </div>

                  {evt.notes && (
                    <div className="text-[11px] text-slate-700 bg-white p-2 rounded border border-slate-200/70 mt-1">
                      <strong>Notes:</strong> {evt.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAuditProposal(null);
                setAuditError(null);
              }}
            >
              Close Audit Trail
            </Button>
          </div>
        </div>
      </Modal>

      {/* REJECTION JUSTIFICATION MODAL */}
      <Modal
        isOpen={actionModalType === 'REJECT' && Boolean(activeProposalForAction)}
        onClose={() => {
          setActionModalType(null);
          setActiveProposalForAction(null);
        }}
        title="Administrative Proposal Rejection"
        description="Statutory GFR requirement: Provide a mandatory administrative justification for rejecting this proposal."
        maxWidth="md"
      >
        <div className="space-y-4 text-xs text-slate-700">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-700" />
              <span>Permanent Rejection Record</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              This reason will be recorded in the append-only audit trail and transmitted to the bidding entity {activeProposalForAction?.agencyName}.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-900 block">
              Administrative Justification Reason <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={4}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Detail the technical disqualification, non-responsive bid parameter, or missing statutory clearance..."
              className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActionModalType(null);
                setActiveProposalForAction(null);
              }}
              disabled={actionProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (activeProposalForAction) {
                  handleTransitionStatus(activeProposalForAction, 'REJECTED', rejectionReason);
                }
              }}
              disabled={!rejectionReason.trim() || actionProcessing}
            >
              {actionProcessing ? 'Recording Rejection...' : 'Confirm Rejection'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* CONTRACT AWARD CONFIRMATION MODAL */}
      <Modal
        isOpen={actionModalType === 'AWARD' && Boolean(activeProposalForAction)}
        onClose={() => {
          setActionModalType(null);
          setActiveProposalForAction(null);
        }}
        title="Confirm Statutory Contract Award"
        description="Official procurement decision pursuant to General Financial Rules (GFR 2017)."
        maxWidth="md"
      >
        <div className="space-y-4 text-xs text-slate-700">
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <Award className="w-4 h-4 text-emerald-700" />
              <span>Contract Award Determination</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Awarding will declare this proposal the winning bid and initiate contract milestone monitoring.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Contractor:</span>
              <strong className="text-slate-900">{activeProposalForAction?.agencyName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tender Ref:</span>
              <span className="font-mono font-bold text-slate-900">{activeProposalForAction?.tenderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Contract Value:</span>
              <strong className="text-emerald-800 font-mono">
                {formatCurrencyINR(
                  activeProposalForAction?.financialBidAmount ||
                    activeProposalForAction?.quotedAmount ||
                    0
                )}
              </strong>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            By confirming, you certify that technical evaluation requirements were verified and this contractor is duly qualified.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActionModalType(null);
                setActiveProposalForAction(null);
              }}
              disabled={actionProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="gov"
              size="sm"
              onClick={() => {
                if (activeProposalForAction) {
                  handleTransitionStatus(
                    activeProposalForAction,
                    'AWARDED',
                    `Contract awarded by ${user?.name || 'Nodal Authority'}`
                  );
                }
              }}
              disabled={actionProcessing}
              icon={Award}
              className="bg-emerald-800 hover:bg-emerald-900 text-white"
            >
              {actionProcessing ? 'Processing Award...' : 'Confirm Contract Award'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
