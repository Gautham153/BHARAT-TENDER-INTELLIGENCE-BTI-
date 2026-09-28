// Bharat Tender Intelligence (BTI) — Cloud Storage Document Vault Service
// Phase 11: Production Firebase / Google Cloud Storage Document Persistence
// Replaces ephemeral local filesystem storage with persistent cloud object storage for serverless deployment.

import { getServerFirestoreAccessToken } from '../evaluation/authoritativeDataService.js';

export function getStorageBucket(): string {
  let bucket =
    process.env.VITE_FIREBASE_STORAGE_BUCKET ||
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.STORAGE_BUCKET ||
    '';

  bucket = bucket.trim();
  if (bucket.startsWith('gs://')) {
    bucket = bucket.substring(5).replace(/\/+$/, '');
  }

  if (!bucket) {
    const projectId =
      process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '';
    if (projectId.trim()) {
      bucket = `${projectId.trim()}.appspot.com`;
    }
  }

  return bucket;
}

export function isCloudStorageConfigured(): boolean {
  const bucket = getStorageBucket();
  const projectId =
    process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '';
  return Boolean(bucket && projectId);
}

export function normalizeStorageReference(ref: string): string {
  return ref.trim().replace(/^\.?\/+/, '');
}

/**
 * Uploads a document binary to Google Cloud Storage / Firebase Storage.
 */
export async function uploadToCloudStorage(params: {
  objectPath: string;
  buffer: Buffer;
  mimeType: string;
  userToken?: string;
}): Promise<{ success: boolean; objectPath: string }> {
  const { objectPath, buffer, mimeType, userToken } = params;
  const bucket = getStorageBucket();

  if (!bucket) {
    throw new Error('Cloud Storage Error: Storage bucket is not configured.');
  }

  const cleanPath = normalizeStorageReference(objectPath);
  const serverToken = await getServerFirestoreAccessToken();
  const effectiveToken = serverToken || userToken;

  const headers: Record<string, string> = {
    'Content-Type': mimeType || 'application/pdf',
  };
  if (effectiveToken) {
    headers['Authorization'] = `Bearer ${effectiveToken.trim()}`;
  }

  // 1. Primary: Google Cloud Storage JSON REST API
  const gcsUrl = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(cleanPath)}`;
  let uploadRes = await fetch(gcsUrl, {
    method: 'POST',
    headers,
    body: buffer,
  });

  // 2. Fallback: Firebase Storage REST API if GCS bucket upload gives non-200
  if (!uploadRes.ok && uploadRes.status !== 409) {
    const fbUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?name=${encodeURIComponent(cleanPath)}`;
    const fbRes = await fetch(fbUrl, {
      method: 'POST',
      headers,
      body: buffer,
    });
    if (fbRes.ok) {
      return { success: true, objectPath: cleanPath };
    }
  }

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '');
    throw new Error(
      `Cloud Storage Upload Failed (${uploadRes.status}): ${errText || 'Unable to store document binary in cloud vault.'}`
    );
  }

  return { success: true, objectPath: cleanPath };
}

/**
 * Checks whether an object exists in Cloud Storage.
 */
export async function checkCloudStorageObjectExists(
  objectPath: string,
  userToken?: string
): Promise<boolean> {
  const bucket = getStorageBucket();
  if (!bucket) return false;

  const cleanPath = normalizeStorageReference(objectPath);
  const serverToken = await getServerFirestoreAccessToken();
  const effectiveToken = serverToken || userToken;

  const headers: Record<string, string> = {};
  if (effectiveToken) {
    headers['Authorization'] = `Bearer ${effectiveToken.trim()}`;
  }

  const gcsUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(cleanPath)}`;
  try {
    const res = await fetch(gcsUrl, { method: 'GET', headers });
    if (res.ok) return true;

    // Check Firebase Storage REST
    const fbUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(cleanPath)}`;
    const fbRes = await fetch(fbUrl, { method: 'GET', headers });
    return fbRes.ok;
  } catch {
    return false;
  }
}

/**
 * Downloads a document binary from Google Cloud Storage / Firebase Storage.
 */
