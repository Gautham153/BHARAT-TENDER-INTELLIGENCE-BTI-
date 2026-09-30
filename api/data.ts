// Bharat Tender Intelligence (BTI) — Serverless Data Handler
// Consolidated /api/data serverless function for Vercel & Cloud deployment
// Dispatches storage vault operations (upload-url, upload, download-url, download, cleanup-orphan) with strict RBAC

import path from 'node:path';
import { DocumentIntelligenceServerService } from '../server/document/DocumentIntelligenceServerService.js';
import { PublicTransparencyServerService } from '../server/transparency/PublicTransparencyServerService.js';

const documentIntelligenceServer = new DocumentIntelligenceServerService();
const publicTransparencyServer = new PublicTransparencyServerService();

function resolveStatusCode(err: any): number {
  if (typeof err?.statusCode === 'number' && err.statusCode >= 400 && err.statusCode <= 599) {
    return err.statusCode;
  }
  if (typeof err?.status === 'number' && err.status >= 400 && err.status <= 599) {
    return err.status;
  }
  if (typeof err?.response?.status === 'number' && err.response.status >= 400 && err.response.status <= 599) {
    return err.response.status;
  }

  const errMsg = typeof err?.message === 'string' ? err.message : '';
  const errCode = typeof err?.code === 'string' || typeof err?.code === 'number' ? String(err.code) : '';

  if (
    errMsg.includes('Access Denied') ||
    errMsg.includes('Forbidden') ||
    errCode === '403' ||
    errCode === 'PERMISSION_DENIED'
  ) {
    return 403;
  }

  if (
    errMsg.includes('Unauthorized') ||
    errMsg.includes('Unauthenticated') ||
    errCode === '401' ||
    errCode === 'UNAUTHENTICATED'
  ) {
    return 401;
  }

  if (
    errMsg.includes('Not Found') ||
    errMsg.includes('not found') ||
    errCode === '404' ||
    errCode === 'NOT_FOUND'
  ) {
    return 404;
  }

  if (
    errMsg.includes('Conflict') ||
    errMsg.includes('already exists') ||
    errCode === '409' ||
    errCode === 'ALREADY_EXISTS'
  ) {
    return 409;
  }

  if (
    errMsg.includes('exceeds the 15MB limit') ||
    errMsg.includes('File Size Exceeded') ||
    errCode === '413'
  ) {
    return 413;
  }

  if (
    errMsg.includes('Unsupported document format') ||
    errMsg.includes('Unsupported Format') ||
    errCode === '415'
  ) {
    return 415;
  }

  if (
    errMsg.includes('Invalid') ||
    errMsg.includes('Missing') ||
    errMsg.includes('Validation') ||
    errMsg.includes('Malformed') ||
    errCode === '400' ||
    errCode === 'INVALID_ARGUMENT'
  ) {
    return 400;
  }

  return 500;
}

function sanitizeErrorMessage(err: unknown): string {
  let message = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Data service error occurred.';
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    message = message.split(apiKey.trim()).join('[REDACTED_API_KEY]');
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey && serviceKey.trim().length > 0) {
    message = message.split(serviceKey.trim()).join('[REDACTED_KEY]');
  }
  message = message.replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=[REDACTED]');
  message = message.replace(/Bearer\s+[a-zA-Z0-9_\.\-]+/gi, 'Bearer [REDACTED]');
  return message;
}

