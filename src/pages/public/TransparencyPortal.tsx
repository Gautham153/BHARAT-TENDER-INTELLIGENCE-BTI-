import React, { useState } from 'react';
import {
  Search,
  Building2,
  Coins,
  ShieldCheck,
  AlertTriangle,
  Send,
  Eye,
  Download,
  Filter,
  CheckCircle2,
  FileCheck2,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Modal } from '../../components/ui/Modal';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { SearchBar } from '../../components/ui/SearchBar';
import { useToast } from '../../context/ToastContext';
import { mockProjects, mockTenders } from '../../data/mockData';
import { Project } from '../../types';

export const TransparencyPortal: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [projects] = useState<Project[]>(mockProjects);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGrievanceOpen, setIsGrievanceOpen] = useState(false);
  const [grievanceData, setGrievanceData] = useState({
    name: '',
    phone: '',
    constituency: 'Varanasi',
    projectCode: '',
    allegationType: 'Substandard Material Quality',
    details: '',
  });

  const filteredProjects = projects.filter((p) => {
    if (
      searchQuery &&
      !p.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !p.mpName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !p.district.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleGrievanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsGrievanceOpen(false);
    showToast('Whistleblower Grievance Registered', {
      message: 'Your report has been encrypted and assigned Tracking ID #CPGRAMS/2025/98124.',
      type: 'success',
    });
    setGrievanceData({
      name: '',
      phone: '',
      constituency: 'Varanasi',
      projectCode: '',
      allegationType: 'Substandard Material Quality',
      details: '',
    });
  };

  const columns: Column<Project>[] = [
    {
      key: 'projectCode',
      header: 'Sanction Code',
      width: '140px',
      render: (p) => <span className="font-mono text-xs font-bold text-slate-900">{p.projectCode}</span>,
    },
    {
      key: 'title',
      header: 'Work Description & Location',
      render: (p) => (
        <div>
          <div className="font-bold text-slate-900 text-xs">{p.title}</div>
          <div className="text-[11px] text-slate-500">{p.district}, {p.state} • MP: {p.mpName}</div>
        </div>
      ),
    },
    {
      key: 'sanctionedBudget',
      header: 'Sanctioned Outlay',
      align: 'right',
      render: (p) => (
        <span className="font-bold text-slate-900">
          ₹ {(p.sanctionedBudget / 10000000).toFixed(2)} Cr
        </span>
      ),
    },
    {
      key: 'physicalProgress',
      header: 'Completion Status',
      width: '170px',
      render: (p) => (
        <ProgressBar
          value={p.physicalProgress}
          size="sm"
          color="emerald"
          showPercentage={true}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (p) => <StatusBadge status={p.status} size="sm" />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Public Transparency & Citizen Social Audit Portal"
        subtitle="Track your constituency's MPLAD funds, inspect contractor performance, or report project anomalies."
        actions={
          <Button
            variant="danger"
            size="sm"
            icon={AlertTriangle}
            onClick={() => setIsGrievanceOpen(true)}
          >
            File Citizen Grievance / Report Waste
          </Button>
        }
      />

      {/* Overview Metric Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center gap-4 bg-slate-50">
          <div className="p-3 bg-blue-100 rounded-xl text-[#002B49]">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase">Total Tracked Sanctions</div>
            <div className="text-xl font-extrabold text-slate-900">₹ 2,456.78 Cr</div>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4 bg-slate-50">
          <div className="p-3 bg-emerald-100 rounded-xl text-emerald-800">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase">Completed Community Assets</div>
            <div className="text-xl font-extrabold text-slate-900">8,412 Works</div>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4 bg-slate-50">
          <div className="p-3 bg-amber-100 rounded-xl text-amber-800">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase">AI Monitored Procurements</div>
            <div className="text-xl font-extrabold text-slate-900">100% Audited</div>
          </div>
        </Card>
      </div>

      {/* Search Bar */}
      <Card padding="sm" className="w-full max-w-md">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by MP name, district, or work..."
        />
      </Card>

      <Table
        data={filteredProjects}
        columns={columns}
        keyExtractor={(p) => p.id}
      />

      {/* Modal: Citizen Grievance Submission */}
      <Modal
        isOpen={isGrievanceOpen}
        onClose={() => setIsGrievanceOpen(false)}
        maxWidth="lg"
        title="File Public Grievance or Report Project Anomaly"
        description="Your submission is routed to District Vigilance and CPGRAMS oversight committee."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsGrievanceOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleGrievanceSubmit}
              icon={Send}
            >
              Submit Confidential Report
            </Button>
          </>
        }
      >
        <form onSubmit={handleGrievanceSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Citizen Name (Optional for anonymous)"
              value={grievanceData.name}
              onChange={(e) => setGrievanceData({ ...grievanceData, name: e.target.value })}
              placeholder="e.g. Anand Kumar"
            />
            <Input
              label="Mobile No (For SMS Updates)"
              value={grievanceData.phone}
              onChange={(e) => setGrievanceData({ ...grievanceData, phone: e.target.value })}
              placeholder="e.g. 9876543210"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Parliamentary Constituency"
              value={grievanceData.constituency}
              onChange={(e) => setGrievanceData({ ...grievanceData, constituency: e.target.value })}
            />
            <Select
              label="Nature of Anomaly"
              value={grievanceData.allegationType}
              onChange={(e) => setGrievanceData({ ...grievanceData, allegationType: e.target.value })}
              options={[
                { label: 'Substandard Material Quality', value: 'Substandard Material Quality' },
                { label: 'Ghost Project / No Work on Ground', value: 'Ghost Project / No Work on Ground' },
                { label: 'Unreasonable Project Delay', value: 'Unreasonable Project Delay' },
                { label: 'Contractor Negligence or Abandonment', value: 'Contractor Negligence' },
              ]}
            />
          </div>

          <Textarea
            label="Specific Evidence & Location Details"
            required
            rows={3}
            value={grievanceData.details}
            onChange={(e) => setGrievanceData({ ...grievanceData, details: e.target.value })}
            placeholder="Describe the exact location, road name, observable defects, or contractor behavior..."
          />
        </form>
      </Modal>
    </div>
  );
};
