// Bharat Tender Intelligence (BTI) — Document Cross-Validation Service
// Phase 11: Deterministic Cross-Validation Engine
// Principle: Gemini extracts; BTI deterministic logic compares.
// Advisory only: AI must never declare fraud or make automatic legal/investigation judgments.

import {
  ProjectDocument,
  DocumentCrossValidationResult,
  DocumentCrossValidationSummary,
} from '../../types/document.js';
import { Project, ProjectFinancialRecord, ProjectInspection } from '../../types/project.js';

export class DocumentCrossValidationService {
  /**
   * Deterministically cross-validates extracted document fields against authoritative BTI records.
   * Does NOT use AI to decide whether fields match.
   */
  static crossValidate(
    document: ProjectDocument,
    authoritativeContext: {
      project: Project;
      financialRecords?: ProjectFinancialRecord[];
      inspections?: ProjectInspection[];
    }
  ): {
    results: DocumentCrossValidationResult[];
    summary: DocumentCrossValidationSummary;
  } {
    const { project, financialRecords = [] } = authoritativeContext;
    const extracted = document.extractedData || {};
    const results: DocumentCrossValidationResult[] = [];

    // Helper: Normalize strings for tolerant matching
    const normalize = (str?: string | null): string => {
      if (!str) return '';
      return str
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\b(ltd|limited|pvt|private|llp|inc|co|corp|corporation)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Helper: Check monetary similarity within 1% or ₹1,000
    const amountsMatch = (a?: number | null, b?: number | null): boolean => {
      if (a === undefined || a === null || b === undefined || b === null) return false;
      const diff = Math.abs(a - b);
      if (diff <= 1000) return true;
      const maxVal = Math.max(Math.abs(a), Math.abs(b));
      if (maxVal === 0) return true;
      return diff / maxVal <= 0.01;
    };

    // 1. PROJECT REFERENCE VALIDATION
    const extractedProjId = extracted.projectId?.value || extracted.projectReferenceNumber?.value;
    if (extractedProjId) {
      const cleanExtracted = extractedProjId.trim().toLowerCase();
      const projIdMatches =
        cleanExtracted === project.id.toLowerCase() ||
        (project.projectNumber && cleanExtracted === project.projectNumber.toLowerCase()) ||
        (project.projectCode && cleanExtracted === project.projectCode.toLowerCase());

      if (projIdMatches) {
        results.push({
          ruleKey: 'RULE_PROJECT_REF_MATCH',
          ruleName: 'Project Reference Alignment',
          category: 'MATCH',
          field: 'projectId',
          documentValue: extractedProjId,
          documentSource: extracted.projectId?.source || extracted.projectReferenceNumber?.source || 'Document Reference',
          authoritativeValue: project.projectNumber || project.id,
          authoritativeSource: 'Project Master Registry',
          explanation: 'Document project reference aligns with official project baseline record.',
          requiresHumanReview: false,
        });
      } else {
        results.push({
          ruleKey: 'RULE_PROJECT_REF_MISMATCH',
          ruleName: 'Project Reference Divergence',
          category: 'MISMATCH',
          indicator: 'DOCUMENT_PROJECT_REFERENCE_MISMATCH',
          field: 'projectId',
          documentValue: extractedProjId,
          documentSource: extracted.projectId?.source || extracted.projectReferenceNumber?.source || 'Document Reference',
          authoritativeValue: project.projectNumber || project.id,
          authoritativeSource: 'Project Master Registry',
          varianceDescription: `Document cites "${extractedProjId}" which differs from registered project "${project.projectNumber || project.id}".`,
          explanation: 'Document information differs from the current project record and requires verification.',
          requiresHumanReview: true,
        });
      }
    } else {
      results.push({
        ruleKey: 'RULE_PROJECT_REF_MISSING',
        ruleName: 'Project Reference Check',
        category: 'MISSING_REFERENCE',
        field: 'projectId',
        documentValue: null,
        authoritativeValue: project.projectNumber || project.id,
        authoritativeSource: 'Project Master Registry',
        explanation: 'Explicit project identification number was not identifiable in document text.',
        requiresHumanReview: false,
      });
    }

    // 2. AGENCY / ORGANIZATION VALIDATION
    const extractedOrg = extracted.organizationName?.value || extracted.agencyName?.value;
    const authoritativeOrg = project.implementingAgencyName || project.executingAgencyName || project.agencyName;
    if (extractedOrg && authoritativeOrg) {
      const normExt = normalize(extractedOrg);
      const normAuth = normalize(authoritativeOrg);

      const isOrgMatch = normExt.includes(normAuth) || normAuth.includes(normExt) || normExt === normAuth;
      if (isOrgMatch) {
        results.push({
          ruleKey: 'RULE_ORG_MATCH',
          ruleName: 'Implementing Agency Alignment',
          category: 'MATCH',
          field: 'organizationName',
          documentValue: extractedOrg,
          documentSource: extracted.organizationName?.source || 'Vendor/Agency Block',
          authoritativeValue: authoritativeOrg,
          authoritativeSource: 'Awarded Implementing Agency Record',
          explanation: 'Invoicing/issuing agency matches the contracted implementing entity.',
          requiresHumanReview: false,
        });
      } else {
        results.push({
          ruleKey: 'RULE_ORG_MISMATCH',
          ruleName: 'Implementing Agency Discrepancy',
          category: 'MISMATCH',
          indicator: 'DOCUMENT_ORGANIZATION_MISMATCH',
          field: 'organizationName',
          documentValue: extractedOrg,
          documentSource: extracted.organizationName?.source || 'Vendor/Agency Block',
          authoritativeValue: authoritativeOrg,
          authoritativeSource: 'Awarded Implementing Agency Record',
          varianceDescription: `Document indicates "${extractedOrg}", whereas authoritative project record assigns "${authoritativeOrg}".`,
          explanation: 'Document information differs from the current project record and requires verification. Unrecognized agency or unapproved subcontractor name.',
          requiresHumanReview: true,
        });
      }
    }

    // 3. SANCTIONED AMOUNT VALIDATION (For Sanction Documents & UCs)
    if (
      (document.documentType === 'SANCTION_DOCUMENT' || document.documentType === 'UTILIZATION_CERTIFICATE') &&
      extracted.sanctionedAmount?.value !== undefined &&
      extracted.sanctionedAmount?.value !== null &&
      project.sanctionedAmount
    ) {
      const docSanction = Number(extracted.sanctionedAmount.value);
      const authSanction = Number(project.sanctionedAmount);

      if (amountsMatch(docSanction, authSanction)) {
        results.push({
          ruleKey: 'RULE_SANCTIONED_AMOUNT_MATCH',
          ruleName: 'Sanction Amount Consistency',
          category: 'MATCH',
          field: 'sanctionedAmount',
          documentValue: docSanction,
          documentSource: extracted.sanctionedAmount.source || 'Sanction Order Figure',
          authoritativeValue: authSanction,
          authoritativeSource: 'Statutory Project Sanction Record',
          explanation: 'Sanctioned grant figure on document matches official project sanction allocation.',
          requiresHumanReview: false,
        });
      } else {
        results.push({
          ruleKey: 'RULE_SANCTIONED_AMOUNT_MISMATCH',
          ruleName: 'Sanction Amount Variance',
          category: 'MISMATCH',
          indicator: 'DOCUMENT_AMOUNT_MISMATCH',
          field: 'sanctionedAmount',
          documentValue: docSanction,
          documentSource: extracted.sanctionedAmount.source || 'Sanction Order Figure',
          authoritativeValue: authSanction,
          authoritativeSource: 'Statutory Project Sanction Record',
          varianceDescription: `Document amount ₹${docSanction.toLocaleString('en-IN')} differs from registered project sanction ₹${authSanction.toLocaleString('en-IN')}.`,
          explanation: 'Document information differs from the current project record and requires verification.',
          requiresHumanReview: true,
        });
      }
    }

    // 4. PHYSICAL COMPLETION PERCENTAGE VALIDATION (For Completion Certificates & Inspections)
    if (
      (document.documentType === 'COMPLETION_CERTIFICATE' || document.documentType === 'INSPECTION_REPORT') &&
      extracted.completionPercentage?.value !== undefined &&
      extracted.completionPercentage?.value !== null
    ) {
      const docPct = Number(extracted.completionPercentage.value);
      const authPct = Number(
        project.governmentVerifiedPhysicalProgressPercent ?? project.physicalProgressPercent ?? 0
      );

      // Inconsistency threshold: > 5 percentage points divergence
      if (Math.abs(docPct - authPct) <= 5) {
        results.push({
          ruleKey: 'RULE_PROGRESS_COMPLETION_MATCH',
          ruleName: 'Physical Progress Alignment',
          category: 'MATCH',
          field: 'completionPercentage',
          documentValue: docPct,
          documentSource: extracted.completionPercentage.source || 'Certified Completion Percentage',
          authoritativeValue: authPct,
          authoritativeSource: 'Government Verified Physical Progress',
          explanation: `Document completion statement (${docPct}%) aligns with verified physical progress (${authPct}%).`,
          requiresHumanReview: false,
        });
      } else {
        results.push({
          ruleKey: 'RULE_PROGRESS_COMPLETION_MISMATCH',
          ruleName: 'Physical Progress Alignment',
          category: 'MISMATCH',
          indicator: 'DOCUMENT_PROGRESS_MISMATCH',
          field: 'completionPercentage',
          documentValue: docPct,
          documentSource: extracted.completionPercentage.source || 'Certified Completion Statement',
          authoritativeValue: authPct,
          authoritativeSource: 'Government Verified Physical Progress',
          varianceDescription: `Document claims ${docPct}% completion, whereas current government-verified progress is ${authPct}% (${Math.abs(docPct - authPct)} percentage points divergence).`,
          explanation: 'Document information differs from the current project record and requires verification. Physical field observation does not corroborate document completion claims.',
          requiresHumanReview: true,
        });
      }
    }

    // 5. UTILIZATION / EXPENDITURE AMOUNT VALIDATION
    if (
      document.documentType === 'UTILIZATION_CERTIFICATE' &&
      extracted.utilizationAmount?.value !== undefined &&
      extracted.utilizationAmount?.value !== null
    ) {
      const docUtil = Number(extracted.utilizationAmount.value);
      const authUtil = Number(project.utilizedAmount || 0);

      if (amountsMatch(docUtil, authUtil)) {
        results.push({
          ruleKey: 'RULE_UTILIZATION_AMOUNT_MATCH',
          ruleName: 'Expenditure Utilization Alignment',
          category: 'MATCH',
          field: 'utilizationAmount',
          documentValue: docUtil,
          documentSource: extracted.utilizationAmount.source || 'Utilization Certificate Total',
          authoritativeValue: authUtil,
          authoritativeSource: 'Recorded Cumulative Utilized Expenditure',
          explanation: 'Certified expenditure utilization corresponds with recorded financial disbursements.',
          requiresHumanReview: false,
        });
      } else {
        results.push({
          ruleKey: 'RULE_UTILIZATION_AMOUNT_MISMATCH',
          ruleName: 'Expenditure Utilization Variance',
          category: 'MISMATCH',
          indicator: 'DOCUMENT_FINANCIAL_MISMATCH',
          field: 'utilizationAmount',
          documentValue: docUtil,
          documentSource: extracted.utilizationAmount.source || 'Utilization Certificate Total',
          authoritativeValue: authUtil,
          authoritativeSource: 'Recorded Cumulative Utilized Expenditure',
          varianceDescription: `Document reports ₹${docUtil.toLocaleString('en-IN')}, whereas official utilized records show ₹${authUtil.toLocaleString('en-IN')}.`,
          explanation: 'Document information differs from the current project record and requires verification.',
          requiresHumanReview: true,
        });
      }
    }

    // 6. INVOICE AMOUNT VALIDATION
    if (
      document.documentType === 'INVOICE' &&
      extracted.amount?.value !== undefined &&
      extracted.amount?.value !== null
    ) {
      const invAmt = Number(extracted.amount.value);
      // Check if invoice corresponds to any verified/pending financial record
      const matchingRecord = financialRecords.find((r) => amountsMatch(Number(r.amount), invAmt));
      const awarded = Number(project.awardedAmount || project.sanctionedAmount || 0);

      if (matchingRecord) {
        results.push({
          ruleKey: 'RULE_INVOICE_RECORD_MATCH',
          ruleName: 'Invoice Voucher Corroboration',
          category: 'MATCH',
          field: 'amount',
          documentValue: invAmt,
          documentSource: extracted.amount.source || 'Invoice Total Payable',
          authoritativeValue: Number(matchingRecord.amount),
          authoritativeSource: `Financial Record: ${matchingRecord.referenceNumber || matchingRecord.id} (${matchingRecord.verificationStatus})`,
          explanation: 'Invoice amount corresponds with an authoritative financial record entry.',
          requiresHumanReview: false,
        });
      } else if (awarded > 0 && invAmt > awarded) {
        results.push({
          ruleKey: 'RULE_INVOICE_EXCEEDS_AWARD',
          ruleName: 'Invoice Award Ceiling Check',
          category: 'MISMATCH',
          indicator: 'DOCUMENT_AMOUNT_MISMATCH',
          field: 'amount',
          documentValue: invAmt,
          documentSource: extracted.amount.source || 'Invoice Total Payable',
          authoritativeValue: awarded,
          authoritativeSource: 'Contract Award Ceiling',
          varianceDescription: `Invoice amount ₹${invAmt.toLocaleString('en-IN')} exceeds the entire awarded project value ₹${awarded.toLocaleString('en-IN')}.`,
          explanation: 'Document information differs from the current project record and requires verification.',
          requiresHumanReview: true,
        });
      } else {
        // If within budget but no exact voucher is linked yet, record NOT_VALIDATED or PARTIAL_MATCH
        results.push({
          ruleKey: 'RULE_INVOICE_PENDING_VOUCHER',
          ruleName: 'Invoice Voucher Verification',
          category: 'NOT_VALIDATED',
          field: 'amount',
          documentValue: invAmt,
          documentSource: extracted.amount.source || 'Invoice Total Payable',
          authoritativeValue: null,
          authoritativeSource: 'Pending Financial Records',
          explanation: 'Invoice amount is within contract budget; no identical voucher has been logged yet.',
          requiresHumanReview: false,
        });
      }
    }

    // 7. DATE SEQUENCE VALIDATION
    const docDateStr =
      extracted.documentDate?.value ||
      extracted.inspectionDate?.value ||
      extracted.issueDate?.value ||
      extracted.completionDate?.value;

    const startDateStr = project.startDate || project.implementationStartDate;
    if (docDateStr && startDateStr) {
      const docDate = new Date(docDateStr).getTime();
      const startDate = new Date(startDateStr).getTime();

      // Flag if document date is more than 7 days prior to project start
      if (!isNaN(docDate) && !isNaN(startDate) && docDate < startDate - 7 * 86400000) {
        results.push({
          ruleKey: 'RULE_DATE_PREDATES_START',
          ruleName: 'Date Sequence Feasibility',
          category: 'MISMATCH',
          indicator: 'DOCUMENT_DATE_INCONSISTENCY',
          field: 'documentDate',
          documentValue: docDateStr,
          documentSource: 'Extracted Document/Inspection Date',
          authoritativeValue: startDateStr,
          authoritativeSource: 'Official Project Start Baseline',
          varianceDescription: `Document date (${docDateStr}) predates project sanction/commencement date (${startDateStr}).`,
          explanation: 'Document information differs from the current project record and requires verification. Activity date recorded prior to official project award.',
          requiresHumanReview: true,
        });
      }
    }

    // 8. DOCUMENT TYPE DECLARED VS DETECTED
    if (
      document.detectedDocumentType &&
      document.detectedDocumentType !== document.documentType &&
      document.documentType !== 'OTHER_SUPPORTING_DOCUMENT'
    ) {
      results.push({
        ruleKey: 'RULE_DOC_TYPE_DIVERGENCE',
        ruleName: 'Document Classification Alignment',
        category: 'REQUIRES_REVIEW',
        indicator: 'DOCUMENT_TYPE_MISMATCH',
        field: 'documentType',
        documentValue: document.detectedDocumentType,
        documentSource: 'AI Classification Assessment',
        authoritativeValue: document.documentType,
        authoritativeSource: 'Uploader Declared Classification',
        varianceDescription: `Uploader declared "${document.documentType}", but content exhibits characteristics of "${document.detectedDocumentType}".`,
        explanation: 'Document classification differs between declared type and extracted contents. Review recommended to ensure proper filing.',
        requiresHumanReview: true,
      });
    }

    // Compute Summary
    const matchCount = results.filter((r) => r.category === 'MATCH').length;
    const mismatchCount = results.filter((r) => r.category === 'MISMATCH').length;
    const missingReferenceCount = results.filter((r) => r.category === 'MISSING_REFERENCE').length;
    const requiresReviewCount = results.filter((r) => r.requiresHumanReview).length;
    const inconsistencies = Array.from(
      new Set(results.filter((r) => r.indicator).map((r) => r.indicator!))
    );

    const summary: DocumentCrossValidationSummary = {
      totalChecks: results.length,
      matchCount,
      mismatchCount,
      missingReferenceCount,
      requiresReviewCount,
      inconsistencies,
    };

    return { results, summary };
  }
}
