import React, { useState } from 'react';
import {
  FolderKanban,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Coins,
  Calendar,
  Building2,
  ExternalLink,
  Eye,
  Download,
  Filter,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Table, Column } from '../../components/ui/Table';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { RiskBadge } from '../../components/ui/RiskBadge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Drawer } from '../../components/ui/Drawer';
import { SearchBar } from '../../components/ui/SearchBar';
import { useToast } from '../../context/ToastContext';
import { mockProjects } from '../../data/mockData';
import { Project } from '../../types';

export const ProjectMonitoring: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const filteredProjects = projects.filter((p) => {
    if (statusFilter !== 'All' && p.status !== statusFilter) return false;
    if (
      searchQuery &&
      !p.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !p.projectCode.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !p.district.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const columns: Column<Project>[] = [
    {
      key: 'projectCode',
      header: 'Project Code',
      width: '140px',
      render: (p) => <span className="font-mono text-xs font-bold text-slate-900">{p.projectCode}</span>,
    },
    {
      key: 'title',
      header: 'Sanctioned Work & Location',
      render: (p) => (
        <div>
          <div className="font-bold text-slate-900 line-clamp-1">{p.title}</div>
          <div className="text-[11px] text-slate-500">
            {p.district}, {p.state} • Agency: {p.executingAgencyName}
          </div>
        </div>
      ),
    },
    {
      key: 'sanctionedBudget',
      header: 'Sanctioned Cost',
      align: 'right',
      render: (p) => (
        <span className="font-bold text-slate-900">
          ₹ {(p.sanctionedBudget / 10000000).toFixed(2)} Cr
        </span>
      ),
    },
    {
      key: 'physicalProgress',
      header: 'Physical Progress',
      width: '170px',
      render: (p) => (
        <div className="w-full">
          <ProgressBar
            value={p.physicalProgress}
            size="sm"
            color={p.physicalProgress >= 80 ? 'emerald' : p.physicalProgress >= 40 ? 'blue' : 'amber'}
            showPercentage={true}
          />
        </div>
      ),
    },
    {
      key: 'financialProgress',
      header: 'Disbursed',
      align: 'right',
      render: (p) => (
        <div>
          <div className="font-semibold text-slate-800 text-xs">{p.financialProgress}%</div>
          <div className="text-[10px] text-slate-400">₹ {(p.amountDisbursed / 10000000).toFixed(2)} Cr</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (p) => <StatusBadge status={p.status} size="sm" />,
    },
    {
      key: 'riskScore',
      header: 'Risk Score',
      align: 'center',
      render: (p) => <RiskBadge score={p.riskScore} level={p.riskLevel} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (p) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedProject(p)}
          icon={Eye}
          className="text-xs px-2.5 py-1"
        >
          Track
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="MPLAD Project Execution & Milestone Monitoring"
        subtitle="Live tracking of sanctioned community assets with geo-tagged verification."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={MapPin}
              onClick={() => onNavigate('/government/projects/map')}
            >
              Open GIS View
            </Button>
          </div>
        }
      />

      {/* Filter & Search */}
      <Card padding="sm" className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search projects, districts, code..."
          />
        </div>
        <div className="flex items-center gap-2">
          {['All', 'In Progress', 'Completed', 'Delayed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#002B49] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </Card>

      {/* Table */}
      <Table
        data={filteredProjects}
        columns={columns}
        keyExtractor={(p) => p.id}
        onRowClick={(p) => setSelectedProject(p)}
      />

      {/* Drawer: Detailed Project Monitoring & Milestone Photos */}
      <Drawer
        isOpen={Boolean(selectedProject)}
        onClose={() => setSelectedProject(null)}
        width="xl"
        title={
          <div>
            <span className="text-xs font-mono font-bold text-slate-500">{selectedProject?.projectCode}</span>
            <div className="text-base font-bold text-slate-900 mt-0.5">{selectedProject?.title}</div>
          </div>
        }
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" size="sm" onClick={() => setSelectedProject(null)}>
              Close
            </Button>
            <Button
              variant="gov"
              size="sm"
              icon={CheckCircle2}
              onClick={() => {
                showToast('Milestone Verified', {
                  message: 'Physical progress approved. Next tranche unlocked for PFMS payment.',
                  type: 'success',
                });
                setSelectedProject(null);
              }}
            >
              Approve Milestone Disbursal
            </Button>
          </div>
        }
      >
        {selectedProject && (
          <div className="space-y-6 text-xs text-slate-700">
            {/* Progress Dual Overview */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
              <div>
                <ProgressBar
                  label="Physical Site Progress"
                  value={selectedProject.physicalProgress}
                  color="emerald"
                  size="md"
                />
              </div>
              <div>
                <ProgressBar
                  label="Financial Expenditure Disbursed"
                  value={selectedProject.financialProgress}
                  color="blue"
                  size="md"
                />
              </div>
            </div>

            {/* Core Project Data Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 block mb-0.5">Sanctioned Budget</span>
                <strong className="text-slate-900 text-sm">
                  ₹ {(selectedProject.sanctionedBudget / 10000000).toFixed(2)} Cr
                </strong>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 block mb-0.5">Amount Disbursed</span>
                <strong className="text-slate-900 text-sm">
                  ₹ {(selectedProject.amountDisbursed / 10000000).toFixed(2)} Cr
                </strong>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 block mb-0.5">Executing Agency</span>
                <strong className="text-slate-900">{selectedProject.executingAgencyName}</strong>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 block mb-0.5">Target Completion</span>
                <strong className="text-slate-900">{selectedProject.targetCompletionDate}</strong>
              </div>
            </div>

            {/* Geo-tagged Verification Photo Proofs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider">
                  Geo-Tagged Photographic Evidence
                </h4>
                <span className="text-[10px] text-emerald-700 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded">
                  EXIF & GPS Verified
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100 p-2 text-center">
                  <div className="h-28 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 mb-2">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div className="font-bold text-slate-800 text-[11px]">Plinth & Foundation Stage</div>
                  <div className="text-[10px] text-slate-500 font-mono">Lat: 25.3176°, Lng: 82.9739°</div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100 p-2 text-center">
                  <div className="h-28 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 mb-2">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div className="font-bold text-slate-800 text-[11px]">Superstructure & Roof Casting</div>
                  <div className="text-[10px] text-slate-500 font-mono">Lat: 25.3179°, Lng: 82.9741°</div>
                </div>
              </div>
            </div>

            {/* AI Geo-Fencing Verification Alert */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 text-xs text-[#002B49]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                All photographic submissions match the registered geographic boundary of Varanasi District Hospital Ward 14 within 12 meters tolerance.
              </span>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
