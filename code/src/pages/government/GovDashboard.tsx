import React, { useState } from 'react';
import {
  FileSpreadsheet,
  AlertTriangle,
  FolderKanban,
  Coins,
  SearchCheck,
  TrendingUp,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Download,
  Filter,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { StatCard } from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, Column } from '../../components/ui/Table';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { RiskBadge } from '../../components/ui/RiskBadge';
import { PageHeader } from '../../components/ui/PageHeader';
import { DonutChart } from '../../components/charts/DonutChart';
import { BarProgressChart } from '../../components/charts/BarProgressChart';
import { LineTrendChart } from '../../components/charts/LineTrendChart';
import { SyntheticDataNotice } from '../../components/common/SyntheticDataNotice';
import {
  mockStats,
  mockTenders,
  mockAnomalyAlerts,
  mockTrendData,
  mockFundOverview,
} from '../../data/mockData';
import { Tender, AnomalyAlert } from '../../types';

export interface GovDashboardProps {
  onNavigate: (path: string) => void;
  onSelectTender?: (tender: Tender) => void;
}

export const GovDashboard: React.FC<GovDashboardProps> = ({ onNavigate, onSelectTender }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const tenderColumns: Column<Tender>[] = [
    {
      key: 'tenderNumber',
      header: 'Tender ID',
      width: '140px',
      render: (t) => <span className="font-mono text-xs font-bold text-slate-800">{t.tenderNumber}</span>,
    },
    {
      key: 'title',
      header: 'Project / Scope',
      render: (t) => (
        <div>
          <div className="font-semibold text-slate-900 line-clamp-1">{t.title}</div>
          <div className="text-[11px] text-slate-500">{t.constituency}, {t.state}</div>
        </div>
      ),
    },
    {
      key: 'estimatedCost',
      header: 'Estimated Cost',
      align: 'right',
      render: (t) => (
        <span className="font-semibold text-slate-900">
          ₹ {(t.estimatedCost / 10000000).toFixed(2)} Cr
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (t) => <StatusBadge status={t.status} size="sm" />,
    },
    {
      key: 'riskLevel',
      header: 'AI Risk',
      align: 'center',
      render: (t) => <RiskBadge score={t.riskScore} level={t.riskLevel} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (t) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (onSelectTender) onSelectTender(t);
            onNavigate('/government/tenders');
          }}
          className="text-[#002B49] text-xs px-2.5 py-1"
        >
          View
        </Button>
      ),
    },
  ];

  const donutSegments = [
    { label: 'High Risk', value: mockStats.highRiskProjects, color: '#f43f5e', percentage: 18.5 },
    { label: 'Medium Risk', value: mockStats.mediumRiskProjects, color: '#f59e0b', percentage: 41.1 },
    { label: 'Low Risk', value: mockStats.lowRiskProjects, color: '#10b981', percentage: 40.4 },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      <SyntheticDataNotice variant="banner" />

      {/* Page Header */}
      <PageHeader
        title="MPLAD Scheme Executive Dashboard"
        subtitle="Real-time algorithmic monitoring, procurement integrity index & fund tracking."
        badge={
          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100/80 text-[#002B49]">
            Active Surveillance Active
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              isLoading={isRefreshing}
              onClick={handleRefresh}
            >
              Refresh Data
            </Button>
            <Button
              variant="gov"
              size="sm"
              icon={Plus}
              onClick={() => onNavigate('/government/tenders')}
            >
              New Tender
            </Button>
          </div>
        }
      />

      {/* 1. Five Summary Metric Cards (Exact match to reference UI) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Projects"
          value={mockStats.totalProjects}
          trend={{ value: '12.4%', isPositive: true, label: 'vs last month' }}
          icon={FolderKanban}
          iconColor="blue"
          indicatorColor="#002B49"
        />
        <StatCard
          label="High Risk Projects"
          value={mockStats.highRiskProjects}
          trend={{ value: '3.2%', isPositive: false, label: 'requires audit' }}
          icon={AlertTriangle}
          iconColor="rose"
          indicatorColor="#f43f5e"
        />
        <StatCard
          label="Sanctioned Amount"
          value={`₹ ${mockStats.totalAllocationCr} Cr`}
          trend={{ value: '60.6%', isPositive: true, label: 'utilized' }}
          icon={Coins}
          iconColor="navy"
          indicatorColor="#002B49"
        />
        <StatCard
          label="Active Tenders"
          value={mockStats.activeTenders}
          trend={{ value: '8 in evaluation', isPositive: true }}
          icon={FileSpreadsheet}
          iconColor="amber"
          indicatorColor="#f59e0b"
        />
        <StatCard
          label="Fraud Inquiries"
          value={mockStats.activeInvestigations}
          trend={{ value: '2 under CBI/CVC', isPositive: false }}
          icon={SearchCheck}
          iconColor="rose"
          indicatorColor="#f43f5e"
        />
      </div>

      {/* 2. Middle Row: Risk Distribution Donut & Fund Utilization Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Risk Distribution Card */}
        <Card className="lg:col-span-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Project Risk Distribution</h3>
              <p className="text-xs text-slate-500">AI Risk Matrix classification across active sanctions</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('/government/risk-alerts')}
              className="text-xs text-[#002B49]"
            >
              View Alerts
            </Button>
          </div>

          <div className="py-2 flex items-center justify-center">
            <DonutChart
              segments={donutSegments}
              totalLabel="Total Projects"
              totalValue={mockStats.totalProjects}
              size={180}
              strokeWidth={22}
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>High Risk Threshold: Score &ge; 60</span>
            <span className="font-semibold text-rose-700">46 Flags Triggered</span>
          </div>
        </Card>

        {/* Right: Fund Utilization Breakdown */}
        <Card className="lg:col-span-7 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">MPLAD Fund Utilization Overview</h3>
              <p className="text-xs text-slate-500">Ministry of Statistics and Programme Implementation ledger</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('/government/analytics')}
              icon={Download}
              className="text-xs text-slate-600"
            >
              Export Report
            </Button>
          </div>

          <BarProgressChart
            totalAllocation={mockFundOverview.totalAllocation}
            totalAllocationFormatted={mockFundOverview.totalAllocationFormatted}
            year={mockFundOverview.year}
            utilized={mockFundOverview.utilized}
            unutilized={mockFundOverview.unutilized}
          />

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Expenditure tracked via Public Financial Management System (PFMS)</span>
            <span className="font-semibold text-emerald-700">Reconciliation OK</span>
          </div>
        </Card>
      </div>

      {/* 3. Third Row: Risk Trend Over Time + Active Anomaly Flags list */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Risk Trend Chart */}
        <Card className="lg:col-span-7">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Daily Risk & Anomaly Ingestion Trend</h3>
              <p className="text-xs text-slate-500">7-Day signal volume across technical & financial bids</p>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              Last 7 Days
            </span>
          </div>

          <LineTrendChart data={mockTrendData} height={190} />
        </Card>

        {/* Priority AI Anomaly Flags Box */}
        <Card className="lg:col-span-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Priority Anomaly Alerts</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('/government/risk-alerts')}
              className="text-xs text-[#002B49]"
            >
              All Alerts ({mockAnomalyAlerts.length})
            </Button>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[190px]">
            {mockAnomalyAlerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                onClick={() => onNavigate('/government/risk-alerts')}
                className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 rounded-xl cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-xs text-slate-900 line-clamp-1">{alert.title}</div>
                  <RiskBadge score={alert.riskScore} size="sm" />
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-1 mt-1">{alert.evidenceSummary}</p>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2">
                  <span>{alert.tenderTitle || alert.projectTitle}</span>
                  <span className="font-medium text-rose-700">{alert.confidenceScore}% Model Confidence</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Action Required by Nodal Committee</span>
            <Button
              variant="danger"
              size="sm"
              onClick={() => onNavigate('/government/risk-alerts')}
              className="text-xs py-1 px-2.5"
            >
              Review Flagged Bids
            </Button>
          </div>
        </Card>
      </div>

      {/* 4. Bottom Row: Active Tenders List Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Recent MPLAD Tender Publications</h3>
            <p className="text-xs text-slate-500">Live e-procurement tenders and evaluation statuses</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('/government/tenders')}
            icon={ArrowRight}
            iconPosition="right"
          >
            All Tenders ({mockTenders.length})
          </Button>
        </div>

        <Table
          data={mockTenders.slice(0, 5)}
          columns={tenderColumns}
          keyExtractor={(t) => t.id}
          onRowClick={(t) => {
            if (onSelectTender) onSelectTender(t);
            onNavigate('/government/tenders');
          }}
        />
      </div>
    </div>
  );
};
