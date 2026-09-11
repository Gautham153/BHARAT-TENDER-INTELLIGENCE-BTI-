import React, { useState } from 'react';
import {
  Plus,
  FileSpreadsheet,
  Download,
  Filter,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  Calendar,
  IndianRupee,
  Layers,
  FileText,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { RiskBadge } from '../../components/ui/RiskBadge';
import { SearchBar } from '../../components/ui/SearchBar';
import { FilterBar } from '../../components/ui/FilterBar';
import { Modal } from '../../components/ui/Modal';
import { Drawer } from '../../components/ui/Drawer';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { useToast } from '../../context/ToastContext';
import { mockTenders } from '../../data/mockData';
import { Tender, TenderStatus } from '../../types';

export interface TenderManagementProps {
  onNavigate: (path: string) => void;
  onSelectTender?: (tender: Tender) => void;
}

export const TenderManagement: React.FC<TenderManagementProps> = ({ onNavigate, onSelectTender }) => {
  const { showToast } = useToast();
  const [tenders, setTenders] = useState<Tender[]>(mockTenders);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Tender Form State
  const [newTender, setNewTender] = useState({
    title: '',
    category: 'Healthcare Infrastructure',
    constituency: 'Varanasi',
    state: 'Uttar Pradesh',
    estimatedCost: '',
    durationDays: '180',
    description: '',
    mpName: 'Sh. Narendra Modi',
  });

  const filteredTenders = tenders.filter((t) => {
    if (statusFilter !== 'All' && t.status !== statusFilter) return false;
    if (categoryFilter !== 'All' && t.category !== categoryFilter) return false;
    if (
      searchQuery &&
      !t.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !t.tenderNumber.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !t.constituency.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleCreateTender = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTender.title || !newTender.estimatedCost) {
      showToast('Validation Error', { message: 'Please provide tender title and estimated cost.', type: 'warning' });
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const created: Tender = {
        id: `tnd-${Date.now()}`,
        tenderNumber: `TND/MPLAD/2025/${Math.floor(1000 + Math.random() * 9000)}`,
        title: newTender.title,
        description: newTender.description || 'Draft scope of works under MPLAD sanction scheme.',
        category: newTender.category as any,
        constituency: newTender.constituency,
        state: newTender.state,
        mpName: newTender.mpName,
        estimatedCost: parseFloat(newTender.estimatedCost) * 10000000,
        publishedDate: new Date().toISOString().split('T')[0],
        closingDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        status: 'Open',
        riskScore: 12,
        riskLevel: 'LOW',
        proposalsCount: 0,
        anomaliesCount: 0,
        createdBy: 'District Nodal Officer',
      };

      setTenders([created, ...tenders]);
      setIsSubmitting(false);
      setIsCreateModalOpen(false);
      showToast('Tender Published Successfully', {
        message: `${created.tenderNumber} is now live for agency bidding.`,
        type: 'success',
      });
      setNewTender({
        title: '',
        category: 'Healthcare Infrastructure',
        constituency: 'Varanasi',
        state: 'Uttar Pradesh',
        estimatedCost: '',
        durationDays: '180',
        description: '',
        mpName: 'Sh. Narendra Modi',
      });
    }, 600);
  };

  const columns: Column<Tender>[] = [
    {
      key: 'tenderNumber',
      header: 'Tender ID',
      width: '140px',
      render: (t) => <span className="font-mono text-xs font-bold text-slate-900">{t.tenderNumber}</span>,
    },
    {
      key: 'title',
      header: 'Tender Title & Location',
      render: (t) => (
        <div>
          <div className="font-semibold text-slate-900 line-clamp-1">{t.title}</div>
          <div className="text-[11px] text-slate-500">{t.constituency}, {t.state} • MP: {t.mpName}</div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (t) => <span className="text-xs text-slate-700 font-medium">{t.category}</span>,
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
      header: 'Deadline',
      render: (t) => <span className="text-xs text-slate-600 font-mono">{t.closingDate}</span>,
    },
    {
      key: 'proposalsCount',
      header: 'Bids',
      align: 'center',
      render: (t) => (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
          {t.proposalsCount}
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
      header: 'AI Integrity',
      align: 'center',
      render: (t) => <RiskBadge score={t.riskScore} level={t.riskLevel} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (t) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedTender(t)}
            icon={Eye}
            className="text-xs px-2 py-1"
          >
            Details
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (onSelectTender) onSelectTender(t);
              onNavigate('/government/proposals');
            }}
            className="text-xs px-2 py-1"
          >
            Review Bids
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="MPLAD Tender Management"
        subtitle="Publish tenders, configure structured BoQ benchmark rates, and track submissions."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={() => showToast('Export Initialized', { message: 'Tender register downloaded in XLSX format.' })}
            >
              Export Register
            </Button>
            <Button
              variant="gov"
              size="sm"
              icon={Plus}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Publish New Tender
            </Button>
          </div>
        }
      />

      {/* Filter & Search Bar */}
      <Card padding="sm" className="space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-full md:w-80">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by tender title, ID, constituency..."
            />
          </div>
          <div className="flex-1 w-full">
            <FilterBar
              filters={[
                {
                  key: 'status',
                  label: 'Status',
                  currentValue: statusFilter,
                  onChange: setStatusFilter,
                  options: [
                    { label: 'Open for Bidding', value: 'Open' },
                    { label: 'Under AI Evaluation', value: 'Under Evaluation' },
                    { label: 'Awarded', value: 'Awarded' },
                    { label: 'Closed / Finalized', value: 'Closed' },
                  ],
                },
                {
                  key: 'category',
                  label: 'Sector',
                  currentValue: categoryFilter,
                  onChange: setCategoryFilter,
                  options: [
                    { label: 'Healthcare Infrastructure', value: 'Healthcare Infrastructure' },
                    { label: 'Rural Road Construction', value: 'Rural Road Construction' },
                    { label: 'Drinking Water Project', value: 'Drinking Water Project' },
                    { label: 'Community Infrastructure', value: 'Community Infrastructure' },
                    { label: 'Educational Facilities', value: 'Educational Facilities' },
                  ],
                },
              ]}
              onReset={() => {
                setStatusFilter('All');
                setCategoryFilter('All');
                setSearchQuery('');
              }}
            />
          </div>
        </div>
      </Card>

      {/* Main Tenders Table */}
      <Table
        data={filteredTenders}
        columns={columns}
        keyExtractor={(t) => t.id}
        onRowClick={(t) => setSelectedTender(t)}
        emptyText="No tenders found matching selected filter criteria."
      />

      {/* Drawer: Detailed Tender View */}
      <Drawer
        isOpen={Boolean(selectedTender)}
        onClose={() => setSelectedTender(null)}
        width="xl"
        title={
          <div>
            <div className="text-xs font-mono font-bold text-slate-500">{selectedTender?.tenderNumber}</div>
            <div className="text-base font-bold text-slate-900 mt-0.5">{selectedTender?.title}</div>
          </div>
        }
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedTender(null)}
            >
              Close
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={() => showToast('NIT Downloaded', { message: 'Notice Inviting Tender PDF downloaded.' })}
              >
                Download NIT
              </Button>
              <Button
                variant="gov"
                size="sm"
                onClick={() => {
                  if (selectedTender && onSelectTender) onSelectTender(selectedTender);
                  setSelectedTender(null);
                  onNavigate('/government/proposals');
                }}
              >
                Evaluate {selectedTender?.proposalsCount} Submitted Bids
              </Button>
            </div>
          </div>
        }
      >
        {selectedTender && (
          <div className="space-y-6">
            {/* Status & Risk Banner */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-500 uppercase font-semibold">Tender Workflow Status</div>
                <div className="mt-1">
                  <StatusBadge status={selectedTender.status} />
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-500 uppercase font-semibold">AI Risk Matrix</div>
                <div className="mt-1">
                  <RiskBadge score={selectedTender.riskScore} level={selectedTender.riskLevel} />
                </div>
              </div>
            </div>

            {/* Core Specifications */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 block mb-1">Sanctioned Estimate</span>
                <span className="text-base font-extrabold text-slate-900">
                  ₹ {(selectedTender.estimatedCost / 10000000).toFixed(2)} Crores
                </span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 block mb-1">Bidding Window</span>
                <span className="text-sm font-bold text-slate-800">
                  {selectedTender.publishedDate} to {selectedTender.closingDate}
                </span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 block mb-1">Constituency & State</span>
                <span className="text-sm font-bold text-slate-800">
                  {selectedTender.constituency}, {selectedTender.state}
                </span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 block mb-1">Recommending MP</span>
                <span className="text-sm font-bold text-slate-800">{selectedTender.mpName}</span>
              </div>
            </div>

            {/* Scope & Description */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">Scope of Work & Technical BoQ</h4>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                {selectedTender.description}
              </p>
            </div>

            {/* AI Integrity Observations */}
            <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#002B49]">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>AI Automated Pre-Publication Checks Passed</span>
              </div>
              <ul className="text-xs text-slate-600 space-y-1 pl-6 list-disc">
                <li>Estimated cost matches District Schedule of Rates (DSR-2024).</li>
                <li>No overlapping geographic coordinates found with existing MPLAD sanctions.</li>
                <li>Geofenced site polygon registered in National GIS repository.</li>
              </ul>
            </div>
          </div>
        )}
      </Drawer>

      {/* Modal: Create New Tender Wizard */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        maxWidth="2xl"
        title="Publish New MPLAD Tender"
        description="Draft and issue a sanctioned Member of Parliament development tender."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="gov"
              size="sm"
              onClick={handleCreateTender}
              isLoading={isSubmitting}
            >
              Publish to Agency Portal
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateTender} className="space-y-4">
          <Input
            label="Tender Title / Work Description"
            required
            value={newTender.title}
            onChange={(e) => setNewTender({ ...newTender, title: e.target.value })}
            placeholder="e.g. Construction of Community Health Center Ward 14"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Development Sector"
              value={newTender.category}
              onChange={(e) => setNewTender({ ...newTender, category: e.target.value })}
              options={[
                { label: 'Healthcare Infrastructure', value: 'Healthcare Infrastructure' },
                { label: 'Rural Road Construction', value: 'Rural Road Construction' },
                { label: 'Drinking Water Project', value: 'Drinking Water Project' },
                { label: 'Community Infrastructure', value: 'Community Infrastructure' },
                { label: 'Educational Facilities', value: 'Educational Facilities' },
              ]}
            />
            <Input
              label="Sanctioned Cost (₹ In Crores)"
              required
              type="number"
              step="0.01"
              value={newTender.estimatedCost}
              onChange={(e) => setNewTender({ ...newTender, estimatedCost: e.target.value })}
              placeholder="e.g. 1.85"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Constituency"
              value={newTender.constituency}
              onChange={(e) => setNewTender({ ...newTender, constituency: e.target.value })}
            />
            <Input
              label="State"
              value={newTender.state}
              onChange={(e) => setNewTender({ ...newTender, state: e.target.value })}
            />
            <Input
              label="Recommending MP"
              value={newTender.mpName}
              onChange={(e) => setNewTender({ ...newTender, mpName: e.target.value })}
            />
          </div>

          <Textarea
            label="Technical Scope & Special Conditions"
            rows={3}
            value={newTender.description}
            onChange={(e) => setNewTender({ ...newTender, description: e.target.value })}
            placeholder="Provide technical specifications, completion milestones, and quality benchmarks..."
          />

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Standard 30-day bidding window will be opened upon publication.</span>
          </div>
        </form>
      </Modal>
    </div>
  );
};
