// Bharat Tender Intelligence (BTI) — Supabase Storage Document Vault Service
// Phase 11: Production Document Persistence via Supabase Storage
// Private Document Vault Bucket ('documents') with Authoritative Project-Document Namespace Binding
// CRITICAL: Runs exclusively on the server using SUPABASE_SERVICE_ROLE_KEY.

import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  return url.trim().replace(/\/+$/, '');
}

export function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return key.trim();
}

export function getStorageBucket(): string {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'documents';
  return bucket.trim();
}

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getServiceRoleKey());
}

let cachedAdminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  const url = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase Storage Configuration Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured on the server.'
    );
  }

  cachedAdminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedAdminClient;
}

/**
 * Normalizes and validates supported document MIME types.
 * Normalizes 'image/jpg' -> 'image/jpeg', trims parameters/whitespace.
 * Returns strictly 'application/pdf' | 'image/png' | 'image/jpeg' | null.
 */
export function normalizeMimeType(
  mime?: string
): 'application/pdf' | 'image/png' | 'image/jpeg' | null {
  if (!mime || typeof mime !== 'string') return null;
  const clean = mime.trim().toLowerCase().split(';')[0].trim();
  if (clean === 'image/jpg' || clean === 'image/jpeg') {
    return 'image/jpeg';
  }
  if (clean === 'image/png') {
    return 'image/png';
  }
  if (clean === 'application/pdf') {
    return 'application/pdf';
  }
  return null;
}

/**
 * Inspects binary magic bytes / signatures to determine file format.
 * Strictly verifies authentic PDF, PNG, and JPEG documents.
 */
export function detectMimeTypeFromBuffer(
  buffer: Buffer
): 'application/pdf' | 'image/png' | 'image/jpeg' | null {
  if (!buffer || buffer.length < 4) return null;

  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG magic bytes: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  // PDF magic bytes: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
  // Per PDF ISO 32000-1 specification, %PDF- should appear within the first 1024 bytes
  const headerSlice = buffer.subarray(0, Math.min(buffer.length, 1024));
  if (headerSlice.includes(Buffer.from('%PDF-'))) {
    return 'application/pdf';
  }

  return null;
}

/**
 * Authoritatively validates and binds a storage reference to the canonical project and document ID.
 * Enforces:
 * 1. Belongs to the expected Supabase bucket ('documents' or configured bucket).
 * 2. Begins with canonical project-scoped path: documents/{projectId}/{documentId}_{fileName}
 * 3. Exact matching of projectId and documentId.
 * 4. Cannot escape the project/document namespace (strictly 2 path segments after bucket).
 * 5. Cannot contain path traversal ('..', '\', '\0', leading '/').
 * 6. Cannot reference another bucket.
 */
