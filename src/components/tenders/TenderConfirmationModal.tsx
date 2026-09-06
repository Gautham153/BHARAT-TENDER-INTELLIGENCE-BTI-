// Bharat Tender Intelligence (BTI) — Tender Action Confirmation Modal
// Phase 3A: Government Lifecycle Action Guard

import React, { useState } from 'react';
import {
  AlertTriangle,
  Send,
  Lock,
  XCircle,
  Archive,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Tender } from '../../types/tender';

export type TenderModalAction = 'PUBLISH' | 'CLOSE' | 'CANCEL' | 'ARCHIVE';

interface TenderConfirmationModalProps {
  isOpen: boolean;
  action: TenderModalAction | null;
  tender: Tender;
  onClose: () => void;
  onConfirm: (notes: string) => Promise<void>;
}

export const TenderConfirmationModal: React.FC<TenderConfirmationModalProps> = ({
  isOpen,
  action,
  tender,
  onClose,
  onConfirm,
}) => {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !action) return null;

  const getModalConfig = () => {
    switch (action) {
      case 'PUBLISH':
        return {
          title: 'Publish Tender for National Procurement',
          subtitle: `Tender Number: ${tender.tenderNumber}`,
          description:
            'You are about to transition this tender from DRAFT to LIVE. Once published, the tender specifications will become permanently discoverable by registered agencies, and core parameters (Category, Sanctioned Amount, Issuing Authority) will be locked.',
          confirmText: 'Confirm & Publish Tender',
          confirmBtnClass: 'bg-emerald-700 hover:bg-emerald-800 text-white',
          icon: Send,
          iconBg: 'bg-emerald-100 text-emerald-800',
          requireNotes: false,
          notesPlaceholder: 'Optional administrative publishing remarks or committee clearance ref...',
        };
      case 'CLOSE':
        return {
          title: 'Close Tender Bidding Window',
          subtitle: `Tender Number: ${tender.tenderNumber}`,
          description:
            'Are you sure you want to close bidding for this tender? Closing the tender prevents any further agency proposal submissions and moves the tender into the evaluation phase.',
          confirmText: 'Confirm & Close Bidding',
          confirmBtnClass: 'bg-amber-700 hover:bg-amber-800 text-white',
          icon: Lock,
          iconBg: 'bg-amber-100 text-amber-800',
          requireNotes: false,
          notesPlaceholder: 'Optional bidding closure notes (e.g. deadline completed, bids sealed)...',
        };
      case 'CANCEL':
        return {
          title: 'Cancel Procurement Tender',
          subtitle: `Tender Number: ${tender.tenderNumber}`,
          description:
            'Warning: Cancelling this tender is an administrative termination of the procurement process. A clear justification note is mandatory for audit trail compliance.',
          confirmText: 'Authorize Cancellation',
          confirmBtnClass: 'bg-rose-700 hover:bg-rose-800 text-white',
          icon: XCircle,
          iconBg: 'bg-rose-100 text-rose-800',
          requireNotes: true,
          notesPlaceholder: 'Enter official administrative justification for tender cancellation...',
        };
      case 'ARCHIVE':
        return {
          title: 'Archive Historical Tender Record',
          subtitle: `Tender Number: ${tender.tenderNumber}`,
          description:
            'Archiving will move this tender to the read-only historical archive. All contract and audit records remain intact for statutory compliance.',
          confirmText: 'Confirm Archival',
          confirmBtnClass: 'bg-slate-800 hover:bg-slate-900 text-white',
          icon: Archive,
          iconBg: 'bg-slate-100 text-slate-700',
          requireNotes: false,
          notesPlaceholder: 'Optional archival reference or audit closure note...',
        };
    }
  };

  const config = getModalConfig();
  const IconComponent = config.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (config.requireNotes && (!notes || notes.trim().length < 5)) {
      setError('Please provide a mandatory justification note (minimum 5 characters).');
      return;
    }

    try {
      setLoading(true);
      await onConfirm(notes.trim());
      setNotes('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Operation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div
        id="tender-confirmation-modal"
        className="relative w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${config.iconBg}`}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {config.title}
              </h3>
              <p className="text-xs font-mono text-slate-500 mt-0.5">
                {config.subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            {config.description}
          </p>

          {/* Key Tender Context */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Title:</span>
              <span className="font-medium text-slate-800 max-w-xs truncate text-right">
                {tender.title}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Category:</span>
              <span className="font-medium text-slate-800">
                {tender.category}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Sanctioned Budget:</span>
              <span className="font-semibold text-slate-900">
                ₹{((tender.sanctionedAmount || tender.estimatedCost) / 10000000).toFixed(2)} Cr
              </span>
            </div>
          </div>

          {/* Notes / Justification */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Administrative Remarks / Justification{' '}
              {config.requireNotes && <span className="text-rose-500">*</span>}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={config.notesPlaceholder}
              rows={3}
              disabled={loading}
              className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-xs ${config.confirmBtnClass} disabled:opacity-50`}
            >
              {loading ? (
                <span>Processing...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{config.confirmText}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
