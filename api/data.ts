// Bharat Tender Intelligence (BTI) — Serverless Data Handler
// Consolidated /api/data serverless function for Vercel & Cloud deployment
// Dispatches storage vault operations (upload, download, cleanup-orphan) with strict RBAC

import path from 'node:path';
import { DocumentIntelligenceServerService } from '../server/document/DocumentIntelligenceServerService.js';

const documentIntelligenceServer = new DocumentIntelligenceServerService();

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
  message = message.replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=[REDACTED]');
  message = message.replace(/Bearer\s+[a-zA-Z0-9_\.\-]+/gi, 'Bearer [REDACTED]');
  return message;
}

export default async function handler(req: any, res: any) {
  const authHeader = req.headers?.authorization || req.headers?.['authorization'];

  // Handle GET (Document Download)
  if (req.method === 'GET') {
    const action = req.query?.action;
    if (action === 'document-download' || action === 'download-document') {
      try {
        const documentId = req.query?.documentId as string | undefined;
        const storageReference = (req.query?.storageReference || req.query?.ref) as string | undefined;

        if (!documentId && !storageReference) {
          return res.status(400).json({
            success: false,
            error: 'Invalid Request: documentId or storageReference query parameter is required.',
          });
        }

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
      } catch (err: any) {
        const statusCode = resolveStatusCode(err);
        const message = sanitizeErrorMessage(err);
        return res.status(statusCode).json({ success: false, error: message });
      }
    }

    return res.status(400).json({
      success: false,
      error: `Unsupported GET action: '${action || 'none'}'. Supported actions: document-download.`,
    });
  }

  // Handle POST (Document Upload & Cleanup)
  if (req.method === 'POST') {
    const payload = req.body || {};
    const action = payload.action;

    try {
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
          authHeader,
        });

        return res.status(200).json({ success: true, ...result });
      }

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

      return res.status(400).json({
        success: false,
        error: `Unsupported POST action: '${action || 'none'}'. Supported actions: document-upload, document-cleanup-orphan.`,
      });
    } catch (err: any) {
      const statusCode = resolveStatusCode(err);
      const message = sanitizeErrorMessage(err);
      return res.status(statusCode).json({ success: false, error: message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed. Use GET or POST.' });
}
