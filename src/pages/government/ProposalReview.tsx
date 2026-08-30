import React, { useState } from 'react';
import {
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  Award,
  Sparkles,
  Building2,
  Download,
  Eye,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  Coins,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { RiskBadge } from '../../components/ui/RiskBadge';
import { Modal } from '../../components/ui/Modal';
import { Drawer } from '../../components/ui/Drawer';
import { useToast } from '../../context/ToastContext';
import { mockProposals, mockTenders } from '../../data/mockData';
import { Proposal } from '../../types';

export interface ProposalReviewProps {
  onNavigate: (path: string) => void;
}

export const ProposalReview: React.FC<ProposalReviewProps> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [proposals, setProposals] = useState<Proposal[]>(mockProposals);
  const [selectedTenderId, setSelectedTenderId] = useState<string>('All');
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const filteredProposals = proposals.filter((p) => {
    if (selectedTenderId !== 'All' && p.tenderId !== selectedTenderId) return false;
    return true;
  });

  const handleAwardProposal = (proposal: Proposal) => {
    showToast('Tender Awarded', {
      message: `Contract successfully awarded to ${proposal.agencyName}. Milestone agreement generated.`,
      type: 'success',
    });
    setProposals((prev) =>
      prev.map((p) => (p.id === proposal.id ? { ...p, status: 'Awarded' } : p))
    );
    setSelectedProposal(null);
  };

  const columns: Column<Proposal>[] = [
    {
      key: 'agencyName',
      header: 'Bidding Agency',
      render: (p) => (
        <div>
          <div className="font-bold text-slate-900 line-clamp-1">{p.agencyName}</div>
          <div className="text-[11px] text-slate-500 font-mono">GSTIN: {p.agencyGstin}</div>
        </div>
      ),
    },
    {
      key: 'tenderTitle',
      header: 'Tender Title',
      render: (p) => (
        <div>
          <div className="font-semibold text-slate-900 text-xs line-clamp-1">{p.tenderTitle}</div>
          <div className="text-[11px] text-slate-400 font-mono">{p.tenderNumber}</div>
        </div>
      ),
    },
    {
      key: 'financialBidAmount',
      header: 'Financial Quote',
      align: 'right',
      render: (p) => (
        <div>
          <div className="font-bold text-slate-900">
            ₹ {(p.financialBidAmount / 10000000).toFixed(2)} Cr
          </div>
          <div className="text-[10px] text-slate-400 font-mono">L1 / Rank 1</div>
        </div>
      ),
    },
    {
      key: 'technicalScore',
      header: 'Tech Score',
      align: 'center',
      render: (p) => (
        <span className="font-semibold text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
          {p.technicalScore} / 100
        </span>
      ),
    },
    {
      key: 'aiEvaluationScore',
      header: 'AI Integrity Score',
      align: 'center',
      render: (p) => (
        <div className="inline-flex items-center gap-1 font-bold text-xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span className={p.aiEvaluationScore >= 80 ? 'text-emerald-700' : 'text-amber-700'}>
            {p.aiEvaluationScore}%
          </span>
        </div>
      ),
    },
    {
      key: 'collusionRiskLevel',
      header: 'Collusion Risk',
      align: 'center',
      render: (p) => <RiskBadge score={p.collusionRiskScore} level={p.collusionRiskLevel} size="sm" />,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (p) => <StatusBadge status={p.status} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Evaluation',
      align: 'right',
      render: (p) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedProposal(p)}
            icon={Eye}
            className="text-xs px-2.5 py-1"
          >
            Audit
          </Button>
          {p.status === 'Submitted' && (
            <Button
              variant="gov"
              size="sm"
              onClick={() => handleAwardProposal(p)}
              className="text-xs px-2.5 py-1"
            >
              Award
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Automated Proposal Evaluation & Bid Scoring"
        subtitle="AI comparative analysis, technical eligibility verification, and anti-collusion scoring."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Sparkles}
              onClick={() => setIsCompareOpen(true)}
            >
              Compare Tender Bids (L1 vs L2)
            </Button>
          </div>
        }
      />

      {/* Tender Selector Filter */}
      <Card padding="sm" className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Filter by Tender:</span>
          <select
            value={selectedTenderId}
            onChange={(e) => setSelectedTenderId(e.target.value)}
            className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none cursor-pointer"
          >
            <option value="All">All Live Tenders ({proposals.length} Bids)</option>
            {mockTenders.map((t) => (
              <option key={t.id} value={t.id}>
                {t.tenderNumber} - {t.title.substring(0, 45)}...
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500">
          Showing <strong className="text-slate-900">{filteredProposals.length}</strong> submitted proposals
        </div>
      </Card>

      {/* Proposals Table */}
      <Table
        data={filteredProposals}
        columns={columns}
        keyExtractor={(p) => p.id}
        onRowClick={(p) => setSelectedProposal(p)}
      />

      {/* Drawer: Detailed AI Proposal Audit */}
      <Drawer
        isOpen={Boolean(selectedProposal)}
        onClose={() => setSelectedProposal(null)}
        width="xl"
        title={
          <div>
            <div className="text-xs font-mono font-bold text-slate-500">{selectedProposal?.proposalNumber}</div>
            <div className="text-base font-bold text-slate-900 mt-0.5">{selectedProposal?.agencyName}</div>
          </div>
        }
        footer={
          selectedProposal && (
            <div className="flex items-center justify-between w-full">
              <Button variant="outline" size="sm" onClick={() => setSelectedProposal(null)}>
                Dismiss
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedProposal(null);
                    onNavigate('/government/investigations');
                  }}
                  icon={ShieldAlert}
                  className="text-rose-700 border-rose-200"
                >
                  Flag for Investigation
                </Button>
                {selectedProposal.status === 'Submitted' && (
                  <Button
                    variant="gov"
                    size="sm"
                    onClick={() => handleAwardProposal(selectedProposal)}
                    icon={Award}
                  >
                    Award MPLAD Contract
                  </Button>
                )}
              </div>
            </div>
          )
        }
      >
        {selectedProposal && (
          <div className="space-y-6">
            {/* Score Summary Box */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Financial Quote</div>
                <div className="text-sm font-extrabold text-slate-900 mt-1">
                  ₹ {(selectedProposal.financialBidAmount / 10000000).toFixed(2)} Cr
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Technical Score</div>
                <div className="text-sm font-extrabold text-slate-900 mt-1">
                  {selectedProposal.technicalScore} / 100
                </div>
              </div>
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
                <div className="text-[10px] text-emerald-800 font-semibold uppercase">AI Merit Score</div>
                <div className="text-sm font-extrabold text-emerald-900 mt-1">
                  {selectedProposal.aiEvaluationScore}%
                </div>
              </div>
            </div>

            {/* AI Flags Section */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                Automated Integrity Audit Findings
              </h4>
              {selectedProposal.flags && selectedProposal.flags.length > 0 ? (
                <div className="space-y-2">
                  {selectedProposal.flags.map((flag, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-rose-50 border border-rose-200/80 rounded-lg flex items-start gap-2.5 text-xs text-rose-900"
                    >
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{flag}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-lg flex items-center gap-2 text-xs text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>No suspicious bidding patterns or cartel flags detected for this submission.</span>
                </div>
              )}
            </div>

            {/* Line Items BoQ Breakdown */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                Line-Item BoQ Rate Comparison
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="p-2.5">BoQ Item</th>
                      <th className="p-2.5 text-right">Quoted Rate</th>
                      <th className="p-2.5 text-right">DSR Benchmark</th>
                      <th className="p-2.5 text-center">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2.5 text-slate-800">Reinforced Concrete (M25)</td>
                      <td className="p-2.5 text-right font-mono">₹ 7,450/m³</td>
                      <td className="p-2.5 text-right font-mono text-slate-500">₹ 7,200/m³</td>
                      <td className="p-2.5 text-center font-bold text-emerald-600">+3.4%</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-slate-800">Structural Steel TMT Bars</td>
                      <td className="p-2.5 text-right font-mono">₹ 68,000/MT</td>
                      <td className="p-2.5 text-right font-mono text-slate-500">₹ 67,500/MT</td>
                      <td className="p-2.5 text-center font-bold text-emerald-600">+0.7%</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-slate-800">Plumbing & Sanitary Line</td>
                      <td className="p-2.5 text-right font-mono">₹ 14,20,000</td>
                      <td className="p-2.5 text-right font-mono text-slate-500">₹ 13,80,000</td>
                      <td className="p-2.5 text-center font-bold text-emerald-600">+2.8%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Contractor Compliance Profile */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="font-bold text-slate-900">Contractor Verification Data</div>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>GSTIN Active Status: <strong className="text-emerald-700">Verified Live</strong></div>
                <div>EPFO Compliance: <strong className="text-slate-900">Compliant (142 Staff)</strong></div>
                <div>Past MPLAD Works: <strong className="text-slate-900">4 Completed On-Time</strong></div>
                <div>Blacklisting Status: <strong className="text-emerald-700">Clear</strong></div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Modal: Side-by-Side Bids Comparison */}
      <Modal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        maxWidth="4xl"
        title="Side-by-Side Competitive Bid Evaluation"
        description="Comparative analysis of competing vendor bids for tender TND/MPLAD/2025/1042."
        footer={
          <Button variant="outline" size="sm" onClick={() => setIsCompareOpen(false)}>
            Close Comparison
          </Button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mockProposals.slice(0, 2).map((prop, idx) => (
            <Card key={prop.id} variant="flat" className="p-4.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#002B49]">{idx === 0 ? 'Bidder A (L1)' : 'Bidder B (L2)'}</span>
                <StatusBadge status={prop.status} size="sm" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">{prop.agencyName}</h4>
              <div className="text-xl font-extrabold text-slate-900">
                ₹ {(prop.financialBidAmount / 10000000).toFixed(2)} Cr
              </div>
              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-200">
                <div className="flex justify-between">
                  <span>Technical Score:</span>
                  <strong className="text-slate-900">{prop.technicalScore}/100</strong>
                </div>
                <div className="flex justify-between">
                  <span>AI Integrity Score:</span>
                  <strong className="text-emerald-700">{prop.aiEvaluationScore}%</strong>
                </div>
                <div className="flex justify-between">
                  <span>Cartel Risk Index:</span>
                  <strong className={prop.collusionRiskScore > 30 ? 'text-rose-700' : 'text-emerald-700'}>
                    {prop.collusionRiskScore}/100 ({prop.collusionRiskLevel})
                  </strong>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Modal>
    </div>
  );
};
