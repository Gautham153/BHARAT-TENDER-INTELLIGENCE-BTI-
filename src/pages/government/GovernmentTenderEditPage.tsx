// Bharat Tender Intelligence (BTI) — Government Tender Draft Editor
// Phase 3A: Draft Specification Modification & Publishing Gateway

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
  Save,
  Send,
  Plus,
  Trash2,
  Clock,
  Lock,
} from 'lucide-react';
import { TenderService } from '../../services/firebase/tenders';
import {
  Tender,
  CanonicalTenderCategory,
  TENDER_CATEGORIES_MAP,
  TenderFormData,
  DurationUnit,
} from '../../types/tender';
import { useAuth } from '../../context/AuthContext';
import { TenderConfirmationModal } from '../../components/tenders/TenderConfirmationModal';

export interface GovernmentTenderEditPageProps {
  tenderId: string;
  onNavigate: (path: string) => void;
}

export const GovernmentTenderEditPage: React.FC<GovernmentTenderEditPageProps> = ({ tenderId, onNavigate }) => {
  const { user } = useAuth();

  const [tender, setTender] = useState<Tender | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CanonicalTenderCategory>('Road Infrastructure');
  const [subCategory, setSubCategory] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [department, setDepartment] = useState('');
  const [mpName, setMpName] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [constituency, setConstituency] = useState('');
  const [projectLocation, setProjectLocation] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [sanctionedAmount, setSanctionedAmount] = useState<number>(0);
  const [estimatedValue, setEstimatedValue] = useState<number>(0);
  const [durationValue, setDurationValue] = useState<number>(90);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('days');
  const [publicationDate, setPublicationDate] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [eligibilityCriteria, setEligibilityCriteria] = useState<string[]>([]);
  const [newCriterion, setNewCriterion] = useState('');
  const [requiredDocuments, setRequiredDocuments] = useState<string[]>([]);
  const [newDocument, setNewDocument] = useState('');
  const [specialRequirements, setSpecialRequirements] = useState('');

  // Publish Confirmation Modal
  const [showPublishModal, setShowPublishModal] = useState(false);

  useEffect(() => {
    const fetchTender = async () => {
      if (!tenderId) return;
      try {
        setLoading(true);
        const data = await TenderService.getTenderById(tenderId);
        if (!data) {
          setError('Tender record not found.');
          return;
        }
        setTender(data);

        // Populate fields
        setTitle(data.title || '');
        setDescription(data.description || '');
        setCategory((data.category as CanonicalTenderCategory) || 'Road Infrastructure');
        setSubCategory(data.subCategory || '');
        setIssuingAuthority(data.issuingAuthority || '');
        setDepartment(data.department || '');
        setMpName(data.mpName || '');
        setState(data.state || '');
        setDistrict(data.district || '');
        setConstituency(data.constituency || '');
        setProjectLocation(data.projectLocation || '');
        setLatitude(data.latitude);
        setLongitude(data.longitude);
        setSanctionedAmount(data.sanctionedAmount || data.estimatedCost || 0);
        setEstimatedValue(data.estimatedValue || data.estimatedCost || 0);
        setDurationValue(data.durationValue || 90);
        setDurationUnit(data.durationUnit || 'days');
        setPublicationDate(data.publicationDate || data.publishedDate || '');
        setClosingDate(data.closingDate || '');
        setEligibilityCriteria(data.eligibilityCriteria || []);
        setRequiredDocuments(data.requiredDocuments || []);
        setSpecialRequirements(data.specialRequirements || '');
      } catch (err: any) {
        setError(err.message || 'Error fetching tender details.');
      } finally {
        setLoading(false);
      }
    };

    fetchTender();
  }, [tenderId]);

  // Recalculate closing date on duration change
  const handleDurationChange = (val: number, unit: DurationUnit) => {
    setDurationValue(val);
    setDurationUnit(unit);
    try {
      const pub = new Date(publicationDate);
      if (!isNaN(pub.getTime()) && val > 0) {
        let days = val;
        if (unit === 'weeks') days = val * 7;
        if (unit === 'months') days = val * 30;
        const newClose = new Date(pub.getTime() + days * 24 * 60 * 60 * 1000);
        setClosingDate(newClose.toISOString().split('T')[0]);
      }
    } catch {}
  };

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

  const handleSave = async () => {
    if (!tender || !user) return;
    setError(null);

    if (!title.trim()) {
      setError('Tender Title is required.');
      return;
    }
    if (sanctionedAmount <= 0) {
      setError('Sanctioned Amount must be greater than zero.');
      return;
    }
    if (estimatedValue <= 0) {
      setError('Estimated Value must be greater than zero.');
      return;
    }
    if (new Date(closingDate).getTime() <= new Date(publicationDate).getTime()) {
      setError('Closing date must be strictly after publication date.');
      return;
    }

    try {
      setSaving(true);
      const payload: Partial<TenderFormData> = {
        title: title.trim(),
        description: description.trim(),
        category,
        subCategory,
        issuingAuthority,
        department,
        mpName,
        state,
        district,
        constituency,
        projectLocation,
        latitude,
        longitude,
        sanctionedAmount: Number(sanctionedAmount),
        estimatedValue: Number(estimatedValue),
        durationValue: Number(durationValue),
        durationUnit,
        publicationDate,
        closingDate,
        eligibilityCriteria,
        requiredDocuments,
        specialRequirements,
      };

      await TenderService.updateTenderDraft(tender.id, payload, user);
      onNavigate(`/government/tenders/${tender.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update tender draft.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishConfirm = async (notes: string) => {
    if (!tender || !user) return;
    try {
      setSaving(true);
      // Save changes first
      await TenderService.updateTenderDraft(
        tender.id,
        {
          title: title.trim(),
          description: description.trim(),
          category,
          subCategory,
          issuingAuthority,
          department,
          mpName,
          state,
          district,
          constituency,
          projectLocation,
          latitude,
          longitude,
          sanctionedAmount: Number(sanctionedAmount),
          estimatedValue: Number(estimatedValue),
          durationValue: Number(durationValue),
          durationUnit,
          publicationDate,
          closingDate,
          eligibilityCriteria,
          requiredDocuments,
          specialRequirements,
        },
        user
      );

      // Publish
      await TenderService.publishTender(tender.id, user, notes);
      onNavigate(`/government/tenders/${tender.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to publish tender.');
    } finally {
      setSaving(false);
      setShowPublishModal(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500">
        <Clock className="w-8 h-8 mx-auto mb-2 animate-spin text-slate-400" />
        Loading tender draft specifications...
      </div>
    );
  }

  if (error && !tender) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 bg-white rounded-xl border border-slate-200 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Notice</h2>
        <p className="text-xs text-slate-500">{error}</p>
        <button
          onClick={() => onNavigate('/government/tenders')}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white"
        >
          Return to Tenders
        </button>
      </div>
    );
  }

  // Non-DRAFT Lock Guard
  if (tender && tender.status !== 'DRAFT') {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-xl border border-slate-200 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          Tender Specifications Locked
        </h2>
        <p className="text-xs text-slate-700 max-w-md mx-auto leading-relaxed">
          Tender <strong className="font-mono text-blue-700">{tender.tenderNumber}</strong> is currently in <strong className="uppercase font-semibold">{tender.status}</strong> status. In compliance with government procurement regulations, published, live, or closed tenders cannot be directly edited.
        </p>
        <div className="pt-2">
          <button
            onClick={() => onNavigate(`/government/tenders/${tender.id}`)}
            className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs"
          >
            View Tender Overview & Lifecycle Actions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="tender-edit-draft-page" className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <button
            onClick={() => onNavigate(`/government/tenders/${tender?.id}`)}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Cancel & Return</span>
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Edit Tender Draft
            </h1>
            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {tender?.tenderNumber}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Modify draft specifications before official national procurement publication.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPublishModal(true)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-xs disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>Publish Directly</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form Fields */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6 text-xs">
        {/* Basic Info */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            Basic Information
          </h2>

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Tender Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CanonicalTenderCategory)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              >
                {Object.keys(TENDER_CATEGORIES_MAP).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Sub-Category
              </label>
              <input
                type="text"
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Scope of Works & Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {/* Financials & Timeline */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-blue-600" />
            Financial Sanctions & Timeline
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Sanctioned Amount (INR) — {formatINR(sanctionedAmount)}
              </label>
              <input
                type="number"
                value={sanctionedAmount}
                onChange={(e) => setSanctionedAmount(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 font-semibold"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Estimated Procurement Value (INR) — {formatINR(estimatedValue)}
              </label>
              <input
                type="number"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Duration Value
              </label>
              <input
                type="number"
                value={durationValue}
                onChange={(e) => handleDurationChange(Number(e.target.value), durationUnit)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Duration Unit
              </label>
              <select
                value={durationUnit}
                onChange={(e) => handleDurationChange(durationValue, e.target.value as DurationUnit)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              >
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Closing Date
              </label>
              <input
                type="date"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            Project Site Location
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-700 font-medium mb-1">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">District</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Constituency</label>
              <input
                type="text"
                value={constituency}
                onChange={(e) => setConstituency(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Site Location Details</label>
            <input
              type="text"
              value={projectLocation}
              onChange={(e) => setProjectLocation(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onNavigate(`/government/tenders/${tender?.id}`)}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              {saving ? 'Saving...' : 'Save Draft Changes'}
            </button>
            <button
              type="button"
              onClick={() => setShowPublishModal(true)}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-xs"
            >
              Publish Tender
            </button>
          </div>
        </div>
      </div>

      {showPublishModal && tender && (
        <TenderConfirmationModal
          isOpen={showPublishModal}
          action="PUBLISH"
          tender={tender}
          onClose={() => setShowPublishModal(false)}
          onConfirm={handlePublishConfirm}
        />
      )}
    </div>
  );
};
