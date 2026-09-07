// Bharat Tender Intelligence (BTI) — Agency Proposal Submission Wizard
// Phase 4: Structured Multi-Step Proposal Submission, Immutability & Statutory Seal

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Send,
  Lock,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building2,
  FileText,
  FileCheck2,
  Calendar,
  Layers,
  Plus,
  Trash2,
  ShieldCheck,
  CheckSquare,
  Paperclip,
  Upload,
  Eye,
  Info,
  ChevronRight,
  Printer,
  Sparkles,
  Award,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { VerificationGate } from '../../components/auth/VerificationGate';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ProposalService } from '../../services/firebase/proposals';
import { TenderService } from '../../services/firebase/tenders';
import { OrganizationService } from '../../services/firebase/organizations';
import {
  Proposal,
  ProposalStatus,
  CanonicalProposalStatus,
  TechnicalProposal,
  ImplementationPlan,
  FinancialProposal,
  TimelineProposal,
  ExperienceProposal,
  ComplianceDeclarations,
  ProposalDocument,
  ProjectMilestone,
  PastProjectExperience,
} from '../../types/proposal';
import { Tender, getEffectiveTenderStatus } from '../../types/tender';
import { Organization } from '../../types/organization';
import { formatCurrencyINR, getDaysRemainingInfo } from '../../components/tenders/TenderOpportunityCard';

export interface AgencyProposalWizardPageProps {
  tenderId: string;
  onNavigate: (path: string) => void;
}

const WIZARD_STEPS = [
  { id: 1, title: 'Agency Profile', desc: 'Statutory Identity' },
  { id: 2, title: 'Technical Proposal', desc: 'Solution & Scope' },
  { id: 3, title: 'Execution Plan', desc: 'Milestones & Risks' },
  { id: 4, title: 'Financial Bid', desc: 'Cost & Quoted Price' },
  { id: 5, title: 'Track Record', desc: 'Past Projects' },
  { id: 6, title: 'Statutory Declarations', desc: 'Mandatory Compliance' },
  { id: 7, title: 'Documents', desc: 'Enclosures & Proof' },
  { id: 8, title: 'Review & Seal', desc: 'Final Verification' },
];

