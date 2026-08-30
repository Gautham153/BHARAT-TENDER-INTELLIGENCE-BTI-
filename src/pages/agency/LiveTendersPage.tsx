import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Building2,
  Send,
  Eye,
  CheckCircle2,
  FileCheck,
  Coins,
  Clock,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Table, Column } from '../../components/ui/Table';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { Input, Textarea } from '../../components/ui/Input';
import { SearchBar } from '../../components/ui/SearchBar';
import { useToast } from '../../context/ToastContext';
import { mockTenders } from '../../data/mockData';
import { Tender } from '../../types';

export const LiveTendersPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [tenders] = useState<Tender[]>(mockTenders.filter((t) => t.status === 'Open'));
  const [searchQuery, setSearchQuery] = useState('');
  const [biddingTender, setBiddingTender] = useState<Tender | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [completionDays, setCompletionDays] = useState('180');
  const [technicalMethodology, setTechnicalMethodology] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredTenders = tenders.filter((t) => {
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

  const handleSubmitBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bidAmount) {
      showToast('Input Error', { message: 'Please specify the financial bid quote in Crores.', type: 'warning' });
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setBiddingTender(null);
      showToast('Bid Submitted Successfully', {
        message: `Your cryptographic bid for ${biddingTender?.tenderNumber} has been received and encrypted.`,
        type: 'success',
      });
      setBidAmount('');
      setTechnicalMethodology('');
    }, 700);
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
      header: 'Scope of Works',
      render: (t) => (
        <div>
          <div className="font-bold text-slate-900 line-clamp-1">{t.title}</div>
          <div className="text-[11px] text-slate-500">{t.constituency}, {t.state} • MP: {t.mpName}</div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Sector',
      render: (t) => <span className="text-xs text-slate-700 font-medium">{t.category}</span>,
    },
    {
      key: 'estimatedCost',
      header: 'Sanctioned Budget',
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
      header: 'Action',
      align: 'right',
      render: (t) => (
        <Button
          variant="gov"
          size="sm"
          onClick={() => setBiddingTender(t)}
          icon={Send}
          className="text-xs px-2.5 py-1"
        >
          Submit Proposal
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live MPLAD Tenders for Bidding"
        subtitle="Browse e-procurement opportunities, download structured BoQs, and submit encrypted proposals."
      />

      <Card padding="sm" className="w-full max-w-sm">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search live tenders..."
        />
      </Card>

      <Table
        data={filteredTenders}
        columns={columns}
        keyExtractor={(t) => t.id}
      />

      {/* Modal: Submit Proposal Wizard */}
      <Modal
        isOpen={Boolean(biddingTender)}
        onClose={() => setBiddingTender(null)}
        maxWidth="xl"
        title="Submit Commercial & Technical Bid"
        description={`Bidding on: ${biddingTender?.tenderNumber} (${biddingTender?.title})`}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBiddingTender(null)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="gov"
              size="sm"
              onClick={handleSubmitBid}
              isLoading={isSubmitting}
              icon={Send}
            >
              Submit Encrypted Bid
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmitBid} className="space-y-4">
          <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block">Sanctioned Estimate Ceiling:</span>
              <strong className="text-slate-900 font-extrabold text-sm">
                ₹ {biddingTender ? (biddingTender.estimatedCost / 10000000).toFixed(2) : 0} Crores
              </strong>
            </div>
            <span className="text-[11px] text-blue-900 font-mono font-bold bg-blue-100 px-2 py-0.5 rounded">
              Standard DSR-2024
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Financial Quote (₹ In Crores)"
              required
              type="number"
              step="0.01"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              placeholder="e.g. 1.78"
            />
            <Input
              label="Execution Timeline (Days)"
              required
              type="number"
              value={completionDays}
              onChange={(e) => setCompletionDays(e.target.value)}
              placeholder="e.g. 180"
            />
          </div>

          <Textarea
            label="Technical Methodology & Resource Deployment"
            rows={3}
            value={technicalMethodology}
            onChange={(e) => setTechnicalMethodology(e.target.value)}
            placeholder="Outline batching plant availability, engineering personnel, and quality assurance..."
          />

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Automated BTI AI Pre-Submission Scan</span>
            </div>
            <p>
              Your proposal rates will be benchmarked against DSR materials. Verified GSTIN & EMD guarantees will be linked automatically.
            </p>
          </div>
        </form>
      </Modal>
    </div>
  );
};
