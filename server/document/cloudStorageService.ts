// Bharat Tender Intelligence (BTI) — Cloud Storage Document Vault Service
// Phase 11: Production Document Persistence via Supabase Storage
// Re-exports Supabase Storage operations to preserve compatibility with existing callers.

export {
  getStorageBucket,
  isSupabaseStorageConfigured as isCloudStorageConfigured,
  normalizeStoragePath as normalizeStorageReference,
  validateAndBindStorageReference,
  detectMimeTypeFromBuffer,
  createSignedUploadUrl,
  createSignedDownloadUrl,
  checkSupabaseStorageObjectExists as checkCloudStorageObjectExists,
  downloadFromSupabaseStorage as downloadFromCloudStorage,
  uploadToSupabaseStorage as uploadToCloudStorage,
  deleteFromSupabaseStorage as deleteFromCloudStorage,
  deleteOrphanObjectsByPrefix,
} from './supabaseStorageService.js';