export default async function handler(req: any, res: any) {
  const authHeader = req.headers?.authorization || req.headers?.['authorization'];

  // Handle GET (Document Download & Signed URL generation)
  if (req.method === 'GET') {
    const action = req.query?.action;
    if (
      action === 'document-download' ||
      action === 'download-document' ||
      action === 'document-download-url'
    ) {
      try {
        const documentId = req.query?.documentId as string | undefined;
        const storageReference = (req.query?.storageReference || req.query?.ref) as string | undefined;
        const format = (req.query?.format || '').toLowerCase();

        if (!documentId && !storageReference) {
          return res.status(400).json({
            success: false,
            error: 'Invalid Request: documentId or storageReference query parameter is required.',
          });
        }

        // Case A: Binary stream requested explicitly (e.g. for server proxy or legacy tests)
        if (format === 'binary' || format === 'stream') {
          const fileData = await documentIntelligenceServer.getDocumentFile({
            documentId,
            storageReference,
            authHeader,
          });

          const fileName = path.basename(storageReference || `${documentId || 'document'}.pdf`);
          res.setHeader('Content-Type', fileData.mimeType);
          res.setHeader('Content-Length', fileData.buffer.length);
          res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
          return res.status(200).send(fileData.buffer);
        }

        // Case B (Default / Standard): Return short-lived Supabase signed download URL
        const downloadResult = await documentIntelligenceServer.getDocumentDownloadUrl({
          documentId,
          storageReference,
          authHeader,
        });

        if (format === 'redirect') {
          return res.redirect(302, downloadResult.downloadUrl);
        }

        return res.status(200).json({
          success: true,
          ...downloadResult,
        });
      } catch (err: any) {
        const statusCode = resolveStatusCode(err);
        const message = sanitizeErrorMessage(err);
        return res.status(statusCode).json({ success: false, error: message });
      }
    }

    return res.status(400).json({
      success: false,
      error: `Unsupported GET action: '${action || 'none'}'. Supported actions: document-download, document-download-url.`,
    });
  }

  // Handle POST (Document Upload URL, Verification & Cleanup)
  if (req.method === 'POST') {
    const payload = req.body || {};
    const action = payload.action;

    try {
      // Action 1: Request Authorized Supabase Storage Upload URL
      if (action === 'document-upload-url' || action === 'document-upload-initiate') {
        const { documentId, projectId, fileName, mimeType, fileSize, fileHash, revisionOfDocumentId } = payload;

        if (!documentId || !projectId || !fileName || !fileSize) {
          return res.status(400).json({
            success: false,
            error: 'Invalid Request: documentId, projectId, fileName, and fileSize are required to request an upload URL.',
          });
        }

        const result = await documentIntelligenceServer.requestUploadUrl({
          documentId,
          projectId,
          fileName,
          mimeType: mimeType || 'application/pdf',
          fileSize: Number(fileSize),
          fileHash,
          revisionOfDocumentId,
          authHeader,
        });

        return res.status(200).json({ success: true, ...result });
      }

      // Action 2: Document Verification & Registration
      if (action === 'document-upload' || action === 'upload-document') {
        const {
          documentId,
          projectId,
          fileName,
          mimeType,
          storageReference,
          fileHash,
          fileSize,
          fileDataUrl,
          bufferBase64,
          buffer,
          revisionOfDocumentId,
        } = payload;
        const binary = fileDataUrl || bufferBase64 || buffer;

        if (!documentId || !fileName || (!binary && !storageReference)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid Request: documentId, fileName, and either storageReference or binary payload are required.',
          });
        }

        const result = await documentIntelligenceServer.storeDocumentFile({
          documentId,
          projectId,
          fileName,
          mimeType: mimeType || 'application/pdf',
          storageReference,
          fileHash,
          fileSize: typeof fileSize === 'number' ? fileSize : undefined,
          bufferOrBase64: binary,
          revisionOfDocumentId,
          authHeader,
        });

        return res.status(200).json({ success: true, ...result });
      }

      // Action 3: Orphan Vault Binary Cleanup (Rollback on Firestore metadata failure)
      if (action === 'document-cleanup-orphan' || action === 'cleanup-orphan') {
        const { documentId, projectId, storageReference } = payload;
        if (!documentId || !projectId) {
          return res.status(400).json({
            success: false,
            error: 'Invalid Request: documentId and projectId are required for orphan cleanup.',
          });
        }

        const result = await documentIntelligenceServer.cleanupOrphanVaultFile({
          documentId,
          projectId,
          storageReference,
          authHeader,
        });

        return res.status(200).json({ success: true, ...result });
      }

      // Action 4: Server-Authored Public Transparency Projection Synchronization
      if (action === 'sync-public-projection' || action === 'sync-projection') {
        const { projectId } = payload;
        if (!projectId) {
          return res.status(400).json({
            success: false,
            error: 'Invalid Request: projectId is required for public projection synchronization.',
          });
        }

        const result = await publicTransparencyServer.syncPublicProjection({
          projectId,
          authHeader,
        });

        return res.status(200).json(result);
      }

      // Action 5: Server-Authored Public Transparency Projection Deletion (Fail-Closed Restriction)
      if (action === 'delete-public-projection' || action === 'delete-projection') {
        const { projectId } = payload;
        if (!projectId) {
          return res.status(400).json({
            success: false,
            error: 'Invalid Request: projectId is required for public projection deletion.',
          });
        }

        const result = await publicTransparencyServer.deletePublicProjection({
          projectId,
          authHeader,
        });

        return res.status(200).json(result);
      }

      return res.status(400).json({
        success: false,
        error: `Unsupported POST action: '${action || 'none'}'. Supported actions: document-upload-url, document-upload, document-cleanup-orphan, sync-public-projection, delete-public-projection.`,
      });
    } catch (err: any) {
      const statusCode = resolveStatusCode(err);
      const message = sanitizeErrorMessage(err);
      return res.status(statusCode).json({ success: false, error: message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed. Use GET or POST.' });
}
