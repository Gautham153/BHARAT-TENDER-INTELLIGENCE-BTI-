// Bharat Tender Intelligence (BTI) — Agency Submitted Proposals & Drafts List
// Phase 4: Organization Proposal Repository, State Tracking & Quick Access

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCheck2,
  Clock,
  Eye,
  Edit,
  ArrowRight,
  Send,
  Lock,
  Plus,
  Building2,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ProposalService, isLiveFirestoreSession } from '../../services/firebase/proposals';
import { OrganizationService } from '../../services/firebase/organizations';
import { Proposal } from '../../types/proposal';
import { mockProposals } from '../../data/mockData';
import { formatCurrencyINR } from '../../components/tenders/TenderOpportunityCard';

export interface SubmittedProposalsPageProps {
  onNavigate: (path: string) => void;
}

export const SubmittedProposalsPage: React.FC<SubmittedProposalsPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'SUBMITTED' | 'DECIDED'>('ALL');

  const loadProposals = useCallback(async () => {
    setLoading(true);
    try {
      let orgId = user?.organizationId;
      if (!orgId && user) {
        const orgs = await OrganizationService.getAllOrganizations();
        const found = orgs.find((o) => o.primaryUserId === user.id || (user.gstin && o.gstin === user.gstin));
        orgId = found?.organizationId;
      }

      let data: Proposal[] = [];
      if (orgId) {
        data = await ProposalService.getProposalsByOrganizationId(orgId);
      }

      // In demo/offline mode only, if no records exist yet, fall back to mock data
      if (!isLiveFirestoreSession() && data.length === 0) {
        data = (mockProposals as unknown as Proposal[]) || [];
      }

      setProposals(data);
    } catch (err) {
      console.error('[BTI Agency] Error fetching proposals:', err);
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
  }, [user, showToast]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  const filteredProposals = proposals.filter((p) => {
    const s = (p.status || '').toUpperCase().replace(/\s+/g, '_');
    if (statusFilter === 'DRAFT') return s === 'DRAFT';
    if (statusFilter === 'SUBMITTED') return s === 'SUBMITTED' || s === 'UNDER_REVIEW';
    if (statusFilter === 'DECIDED') return s === 'AWARDED' || s === 'SHORTLISTED' || s === 'REJECTED';
    return true;
  });

  const columns: Column<Proposal>[] = [
    {
      key: 'proposalNumber',
      header: 'Bid Ref ID',
      width: '140px',
      render: (p) => (
        <div>
          <span className="font-mono text-xs font-bold text-slate-900">{p.proposalNumber}</span>
          <span className="block text-[10px] text-slate-400 font-mono">
            {p.status === 'DRAFT' ? 'Draft Copy' : 'Official Sealed Bid'}
          </span>
        </div>
      ),
    },
    {
      key: 'tenderTitle',
      header: 'Tender Work Scope',
      render: (p) => (
        <div className="max-w-md">
          <div className="font-bold text-slate-900 text-xs line-clamp-1">{p.tenderTitle}</div>
          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
            <span>{p.tenderNumber}</span>
            {p.tenderCategory && (
              <>
                <span className="text-slate-300">•</span>
                <span>{p.tenderCategory}</span>
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'financialBidAmount',
      header: 'Quoted Price (₹)',
      align: 'right',
      render: (p) => {
        const val = p.financialBidAmount || p.quotedAmount || p.financialProposal?.totalProposedAmount || 0;
        return (
          <div className="font-mono font-bold text-slate-900 text-xs">
            {val > 0 ? formatCurrencyINR(val) : '—'}
          </div>
        );
      },
    },
    {
      key: 'updatedAt',
      header: 'Date Logged',
      render: (p) => {
        const d = p.submittedAt || p.submissionDate || p.updatedAt || p.createdAt;
        return (
          <span className="text-xs text-slate-600 font-mono">
            {d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Statutory Status',
      align: 'center',
      render: (p) => <StatusBadge status={p.status} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (p) => {
        const isDraft = (p.status || '').toUpperCase() === 'DRAFT';
        return (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button
              variant={isDraft ? 'gov' : 'outline'}
              size="sm"
              onClick={() => onNavigate(`/agency/tenders/${p.tenderId}/proposal`)}
              icon={isDraft ? Edit : Eye}
              className="text-xs px-2.5 py-1"
            >
              {isDraft ? 'Resume Draft' : 'View Bid'}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div id="submitted-proposals-page" className="space-y-6 max-w-6xl mx-auto pb-16">
      <PageHeader
        title="My Bids & Proposal Repository"
        subtitle="Manage working drafts, track locked submissions, and monitor government evaluation status."
        actions={
          <Button
            variant="gov"
            size="sm"
            onClick={() => onNavigate('/agency/tenders')}
            icon={Plus}
          >
            Explore Live Tenders
          </Button>
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-[#002B49] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Opportunities ({proposals.length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('DRAFT')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
            statusFilter === 'DRAFT'
              ? 'bg-[#002B49] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Working Drafts ({proposals.filter((p) => (p.status || '').toUpperCase() === 'DRAFT').length})
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
          Sealed & In Review (
          {
            proposals.filter((p) => {
              const s = (p.status || '').toUpperCase().replace(/\s+/g, '_');
              return s === 'SUBMITTED' || s === 'UNDER_REVIEW';
            }).length
          }
          )
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('DECIDED')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
            statusFilter === 'DECIDED'
              ? 'bg-[#002B49] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Decided / Awarded (
          {
            proposals.filter((p) => {
              const s = (p.status || '').toUpperCase();
              return s === 'AWARDED' || s === 'REJECTED' || s === 'SHORTLISTED';
            }).length
          }
          )
        </button>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-slate-500 text-xs animate-pulse">
          Loading proposal repository...
        </Card>
      ) : filteredProposals.length === 0 ? (
        <Card className="p-12 text-center space-y-3 border-slate-200">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-[#002B49] flex items-center justify-center mx-auto">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">No Proposals in this Category</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Explore live public tenders matching your statutory capabilities and prepare a structured proposal.
          </p>
          <Button variant="outline" size="sm" onClick={() => onNavigate('/agency/tenders')}>
            Browse Live Tenders
          </Button>
        </Card>
      ) : (
        <Table
          data={filteredProposals}
          columns={columns}
          keyExtractor={(p) => p.id}
          onRowClick={(p) => onNavigate(`/agency/tenders/${p.tenderId}/proposal`)}
        />
      )}
    </div>
  );
};
