// Bharat Tender Intelligence (BTI) — Agency Tender Detail Page
// Phase 3B: Comprehensive Procurement Specifications, Document Checklist & Compatibility Breakdown

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Coins,
  MapPin,
  Building2,
  FileText,
  CheckSquare,
  AlertCircle,
  FileBadge,
  Layers,
  Lock,
  Download,
  Info,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { VerificationGate } from '../../components/auth/VerificationGate';
import { SyntheticDataNotice } from '../../components/common/SyntheticDataNotice';
import { TenderMatchBadge } from '../../components/tenders/TenderMatchBadge';
import { TenderMatchExplanation } from '../../components/tenders/TenderMatchExplanation';
import { formatCurrencyINR, getDaysRemainingInfo } from '../../components/tenders/TenderOpportunityCard';
import { TenderService } from '../../services/firebase/tenders';
import { OrganizationService } from '../../services/firebase/organizations';
import { ProposalService } from '../../services/firebase/proposals';
import { TenderMatchingService } from '../../services/matching/tenderMatchingService';
import { useAuth } from '../../context/AuthContext';
import { Tender, TenderMatchResult } from '../../types/tender';
import { Organization } from '../../types/organization';
import { Proposal } from '../../types/proposal';

export interface AgencyTenderDetailPageProps {
  tenderId: string;
  onNavigate: (path: string) => void;
}

