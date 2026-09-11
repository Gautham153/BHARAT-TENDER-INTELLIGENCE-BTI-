// Bharat Tender Intelligence (BTI) — Serverless AI Evaluation Handler
// Consolidated /api/ai serverless function for Vercel Hobby & Cloud deployment

import { ProposalEvaluationServerService } from '../server/evaluation/ProposalEvaluationServerService.js';

const evaluationServer = new ProposalEvaluationServerService();

function resolveStatusCode(err: any): number {
  // 1. Existing application err.statusCode values are preserved
  if (typeof err?.statusCode === 'number' && err.statusCode >= 400 && err.statusCode <= 599) {
    return err.statusCode;
  }

  // Preserve HTTP status from status property if set (standard in Fetch / HTTP / Google GenAI SDK errors)
  if (typeof err?.status === 'number' && err.status >= 400 && err.status <= 599) {
    return err.status;
  }

  // Preserve nested response status or error code
  if (typeof err?.response?.status === 'number' && err.response.status >= 400 && err.response.status <= 599) {
    return err.response.status;
  }
  if (typeof err?.error?.code === 'number' && err.error.code >= 400 && err.error.code <= 599) {
    return err.error.code;
  }

  const errMsg = typeof err?.message === 'string' ? err.message : '';
  const errCode = typeof err?.code === 'string' || typeof err?.code === 'number' ? String(err.code) : '';
  const errStatusStr = typeof err?.status === 'string' ? err.status : '';

  // 2. Authentication/authorization errors continue to return their existing 401/403 statuses
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

  // 3. Gemini/API errors containing an HTTP status/code of 503 are returned as HTTP 503
  if (
    errCode === '503' ||
    errStatusStr === '503' ||
    errStatusStr === 'UNAVAILABLE' ||
    errMsg.includes('503') ||
    errMsg.includes('UNAVAILABLE') ||
    errMsg.toLowerCase().includes('service unavailable') ||
    errMsg.toLowerCase().includes('model is overloaded')
  ) {
    return 503;
  }

  // 4. Gemini 429/rate-limit errors are returned as HTTP 429 when that status is available
  if (
    errCode === '429' ||
    errStatusStr === '429' ||
    errStatusStr === 'RESOURCE_EXHAUSTED' ||
    errMsg.includes('429') ||
    errMsg.includes('RESOURCE_EXHAUSTED') ||
    errMsg.toLowerCase().includes('rate limit') ||
    errMsg.toLowerCase().includes('quota') ||
    errMsg.toLowerCase().includes('too many requests')
  ) {
    return 429;
  }

  // 5. Validation/application errors continue to return 400
  if (
    errMsg.includes('Invalid') ||
    errMsg.includes('Missing') ||
    errMsg.includes('Validation') ||
    errMsg.includes('Mismatch') ||
    errMsg.includes('Violation') ||
    errMsg.includes('Rejected') ||
    errMsg.includes('eligible') ||
    errCode === '400' ||
    errCode === 'INVALID_ARGUMENT'
  ) {
    return 400;
  }

  // 6. Unexpected server errors return 500
  return 500;
}

function sanitizeErrorMessage(err: unknown): string {
  let message = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Evaluation service error occurred.';
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    message = message.split(apiKey.trim()).join('[REDACTED_API_KEY]');
  }
  message = message.replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=[REDACTED]');
  message = message.replace(/Bearer\s+[a-zA-Z0-9_\.\-]+/gi, 'Bearer [REDACTED]');
  return message;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  try {
    const authHeader = req.headers?.authorization || req.headers?.['authorization'];
    const payload = req.body || {};
    const result = await evaluationServer.evaluateProposal({
      ...payload,
      authHeader,
    });
    return res.status(200).json({ success: true, evaluation: result });
  } catch (err: any) {
    const statusCode = resolveStatusCode(err);
    const message = sanitizeErrorMessage(err);
    return res.status(statusCode).json({ success: false, error: message });
  }
}
