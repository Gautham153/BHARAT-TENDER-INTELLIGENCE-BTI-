// Bharat Tender Intelligence (BTI) — Document Service
// Phase 11: Document Ingestion, Lifecycle Management & Orchestration

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../firebase/firebase.js';
import {
  isLiveFirestoreSession,
  isDemoSession,
  sanitizeFirestorePayload,
  ProjectService,
} from '../firebase/projects.js';
import {
  ProjectDocument,
  DocumentType,
  DocumentUploadInput,
  DocumentReviewInput,
  DocumentProcessingStatus,
  DocumentReviewStatus,
} from '../../types/document.js';
import { ProjectAuditEvent, ProjectAuditAction } from '../../types/project.js';
import { AuthUser } from '../../types/auth.js';
import { AuthService } from '../authService.js';
import { DocumentCrossValidationService } from './documentCrossValidationService.js';
import { EvidenceChainService } from '../evidence/evidenceChainService.js';

const DOCUMENTS_COLLECTION = 'projectDocuments';
const AUDIT_EVENTS_COLLECTION = 'projectAuditEvents';

export class DocumentService {
  /**
   * Retrieves all documents for a project.
   * For agency users, enforces dual constraints (projectId AND organizationId) matching Firestore security rules.
   * For government users, preserves project-level queries.
   * Requires an active live Firestore session (sole source of truth).
   */
  static async getDocumentsForProject(
    projectId: string,
    userOrOptions?: AuthUser | { role?: string; organizationId?: string } | null
  ): Promise<ProjectDocument[]> {
    if (!projectId) return [];

    const isLive = isLiveFirestoreSession() && db;
    if (!isLive) {
      return [];
    }

    const currentUser = userOrOptions && 'role' in userOrOptions
      ? userOrOptions
      : AuthService.getCurrentUser();

    const role = (currentUser?.role || '').toLowerCase();
    const isGov = role.includes('gov');
    const isAgency = role.includes('agency');
    const organizationId = (currentUser as any)?.organizationId || (currentUser as any)?.agencyId;

    try {
      const colRef = collection(db, DOCUMENTS_COLLECTION);
      let q;
      if (isAgency && !isGov && organizationId) {
        q = query(
          colRef,
          where('projectId', '==', projectId),
          where('organizationId', '==', organizationId)
        );
      } else {
        q = query(colRef, where('projectId', '==', projectId));
      }

      const snap = await getDocs(q);
      const docs: ProjectDocument[] = [];
      snap.forEach((d) => docs.push(d.data() as ProjectDocument));
      return docs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    } catch (err) {
      console.error(`[DocumentService] Live Firestore error fetching documents for project ${projectId}:`, err);
      throw err;
    }
  }

  /**
   * Retrieves a single document by ID.
   * Requires an active live Firestore session.
   */
  static async getDocumentById(documentId: string): Promise<ProjectDocument | null> {
    if (!documentId) return null;

    const isLive = isLiveFirestoreSession() && db;
    if (!isLive) {
      return null;
    }

    try {
      const docRef = doc(db, DOCUMENTS_COLLECTION, documentId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data() as ProjectDocument;
      }
      return null;
    } catch (err) {
      console.error(`[DocumentService] Live Firestore error fetching document ${documentId}:`, err);
      throw err;
    }
  }

