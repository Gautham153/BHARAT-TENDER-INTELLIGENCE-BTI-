// Bharat Tender Intelligence (BTI) — Document Intelligence Workspace
// Phase 11: Document Ingestion, Structured Understanding & Cross-Validation Interface

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Search,
  Eye,
  FileCheck2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  Info,
  Building2,
  Receipt,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  ShieldAlert,
  Hash,
  Download,
  AlertCircle,
  Check,
  RotateCw,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { ProgressBar } from '../ui/ProgressBar';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { DocumentService } from '../../services/document/documentService';
import {
  ProjectDocument,
  DocumentType,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_INCONSISTENCY_LABELS,
  DocumentInconsistencyIndicator,
  DocumentProcessingStatus,
  DocumentReviewStatus,
} from '../../types/document';
import { Project } from '../../types/project';
import { formatCurrencyINR } from '../tenders/TenderOpportunityCard';
import { DEMONSTRATION_DOCUMENTS, DEMO_DOCUMENT_NOTICE } from '../../data/demonstrationDocuments';

export interface DocumentIntelligenceWorkspaceProps {
  project: Project;
  userRole?: 'government' | 'agency';
  onNavigate?: (path: string) => void;
}

export const DocumentIntelligenceWorkspace: React.FC<DocumentIntelligenceWorkspaceProps> = ({
  project,
  userRole = 'government',
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const isGov = userRole === 'government' || (user?.role || '').toLowerCase().includes('gov');

  // State
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedDocIds, setExpandedDocIds] = useState<Set<string>>(new Set());

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadType, setUploadType] = useState<DocumentType>('INVOICE');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [fileHashPreview, setFileHashPreview] = useState<string>('');
  const [uploadNotes, setUploadNotes] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);

  // Human Review Modal State
  const [reviewingDoc, setReviewingDoc] = useState<ProjectDocument | null>(null);
  const [reviewAction, setReviewAction] = useState<'ACKNOWLEDGE' | 'MARK_RESOLVED' | 'REQUEST_REVISION'>('ACKNOWLEDGE');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  // Reprocessing state
  const [reprocessingDocId, setReprocessingDocId] = useState<string | null>(null);

  // Load documents for project
  const loadDocuments = useCallback(async () => {
    if (!project?.id) return;
    try {
      setLoading(true);
      const docs = await DocumentService.getDocumentsForProject(project.id);
      
      // If none found and this is a demo project or has demo documents, load demo docs
      if (docs.length === 0 && (project.id.includes('demo') || project.id === 'proj-mplad-2026-001')) {
        const demoDocs = DEMONSTRATION_DOCUMENTS.filter(
          (d) => d.projectId === project.id || project.id === 'proj-mplad-2026-001'
        );
        setDocuments(demoDocs);
      } else {
        setDocuments(docs);
      }
    } catch (err: any) {
      console.warn('[DocumentIntelligenceWorkspace] Failed to fetch documents:', err);
      // Fallback to local / demo if available
      const demoDocs = DEMONSTRATION_DOCUMENTS.filter(
        (d) => d.projectId === project.id || project.id.includes('demo') || project.id === 'proj-mplad-2026-001'
      );
      if (demoDocs.length > 0) {
        setDocuments(demoDocs);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [project?.id]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Toggle expansion
  const toggleExpanded = (id: string) => {
    setExpandedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Expand first document by default when loaded
  useEffect(() => {
    if (documents.length > 0 && expandedDocIds.size === 0) {
      setExpandedDocIds(new Set([documents[0].id]));
    }
  }, [documents]);

  // Compute metrics
  const metrics = useMemo(() => {
    const total = documents.length;
    const validatedClean = documents.filter((d) => d.validationStatus === 'VALIDATED_CLEAN').length;
    const reviewRequired = documents.filter(
      (d) => d.validationStatus === 'INCONSISTENCY_DETECTED' || d.reviewStatus === 'REVIEW_REQUIRED'
    ).length;
    const processing = documents.filter(
      (d) => d.processingStatus === 'PROCESSING' || d.processingStatus === 'UPLOADED'
    ).length;
    return { total, validatedClean, reviewRequired, processing };
  }, [documents]);

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (filterType !== 'ALL' && doc.documentType !== filterType) return false;
      if (filterStatus === 'CLEAN' && doc.validationStatus !== 'VALIDATED_CLEAN') return false;
      if (filterStatus === 'REVIEW_REQUIRED' && doc.validationStatus !== 'INCONSISTENCY_DETECTED') return false;
      if (filterStatus === 'PROCESSING' && doc.processingStatus !== 'PROCESSING') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = doc.originalFileName.toLowerCase().includes(q);
        const matchType = (DOCUMENT_TYPE_LABELS[doc.documentType] || '').toLowerCase().includes(q);
        const matchUploader = (doc.uploaderName || '').toLowerCase().includes(q);
        const matchInvoice = doc.extractedData?.invoiceNumber?.value?.toString().toLowerCase().includes(q);
        return matchName || matchType || matchUploader || matchInvoice;
      }
      return true;
    });
  }, [documents, filterType, filterStatus, searchQuery]);

  // Handle file selection in upload modal
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      showToast('File Too Large', {
        message: 'File size exceeds the 15MB limit. Please upload a smaller document.',
        type: 'error',
      });
      return;
    }

    setSelectedFile(file);

    // Read Base64 and compute preview hash
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result as string;
      setFileBase64(b64);

      // Compute client-side SHA-256 preview
      try {
        const cleanB64 = b64.replace(/^data:[^;]+;base64,/, '');
        const binary = atob(cleanB64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
        const hashArr = Array.from(new Uint8Array(hashBuf));
        const hashHex = hashArr.map((b) => b.toString(16).padStart(2, '0')).join('');
        setFileHashPreview(hashHex);
      } catch (err) {
        setFileHashPreview('');
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Document Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast('File Required', { message: 'Please select a document file to upload.', type: 'warning' });
      return;
    }

    setUploading(true);
    try {
      const newDoc = await DocumentService.uploadDocument(
        {
          projectId: project.id,
          documentType: uploadType,
          originalFileName: selectedFile.name,
          mimeType: selectedFile.type || 'application/pdf',
          fileSize: selectedFile.size,
          fileDataUrl: fileBase64,
          notes: uploadNotes,
        },
        user
      );

      showToast('Document Ingested Successfully', {
        message: `"${selectedFile.name}" registered. Structured extraction & deterministic cross-validation initiated.`,
        type: 'success',
      });

      setShowUploadModal(false);
      setSelectedFile(null);
      setFileBase64('');
      setFileHashPreview('');
      setUploadNotes('');

      // Refresh document list
      await loadDocuments();
      setExpandedDocIds((prev) => new Set([...prev, newDoc.id]));
    } catch (err: any) {
      console.error('[DocumentIntelligenceWorkspace] Upload error:', err);
      showToast('Upload Failed', {
        message: err.message || 'Could not upload document. Please check permissions.',
        type: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  // Handle Official Human Review Submit
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingDoc) return;
    if (!reviewNotes.trim()) {
      showToast('Review Notes Required', {
        message: 'Please provide official administrative justification notes.',
        type: 'warning',
      });
      return;
    }

    setSubmittingReview(true);
    try {
      const updated = await DocumentService.recordHumanReview(
        {
          documentId: reviewingDoc.id,
          action: reviewAction,
          reviewNotes: reviewNotes.trim(),
        },
        user
      );

      showToast('Human Review Recorded', {
        message: `Official review decision (${reviewAction}) saved with audit trail.`,
        type: 'success',
      });

      setReviewingDoc(null);
      setReviewNotes('');
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch (err: any) {
      console.error('[DocumentIntelligenceWorkspace] Review error:', err);
      showToast('Review Submission Failed', {
        message: err.message || 'Could not record review decision.',
        type: 'error',
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  // Handle Reprocess Document
  const handleReprocess = async (docId: string) => {
    setReprocessingDocId(docId);
    try {
      const updated = await DocumentService.reprocessDocument(docId, user);
      showToast('Extraction & Validation Refreshed', {
        message: 'Document extraction and deterministic cross-validation re-executed.',
        type: 'success',
      });
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch (err: any) {
      showToast('Reprocessing Failed', {
        message: err.message || 'Could not reprocess document.',
        type: 'error',
      });
    } finally {
      setReprocessingDocId(null);
    }
  };

  // Populate Demo Scenarios for demonstration testing
  const handleLoadDemoScenarios = () => {
    const demoDocs = DEMONSTRATION_DOCUMENTS.map((d) => ({
      ...d,
      projectId: project.id,
      projectTitle: project.title,
      projectNumber: project.projectNumber || project.projectCode || project.id,
    }));
    setDocuments(demoDocs);
    setExpandedDocIds(new Set(demoDocs.map((d) => d.id)));
    showToast('Demonstration Scenarios Loaded', {
      message: '5 canonical Phase 11 scenarios (Clean Match, Progress Mismatch, Sanction Overrun, Reference Divergence, Entity Discrepancy) loaded for testing.',
      type: 'info',
    });
  };

  return (
    <div className="space-y-6">
      {/* Regulatory Context Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-[#002B49] text-white p-4 rounded-xl shadow-xs border border-blue-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-800/80 rounded-lg text-blue-200 shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-wide">
                  Document Intelligence & Deterministic Cross-Validation
                </h3>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-800 text-blue-200 border border-blue-700">
                  Phase 11
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                AI structured extraction corroborated against authoritative project baselines, PFMS disbursements, and verified on-site inspection logs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadDemoScenarios}
              className="text-xs bg-blue-800/60 text-blue-100 hover:bg-blue-800 border-blue-700"
            >
              <RotateCw className="w-3.5 h-3.5 mr-1.5" />
              Load Demo Scenarios
            </Button>
            <Button
              size="sm"
              onClick={() => setShowUploadModal(true)}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Upload Document
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Ingested Documents</span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">{metrics.total}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Stored in Secure Vault</div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Corroborated Clean</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-700">{metrics.validatedClean}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Full Baseline Alignment</div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Verification Required</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-700">{metrics.reviewRequired}</div>
          <div className="text-[11px] text-amber-600 mt-0.5">Variances Detected</div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Processing Queue</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-bold font-mono text-indigo-700">{metrics.processing}</div>
          <div className="text-[11px] text-indigo-600 mt-0.5">Gemini Server Extraction</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents, invoice numbers, vendors..."
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium"
          >
            <option value="ALL">All Document Types</option>
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="CLEAN">Validated Clean</option>
            <option value="REVIEW_REQUIRED">Review Required (Variance)</option>
            <option value="PROCESSING">Processing / In-Flight</option>
          </select>
        </div>

        <div className="flex items-center gap-2 self-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshing(true);
              loadDocuments();
            }}
            disabled={refreshing}
            className="text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500">Retrieving project documents and validation models...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 space-y-3">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <div>
            <h4 className="font-bold text-sm text-slate-800">No Documents Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {searchQuery || filterType !== 'ALL' || filterStatus !== 'ALL'
                ? 'No documents matched your filter parameters. Try clearing your filters.'
                : 'No official documents have been uploaded for this project yet.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" onClick={() => setShowUploadModal(true)} className="text-xs">
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Upload Project Document
            </Button>
            <Button variant="outline" size="sm" onClick={handleLoadDemoScenarios} className="text-xs">
              <RotateCw className="w-3.5 h-3.5 mr-1.5" />
              Load Demo Scenarios
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDocuments.map((doc) => {
            const isExpanded = expandedDocIds.has(doc.id);
            const isReprocessing = reprocessingDocId === doc.id;
            const extracted = doc.extractedData || {};
            const results = doc.crossValidationResults || [];
            const summary = doc.crossValidationSummary;
            const hasDiscrepancy = (summary?.mismatchCount || 0) > 0 || doc.validationStatus === 'INCONSISTENCY_DETECTED';

            return (
              <div
                key={doc.id}
                className={`bg-white rounded-xl border transition-all duration-200 ${
                  hasDiscrepancy
                    ? 'border-amber-300 shadow-xs ring-1 ring-amber-100'
                    : doc.validationStatus === 'VALIDATED_CLEAN'
                    ? 'border-emerald-200 shadow-xs'
                    : 'border-slate-200'
                }`}
              >
                {/* Header row */}
                <div
                  onClick={() => toggleExpanded(doc.id)}
                  className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/80 rounded-t-xl"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`p-2.5 rounded-lg shrink-0 ${
                        hasDiscrepancy
                          ? 'bg-amber-100 text-amber-800'
                          : doc.validationStatus === 'VALIDATED_CLEAN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      <FileText className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 truncate">
                          {doc.originalFileName}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType}
                        </span>
                        {doc.isDemonstrationData && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Demonstration Data
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap font-mono">
                        <span>Size: {(doc.fileSize / 1024).toFixed(1)} KB</span>
                        <span>•</span>
                        <span>Uploaded: {new Date(doc.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span>•</span>
                        <span>By: {doc.uploaderName || doc.uploadedBy} ({doc.uploaderRole})</span>
                        {doc.fileHash && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                              <Hash className="w-3 h-3 text-slate-400" />
                              SHA-256: {doc.fileHash.slice(0, 10)}...
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    {/* Status Badge */}
                    {doc.validationStatus === 'VALIDATED_CLEAN' ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Corroborated Clean
                      </span>
                    ) : hasDiscrepancy ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Variance Requiring Verification ({summary?.mismatchCount || 1})
                      </span>
                    ) : doc.processingStatus === 'PROCESSING' ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                        Extracting with Gemini...
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {doc.processingStatus}
                      </span>
                    )}

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 sm:p-5 space-y-6 bg-slate-50/50 rounded-b-xl">
                    {/* Demonstration Disclaimer if demo */}
                    {doc.isDemonstrationData && (
                      <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Demonstration Scenario:</strong> {DEMO_DOCUMENT_NOTICE}
                        </div>
                      </div>
                    )}

                    {/* Section 1: Structured Document Understanding (Gemini AI Extraction) */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                          <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                            Structured Extraction Payload (AI Advisory)
                          </h4>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                          <span>Provider: {doc.extractionProvider || 'Gemini Document Intelligence'}</span>
                          {doc.extractionModel && <span>• Model: {doc.extractionModel}</span>}
                          {doc.extractionTimestamp && (
                            <span>• {new Date(doc.extractionTimestamp).toLocaleTimeString('en-IN')}</span>
                          )}
                        </div>
                      </div>

                      {doc.extractionStatus === 'FAILED' ? (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>
                            {doc.processingError ||
                              'Document extraction is currently unavailable. The original document has been preserved for manual review.'}
                          </span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {/* Extracted Fields */}
                          {extracted.invoiceNumber?.value && (
                            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="text-[10px] text-slate-500 block uppercase font-medium">Invoice Number</span>
                              <span className="font-mono font-bold text-slate-900 text-xs">
                                {extracted.invoiceNumber.value}
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5 truncate" title={extracted.invoiceNumber.source}>
                                Source: {extracted.invoiceNumber.source || 'Header'}
                              </div>
                            </div>
                          )}

                          {extracted.amount?.value !== undefined && extracted.amount?.value !== null && (
                            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="text-[10px] text-slate-500 block uppercase font-medium">Document Amount</span>
                              <span className="font-mono font-bold text-slate-900 text-xs">
                                {formatCurrencyINR(extracted.amount.value)}
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5 truncate" title={extracted.amount.source}>
                                Source: {extracted.amount.source || 'Amount Field'}
                              </div>
                            </div>
                          )}

                          {(extracted.organizationName?.value || extracted.agencyName?.value) && (
                            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="text-[10px] text-slate-500 block uppercase font-medium">Billed Agency / Vendor</span>
                              <span className="font-bold text-slate-900 text-xs truncate block">
                                {extracted.organizationName?.value || extracted.agencyName?.value}
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                GSTIN: {extracted.gstin?.value || 'Verified on Seal'}
                              </div>
                            </div>
                          )}

                          {(extracted.projectId?.value || extracted.projectReferenceNumber?.value) && (
                            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="text-[10px] text-slate-500 block uppercase font-medium">Project Reference Cited</span>
                              <span className="font-mono font-bold text-slate-900 text-xs truncate block">
                                {extracted.projectReferenceNumber?.value || extracted.projectId?.value}
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                Source: {extracted.projectReferenceNumber?.source || 'Work Order Ref'}
                              </div>
                            </div>
                          )}

                          {extracted.completionPercentage?.value !== undefined && extracted.completionPercentage?.value !== null && (
                            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="text-[10px] text-slate-500 block uppercase font-medium">Certified Completion %</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-mono font-bold text-slate-900 text-xs">
                                  {extracted.completionPercentage.value}%
                                </span>
                                <div className="flex-1">
                                  <ProgressBar
                                    value={extracted.completionPercentage.value}
                                    color="emerald"
                                    size="sm"
                                    showPercentage={false}
                                  />
                                </div>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                Source: {extracted.completionPercentage.source || 'Certificate Progress'}
                              </div>
                            </div>
                          )}

                          {extracted.documentDate?.value && (
                            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="text-[10px] text-slate-500 block uppercase font-medium">Document Date</span>
                              <span className="font-mono font-bold text-slate-900 text-xs">
                                {extracted.documentDate.value}
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                Source: {extracted.documentDate.source || 'Date Box'}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Advisory Notice */}
                      <div className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                        * Note: Structured extraction is an automated decision-support advisory. AI never declares fraud or makes official legal determinations.
                      </div>
                    </div>

                    {/* Section 2: Deterministic Cross-Validation Engine */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-blue-600" />
                          <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                            Deterministic Cross-Validation Engine
                          </h4>
                        </div>
                        {summary && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-emerald-700 font-bold">{summary.matchCount} Matches</span>
                            <span>•</span>
                            <span className={summary.mismatchCount > 0 ? 'text-amber-700 font-bold' : 'text-slate-500'}>
                              {summary.mismatchCount} Variances
                            </span>
                          </div>
                        )}
                      </div>

                      {results.length === 0 ? (
                        <div className="text-center py-4 text-xs text-slate-500">
                          Cross-validation pending or no authoritative baseline comparators available.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {results.map((rule, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg border text-xs ${
                                rule.category === 'MATCH'
                                  ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                                  : rule.category === 'MISMATCH'
                                  ? 'bg-amber-50/70 border-amber-300 text-amber-950'
                                  : 'bg-slate-50 border-slate-200 text-slate-800'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1.5 flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    {rule.category === 'MATCH' ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    ) : (
                                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                    )}
                                    <span className="font-bold text-xs">{rule.ruleName}</span>
                                    {rule.indicator && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                                        {DOCUMENT_INCONSISTENCY_LABELS[rule.indicator] || rule.indicator}
                                      </span>
                                    )}
                                  </div>

                                  {/* Side-by-side values */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                                    <div className="bg-white/80 p-2 rounded border border-slate-200">
                                      <span className="text-[10px] text-slate-500 block uppercase">Document Value</span>
                                      <span className="font-mono font-bold text-slate-900">
                                        {rule.documentValue !== null && rule.documentValue !== undefined
                                          ? typeof rule.documentValue === 'number' && rule.field === 'amount'
                                            ? formatCurrencyINR(rule.documentValue)
                                            : String(rule.documentValue)
                                          : 'Not Specified in Document'}
                                      </span>
                                      {rule.documentSource && (
                                        <span className="text-[10px] text-slate-400 block truncate">
                                          ({rule.documentSource})
                                        </span>
                                      )}
                                    </div>

                                    <div className="bg-white/80 p-2 rounded border border-slate-200">
                                      <span className="text-[10px] text-slate-500 block uppercase">Authoritative Baseline Value</span>
                                      <span className="font-mono font-bold text-slate-900">
                                        {rule.authoritativeValue !== null && rule.authoritativeValue !== undefined
                                          ? typeof rule.authoritativeValue === 'number' && rule.field === 'amount'
                                            ? formatCurrencyINR(rule.authoritativeValue)
                                            : String(rule.authoritativeValue)
                                          : 'N/A'}
                                      </span>
                                      <span className="text-[10px] text-slate-400 block truncate">
                                        ({rule.authoritativeSource})
                                      </span>
                                    </div>
                                  </div>

                                  {/* Variance Explanation */}
                                  {rule.varianceDescription && (
                                    <p className="text-[11px] font-medium text-amber-900 mt-1">
                                      {rule.varianceDescription}
                                    </p>
                                  )}
                                  <p className="text-[11px] text-slate-600">{rule.explanation}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Section 3: Official Human Review Desk (Government Action) */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                            Official Government Review & Audit
                          </h4>
                        </div>
                        {doc.reviewedAt && (
                          <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Reviewed by {doc.reviewedByName} on {new Date(doc.reviewedAt).toLocaleDateString('en-IN')}
                          </span>
                        )}
                      </div>

                      {doc.reviewStatus === 'RESOLVED' || doc.reviewStatus === 'ACKNOWLEDGED' ? (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Official Review Completed ({doc.reviewStatus})
                          </div>
                          {doc.reviewNotes && (
                            <p className="text-emerald-800 text-[11px] pl-5.5 italic">"{doc.reviewNotes}"</p>
                          )}
                        </div>
                      ) : isGov && hasDiscrepancy ? (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-amber-900">
                              Variance Requires Human Decision
                            </span>
                            <Button
                              size="sm"
                              onClick={() => {
                                setReviewingDoc(doc);
                                setReviewNotes('');
                              }}
                              className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                              Record Review Decision
                            </Button>
                          </div>
                          <p className="text-[11px] text-amber-800">
                            Per BTI Section 27 regulatory compliance, automated tools never approve or dismiss discrepancies. An authorized government officer must examine and record official review.
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">
                          {doc.validationStatus === 'VALIDATED_CLEAN'
                            ? 'Document fully corroborates official baseline records. No manual intervention required.'
                            : 'Awaiting extraction or validation processing.'}
                        </p>
                      )}

                      {/* Reprocess & Actions Toolbar */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReprocess(doc.id)}
                          disabled={isReprocessing}
                          className="text-xs"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isReprocessing ? 'animate-spin' : ''}`} />
                          Reprocess Extraction
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Document Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Project Document to Vault"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs text-slate-800">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Declared Document Type *</label>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as DocumentType)}
              required
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Select Document File *</label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.txt,.docx"
              onChange={handleFileChange}
              required
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Supported formats: PDF, PNG, JPG, JPEG, TXT (Maximum: 15MB).
            </span>
          </div>

          {selectedFile && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 font-mono text-[11px]">
              <div>File: <span className="font-bold text-slate-900">{selectedFile.name}</span></div>
              <div>Size: {(selectedFile.size / 1024).toFixed(1)} KB</div>
              {fileHashPreview && (
                <div className="truncate">
                  SHA-256: <span className="text-slate-600">{fileHashPreview}</span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">Administrative Notes (Optional)</label>
            <textarea
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
              placeholder="e.g. Interim running bill #3 covering milestone 2 superstructure works."
              rows={2}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowUploadModal(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={uploading || !selectedFile}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Storing & Extracting...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Ingest & Process Document
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Human Review Modal */}
      {reviewingDoc && (
        <Modal
          isOpen={Boolean(reviewingDoc)}
          onClose={() => setReviewingDoc(null)}
          title={`Official Review: ${reviewingDoc.originalFileName}`}
        >
          <form onSubmit={handleReviewSubmit} className="space-y-4 text-xs text-slate-800">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="font-bold text-amber-900 block mb-1">
                Detected Variance Summary
              </span>
              <p className="text-amber-800 text-[11px]">
                {reviewingDoc.crossValidationSummary?.inconsistencies?.join(', ') ||
                  'Extracted document values differ from project baseline records.'}
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Review Determination *</label>
              <select
                value={reviewAction}
                onChange={(e) => setReviewAction(e.target.value as any)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium"
              >
                <option value="ACKNOWLEDGE">Acknowledge Discrepancy (Flag for Verification)</option>
                <option value="MARK_RESOLVED">Mark Resolved (Legitimate Variance / Rectified)</option>
                <option value="REQUEST_REVISION">Request Agency Revision (Reject Submission)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Official Review Notes *</label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Enter administrative justification, site inspection cross-check notes, or revision instructions..."
                rows={3}
                required
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReviewingDoc(null)}
                disabled={submittingReview}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submittingReview || !reviewNotes.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                {submittingReview ? 'Recording Decision...' : 'Save Official Review Decision'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
