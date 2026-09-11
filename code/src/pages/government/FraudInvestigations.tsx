import React, { useState } from 'react';
import {
  SearchCheck,
  Building2,
  FileSpreadsheet,
  AlertTriangle,
  Download,
  Eye,
  Share2,
  Lock,
  Layers,
  Network,
  Users,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Table, Column } from '../../components/ui/Table';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { RiskBadge } from '../../components/ui/RiskBadge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { mockInvestigations } from '../../data/mockData';
import { InvestigationCase } from '../../types';

export const FraudInvestigations: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [investigations, setInvestigations] = useState<InvestigationCase[]>(mockInvestigations);
  const [selectedCase, setSelectedCase] = useState<InvestigationCase | null>(null);

  const columns: Column<InvestigationCase>[] = [
    {
      key: 'caseNumber',
      header: 'Case Number',
      width: '140px',
      render: (c) => <span className="font-mono text-xs font-bold text-slate-900">{c.caseNumber}</span>,
    },
    {
      key: 'title',
      header: 'Investigation Scope',
      render: (c) => (
        <div>
          <div className="font-bold text-slate-900">{c.title}</div>
          <div className="text-[11px] text-slate-500 line-clamp-1">{c.summary}</div>
        </div>
      ),
    },
    {
      key: 'tenderNumber',
      header: 'Linked Tender / Scheme',
      render: (c) => (
        <div>
          <div className="font-mono text-xs font-semibold text-slate-800">{c.tenderNumber}</div>
          <div className="text-[11px] text-slate-500">{c.agencyNames.length} Involved Agencies</div>
        </div>
      ),
    },
    {
      key: 'assignedInvestigator',
      header: 'Investigating Officer',
      render: (c) => (
        <span className="text-xs text-slate-700 font-medium">{c.assignedInvestigator}</span>
      ),
    },
    {
      key: 'riskScore',
      header: 'Risk Score',
      align: 'center',
      render: (c) => <RiskBadge score={c.riskScore} size="sm" />,
    },
    {
      key: 'status',
      header: 'Inquiry Status',
      align: 'center',
      render: (c) => <StatusBadge status={c.status} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Case File',
      align: 'right',
      render: (c) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedCase(c)}
          icon={Eye}
          className="text-xs px-2.5 py-1"
        >
          Inspect Dossier
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fraud & Collusion Investigations"
        subtitle="Multi-entity cartel graphs, common directorship cross-referencing & legal evidence dossiers."
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={Download}
            onClick={() => showToast('Investigation Register Exported', { message: 'Encrypted case register downloaded.' })}
          >
            Export CBI / CVC Brief
          </Button>
        }
      />

      {/* Cartel Network Visualization Teaser Card */}
      <Card className="p-6 bg-slate-900 text-white border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">Bidder Collusion & Entity Graph Engine</h3>
              <p className="text-xs text-slate-400">
                Cross-matches GST returns, bank account IFSCs, IP coordinates & common directorships (MCA-21)
              </p>
            </div>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-mono">
            Active Cartel Ring Identified (Gorakhpur)
          </span>
        </div>

        {/* Visual Graph Relationship Nodes Representation */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-700/60 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Node A (Bidder L1)</span>
            <div className="font-bold text-white text-sm">Purvanchal Roadworks Pvt Ltd</div>
            <div className="text-rose-400 text-[11px]">Director: R. Tripathi (DIN: 08492011)</div>
          </div>
          <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-700/60 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Node B (Bidder L2)</span>
            <div className="font-bold text-white text-sm">Gorakhnath Infra Buildtech</div>
            <div className="text-rose-400 text-[11px]">Director: S. Tripathi (Same Address)</div>
          </div>
          <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-700/60 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Corroborated Linkage</span>
            <div className="font-bold text-rose-400 text-sm">Identical IP: 103.24.11.89</div>
            <div className="text-slate-300 text-[11px]">Submitted within 4 minutes of each other</div>
          </div>
        </div>
      </Card>

      {/* Case Register Table */}
      <Table
        data={investigations}
        columns={columns}
        keyExtractor={(c) => c.id}
        onRowClick={(c) => setSelectedCase(c)}
      />

      {/* Modal: Full Investigation Dossier */}
      <Modal
        isOpen={Boolean(selectedCase)}
        onClose={() => setSelectedCase(null)}
        maxWidth="2xl"
        title={
          <div>
            <span className="text-xs font-mono font-bold text-slate-500">{selectedCase?.caseNumber}</span>
            <div className="text-base font-bold text-slate-900 mt-0.5">{selectedCase?.title}</div>
          </div>
        }
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" size="sm" onClick={() => setSelectedCase(null)}>
              Close
            </Button>
            <Button
              variant="gov"
              size="sm"
              icon={Download}
              onClick={() => showToast('Dossier Downloaded', { message: 'Encrypted FIR & Audit Brief exported.' })}
            >
              Generate Case Report
            </Button>
          </div>
        }
      >
        {selectedCase && (
          <div className="space-y-4 text-xs text-slate-700">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="font-bold text-slate-900">Case Summary</div>
              <p className="leading-relaxed">{selectedCase.summary}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 block mb-0.5">Assigned Officer</span>
                <strong className="text-slate-900 text-sm">{selectedCase.assignedInvestigator}</strong>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 block mb-0.5">Opening Date</span>
                <strong className="text-slate-900 text-sm">{selectedCase.openedDate}</strong>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wider mb-2">
                Involved Agencies & Entities
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedCase.agencyNames.map((name, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-900 font-semibold rounded-lg"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
              <div className="font-bold text-[#002B49]">Current Legal Stage</div>
              <p className="text-slate-600">
                Notice issued under Section 19 of Central Vigilance Commission Act. Bank guarantees frozen.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
