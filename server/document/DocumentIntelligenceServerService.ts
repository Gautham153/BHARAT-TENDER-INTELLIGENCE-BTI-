// Bharat Tender Intelligence (BTI) — Document Intelligence Server Service
// Phase 11: Server-Side Ingestion, Secure Vault Storage & Extraction Orchestration
// Enhanced with Persistent Firebase / Google Cloud Storage Vault for Serverless Vercel Deployment
// Authoritative Resource-Level Authorization (Project & Organization Boundaries)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { verifyServerAuth, isServerDemoModeEnabled } from '../evaluation/serverAuth.js';
import { GeminiDocumentExtractionProvider } from './GeminiDocumentExtractionProvider.js';
import { DocumentType } from '../../src/types/document.js';
import {
  getAuthoritativeDocument,
  getAuthoritativeProject,
  getAuthoritativeDocumentByStorageRef,
  recordInMemoryDocument,
} from './authoritativeDocumentResolver.js';
import {
  uploadToCloudStorage,
  downloadFromCloudStorage,
  deleteFromCloudStorage,
  deleteOrphanObjectsByPrefix,
  checkCloudStorageObjectExists,
  isCloudStorageConfigured,
  normalizeStorageReference,
} from './cloudStorageService.js';

function extractToken(authHeader?: string): string | undefined {
  if (!authHeader) return undefined;
  if (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer ')) {
    return authHeader.substring(7).trim();
  }
  return authHeader.trim();
}

export class DocumentIntelligenceServerService {
  private extractionProvider: GeminiDocumentExtractionProvider;
  private localDevStorageDir?: string;

  constructor() {
    this.extractionProvider = new GeminiDocumentExtractionProvider();
    // Local filesystem storage is strictly isolated for offline demonstration/development mode
    if (isServerDemoModeEnabled()) {
      try {
        this.localDevStorageDir = path.join(process.cwd(), 'storage', 'documents');
        if (!fs.existsSync(this.localDevStorageDir)) {
          fs.mkdirSync(this.localDevStorageDir, { recursive: true });
        }
      } catch {
        // Ephemeral environments might restrict filesystem access
      }
    }
  }

  /**
   * Securely saves document binary to the persistent Cloud Storage document vault.
   * Computes SHA-256 hash for provenance and duplicate detection.
   * Authorizes against authoritative project ownership.
   * Rejects overwriting existing authoritative documents with HTTP 409.
   */
  async storeDocumentFile(params: {
    documentId: string;
    projectId?: string;
    fileName: string;
    mimeType: string;
    storageReference?: string;
    fileHash?: string;
    fileSize?: number;
    bufferOrBase64?: string | Buffer;
    authHeader?: string;
  }): Promise<{ storageReference: string; fileHash: string; fileSize: number }> {
    const {
      documentId,
      projectId,
      fileName,
      mimeType,
      storageReference: suppliedStorageRef,
      fileHash: suppliedFileHash,
      fileSize: suppliedFileSize,
      bufferOrBase64,
      authHeader,
    } = params;

    // MIME type validation
    const normalizedMime = (mimeType || '').trim().toLowerCase();
    const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']);
    if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
      const err: any = new Error(
        'Invalid Request: Unsupported document format. Only PDF, PNG, and JPEG documents are supported.'
      );
      err.statusCode = 400;
      throw err;
    }

    // 1. Authorize user session
    const authResult = await verifyServerAuth(authHeader);
    const role = (authResult.role || '').toLowerCase();
    const isGov = role.includes('gov');
    const isAgency = role.includes('agency');

    if (!isGov && !isAgency) {
      const err: any = new Error(
        'Access Denied: Document storage is restricted to authorized government and agency personnel.'
      );
      err.statusCode = 403;
      throw err;
    }

    const token = extractToken(authHeader);

    // 2. Authoritative Document Existence Check (Prevent Overwriting Existing Documents)
    const existingDoc = await getAuthoritativeDocument(documentId, token);
    if (existingDoc) {
      const err: any = new Error(
        `Conflict: Document ID '${documentId}' already exists in authoritative records. Overwriting stored documents is prohibited.`
      );
      err.statusCode = 409;
      throw err;
    }

