// Bharat Tender Intelligence (BTI) — Document Intelligence Server Service
// Phase 11: Server-Side Ingestion, Secure Vault Storage & Extraction Orchestration
// Enhanced with Authoritative Resource-Level Authorization (Project & Organization Boundaries)

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

function extractToken(authHeader?: string): string | undefined {
  if (!authHeader) return undefined;
  if (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer ')) {
    return authHeader.substring(7).trim();
  }
  return authHeader.trim();
}

export class DocumentIntelligenceServerService {
  private extractionProvider: GeminiDocumentExtractionProvider;
  private storageDir: string;

  constructor() {
    this.extractionProvider = new GeminiDocumentExtractionProvider();
    this.storageDir = path.join(process.cwd(), 'storage', 'documents');
    if (!fs.existsSync(this.storageDir)) {
      try {
        fs.mkdirSync(this.storageDir, { recursive: true });
      } catch (err) {
        console.warn('[DocumentIntelligenceServerService] Warning creating storage dir:', err);
      }
    }
  }

  /**
   * Securely saves document binary to the private server vault.
   * Computes SHA-256 hash for provenance and duplicate detection.
   * Authorizes against authoritative project ownership.
   * Rejects overwriting existing authoritative documents with HTTP 409.
   */
  async storeDocumentFile(params: {
    documentId: string;
    projectId?: string;
    fileName: string;
    mimeType: string;
    bufferOrBase64: string | Buffer;
    authHeader?: string;
  }): Promise<{ storageReference: string; fileHash: string; fileSize: number }> {
    const { documentId, projectId, fileName, mimeType, bufferOrBase64, authHeader } = params;

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

    // 4. Validate binary & volumetric boundaries
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

    // Secure sanitized filename
    const safeName = `${documentId}_${path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(this.storageDir, safeName);
    if (fs.existsSync(filePath)) {
      const err: any = new Error(
        `Conflict: Document file '${safeName}' already exists in the storage vault.`
      );
      err.statusCode = 409;
      throw err;
    }

    // SHA-256 hash
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    fs.writeFileSync(filePath, buffer);

    const storageReference = `storage/documents/${safeName}`;

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
        mimeType: mimeType || 'application/pdf',
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
    authHeader?: string;
  }): Promise<{ success: boolean; cleaned: boolean }> {
    const { documentId, projectId, authHeader } = params;

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

    // 4. Find matching orphan vault file specifically prefixed by `${documentId}_`
    let cleaned = false;
    if (fs.existsSync(this.storageDir)) {
      const files = fs.readdirSync(this.storageDir);
      for (const f of files) {
        if (f.startsWith(`${documentId}_`)) {
          const filePath = path.join(this.storageDir, f);
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
   * Reads stored document binary from the vault.
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
        const normSupplied = storageReference.trim().replace(/^\.?\//, '');
        const normDocRef = (doc.storageReference || '').trim().replace(/^\.?\//, '');
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

    // 5. Read file safely from storage vault
    const safeBaseName = path.basename(effectiveStorageRef).replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(this.storageDir, safeBaseName);

    if (!fs.existsSync(filePath)) {
      // In demo mode ONLY, synthesize placeholder PDF for authorized demo documents if not yet on disk
      if (isServerDemoModeEnabled() && (doc.isDemonstrationData || doc.id.startsWith('doc-demo-'))) {
        const samplePdfContent = Buffer.from(
          `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R>>endobj 4 0 obj<</Length 68>>stream\nBT /F1 12 Tf 72 712 Td (${doc.originalFileName || doc.id}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000214 00000 n\ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n333\n%%EOF`
        );
        try {
          fs.writeFileSync(filePath, samplePdfContent);
        } catch {
          // ignore
        }
        return {
          buffer: samplePdfContent,
          mimeType: doc.mimeType || 'application/pdf',
        };
      }

      const err: any = new Error('Document file not found in storage vault.');
      err.statusCode = 404;
      throw err;
    }

    const buffer = fs.readFileSync(filePath);

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
          `Document Integrity Error: Stored document binary SHA-256 hash mismatch. File may be corrupted or modified.`
        );
        err.statusCode = 500;
        throw err;
      }
    }

    return {
      buffer,
      mimeType: doc.mimeType || (safeBaseName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'),
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

    // 6. Resolve Authoritative Document Binary from Vault
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