export function validateAndBindStorageReference(params: {
  storageReference: string;
  projectId: string;
  documentId: string;
}): {
  bucket: string;
  objectPath: string;
  storageReference: string;
  fileName: string;
} {
  const { storageReference, projectId, documentId } = params;

  if (!projectId || typeof projectId !== 'string') {
    throw new Error('Security Violation: Valid projectId is required for storage path binding.');
  }

  const cleanProjectId = projectId.trim();
  if (
    !cleanProjectId.match(/^[a-zA-Z0-9_\-]+$/) ||
    cleanProjectId.includes('..') ||
    cleanProjectId.includes('/') ||
    cleanProjectId.includes('\\')
  ) {
    throw new Error('Security Violation: Invalid or malformed projectId.');
  }

  if (!documentId || typeof documentId !== 'string' || !documentId.startsWith('doc-')) {
    throw new Error('Security Violation: Valid documentId starting with doc- is required for storage path binding.');
  }

  const cleanDocId = documentId.trim();
  if (
    !cleanDocId.match(/^doc-[a-zA-Z0-9_\-]+$/) ||
    cleanDocId.includes('..') ||
    cleanDocId.includes('/') ||
    cleanDocId.includes('\\')
  ) {
    throw new Error('Security Violation: Invalid or malformed documentId.');
  }

  if (!storageReference || typeof storageReference !== 'string') {
    throw new Error('Security Violation: Storage reference is required.');
  }

  const cleanRef = storageReference.trim().replace(/^\.?\/+/, '');
  if (
    cleanRef.includes('..') ||
    cleanRef.includes('\\') ||
    cleanRef.includes('\0') ||
    cleanRef.startsWith('/')
  ) {
    throw new Error('Security Violation: Path traversal or invalid characters detected in storage reference.');
  }

  const configuredBucket = getStorageBucket();

  // Strip leading bucket name if present (either 'documents/' or configured bucket)
  let objectPath = cleanRef;
  if (objectPath.startsWith('storage/documents/')) {
    objectPath = objectPath.substring('storage/documents/'.length);
  } else if (objectPath.startsWith(`${configuredBucket}/`)) {
    objectPath = objectPath.substring(`${configuredBucket}/`.length);
  } else if (objectPath.startsWith('documents/')) {
    objectPath = objectPath.substring('documents/'.length);
  } else {
    // If the storageReference has another bucket prefix, reject it
    if (objectPath.includes('/') && !objectPath.startsWith(`${cleanProjectId}/`)) {
      throw new Error('Security Violation: Storage reference belongs to an unauthorized bucket or namespace.');
    }
  }

  // Object path within bucket MUST be strictly `${cleanProjectId}/${cleanDocId}_${fileName}`
  const segments = objectPath.split('/');
  if (segments.length !== 2) {
    throw new Error('Security Violation: Storage reference namespace escape. Only project-scoped document files are allowed.');
  }

  const [pathProjectId, pathFileName] = segments;
  if (pathProjectId !== cleanProjectId) {
    throw new Error(`Security Violation: Storage reference project mismatch. Expected '${cleanProjectId}', received '${pathProjectId}'.`);
  }

  if (!pathFileName.startsWith(`${cleanDocId}_`)) {
    throw new Error(`Security Violation: Storage reference documentId mismatch. File must begin with '${cleanDocId}_'.`);
  }

  const rawFileName = pathFileName.substring(`${cleanDocId}_`.length);
  if (!rawFileName || !rawFileName.match(/^[a-zA-Z0-9._\-]+$/)) {
    throw new Error('Security Violation: Invalid characters in document filename.');
  }

  const canonicalStorageRef = `documents/${cleanProjectId}/${cleanDocId}_${rawFileName}`;

  return {
    bucket: configuredBucket,
    objectPath: `${cleanProjectId}/${pathFileName}`,
    storageReference: canonicalStorageRef,
    fileName: rawFileName,
  };
}

/**
 * Normalizes and validates a document storage reference.
 * Prevents path traversal, absolute paths, and null bytes.
 * Returns the target bucket, clean object path within the bucket, and canonical storageReference.
 */
export function normalizeStoragePath(ref: string): {
  bucket: string;
  objectPath: string;
  storageReference: string;
} {
  if (!ref || typeof ref !== 'string') {
    throw new Error('Security Violation: Storage reference path is required.');
  }

  const clean = ref.trim().replace(/^\.?\/+/, '');

  if (
    clean.includes('..') ||
    clean.includes('\\') ||
    clean.includes('\0') ||
    clean.startsWith('/')
  ) {
    throw new Error('Security Violation: Invalid storage reference path or path traversal detected.');
  }

  const bucket = getStorageBucket();

  // Strip leading bucket name or legacy Firebase prefix if present
  let objectPath = clean;
  if (objectPath.startsWith('storage/documents/')) {
    objectPath = objectPath.substring('storage/documents/'.length);
  } else if (objectPath.startsWith(`${bucket}/`)) {
    objectPath = objectPath.substring(`${bucket}/`.length);
  } else if (objectPath.startsWith('documents/')) {
    objectPath = objectPath.substring('documents/'.length);
  }

  const storageReference = `documents/${objectPath}`;

  return {
    bucket,
    objectPath,
    storageReference,
  };
}

