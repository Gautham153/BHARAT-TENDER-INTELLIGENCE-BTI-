// Bharat Tender Intelligence (BTI) — Document Intelligence Server Service
// Phase 11: Server-Side Ingestion, Supabase Storage Vault Persistence & Extraction Orchestration
// Production Document Persistence with Supabase Storage Private Bucket ('documents')
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
  createSignedUploadUrl,
  createSignedDownloadUrl,
  checkSupabaseStorageObjectExists,
  downloadFromSupabaseStorage,
  uploadToSupabaseStorage,
  deleteFromSupabaseStorage,
  deleteOrphanObjectsByPrefix,
  isSupabaseStorageConfigured,
  normalizeStoragePath,
  validateAndBindStorageReference,
  detectMimeTypeFromBuffer,
  normalizeMimeType,
  getStorageBucket,
} from './supabaseStorageService.js';

function extractToken(authHeader?: string): string | undefined {
  if (!authHeader) return undefined;
  if (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer ')) {
    return authHeader.substring(7).trim();
  }
  return authHeader.trim();
}

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']);

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
   * Generates an authorized Supabase Storage signed upload URL.
   * Authorizes caller (government or awarded agency) before granting direct binary upload permissions.
   * Large document binaries (> 4.5MB, up to 15MB) are uploaded directly to Supabase Storage by the browser.
   * Uses provider-native Supabase upload token semantics (no artificial 300s claim for uploads).
   */
  async requestUploadUrl(params: {
    documentId: string;
    projectId: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    fileHash?: string;
    authHeader?: string;
  }): Promise<{
    uploadUrl: string;
    token: string;
    storageReference: string;
    storagePath: string;
    bucket: string;
  }> {
    const { documentId, projectId, fileName, mimeType, fileSize, authHeader } = params;

    // 1. MIME type validation
    const normalizedMime = (mimeType || '').trim().toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
      const err: any = new Error(
        'Invalid Request: Unsupported document format. Only PDF, PNG, and JPEG documents are supported.'
      );
      err.statusCode = 400;
      throw err;
    }

    // 2. Volumetric boundary: max 15MB
    if (!fileSize || fileSize <= 0 || fileSize > 15 * 1024 * 1024) {
      const err: any = new Error(
        'Invalid Request: Document file size must be greater than 0 and not exceed 15MB.'
      );
      err.statusCode = 400;
      throw err;
    }

    // 3. Document ID validation
    if (!documentId || typeof documentId !== 'string' || !documentId.startsWith('doc-')) {
      const err: any = new Error('Invalid Request: Valid documentId starting with doc- is required.');
      err.statusCode = 400;
      throw err;
    }

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

    // 4. Authorize user session
    const authResult = await verifyServerAuth(authHeader);
    const role = (authResult.role || '').toLowerCase();
    const isGov = role.includes('gov');
    const isAgency = role.includes('agency');

    if (!isGov && !isAgency) {
      const err: any = new Error(
        'Access Denied: Document upload is restricted to authorized government and agency personnel.'
      );
      err.statusCode = 403;
      throw err;
    }

    const token = extractToken(authHeader);

    // 5. Authoritative Document Existence Check
    const existingDoc = await getAuthoritativeDocument(documentId, token);
    if (existingDoc) {
      const err: any = new Error(
        `Conflict: Document ID '${documentId}' already exists in authoritative records. Overwriting stored documents is prohibited.`
      );
      err.statusCode = 409;
      throw err;
    }

    // 6. Verify referenced project exists and belongs to the agency
    const targetProjectId = projectId?.trim();
    if (!targetProjectId) {
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

    // Agency authorization on project
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
    const storagePath = `${project.id}/${safeName}`;
    const expectedStorageRef = `documents/${storagePath}`;
    const authoritativeBucket = getStorageBucket();

    // Generate Supabase Storage signed upload URL
    if (isSupabaseStorageConfigured()) {
      const signedUpload = await createSignedUploadUrl({
        objectPath: storagePath,
      });

      return {
        uploadUrl: signedUpload.uploadUrl,
        token: signedUpload.token,
        storageReference: expectedStorageRef,
        storagePath,
        bucket: signedUpload.bucket || authoritativeBucket,
      };
    } else if (isServerDemoModeEnabled()) {
      // In offline demo mode without Supabase credentials, return local fallback target
      return {
        uploadUrl: `/api/data?action=document-upload&fallback=local`,
        token: `demo-token-${documentId}`,
        storageReference: expectedStorageRef,
        storagePath,
        bucket: authoritativeBucket,
      };
    } else {
      const err: any = new Error(
        'Server Configuration Error: Supabase Storage is not configured for production document persistence.'
      );
      err.statusCode = 500;
      throw err;
    }
  }

  /**
   * Securely saves/verifies document binary in the persistent Supabase Storage document vault.
   * FIX 1B: Validates storageReference against canonical project and document ID binding.
   * FIX 2: Returns server-verified fileSize as authoritative measurement.
   * FIX 3: Validates file signature/magic bytes and strictly compares with declared MIME type.
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
  }): Promise<{ storageReference: string; fileHash: string; fileSize: number; mimeType: string }> {
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
    const expectedStorageRef = `documents/${project.id}/${safeName}`;

    // CASE A: Client performed direct cloud storage upload to Supabase (preferred for files up to 15MB)
    if (suppliedStorageRef && !bufferOrBase64) {
      // FIX 1B: Authoritatively validate and bind storageReference to canonical project and document ID
      const binding = validateAndBindStorageReference({
        storageReference: suppliedStorageRef,
        projectId: project.id,
        documentId,
      });

      const { storageReference: cleanSuppliedRef, objectPath } = binding;

      // Verify object exists in Supabase Storage vault
      if (isSupabaseStorageConfigured()) {
        const existsInVault = await checkSupabaseStorageObjectExists(objectPath);
        if (!existsInVault) {
          const err: any = new Error(
            'Document Storage Error: Uploaded binary not found in storage vault.'
          );
          err.statusCode = 404;
          throw err;
        }

        // Verify volumetric boundary & compute authoritative SHA-256 hash
        const cloudFile = await downloadFromSupabaseStorage(objectPath);

        if (!cloudFile.buffer || cloudFile.buffer.length === 0) {
          const err: any = new Error('Document Integrity Error: Stored document binary is empty.');
          err.statusCode = 400;
          throw err;
        }

        if (cloudFile.buffer.length > 15 * 1024 * 1024) {
          const err: any = new Error('Document Integrity Error: Stored binary exceeds the 15MB limit.');
          err.statusCode = 400;
          throw err;
        }

        // Authoritative 3-Way MIME Verification (Declared, Detected Magic Bytes, and Supabase Object Content-Type)
        const detectedMime = detectMimeTypeFromBuffer(cloudFile.buffer);
        const normalizedDetectedMime = normalizeMimeType(detectedMime || undefined);
        if (!normalizedDetectedMime) {
          const err: any = new Error(
            'Document Content Error: File binary magic bytes do not match supported document types (PDF, PNG, JPEG).'
          );
          err.statusCode = 415;
          throw err;
        }

        const supabaseObjectMime = cloudFile.mimeType;
        const normalizedSupabaseObjectMime = normalizeMimeType(supabaseObjectMime);
        if (!supabaseObjectMime || !normalizedSupabaseObjectMime) {
          const err: any = new Error(
            'Document Content Error: Supabase Storage object Content-Type is missing or unsupported.'
          );
          err.statusCode = 415;
          throw err;
        }

        const normalizedDeclaredMime = normalizeMimeType(mimeType);
        if (!normalizedDeclaredMime) {
          const err: any = new Error(
            'Document Content Error: Declared document MIME type is unsupported. Only PDF, PNG, and JPEG are supported.'
          );
          err.statusCode = 415;
          throw err;
        }

        if (
          normalizedDeclaredMime !== normalizedDetectedMime ||
          normalizedDetectedMime !== normalizedSupabaseObjectMime
        ) {
          const err: any = new Error(
            `Document Content Error: Three-way MIME type mismatch. Declared: '${normalizedDeclaredMime}', Binary Detected: '${normalizedDetectedMime}', Supabase Vault: '${normalizedSupabaseObjectMime}'. All three must agree.`
          );
          err.statusCode = 415;
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

        // Return authoritative verified fileSize and verified mimeType
        return {
          storageReference: cleanSuppliedRef,
          fileHash: calculatedHash,
          fileSize: cloudFile.buffer.length,
          mimeType: normalizedDetectedMime,
        };
      } else if (isServerDemoModeEnabled()) {
        // Fallback for demo mode
        const normalizedDeclaredMime = normalizedMime === 'image/jpg' ? 'image/jpeg' : normalizedMime;
        return {
          storageReference: cleanSuppliedRef,
          fileHash: suppliedFileHash || crypto.createHash('sha256').update(Buffer.from(documentId)).digest('hex'),
          fileSize: suppliedFileSize || 1024,
          mimeType: normalizedDeclaredMime,
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
    if (!buffer || buffer.length === 0) {
      const err: any = new Error('File is empty.');
      err.statusCode = 400;
      throw err;
    }

    if (buffer.length > 15 * 1024 * 1024) {
      const err: any = new Error('File size exceeds the 15MB limit.');
      err.statusCode = 400;
      throw err;
    }

    // FIX 3: Inspect binary magic bytes
    const detectedMime = detectMimeTypeFromBuffer(buffer);
    if (!detectedMime) {
      const err: any = new Error(
        'Document Content Error: File binary magic bytes do not match supported document types (PDF, PNG, JPEG).'
      );
      err.statusCode = 415;
      throw err;
    }

    const normalizedDeclaredMime = normalizedMime === 'image/jpg' ? 'image/jpeg' : normalizedMime;
    if (detectedMime !== normalizedDeclaredMime) {
      const err: any = new Error(
        `Document Content Error: Content type mismatch. Declared MIME type '${normalizedMime}' does not match detected file format '${detectedMime}'.`
      );
      err.statusCode = 415;
      throw err;
    }

    const storageReference = expectedStorageRef;
    const objectPath = `${project.id}/${safeName}`;
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Persist binary to Supabase Storage (or local dev storage strictly in demo mode)
    if (isSupabaseStorageConfigured()) {
      const alreadyInCloud = await checkSupabaseStorageObjectExists(objectPath);
      if (alreadyInCloud) {
        const err: any = new Error(
          `Conflict: Document file '${safeName}' already exists in the storage vault.`
        );
        err.statusCode = 409;
        throw err;
      }

      await uploadToSupabaseStorage({
        objectPath,
        buffer,
        mimeType: detectedMime,
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
        'Server Configuration Error: Supabase Storage is not configured for production document persistence.'
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
        mimeType: detectedMime,
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
      mimeType: detectedMime,
    };
  }

  /**
   * Generates a short-lived signed download URL for private, authenticated document access.
   * FIX 1B: Validates storageReference against canonical project and document ID binding.
   * Strictly enforces project and document access authorization.
   * Short-lived 300-second expiration is preserved.
   */
  async getDocumentDownloadUrl(params: {
    storageReference?: string;
    documentId?: string;
    authHeader?: string;
  }): Promise<{ downloadUrl: string; fileName: string; mimeType: string }> {
    const { storageReference, documentId, authHeader } = params;

    // 1. Authorize user session
    const authResult = await verifyServerAuth(authHeader);
    const role = (authResult.role || '').toLowerCase();
    const isGov = role.includes('gov');
    const isAgency = role.includes('agency');

    if (!isGov && !isAgency) {
      const err: any = new Error('Access Denied: Document access is restricted to authorized personnel.');
      err.statusCode = 403;
      throw err;
    }

    const token = extractToken(authHeader);

    // 2. Authoritative Document Resolution
    let doc: any = null;
    if (documentId) {
      doc = await getAuthoritativeDocument(documentId, token);
    } else if (storageReference) {
      doc = await getAuthoritativeDocumentByStorageRef(storageReference, token);
    }

    if (!doc) {
      const err: any = new Error(
        `Authoritative Record Not Found: Document was not found in authoritative records.`
      );
      err.statusCode = 404;
      throw err;
    }

    // 3. Authoritative Project Resolution & Agency Access Boundary
    const project = await getAuthoritativeProject(doc.projectId, token);
    if (!project) {
      const err: any = new Error(
        `Access Denied: Project '${doc.projectId}' associated with this document was not found.`
      );
      err.statusCode = 404;
      throw err;
    }

    if (isAgency && !isGov) {
      const agencyOrgId = authResult.organizationId;
      if (!agencyOrgId || !project.organizationId || project.organizationId !== agencyOrgId) {
        const err: any = new Error(
          'Access Denied: You are not authorized to access documents for this project.'
        );
        err.statusCode = 403;
        throw err;
      }
    }

    const effectiveStorageRef = doc.storageReference;
    if (!effectiveStorageRef) {
      const err: any = new Error('Document file storage reference is missing in authoritative records.');
      err.statusCode = 404;
      throw err;
    }

    // FIX 1B: Authoritatively validate storageReference path binding before generating download URL
    const binding = validateAndBindStorageReference({
      storageReference: effectiveStorageRef,
      projectId: project.id,
      documentId: doc.id,
    });

    // 4. Generate short-lived signed URL (300 seconds) via Supabase Storage
    if (isSupabaseStorageConfigured()) {
      const { signedUrl } = await createSignedDownloadUrl({
        objectPath: binding.objectPath,
        expiresInSeconds: 300,
      });

      return {
        downloadUrl: signedUrl,
        fileName: doc.originalFileName || path.basename(binding.objectPath),
        mimeType: doc.mimeType || 'application/pdf',
      };
    } else if (isServerDemoModeEnabled()) {
      // In demo mode without Supabase credentials, return local download route
      return {
        downloadUrl: `/api/data?action=document-download&documentId=${encodeURIComponent(doc.id)}&format=binary`,
        fileName: doc.originalFileName || 'document.pdf',
        mimeType: doc.mimeType || 'application/pdf',
      };
    } else {
      const err: any = new Error(
        'Server Configuration Error: Supabase Storage is not configured for document access.'
      );
      err.statusCode = 500;
      throw err;
    }
  }

  /**
   * Cleans up an orphaned vault binary when subsequent Firestore metadata registration fails.
   * FIX 1B: Validates storageReference against canonical project and document ID binding.
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
      const err: any = new Error('Invalid Request: Valid documentId starting with doc- is required.');
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

    // 4. Delete orphan Supabase storage object(s) strictly prefixed by `{project.id}/{documentId}_`
    let cleaned = false;

    if (isSupabaseStorageConfigured()) {
      if (storageReference) {
        try {
          const binding = validateAndBindStorageReference({
            storageReference,
            projectId: project.id,
            documentId,
          });
          const directDeleted = await deleteFromSupabaseStorage(binding.objectPath);
          if (directDeleted) cleaned = true;
        } catch (bindErr) {
          console.warn('[DocumentIntelligenceServerService] Storage ref binding check during cleanup:', bindErr);
        }
      }

      const prefixResult = await deleteOrphanObjectsByPrefix({
        projectId: project.id,
        documentId,
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
   * Reads stored document binary from the persistent Supabase Storage vault.
   * FIX 1B: Validates storageReference against canonical project and document ID binding.
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

      if (storageReference) {
        const normSupplied = normalizeStoragePath(storageReference).storageReference;
        const normDocRef = normalizeStoragePath(doc.storageReference || '').storageReference;
        if (normSupplied !== normDocRef && path.basename(normSupplied) !== path.basename(normDocRef)) {
          const err: any = new Error(
            'Invalid Request: Supplied storage reference does not match authoritative document record.'
          );
          err.statusCode = 400;
          throw err;
        }
      }

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

    // FIX 1B: Authoritatively validate storageReference path binding
    const binding = validateAndBindStorageReference({
      storageReference: effectiveStorageRef,
      projectId: project.id,
      documentId: doc.id,
    });

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

    // 5. Read file safely from persistent Supabase Storage vault (or local fallback in demo mode)
    let buffer: Buffer | null = null;
    let mimeType = doc.mimeType || 'application/pdf';

    if (isSupabaseStorageConfigured()) {
      try {
        const cloudFile = await downloadFromSupabaseStorage(binding.objectPath);
        buffer = cloudFile.buffer;
        if (cloudFile.mimeType) {
          mimeType = cloudFile.mimeType;
        }
      } catch (cloudErr: any) {
        if (!isServerDemoModeEnabled() || (!doc.isDemonstrationData && !doc.id.startsWith('doc-demo-'))) {
          const err: any = new Error(
            `Document file not found in storage vault (${cloudErr.message || 'Storage retrieval failed'}).`
          );
          err.statusCode = cloudErr.statusCode || 404;
          throw err;
        }
      }
    }

    // Fallback for local development/demo mode
    if (!buffer && isServerDemoModeEnabled()) {
      const safeBaseName = path.basename(binding.objectPath).replace(/[^a-zA-Z0-9._-]/g, '_');
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
   * Uses authoritative stored binary from Supabase Storage vault (browser-supplied base64 cannot override live stored file).
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

    // 4. Authoritative Project Context
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
