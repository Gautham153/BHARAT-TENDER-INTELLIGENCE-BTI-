import React from 'react';
import {
  Cpu,
  ShieldCheck,
  Search,
  Network,
  FileCheck2,
  Lock,
  ArrowRight,
  Database,
  Camera,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export const HowItWorksPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const steps = [
    {
      num: '01',
      title: 'Tender Ingestion & BoQ Baseline Mapping',
      icon: FileCheck2,
      desc: 'All MPLAD Notice Inviting Tenders (NITs) and Bills of Quantities are parsed into machine-readable structures. Rates are cross-referenced with Central/District Schedule of Rates (DSR-2024).',
    },
    {
      num: '02',
      title: 'Bid Cryptography & Entity Linkage Analysis',
      icon: Network,
      desc: 'Bids submitted by contractors undergo metadata fingerprinting. The AI graph engine cross-matches MCA directorships, GST filings, IP coordinates, and bank IFSCs to prevent cartel formation.',
    },
    {
      num: '03',
      title: 'Real-time Statistical Outlier & Rigging Detection',
      icon: Cpu,
      desc: 'Statistical models evaluate bidding margins. Suspicious clustering, complementary bidding, and rotating win patterns trigger automated vigilance dossiers before contract sanctioning.',
    },
    {
      num: '04',
      title: 'Geo-Tagged Field Verification & DBT Disbursal',
      icon: Camera,
      desc: 'Executing agencies upload geo-tagged, timestamped site photos. AI geo-fencing confirms physical presence within the asset perimeter before releasing PFMS funds.',
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      <div className="text-center space-y-3">
        <span className="text-xs font-bold uppercase tracking-widest text-[#002B49] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
          Algorithmic Surveillance Architecture
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          How Bharat Tender Intelligence Detects Procurement Anomalies
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl mx-auto">
          An end-to-end multi-layer intelligence framework engineered to safeguard public MPLAD capital from collusion, ghost billing, and execution delays.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.num} className="p-6 space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-xl bg-[#002B49]/5 text-[#002B49]">
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-2xl font-black text-slate-200 font-mono">{s.num}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900">{s.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
            </Card>
          );
        })}
      </div>

      <div className="p-8 bg-[#002B49] rounded-2xl text-white flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <h3 className="text-lg font-bold">Explore the Live Government Demonstration</h3>
          <p className="text-xs text-slate-300">
            Inspect real-time anomaly alerts, bidder graphs, and tender scoring models.
          </p>
        </div>
        <Button
          variant="saffron"
          size="md"
          icon={ArrowRight}
          iconPosition="right"
          onClick={() => onNavigate('/government/dashboard')}
        >
          Launch Government Portal
        </Button>
      </div>
    </div>
  );
};
