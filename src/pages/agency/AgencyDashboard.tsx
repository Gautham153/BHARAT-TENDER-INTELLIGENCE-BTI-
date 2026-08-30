import React from 'react';
import {
  FileSpreadsheet,
  Building2,
  FolderKanban,
  Coins,
  Award,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Receipt,
  FileCheck2,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, Column } from '../../components/ui/Table';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { SyntheticDataNotice } from '../../components/common/SyntheticDataNotice';
import { mockTenders, mockProjects, mockProposals } from '../../data/mockData';
import { Tender, Project } from '../../types';

export const AgencyDashboard: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const wonProjects = mockProjects.filter((p) => p.executingAgencyName.includes('Vikramaditya'));

  const tenderColumns: Column<Tender>[] = [
    {
      key: 'tenderNumber',
      header: 'Tender ID',
      width: '140px',
      render: (t) => <span className="font-mono text-xs font-bold text-slate-900">{t.tenderNumber}</span>,
    },
    {
      key: 'title',
      header: 'Scope of Work',
      render: (t) => (
        <div>
          <div className="font-semibold text-slate-900 line-clamp-1">{t.title}</div>
          <div className="text-[11px] text-slate-500">{t.constituency}, {t.state}</div>
        </div>
      ),
    },
    {
      key: 'estimatedCost',
      header: 'Sanctioned Cost',
      align: 'right',
      render: (t) => (
        <span className="font-bold text-slate-900">
          ₹ {(t.estimatedCost / 10000000).toFixed(2)} Cr
        </span>
      ),
    },
    {
      key: 'closingDate',
      header: 'Bidding Closes',
      render: (t) => <span className="text-xs font-mono text-slate-600">{t.closingDate}</span>,
    },
    {
      key: 'actions',
      header: 'Bidding',
      align: 'right',
      render: (t) => (
        <Button
          variant="gov"
          size="sm"
          onClick={() => onNavigate('/agency/tenders')}
          className="text-xs px-2.5 py-1"
        >
          Submit Bid
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <SyntheticDataNotice variant="banner" />

      {/* Header */}
      <PageHeader
        title="Agency & Vendor Execution Workspace"
        subtitle="Vikramaditya Infrastructure Ltd (GSTIN: 09AABCV9821L1ZM) • Tier-1 Verified Contractor"
        badge={
          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>GST & CVC Verified</span>
          </span>
        }
        actions={
          <Button
            variant="gov"
            size="sm"
            onClick={() => onNavigate('/agency/tenders')}
            icon={FileSpreadsheet}
          >
            Browse Open Tenders
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Contracts"
          value="4 Works"
          trend={{ value: '100% on schedule', isPositive: true }}
          icon={FolderKanban}
          iconColor="emerald"
          indicatorColor="#046A38"
        />
        <StatCard
          label="Total Sanctioned Value"
          value="₹ 14.80 Cr"
          trend={{ value: '₹ 8.2 Cr received', isPositive: true }}
          icon={Coins}
          iconColor="navy"
          indicatorColor="#002B49"
        />
        <StatCard
          label="Live Bids Under Scoring"
          value="2 Proposals"
          trend={{ value: 'L1 in 1 tender', isPositive: true }}
          icon={FileCheck2}
          iconColor="blue"
          indicatorColor="#2563EB"
        />
        <StatCard
          label="Disbursement Claims Pending"
          value="₹ 1.25 Cr"
          trend={{ value: 'Under Nodal Audit', isPositive: true }}
          icon={Receipt}
          iconColor="amber"
          indicatorColor="#f59e0b"
        />
      </div>

      {/* Active Assigned Works & Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Active Contract Execution Progress</h3>
              <p className="text-xs text-slate-500">Milestone submissions and physical progress gating</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('/agency/milestones')}
              className="text-xs text-[#002B49]"
            >
              All Milestones
            </Button>
          </div>

          <div className="space-y-4">
            {mockProjects.slice(0, 3).map((proj) => (
              <div key={proj.id} className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-500">{proj.projectCode}</span>
                    <h4 className="font-bold text-slate-900 text-xs">{proj.title}</h4>
                  </div>
                  <StatusBadge status={proj.status} size="sm" />
                </div>
                <ProgressBar
                  label="Physical Site Progress"
                  value={proj.physicalProgress}
                  color="emerald"
                  size="sm"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Sanction: ₹ {(proj.sanctionedBudget / 10000000).toFixed(2)} Cr</span>
                  <span className="font-semibold text-slate-800">Target: {proj.targetCompletionDate}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Agency Compliance Scorecard */}
        <Card className="lg:col-span-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Contractor Quality & Trust Index</h3>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                Tier-1 / 94 Score
              </span>
            </div>

            <div className="space-y-3 pt-3 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>GST Return Regularity</span>
                </div>
                <strong className="text-emerald-700">100% GSTR-3B Filed</strong>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>On-Time Milestone Rate</span>
                </div>
                <strong className="text-slate-900">92% Compliance</strong>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>CVC & Blacklist Status</span>
                </div>
                <strong className="text-emerald-700">Clean Certificate</strong>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('/agency/compliance')}
            className="w-full mt-4"
          >
            Manage GST & Bank Account Details
          </Button>
        </Card>
      </div>

      {/* Recommended Open Tenders Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Open MPLAD Tenders Matching Your Category</h3>
            <p className="text-xs text-slate-500">Eligible e-procurement opportunities open for bidding</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('/agency/tenders')}
            icon={ArrowRight}
            iconPosition="right"
          >
            All Live Tenders
          </Button>
        </div>

        <Table
          data={mockTenders.filter((t) => t.status === 'Open')}
          columns={tenderColumns}
          keyExtractor={(t) => t.id}
        />
      </div>
    </div>
  );
};