export const AgencyTenderDetailPage: React.FC<AgencyTenderDetailPageProps> = ({
  tenderId,
  onNavigate,
}) => {
  const { user } = useAuth();
  const [tender, setTender] = useState<Tender | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [existingProposal, setExistingProposal] = useState<Proposal | null>(null);
  const [matchResult, setMatchResult] = useState<TenderMatchResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadTenderDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch tender ensuring agency access security (drafts will return null)
      const fetchedTender = await TenderService.getTenderById(tenderId, 'agency');
      if (!fetchedTender) {
        setError('This procurement tender is either not found, in private draft review, or currently unavailable.');
        setTender(null);
        return;
      }
      setTender(fetchedTender);

      // 2. Fetch Organization
      let org: Organization | null = null;
      if (user?.organizationId) {
        org = await OrganizationService.getOrganizationById(user.organizationId);
      } else if (user) {
        const orgs = await OrganizationService.getAllOrganizations();
        org = orgs.find((o) => o.primaryUserId === user.id || (user.gstin && o.gstin === user.gstin)) || null;
      }
      setOrganization(org);

      // 3. Compute Deterministic Compatibility Score
      const match = TenderMatchingService.calculateMatch(fetchedTender, org);
      setMatchResult(match);

      // 4. Fetch Existing Proposal (Draft, Submitted, or Under Review)
      if (org) {
        try {
          const prop = await ProposalService.getLatestProposalForTenderAndOrg(
            fetchedTender.id,
            org.organizationId
          );
          setExistingProposal(prop);
        } catch (pErr) {
          console.warn('[BTI Agency] Could not load active proposal:', pErr);
        }
      }
    } catch (err: unknown) {
      console.error('[BTI Agency] Error fetching tender details:', err);
      setError(err instanceof Error ? err.message : 'Error loading tender details.');
    } finally {
      setLoading(false);
    }
  }, [tenderId, user]);

  useEffect(() => {
    loadTenderDetails();
  }, [loadTenderDetails]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-48" />
        <Card className="p-8 space-y-4">
          <div className="h-8 bg-slate-200 rounded w-3/4" />
          <div className="h-4 bg-slate-100 rounded w-1/2" />
          <div className="grid grid-cols-3 gap-4 pt-6">
            <div className="h-16 bg-slate-100 rounded" />
            <div className="h-16 bg-slate-100 rounded" />
            <div className="h-16 bg-slate-100 rounded" />
          </div>
        </Card>
      </div>
    );
  }

  if (error || !tender) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <Card className="p-8 text-center space-y-4 border-slate-300 shadow-sm">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Tender Unavailable</h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            {error || 'The requested tender record could not be loaded.'}
          </p>
          <div className="pt-2">
            <Button
              variant="gov"
              size="sm"
              icon={ArrowLeft}
              onClick={() => onNavigate('/agency/tenders')}
            >
              Back to Tender Opportunities
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const closingInfo = getDaysRemainingInfo(tender.closingDate);
  const amountToDisplay = tender.sanctionedAmount || tender.estimatedValue || tender.estimatedCost;

  return (
    <VerificationGate
      onNavigate={onNavigate}
      fallbackTitle="Verified Contractor Access Required"
      fallbackDescription="Statutory contractor verification is mandatory to view detailed technical specifications, project drawings, and submission requirements."
    >
      <div className="space-y-6 max-w-5xl mx-auto pb-16">
        <SyntheticDataNotice variant="banner" />

        {/* Back Navigation Bar */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onNavigate('/agency/tenders')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#002B49] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Tender Opportunities</span>
          </button>

          <span className="text-xs text-slate-400 font-mono">
            {tender.tenderNumber}
          </span>
        </div>

        {/* Main Header Hero Card */}
        <Card className="p-6 sm:p-8 border-slate-200 bg-white space-y-6 shadow-xs">
          {/* Top Classification Pill Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-black text-[#002B49] bg-slate-100 px-3 py-1 rounded-md border border-slate-200">
                {tender.tenderNumber}
              </span>
              <StatusBadge status={tender.status} size="md" />
              <span className="text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>{tender.category}</span>
              </span>
              {tender.subCategory && (
                <span className="text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span>{tender.subCategory}</span>
                </span>
              )}
            </div>

            {matchResult && (
              <TenderMatchBadge
                score={matchResult.score}
                tier={matchResult.tier}
                size="lg"
              />
            )}
          </div>

          {/* Title & Authority */}
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
              {tender.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span><strong>Issuing Authority:</strong> {tender.issuingAuthority}</span>
              </span>
              {tender.department && (
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="text-slate-300">•</span>
                  <span><strong>Department:</strong> {tender.department}</span>
                </span>
              )}
            </div>
          </div>

          {/* KPI Snapshot Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px] font-medium">Sanctioned Cost</span>
              <span className="font-black text-slate-900 text-base sm:text-lg">
                {formatCurrencyINR(amountToDisplay)}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">INR (Inclusive of Taxes)</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px] font-medium">Execution Period</span>
              <span className="font-bold text-slate-900 text-base sm:text-lg">
                {tender.durationValue} {tender.durationUnit}
              </span>
              <span className="text-[10px] text-slate-400 block">From Work Order Date</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px] font-medium">Published Date</span>
              <span className="font-bold text-slate-900 text-sm">
                {tender.publicationDate || 'Recent'}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">Official Gazette</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px] font-medium">Bidding Deadline</span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 text-sm">
                  {tender.closingDate}
                </span>
              </div>
              <span className={`text-[10px] font-bold block ${closingInfo.isClosingSoon ? 'text-amber-700' : 'text-slate-500'}`}>
                {closingInfo.label}
              </span>
            </div>
          </div>
        </Card>

        {/* Explainable Match Card */}
        {matchResult && (
          <TenderMatchExplanation
            matchResult={matchResult}
            organizationName={organization?.displayName || organization?.legalName}
          />
        )}

        {/* Scope of Work & Description */}
        <Card className="p-6 sm:p-7 border-slate-200 bg-white space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <FileText className="w-5 h-5 text-[#002B49]" />
            <h2 className="text-base font-bold text-slate-900">
              Project Description & Scope of Work
            </h2>
          </div>

          <div className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal whitespace-pre-line space-y-3">
            <p>{tender.description}</p>
          </div>

          {tender.projectLocation && (
            <div className="mt-4 p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-2.5 text-xs text-slate-700">
              <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 block font-semibold">Precise Site Location:</strong>
                <span>{tender.projectLocation}</span>
                <span className="block text-slate-500 text-[11px] mt-0.5">
                  Constituency: {tender.constituency} • District: {tender.district} • State: {tender.state}
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* Eligibility Criteria Section */}
        <Card className="p-6 sm:p-7 border-slate-200 bg-white space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <CheckSquare className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-bold text-slate-900">
              Contractor Eligibility & Qualification Criteria
            </h2>
          </div>

          {tender.eligibilityCriteria && tender.eligibilityCriteria.length > 0 ? (
            <div className="space-y-2.5">
              {tender.eligibilityCriteria.map((criterion, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-xs text-slate-800 font-medium"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{criterion}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">
              Standard General Financial Rules (GFR 2017) contractor classifications apply.
            </p>
          )}
        </Card>

        {/* Required Documents Checklist */}
        <Card className="p-6 sm:p-7 border-slate-200 bg-white space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <FileBadge className="w-5 h-5 text-blue-700" />
            <h2 className="text-base font-bold text-slate-900">
              Mandatory Submission Documents Checklist
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(tender.requiredDocuments && tender.requiredDocuments.length > 0
              ? tender.requiredDocuments
              : [
                  'Statutory GSTIN & PAN Verification Certificate',
                  'Audited Financial Balance Sheets for past 3 years',
                  'Technical Experience & Works Completion Certificates',
                  'Earnest Money Deposit (EMD) or Bid Security Declaration',
                ]
            ).map((docName, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
              >
                <div className="w-5 h-5 rounded bg-blue-50 text-blue-800 font-mono font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <span className="font-medium leading-snug">{docName}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Special Terms & Conditions */}
        {tender.specialRequirements && (
          <Card className="p-6 sm:p-7 border-slate-200 bg-white space-y-3 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ShieldCheck className="w-5 h-5 text-[#002B49]" />
              <h2 className="text-base font-bold text-slate-900">
                Special Procurement Conditions & Compliance Notes
              </h2>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-normal">
              {tender.specialRequirements}
            </p>
          </Card>
        )}

        {/* Phase 4: Electronic Proposal Submission Module */}
        {(() => {
          const isTenderLive = tender.status === 'LIVE' || tender.status === 'PUBLISHED' || tender.status === 'Open';
          const isExpired = closingInfo.isClosed;
          const isSubmitted = existingProposal && existingProposal.status !== 'DRAFT';
          const isDraft = existingProposal && existingProposal.status === 'DRAFT';

          if (isSubmitted) {
            return (
              <Card className="p-6 sm:p-8 border-emerald-300 bg-gradient-to-r from-emerald-50/70 to-slate-50 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                      <h3 className="text-base font-bold text-emerald-950">
                        Proposal Submitted & Sealed
                      </h3>
                      <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                        {existingProposal.proposalNumber}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-900 max-w-xl leading-relaxed">
                      Your bid for this tender was officially sealed on{' '}
                      <strong>
                        {existingProposal.submittedAt
                          ? new Date(existingProposal.submittedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Record'}
                      </strong>
                      . Under Indian Public Procurement GFR Rules, submitted tenders cannot be modified.
                    </p>
                  </div>

                  <div className="shrink-0 w-full sm:w-auto">
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => onNavigate(`/agency/tenders/${tender.id}/proposal`)}
                      icon={Eye}
                      className="w-full sm:w-auto"
                    >
                      View Sealed Proposal
                    </Button>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-200/60 text-[11px] text-emerald-800 flex items-center justify-between flex-wrap gap-2">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Statutory Status: <strong>{existingProposal.status}</strong> • Queued in Government Review Inbox</span>
                  </span>
                  <span className="font-mono font-bold">
                    Quoted Bid: {formatCurrencyINR(existingProposal.financialBidAmount || existingProposal.quotedAmount || 0)}
                  </span>
                </div>
              </Card>
            );
          }

          if (isDraft) {
            return (
              <Card className="p-6 sm:p-8 border-amber-300 bg-gradient-to-r from-amber-50/70 to-slate-50 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-amber-700" />
                      <h3 className="text-base font-bold text-amber-950">
                        Proposal Draft in Progress
                      </h3>
                      <span className="text-xs font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                        {existingProposal.proposalNumber}
                      </span>
                    </div>
                    <p className="text-xs text-amber-900 max-w-xl leading-relaxed">
                      You have an unsealed draft proposal saved. Complete all technical and financial sections, accept statutory undertakings, and submit before the bidding deadline.
                    </p>
                  </div>

                  <div className="shrink-0 w-full sm:w-auto">
                    <Button
                      variant="gov"
                      size="md"
                      onClick={() => onNavigate(`/agency/tenders/${tender.id}/proposal`)}
                      icon={ChevronRight}
                      className="w-full sm:w-auto"
                    >
                      Resume Proposal Draft
                    </Button>
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-200/60 text-[11px] text-amber-800 flex items-center justify-between flex-wrap gap-2">
                  <span className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-600" />
                    <span>Deadline: {tender.closingDate || 'Open'} ({closingInfo.label})</span>
                  </span>
                  <span className="font-medium">Draft changes are saved securely to your agency profile</span>
                </div>
              </Card>
            );
          }

          // No proposal yet
          if (!isTenderLive || isExpired) {
            return (
              <Card className="p-6 sm:p-8 border-slate-200 bg-slate-50 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Lock className="w-5 h-5 text-slate-500" />
                      <h3 className="text-base font-bold text-slate-900">
                        Bidding Window Closed
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                      The official submission window for this tender closed on{' '}
                      <strong>{tender.closingDate || 'the published date'}</strong>. No further proposal submissions or modifications can be accepted.
                    </p>
                  </div>

                  <div className="shrink-0 w-full sm:w-auto">
                    <button
                      type="button"
                      disabled
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-200 text-slate-500 font-bold text-xs cursor-not-allowed flex items-center justify-center gap-2 border border-slate-300"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Bidding Closed</span>
                    </button>
                  </div>
                </div>
              </Card>
            );
          }

          // Tender is live and open for proposal preparation
          return (
            <Card className="p-6 sm:p-8 border-[#002B49]/20 bg-gradient-to-r from-blue-50/50 to-slate-50 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#002B49]" />
                    <h3 className="text-base font-bold text-slate-900">
                      Electronic Proposal Submission Window is Open
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                    Prepare your structured technical methodology, physical milestones breakdown, financial cost proposal, and statutory compliance declarations for evaluation by the issuing authority.
                  </p>
                </div>

                <div className="shrink-0 w-full sm:w-auto">
                  <Button
                    variant="gov"
                    size="md"
                    onClick={() => onNavigate(`/agency/tenders/${tender.id}/proposal`)}
                    icon={ChevronRight}
                    className="w-full sm:w-auto px-6"
                  >
                    Prepare Proposal
                  </Button>
                </div>
              </div>

              <div className="pt-2 border-t border-blue-100 text-[11px] text-slate-500 flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    BTI enforces strict General Financial Rules (GFR 2017) compliance. Drafts can be saved before final seal.
                  </span>
                </span>
                <span className="font-semibold text-slate-700">
                  Closing: {tender.closingDate || 'Open'} ({closingInfo.label})
                </span>
              </div>
            </Card>
          );
        })()}
      </div>
    </VerificationGate>
  );
};
