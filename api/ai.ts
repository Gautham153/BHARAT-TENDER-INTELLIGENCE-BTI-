// Bharat Tender Intelligence (BTI) — Serverless AI Evaluation Handler
// Consolidated /api/ai serverless function for Vercel Hobby & Cloud deployment

import { ProposalEvaluationServerService } from '../server/evaluation/ProposalEvaluationServerService';

const evaluationServer = new ProposalEvaluationServerService();

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
    const statusCode =
      err?.statusCode ||
      (err?.message && err.message.includes('Access Denied') ? 403 : err?.message && err.message.includes('Unauthorized') ? 401 : 400);
    const message = err instanceof Error ? err.message : 'Evaluation service error occurred.';
    return res.status(statusCode).json({ success: false, error: message });
  }
}