/**
 * Generates an authorized signed upload URL for direct client-to-Supabase upload.
 * Uses provider-native Supabase signed upload token semantics (large binaries up to 15MB upload directly to Supabase Storage).
 * Note: Supabase signed upload URLs govern upload session tokens directly via Supabase Storage.
 */
export async function createSignedUploadUrl(params: {
  objectPath: string;
}): Promise<{
  uploadUrl: string;
  token: string;
  path: string;
  storageReference: string;
  bucket: string;
}> {
  const { objectPath } = params;
  const { bucket, objectPath: cleanPath, storageReference } = normalizeStoragePath(objectPath);
  const client = getSupabaseAdminClient();

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUploadUrl(cleanPath);

  if (error || !data) {
    throw new Error(
      `Supabase Storage Signed URL Error: ${error?.message || 'Failed to create signed upload URL.'}`
    );
  }

  let uploadUrl = data.signedUrl;
  if (uploadUrl.startsWith('/')) {
    const baseUrl = getSupabaseUrl();
    uploadUrl = `${baseUrl}/storage/v1${uploadUrl}`;
  }

  return {
    uploadUrl,
    token: data.token,
    path: data.path || cleanPath,
    storageReference,
    bucket,
  };
}

/**
 * Generates a short-lived signed download URL for private, authenticated document retrieval.
 * Enforces a strict 300-second expiration.
 * Returns only the signed URL without exposing credentials.
 */
export async function createSignedDownloadUrl(params: {
  objectPath: string;
  expiresInSeconds?: number;
}): Promise<{ signedUrl: string }> {
  const { objectPath, expiresInSeconds = 300 } = params;
  const { bucket, objectPath: cleanPath } = normalizeStoragePath(objectPath);
  const client = getSupabaseAdminClient();

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(cleanPath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    const err: any = new Error(
      `Supabase Storage Download URL Error: ${error?.message || 'Failed to create signed download URL.'}`
    );
    err.statusCode = (error as any)?.statusCode === 404 ? 404 : 500;
    throw err;
  }

  let signedUrl = data.signedUrl;
  if (signedUrl.startsWith('/')) {
    const baseUrl = getSupabaseUrl();
    signedUrl = `${baseUrl}/storage/v1${signedUrl}`;
  }

  return { signedUrl };
}

/**
 * Checks whether an object exists in the private Supabase Storage bucket.
 */
export async function checkSupabaseStorageObjectExists(objectPath: string): Promise<boolean> {
  if (!isSupabaseStorageConfigured()) {
    return false;
  }

  try {
    const { bucket, objectPath: cleanPath } = normalizeStoragePath(objectPath);
    const client = getSupabaseAdminClient();

    const lastSlash = cleanPath.lastIndexOf('/');
    const folder = lastSlash >= 0 ? cleanPath.substring(0, lastSlash) : '';
    const filename = lastSlash >= 0 ? cleanPath.substring(lastSlash + 1) : cleanPath;

    const { data, error } = await client.storage.from(bucket).list(folder, {
      search: filename,
      limit: 10,
    });

    if (error || !data) {
      return false;
    }

    return data.some((item) => item.name === filename);
  } catch {
    return false;
  }
}

/**
 * Downloads a document binary from the private Supabase Storage bucket.
 * Used for server-side volumetric verification, SHA-256 integrity check, and Gemini Document Intelligence.
 */
export async function downloadFromSupabaseStorage(
  objectPath: string
): Promise<{ buffer: Buffer; mimeType?: string }> {
  const { bucket, objectPath: cleanPath } = normalizeStoragePath(objectPath);
  const client = getSupabaseAdminClient();

  const { data, error } = await client.storage.from(bucket).download(cleanPath);

  if (error || !data) {
    const err: any = new Error(
      `Supabase Storage Download Failed: ${error?.message || 'Document file not found in storage vault.'}`
    );
    err.statusCode = (error as any)?.statusCode === 404 ? 404 : 500;
    throw err;
  }

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = data.type || undefined;

  return {
    buffer,
    mimeType,
  };
}

