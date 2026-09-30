// Bharat Tender Intelligence (BTI) — Document Intelligence & Cross-Validation Types
// Phase 11: Secure Document Ingestion, Structured Document Extraction & Deterministic Cross-Validation

export type DocumentType =
  | 'INVOICE'
  | 'SANCTION_DOCUMENT'
  | 'COMPLETION_CERTIFICATE'
  | 'UTILIZATION_CERTIFICATE'
  | 'INSPECTION_REPORT'
  | 'PROPOSAL_DOCUMENT'
  | 'OTHER_SUPPORTING_DOCUMENT';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  INVOICE: 'Invoice',
  SANCTION_DOCUMENT: 'Sanction Document',
  COMPLETION_CERTIFICATE: 'Completion Certificate',
  UTILIZATION_CERTIFICATE: 'Utilization Certificate',
  INSPECTION_REPORT: 'Inspection Report',
  PROPOSAL_DOCUMENT: 'Proposal Document',
  OTHER_SUPPORTING_DOCUMENT: 'Other Supporting Document',
};

export type DocumentProcessingStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'EXTRACTED'
  | 'VALIDATION_PENDING'
  | 'VALIDATED'
  | 'REVIEW_REQUIRED'
  | 'EXTRACTION_FAILED';

export type DocumentExtractionStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'UNAVAILABLE';

export type DocumentValidationStatus =
  | 'NOT_VALIDATED'
  | 'VALIDATED_CLEAN'
  | 'INCONSISTENCY_DETECTED'
  | 'REVIEW_REQUIRED';

export type DocumentReviewStatus =
  | 'NONE_REQUIRED'
  | 'REVIEW_REQUIRED'
  | 'ACKNOWLEDGED'
  | 'VERIFICATION_REQUIRED'
  | 'VERIFICATION_IN_PROGRESS'
  | 'VERIFIED'
  | 'REVISION_REQUESTED'
  | 'RESOLVED';

export const DOCUMENT_REVIEW_STATUS_LABELS: Record<DocumentReviewStatus, string> = {
  NONE_REQUIRED: 'No Review Required',
  REVIEW_REQUIRED: 'Review Required',
  ACKNOWLEDGED: 'Government Review Acknowledged',
  VERIFICATION_REQUIRED: 'Verification Required',
  VERIFICATION_IN_PROGRESS: 'Verification In Progress',
  VERIFIED: 'Government Verification Completed',
  REVISION_REQUESTED: 'Agency Revision Requested',
  RESOLVED: 'Review Resolved',
};

export type CrossValidationCategory =
  | 'MATCH'
  | 'PARTIAL_MATCH'
  | 'MISMATCH'
  | 'MISSING_REFERENCE'
  | 'NOT_VALIDATED'
  | 'REQUIRES_REVIEW';

export type DocumentInconsistencyIndicator =
  | 'DOCUMENT_INCONSISTENCY'
  | 'DOCUMENT_AMOUNT_MISMATCH'
  | 'DOCUMENT_DATE_INCONSISTENCY'
  | 'DOCUMENT_PROJECT_REFERENCE_MISMATCH'
  | 'DOCUMENT_ORGANIZATION_MISMATCH'
  | 'DOCUMENT_PROGRESS_MISMATCH'
  | 'DOCUMENT_FINANCIAL_MISMATCH'
  | 'DOCUMENT_TYPE_MISMATCH';

export const DOCUMENT_INCONSISTENCY_LABELS: Record<DocumentInconsistencyIndicator, string> = {
  DOCUMENT_INCONSISTENCY: 'Document Inconsistency Requiring Verification',
  DOCUMENT_AMOUNT_MISMATCH: 'Document Amount Variance Requiring Verification',
  DOCUMENT_DATE_INCONSISTENCY: 'Document Date Inconsistency Requiring Verification',
  DOCUMENT_PROJECT_REFERENCE_MISMATCH: 'Project Reference Divergence Requiring Verification',
  DOCUMENT_ORGANIZATION_MISMATCH: 'Agency/Organization Discrepancy Requiring Verification',
  DOCUMENT_PROGRESS_MISMATCH: 'Physical Progress Divergence Requiring Verification',
  DOCUMENT_FINANCIAL_MISMATCH: 'Financial Utilization Variance Requiring Verification',
  DOCUMENT_TYPE_MISMATCH: 'Document Classification Discrepancy Requiring Verification',
};

/**
 * Individual extracted value with provenance and confidence score
 */
export interface ExtractedField<T = string | number | null> {
  value: T;
  confidence: number; // 0.0 to 1.0
  source?: string; // e.g. "Header Block", "Table 1, Row 3", "Issuing Seal"
  rawText?: string;
  isUncertain?: boolean;
}

/**
 * Structured document extraction payload
 */