export const AgencyProposalWizardPage: React.FC<AgencyProposalWizardPageProps> = ({
  tenderId,
  onNavigate,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [tender, setTender] = useState<Tender | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load tender, organization, and existing proposal draft
  const loadData = useCallback(async () => {
    if (!tenderId) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Tender
      const t = await TenderService.getTenderById(tenderId, 'agency');
      if (!t) {
        setError('Tender record not found or inaccessible.');
        return;
      }
      setTender(t);

      // 2. Fetch Organization
      let org: Organization | null = null;
      if (user?.organizationId) {
        org = await OrganizationService.getOrganizationById(user.organizationId);
      } else if (user) {
        const allOrgs = await OrganizationService.getAllOrganizations();
        org = allOrgs.find((o) => o.primaryUserId === user.id || (user.gstin && o.gstin === user.gstin)) || null;
      }

      if (!org) {
        setError('No registered organization found for this account.');
        return;
      }
      setOrganization(org);

      // 3. Find or create draft proposal
      const existing = await ProposalService.getActiveProposalForTenderAndOrg(
        t.id,
        org.organizationId
      );

      if (existing) {
        setProposal(existing);
      } else {
        // Create initial draft if verified
        if (org.verificationStatus === 'verified' && user) {
          const draft = await ProposalService.createDraftProposal({
            tender: t,
            organization: org,
            user,
          });
          setProposal(draft);
        }
      }
    } catch (err: unknown) {
      console.error('[BTI Agency] Error loading proposal data:', err);
      setError(err instanceof Error ? err.message : 'Error loading proposal information.');
    } finally {
      setLoading(false);
    }
  }, [tenderId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isSubmitted = useMemo(() => {
    if (!proposal) return false;
    const status = proposal.status.toUpperCase().replace(/\s+/g, '_');
    return status !== 'DRAFT';
  }, [proposal]);

  // Form Field Updaters
  const updateTechnical = (key: keyof TechnicalProposal, val: string) => {
    if (isSubmitted || !proposal) return;
    setProposal({
      ...proposal,
      technicalProposal: {
        ...(proposal.technicalProposal || {
          technicalApproach: '',
          proposedSolution: '',
          scopeUnderstanding: '',
          technicalMethodology: '',
          keyDeliverables: '',
          qualityAssuranceApproach: '',
          technicalAssumptions: '',
        }),
        [key]: val,
      },
    });
  };

  const updateImplementation = (key: keyof ImplementationPlan, val: any) => {
    if (isSubmitted || !proposal) return;
    setProposal({
      ...proposal,
      implementationPlan: {
        ...(proposal.implementationPlan || {
          implementationApproach: '',
          projectPhases: '',
          milestones: [],
          resourcePlan: '',
          riskConsiderations: '',
          completionStrategy: '',
        }),
        [key]: val,
      },
    });
  };

  const updateFinancial = (key: keyof FinancialProposal, val: any) => {
    if (isSubmitted || !proposal) return;
    const current = proposal.financialProposal || {
      baseAmount: 0,
      taxAmount: 0,
      totalProposedAmount: 0,
      costBreakdown: '',
      paymentMilestones: '',
    };
    const updated = { ...current, [key]: val };

    if (key === 'baseAmount') {
      const base = Number(val) || 0;
      updated.taxAmount = Math.round(base * 0.18);
      updated.totalProposedAmount = base + updated.taxAmount;
    }

    setProposal({
      ...proposal,
      financialProposal: updated,
      financialBidAmount: updated.totalProposedAmount,
      quotedAmount: updated.baseAmount,
    });
  };

  const updateExperience = (key: keyof ExperienceProposal, val: any) => {
    if (isSubmitted || !proposal) return;
    setProposal({
      ...proposal,
      experience: {
        ...(proposal.experience || {
          relevantExperienceSummary: '',
          yearsOfExperience: 0,
          keyCapabilities: '',
          availableResources: '',
          technicalPersonnel: '',
          pastProjects: [],
        }),
        [key]: val,
      },
    });
  };

  const updateCompliance = (key: keyof ComplianceDeclarations, val: boolean) => {
    if (isSubmitted || !proposal) return;
    setProposal({
      ...proposal,
      complianceDeclarations: {
        ...(proposal.complianceDeclarations || {
          accuracyConfirmed: false,
          eligibilitySatisfied: false,
          documentsAuthentic: false,
          termsAgreed: false,
        }),
        [key]: val,
      },
    });
  };

  // Milestone Helpers
  const addMilestone = () => {
    if (isSubmitted || !proposal) return;
    const current = proposal.implementationPlan?.milestones || [];
    const newMs: ProjectMilestone = {
      id: `ms-${Date.now()}`,
      title: `Milestone ${current.length + 1}`,
      description: '',
      expectedCompletion: `Month ${current.length + 1}`,
    };
    updateImplementation('milestones', [...current, newMs]);
  };

  const removeMilestone = (id: string) => {
    if (isSubmitted || !proposal) return;
    const current = proposal.implementationPlan?.milestones || [];
    updateImplementation(
      'milestones',
      current.filter((m) => m.id !== id)
    );
  };

  const updateMilestone = (id: string, field: keyof ProjectMilestone, val: string) => {
    if (isSubmitted || !proposal) return;
    const current = proposal.implementationPlan?.milestones || [];
    updateImplementation(
      'milestones',
      current.map((m) => (m.id === id ? { ...m, [field]: val } : m))
    );
  };

  // Past Projects Helpers
  const addPastProject = () => {
    if (isSubmitted || !proposal) return;
    const current = proposal.experience?.pastProjects || [];
    const newProj: PastProjectExperience = {
      id: `proj-${Date.now()}`,
      projectName: '',
      clientAuthority: '',
      projectCategory: tender?.category || 'Civil Infrastructure',
      value: 0,
      year: new Date().getFullYear().toString(),
      description: '',
    };
    updateExperience('pastProjects', [...current, newProj]);
  };

  const removePastProject = (id: string) => {
    if (isSubmitted || !proposal) return;
    const current = proposal.experience?.pastProjects || [];
    updateExperience(
      'pastProjects',
      current.filter((p) => p.id !== id)
    );
  };

  const updatePastProject = (id: string, field: keyof PastProjectExperience, val: any) => {
    if (isSubmitted || !proposal) return;
    const current = proposal.experience?.pastProjects || [];
    updateExperience(
      'pastProjects',
      current.map((p) => (p.id === id ? { ...p, [field]: val } : p))
    );
  };

  // Save Draft Action
  const handleSaveDraft = async () => {
    if (!proposal || !user || isSubmitted) return;
    setSaving(true);
    try {
      const updated = await ProposalService.updateDraftProposal(proposal.id, proposal, user);
      setProposal(updated);
      showToast('Draft Saved', {
        message: 'Your proposal draft has been safely saved to the system.',
        type: 'success',
      });
    } catch (err: unknown) {
      console.error('Failed to save draft:', err);
      showToast('Save Failed', {
        message: err instanceof Error ? err.message : 'Could not save draft.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // Pre-submission validation checklist
  const validationChecklist = useMemo(() => {
    const tech = proposal?.technicalProposal;
    const fin = proposal?.financialProposal;
    const comp = proposal?.complianceDeclarations;

    const hasTechApproach = Boolean(tech?.technicalApproach?.trim());
    const hasProposedSolution = Boolean(tech?.proposedSolution?.trim());
    const hasQuotedAmount = Boolean(fin?.baseAmount && fin.baseAmount > 0);
    const hasCompliance = Boolean(
      comp?.accuracyConfirmed &&
      comp?.eligibilitySatisfied &&
      comp?.documentsAuthentic &&
      comp?.termsAgreed
    );

    return {
      hasTechApproach,
      hasProposedSolution,
      hasQuotedAmount,
      hasCompliance,
      isValid: hasTechApproach && hasProposedSolution && hasQuotedAmount && hasCompliance,
    };
  }, [proposal]);

  // Submit Proposal Action
  const handleConfirmSubmit = async () => {
    if (!proposal || !tender || !user) return;
    setSubmitting(true);
    try {
      const submitted = await ProposalService.submitProposal({
        proposalId: proposal.id,
        tender,
        user,
      });
      setProposal(submitted);
      setShowSubmitModal(false);
      showToast('Proposal Submitted & Sealed', {
        message: `Proposal ${submitted.proposalNumber} has been officially locked and transmitted to the Government Review Inbox.`,
        type: 'success',
      });
    } catch (err: unknown) {
      console.error('Failed to submit proposal:', err);
      showToast('Submission Blocked', {
        message: err instanceof Error ? err.message : 'Error submitting proposal.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-48" />
        <Card className="p-8 space-y-4">
          <div className="h-8 bg-slate-200 rounded w-3/4" />
          <div className="h-4 bg-slate-100 rounded w-1/2" />
        </Card>
      </div>
    );
  }

  if (error || !tender || !organization || !proposal) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Proposal Submission Unavailable</h2>
        <p className="text-xs text-slate-600 max-w-md mx-auto">{error || 'Unable to load required data.'}</p>
        <Button variant="outline" size="sm" onClick={() => onNavigate('/agency/tenders')}>
          Back to Live Tenders
        </Button>
      </div>
    );
  }

  const daysInfo = getDaysRemainingInfo(tender.closingDate);

  return (
    <VerificationGate
      onNavigate={onNavigate}
      fallbackTitle="Contractor Verification Required"
      fallbackDescription="Only verified agencies with statutory credentials can prepare and submit tender proposals."
    >
      <div id="agency-proposal-wizard-page" className="max-w-5xl mx-auto space-y-6 pb-20">
        {/* Back Link & Proposal Header Bar */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onNavigate(`/agency/tenders/${tender.id}`)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#002B49] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Tender Specifications</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-mono">Ref: {proposal.proposalNumber}</span>
            <StatusBadge status={proposal.status} size="sm" />
          </div>
        </div>

        {/* Sealed Proposal Notice (If already submitted) */}
        {isSubmitted && (
          <div className="p-4 sm:p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2 shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                <h3 className="text-sm font-bold">
                  Proposal Officially Sealed & Submitted
                </h3>
              </div>
              <span className="text-xs font-mono font-bold bg-emerald-100 px-2.5 py-1 rounded text-emerald-800">
                Sealed: {proposal.submittedAt ? new Date(proposal.submittedAt).toLocaleString() : 'Authoritative Record'}
              </span>
            </div>
            <p className="text-xs text-emerald-800 leading-relaxed">
              In accordance with statutory procurement rules (GFR 2017), this proposal content is sealed and immutable. It is currently queued for human review in the Government Nodal Inbox.
            </p>
          </div>
        )}

        {/* Tender Context Summary Card */}
        <Card className="p-5 sm:p-6 border-slate-200 bg-white space-y-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-[#002B49] bg-slate-100 px-2.5 py-0.5 rounded">
                {tender.tenderNumber}
              </span>
              <span className="text-slate-500">•</span>
              <span className="font-semibold text-slate-700">{tender.category}</span>
            </div>

            <div className="flex items-center gap-2 text-slate-600 font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Deadline: {tender.closingDate || 'Open'}</span>
              <span className={`text-[11px] font-bold ${daysInfo.isClosingSoon ? 'text-amber-700' : 'text-slate-500'}`}>
                ({daysInfo.label})
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                {tender.title}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Authority: {tender.issuingAuthority} • Sanctioned Cost: {formatCurrencyINR(tender.estimatedValue || tender.sanctionedAmount)}
              </p>
            </div>

            <div className="shrink-0 text-left sm:text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Quoted Bid
              </span>
              <span className="text-base sm:text-lg font-black text-[#002B49]">
                {proposal.financialProposal?.baseAmount
                  ? formatCurrencyINR(proposal.financialProposal.baseAmount)
                  : '₹ Pending Calculation'}
              </span>
            </div>
          </div>
        </Card>

        {/* Wizard Step Progress Tracker */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 overflow-x-auto shadow-xs">
          <div className="flex items-center justify-between min-w-[700px] gap-2">
            {WIZARD_STEPS.map((s, idx) => {
              const isCurrent = currentStep === s.id;
              const isPast = currentStep > s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCurrentStep(s.id)}
                  className={`flex items-center gap-2 text-left p-2 rounded-lg transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-blue-50 text-blue-900 font-bold'
                      : isPast
                      ? 'text-emerald-800 hover:bg-slate-50'
                      : 'text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCurrent
                        ? 'bg-[#002B49] text-white'
                        : isPast
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.id}
                  </div>
                  <div>
                    <div className="text-xs leading-none">{s.title}</div>
                    <div className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5">
                      {s.desc}
                    </div>
                  </div>
                  {idx < WIZARD_STEPS.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 ml-1 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 1: ORGANIZATION & STATUTORY PROFILE */}
        {currentStep === 1 && (
          <Card className="p-6 sm:p-7 border-slate-200 bg-white space-y-6 shadow-xs">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                1. Statutory Agency Profile & Registration Credentials
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Authoritative verification data pulled directly from the National Registrar. This information will be sealed with your submission.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 block text-[11px]">Organization Legal Name</span>
                <span className="font-bold text-slate-900 text-sm">{organization.legalName}</span>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 block text-[11px]">Statutory GSTIN</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{organization.gstin}</span>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 block text-[11px]">Business Category</span>
                <span className="font-medium text-slate-800">{organization.businessCategory}</span>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 block text-[11px]">Registered State & Jurisdiction</span>
                <span className="font-medium text-slate-800">{organization.state} (Code {organization.gstStateCode})</span>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1 sm:col-span-2">
                <span className="text-slate-500 block text-[11px]">Registered Address</span>
                <span className="font-medium text-slate-800">{organization.registeredAddress}</span>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 block text-[11px]">Primary Authorized Representative</span>
                <span className="font-medium text-slate-800">{user?.name || organization.legalName}</span>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 block text-[11px]">Nodal Clearance Status</span>
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Statutorily Verified & Cleared</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* STEP 2: TECHNICAL PROPOSAL */}
        {currentStep === 2 && (
          <Card className="p-6 sm:p-7 border-slate-200 bg-white space-y-6 shadow-xs">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                2. Technical Proposal & Execution Methodology
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Detail your architectural, engineering, and execution design tailored strictly to the tender's technical specifications.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800 block">
                  Technical Approach & Architecture <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  disabled={isSubmitted}
                  value={proposal.technicalProposal?.technicalApproach || ''}
                  onChange={(e) => updateTechnical('technicalApproach', e.target.value)}
                  placeholder="Outline your overall technical philosophy, design standards (e.g. IS codes, IRC specifications), and architectural methodology..."
                  className="w-full p-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002B49] disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800 block">
                  Proposed Solution & Work Execution Concept <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  disabled={isSubmitted}
                  value={proposal.technicalProposal?.proposedSolution || ''}
                  onChange={(e) => updateTechnical('proposedSolution', e.target.value)}
                  placeholder="Detail the exact materials, machinery, plant capacity, and structural processes to be deployed on site..."
                  className="w-full p-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002B49] disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800 block">
                  Understanding of Scope & Site Conditions
                </label>
                <textarea
                  rows={3}
                  disabled={isSubmitted}
                  value={proposal.technicalProposal?.scopeUnderstanding || ''}
                  onChange={(e) => updateTechnical('scopeUnderstanding', e.target.value)}
                  placeholder="Demonstrate understanding of the geographical, topographical, and community factors for this project location..."
                  className="w-full p-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002B49] disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800 block">
                    Quality Assurance & Testing Protocol
                  </label>
                  <textarea
                    rows={3}
                    disabled={isSubmitted}
                    value={proposal.technicalProposal?.qualityAssuranceApproach || ''}
                    onChange={(e) => updateTechnical('qualityAssuranceApproach', e.target.value)}
                    placeholder="Field lab setup, concrete slump tests, third-party NABL audits..."
                    className="w-full p-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002B49] disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800 block">
                    Key Deliverables & Handover Milestones
                  </label>
                  <textarea
                    rows={3}
                    disabled={isSubmitted}
                    value={proposal.technicalProposal?.keyDeliverables || ''}
                    onChange={(e) => updateTechnical('keyDeliverables', e.target.value)}
                    placeholder="Foundation sign-off, structural fit-out, test run, commissioning certificate..."
                    className="w-full p-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002B49] disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* STEP 3: EXECUTION PLAN & MILESTONES */}
        {currentStep === 3 && (
          <Card className="p-6 sm:p-7 border-slate-200 bg-white space-y-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  3. Implementation Plan, Work Phasing & Milestones
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Structured work breakdown structure (WBS) with verifiable physical progress milestones.
                </p>
              </div>

              {!isSubmitted && (
                <Button size="sm" variant="outline" onClick={addMilestone} icon={Plus}>
                  Add Milestone
                </Button>
              )}
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800 block">
                  Overall Execution Strategy & Phasing
                </label>
                <textarea
                  rows={3}
                  disabled={isSubmitted}
                  value={proposal.implementationPlan?.implementationApproach || ''}
                  onChange={(e) => updateImplementation('implementationApproach', e.target.value)}
                  placeholder="Describe your critical path methodology, crew scheduling, and parallel work streams..."
                  className="w-full p-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002B49] disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              {/* Milestones List */}
              <div className="space-y-3 pt-2">
                <label className="font-semibold text-slate-800 block text-xs">
                  Physical Milestones Checklist ({proposal.implementationPlan?.milestones?.length || 0})
                </label>

                {(proposal.implementationPlan?.milestones || []).map((m, idx) => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-[#002B49] text-white flex items-center justify-center font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          disabled={isSubmitted}
                          value={m.title}
                          onChange={(e) => updateMilestone(m.id, 'title', e.target.value)}
                          placeholder="Milestone Title (e.g. Sub-grade excavation)"
                          className="font-bold text-xs text-slate-900 bg-transparent border-b border-transparent focus:border-slate-400 focus:outline-none px-1"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          disabled={isSubmitted}
                          value={m.expectedCompletion}
                          onChange={(e) => updateMilestone(m.id, 'expectedCompletion', e.target.value)}
                          placeholder="Target (e.g. Month 2)"
                          className="w-24 text-[11px] font-mono font-medium text-slate-700 bg-white border border-slate-300 rounded px-2 py-1"
                        />
                        {!isSubmitted && (
                          <button
                            type="button"
                            onClick={() => removeMilestone(m.id)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      type="text"
                      disabled={isSubmitted}
                      value={m.description}
                      onChange={(e) => updateMilestone(m.id, 'description', e.target.value)}
                      placeholder="Detailed physical deliverables and measurable completion criteria..."
                      className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800 block">
                    Resource Deployment Plan
                  </label>
                  <textarea
                    rows={3}
                    disabled={isSubmitted}
                    value={proposal.implementationPlan?.resourcePlan || ''}
                    onChange={(e) => updateImplementation('resourcePlan', e.target.value)}
                    placeholder="Key site personnel, heavy machinery, concrete batching, power backups..."
                    className="w-full p-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002B49] disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800 block">
                    Risk Mitigation & Monsoon Contingencies
                  </label>
                  <textarea
                    rows={3}
                    disabled={isSubmitted}
                    value={proposal.implementationPlan?.riskConsiderations || ''}
                    onChange={(e) => updateImplementation('riskConsiderations', e.target.value)}
                    placeholder="Material price escalations, dewatering arrangements, local clearance delays..."
                    className="w-full p-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002B49] disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* STEP 4: FINANCIAL PROPOSAL */}
        {currentStep === 4 && (
          <Card className="p-6 sm:p-7 border-slate-200 bg-white space-y-6 shadow-xs">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                4. Financial Quote & Cost Decomposition
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Enter your firm financial bid amount. Applicable statutory GST (18%) is computed automatically.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <label className="font-bold text-slate-700 block mb-1">
                  Base Quoted Bid Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    disabled={isSubmitted}
                    value={proposal.financialProposal?.baseAmount || ''}
                    onChange={(e) => updateFinancial('baseAmount', e.target.value)}
                    placeholder="e.g. 12500000"
                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#002B49] disabled:bg-slate-100"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">Exclusive of GST</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="font-bold text-slate-700 block mb-1">Applicable GST @ 18%</span>
                <div className="py-2 font-mono font-bold text-slate-800 text-sm">
                  {formatCurrencyINR(proposal.financialProposal?.taxAmount || 0)}
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">Standard Statutory Rate</span>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs">
                <span className="font-bold text-blue-900 block mb-1">Total Firm Quoted Price</span>
                <div className="py-2 font-mono font-black text-blue-950 text-base">
                  {formatCurrencyINR(proposal.financialProposal?.totalProposedAmount || 0)}
                </div>
                <span className="text-[10px] text-blue-700 block mt-1">All-Inclusive Contract Value</span>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800 block">
                  Detailed Cost Component Breakdown
                </label>
                <textarea
                  rows={3}
                  disabled={isSubmitted}
                  value={proposal.financialProposal?.costBreakdown || ''}
                  onChange={(e) => updateFinancial('costBreakdown', e.target.value)}
                  placeholder="e.g. Civil construction: 60%, Mechanical fit-out: 25%, Engineering supervision: 10%, Contingency: 5%..."
                  className="w-full p-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002B49] disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800 block">
                  Payment Terms & Milestone-Linked Invoicing Schedule
                </label>
                <textarea
                  rows={3}
                  disabled={isSubmitted}
                  value={proposal.financialProposal?.paymentMilestones || ''}
                  onChange={(e) => updateFinancial('paymentMilestones', e.target.value)}
                  placeholder="e.g. 10% mobilization against bank guarantee, 30% on plinth level, 40% on structural completion, 20% upon final handover..."
                  className="w-full p-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002B49] disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>
          </Card>
        )}

        {/* STEP 5: TRACK RECORD & EXPERIENCE */}
        {currentStep === 5 && (
          <Card className="p-6 sm:p-7 border-slate-200 bg-white space-y-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  5. Organizational Experience & Completed Public Works
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Document similar government works executed to verify eligibility under technical evaluation criteria.
                </p>
              </div>

              {!isSubmitted && (
                <Button size="sm" variant="outline" onClick={addPastProject} icon={Plus}>
                  Add Prior Project
                </Button>
              )}
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800 block">
                    Years of Public Works Experience
                  </label>
                  <input
                    type="number"
                    disabled={isSubmitted}
                    value={proposal.experience?.yearsOfExperience || ''}
                    onChange={(e) => updateExperience('yearsOfExperience', Number(e.target.value))}
                    placeholder="e.g. 12"
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002B49] disabled:bg-slate-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800 block">
                    Registered Contractor Classification
                  </label>
                  <input
                    type="text"
                    disabled={isSubmitted}
                    value={proposal.experience?.keyCapabilities || ''}
                    onChange={(e) => updateExperience('keyCapabilities', e.target.value)}
                    placeholder="e.g. Class-I PWD Contractor / CPWD Enlisted Grade A"
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002B49] disabled:bg-slate-50"
                  />
                </div>
              </div>

              {/* Past Projects List */}
              <div className="space-y-3 pt-2">
                <label className="font-semibold text-slate-800 block text-xs">
                  Representative Works ({proposal.experience?.pastProjects?.length || 0})
                </label>

                {(proposal.experience?.pastProjects || []).map((proj, idx) => (
                  <div
                    key={proj.id}
                    className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-[#002B49]" />
                        Project #{idx + 1}
                      </span>

                      {!isSubmitted && (
                        <button
                          type="button"
                          onClick={() => removePastProject(proj.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        disabled={isSubmitted}
                        value={proj.projectName}
                        onChange={(e) => updatePastProject(proj.id, 'projectName', e.target.value)}
                        placeholder="Project Name"
                        className="text-xs text-slate-900 bg-white border border-slate-200 rounded px-2.5 py-1.5"
                      />
                      <input
                        type="text"
                        disabled={isSubmitted}
                        value={proj.clientAuthority}
                        onChange={(e) => updatePastProject(proj.id, 'clientAuthority', e.target.value)}
                        placeholder="Client Authority (e.g. PWD)"
                        className="text-xs text-slate-900 bg-white border border-slate-200 rounded px-2.5 py-1.5"
                      />
                      <input
                        type="number"
                        disabled={isSubmitted}
                        value={proj.value || ''}
                        onChange={(e) => updatePastProject(proj.id, 'value', Number(e.target.value))}
                        placeholder="Contract Value (₹)"
                        className="text-xs font-mono text-slate-900 bg-white border border-slate-200 rounded px-2.5 py-1.5"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* STEP 6: STATUTORY DECLARATIONS */}
        {currentStep === 6 && (
          <Card className="p-6 sm:p-7 border-slate-200 bg-white space-y-6 shadow-xs">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                6. Statutory Compliance & Non-Collusion Undertakings
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Mandatory declarations pursuant to General Financial Rules (GFR 2017) and Public Procurement Integrity Pacts.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isSubmitted}
                  checked={Boolean(proposal.complianceDeclarations?.accuracyConfirmed)}
                  onChange={(e) => updateCompliance('accuracyConfirmed', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#002B49] focus:ring-[#002B49]"
                />
                <span className="leading-relaxed text-slate-800">
                  <strong>Accuracy of Information:</strong> I hereby certify that all technical data, financial estimates, and statutory representations submitted in this bid are true, complete, and legally binding on our organization.
                </span>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isSubmitted}
                  checked={Boolean(proposal.complianceDeclarations?.eligibilitySatisfied)}
                  onChange={(e) => updateCompliance('eligibilitySatisfied', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#002B49] focus:ring-[#002B49]"
                />
                <span className="leading-relaxed text-slate-800">
                  <strong>Contractor Eligibility & Non-Debarment:</strong> Our firm is not debarred, blacklisted, or suspended by the Central Government, any State Government, or statutory public authority as on the date of this submission.
                </span>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isSubmitted}
                  checked={Boolean(proposal.complianceDeclarations?.documentsAuthentic)}
                  onChange={(e) => updateCompliance('documentsAuthentic', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#002B49] focus:ring-[#002B49]"
                />
                <span className="leading-relaxed text-slate-800">
                  <strong>Document Authenticity:</strong> All enclosed certificates, financial statements, and GSTIN returns are genuine copies of official statutory records.
                </span>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isSubmitted}
                  checked={Boolean(proposal.complianceDeclarations?.termsAgreed)}
                  onChange={(e) => updateCompliance('termsAgreed', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#002B49] focus:ring-[#002B49]"
                />
                <span className="leading-relaxed text-slate-800">
                  <strong>Integrity Pact & Terms of Procurement:</strong> We agree unconditionally to all General Conditions of Contract (GCC) and Special Conditions of Contract (SCC) issued for tender {tender.tenderNumber}.
                </span>
              </label>
            </div>
          </Card>
        )}

        {/* STEP 7: SUPPORTING DOCUMENTS */}
        {currentStep === 7 && (
          <Card className="p-6 sm:p-7 border-slate-200 bg-white space-y-6 shadow-xs">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                7. Mandatory Enclosures & Uploaded Proofs
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Verify that all statutory documents specified by the tender authority are attached.
              </p>
            </div>

            <div className="space-y-3">
              {(tender.requiredDocuments || [
                'Statutory GSTIN & PAN Verification Certificate',
                'Audited Financial Balance Sheets for past 3 years',
                'Technical Experience & Works Completion Certificates',
                'Earnest Money Deposit (EMD) or Bid Security Declaration',
              ]).map((docName, idx) => {
                const isAttached = (proposal.supportingDocuments || []).some(
                  (d) => d.documentType === docName || d.fileName.toLowerCase().includes('gst')
                );
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <FileCheck2 className="w-4 h-4 text-[#002B49] shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-900 block">{docName}</span>
                        <span className="text-[11px] text-slate-500">
                          {isAttached ? 'Attached & Verified via Organization Vault' : 'Pre-linked from Statutory Profile'}
                        </span>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Ready</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* STEP 8: FINAL REVIEW & SEAL SUBMISSION */}
        {currentStep === 8 && (
          <Card className="p-6 sm:p-7 border-slate-200 bg-white space-y-6 shadow-xs">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                8. Comprehensive Proposal Verification & Submission Seal
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Conduct a final audit of all proposal sections prior to official lock and submission.
              </p>
            </div>

            {/* Validation Checklist */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <span className="font-bold text-slate-900 block">Pre-Submission Statutory Readiness Checklist:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  {validationChecklist.hasTechApproach ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <span className={validationChecklist.hasTechApproach ? 'text-slate-800' : 'text-rose-600 font-bold'}>
                    Technical Approach Formulated
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {validationChecklist.hasProposedSolution ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <span className={validationChecklist.hasProposedSolution ? 'text-slate-800' : 'text-rose-600 font-bold'}>
                    Work Execution Solution Defined
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {validationChecklist.hasQuotedAmount ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <span className={validationChecklist.hasQuotedAmount ? 'text-slate-800' : 'text-rose-600 font-bold'}>
                    Financial Price Quoted ({formatCurrencyINR(proposal.financialProposal?.baseAmount || 0)})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {validationChecklist.hasCompliance ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <span className={validationChecklist.hasCompliance ? 'text-slate-800' : 'text-rose-600 font-bold'}>
                    All Statutory Compliance Declarations Accepted
                  </span>
                </div>
              </div>
            </div>

            {/* Summary Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Bidding Entity</span>
                <span className="font-bold text-slate-900 block mt-0.5">{organization.legalName}</span>
                <span className="text-[10px] font-mono text-slate-500">GSTIN: {organization.gstin}</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Milestones Planned</span>
                <span className="font-bold text-slate-900 block mt-0.5">
                  {proposal.implementationPlan?.milestones?.length || 0} Phased Stages
                </span>
                <span className="text-[10px] text-slate-500">Duration: {tender.durationValue} {tender.durationUnit}</span>
              </div>

              <div className="p-3.5 bg-blue-50/60 rounded-lg border border-blue-200">
                <span className="text-blue-900 block text-[11px] font-bold">Total Price Inclusive GST</span>
                <span className="font-black text-blue-950 text-base block mt-0.5">
                  {formatCurrencyINR(proposal.financialProposal?.totalProposedAmount || 0)}
                </span>
                <span className="text-[10px] text-blue-700">Authoritative Sealed Value</span>
              </div>
            </div>

            {/* Submission Action Bar */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <div className="text-xs text-slate-500">
                {isSubmitted ? (
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    This proposal is officially locked. No further modifications permitted.
                  </span>
                ) : validationChecklist.isValid ? (
                  <span className="text-slate-700 font-medium">
                    All mandatory criteria satisfied. You are ready to seal and submit.
                  </span>
                ) : (
                  <span className="text-rose-600 font-bold">
                    Please complete all required fields indicated above before submitting.
                  </span>
                )}
              </div>

              {!isSubmitted && (
                <Button
                  variant="gov"
                  size="md"
                  onClick={() => setShowSubmitModal(true)}
                  disabled={!validationChecklist.isValid || submitting}
                  icon={Send}
                  className="px-6 py-2.5"
                >
                  Seal & Submit Proposal
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Wizard Bottom Navigation Action Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
              disabled={currentStep === 1}
            >
              Previous Section
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep((prev) => Math.min(8, prev + 1))}
              disabled={currentStep === 8}
            >
              Next Section
            </Button>
          </div>

          {!isSubmitted && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={saving}
                icon={Save}
              >
                {saving ? 'Saving...' : 'Save Draft'}
              </Button>

              {currentStep < 8 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setCurrentStep((prev) => prev + 1)}
                  icon={ArrowRight}
                >
                  Continue
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Submit Confirmation Modal */}
        <Modal
          isOpen={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          title="Confirm Final Proposal Submission & Statutory Seal"
          size="md"
        >
          <div className="space-y-4 text-xs text-slate-700">
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>Notice of Immutability</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Once submitted, this proposal is sealed and cannot be modified through the application. Its contents are protected by the authoritative Firestore security rules and append-only audit trail.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Tender:</span>
                <span className="font-bold text-slate-900">{tender.tenderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Agency:</span>
                <span className="font-bold text-slate-900">{organization.legalName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quoted Bid:</span>
                <span className="font-bold text-[#002B49]">
                  {formatCurrencyINR(proposal.financialProposal?.baseAmount || 0)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              By confirming, you acknowledge that you are the authorized representative of {organization.legalName} and have statutory authority to bind your organization to this financial bid.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSubmitModal(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="gov"
                size="sm"
                onClick={handleConfirmSubmit}
                disabled={submitting}
                icon={Send}
              >
                {submitting ? 'Sealing & Submitting...' : 'Confirm & Submit Bid'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </VerificationGate>
  );
};
