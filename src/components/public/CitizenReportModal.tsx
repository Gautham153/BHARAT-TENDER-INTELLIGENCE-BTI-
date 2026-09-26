// Bharat Tender Intelligence (BTI) — Citizen Report Modal Component
// Phase 10: Citizen Grievance & Participatory Social Audit Submission Modal

import React, { useState } from 'react';
import {
  X,
  AlertCircle,
  Shield,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Copy,
  Check,
  FileText,
  Lock,
  Eye,
  Info,
  Building2,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { PublicProjectDTO } from '../../types/publicTransparency';
import {
  CitizenReportNature,
  CITIZEN_REPORT_NATURE_LABELS,
  CitizenReporterMode,
  CitizenReportMedia,
} from '../../types/citizenReport';
import { CitizenReportService } from '../../services/citizen/citizenReportService';

interface CitizenReportModalProps {
  project: PublicProjectDTO;
  isOpen: boolean;
  onClose: () => void;
}

export const CitizenReportModal: React.FC<CitizenReportModalProps> = ({ project, isOpen, onClose }) => {
  const [reporterMode, setReporterMode] = useState<CitizenReporterMode>('ANONYMOUS');
  const [reporterName, setReporterName] = useState('');
  const [reporterMobile, setReporterMobile] = useState('');
  const [natureOfAnomaly, setNatureOfAnomaly] = useState<CitizenReportNature>('PROGRESS_MISREPRESENTATION');
  const [locationDetails, setLocationDetails] = useState('');
  const [specificEvidence, setSpecificEvidence] = useState('');
  const [mediaList, setMediaList] = useState<CitizenReportMedia[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submissionReceipt, setSubmissionReceipt] = useState<{
    reportId: string;
    submittedAt: string;
    status: string;
    projectTitle: string;
    trackingNote: string;
  } | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Support up to 3 attachments
    const remainingSlots = Math.max(0, 3 - mediaList.length);
    const filesToProcess = Array.from(files).slice(0, remainingSlots) as File[];

    filesToProcess.forEach((file: File) => {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage(`File ${file.name} exceeds 5MB limit.`);
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      setMediaList((prev) => [
        ...prev,
        {
          mediaId: `med-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          type: file.type || 'image/jpeg',
          size: file.size,
          previewUrl,
          uploadedAt: new Date().toISOString(),
        },
      ]);
    });
  };

  const handleRemoveMedia = (mediaId: string) => {
    setMediaList((prev) => {
      const item = prev.find((m) => m.mediaId === mediaId);
      if (item?.previewUrl) {
        try {
          URL.revokeObjectURL(item.previewUrl);
        } catch {}
      }
      return prev.filter((m) => m.mediaId !== mediaId);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (specificEvidence.trim().length < 10) {
      setErrorMessage('Please provide a detailed observation statement (at least 10 characters).');
      return;
    }

    if (reporterMode === 'IDENTIFIED') {
      if (!reporterName.trim()) {
        setErrorMessage('Please provide your name or switch to Anonymous mode.');
        return;
      }
      if (!reporterMobile.trim()) {
        setErrorMessage('Please provide a contact mobile number for administrative verification.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Clean media objects - send metadata only to Firestore (no Base64)
      const cleanMedia = mediaList.map(({ previewUrl, dataUrl, ...rest }) => ({
        ...rest,
      }));

      const result = await CitizenReportService.submitReport({
        projectId: project.projectId || (project as any).id,
        reporterMode,
        reporterName: reporterMode === 'IDENTIFIED' ? reporterName : undefined,
        reporterMobile: reporterMode === 'IDENTIFIED' ? reporterMobile : undefined,
        natureOfAnomaly,
        locationDetails,
        specificEvidence,
        media: cleanMedia,
      });

      setSubmissionReceipt(result.receipt);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyReceipt = () => {
    if (!submissionReceipt) return;
    navigator.clipboard.writeText(submissionReceipt.reportId);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2000);
  };

  const handleResetAndClose = () => {
    setSubmissionReceipt(null);
    setSpecificEvidence('');
    setLocationDetails('');
    setMediaList([]);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div
      id="citizen-report-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="citizen-report-modal-title"
    >
      <div
        id="citizen-report-modal-container"
        className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 id="citizen-report-modal-title" className="text-lg font-semibold text-slate-900 tracking-tight">
                Citizen Social Audit & Observation Filing
              </h2>
              <p className="text-xs text-slate-500">
                Institutional feedback channel for eligible public MPLAD projects
              </p>
            </div>
          </div>
          <button
            id="citizen-report-close-button"
            type="button"
            onClick={handleResetAndClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[78vh] overflow-y-auto space-y-6">
          {submissionReceipt ? (
            /* Success Receipt Screen */
            <div id="citizen-report-receipt-screen" className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-900">Observation Successfully Submitted</h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Your social audit observation has been recorded in the BTI monitoring registry and queued for
                  administrative triage.
                </p>
              </div>

              {/* Receipt Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 max-w-md mx-auto text-left space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Report Tracking ID</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base text-slate-900">{submissionReceipt.reportId}</span>
                    <button
                      id="citizen-report-copy-receipt-btn"
                      type="button"
                      onClick={handleCopyReceipt}
                      className="p-1 text-slate-500 hover:text-slate-800 rounded transition-colors"
                      title="Copy Tracking ID"
                    >
                      {copiedReceipt ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="text-xs space-y-1.5 text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Project:</span>
                    <span className="font-medium text-slate-800 truncate max-w-[240px]" title={submissionReceipt.projectTitle}>
                      {submissionReceipt.projectTitle}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Submitted At:</span>
                    <span className="font-medium text-slate-800">
                      {new Date(submissionReceipt.submittedAt).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Initial Status:</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                      SUBMITTED
                    </span>
                  </div>
                </div>
              </div>

              {/* Notice */}
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 text-left flex gap-2.5 max-w-md mx-auto">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p>
                  <strong>Institutional Workflow:</strong> A citizen report represents an evidence lead requiring
                  authoritative review. A government nodal officer will verify the observation against official milestones
                  and schedule statutory field inspection if discrepancies are indicated.
                </p>
              </div>

              <div className="pt-2">
                <button
                  id="citizen-report-receipt-done-btn"
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Submission Form */
            <form id="citizen-report-submission-form" onSubmit={handleSubmit} className="space-y-6">
              {/* Institutional Notice */}
              <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 space-y-1">
                  <p className="font-semibold text-amber-950">Statutory Notice & Privacy Protocol</p>
                  <p>
                    Citizen social audit observations are submitted directly to authorized government monitoring cells.
                    Submitting a report does not automatically confirm an irregularity or alter official project metrics.
                    Your identity is strictly protected from public view.
                  </p>
                </div>
              </div>

              {/* Authoritative Project Snapshot */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Authoritative Project Record
                </div>
                <div className="text-sm font-semibold text-slate-900 leading-snug">
                  {project.projectName || (project as any).title || 'MPLAD Project'}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {typeof (project as any).constituency === 'string'
                      ? (project as any).constituency
                      : (project.location?.constituency || 'Parliamentary Constituency')}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {typeof project.location === 'object' && project.location !== null
                      ? [project.location.district, project.location.state].filter(Boolean).join(', ') || 'Location Not Specified'
                      : typeof (project as any).location === 'string'
                      ? (project as any).location
                      : 'Location Not Specified'}
                  </span>
                  {project.projectNumber && (
                    <span className="font-mono text-slate-500">Ref: {String(project.projectNumber)}</span>
                  )}
                </div>
              </div>

              {/* Reporter Privacy Mode Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Reporter Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReporterMode('ANONYMOUS')}
                    className={`p-3 rounded-lg border text-left transition-all flex items-start gap-2.5 ${
                      reporterMode === 'ANONYMOUS'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 ring-1 ring-indigo-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Lock className={`w-4 h-4 mt-0.5 ${reporterMode === 'ANONYMOUS' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold">Anonymous Report</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        No name or contact information recorded.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReporterMode('IDENTIFIED')}
                    className={`p-3 rounded-lg border text-left transition-all flex items-start gap-2.5 ${
                      reporterMode === 'IDENTIFIED'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 ring-1 ring-indigo-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Eye className={`w-4 h-4 mt-0.5 ${reporterMode === 'IDENTIFIED' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold">Identified Citizen</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Protected from public; accessible only to reviewing officer.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Identified Citizen Inputs (Conditional) */}
              {reporterMode === 'IDENTIFIED' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="citizen-reporter-name-input"
                      type="text"
                      required
                      value={reporterName}
                      onChange={(e) => setReporterName(e.target.value)}
                      placeholder="e.g. Ramesh Chandra"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Contact Mobile Number <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="citizen-reporter-mobile-input"
                      type="tel"
                      required
                      value={reporterMobile}
                      onChange={(e) => setReporterMobile(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Nature of Anomaly / Observation Dropdown */}
              <div>
                <label htmlFor="citizen-report-nature-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Nature of Observation <span className="text-rose-600">*</span>
                </label>
                <select
                  id="citizen-report-nature-select"
                  value={natureOfAnomaly}
                  onChange={(e) => setNatureOfAnomaly(e.target.value as CitizenReportNature)}
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 outline-none font-medium text-slate-900"
                >
                  {(Object.keys(CITIZEN_REPORT_NATURE_LABELS) as CitizenReportNature[]).map((key) => (
                    <option key={key} value={key}>
                      {CITIZEN_REPORT_NATURE_LABELS[key].label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {CITIZEN_REPORT_NATURE_LABELS[natureOfAnomaly]?.description}
                </p>
              </div>

              {/* Location Details on Site */}
              <div>
                <label htmlFor="citizen-report-location-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Specific Site Location / Landmark
                </label>
                <input
                  id="citizen-report-location-input"
                  type="text"
                  value={locationDetails}
                  onChange={(e) => setLocationDetails(e.target.value)}
                  maxLength={1000}
                  placeholder="e.g., Near Ward 4 Panchayat Bhawan or Eastern Boundary Wall"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 outline-none"
                />
              </div>

              {/* Specific Evidence / Ground Observation */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="citizen-report-evidence-textarea" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Specific Ground Observation & Evidence <span className="text-rose-600">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {specificEvidence.length}/4000
                  </span>
                </div>
                <textarea
                  id="citizen-report-evidence-textarea"
                  required
                  rows={4}
                  minLength={10}
                  maxLength={4000}
                  value={specificEvidence}
                  onChange={(e) => setSpecificEvidence(e.target.value)}
                  placeholder="Describe your factual on-site observation. For instance, describe the physical state of the structure, whether equipment is active or abandoned, whether materials appear substandard, or how the visible state diverges from the officially published milestone."
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 outline-none leading-relaxed"
                />
              </div>

              {/* Photo / Media Attachment Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Photographic / Visual Evidence (Optional)
                  </label>
                  <span className="text-[11px] text-slate-400">Max 3 photos (5MB each)</span>
                </div>

                {/* Upload Trigger Area */}
                {mediaList.length < 3 && (
                  <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-lg cursor-pointer bg-slate-50/60 hover:bg-slate-50 transition-colors">
                    <Upload className="w-5 h-5 text-slate-400 mb-1" />
                    <span className="text-xs font-medium text-slate-700">Upload Site Photo</span>
                    <span className="text-[10px] text-slate-500">Supports JPEG, PNG, WebP</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                )}

                {/* Media Preview Chips */}
                {mediaList.length > 0 && (
                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    {mediaList.map((m) => (
                      <div
                        key={m.mediaId}
                        className="relative group rounded-md border border-slate-200 overflow-hidden bg-slate-100 aspect-video flex items-center justify-center"
                      >
                        {m.previewUrl || m.dataUrl ? (
                          <img
                            src={m.previewUrl || m.dataUrl}
                            alt={m.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-slate-400" />
                        )}
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveMedia(m.mediaId)}
                            className="p-1 bg-rose-600 text-white rounded-full hover:bg-rose-700 transition-colors"
                            title="Remove attachment"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="absolute bottom-1 left-1 right-1 px-1 py-0.5 bg-black/60 text-white text-[9px] truncate rounded">
                          {m.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="citizen-report-submit-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-700 hover:bg-indigo-800 disabled:bg-indigo-400 text-white text-xs font-semibold rounded-md shadow-sm transition-colors flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Filing Observation...
                    </>
                  ) : (
                    'Submit Observation'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