export interface DocumentExtractedData {
  documentType?: ExtractedField<DocumentType | null>;
  documentReferenceNumber?: ExtractedField<string | null>;
  invoiceNumber?: ExtractedField<string | null>;
  sanctionNumber?: ExtractedField<string | null>;
  certificateNumber?: ExtractedField<string | null>;

  projectId?: ExtractedField<string | null>;
  projectReferenceNumber?: ExtractedField<string | null>;
  tenderReferenceNumber?: ExtractedField<string | null>;
  proposalReferenceNumber?: ExtractedField<string | null>;

  organizationName?: ExtractedField<string | null>;
  agencyName?: ExtractedField<string | null>;
  gstin?: ExtractedField<string | null>;
  issuingAuthority?: ExtractedField<string | null>;
  recipientAgency?: ExtractedField<string | null>;

  amount?: ExtractedField<number | null>;
  currency?: ExtractedField<string | null>;
  expenditureAmount?: ExtractedField<number | null>;
  sanctionedAmount?: ExtractedField<number | null>;
  awardedAmount?: ExtractedField<number | null>;
  utilizationAmount?: ExtractedField<number | null>;

  documentDate?: ExtractedField<string | null>;
  issueDate?: ExtractedField<string | null>;
  completionDate?: ExtractedField<string | null>;
  inspectionDate?: ExtractedField<string | null>;
  reportingPeriod?: ExtractedField<string | null>;

  completionPercentage?: ExtractedField<number | null>;
  location?: ExtractedField<string | null>;
  relevantMilestone?: ExtractedField<string | null>;
  observations?: ExtractedField<string | null>;
  rawNotes?: ExtractedField<string | null>;
}

/**
 * Deterministic cross-validation result comparing an extracted field
 * with authoritative BTI application records.
 */
export interface DocumentCrossValidationResult {
  ruleKey: string;
  ruleName: string;
  category: CrossValidationCategory;
  indicator?: DocumentInconsistencyIndicator;
  field: string;
  documentValue: string | number | null;
  documentSource?: string;
  authoritativeValue: string | number | null;
  authoritativeSource: string; // e.g. "Project Master Baseline", "Verified Financial Records", "Tender Allocation"
  varianceDescription?: string;
  explanation: string;
  requiresHumanReview: boolean;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface DocumentCrossValidationSummary {
  totalChecks: number;
  matchCount: number;
  mismatchCount: number;
  missingReferenceCount: number;
  requiresReviewCount: number;
  inconsistencies: DocumentInconsistencyIndicator[];
}

/**
 * Master Project Document Record
 */
export interface ProjectDocument {
  id: string;
  projectId: string;
  projectNumber?: string;
  projectTitle?: string;
  tenderId?: string;
  proposalId?: string;
  organizationId?: string;
  organizationName?: string;

  // Document identity
  documentType: DocumentType;
  detectedDocumentType?: DocumentType;
  originalFileName: string;
  storageReference: string;
  fileHash?: string; // SHA-256 hash for provenance/duplicate checking
  mimeType: string;
  fileSize: number; // bytes

  // Uploader metadata
  uploadedBy: string;
  uploaderName?: string;
  uploaderRole: 'agency' | 'government';
  uploadedAt: string;

  // Processing & Lifecycle
  processingStatus: DocumentProcessingStatus;
  extractionStatus: DocumentExtractionStatus;
  validationStatus: DocumentValidationStatus;
  reviewStatus: DocumentReviewStatus;

  // Structured extraction
  extractedData?: DocumentExtractedData;
  extractionProvider?: string;
  extractionModel?: string;
  extractionTimestamp?: string;
  extractionWarnings?: string[];
  processingError?: string;

  // Cross-validation
  crossValidationResults?: DocumentCrossValidationResult[];
  crossValidationSummary?: DocumentCrossValidationSummary;

  // Evidence Chain reference ID (Phase 8 integration)
  evidenceId?: string;

  // Human Review
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewNotes?: string;

  // Government Verification Workflow (Section 6)
  verificationDecision?: string;
  verificationNotes?: string;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;

  // Controlled Agency Revision Lineage (Section 7)
  revisionOfDocumentId?: string;
  revisionNumber?: number;

  // Demonstration indicator
  isDemonstrationData?: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface DocumentUploadInput {
  projectId: string;
  documentType: DocumentType;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  file?: File | Blob;
  fileDataUrl?: string; // base64 representation for transport/vault
  fileBuffer?: ArrayBuffer;
  notes?: string;
  revisionOfDocumentId?: string;
  revisionNumber?: number;
}

export interface DocumentReviewInput {
  documentId: string;
  action:
    | 'ACKNOWLEDGE'
    | 'MARK_VERIFICATION'
    | 'START_VERIFICATION'
    | 'COMPLETE_VERIFICATION'
    | 'REQUEST_REVISION'
    | 'MARK_RESOLVED';
  reviewNotes: string;
  verificationDecision?: string;
}
