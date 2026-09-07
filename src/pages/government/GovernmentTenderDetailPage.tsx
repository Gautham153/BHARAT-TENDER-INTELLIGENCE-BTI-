// Bharat Tender Intelligence (BTI) — Government Tender Detail & Lifecycle Adjudication
// Phase 3A: Comprehensive Procurement Audit & Authority View

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Building,
  MapPin,
  IndianRupee,
  Calendar,
  ShieldCheck,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Edit,
  Send,
  Lock,
  XCircle,
  Archive,
  Clock,
  User,
  ShieldAlert,
  Globe,
  Radio,
} from 'lucide-react';
import { TenderService } from '../../services/firebase/tenders';
import { Tender, TenderAuditEvent } from '../../types/tender';
import { TenderStatusBadge } from '../../components/tenders/TenderStatusBadge';
import { TenderTimeline } from '../../components/tenders/TenderTimeline';
import { TenderConfirmationModal, TenderModalAction } from '../../components/tenders/TenderConfirmationModal';
import { useAuth } from '../../context/AuthContext';

export interface GovernmentTenderDetailPageProps {
  tenderId: string;
  onNavigate: (path: string) => void;
}

export const GovernmentTenderDetailPage: React.FC<GovernmentTenderDetailPageProps> = ({ tenderId, onNavigate }) => {
  const { user } = useAuth();

  const [tender, setTender] = useState<Tender | null>(null);
  const [auditEvents, setAuditEvents] = useState<TenderAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [modalAction, setModalAction] = useState<TenderModalAction | null>(null);

  const loadTenderData = async () => {
    if (!tenderId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await TenderService.getTenderById(tenderId, user?.role);
      if (!data) {
        setError('Tender record not found or access is restricted.');
        return;
      }
      setTender(data);

      try {
        const events = await TenderService.getTenderAuditEvents(tenderId);
        setAuditEvents(events);
      } catch (eventErr: any) {
        console.warn('[BTI] Notice: Audit trail could not be retrieved:', eventErr);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading tender details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenderData();
  }, [tenderId, user?.role]);

  const handleConfirmAction = async (notes: string) => {
    if (!tender || !modalAction || !user) return;

    if (modalAction === 'PUBLISH') {
      await TenderService.publishTender(tender.id, user, notes);
    } else if (modalAction === 'CLOSE') {
      await TenderService.closeTender(tender.id, user, notes);
    } else if (modalAction === 'CANCEL') {
      await TenderService.cancelTender(tender.id, user, notes);
    } else if (modalAction === 'ARCHIVE') {
      await TenderService.archiveTender(tender.id, user, notes);
    }

    await loadTenderData();
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '₹0';
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)} Crore`;
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)} Lakh`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500">
        <Clock className="w-8 h-8 mx-auto mb-2 animate-spin text-slate-400" />
        Loading tender specifications and statutory audit trail...
      </div>
    );
  }

  if (error || !tender) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-6 bg-white rounded-xl border border-slate-200 text-center space-y-4 shadow-sm">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">
          Tender Not Available
        </h2>
        <p className="text-xs text-slate-500">
          {error || 'The requested tender could not be located.'}
        </p>
        <button
          onClick={() => onNavigate('/government/tenders')}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
        >
          Return to Tender Repository
        </button>
      </div>
    );
  }

  const isDraft = tender.status === 'DRAFT';
  const isLive = tender.status === 'LIVE' || tender.status === 'PUBLISHED' || tender.status === 'Open';
  const isClosed = tender.status === 'CLOSED' || tender.status === 'Closed' || tender.status === 'UNDER_EVALUATION';
  const isAwarded = tender.status === 'AWARDED' || tender.status === 'Awarded';
  const isCancelled = tender.status === 'CANCELLED' || tender.status === 'Cancelled';
  const isArchived = tender.status === 'ARCHIVED';

  // Days remaining
  const closeTime = tender.closingDate ? new Date(tender.closingDate).getTime() : 0;
  const daysRemaining = closeTime ? Math.ceil((closeTime - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div id="government-tender-detail-page" className="max-w-6xl mx-auto space-y-6 min-w-0">
      {/* Top Navigation & Action Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200 min-w-0">
        <div className="min-w-0 flex-1">
          <button
            onClick={() => onNavigate('/government/tenders')}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Tenders</span>
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
              {tender.tenderNumber}
            </span>
            <TenderStatusBadge status={tender.status} size="md" />
            {isLive && daysRemaining !== null && (
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Closing today'}
              </span>
            )}
          </div>

          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 mt-2 break-words">
            {tender.title}
          </h1>
        </div>

        {/* Lifecycle Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigate(`/government/tenders/${tender.id}/proposals`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#002B49] text-[#002B49] bg-blue-50/70 hover:bg-blue-100 transition-colors shadow-xs cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[#002B49]" />
            <span>Proposal Inbox</span>
          </button>

          {isDraft && (
            <>
              <button
                id="edit-draft-tender-btn"
                onClick={() => onNavigate(`/government/tenders/${tender.id}/edit`)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
              >
                <Edit className="w-4 h-4 text-slate-500" />
                <span>Edit Draft</span>
              </button>

              <button
                id="publish-tender-btn"
                onClick={() => setModalAction('PUBLISH')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-xs"
              >
                <Send className="w-4 h-4" />
                <span>Publish Tender</span>
              </button>

              <button
                onClick={() => setModalAction('CANCEL')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-rose-700 hover:bg-rose-50 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </>
          )}

          {isLive && (
            <>
              <button
                id="close-tender-btn"
                onClick={() => setModalAction('CLOSE')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-700 hover:bg-amber-800 text-white transition-colors shadow-xs"
              >
                <Lock className="w-4 h-4" />
                <span>Close Bidding</span>
              </button>

              <button
                onClick={() => setModalAction('CANCEL')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-rose-700 hover:bg-rose-50 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </>
          )}

          {(isClosed || isAwarded) && !isArchived && (
            <button
              onClick={() => setModalAction('ARCHIVE')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
            >
              <Archive className="w-4 h-4" />
              <span>Archive Record</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Left side Specs, Right side Lifecycle & Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">
        {/* Left Column (8 cols): Tender Details */}
        <div className="lg:col-span-8 space-y-6 min-w-0">
          {/* Scope of Work */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Detailed Scope of Works & Description
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line break-words">
              {tender.description}
            </p>
          </div>

          {/* Project Details Bento Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Authority & Line Dept */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                Issuing & Line Authority
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Issuing Entity</span>
                <span className="font-semibold text-slate-900">
                  {tender.issuingAuthority || 'District Magistrate & District Nodal Officer'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Line Department</span>
                <span className="font-medium text-slate-800">
                  {tender.department || 'Public Works Department (PWD)'}
                </span>
              </div>
              {tender.mpName && (
                <div>
                  <span className="text-slate-500 block text-[11px]">MP Office Oversight</span>
                  <span className="font-medium text-slate-800">
                    {tender.mpName}
                  </span>
                </div>
              )}
            </div>

            {/* Geographic Site */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                Geographic Location
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Constituency & District</span>
                <span className="font-semibold text-slate-900">
                  {tender.constituency}, {tender.district || tender.constituency}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">State</span>
                <span className="font-medium text-slate-800">
                  {tender.state}
                </span>
              </div>
              {tender.projectLocation && (
                <div>
                  <span className="text-slate-500 block text-[11px]">Site Specifics</span>
                  <span className="font-medium text-slate-800">
                    {tender.projectLocation}
                  </span>
                </div>
              )}
              {tender.latitude && tender.longitude && (
                <div className="font-mono text-[11px] text-slate-500 pt-1">
                  GPS: {tender.latitude.toFixed(4)}, {tender.longitude.toFixed(4)}
                </div>
              )}
            </div>
          </div>

          {/* Eligibility Criteria */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Contractor Eligibility Criteria
            </h3>
            {tender.eligibilityCriteria && tender.eligibilityCriteria.length > 0 ? (
              <ul className="space-y-2">
                {tender.eligibilityCriteria.map((crit, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 text-xs text-slate-700"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{crit}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">General statutory qualifications apply.</p>
            )}
          </div>

          {/* Required Documents Checklist */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-blue-600" />
              Statutory Tender Document Metadata Checklist
            </h3>
            {tender.requiredDocuments && tender.requiredDocuments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {tender.requiredDocuments.map((doc, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center gap-2 text-xs font-medium text-slate-800"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{doc}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No document checklist registered.</p>
            )}
          </div>

          {/* Special Requirements */}
          {tender.specialRequirements && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-1.5 text-xs text-amber-950">
              <strong className="font-semibold flex items-center gap-1.5 text-amber-900">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
                Special Labor, Safety & Environmental Protocols
              </strong>
              <p className="leading-relaxed pl-5.5">{tender.specialRequirements}</p>
            </div>
          )}
        </div>

        {/* Right Column (4 cols): Financials, Timeline & Audit Trail */}
        <div className="lg:col-span-4 space-y-6 min-w-0">
          {/* Financial Overview Card */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3.5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <IndianRupee className="w-4 h-4 text-blue-600" />
              Financial Sanctions
            </h3>

            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
              <span className="text-[11px] text-slate-500 block">Sanctioned Fund</span>
              <div className="text-xl font-bold text-slate-900 mt-0.5">
                {formatCurrency(tender.sanctionedAmount || tender.estimatedValue || tender.estimatedCost)}
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Raw: ₹{(tender.sanctionedAmount || tender.estimatedCost || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
              <span className="text-[11px] text-slate-500 block">Estimated Procurement Value</span>
              <div className="text-lg font-semibold text-slate-800 mt-0.5">
                {formatCurrency(tender.estimatedValue || tender.estimatedCost)}
              </div>
              <span className="text-[11px] text-slate-500">Schedule of Rates (SoR)</span>
            </div>
          </div>

          {/* Timeline Milestones Card */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3 text-xs">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              Timeline & Milestones
            </h3>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Publication Date:</span>
              <span className="font-medium text-slate-900">
                {tender.publicationDate || tender.publishedDate || 'Pending'}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Submission Closing:</span>
              <span className="font-semibold text-amber-800 font-mono">
                {tender.closingDate}
              </span>
            </div>

            {tender.durationValue && (
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Execution Window:</span>
                <span className="font-medium text-slate-900">
                  {tender.durationValue} {tender.durationUnit || 'days'}
                </span>
              </div>
            )}

            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Proposals Received:</span>
              <span className="font-bold text-slate-900 font-mono">
                {tender.proposalsCount || 0}
              </span>
            </div>
          </div>

          {/* Statutory Lifecycle Audit Trail */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Statutory Audit Trail
              </h3>
              <span className="text-[10px] font-mono text-slate-400">Append-Only</span>
            </div>

            <TenderTimeline events={auditEvents} />
          </div>
        </div>
      </div>

      {/* Action Confirmation Modal */}
      {modalAction && (
        <TenderConfirmationModal
          isOpen={!!modalAction}
          action={modalAction}
          tender={tender}
          onClose={() => setModalAction(null)}
          onConfirm={handleConfirmAction}
        />
      )}
    </div>
  );
};