export async function downloadFromCloudStorage(params: {
  objectPath: string;
  userToken?: string;
}): Promise<{ buffer: Buffer; mimeType?: string }> {
  const { objectPath, userToken } = params;
  const bucket = getStorageBucket();

  if (!bucket) {
    throw new Error('Cloud Storage Error: Storage bucket is not configured.');
  }

  const cleanPath = normalizeStorageReference(objectPath);
  const serverToken = await getServerFirestoreAccessToken();
  const effectiveToken = serverToken || userToken;

  const headers: Record<string, string> = {};
  if (effectiveToken) {
    headers['Authorization'] = `Bearer ${effectiveToken.trim()}`;
  }

  // 1. Primary: Google Cloud Storage JSON REST API
  const gcsUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(cleanPath)}?alt=media`;
  let res = await fetch(gcsUrl, { method: 'GET', headers });

  // 2. Fallback: Firebase Storage REST API
  if (!res.ok) {
    const fbUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(cleanPath)}?alt=media`;
    const fbRes = await fetch(fbUrl, { method: 'GET', headers });
    if (fbRes.ok) {
      res = fbRes;
    }
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err: any = new Error(
      `Cloud Storage Download Failed (${res.status}): Document file not found in storage vault.`
    );
    err.statusCode = res.status === 404 ? 404 : 500;
    throw err;
  }

  const arrayBuf = await res.arrayBuffer();
  const mimeType = res.headers.get('content-type') || undefined;

  return {
    buffer: Buffer.from(arrayBuf),
    mimeType,
  };
}

/**
 * Deletes an object from Cloud Storage (narrowly scoped for orphan cleanup).
 */
export async function deleteFromCloudStorage(params: {
  objectPath: string;
  userToken?: string;
}): Promise<boolean> {
  const { objectPath, userToken } = params;
  const bucket = getStorageBucket();
  if (!bucket) return false;

  const cleanPath = normalizeStorageReference(objectPath);
  if (
    !cleanPath.startsWith('storage/documents/') ||
    cleanPath.includes('..') ||
    cleanPath.includes('\\') ||
    cleanPath.includes('\0')
  ) {
    throw new Error('Security Violation: Invalid cleanup object path.');
  }

  const serverToken = await getServerFirestoreAccessToken();
  const effectiveToken = serverToken || userToken;

  const headers: Record<string, string> = {};
  if (effectiveToken) {
    headers['Authorization'] = `Bearer ${effectiveToken.trim()}`;
  }

  const gcsUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(cleanPath)}`;
  try {
    const res = await fetch(gcsUrl, { method: 'DELETE', headers });
    if (res.ok || res.status === 404) return true;

    // Fallback: Firebase Storage REST
    const fbUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(cleanPath)}`;
    const fbRes = await fetch(fbUrl, { method: 'DELETE', headers });
    return fbRes.ok || fbRes.status === 404;
  } catch {
    return false;
  }
}

/**
 * Deletes orphan objects by documentId prefix (narrowly scoped to storage/documents/{projectId}/doc-*).
 */
export async function deleteOrphanObjectsByPrefix(params: {
  prefix: string;
  userToken?: string;
}): Promise<{ deletedCount: number }> {
  const { prefix, userToken } = params;
  const bucket = getStorageBucket();
  if (!bucket) return { deletedCount: 0 };

  const cleanPrefix = normalizeStorageReference(prefix);
  // Ensure the prefix starts strictly with 'storage/documents/' and contains no path traversal
  if (
    !cleanPrefix.startsWith('storage/documents/') ||
    cleanPrefix.includes('..') ||
    cleanPrefix.includes('\\') ||
    cleanPrefix.includes('\0')
  ) {
    throw new Error('Security Violation: Invalid cleanup prefix.');
  }

  const serverToken = await getServerFirestoreAccessToken();
  const effectiveToken = serverToken || userToken;

  const headers: Record<string, string> = {};
  if (effectiveToken) {
    headers['Authorization'] = `Bearer ${effectiveToken.trim()}`;
  }

  let deletedCount = 0;

  // List matching objects via GCS JSON REST API
  try {
    const listUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?prefix=${encodeURIComponent(cleanPrefix)}`;
    const listRes = await fetch(listUrl, { method: 'GET', headers });
    if (listRes.ok) {
      const listData = await listRes.json();
      const items = listData?.items || [];
      for (const item of items) {
        const itemName = item?.name;
        if (itemName && typeof itemName === 'string' && itemName.startsWith(cleanPrefix)) {
          const delRes = await fetch(
            `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(itemName)}`,
            { method: 'DELETE', headers }
          );
          if (delRes.ok || delRes.status === 404) {
            deletedCount++;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[CloudStorage] Prefix delete warning:', err);
  }

  return { deletedCount };
}