/**
 * Uploads a document binary directly to Supabase Storage (server-side upload for small files / demo).
 */
export async function uploadToSupabaseStorage(params: {
  objectPath: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<{ success: boolean; objectPath: string }> {
  const { objectPath, buffer, mimeType } = params;
  const { bucket, objectPath: cleanPath } = normalizeStoragePath(objectPath);
  const client = getSupabaseAdminClient();

  const { error } = await client.storage
    .from(bucket)
    .upload(cleanPath, buffer, {
      contentType: mimeType || 'application/pdf',
      upsert: false,
    });

  if (error) {
    if (
      (error as any)?.statusCode === '409' ||
      error.message?.includes('already exists') ||
      (error as any)?.error === 'Duplicate'
    ) {
      const err: any = new Error(
        `Conflict: Document file '${path.basename(cleanPath)}' already exists in the storage vault.`
      );
      err.statusCode = 409;
      throw err;
    }
    throw new Error(`Supabase Storage Upload Failed: ${error.message}`);
  }

  return { success: true, objectPath: cleanPath };
}

/**
 * Deletes an object from Supabase Storage (narrowly scoped for orphan cleanup / rollback).
 */
export async function deleteFromSupabaseStorage(objectPath: string): Promise<boolean> {
  try {
    const { bucket, objectPath: cleanPath } = normalizeStoragePath(objectPath);
    const client = getSupabaseAdminClient();
    const { error } = await client.storage.from(bucket).remove([cleanPath]);
    if (error) {
      console.warn('[SupabaseStorage] Delete warning:', error);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Deletes orphan objects strictly prefixed by {projectId}/{documentId}_.
 * Guarantees that only objects belonging to the specific project and uncommitted document are deleted.
 */
export async function deleteOrphanObjectsByPrefix(params: {
  projectId: string;
  documentId: string;
}): Promise<{ deletedCount: number }> {
  const { projectId, documentId } = params;

  if (!projectId || !documentId || !documentId.startsWith('doc-')) {
    throw new Error('Security Violation: Invalid orphan cleanup parameters.');
  }

  const cleanProjectId = projectId.trim().replace(/^\.?\/+/, '');
  const cleanDocId = documentId.trim();

  if (
    cleanProjectId.includes('..') ||
    cleanProjectId.includes('\\') ||
    cleanProjectId.includes('\0') ||
    cleanDocId.includes('..') ||
    cleanDocId.includes('/') ||
    cleanDocId.includes('\\') ||
    cleanDocId.includes('\0')
  ) {
    throw new Error('Security Violation: Malformed cleanup parameters or path traversal.');
  }

  if (!isSupabaseStorageConfigured()) {
    return { deletedCount: 0 };
  }

  try {
    const client = getSupabaseAdminClient();
    const bucket = getStorageBucket();

    const { data: files, error } = await client.storage.from(bucket).list(cleanProjectId, {
      search: cleanDocId,
    });

    if (error || !files || files.length === 0) {
      return { deletedCount: 0 };
    }

    const filesToDelete = files
      .filter((f) => f.name.startsWith(`${cleanDocId}_`) || f.name === cleanDocId)
      .map((f) => `${cleanProjectId}/${f.name}`);

    if (filesToDelete.length === 0) {
      return { deletedCount: 0 };
    }

    const { data: removed, error: removeErr } = await client.storage
      .from(bucket)
      .remove(filesToDelete);

    if (removeErr) {
      console.warn('[SupabaseStorage] Orphan cleanup error:', removeErr);
      return { deletedCount: 0 };
    }

    return { deletedCount: removed?.length || filesToDelete.length };
  } catch (err) {
    console.warn('[SupabaseStorage] Orphan cleanup failure:', err);
    return { deletedCount: 0 };
  }
}
