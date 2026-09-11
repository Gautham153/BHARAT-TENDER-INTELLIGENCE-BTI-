import React from 'react';
import { Coins, Download, CheckCircle2, Clock, Building2, Receipt } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';

interface DisbursementRecord {
  id: string;
  invoiceNo: string;
  projectCode: string;
  stage: string;
  amount: number;
  date: string;
  status: 'Disbursed' | 'Under PFMS Processing' | 'Audit Cleared';
  utrNumber: string;
}

export const DisbursementsPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { showToast } = useToast();

  const records: DisbursementRecord[] = [
    {
      id: 'dis-1',
      invoiceNo: 'INV/2025/089',
      projectCode: 'MPLAD/UP/2024/0981',
      stage: 'Tranche 2 (Superstructure 50%)',
      amount: 4625000,
      date: '2025-01-14',
      status: 'Disbursed',
      utrNumber: 'SBI982173461298',
    },
    {
      id: 'dis-2',
      invoiceNo: 'INV/2025/092',
      projectCode: 'MPLAD/UP/2024/0981',
      stage: 'Tranche 3 (Finishing 75%)',
      amount: 3200000,
      date: '2025-02-02',
      status: 'Under PFMS Processing',
      utrNumber: 'PENDING_NODAL_SIGN',
    },
    {
      id: 'dis-3',
      invoiceNo: 'INV/2024/412',
      projectCode: 'MPLAD/MH/2024/1104',
      stage: 'Tranche 1 (Mobilization 20%)',
      amount: 2800000,
      date: '2024-11-20',
      status: 'Disbursed',
      utrNumber: 'HDFC09812487612',
    },
  ];

  const columns: Column<DisbursementRecord>[] = [
    {
      key: 'invoiceNo',
      header: 'Invoice / Claim No',
      render: (r) => <span className="font-mono text-xs font-bold text-slate-900">{r.invoiceNo}</span>,
    },
    {
      key: 'projectCode',
      header: 'Project Code & Stage',
      render: (r) => (
        <div>
          <div className="font-bold text-slate-900 text-xs">{r.projectCode}</div>
          <div className="text-[11px] text-slate-500">{r.stage}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Disbursement (₹)',
      align: 'right',
      render: (r) => (
        <span className="font-bold text-slate-900">
          ₹ {(r.amount / 100000).toFixed(2)} Lakhs
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Claim Date',
      render: (r) => <span className="text-xs text-slate-600 font-mono">{r.date}</span>,
    },
    {
      key: 'status',
      header: 'PFMS Status',
      align: 'center',
      render: (r) => (
        <span
          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
            r.status === 'Disbursed'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: 'utrNumber',
      header: 'Bank UTR Ref',
      render: (r) => <span className="font-mono text-xs text-slate-500">{r.utrNumber}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="PFMS Fund Disbursement Claims"
        subtitle="Direct Benefit Transfer (DBT) track record linked with Public Financial Management System."
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={Download}
            onClick={() => showToast('Statement Downloaded', { message: 'PFMS remittance ledger exported.' })}
          >
            Download Ledger
          </Button>
        }
      />

      <Table
        data={records}
        columns={columns}
        keyExtractor={(r) => r.id}
      />
    </div>
  );
};
