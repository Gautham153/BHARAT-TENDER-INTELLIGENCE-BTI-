import React, { useState } from 'react';
import {
  History,
  ShieldCheck,
  Search,
  Download,
  Lock,
  Filter,
  CheckCircle2,
  FileCode2,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Table, Column } from '../../components/ui/Table';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SearchBar } from '../../components/ui/SearchBar';
import { useToast } from '../../context/ToastContext';
import { mockAuditLogs } from '../../data/mockData';
import { AuditLog } from '../../types';

export const AuditLogsPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>(mockAuditLogs);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = logs.filter((l) => {
    if (
      searchQuery &&
      !l.action.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !l.actorName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !l.entityType.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !l.ipAddress.includes(searchQuery)
    ) {
      return false;
    }
    return true;
  });

  const columns: Column<AuditLog>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp (IST)',
      width: '170px',
      render: (l) => <span className="font-mono text-xs text-slate-600">{l.timestamp}</span>,
    },
    {
      key: 'action',
      header: 'System Action / Event',
      render: (l) => (
        <div>
          <div className="font-bold text-slate-900">{l.action}</div>
          <div className="text-[11px] text-slate-500 font-mono">Entity: {l.entityType} ({l.entityId})</div>
        </div>
      ),
    },
    {
      key: 'actorName',
      header: 'Authorized Actor',
      render: (l) => (
        <div>
          <div className="font-semibold text-slate-900 text-xs">{l.actorName}</div>
          <div className="text-[10px] text-slate-400 font-mono">{l.actorRole}</div>
        </div>
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP & Node',
      render: (l) => <span className="font-mono text-xs text-slate-600">{l.ipAddress}</span>,
    },
    {
      key: 'hashFingerprint',
      header: 'SHA-256 Fingerprint',
      render: (l) => (
        <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
          {l.hashFingerprint}
        </span>
      ),
    },
    {
      key: 'verified',
      header: 'Chain Integrity',
      align: 'center',
      render: () => (
        <div className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Valid</span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tamper-Evident System Audit Trail"
        subtitle="Cryptographically verified immutable record of all procurement actions, evaluations & approvals."
        badge={
          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
            Hash Ledger Synchronized
          </span>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={Download}
            onClick={() => showToast('Audit Ledger Exported', { message: 'SHA-256 signed CSV exported.' })}
          >
            Export Signed Trail
          </Button>
        }
      />

      <Card padding="sm" className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search actor, action, IP, entity..."
          />
        </div>
        <div className="text-xs text-slate-500">
          Total Logs: <strong className="text-slate-900">{filteredLogs.length}</strong> immutable events
        </div>
      </Card>

      <Table
        data={filteredLogs}
        columns={columns}
        keyExtractor={(l) => l.id}
      />
    </div>
  );
};
