// Bharat Tender Intelligence (BTI) — Government Tender Creation Wizard
// Phase 3A: Multi-Section Procurement Specifications Compiler

import React, { useState, useEffect, useRef } from 'react';
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
  ArrowRight,
  Save,
  Send,
  Plus,
  Trash2,
  HelpCircle,
  Clock,
} from 'lucide-react';
import { TenderService } from '../../services/firebase/tenders';
import {
  CanonicalTenderCategory,
  TENDER_CATEGORIES_MAP,
  TenderFormData,
  DurationUnit,
  Tender,
} from '../../types/tender';
import { useAuth } from '../../context/AuthContext';
import { TenderConfirmationModal } from '../../components/tenders/TenderConfirmationModal';

export interface GovernmentTenderCreatePageProps {
  onNavigate: (path: string) => void;
  tenderId?: string;
}

export const GovernmentTenderCreatePage: React.FC<GovernmentTenderCreatePageProps> = ({ onNavigate, tenderId }) => {
  const { user } = useAuth();

  const [activeSection, setActiveSection] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draft Edit Mode state
  const [loadedTender, setLoadedTender] = useState<Tender | null>(null);
  const [loadingTender, setLoadingTender] = useState<boolean>(Boolean(tenderId));
  const [fetchError, setFetchError] = useState<string | null>(null);
  const initialLoadDoneRef = useRef(false);

  // Form State
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultCloseStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CanonicalTenderCategory>('Road Infrastructure');
  const [subCategory, setSubCategory] = useState('');

  const [issuingAuthority, setIssuingAuthority] = useState('Office of the District Magistrate & District Nodal Officer');
  const [department, setDepartment] = useState('Public Works Department (PWD), Civil Division');
  const [mpName, setMpName] = useState('District Parliamentary Office');

  const [state, setState] = useState('Uttar Pradesh');
  const [district, setDistrict] = useState('Varanasi');
  const [constituency, setConstituency] = useState('Varanasi');
  const [projectLocation, setProjectLocation] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);

  const [sanctionedAmount, setSanctionedAmount] = useState<number>(25000000); // ₹2.5 Cr
  const [estimatedValue, setEstimatedValue] = useState<number>(23500000); // ₹2.35 Cr

  const [durationValue, setDurationValue] = useState<number>(90);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('days');
  const [publicationDate, setPublicationDate] = useState<string>(todayStr);
  const [closingDate, setClosingDate] = useState<string>(defaultCloseStr);

  const [eligibilityCriteria, setEligibilityCriteria] = useState<string[]>([
    'Registered Class-1/Class-A contractor with statutory state/central department',
    'Active GSTIN registration with regular GSTR-3B tax compliance',
    'Minimum 3 years verifiable experience in similar category civil infrastructure projects',
    'Certified average annual turnover of minimum 1.5x of estimated tender value in past 3 financial years',
    'Valid Bank Solvency Certificate issued by a Scheduled Commercial Bank within last 6 months',
  ]);
  const [newCriterion, setNewCriterion] = useState('');

  const [requiredDocuments, setRequiredDocuments] = useState<string[]>([
    'Technical Bid Document & Project Execution Blueprint',
    'Valid GSTIN Registration & Recent Tax Clearance Certificates',
    'Audited Financial Statements (Balance Sheet, P&L) for Last 3 Financial Years',
    'Work Completion Certificates for Similar Projects',
    'Bank Solvency Certificate from Scheduled Commercial Bank',
    'Non-Blacklisting & Integrity Pact Self-Declaration Affidavit',
  ]);
  const [newDocument, setNewDocument] = useState('');

  const [specialRequirements, setSpecialRequirements] = useState('');

  // Confirmation Modal
  const [showPublishModal, setShowPublishModal] = useState(false);

  // Load draft tender data when editing an existing draft
  useEffect(() => {
    if (!tenderId) {
      initialLoadDoneRef.current = true;
      return;
    }

    let isMounted = true;

    async function loadDraftTender() {
      try {
        setLoadingTender(true);
        setFetchError(null);
        const data = await TenderService.getTenderById(tenderId, user?.role);
        if (!isMounted) return;

        if (!data) {
          setFetchError('Draft tender record could not be found or access is restricted.');
          return;
        }

        if (data.status !== 'DRAFT') {
          setFetchError(`This tender is in '${data.status}' status and cannot be edited as a draft. Only DRAFT tenders can be edited.`);
          setLoadedTender(data);
          return;
        }

        setLoadedTender(data);

        // Pre-populate Section 1: Basic Information
        setTitle(data.title || '');
        setDescription(data.description || data.scopeOfWork || '');
        if (data.category) {
          setCategory(data.category as CanonicalTenderCategory);
        }
        setSubCategory(data.subCategory || '');

        // Pre-populate Section 2: Authority & MP Office
        setIssuingAuthority(data.issuingAuthority || 'Office of the District Magistrate & District Nodal Officer');
        setDepartment(data.department || 'Public Works Department (PWD), Civil Division');
        setMpName(data.mpName || 'District Parliamentary Office');

        // Pre-populate Section 3: Project Location
        setState(data.state || 'Uttar Pradesh');
        setDistrict(data.district || 'Varanasi');
        setConstituency(data.constituency || 'Varanasi');
        setProjectLocation(data.projectLocation || '');
        setLatitude(data.latitude !== undefined && !isNaN(Number(data.latitude)) ? Number(data.latitude) : undefined);
        setLongitude(data.longitude !== undefined && !isNaN(Number(data.longitude)) ? Number(data.longitude) : undefined);

        // Pre-populate Section 4: Financial Allocation
        setSanctionedAmount(Number(data.sanctionedAmount) || 0);
        setEstimatedValue(Number(data.estimatedValue) || Number(data.estimatedCost) || 0);

        // Pre-populate Section 5: Procurement Timeline
        setDurationValue(Number(data.durationValue) || 30);
        setDurationUnit((data.durationUnit as DurationUnit) || 'days');
        setPublicationDate(data.publicationDate || (data.publishedDate ? data.publishedDate.split('T')[0] : todayStr));
        setClosingDate(data.closingDate ? (data.closingDate.includes('T') ? data.closingDate.split('T')[0] : data.closingDate) : '');

        // Pre-populate Section 6: Eligibility Criteria
        if (Array.isArray(data.eligibilityCriteria) && data.eligibilityCriteria.length > 0) {
          setEligibilityCriteria(data.eligibilityCriteria);
        } else {
          setEligibilityCriteria([]);
        }

        // Pre-populate Section 7: Document Checklist & Special Requirements
        if (Array.isArray(data.requiredDocuments) && data.requiredDocuments.length > 0) {
          setRequiredDocuments(data.requiredDocuments);
        } else {
          setRequiredDocuments([]);
        }
        setSpecialRequirements(data.specialRequirements || '');

      } catch (err: any) {
        if (!isMounted) return;
        setFetchError(err?.message || 'Failed to load draft tender specifications.');
      } finally {
        if (isMounted) {
          setLoadingTender(false);
          setTimeout(() => {
            initialLoadDoneRef.current = true;
          }, 150);
        }
      }
    }

    loadDraftTender();

    return () => {
      isMounted = false;
    };
  }, [tenderId, user?.role, todayStr]);

  // Auto-calculate closing date when publicationDate, durationValue, or durationUnit change
  useEffect(() => {
    if (tenderId && !initialLoadDoneRef.current) {
      return;
    }
    try {
      const pub = new Date(publicationDate);
      if (!isNaN(pub.getTime()) && durationValue > 0) {
        let daysToAdd = durationValue;
        if (durationUnit === 'weeks') daysToAdd = durationValue * 7;
        if (durationUnit === 'months') daysToAdd = durationValue * 30;

        const calculatedClose = new Date(pub.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        setClosingDate(calculatedClose.toISOString().split('T')[0]);
      }
    } catch (err) {
      console.warn('Error calculating closing date:', err);
    }
  }, [publicationDate, durationValue, durationUnit, tenderId]);

  // Update subcategory options when category changes
  useEffect(() => {
    if (tenderId && !initialLoadDoneRef.current) {
      return;
    }
    const subcats = TENDER_CATEGORIES_MAP[category] || [];
    if (subcats.length > 0) {
      setSubCategory(subcats[0]);
    } else {
      setSubCategory('');
    }
  }, [category, tenderId]);

  // Currency Formatter helper
  const formatINR = (val: number) => {
    if (!val || isNaN(val)) return '₹0';
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Crore`;
    }
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)} Lakh`;
    }
    return `₹${val.toLocaleString('en-IN')}`;
  };

  // Build current payload
  const getFormData = (isDraftMode: boolean = false): TenderFormData => {
    const effectiveTitle = title.trim() || (isDraftMode ? `Draft Tender - ${new Date().toLocaleDateString('en-IN')}` : '');
    const latNum = latitude !== undefined && !isNaN(Number(latitude)) ? Number(latitude) : undefined;
    const lngNum = longitude !== undefined && !isNaN(Number(longitude)) ? Number(longitude) : undefined;

    return {
      title: effectiveTitle,
      description: description.trim(),
      category: category || 'Road Infrastructure',
      subCategory: subCategory.trim() || undefined,
      issuingAuthority: issuingAuthority.trim() || 'Office of the District Magistrate & District Nodal Officer',
      department: department.trim() || 'Public Works Department (PWD)',
      state: state.trim() || 'Uttar Pradesh',
      district: district.trim() || 'Varanasi',
      constituency: constituency.trim() || 'Varanasi',
      projectLocation: projectLocation.trim(),
      latitude: latNum,
      longitude: lngNum,
      sanctionedAmount: Number(sanctionedAmount) || 0,
      estimatedValue: Number(estimatedValue) || 0,
      durationValue: Number(durationValue) || 30,
      durationUnit: durationUnit || 'days',
      publicationDate: publicationDate || new Date().toISOString().split('T')[0],
      closingDate: closingDate.trim() || (isDraftMode ? undefined : new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]),
      eligibilityCriteria: eligibilityCriteria.filter((c) => c && c.trim().length > 0),
      requiredDocuments: requiredDocuments.filter((d) => d && d.trim().length > 0),
      specialRequirements: specialRequirements.trim() || undefined,
      mpName: mpName.trim() || undefined,
    };
  };

  // Save as Draft handler - Allows saving from any step with incomplete wizard data
  const handleSaveDraft = async () => {
    setError(null);
    if (!user) {
      setError('User session expired. Please sign in again.');
      return;
    }

    try {
      setLoading(true);
      const payload = getFormData(true);
      if (tenderId) {
        await TenderService.updateTenderDraft(tenderId, payload, user);
        onNavigate(`/government/tenders/${tenderId}`);
      } else {
        const created = await TenderService.createTender(payload, user, true);
        onNavigate(`/government/tenders/${created.id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save tender draft.');
    } finally {
      setLoading(false);
    }
  };

  // Publish handler
  const handlePublishConfirm = async (notes: string) => {
    if (!user) return;
    try {
      setLoading(true);
      const payload = getFormData(false);
      if (tenderId) {
        // Save latest wizard modifications to draft first
        await TenderService.updateTenderDraft(tenderId, payload, user);
        // Transition draft to LIVE with strict audit logging and publication verification
        await TenderService.publishTender(tenderId, user, notes);
        onNavigate(`/government/tenders/${tenderId}`);
      } else {
        const created = await TenderService.createTender(payload, user, false);
        onNavigate(`/government/tenders/${created.id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to publish tender.');
    } finally {
      setLoading(false);
      setShowPublishModal(false);
    }
  };

  // Criterion handlers
  const handleAddCriterion = () => {
    if (newCriterion.trim()) {
      setEligibilityCriteria([...eligibilityCriteria, newCriterion.trim()]);
      setNewCriterion('');
    }
  };

  const handleRemoveCriterion = (index: number) => {
    setEligibilityCriteria(eligibilityCriteria.filter((_, i) => i !== index));
  };

  // Document handlers
  const handleAddDocument = () => {
    if (newDocument.trim()) {
      setRequiredDocuments([...requiredDocuments, newDocument.trim()]);
      setNewDocument('');
    }
  };

  const handleRemoveDocument = (index: number) => {
    setRequiredDocuments(requiredDocuments.filter((_, i) => i !== index));
  };

  // Validate before publishing
  const validateForPublish = (): boolean => {
    setError(null);
    if (!title.trim()) {
      setError('Section A: Tender Title is required.');
      setActiveSection(1);
      return false;
    }
    if (!description.trim()) {
      setError('Section A: Detailed Scope of Work / Description is required.');
      setActiveSection(1);
      return false;
    }
    if (!projectLocation.trim()) {
      setError('Section C: Project Location is required.');
      setActiveSection(3);
      return false;
    }
    if (!sanctionedAmount || sanctionedAmount <= 0) {
      setError('Section D: Sanctioned Amount must be greater than zero.');
      setActiveSection(4);
      return false;
    }
    if (!estimatedValue || estimatedValue <= 0) {
      setError('Section D: Estimated Value must be greater than zero.');
      setActiveSection(4);
      return false;
    }
    if (!closingDate || isNaN(new Date(closingDate).getTime())) {
      setError('Section E: A valid closing date is required before publishing.');
      setActiveSection(5);
      return false;
    }
    if (new Date(closingDate).getTime() <= new Date(publicationDate).getTime()) {
      setError('Section E: Closing date must be strictly after the publication date.');
      setActiveSection(5);
      return false;
    }
    if (eligibilityCriteria.length === 0) {
      setError('Section F: At least one eligibility criterion is required.');
      setActiveSection(6);
      return false;
    }
    if (requiredDocuments.length === 0) {
      setError('Section G: At least one required statutory document must be listed.');
      setActiveSection(7);
      return false;
    }
    return true;
  };

  const sections = [
    { id: 1, title: 'Basic Information', icon: FileText },
    { id: 2, title: 'Authority & MP Office', icon: Building },
    { id: 3, title: 'Project Location', icon: MapPin },
    { id: 4, title: 'Financial Allocation', icon: IndianRupee },
    { id: 5, title: 'Procurement Timeline', icon: Calendar },
    { id: 6, title: 'Eligibility Criteria', icon: ShieldCheck },
    { id: 7, title: 'Document Checklist', icon: Paperclip },
    { id: 8, title: 'Review & Publish', icon: CheckCircle2 },
  ];

  if (loadingTender) {
    return (
      <div id="tender-wizard-loading" className="max-w-5xl mx-auto py-24 text-center">
        <Clock className="w-8 h-8 mx-auto mb-3 animate-spin text-slate-400" />
        <h2 className="text-base font-semibold text-slate-800">Loading Draft Tender Specifications...</h2>
        <p className="text-xs text-slate-500 mt-1">Retrieving official draft registry parameters.</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div id="tender-wizard-fetch-error" className="max-w-3xl mx-auto py-12 space-y-4">
        <button
          onClick={() => onNavigate('/government/tenders')}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Tender Management</span>
        </button>

        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-rose-900 text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Unable to Edit Tender</span>
          </div>
          <p>{fetchError}</p>
          {loadedTender && loadedTender.status !== 'DRAFT' && (
            <div className="pt-2">
              <button
                onClick={() => onNavigate(`/government/tenders/${loadedTender.id}`)}
                className="px-3.5 py-1.5 bg-white border border-rose-300 rounded-lg text-rose-800 font-medium hover:bg-rose-100 transition-colors"
              >
                View Tender Details
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div id="tender-creation-wizard-page" className="max-w-5xl mx-auto space-y-6">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <button
            onClick={() => onNavigate(tenderId ? `/government/tenders/${tenderId}` : '/government/tenders')}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{tenderId ? 'Back to Tender Details' : 'Back to Tender Management'}</span>
          </button>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {tenderId ? 'Edit Draft Tender' : 'Create New Government Tender'}
            </h1>
            {tenderId && loadedTender && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                {loadedTender.tenderNumber || 'DRAFT'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {tenderId
              ? 'Update statutory MPLAD procurement parameters, financial sanctions, and compliance criteria.'
              : 'Compile statutory MPLAD procurement parameters, financial sanctions, and compliance criteria.'}
          </p>
        </div>

        {/* Global Save Draft & Direct Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-slate-500" />
            <span>Save as Draft</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (validateForPublish()) {
                setShowPublishModal(true);
              }
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-xs disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>Publish Tender</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block mb-0.5">Validation Requirement:</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Step Navigation Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs overflow-x-auto">
        <div className="flex items-center gap-1 min-w-[700px]">
          {sections.map((sec) => {
            const IconComponent = sec.icon;
            const isCurrent = activeSection === sec.id;
            const isPast = activeSection > sec.id;

            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isCurrent
                    ? 'bg-slate-900 text-white shadow-xs'
                    : isPast
                    ? 'text-slate-800 hover:bg-slate-100'
                    : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                  isCurrent ? 'bg-white/20 text-white' : 'bg-slate-200'
                }`}>
                  {sec.id}
                </span>
                <span>{sec.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Wizard Form Sections */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
        {/* SECTION 1: Basic Information */}
        {activeSection === 1 && (
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Section 1: Basic Procurement Information
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Define the primary procurement subject, classification, and detailed scope of works.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tender Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Construction of 4-Lane Paved Connecting Link Road & Storm Water Kerb Drainage"
                className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Procurement Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CanonicalTenderCategory)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                >
                  {Object.keys(TENDER_CATEGORIES_MAP).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sub-Category
                </label>
                <select
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                >
                  {(TENDER_CATEGORIES_MAP[category] || []).map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Detailed Scope of Work & Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Comprehensive technical scope, materials specifications, structural components, and performance benchmarks..."
                rows={5}
                className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
        )}

        {/* SECTION 2: Issuing Authority */}
        {activeSection === 2 && (
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-600" />
                Section 2: Issuing Authority & Parliamentary Nodal Office
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Statutory nodal administrative desk and parliamentary MP office oversight.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Issuing Authority Entity
              </label>
              <input
                type="text"
                value={issuingAuthority}
                onChange={(e) => setIssuingAuthority(e.target.value)}
                placeholder="e.g. Office of the District Magistrate & District Nodal Officer"
                className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Executing Line Department
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Public Works Department (PWD), Civil Division"
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Member of Parliament (MP) Office / Sanctioned Authority
                </label>
                <input
                  type="text"
                  value={mpName}
                  onChange={(e) => setMpName(e.target.value)}
                  placeholder="e.g. Sh. Narendra Modi (Varanasi PC)"
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: Location */}
        {activeSection === 3 && (
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Section 3: Geographic & Site Location
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Physical project site, parliamentary constituency, and geographical coordinates.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  State <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Uttar Pradesh"
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  District <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Varanasi"
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Constituency <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={constituency}
                  onChange={(e) => setConstituency(e.target.value)}
                  placeholder="e.g. Varanasi"
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Project Site / Specific Location Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={projectLocation}
                onChange={(e) => setProjectLocation(e.target.value)}
                placeholder="e.g. Sewapuri Block to NH-19 Junction Link, Sector 4"
                className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Latitude (Optional GIS)
                </label>
                <input
                  type="number"
                  step="any"
                  value={latitude ?? ''}
                  onChange={(e) => setLatitude(e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="e.g. 25.3176"
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Longitude (Optional GIS)
                </label>
                <input
                  type="number"
                  step="any"
                  value={longitude ?? ''}
                  onChange={(e) => setLongitude(e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="e.g. 82.9739"
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: Financial Allocation */}
        {activeSection === 4 && (
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-blue-600" />
                Section 4: Financial Sanctions & Estimated Procurement Value
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Authorized MPLAD parliamentary fund allocation and technical civil cost estimates.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Total Sanctioned Fund (INR) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                  <input
                    type="number"
                    min="1"
                    value={sanctionedAmount}
                    onChange={(e) => setSanctionedAmount(Number(e.target.value))}
                    className="w-full text-sm font-semibold rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div className="text-xs font-medium text-slate-600">
                  Formatted: <strong className="text-slate-900">{formatINR(sanctionedAmount)}</strong>
                </div>
                <p className="text-[11px] text-slate-400">
                  Official allocation approved under Parliamentary Constituency Scheme.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Estimated Procurement Value (INR) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                  <input
                    type="number"
                    min="1"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(Number(e.target.value))}
                    className="w-full text-sm font-semibold rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div className="text-xs font-medium text-slate-600">
                  Formatted: <strong className="text-slate-900">{formatINR(estimatedValue)}</strong>
                </div>
                <p className="text-[11px] text-slate-400">
                  Baseline engineering schedule of rates (SoR) calculated by line department.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 5: Timeline */}
        {activeSection === 5 && (
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Section 5: Procurement & Bidding Timeline
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Set duration values, publication milestones, and proposal submission deadlines.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project Execution Duration Value <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={durationValue}
                  onChange={(e) => setDurationValue(Number(e.target.value))}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Duration Unit
                </label>
                <select
                  value={durationUnit}
                  onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                >
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Publication Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={publicationDate}
                  onChange={(e) => setPublicationDate(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bidding Closing Date & Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Automatically calculated based on duration; can be adjusted manually if needed.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 6: Eligibility Criteria */}
        {activeSection === 6 && (
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                Section 6: Contractor Eligibility Criteria
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Specify statutory, technical, and financial qualification thresholds for prospective agencies.
              </p>
            </div>

            {/* List of current criteria */}
            <div className="space-y-2">
              {eligibilityCriteria.map((crit, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-800"
                >
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{crit}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveCriterion(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors shrink-0"
                    title="Remove Criterion"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new criterion */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                value={newCriterion}
                onChange={(e) => setNewCriterion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCriterion();
                  }
                }}
                placeholder="Enter custom eligibility criteria bullet..."
                className="flex-1 text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
              <button
                type="button"
                onClick={handleAddCriterion}
                className="px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>
        )}

        {/* SECTION 7: Document Checklist & Special Requirements */}
        {activeSection === 7 && (
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-blue-600" />
                Section 7: Mandatory Required Documents & Special Conditions
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Statutory tender document metadata checklist and project site safety protocols.
              </p>
            </div>

            <div className="space-y-2">
              {requiredDocuments.map((doc, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-800"
                >
                  <div className="flex items-start gap-2">
                    <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{doc}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveDocument(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors shrink-0"
                    title="Remove Document Requirement"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new document */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                value={newDocument}
                onChange={(e) => setNewDocument(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDocument();
                  }
                }}
                placeholder="Enter mandatory statutory document name..."
                className="flex-1 text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
              <button
                type="button"
                onClick={handleAddDocument}
                className="px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            <div className="pt-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Special Field Conditions / Labor & Environmental Safety Requirements
              </label>
              <textarea
                value={specialRequirements}
                onChange={(e) => setSpecialRequirements(e.target.value)}
                placeholder="e.g. Strict environmental dust suppression protocols, zero disruption to adjoining hospital ward, mandatory insurance coverage for all construction laborers..."
                rows={3}
                className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
        )}

        {/* SECTION 8: Review & Publish */}
        {activeSection === 8 && (
          <div className="space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Section 8: Statutory Tender Review & Final Authorization
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify all procurement parameters prior to publishing or archiving as draft.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <span className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] block">
                  Procurement Summary
                </span>
                <div>
                  <span className="text-slate-500">Title:</span>
                  <p className="font-medium text-slate-900 mt-0.5">{title || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Category / Sub-Category:</span>
                  <p className="font-medium text-slate-800 mt-0.5">{category} • {subCategory || 'General'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Issuing Entity:</span>
                  <p className="font-medium text-slate-800 mt-0.5">{issuingAuthority}</p>
                </div>
                <div>
                  <span className="text-slate-500">Nodal Department / MP Office:</span>
                  <p className="font-medium text-slate-800 mt-0.5">{department} • {mpName}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <span className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] block">
                  Financials & Timeline
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sanctioned Fund:</span>
                  <span className="font-bold text-slate-900">{formatINR(sanctionedAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Estimated Value:</span>
                  <span className="font-medium text-slate-800">{formatINR(estimatedValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Duration:</span>
                  <span className="font-medium text-slate-800">{durationValue} {durationUnit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Bidding Closes:</span>
                  <span className="font-bold text-amber-700">{closingDate || 'Pending Definition'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <span className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] block">
                  Project Location & Parliamentary Seat
                </span>
                <div>
                  <span className="text-slate-500">Site / Landmark:</span>
                  <p className="font-medium text-slate-900 mt-0.5">{projectLocation || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Constituency & District:</span>
                  <p className="font-medium text-slate-800 mt-0.5">{constituency}, {district}, {state}</p>
                </div>
                <div>
                  <span className="text-slate-500">Coordinates:</span>
                  <p className="font-mono text-slate-700 mt-0.5">
                    {latitude !== undefined && longitude !== undefined
                      ? `${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E`
                      : 'Coordinates pending (optional)'}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <span className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] block">
                  Compliance & Document Checklist
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-500">Eligibility Criteria:</span>
                  <span className="font-bold text-slate-900">{eligibilityCriteria.length} criteria defined</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Required Documents:</span>
                  <span className="font-bold text-slate-900">{requiredDocuments.length} statutory documents</span>
                </div>
                {specialRequirements && (
                  <div>
                    <span className="text-slate-500">Special Terms:</span>
                    <p className="font-medium text-slate-800 mt-0.5 line-clamp-2">{specialRequirements}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-2">
              <div className="flex items-center gap-2 text-blue-900 font-semibold">
                <HelpCircle className="w-4 h-4" />
                <span>Publishing Disclaimer</span>
              </div>
              <p className="text-blue-800 leading-relaxed">
                By publishing this tender, you confirm that financial sanctions have been duly verified under parliamentary allocation rules. The tender specifications will be registered with an immutable audit event and will become open for registered agency proposals.
              </p>
            </div>
          </div>
        )}

        {/* Wizard Footer Navigation Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div>
            {activeSection > 1 ? (
              <button
                type="button"
                onClick={() => setActiveSection(activeSection - 1)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous Section</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('/government/tenders')}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Draft</span>
            </button>

            {activeSection < sections.length ? (
              <button
                type="button"
                onClick={() => setActiveSection(activeSection + 1)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (validateForPublish()) {
                    setShowPublishModal(true);
                  }
                }}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-xs"
              >
                <Send className="w-4 h-4" />
                <span>Publish Tender Now</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showPublishModal && (
        <TenderConfirmationModal
          isOpen={showPublishModal}
          action="PUBLISH"
          tender={{
            id: tenderId || 'draft',
            tenderNumber: loadedTender?.tenderNumber || 'Pending Assignment',
            title,
            category,
            sanctionedAmount,
            estimatedValue,
            estimatedCost: estimatedValue,
            status: 'DRAFT',
            closingDate,
            publicationDate,
            state,
            constituency,
            description,
            mpName,
            proposalsCount: loadedTender?.proposalsCount || 0,
            riskScore: loadedTender?.riskScore || 0,
            riskLevel: loadedTender?.riskLevel || 'LOW',
          }}
          onClose={() => setShowPublishModal(false)}
          onConfirm={handlePublishConfirm}
        />
      )}
    </div>
  );
};
