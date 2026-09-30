// Bharat Tender Intelligence (BTI) — Document Service
// Phase 11: Document Ingestion, Lifecycle Management & Supabase Storage Orchestration

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
import { supabase, DEFAULT_STORAGE_BUCKET } from '../supabase/supabase.js';
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
   * Generates a short-lived signed download URL for private, authenticated document access.
   * Verifies Firebase authentication and project/document access boundaries on the server.
   */
  static async getDocumentDownloadUrl(
    documentId: string
  ): Promise<{ downloadUrl: string; fileName: string; mimeType: string }> {
    if (!documentId) {
      throw new Error('Document ID is required.');
    }

    let token = '';
    if (auth?.currentUser) {
      token = await auth.currentUser.getIdToken();
    }

    const res = await fetch(`/api/data?action=document-download-url&documentId=${encodeURIComponent(documentId)}`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson?.error || `Failed to generate download URL (status ${res.status})`);
    }

    const data = await res.json();
    return {
      downloadUrl: data.downloadUrl,
      fileName: data.fileName || 'document.pdf',
      mimeType: data.mimeType || 'application/pdf',
    };
  }

  /**
   * Uploads and registers a new project document.
   * 1. Obtains authorized Supabase Storage signed upload URL via server.
   * 2. Uploads binary directly to Supabase Storage (bypasses 4.5MB Vercel serverless body limit).
   * 3. Confirms vault registration, writes Firestore metadata & audit record, and triggers extraction.
   */
  static async uploadDocument(input: DocumentUploadInput, user: any): Promise<ProjectDocument> {
    const { projectId, documentType, originalFileName, mimeType, fileSize, file, fileDataUrl } = input;

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

    // Authoritative Revision Lineage Validation
    const isRevision = Boolean(input.revisionOfDocumentId && input.revisionOfDocumentId.trim().length > 0);
    let authoritativeRevisionNumber: number | undefined = undefined;

    if (isRevision) {
      const parentDocId = input.revisionOfDocumentId!.trim();
      const parentDoc = await this.getDocumentById(parentDocId);
      if (!parentDoc) {
        throw new Error(
          `Revision Lineage Error: Referenced parent document "${parentDocId}" does not exist in authoritative records.`
        );
      }

      if (parentDoc.projectId !== projectId) {
        throw new Error(
          `Revision Lineage Error: Referenced parent document belongs to project "${parentDoc.projectId}", not "${projectId}". Cross-project revisions are prohibited.`
        );
      }

      if (userRole.includes('agency') && !userRole.includes('gov')) {
        const userOrg = user?.organizationId || user?.agencyId;
        if (parentDoc.organizationId && userOrg && parentDoc.organizationId !== userOrg) {
          throw new Error(
            'Revision Lineage Error: Access Denied. Parent document belongs to a different organization.'
          );
        }
      }

      if (parentDoc.reviewStatus !== 'REVISION_REQUESTED') {
        throw new Error(
          `Revision Lineage Error: Document "${parentDoc.originalFileName}" does not require revision (current reviewStatus: ${parentDoc.reviewStatus}). Revisions can only be submitted for documents where government review has explicitly requested a revision.`
        );
      }

      // Calculate next sequential revision number authoritatively:
      // Original document: revisionNumber absent or 0 -> parentRev = 0 -> nextRevision = 1
      // First revision: parentRev = 1 -> nextRevision = 2
      // Second revision: parentRev = 2 -> nextRevision = 3
      const parentRev = typeof parentDoc.revisionNumber === 'number' && parentDoc.revisionNumber > 0
        ? parentDoc.revisionNumber
        : 0;
      authoritativeRevisionNumber = parentRev + 1;
    }

    const isLive = isLiveFirestoreSession() && db;
    if (!isLive) {
      throw new Error('Document Intelligence requires a live Firestore session.');
    }

    const nowIso = new Date().toISOString();
    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const safeFileName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    let storageReference = `documents/${project.id}/${documentId}_${safeFileName}`;
    let fileHash: string | undefined;

    // Compute client-side SHA-256 hash
    try {
      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuf = await crypto.subtle.digest('SHA-256', arrayBuffer);
        fileHash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');
      } else if (fileDataUrl) {
        const cleanB64 = fileDataUrl.replace(/^data:[^;]+;base64,/, '');
        const binary = atob(cleanB64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
        fileHash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');
      }
    } catch {
      // hash calculation fallback
    }

    let token = '';
    if (auth?.currentUser) {
      token = await auth.currentUser.getIdToken();
    }

    let uploadedDirectlyToStorage = false;

    // 1. Direct binary upload to Supabase Storage via Server-Authorized Upload URL
    if (file) {
      // Request authorized upload URL from server
      let uploadUrlRes: Response;
      try {
        uploadUrlRes = await fetch('/api/data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            action: 'document-upload-url',
            documentId,
            projectId: project.id,
            fileName: originalFileName,
            mimeType: mimeType || 'application/pdf',
            fileSize,
            fileHash,
            revisionOfDocumentId: isRevision ? input.revisionOfDocumentId!.trim() : undefined,
          }),
        });
      } catch (reqErr: any) {
        throw new Error(
          `Document Upload Request Failed: Unable to request upload authorization (${reqErr?.message || 'Network error'}).`
        );
      }

      if (!uploadUrlRes.ok) {
        let errMsg = `Upload authorization failed with status ${uploadUrlRes.status}`;
        try {
          const errJson = await uploadUrlRes.json();
          if (errJson?.error) errMsg = errJson.error;
        } catch {}
        throw new Error(`Document Storage Authorization Error: ${errMsg}`);
      }

      const uploadUrlData = await uploadUrlRes.json();
      const { uploadUrl, token: uploadToken, storagePath, storageReference: serverRef, bucket: uploadBucket } = uploadUrlData;
      if (serverRef) {
        storageReference = serverRef;
      }

      // FIX 5: Use single source of truth for Supabase bucket name returned by server
      const targetBucket = uploadBucket || DEFAULT_STORAGE_BUCKET;

      // Upload binary directly to Supabase Storage
      try {
        let uploaded = false;

        // Try Supabase client uploadToSignedUrl if client SDK is configured and uploadToken provided
        if (supabase && uploadToken && storagePath) {
          try {
            const { error: sbErr } = await supabase.storage
              .from(targetBucket)
              .uploadToSignedUrl(storagePath, uploadToken, file, {
                contentType: mimeType || 'application/pdf',
              });
            if (!sbErr) {
              uploaded = true;
            }
          } catch {
            // fallback to direct HTTP PUT
          }
        }

        // Direct HTTP PUT to uploadUrl if not already uploaded
        if (!uploaded) {
          const putRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': mimeType || 'application/pdf',
            },
            body: file,
          });

          if (!putRes.ok) {
            throw new Error(`Direct storage upload returned status ${putRes.status}`);
          }
        }

        uploadedDirectlyToStorage = true;
      } catch (storageErr: any) {
        throw new Error(
          `Document Storage Upload Failed: ${storageErr?.message || 'Direct cloud storage upload was rejected.'}`
        );
      }
    } else if (fileDataUrl) {
      if (fileSize > 2 * 1024 * 1024) {
        throw new Error(
          'Document Upload Error: Documents exceeding 2MB must be uploaded as a binary file directly to storage.'
        );
      }
    } else {
      throw new Error('Document Upload Error: Document file binary is required.');
    }

    // 2. Call server storage vault endpoint to authorize, verify provenance, and register storageReference
    const uploadPayload: any = {
      action: 'document-upload',
      documentId,
      projectId: project.id,
      fileName: originalFileName,
      mimeType,
      storageReference,
      fileHash,
      fileSize,
      revisionOfDocumentId: isRevision ? input.revisionOfDocumentId!.trim() : undefined,
    };

    if (!file && fileDataUrl) {
      uploadPayload.fileDataUrl = fileDataUrl;
    }

    let vaultRes: Response;
    try {
      vaultRes = await fetch('/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(uploadPayload),
      });
    } catch (vaultErr: any) {
      if (uploadedDirectlyToStorage) {
        try {
          await fetch('/api/data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              action: 'document-cleanup-orphan',
              documentId,
              projectId: project.id,
              storageReference,
            }),
          });
        } catch (cleanupErr) {
          console.warn('[DocumentService] Orphan cleanup warning after network error:', cleanupErr);
        }
      }
      throw new Error(
        `Document Vault Error: Unable to complete file verification in storage vault (${vaultErr?.message || 'Network error'}).`
      );
    }

    if (!vaultRes.ok) {
      let errMsg = `Storage vault verification failed with status ${vaultRes.status}`;
      try {
        const errJson = await vaultRes.json();
        if (errJson?.error) {
          errMsg = errJson.error;
        }
      } catch {}

      if (uploadedDirectlyToStorage) {
        try {
          await fetch('/api/data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              action: 'document-cleanup-orphan',
              documentId,
              projectId: project.id,
              storageReference,
            }),
          });
        } catch (cleanupErr) {
          console.warn('[DocumentService] Orphan cleanup warning after /api/data rejection:', cleanupErr);
        }
      }

      throw new Error(`Document Vault Error: ${errMsg}`);
    }

    const vaultJson = await vaultRes.json();
    if (vaultJson.storageReference) {
      storageReference = vaultJson.storageReference;
      fileHash = vaultJson.fileHash || fileHash;
    }

    // FIX 2: Server-verified file size must be authoritative
    let verifiedFileSize = fileSize;
    if (typeof vaultJson.fileSize === 'number' && vaultJson.fileSize > 0) {
      verifiedFileSize = vaultJson.fileSize;
    } else if (file) {
      throw new Error('Document Vault Error: Authoritative server verification failed to provide verified file size.');
    }

    // FIX 3: Server-verified MIME type must be authoritative
    let verifiedMimeType = mimeType;
    if (vaultJson.mimeType) {
      verifiedMimeType = vaultJson.mimeType;
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
      mimeType: verifiedMimeType,
      fileSize: verifiedFileSize,
      uploadedBy: user?.id || user?.uid || 'user',
      uploaderName: user?.name || user?.displayName || 'Authorized User',
      uploaderRole: userRole.includes('gov') ? 'government' : 'agency',
      uploadedAt: nowIso,
      processingStatus: 'UPLOADED',
      extractionStatus: 'PENDING',
      validationStatus: 'NOT_VALIDATED',
      reviewStatus: 'NONE_REQUIRED',
      ...(isRevision
        ? {
            revisionOfDocumentId: input.revisionOfDocumentId!.trim(),
            revisionNumber: authoritativeRevisionNumber,
          }
        : {}),
      isDemonstrationData: isDemoSession(),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Immutable Audit Event
    const eventId = `evt-doc-upload-${documentId}-${Date.now()}`;
    const auditAction: ProjectAuditAction = isRevision ? 'DOCUMENT_REVISION_SUBMITTED' : 'DOCUMENT_UPLOADED';
    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId,
      action: auditAction,
      actorId: user?.id || user?.uid || 'user',
      actorRole: userRole.includes('gov') ? 'government' : 'agency',
      actorName: user?.name || user?.displayName || 'Authorized User',
      timestamp: nowIso,
      newState: {
        documentId,
        documentType,
        originalFileName,
        fileSize: verifiedFileSize,
        ...(isRevision
          ? {
              revisionOfDocumentId: input.revisionOfDocumentId!.trim(),
              revisionNumber: authoritativeRevisionNumber,
            }
          : {}),
      },
      metadata: {
        documentId,
        documentType,
        originalFileName,
        fileSize: verifiedFileSize,
        ...(isRevision
          ? {
              revisionOfDocumentId: input.revisionOfDocumentId!.trim(),
              revisionNumber: authoritativeRevisionNumber,
            }
          : {}),
      },
      notes: isRevision
        ? `Document revision #${authoritativeRevisionNumber} for [${input.revisionOfDocumentId}] "${originalFileName}" submitted by ${user?.name || 'User'}. Stored in Supabase Storage vault.`
        : `Document [${documentType}] "${originalFileName}" uploaded by ${user?.name || 'User'}. Stored in Supabase Storage vault.`,
    };

    const batch = writeBatch(db);
    const docRef = doc(db, DOCUMENTS_COLLECTION, documentId);
    const auditRef = doc(db, AUDIT_EVENTS_COLLECTION, eventId);
    batch.set(docRef, sanitizeFirestorePayload(newDoc));
    batch.set(auditRef, sanitizeFirestorePayload(auditEvent));

    try {
      await batch.commit();
    } catch (batchErr: any) {
      // Clean up orphaned binary from Supabase Storage on Firestore registration failure
      let orphanToken = '';
      if (auth?.currentUser) {
        try {
          orphanToken = await auth.currentUser.getIdToken();
        } catch {}
      }
      try {
        await fetch('/api/data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(orphanToken ? { Authorization: `Bearer ${orphanToken}` } : {}),
          },
          body: JSON.stringify({
            action: 'document-cleanup-orphan',
            documentId,
            projectId,
            storageReference,
          }),
        });
      } catch (cleanupErr) {
        console.warn('[DocumentService] Orphan document binary cleanup warning:', cleanupErr);
      }
      throw batchErr;
    }

    // Section 1: For GOVERNMENT uploads, await extraction & cross-validation so caller receives authoritative resulting document
    const isGov = userRole.includes('gov');
    if (isGov) {
      try {
        const processedDoc = await this.processDocumentExtraction(documentId, user);
        return processedDoc;
      } catch (procErr: any) {
        console.warn('[DocumentService] Government upload processing error:', procErr);
        const latestDoc = await this.getDocumentById(documentId);
        if (latestDoc && latestDoc.processingStatus === 'EXTRACTION_FAILED') {
          return latestDoc;
        }
        // Terminal failure persistence failed or state is still stale/PROCESSING
        throw new Error(
          `Document Processing Failure: Automatic processing failed (${procErr?.message || 'Extraction error'}), and authoritative terminal state could not be confirmed in Firestore.`
        );
      }
    }

    // Agency upload remains waiting: UPLOADED / PENDING
    return newDoc;
  }

  /**
   * Orchestrates server-side extraction and deterministic cross-validation.
   * If Gemini is unavailable, gracefully preserves document and marks for manual review.
   * Ensures every code path has a terminal persisted result (never stuck in PROCESSING).
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

    // 1. Mark as PROCESSING and record audit event
    const startEventId = `evt-doc-proc-start-${documentId}-${Date.now()}`;
    const startAuditEvent: ProjectAuditEvent = {
      eventId: startEventId,
      projectId: existingDoc.projectId,
      action: 'DOCUMENT_PROCESSING_STARTED',
      actorId: user?.id || user?.uid || 'gov-officer',
      actorRole: userRole.includes('gov') ? 'government' : 'system',
      actorName: user?.name || user?.displayName || 'Authorized Government Officer',
      timestamp: nowIso,
      newState: {
        documentId,
        processingStatus: 'PROCESSING',
      },
      metadata: {
        documentId,
        fileName: existingDoc.originalFileName,
      },
      notes: `Document extraction & cross-validation started for [${existingDoc.originalFileName}].`,
    };

    try {
      const startBatch = writeBatch(db);
      startBatch.update(doc(db, DOCUMENTS_COLLECTION, documentId), {
        processingStatus: 'PROCESSING',
        updatedAt: nowIso,
      });
      startBatch.set(doc(db, AUDIT_EVENTS_COLLECTION, startEventId), sanitizeFirestorePayload(startAuditEvent));
      await startBatch.commit();
    } catch (startErr: any) {
      console.error('[DocumentService] Fatal: Failed to persist initial PROCESSING state in Firestore:', startErr);
      throw new Error(
        `Document Processing Persistence Error: Unable to record initial PROCESSING state in Firestore (${startErr?.message || 'Transaction failed'}). Extraction aborted.`
      );
    }

    try {
      // 2. Fetch project context for extraction assistance
      const project = await ProjectService.getProjectById(existingDoc.projectId);

      let extractedData = existingDoc.extractedData;
      let detectedDocumentType = existingDoc.detectedDocumentType;
      let extractionStatus: any = 'COMPLETED';
      let extractionProvider = 'Gemini Document Intelligence';
      let extractionModel = 'gemini-3.5-flash-lite';
      let extractionTimestamp = new Date().toISOString();
      let processingError: string | undefined;

      try {
        let token = '';
        if (auth?.currentUser) {
          token = await auth.currentUser.getIdToken();
        }

        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            action: 'document-analysis',
            documentId,
            fileName: existingDoc.originalFileName,
            mimeType: existingDoc.mimeType,
            declaredType: existingDoc.documentType,
            storageReference: existingDoc.storageReference,
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
          aiErr?.message ||
          'Document extraction is currently unavailable. The original document has been preserved for manual review.';
      }

      // Section 9: Emit DOCUMENT_EXTRACTION_COMPLETED audit event on successful extraction
      if (extractionStatus === 'COMPLETED') {
        const extEventId = `evt-doc-ext-${documentId}-${Date.now()}`;
        const extAuditEvent: ProjectAuditEvent = {
          eventId: extEventId,
          projectId: existingDoc.projectId,
          action: 'DOCUMENT_EXTRACTION_COMPLETED',
          actorId: user?.id || user?.uid || 'system',
          actorRole: 'system',
          actorName: 'BTI Document Intelligence Engine',
          timestamp: new Date().toISOString(),
          newState: {
            documentId,
            extractionStatus: 'COMPLETED',
            detectedDocumentType,
            extractionModel,
          },
          metadata: {
            documentId,
            fileName: existingDoc.originalFileName,
            detectedDocumentType,
          },
          notes: `Structured extraction completed for [${existingDoc.originalFileName}] using ${extractionModel}.`,
        };
        try {
          const extBatch = writeBatch(db);
          extBatch.set(doc(db, AUDIT_EVENTS_COLLECTION, extEventId), sanitizeFirestorePayload(extAuditEvent));
          await extBatch.commit();
        } catch (extAuditErr) {
          console.warn('[DocumentService] Warning persisting extraction audit event:', extAuditErr);
        }
      }

      // 3. Deterministic Cross-Validation
      let crossValidationResults: any[] = [];
      let crossValidationSummary: any = undefined;
      let validationStatus: any = 'NOT_VALIDATED';
      let reviewStatus: DocumentReviewStatus = existingDoc.reviewStatus || 'NONE_REQUIRED';
      let processingStatus: DocumentProcessingStatus =
        extractionStatus === 'FAILED' ? 'EXTRACTION_FAILED' : 'EXTRACTED';

      if (extractionStatus === 'COMPLETED' && project) {
        // Section 4: Fail closed on authoritative cross-validation data (DO NOT substitute [] on failure)
        let financialRecords: any[];
        let inspections: any[];
        try {
          [financialRecords, inspections] = await Promise.all([
            ProjectService.getFinancialRecords(project.id),
            ProjectService.getInspections(project.id),
          ]);
        } catch (recLoadErr: any) {
          console.error('[DocumentService] Authoritative project records retrieval failed:', recLoadErr);
          const failTime = new Date().toISOString();
          const recFailEventId = `evt-doc-rec-fail-${documentId}-${Date.now()}`;
          const recFailReason = `Unable to complete deterministic cross-validation because authoritative project records could not be retrieved (${recLoadErr?.message || 'Database query failed'}). Original document preserved for manual review.`;

          const recFailDoc: ProjectDocument = {
            ...existingDoc,
            extractedData,
            detectedDocumentType,
            extractionProvider,
            extractionModel,
            extractionTimestamp,
            extractionStatus: 'COMPLETED',
            processingStatus: 'REVIEW_REQUIRED',
            validationStatus: 'REVIEW_REQUIRED',
            reviewStatus: 'REVIEW_REQUIRED',
            processingError: recFailReason,
            updatedAt: failTime,
          };

          const recFailAuditEvent: ProjectAuditEvent = {
            eventId: recFailEventId,
            projectId: existingDoc.projectId,
            action: 'DOCUMENT_REVIEW_REQUESTED',
            actorId: user?.id || user?.uid || 'system',
            actorRole: 'system',
            actorName: 'BTI Document Intelligence Engine',
            timestamp: failTime,
            newState: {
              documentId,
              processingStatus: 'REVIEW_REQUIRED',
              validationStatus: 'REVIEW_REQUIRED',
              reviewStatus: 'REVIEW_REQUIRED',
              error: recFailReason,
            },
            metadata: {
              documentId,
              error: recFailReason,
            },
            notes: recFailReason,
          };

          const failBatch = writeBatch(db);
          failBatch.update(doc(db, DOCUMENTS_COLLECTION, documentId), sanitizeFirestorePayload(recFailDoc));
          failBatch.set(doc(db, AUDIT_EVENTS_COLLECTION, recFailEventId), sanitizeFirestorePayload(recFailAuditEvent));
          await failBatch.commit();

          return recFailDoc;
        }

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
              timestamp: new Date().toISOString(),
            });
          } catch (evErr) {
            console.warn('[DocumentService] Non-critical evidence link warning:', evErr);
          }
        } else {
          validationStatus = 'VALIDATED_CLEAN';
          processingStatus = 'VALIDATED';
          reviewStatus = 'NONE_REQUIRED';
        }
      }

      const completedTime = new Date().toISOString();
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
        updatedAt: completedTime,
      };

      // Audit Event
      const valEventId = `evt-doc-val-${documentId}-${Date.now()}`;
      const auditAction: ProjectAuditAction =
        extractionStatus === 'FAILED'
          ? 'DOCUMENT_EXTRACTION_FAILED'
          : validationStatus === 'INCONSISTENCY_DETECTED'
          ? 'DOCUMENT_REVIEW_REQUESTED'
          : 'DOCUMENT_CROSS_VALIDATION_COMPLETED';

      const auditEvent: ProjectAuditEvent = {
        eventId: valEventId,
        projectId: existingDoc.projectId,
        action: auditAction,
        actorId: user?.id || user?.uid || 'system',
        actorRole: 'system',
        actorName: 'BTI Document Intelligence Engine',
        timestamp: completedTime,
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

      const finalBatch = writeBatch(db);
      const docRef = doc(db, DOCUMENTS_COLLECTION, documentId);
      const auditRef = doc(db, AUDIT_EVENTS_COLLECTION, valEventId);
      finalBatch.update(docRef, sanitizeFirestorePayload(updatedDoc));
      finalBatch.set(auditRef, sanitizeFirestorePayload(auditEvent));
      await finalBatch.commit();

      return updatedDoc;
    } catch (unexpectedErr: any) {
      console.error('[DocumentService] Unexpected error during document extraction:', unexpectedErr);
      const failTime = new Date().toISOString();
      const failEventId = `evt-doc-fail-${documentId}-${Date.now()}`;
      const failDoc: ProjectDocument = {
        ...existingDoc,
        processingStatus: 'EXTRACTION_FAILED',
        extractionStatus: 'FAILED',
        processingError: unexpectedErr.message || 'Document extraction failed unexpectedly. Preserved for review.',
        updatedAt: failTime,
      };

      const failAuditEvent: ProjectAuditEvent = {
        eventId: failEventId,
        projectId: existingDoc.projectId,
        action: 'DOCUMENT_EXTRACTION_FAILED',
        actorId: user?.id || user?.uid || 'system',
        actorRole: 'system',
        actorName: 'BTI Document Intelligence Engine',
        timestamp: failTime,
        newState: {
          documentId,
          processingStatus: 'EXTRACTION_FAILED',
          extractionStatus: 'FAILED',
          error: unexpectedErr.message,
        },
        metadata: {
          documentId,
          error: unexpectedErr.message,
        },
        notes: `Document extraction failed unexpectedly: ${unexpectedErr.message}. Original document preserved.`,
      };

      try {
        const failBatch = writeBatch(db);
        failBatch.update(doc(db, DOCUMENTS_COLLECTION, documentId), sanitizeFirestorePayload(failDoc));
        failBatch.set(doc(db, AUDIT_EVENTS_COLLECTION, failEventId), sanitizeFirestorePayload(failAuditEvent));
        await failBatch.commit();
      } catch (saveErr: any) {
        console.error('[DocumentService] Failed to persist terminal extraction failure:', saveErr);
        throw new Error(
          `Document Processing Persistence Error: Failed to persist terminal extraction failure in Firestore (${saveErr?.message || 'Database write rejected'}).`
        );
      }

      return failDoc;
    }
  }

  /**
   * Records official government review and verification decisions on a document.
   * AI never automatically approves, rejects, or closes an inconsistency.
   */
  static async recordHumanReview(
    input: DocumentReviewInput,
    user: any
  ): Promise<ProjectDocument> {
    const { documentId, action, reviewNotes, verificationDecision } = input;

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

    const currentReviewStatus = document.reviewStatus || 'NONE_REQUIRED';
    const nowIso = new Date().toISOString();
    let newReviewStatus: DocumentReviewStatus = 'ACKNOWLEDGED';
    let newProcessingStatus: DocumentProcessingStatus = document.processingStatus;
    let auditAction: ProjectAuditAction = 'DOCUMENT_REVIEWED';
    let auditNotes = '';

    let updatedDecision = document.verificationDecision;
    let updatedNotes = document.verificationNotes;
    let updatedVerifiedBy = document.verifiedBy;
    let updatedVerifiedByName = document.verifiedByName;
    let updatedVerifiedAt = document.verifiedAt;

    // Section 7: Enforce authoritative verification state transitions
    if (action === 'MARK_VERIFICATION') {
      const allowedPrevious = [
        'REVIEW_REQUIRED',
        'ACKNOWLEDGED',
        'VERIFICATION_REQUIRED',
        'REVISION_REQUESTED',
        'NONE_REQUIRED',
      ];
      if (!allowedPrevious.includes(currentReviewStatus)) {
        throw new Error(
          `State Transition Error: Cannot mark document for verification from status "${currentReviewStatus}".`
        );
      }
      newReviewStatus = 'VERIFICATION_REQUIRED';
      newProcessingStatus = 'REVIEW_REQUIRED';
      auditAction = 'DOCUMENT_VERIFICATION_REQUESTED';
      auditNotes = `Document marked for official verification by ${user?.name || 'Officer'}. Notes: ${reviewNotes}`;

      // Section 8: Clear current verification fields when starting a new verification cycle
      updatedDecision = undefined;
      updatedNotes = undefined;
      updatedVerifiedBy = undefined;
      updatedVerifiedByName = undefined;
      updatedVerifiedAt = undefined;
    } else if (action === 'START_VERIFICATION') {
      // ONLY from VERIFICATION_REQUIRED -> VERIFICATION_IN_PROGRESS
      if (currentReviewStatus !== 'VERIFICATION_REQUIRED') {
        throw new Error(
          `State Transition Error: Official verification can only be initiated (START_VERIFICATION) from status "VERIFICATION_REQUIRED" (current status: ${currentReviewStatus}).`
        );
      }
      newReviewStatus = 'VERIFICATION_IN_PROGRESS';
      newProcessingStatus = 'REVIEW_REQUIRED';
      auditAction = 'DOCUMENT_REVIEWED';
      auditNotes = `Official verification initiated by ${user?.name || 'Officer'}. Notes: ${reviewNotes}`;
    } else if (action === 'COMPLETE_VERIFICATION') {
      // ONLY from VERIFICATION_IN_PROGRESS -> VERIFIED
      if (currentReviewStatus !== 'VERIFICATION_IN_PROGRESS') {
        throw new Error(
          `State Transition Error: Official verification can only be completed (COMPLETE_VERIFICATION) from status "VERIFICATION_IN_PROGRESS" (current status: ${currentReviewStatus}). Direct transition from "${currentReviewStatus}" to "VERIFIED" is prohibited.`
        );
      }
      newReviewStatus = 'VERIFIED';
      newProcessingStatus = 'VALIDATED';
      updatedDecision = verificationDecision || 'VERIFIED_ACCURATE';
      updatedNotes = reviewNotes.trim();
      updatedVerifiedBy = user?.id || user?.uid || 'gov-officer';
      updatedVerifiedByName = user?.name || user?.displayName || 'Authorized Government Officer';
      updatedVerifiedAt = nowIso;
      auditAction = 'DOCUMENT_VERIFICATION_COMPLETED';
      auditNotes = `Official verification completed (${updatedDecision}) by ${user?.name || 'Officer'}. Notes: ${reviewNotes}`;
    } else if (action === 'REQUEST_REVISION') {
      const allowedPrevious = [
        'REVIEW_REQUIRED',
        'ACKNOWLEDGED',
        'VERIFICATION_REQUIRED',
        'VERIFICATION_IN_PROGRESS',
        'NONE_REQUIRED',
      ];
      if (!allowedPrevious.includes(currentReviewStatus)) {
        throw new Error(
          `State Transition Error: Cannot request agency revision from status "${currentReviewStatus}".`
        );
      }
      newReviewStatus = 'REVISION_REQUESTED';
      newProcessingStatus = 'REVIEW_REQUIRED';
      auditAction = 'DOCUMENT_REVISION_REQUESTED';
      auditNotes = `Agency revision requested by ${user?.name || 'Officer'}. Instructions: ${reviewNotes}`;
    } else if (action === 'MARK_RESOLVED') {
      if (currentReviewStatus === 'RESOLVED') {
        throw new Error('State Transition Error: Document review is already marked resolved.');
      }
      newReviewStatus = 'RESOLVED';
      newProcessingStatus = 'VALIDATED';
      auditAction = 'DOCUMENT_REVIEWED';
      auditNotes = `Document discrepancy marked resolved by ${user?.name || 'Officer'}. Notes: ${reviewNotes}`;
    } else if (action === 'ACKNOWLEDGE') {
      if (currentReviewStatus === 'VERIFIED') {
        throw new Error('State Transition Error: Cannot acknowledge an already verified document.');
      }
      newReviewStatus = 'ACKNOWLEDGED';
      auditAction = 'DOCUMENT_REVIEWED';
      auditNotes = `Government acknowledged discrepancy (verification has not been conducted) by ${user?.name || 'Officer'}. Notes: ${reviewNotes}`;
    } else {
      throw new Error(`State Transition Error: Unknown review action "${action}".`);
    }

    const updated: ProjectDocument = {
      ...document,
      reviewStatus: newReviewStatus,
      processingStatus: newProcessingStatus,
      reviewedBy: user?.id || user?.uid || 'gov-officer',
      reviewedByName: user?.name || user?.displayName || 'Authorized Government Officer',
      reviewedAt: nowIso,
      reviewNotes: reviewNotes.trim(),
      verificationDecision: updatedDecision,
      verificationNotes: updatedNotes,
      verifiedBy: updatedVerifiedBy,
      verifiedByName: updatedVerifiedByName,
      verifiedAt: updatedVerifiedAt,
      updatedAt: nowIso,
    };

    // Audit Event
    const eventId = `evt-doc-rev-${documentId}-${Date.now()}`;
    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId: document.projectId,
      action: auditAction,
      actorId: user?.id || user?.uid || 'gov-officer',
      actorRole: 'government',
      actorName: user?.name || user?.displayName || 'Authorized Officer',
      timestamp: nowIso,
      previousState: {
        reviewStatus: document.reviewStatus,
        processingStatus: document.processingStatus,
      },
      newState: {
        documentId,
        reviewStatus: newReviewStatus,
        processingStatus: newProcessingStatus,
        decision: action,
        verificationDecision: updatedDecision,
      },
      metadata: {
        documentId,
        decision: action,
        notes: reviewNotes,
        verificationDecision: updatedDecision,
      },
      notes: auditNotes,
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
