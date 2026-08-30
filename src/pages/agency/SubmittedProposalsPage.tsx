import React from 'react';
import { FileCheck2, Clock, Eye, Download, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { mockProposals } from '../../data/mockData';
import { Proposal } from '../../types';

export const SubmittedProposalsPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const myBids = mockProposals;

  const columns: Column<Proposal>[] = [
    {
      key: 'proposalNumber',
      header: 'Bid Ref ID',
      width: '140px',
      render: (p) => <span className="font-mono text-xs font-bold text-slate-900">{p.proposalNumber}</span>,
    },
    {
      key: 'tenderTitle',
      header: 'Tender Work Scope',
      render: (p) => (
        <div>
          <div className="font-bold text-slate-900 text-xs">{p.tenderTitle}</div>
          <div className="text-[11px] text-slate-400 font-mono">{p.tenderNumber}</div>
        </div>
      ),
    },
    {
      key: 'financialBidAmount',
      header: 'Quoted Bid (₹)',
      align: 'right',
      render: (p) => (
        <span className="font-bold text-slate-900">
          ₹ {(p.financialBidAmount / 10000000).toFixed(2)} Cr
        </span>
      ),
    },
    {
      key: 'technicalScore',
      header: 'Technical Score',
      align: 'center',
      render: (p) => <span className="font-semibold text-xs text-slate-700">{p.technicalScore} / 100</span>,
    },
    {
      key: 'submissionDate',
      header: 'Submitted On',
      render: (p) => <span className="text-xs text-slate-600 font-mono">{p.submissionDate}</span>,
    },
    {
      key: 'status',
      header: 'Evaluation Status',
      align: 'center',
      render: (p) => <StatusBadge status={p.status} size="sm" />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Submitted Bids & Proposals"
        subtitle="Track real-time evaluation status, L1 rank determinations, and contract awards."
      />

      <Table
        data={myBids}
        columns={columns}
        keyExtractor={(p) => p.id}
      />
    </div>
  );
};