    // 3. Verify referenced project exists and belongs to the agency
    const targetProjectId = projectId?.trim();
    if (!targetProjectId || targetProjectId.length === 0) {
      const err: any = new Error(
        'Invalid Request: Project ID is required to establish authoritative document storage authorization.'
      );
      err.statusCode = 400;
      throw err;
    }

    const project = await getAuthoritativeProject(targetProjectId, token);
    if (!project) {
      const err: any = new Error(
        `Project Not Found: Referenced project '${targetProjectId}' does not exist in authoritative records.`
      );
      err.statusCode = 404;
      throw err;
    }

    const targetOrgId = project.organizationId;

    // Agency authorization on new document
    if (isAgency && !isGov) {
      const agencyOrgId = authResult.organizationId;
      if (!agencyOrgId) {
        const err: any = new Error(
          'Access Denied: Agency profile does not have an authoritative organization identifier.'
        );
        err.statusCode = 403;
        throw err;
      }

      if (!project.organizationId || project.organizationId !== agencyOrgId) {
        const err: any = new Error(
          'Access Denied: You can only upload documents for projects awarded to your organization.'
        );
        err.statusCode = 403;
        throw err;
      }
    }

    const safeName = `${documentId}_${path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const expectedStorageRef = `storage/documents/${project.id}/${safeName}`;

    // CASE A: Client performed direct cloud storage upload (preferred for large files up to 15MB)
    if (suppliedStorageRef && !bufferOrBase64) {
      const cleanSuppliedRef = normalizeStorageReference(suppliedStorageRef);

      // Verify the supplied storageReference matches the exact authoritative project and document path
      if (
        cleanSuppliedRef !== expectedStorageRef ||
        cleanSuppliedRef.includes('..') ||
        cleanSuppliedRef.includes('\\') ||
        cleanSuppliedRef.includes('\0')
      ) {
        const err: any = new Error(
          'Security Violation: Invalid or unauthorized storage reference provided for document.'
        );
        err.statusCode = 400;
        throw err;
      }

      // Verify object exists in Cloud Storage vault
      if (isCloudStorageConfigured()) {
        const existsInVault = await checkCloudStorageObjectExists(cleanSuppliedRef, token);
        if (!existsInVault) {
          const err: any = new Error(
            'Document Storage Error: Uploaded binary not found in cloud storage vault.'
          );
          err.statusCode = 404;
          throw err;
        }

        // Verify volumetric boundary & compute authoritative SHA-256 hash
        const cloudFile = await downloadFromCloudStorage({
          objectPath: cleanSuppliedRef,
          userToken: token,
        });

        if (cloudFile.buffer.length > 15 * 1024 * 1024) {
          const err: any = new Error('Document Integrity Error: Stored binary exceeds the 15MB limit.');
          err.statusCode = 400;
          throw err;
        }

        const calculatedHash = crypto.createHash('sha256').update(cloudFile.buffer).digest('hex');
        if (
          suppliedFileHash &&
          suppliedFileHash.trim().length > 0 &&
          calculatedHash.toLowerCase() !== suppliedFileHash.trim().toLowerCase()
        ) {
          const err: any = new Error(
            'Document Integrity Error: SHA-256 hash mismatch during storage verification.'
          );
          err.statusCode = 400;
          throw err;
        }

        return {
          storageReference: cleanSuppliedRef,
          fileHash: calculatedHash,
          fileSize: cloudFile.buffer.length,
        };
      } else if (isServerDemoModeEnabled()) {
        // Fallback for demo mode
        return {
          storageReference: cleanSuppliedRef,
          fileHash: suppliedFileHash || crypto.createHash('sha256').update(Buffer.from(documentId)).digest('hex'),
          fileSize: suppliedFileSize || 1024,
        };
      }
    }

    // CASE B: Binary payload provided through server endpoint (small files / demo mode)
    if (!bufferOrBase64) {
      const err: any = new Error(
        'Invalid Request: Either storageReference or binary payload must be provided.'
      );
      err.statusCode = 400;
      throw err;
    }

    let buffer: Buffer;
    if (Buffer.isBuffer(bufferOrBase64)) {
      buffer = bufferOrBase64;
    } else {
      const cleanBase64 = bufferOrBase64.replace(/^data:[^;]+;base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
    }

    // Volumetric boundary: max 15MB
    if (buffer.length > 15 * 1024 * 1024) {
      const err: any = new Error('File size exceeds the 15MB limit.');
      err.statusCode = 400;
      throw err;
    }

    const storageReference = expectedStorageRef;
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Persist binary to Persistent Cloud Storage (or local dev storage strictly in demo mode)
    if (isCloudStorageConfigured()) {
      const alreadyInCloud = await checkCloudStorageObjectExists(storageReference, token);
      if (alreadyInCloud) {
        const err: any = new Error(
          `Conflict: Document file '${safeName}' already exists in the storage vault.`
        );
        err.statusCode = 409;
        throw err;
      }

      await uploadToCloudStorage({
        objectPath: storageReference,
        buffer,
        mimeType: normalizedMime,
        userToken: token,
      });
    } else if (isServerDemoModeEnabled()) {
      if (this.localDevStorageDir) {
        const filePath = path.join(this.localDevStorageDir, `${project.id}_${safeName}`);
        if (fs.existsSync(filePath)) {
          const err: any = new Error(
            `Conflict: Document file '${safeName}' already exists in the storage vault.`
          );
          err.statusCode = 409;
          throw err;
        }
        fs.writeFileSync(filePath, buffer);
      }
    } else {
      const err: any = new Error(
        'Server Configuration Error: Persistent Cloud Storage bucket is not configured for production document persistence.'
      );
      err.statusCode = 500;
      throw err;
    }

    // Record in-memory session cache only when explicit demo mode is enabled
    if (isServerDemoModeEnabled()) {
      recordInMemoryDocument({
        id: documentId,
        projectId: targetProjectId,
        organizationId: targetOrgId,
        documentType: 'OTHER_SUPPORTING_DOCUMENT',
        originalFileName: fileName,
        storageReference,
        fileHash,
        mimeType: normalizedMime,
        fileSize: buffer.length,
        uploadedBy: authResult.uid,
        uploaderRole: isGov ? 'government' : 'agency',
        uploadedAt: new Date().toISOString(),
        processingStatus: 'UPLOADED',
        extractionStatus: 'PENDING',
        validationStatus: 'NOT_VALIDATED',
        reviewStatus: 'NONE_REQUIRED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return {
      storageReference,
      fileHash,
      fileSize: buffer.length,
    };
  }

  /**
   * Cleans up an orphaned vault binary when subsequent Firestore metadata registration fails.
   * Strictly requires a valid projectId and verifies project ownership.
   * Strictly verifies the document does NOT exist in authoritative Firestore before unlinking.
   */
  async cleanupOrphanVaultFile(params: {
    documentId: string;
    projectId: string;
    storageReference?: string;
    authHeader?: string;
  }): Promise<{ success: boolean; cleaned: boolean }> {
    const { documentId, projectId, storageReference, authHeader } = params;

    if (!documentId || typeof documentId !== 'string' || !documentId.startsWith('doc-')) {
      const err: any = new Error('Invalid Request: Valid documentId is required.');
      err.statusCode = 400;
      throw err;
    }

    // Path traversal check on documentId
    if (
      documentId.includes('..') ||
      documentId.includes('/') ||
      documentId.includes('\\') ||
      documentId.includes('\0')
    ) {
      const err: any = new Error('Invalid Request: Malformed documentId.');
      err.statusCode = 400;
      throw err;
    }

    const cleanProjectId = (projectId || '').trim();
    if (!cleanProjectId) {
      const err: any = new Error('Invalid Request: Valid projectId is required for orphan cleanup.');
      err.statusCode = 400;
      throw err;
    }

    // 1. Authorize user session
    const authResult = await verifyServerAuth(authHeader);
    const role = (authResult.role || '').toLowerCase();
    const isGov = role.includes('gov');
    const isAgency = role.includes('agency');

    if (!isGov && !isAgency) {
      const err: any = new Error('Access Denied: Cleanup is restricted to authorized personnel.');
      err.statusCode = 403;
      throw err;
    }

    const token = extractToken(authHeader);

    // 2. Authoritative Project Existence & Ownership Resolution
    const project = await getAuthoritativeProject(cleanProjectId, token);
    if (!project) {
      const err: any = new Error(
        `Project Not Found: Referenced project '${cleanProjectId}' does not exist in authoritative records.`
      );
      err.statusCode = 404;
      throw err;
    }

    if (isAgency && !isGov) {
      const agencyOrgId = authResult.organizationId;
      if (!agencyOrgId) {
        const err: any = new Error(
          'Access Denied: Agency profile does not have an authoritative organization identifier.'
        );
        err.statusCode = 403;
        throw err;
      }

      if (!project.organizationId || project.organizationId !== agencyOrgId) {
        const err: any = new Error(
          'Access Denied: You cannot clean up files for another organization.'
        );
        err.statusCode = 403;
        throw err;
      }
    }

    // 3. Authoritative Document Existence Check
    // If the document actually exists in Firestore, it is an authoritative record and CANNOT be deleted.
    const existingDoc = await getAuthoritativeDocument(documentId, token);
    if (existingDoc) {
      const err: any = new Error(
        'Conflict: Document is already registered in authoritative records and cannot be deleted.'
      );
      err.statusCode = 409;
      throw err;
    }

    // 4. Delete orphan cloud storage object(s) strictly prefixed by `storage/documents/${project.id}/${documentId}_`
    let cleaned = false;
    const projectScopedPrefix = `storage/documents/${project.id}/${documentId}_`;

    if (isCloudStorageConfigured()) {
      if (storageReference) {
        const cleanRef = normalizeStorageReference(storageReference);
        if (cleanRef.startsWith(projectScopedPrefix)) {
          const directDeleted = await deleteFromCloudStorage({
            objectPath: cleanRef,
            userToken: token,
          });
          if (directDeleted) cleaned = true;
        }
      }

      const prefixResult = await deleteOrphanObjectsByPrefix({
        prefix: projectScopedPrefix,
        userToken: token,
      });
      if (prefixResult.deletedCount > 0) {
        cleaned = true;
      }
    }

    // Local dev fallback cleanup in demo mode
    if (isServerDemoModeEnabled() && this.localDevStorageDir && fs.existsSync(this.localDevStorageDir)) {
      const files = fs.readdirSync(this.localDevStorageDir);
      for (const f of files) {
        if (f.startsWith(`${documentId}_`) || f.startsWith(`${project.id}_${documentId}_`)) {
          const filePath = path.join(this.localDevStorageDir, f);
          try {
            fs.unlinkSync(filePath);
            cleaned = true;
          } catch (delErr) {
            console.warn(`[DocumentIntelligenceServerService] Could not unlink orphan file ${filePath}:`, delErr);
          }
        }
      }
    }

    return { success: true, cleaned };
  }

  /**
   * Reads stored document binary from the persistent Cloud Storage vault.
   * Enforces matching between document ID and storage reference.
   * Verifies SHA-256 binary hash integrity against authoritative document metadata.
   * Authorizes against authoritative document & project ownership.
   */
  async getDocumentFile(params: {
    storageReference?: string;
    documentId?: string;
    authHeader?: string;
  }): Promise<{ buffer: Buffer; mimeType: string }> {
    const { storageReference, documentId, authHeader } = params;

    // 1. Authorize user session
    const authResult = await verifyServerAuth(authHeader);
    const role = (authResult.role || '').toLowerCase();
    const isGov = role.includes('gov');
    const isAgency = role.includes('agency');

    if (!isGov && !isAgency) {
      const err: any = new Error('Access Denied: Document retrieval is restricted to authorized personnel.');
      err.statusCode = 403;
      throw err;
    }

    // Path traversal check
    if (storageReference) {
      if (
        storageReference.includes('..') ||
        storageReference.startsWith('/') ||
        storageReference.includes('\\') ||
        storageReference.includes('\0')
      ) {
        const err: any = new Error('Invalid storage reference path.');
        err.statusCode = 400;
        throw err;
      }
    }

    const token = extractToken(authHeader);

    // 2. Authoritative Document Resolution
    let doc: any = null;
    let effectiveStorageRef = '';

    if (documentId) {
      doc = await getAuthoritativeDocument(documentId, token);
      if (!doc) {
        const err: any = new Error(
          `Authoritative Record Not Found: Document '${documentId}' does not exist in authoritative records.`
        );
        err.statusCode = 404;
        throw err;
      }

      // If storageReference was also provided, require exact match with authoritative record
      if (storageReference) {
        const normSupplied = normalizeStorageReference(storageReference);
        const normDocRef = normalizeStorageReference(doc.storageReference || '');
        if (normSupplied !== normDocRef && path.basename(normSupplied) !== path.basename(normDocRef)) {
          const err: any = new Error(
            'Invalid Request: Supplied storage reference does not match authoritative document record.'
          );
          err.statusCode = 400;
          throw err;
        }
      }

      // Authoritative document's storage reference is the ONLY reference used
      effectiveStorageRef = doc.storageReference;
    } else if (storageReference) {
      doc = await getAuthoritativeDocumentByStorageRef(storageReference, token);
      if (!doc) {
        const err: any = new Error(
          'Access Denied: Requested document storage reference is not registered or authorized in BTI records.'
        );
        err.statusCode = 404;
        throw err;
      }
      effectiveStorageRef = doc.storageReference || storageReference;
    } else {
      const err: any = new Error('Invalid Request: Either documentId or storageReference must be provided.');
      err.statusCode = 400;
      throw err;
    }

    if (!effectiveStorageRef) {
      const err: any = new Error('Document file storage reference is missing in authoritative records.');
      err.statusCode = 404;
      throw err;
    }

    // 3. Authoritative Project Resolution
    const project = await getAuthoritativeProject(doc.projectId, token);
    if (!project) {
      const err: any = new Error(
        `Access Denied: Project '${doc.projectId}' associated with this document was not found.`
      );
      err.statusCode = 404;
      throw err;
    }

    // 4. Agency Resource-Level Authorization
    if (isAgency && !isGov) {
      const agencyOrgId = authResult.organizationId;
      if (!agencyOrgId) {
        const err: any = new Error(
          'Access Denied: Agency profile does not have an authoritative organization identifier.'
        );
        err.statusCode = 403;
        throw err;
      }

      if (!project.organizationId || project.organizationId !== agencyOrgId) {
        const err: any = new Error(
          'Access Denied: You are not authorized to access documents for this project.'
        );
        err.statusCode = 403;
        throw err;
      }

      if (doc.organizationId && doc.organizationId !== agencyOrgId) {
        const err: any = new Error(
          'Access Denied: You are not authorized to access documents belonging to another organization.'
        );
        err.statusCode = 403;
        throw err;
      }
    }

    // 5. Read file safely from persistent Cloud Storage vault (or local fallback in demo mode)
    let buffer: Buffer | null = null;
    let mimeType = doc.mimeType || 'application/pdf';

    if (isCloudStorageConfigured()) {
      try {
        const cloudFile = await downloadFromCloudStorage({
          objectPath: effectiveStorageRef,
          userToken: token,
        });
        buffer = cloudFile.buffer;
        if (cloudFile.mimeType) {
          mimeType = cloudFile.mimeType;
        }
      } catch (cloudErr: any) {
        // If demo mode is enabled and doc is demo data, fall through to demo synthesis
        if (!isServerDemoModeEnabled() || (!doc.isDemonstrationData && !doc.id.startsWith('doc-demo-'))) {
          const err: any = new Error(
            `Document file not found in storage vault (${cloudErr.message || 'Cloud storage retrieval failed'}).`
          );
          err.statusCode = cloudErr.statusCode || 404;
          throw err;
        }
      }
    }

    // Fallback for local development/demo mode
    if (!buffer && isServerDemoModeEnabled()) {
      const safeBaseName = path.basename(effectiveStorageRef).replace(/[^a-zA-Z0-9._-]/g, '_');
      if (this.localDevStorageDir) {
        const filePath = path.join(this.localDevStorageDir, safeBaseName);
        if (fs.existsSync(filePath)) {
          buffer = fs.readFileSync(filePath);
        }
      }

      if (!buffer && (doc.isDemonstrationData || doc.id.startsWith('doc-demo-'))) {
        // Synthesize placeholder PDF for authorized demo documents
        buffer = Buffer.from(
          `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R>>endobj 4 0 obj<</Length 68>>stream\nBT /F1 12 Tf 72 712 Td (${doc.originalFileName || doc.id}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000214 00000 n\ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n333\n%%EOF`
        );
      }
    }

    if (!buffer) {
      const err: any = new Error('Document file not found in storage vault.');
      err.statusCode = 404;
      throw err;
    }

    // Volumetric boundary verification: max 15MB
    if (buffer.length > 15 * 1024 * 1024) {
      const err: any = new Error('Document Integrity Error: Stored file size exceeds the 15MB limit.');
      err.statusCode = 400;
      throw err;
    }

    // SHA-256 binary hash integrity verification
    if (doc.fileHash && typeof doc.fileHash === 'string' && doc.fileHash.trim().length > 0) {
      const calculatedHash = crypto.createHash('sha256').update(buffer).digest('hex');
      if (calculatedHash.toLowerCase() !== doc.fileHash.toLowerCase().trim()) {
        const err: any = new Error(
          'Document Integrity Error: Stored document binary SHA-256 hash mismatch. File may be corrupted or modified.'
        );
        err.statusCode = 500;
        throw err;
      }
    }

    return {
      buffer,
      mimeType,
    };
  }

  /**
   * Processes document extraction through server-side Gemini.
   * Authorizes against authoritative document & project ownership.
   * Uses authoritative stored binary from vault (browser-supplied base64 cannot override live stored file).
   */
  async extractDocument(params: {
    documentId: string;
    fileName?: string;
    mimeType?: string;
    declaredType?: DocumentType;
    storageReference?: string;
    base64Data?: string;
    projectContext?: any;
    authHeader?: string;
  }) {
    const {
      documentId,
      fileName,
      mimeType,
      declaredType,
      base64Data,
      authHeader,
    } = params;

    // 1. Authorize user session - Strictly restricted to authorized government officers
    const authResult = await verifyServerAuth(authHeader);
    const role = (authResult.role || '').toLowerCase();
    const isGov = role.includes('gov');

    if (!isGov) {
      const err: any = new Error(
        'Access Denied: Document extraction is restricted to authorized government personnel.'
      );
      err.statusCode = 403;
      throw err;
    }

    const token = extractToken(authHeader);

    // 2. Authoritative Document Resolution
    const doc = await getAuthoritativeDocument(documentId, token);
    if (!doc) {
      const err: any = new Error(
        `Authoritative Record Not Found: Document '${documentId}' does not exist in authoritative records.`
      );
      err.statusCode = 404;
      throw err;
    }

    // 3. Authoritative Project Resolution
    const project = await getAuthoritativeProject(doc.projectId, token);
    if (!project) {
      const err: any = new Error(
        `Access Denied: Project '${doc.projectId}' associated with this document was not found.`
      );
      err.statusCode = 404;
      throw err;
    }

    // 4. Authoritative Project Context (never trust browser-supplied context for authorization)
    const authoritativeProjectContext = {
      projectId: project.id,
      projectTitle: project.title,
      sanctionedAmount: project.sanctionedAmount,
      awardedAmount: project.awardedAmount,
      implementingAgencyName: project.implementingAgencyName || (project as any).agencyName,
      organizationId: project.organizationId,
    };

    // 5. Resolve Authoritative Document Binary from Vault
    let fileBase64: string = '';
    const effectiveStorageRef = doc.storageReference;

    if (effectiveStorageRef) {
      try {
        const fileData = await this.getDocumentFile({
          storageReference: effectiveStorageRef,
          documentId: doc.id,
          authHeader,
        });
        fileBase64 = fileData.buffer.toString('base64');
      } catch (readErr: any) {
        // The base64Data fallback must ONLY be allowed when isServerDemoModeEnabled() is true AND the document is explicit demonstration data
        if (isServerDemoModeEnabled() && doc.isDemonstrationData && base64Data) {
          fileBase64 = base64Data;
        } else {
          const err: any = new Error(
            `Document Extraction Error: Authoritative stored binary could not be retrieved from vault (${readErr.message || 'File not found'}).`
          );
          err.statusCode = readErr.statusCode || 404;
          throw err;
        }
      }
    } else if (isServerDemoModeEnabled() && doc.isDemonstrationData && base64Data) {
      fileBase64 = base64Data;
    } else {
      const err: any = new Error(
        'Document Extraction Error: Authoritative storage reference is missing for this document.'
      );
      err.statusCode = 400;
      throw err;
    }

    return this.extractionProvider.extractDocument({
      documentId: doc.id,
      fileName: doc.originalFileName || fileName || 'document.pdf',
      mimeType: doc.mimeType || mimeType || 'application/pdf',
      declaredType: doc.documentType || declaredType || 'OTHER_SUPPORTING_DOCUMENT',
      base64Data: fileBase64,
      projectContext: authoritativeProjectContext,
    });
  }
}
