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
  Play,
  CornerDownRight,
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
  DOCUMENT_REVIEW_STATUS_LABELS,
  DocumentInconsistencyIndicator,
  DocumentProcessingStatus,
  DocumentReviewStatus,
} from '../../types/document';
import { Project } from '../../types/project';
import { formatCurrencyINR } from '../tenders/TenderOpportunityCard';

export interface DocumentIntelligenceWorkspaceProps {
  project: Project;
  userRole?: 'government' | 'agency';
  onNavigate?: (path: string) => void;
  targetDocumentId?: string;
}

export const DocumentIntelligenceWorkspace: React.FC<DocumentIntelligenceWorkspaceProps> = ({
  project,
  userRole = 'government',
  targetDocumentId,
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
  const [revisionTargetDoc, setRevisionTargetDoc] = useState<ProjectDocument | null>(null);
  const [uploadType, setUploadType] = useState<DocumentType>('INVOICE');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [fileHashPreview, setFileHashPreview] = useState<string>('');
  const [uploadNotes, setUploadNotes] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);

  // Human Review Modal State
  const [reviewingDoc, setReviewingDoc] = useState<ProjectDocument | null>(null);
  const [reviewAction, setReviewAction] = useState<
    'ACKNOWLEDGE' | 'MARK_VERIFICATION' | 'START_VERIFICATION' | 'COMPLETE_VERIFICATION' | 'REQUEST_REVISION' | 'MARK_RESOLVED'
  >('ACKNOWLEDGE');
  const [verificationDecision, setVerificationDecision] = useState<string>('VERIFIED_ACCURATE');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  // Reprocessing & Processing states
  const [reprocessingDocId, setReprocessingDocId] = useState<string | null>(null);
  const [startingProcessingDocId, setStartingProcessingDocId] = useState<string | null>(null);

  // Load documents for project
  const loadDocuments = useCallback(async () => {
    if (!project?.id) return;
    try {
      setLoading(true);
      const docs = await DocumentService.getDocumentsForProject(project.id, user);
      setDocuments(docs);
    } catch (err: any) {
      console.warn('[DocumentIntelligenceWorkspace] Failed to fetch documents:', err);
      setDocuments([]);
      showToast('Error Loading Documents', {
        message: err.message || 'Failed to retrieve authoritative project documents.',
        type: 'error',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [project?.id, user, showToast]);

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

  // Expand target document and ensure it is visible when targetDocumentId is provided
  useEffect(() => {
    if (documents.length > 0) {
      if (targetDocumentId && documents.some((d) => d.id === targetDocumentId)) {
        setExpandedDocIds((prev) => new Set([...prev, targetDocumentId]));
        setFilterStatus('ALL');
        setFilterType('ALL');
        setSearchQuery('');
      } else if (expandedDocIds.size === 0) {
        setExpandedDocIds(new Set([documents[0].id]));
      }
    }
  }, [documents, targetDocumentId]);

  // Compute metrics (Section 19)
  const metrics = useMemo(() => {
    const total = documents.length;
    const validatedClean = documents.filter(
      (d) => d.validationStatus === 'VALIDATED_CLEAN' || d.reviewStatus === 'VERIFIED' || d.reviewStatus === 'RESOLVED'
    ).length;
    const reviewRequired = documents.filter(
      (d) =>
        d.validationStatus === 'INCONSISTENCY_DETECTED' ||
        d.reviewStatus === 'REVIEW_REQUIRED' ||
        d.reviewStatus === 'VERIFICATION_REQUIRED' ||
        d.reviewStatus === 'VERIFICATION_IN_PROGRESS' ||
        d.reviewStatus === 'REVISION_REQUESTED'
    ).length;
    const processing = documents.filter(
      (d) => d.processingStatus === 'PROCESSING' || d.processingStatus === 'UPLOADED' || d.extractionStatus === 'PENDING'
    ).length;
    return { total, validatedClean, reviewRequired, processing };
  }, [documents]);

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (filterType !== 'ALL' && doc.documentType !== filterType) return false;
      if (filterStatus === 'CLEAN' && !(doc.validationStatus === 'VALIDATED_CLEAN' || doc.reviewStatus === 'VERIFIED' || doc.reviewStatus === 'RESOLVED')) return false;
      if (filterStatus === 'VERIFICATION_REQUIRED' && !(doc.reviewStatus === 'VERIFICATION_REQUIRED' || doc.reviewStatus === 'VERIFICATION_IN_PROGRESS')) return false;
      if (filterStatus === 'REVIEW_REQUIRED' && !(doc.validationStatus === 'INCONSISTENCY_DETECTED' || doc.reviewStatus === 'REVIEW_REQUIRED' || doc.reviewStatus === 'ACKNOWLEDGED')) return false;
      if (filterStatus === 'REVISION_REQUESTED' && doc.reviewStatus !== 'REVISION_REQUESTED') return false;
      if (filterStatus === 'PROCESSING' && !(doc.processingStatus === 'PROCESSING' || doc.processingStatus === 'UPLOADED' || doc.extractionStatus === 'PENDING')) return false;
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

    // Supported formats validation
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];
    const fileNameLower = file.name.toLowerCase();
    const isExtensionAllowed = allowedExtensions.some((ext) => fileNameLower.endsWith(ext));
    const allowedMimePrefixes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const isMimeAllowed = !file.type || allowedMimePrefixes.includes(file.type.toLowerCase());

    if (!isExtensionAllowed || !isMimeAllowed) {
      showToast('Unsupported Format', {
        message: 'Only PDF, PNG, and JPEG documents are supported for ingestion & extraction.',
        type: 'error',
      });
      e.target.value = '';
      setSelectedFile(null);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      showToast('File Too Large', {
        message: 'File size exceeds the 15MB limit. Please upload a smaller document.',
        type: 'error',
      });
      return;
    }

    setSelectedFile(file);

    // Compute client-side SHA-256 preview directly from arrayBuffer
    try {
      file.arrayBuffer().then(async (arrayBuffer) => {
        const hashBuf = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArr = Array.from(new Uint8Array(hashBuf));
        const hashHex = hashArr.map((b) => b.toString(16).padStart(2, '0')).join('');
        setFileHashPreview(hashHex);
      }).catch(() => {
        setFileHashPreview('');
      });
    } catch {
      setFileHashPreview('');
    }
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
      const isRevision = Boolean(revisionTargetDoc);
      const newDoc = await DocumentService.uploadDocument(
        {
          projectId: project.id,
          documentType: uploadType,
          originalFileName: selectedFile.name,
          mimeType: selectedFile.type || 'application/pdf',
          fileSize: selectedFile.size,
          file: selectedFile,
          notes: uploadNotes,
          revisionOfDocumentId: revisionTargetDoc?.id,
          revisionNumber: revisionTargetDoc ? (revisionTargetDoc.revisionNumber || 1) + 1 : undefined,
        },
        user
      );

      // Section 20 & 21: Accurate UI Outcomes
      if (isGov) {
        if (newDoc.validationStatus === 'VALIDATED_CLEAN') {
          showToast('Document Processed Successfully', {
            message: `"${selectedFile.name}" verified clean against authoritative project baselines.`,
            type: 'success',
          });
        } else if (newDoc.processingStatus === 'EXTRACTION_FAILED') {
          showToast('Document Extraction Failed', {
            message: `"${selectedFile.name}" registered. Extraction failed — manual officer review required.`,
            type: 'warning',
          });
        } else {
          showToast('Document Processed — Verification Required', {
            message: `"${selectedFile.name}" processed. Baseline variances detected requiring verification.`,
            type: 'warning',
          });
        }
      } else {
        showToast('Document Uploaded Successfully', {
          message: isRevision
            ? `Revision submitted for "${revisionTargetDoc?.originalFileName}". Awaiting government processing.`
            : `"${selectedFile.name}" uploaded successfully. Awaiting government processing.`,
          type: 'success',
        });
      }

      setShowUploadModal(false);
      setRevisionTargetDoc(null);
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

  // Section 3: Explicit Government "Start Processing" for newly submitted documents
  const handleStartProcessing = async (docId: string) => {
    setStartingProcessingDocId(docId);
    try {
      const updated = await DocumentService.processDocumentExtraction(docId, user);
      if (updated.validationStatus === 'VALIDATED_CLEAN') {
        showToast('Processing Completed', {
          message: 'Document extraction and cross-validation completed. Full baseline alignment confirmed.',
          type: 'success',
        });
      } else if (updated.processingStatus === 'EXTRACTION_FAILED') {
        showToast('Extraction Failed', {
          message: updated.processingError || 'Automatic extraction failed. Document preserved for manual review.',
          type: 'warning',
        });
      } else {
        showToast('Verification Required', {
          message: 'Document processed. Baseline variances detected requiring officer review.',
          type: 'warning',
        });
      }
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch (err: any) {
      console.error('[DocumentIntelligenceWorkspace] Start processing error:', err);
      showToast('Processing Error', {
        message: err.message || 'Could not process document.',
        type: 'error',
      });
    } finally {
      setStartingProcessingDocId(null);
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
          verificationDecision: reviewAction === 'COMPLETE_VERIFICATION' ? verificationDecision : undefined,
        },
        user
      );

      const decisionLabels: Record<string, string> = {
        ACKNOWLEDGE: 'Government review acknowledged (verification pending)',
        MARK_VERIFICATION: 'Marked for official verification',
        START_VERIFICATION: 'Verification in progress',
        COMPLETE_VERIFICATION: 'Official verification completed',
        REQUEST_REVISION: 'Agency revision requested',
        MARK_RESOLVED: 'Discrepancy marked resolved',
      };

      showToast('Official Review Recorded', {
        message: decisionLabels[reviewAction] || `Review decision saved with audit trail.`,
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

  // Handle Reprocess Document (Explicit rerun for already processed documents)
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

  // Handle Download Document (Short-Lived Signed URL)
  const handleDownloadDocument = async (docItem: ProjectDocument, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    try {
      const { downloadUrl, fileName } = await DocumentService.getDocumentDownloadUrl(docItem.id);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = fileName || docItem.originalFileName || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      showToast('Download Failed', {
        message: err.message || 'Unable to retrieve document from storage vault.',
        type: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Document Intelligence Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 rounded-lg text-slate-700 shrink-0">
              <FileCheck2 className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#002B49] tracking-tight">
                Document Intelligence & Deterministic Cross-Validation
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                AI structured extraction corroborated against authoritative project baselines, PFMS disbursements, and verified on-site inspection logs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
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
            <option value="CLEAN">Clean & Verified</option>
            <option value="VERIFICATION_REQUIRED">Verification Required</option>
            <option value="REVIEW_REQUIRED">Review Required</option>
            <option value="REVISION_REQUESTED">Revision Requested</option>
            <option value="PROCESSING">Processing Queue (In-Flight / Awaiting)</option>
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
          <div className="flex items-center justify-center">
            <Button size="sm" onClick={() => setShowUploadModal(true)} className="text-xs">
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Upload Project Document
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
                        doc.reviewStatus === 'VERIFIED' || doc.validationStatus === 'VALIDATED_CLEAN' || doc.reviewStatus === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : doc.reviewStatus === 'REVISION_REQUESTED' || doc.processingStatus === 'EXTRACTION_FAILED'
                          ? 'bg-rose-100 text-rose-800'
                          : doc.reviewStatus === 'VERIFICATION_REQUIRED' || hasDiscrepancy
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      <FileText className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      {/* Section 9: Visual Linking of Revisions */}
                      {doc.revisionOfDocumentId && (
                        <div className="flex items-center gap-1.5 text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 w-fit mb-1 font-semibold">
                          <CornerDownRight className="w-3 h-3 text-indigo-600 shrink-0" />
                          <span>Revision #{doc.revisionNumber || 1}</span>
                          <span className="text-indigo-400 font-normal">•</span>
                          <span className="text-indigo-600 font-normal truncate">
                            Of document {doc.revisionOfDocumentId}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 truncate">
                          {doc.originalFileName}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType}
                        </span>
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

                      {/* Display child revisions if any */}
                      {(() => {
                        const childRevisions = documents.filter((d) => d.revisionOfDocumentId === doc.id);
                        if (childRevisions.length === 0) return null;
                        return (
                          <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 w-fit mt-1.5 font-medium">
                            <RefreshCw className="w-3 h-3 text-emerald-600" />
                            <span>
                              Linked Revision(s) Submitted:{' '}
                              {childRevisions.map((r) => `Rev #${r.revisionNumber || 1} (${r.originalFileName})`).join(', ')}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    {/* Status Badge (Section 18) */}
                    {doc.reviewStatus === 'VERIFIED' ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Government Verification Completed
                      </span>
                    ) : doc.reviewStatus === 'VERIFICATION_REQUIRED' ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Verification Required
                      </span>
                    ) : doc.reviewStatus === 'VERIFICATION_IN_PROGRESS' ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-300">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        Verification In Progress
                      </span>
                    ) : doc.reviewStatus === 'REVISION_REQUESTED' ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-900 border border-rose-300">
                        <RefreshCw className="w-3.5 h-3.5 text-rose-600" />
                        Agency Revision Requested
                      </span>
                    ) : doc.reviewStatus === 'RESOLVED' ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Review Resolved
                      </span>
                    ) : doc.reviewStatus === 'ACKNOWLEDGED' ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-300">
                        <Info className="w-3.5 h-3.5 text-blue-600" />
                        Government Review Acknowledged
                      </span>
                    ) : doc.validationStatus === 'VALIDATED_CLEAN' ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Corroborated Clean
                      </span>
                    ) : doc.processingStatus === 'EXTRACTION_FAILED' ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-300">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        Extraction Failed
                      </span>
                    ) : doc.processingStatus === 'PROCESSING' ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                        Extracting with Gemini...
                      </span>
                    ) : doc.processingStatus === 'UPLOADED' || doc.extractionStatus === 'PENDING' ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        Awaiting Government Processing
                      </span>
                    ) : hasDiscrepancy ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Variance Requiring Review ({summary?.mismatchCount || 1})
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {doc.processingStatus}
                      </span>
                    )}

                    {/* Download Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleDownloadDocument(doc, e)}
                      className="text-xs h-7 px-2.5 text-slate-700 hover:text-blue-700 border-slate-300"
                      title="Download document from secure Supabase vault"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Download
                    </Button>

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
                      ) : doc.extractionStatus === 'PENDING' || doc.processingStatus === 'UPLOADED' ? (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>Awaiting government document processing.</span>
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

                      {doc.reviewStatus === 'VERIFIED' ? (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            Government Verification Completed ({doc.verificationDecision || 'VERIFIED'})
                          </div>
                          {(doc.verificationNotes || doc.reviewNotes) && (
                            <p className="text-emerald-800 text-[11px] pl-5.5 italic">
                              "{doc.verificationNotes || doc.reviewNotes}"
                            </p>
                          )}
                          {doc.verifiedByName && (
                            <div className="text-[10px] text-emerald-700 pl-5.5 font-mono">
                              Verified by {doc.verifiedByName} on {new Date(doc.verifiedAt || doc.reviewedAt || doc.updatedAt).toLocaleDateString('en-IN')}
                            </div>
                          )}
                        </div>
                      ) : doc.reviewStatus === 'VERIFICATION_REQUIRED' ? (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold">
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                              Verification Required (Flagged for Official Verification)
                            </div>
                            {isGov && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setReviewingDoc(doc);
                                  setReviewAction('COMPLETE_VERIFICATION');
                                  setReviewNotes('');
                                }}
                                className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                                Complete Verification
                              </Button>
                            )}
                          </div>
                          {doc.reviewNotes && (
                            <p className="text-amber-800 text-[11px] italic">Review Scope: "{doc.reviewNotes}"</p>
                          )}
                        </div>
                      ) : doc.reviewStatus === 'VERIFICATION_IN_PROGRESS' ? (
                        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-900 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold">
                              <Clock className="w-4 h-4 text-indigo-600" />
                              Verification In Progress
                            </div>
                            {isGov && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setReviewingDoc(doc);
                                  setReviewAction('COMPLETE_VERIFICATION');
                                  setReviewNotes('');
                                }}
                                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                                Record Verification Result
                              </Button>
                            )}
                          </div>
                          {doc.reviewNotes && (
                            <p className="text-indigo-800 text-[11px] italic">Notes: "{doc.reviewNotes}"</p>
                          )}
                        </div>
                      ) : doc.reviewStatus === 'REVISION_REQUESTED' ? (
                        <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold text-xs text-rose-950">
                              <RefreshCw className="w-4 h-4 text-rose-600" />
                              Agency Revision Requested by Government
                            </div>
                            {!isGov && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setRevisionTargetDoc(doc);
                                  setUploadType(doc.documentType);
                                  setShowUploadModal(true);
                                }}
                                className="text-xs bg-rose-700 hover:bg-rose-800 text-white font-semibold shadow-xs"
                              >
                                <Upload className="w-3.5 h-3.5 mr-1" />
                                Submit Revision
                              </Button>
                            )}
                          </div>
                          {doc.reviewNotes && (
                            <div className="text-xs text-rose-900 bg-white/80 p-2.5 rounded border border-rose-200">
                              <span className="font-bold block text-[11px] text-rose-700 uppercase mb-0.5">
                                Government Revision Instructions:
                              </span>
                              <p className="italic">"{doc.reviewNotes}"</p>
                            </div>
                          )}
                          <p className="text-[11px] text-rose-800">
                            The original document remains preserved. Submitting a revised document will register Revision #{(doc.revisionNumber || 1) + 1} and await government processing.
                          </p>
                        </div>
                      ) : doc.reviewStatus === 'RESOLVED' ? (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Review Resolved (Closed by Government)
                          </div>
                          {doc.reviewNotes && (
                            <p className="text-emerald-800 text-[11px] pl-5.5 italic">"{doc.reviewNotes}"</p>
                          )}
                        </div>
                      ) : doc.reviewStatus === 'ACKNOWLEDGED' ? (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold">
                              <Info className="w-4 h-4 text-blue-600" />
                              Government Review Acknowledged (Verification Pending)
                            </div>
                            {isGov && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setReviewingDoc(doc);
                                  setReviewAction('MARK_VERIFICATION');
                                  setReviewNotes(doc.reviewNotes || '');
                                }}
                                className="text-xs text-blue-700 border-blue-300"
                              >
                                Flag for Verification
                              </Button>
                            )}
                          </div>
                          {doc.reviewNotes && (
                            <p className="text-blue-800 text-[11px] italic">Acknowledgement Notes: "{doc.reviewNotes}"</p>
                          )}
                        </div>
                      ) : isGov && (hasDiscrepancy || doc.reviewStatus === 'REVIEW_REQUIRED') ? (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-amber-900">
                              Variance Requires Human Decision
                            </span>
                            <Button
                              size="sm"
                              onClick={() => {
                                setReviewingDoc(doc);
                                setReviewAction('ACKNOWLEDGE');
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
                            : doc.processingStatus === 'UPLOADED' || doc.extractionStatus === 'PENDING'
                            ? 'Awaiting government document processing.'
                            : 'Awaiting extraction or validation processing.'}
                        </p>
                      )}

                      {/* Actions Toolbar */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleDownloadDocument(doc, e)}
                          className="text-xs"
                          title="Download document from secure Supabase vault"
                        >
                          <Download className="w-3.5 h-3.5 mr-1.5" />
                          Download Original
                        </Button>

                        {/* Section 3 & 17: Government Start Processing vs Reprocess Extraction */}
                        {isGov && (
                          doc.processingStatus === 'UPLOADED' && doc.extractionStatus === 'PENDING' ? (
                            <Button
                              size="sm"
                              onClick={() => handleStartProcessing(doc.id)}
                              disabled={startingProcessingDocId === doc.id}
                              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs"
                            >
                              <Play className={`w-3.5 h-3.5 mr-1.5 ${startingProcessingDocId === doc.id ? 'animate-pulse' : ''}`} />
                              {startingProcessingDocId === doc.id ? 'Processing...' : 'Start Processing'}
                            </Button>
                          ) : (
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
                          )
                        )}
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
        onClose={() => {
          setShowUploadModal(false);
          setRevisionTargetDoc(null);
        }}
        title={
          revisionTargetDoc
            ? `Submit Revision for: ${revisionTargetDoc.originalFileName}`
            : 'Upload Project Document to Vault'
        }
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs text-slate-800">
          {revisionTargetDoc && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                Submitting Controlled Revision #{(revisionTargetDoc.revisionNumber || 1) + 1}
              </div>
              <p className="text-[11px] text-indigo-800">
                The original document remains permanently preserved in the audit vault. This submission will be registered as a linked revision awaiting government review.
              </p>
            </div>
          )}

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
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              required
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Supported formats: PDF, PNG, JPG, JPEG (Maximum: 15MB).
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
            <label className="block font-bold text-slate-700 mb-1">
              {revisionTargetDoc ? 'Revision Explanation & Notes *' : 'Administrative Notes (Optional)'}
            </label>
            <textarea
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
              placeholder={
                revisionTargetDoc
                  ? 'Explain the corrections made in this revised document submission...'
                  : 'e.g. Interim running bill #3 covering milestone 2 superstructure works.'
              }
              rows={2}
              required={Boolean(revisionTargetDoc)}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowUploadModal(false);
                setRevisionTargetDoc(null);
              }}
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
                  Storing & Registering...
                </>
              ) : revisionTargetDoc ? (
                <>
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Submit Document Revision
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

      {/* Human Review Modal (Section 5 & 6) */}
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
                  'Extracted document values differ from authoritative project records.'}
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Official Review Determination *</label>
              <select
                value={reviewAction}
                onChange={(e) => setReviewAction(e.target.value as any)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium"
              >
                <option value="ACKNOWLEDGE">Acknowledge Inconsistency (Records awareness; verification pending)</option>
                <option value="MARK_VERIFICATION">Mark for Verification (Flag formal verification task)</option>
                <option value="START_VERIFICATION">Initiate Verification (Begin field / document verification)</option>
                <option value="COMPLETE_VERIFICATION">Complete Official Verification (Record verification outcome)</option>
                <option value="REQUEST_REVISION">Request Agency Revision (Require revised document submission)</option>
                <option value="MARK_RESOLVED">Mark Resolved (Legitimate variance verified & reconciled)</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1 italic">
                {reviewAction === 'ACKNOWLEDGE'
                  ? 'Note: Acknowledgment records administrative awareness only. It does not verify the document as accurate or valid.'
                  : reviewAction === 'MARK_VERIFICATION'
                  ? 'Note: Flags this document for an official statutory verification or engineering site audit.'
                  : reviewAction === 'START_VERIFICATION'
                  ? 'Note: Sets status to Verification In Progress while active field or technical audit is conducted.'
                  : reviewAction === 'COMPLETE_VERIFICATION'
                  ? 'Note: Officially records statutory verification findings and final determination on record.'
                  : reviewAction === 'REQUEST_REVISION'
                  ? 'Note: Agency will be notified to submit a corrected document revision. Original document remains permanently preserved.'
                  : 'Note: Closes the discrepancy after official administrative justification is entered.'}
              </p>
            </div>

            {reviewAction === 'COMPLETE_VERIFICATION' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Verification Decision *</label>
                <select
                  value={verificationDecision}
                  onChange={(e) => setVerificationDecision(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                >
                  <option value="VERIFIED_ACCURATE">Verified Accurate (Field cross-check verified document)</option>
                  <option value="RECTIFIED">Rectified (Clerical or baseline variance reconciled)</option>
                  <option value="DISCREPANCY_SUBSTANTIATED">Discrepancy Substantiated (Inconsistency confirmed on record)</option>
                </select>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {reviewAction === 'COMPLETE_VERIFICATION'
                  ? 'Official Verification Notes & Findings *'
                  : reviewAction === 'MARK_VERIFICATION'
                  ? 'Verification Scope & Review Instructions *'
                  : reviewAction === 'REQUEST_REVISION'
                  ? 'Revision Instructions for Agency (Visible to Agency) *'
                  : reviewAction === 'MARK_RESOLVED'
                  ? 'Resolution Justification Notes *'
                  : 'Official Administrative Justification Notes *'}
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={
                  reviewAction === 'COMPLETE_VERIFICATION'
                    ? 'Enter official field verification findings, cross-checked records, and determination rationale...'
                    : reviewAction === 'REQUEST_REVISION'
                    ? 'Specify exactly what corrections or supporting documentation the agency must submit...'
                    : reviewAction === 'MARK_VERIFICATION'
                    ? 'State the specific discrepancies requiring site inspection or financial audit verification...'
                    : 'Enter administrative justification, site inspection cross-check notes, or review notes...'
                }
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
                {submittingReview
                  ? 'Saving...'
                  : reviewAction === 'COMPLETE_VERIFICATION'
                  ? 'Complete Government Verification'
                  : reviewAction === 'MARK_VERIFICATION'
                  ? 'Flag for Verification'
                  : reviewAction === 'REQUEST_REVISION'
                  ? 'Request Agency Revision'
                  : reviewAction === 'MARK_RESOLVED'
                  ? 'Resolve Discrepancy'
                  : 'Save Official Review Decision'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