  /**
   * Uploads and registers a new project document.
   * Performs validation, stores binary in secure vault, creates metadata record, and triggers extraction.
   */
  static async uploadDocument(input: DocumentUploadInput, user: any): Promise<ProjectDocument> {
    const { projectId, documentType, originalFileName, mimeType, fileSize, fileDataUrl } = input;

    if (!projectId) {
      throw new Error('Project ID is required.');
    }
    if (!originalFileName || originalFileName.trim().length === 0) {
      throw new Error('Valid original file name is required.');
    }
    if (fileSize > 15 * 1024 * 1024) {
      throw new Error('File size exceeds the 15MB limit.');
    }

    // Role verification
    const userRole = (user?.role || '').toLowerCase();
    if (!userRole.includes('gov') && !userRole.includes('agency')) {
      throw new Error('Access Denied: Only authorized government and agency users may upload project documents.');
    }

    // Authoritative project resolution
    const project = await ProjectService.getProjectById(projectId);
    if (!project) {
      throw new Error(`Project "${projectId}" not found.`);
    }

    // Agency project ownership validation
    if (userRole.includes('agency') && !userRole.includes('gov')) {
      const userOrg = user?.organizationId || user?.agencyId;
      if (userOrg && project.organizationId && userOrg !== project.organizationId) {
        throw new Error('Access Denied: You can only upload documents for projects awarded to your organization.');
      }
    }

    const isLive = isLiveFirestoreSession() && db;
    if (!isLive) {
      throw new Error('Document Intelligence requires a live Firestore session.');
    }

    const nowIso = new Date().toISOString();
    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    let storageReference = `storage/documents/${projectId}/${documentId}_${originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    let fileHash: string | undefined;

    // Call server storage vault endpoint to securely store binary
    if (fileDataUrl) {
      let token = '';
      if (auth?.currentUser) {
        token = await auth.currentUser.getIdToken();
      }
      let vaultRes: Response;
      try {
        vaultRes = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            documentId,
            projectId,
            fileName: originalFileName,
            mimeType,
            fileDataUrl,
          }),
        });
      } catch (vaultErr: any) {
        throw new Error(
          `Document Vault Error: Unable to upload file to storage vault (${vaultErr?.message || 'Network error'}).`
        );
      }

      if (!vaultRes.ok) {
        let errMsg = `Storage vault upload failed with status ${vaultRes.status}`;
        try {
          const errJson = await vaultRes.json();
          if (errJson?.error) {
            errMsg = errJson.error;
          }
        } catch {
          // ignore json parse error
        }
        throw new Error(`Document Vault Error: ${errMsg}`);
      }

      const vaultJson = await vaultRes.json();
      if (vaultJson.storageReference) {
        storageReference = vaultJson.storageReference;
        fileHash = vaultJson.fileHash;
      }
    }

    const newDoc: ProjectDocument = {
      id: documentId,
      projectId,
      projectNumber: project.projectNumber || project.projectCode,
      projectTitle: project.title,
      tenderId: project.tenderId,
      proposalId: project.proposalId,
      organizationId: project.organizationId,
      organizationName: project.implementingAgencyName || project.agencyName,
      documentType,
      originalFileName,
      storageReference,
      fileHash,
      mimeType,
      fileSize,
      uploadedBy: user?.id || user?.uid || 'user',
      uploaderName: user?.name || user?.displayName || 'Authorized User',
      uploaderRole: userRole.includes('gov') ? 'government' : 'agency',
      uploadedAt: nowIso,
      processingStatus: 'UPLOADED',
      extractionStatus: 'PENDING',
      validationStatus: 'NOT_VALIDATED',
      reviewStatus: 'NONE_REQUIRED',
      isDemonstrationData: isDemoSession(),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Immutable Audit Event
    const eventId = `evt-doc-upload-${documentId}-${Date.now()}`;
    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId,
      action: 'DOCUMENT_UPLOADED',
      actorId: user?.id || user?.uid || 'user',
      actorRole: userRole.includes('gov') ? 'government' : 'agency',
      actorName: user?.name || user?.displayName || 'Authorized User',
      timestamp: nowIso,
      newState: {
        documentId,
        documentType,
        originalFileName,
        fileSize,
      },
      metadata: {
        documentId,
        documentType,
        originalFileName,
        fileSize,
      },
      notes: `Document [${documentType}] "${originalFileName}" uploaded by ${user?.name || 'User'}. Initialized for processing.`,
    };

    const batch = writeBatch(db);
    const docRef = doc(db, DOCUMENTS_COLLECTION, documentId);
    const auditRef = doc(db, AUDIT_EVENTS_COLLECTION, eventId);
    batch.set(docRef, sanitizeFirestorePayload(newDoc));
    batch.set(auditRef, sanitizeFirestorePayload(auditEvent));

    try {
      await batch.commit();
    } catch (batchErr: any) {
      // If vault upload was performed, clean up the orphaned binary on Firestore registration failure
      if (fileDataUrl) {
        let token = '';
        if (auth?.currentUser) {
          try {
            token = await auth.currentUser.getIdToken();
          } catch {}
        }
        try {
          await fetch('/api/documents/cleanup-orphan', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              documentId,
              projectId,
            }),
          });
        } catch (cleanupErr) {
          console.warn('[DocumentService] Orphan document binary cleanup warning:', cleanupErr);
        }
      }
      throw batchErr;
    }

    // Trigger asynchronous extraction and deterministic cross-validation for government users only
    const isGov = userRole.includes('gov');
    if (isGov) {
      this.processDocumentExtraction(documentId, user, fileDataUrl).catch((procErr) => {
        console.warn('[DocumentService] Background extraction warning:', procErr);
      });
    }

    return newDoc;
  }

  /**
   * Orchestrates server-side extraction and deterministic cross-validation.
   * If Gemini is unavailable, gracefully preserves document and marks for manual review.
   */
  static async processDocumentExtraction(
    documentId: string,
    user: any,
    base64Payload?: string
  ): Promise<ProjectDocument> {
    const userRole = (user?.role || '').toLowerCase();
    if (!userRole.includes('gov')) {
      throw new Error('Access Denied: Only authorized government officers may execute document extraction & cross-validation.');
    }

    const existingDoc = await this.getDocumentById(documentId);
    if (!existingDoc) {
      throw new Error(`Document "${documentId}" not found.`);
    }

    const nowIso = new Date().toISOString();
    const isLive = isLiveFirestoreSession() && db;
    if (!isLive) {
      throw new Error('Document Intelligence requires a live Firestore session.');
    }

    // 1. Mark as PROCESSING
    let processingDoc: ProjectDocument = {
      ...existingDoc,
      processingStatus: 'PROCESSING',
      updatedAt: nowIso,
    };

    await updateDoc(doc(db, DOCUMENTS_COLLECTION, documentId), {
      processingStatus: 'PROCESSING',
      updatedAt: nowIso,
    });

    // 2. Fetch project context for extraction assistance
    const project = await ProjectService.getProjectById(existingDoc.projectId);

    let extractedData = existingDoc.extractedData;
    let detectedDocumentType = existingDoc.detectedDocumentType;
    let extractionStatus: any = 'COMPLETED';
    let extractionProvider = 'Gemini Document Intelligence';
    let extractionModel = 'gemini-3.5-flash-lite';
    let extractionTimestamp = nowIso;
    let processingError: string | undefined;

    try {
      let token = '';
      if (auth?.currentUser) {
        token = await auth.currentUser.getIdToken();
      }

      const res = await fetch('/api/documents/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          documentId,
          fileName: existingDoc.originalFileName,
          mimeType: existingDoc.mimeType,
          declaredType: existingDoc.documentType,
          storageReference: existingDoc.storageReference,
          base64Data: base64Payload,
          projectContext: project
            ? {
                projectId: project.id,
                projectTitle: project.title,
                sanctionedAmount: project.sanctionedAmount,
                awardedAmount: project.awardedAmount,
                implementingAgencyName: project.implementingAgencyName || project.agencyName,
              }
            : undefined,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.extractedData) {
          extractedData = json.extractedData;
          detectedDocumentType = json.detectedDocumentType || existingDoc.documentType;
          extractionProvider = json.provider || extractionProvider;
          extractionModel = json.model || extractionModel;
        } else {
          throw new Error(json.error || 'Server extraction payload incomplete.');
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server extraction failed with status ${res.status}`);
      }
    } catch (aiErr: any) {
      console.warn('[DocumentService] AI extraction failed or unavailable:', aiErr);
      extractionStatus = 'FAILED';
      processingError =
        'Document extraction is currently unavailable. The original document has been preserved for manual review.';
    }

    // 3. Deterministic Cross-Validation
    let crossValidationResults: any[] = [];
    let crossValidationSummary: any = undefined;
    let validationStatus: any = 'NOT_VALIDATED';
    let reviewStatus: DocumentReviewStatus = 'NONE_REQUIRED';
    let processingStatus: DocumentProcessingStatus = extractionStatus === 'FAILED' ? 'EXTRACTION_FAILED' : 'EXTRACTED';

    if (extractionStatus === 'COMPLETED' && project) {
      const [financialRecords, inspections] = await Promise.all([
        ProjectService.getFinancialRecords(project.id).catch(() => []),
        ProjectService.getInspections(project.id).catch(() => []),
      ]);

      const validation = DocumentCrossValidationService.crossValidate(
        {
          ...existingDoc,
          extractedData,
          detectedDocumentType,
        },
        {
          project,
          financialRecords,
          inspections,
        }
      );

      crossValidationResults = validation.results;
      crossValidationSummary = validation.summary;

      if (validation.summary.mismatchCount > 0 || validation.summary.requiresReviewCount > 0) {
        validationStatus = 'INCONSISTENCY_DETECTED';
        reviewStatus = 'REVIEW_REQUIRED';
        processingStatus = 'REVIEW_REQUIRED';

        // Phase 8 Evidence Chain Integration: Link document discrepancy into project evidence graph
        try {
          await EvidenceChainService.addDocumentEvidence({
            projectId: project.id,
            documentId,
            title: `Document Inconsistency: ${existingDoc.originalFileName}`,
            summary: `Cross-validation detected ${validation.summary.mismatchCount} variance(s) between document and authoritative records.`,
            documentType: existingDoc.documentType,
            originalFileName: existingDoc.originalFileName,
            inconsistencies: validation.summary.inconsistencies,
            officerName: user?.name || user?.displayName || 'System Validation',
            timestamp: nowIso,
          });
        } catch (evErr) {
          console.warn('[DocumentService] Non-critical evidence link warning:', evErr);
        }
      } else {
        validationStatus = 'VALIDATED_CLEAN';
        processingStatus = 'VALIDATED';
      }
    }

    const updatedDoc: ProjectDocument = {
      ...existingDoc,
      processingStatus,
      extractionStatus,
      validationStatus,
      reviewStatus,
      detectedDocumentType,
      extractedData,
      extractionProvider,
      extractionModel,
      extractionTimestamp,
      processingError,
      crossValidationResults,
      crossValidationSummary,
      updatedAt: nowIso,
    };

    // Audit Event
    const eventId = `evt-doc-val-${documentId}-${Date.now()}`;
    const auditAction: ProjectAuditAction =
      extractionStatus === 'FAILED'
        ? 'DOCUMENT_EXTRACTION_FAILED'
        : validationStatus === 'INCONSISTENCY_DETECTED'
        ? 'DOCUMENT_REVIEW_REQUESTED'
        : 'DOCUMENT_CROSS_VALIDATION_COMPLETED';

    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId: existingDoc.projectId,
      action: auditAction,
      actorId: user?.id || user?.uid || 'system',
      actorRole: 'system',
      actorName: 'BTI Document Intelligence Engine',
      timestamp: nowIso,
      newState: {
        documentId,
        processingStatus,
        extractionStatus,
        validationStatus,
        inconsistencies: crossValidationSummary?.inconsistencies || [],
      },
      metadata: {
        documentId,
        mismatches: crossValidationSummary?.mismatchCount || 0,
      },
      notes: `Document [${existingDoc.id}] processed: extraction ${extractionStatus}, validation ${validationStatus}.`,
    };

    const batch = writeBatch(db);
    const docRef = doc(db, DOCUMENTS_COLLECTION, documentId);
    const auditRef = doc(db, AUDIT_EVENTS_COLLECTION, eventId);
    batch.update(docRef, sanitizeFirestorePayload(updatedDoc));
    batch.set(auditRef, sanitizeFirestorePayload(auditEvent));
    await batch.commit();

    return updatedDoc;
  }

  /**
   * Records official government review decision on a document.
   * AI never automatically approves, rejects, or closes an inconsistency.
   */
  static async recordHumanReview(
    input: DocumentReviewInput,
    user: any
  ): Promise<ProjectDocument> {
    const { documentId, action, reviewNotes } = input;

    const userRole = (user?.role || '').toLowerCase();
    if (!userRole.includes('gov')) {
      throw new Error('Access Denied: Only authorized government officers can record official document review decisions.');
    }

    const isLive = isLiveFirestoreSession() && db;
    if (!isLive) {
      throw new Error('Document Intelligence requires a live Firestore session.');
    }

    const document = await this.getDocumentById(documentId);
    if (!document) {
      throw new Error(`Document "${documentId}" not found.`);
    }

    const nowIso = new Date().toISOString();
    let newReviewStatus: DocumentReviewStatus = 'ACKNOWLEDGED';
    let newProcessingStatus: DocumentProcessingStatus = document.processingStatus;

    if (action === 'MARK_RESOLVED') {
      newReviewStatus = 'RESOLVED';
      newProcessingStatus = 'VALIDATED';
    } else if (action === 'REQUEST_REVISION') {
      newReviewStatus = 'REVIEW_REQUIRED';
      newProcessingStatus = 'REVIEW_REQUIRED';
    }

    const updated: ProjectDocument = {
      ...document,
      reviewStatus: newReviewStatus,
      processingStatus: newProcessingStatus,
      reviewedBy: user?.id || user?.uid || 'gov-officer',
      reviewedByName: user?.name || user?.displayName || 'Authorized Government Officer',
      reviewedAt: nowIso,
      reviewNotes: reviewNotes.trim(),
      updatedAt: nowIso,
    };

    // Audit Event
    const eventId = `evt-doc-rev-${documentId}-${Date.now()}`;
    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId: document.projectId,
      action: 'DOCUMENT_REVIEWED',
      actorId: user?.id || user?.uid || 'gov-officer',
      actorRole: 'government',
      actorName: user?.name || user?.displayName || 'Authorized Officer',
      timestamp: nowIso,
      newState: {
        documentId,
        reviewStatus: newReviewStatus,
        processingStatus: newProcessingStatus,
        decision: action,
      },
      metadata: {
        documentId,
        decision: action,
        notes: reviewNotes,
      },
      notes: `Official human review recorded on document [${document.originalFileName}]: ${action} by ${user?.name || 'Officer'}. Notes: ${reviewNotes}`,
    };

    const batch = writeBatch(db);
    const docRef = doc(db, DOCUMENTS_COLLECTION, documentId);
    const auditRef = doc(db, AUDIT_EVENTS_COLLECTION, eventId);
    batch.update(docRef, sanitizeFirestorePayload(updated));
    batch.set(auditRef, sanitizeFirestorePayload(auditEvent));
    await batch.commit();

    return updated;
  }

  /**
   * Explicit user-triggered reprocessing request (Section 27).
   * Does NOT run automatically on page loads.
   */
  static async reprocessDocument(documentId: string, user: any): Promise<ProjectDocument> {
    const userRole = (user?.role || '').toLowerCase();
    if (!userRole.includes('gov')) {
      throw new Error('Access Denied: Only authorized government officers may request document reprocessing.');
    }

    const isLive = isLiveFirestoreSession() && db;
    if (!isLive) {
      throw new Error('Document Intelligence requires a live Firestore session.');
    }

    const nowIso = new Date().toISOString();
    const document = await this.getDocumentById(documentId);
    if (!document) {
      throw new Error(`Document "${documentId}" not found.`);
    }

    // Audit Event
    const eventId = `evt-doc-reproc-${documentId}-${Date.now()}`;
    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId: document.projectId,
      action: 'DOCUMENT_REPROCESS_REQUESTED',
      actorId: user?.id || user?.uid || 'user',
      actorRole: 'government',
      actorName: user?.name || user?.displayName || 'Authorized Officer',
      timestamp: nowIso,
      newState: { documentId, action: 'REPROCESS' },
      notes: `Reprocessing requested for document [${document.originalFileName}] by ${user?.name || 'User'}.`,
    };

    const auditRef = doc(db, AUDIT_EVENTS_COLLECTION, eventId);
    await setDoc(auditRef, sanitizeFirestorePayload(auditEvent));

    return this.processDocumentExtraction(documentId, user);
  }
}
