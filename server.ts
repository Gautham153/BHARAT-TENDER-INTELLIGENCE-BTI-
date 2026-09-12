// Bharat Tender Intelligence (BTI) — Full-Stack Server Entry Point
// Serves /api/* server endpoints and integrates Vite middleware in development

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { ProposalEvaluationServerService } from './server/evaluation/ProposalEvaluationServerService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON request body parser
  app.use(express.json({ limit: '10mb' }));

  const evaluationServer = new ProposalEvaluationServerService();

  // API Routes FIRST
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Bharat Tender Intelligence API',
      timestamp: new Date().toISOString(),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0),
    });
  });

  // Consolidated Server-Side AI Evaluation Endpoint
  app.post(['/api/ai', '/api/ai/evaluate-proposal'], async (req, res) => {
    try {
      const authHeader = req.headers.authorization || (req.headers['authorization'] as string | undefined);
      const payload = req.body || {};
      const result = await evaluationServer.evaluateProposal({
        ...payload,
        authHeader,
      });
      res.status(200).json({ success: true, evaluation: result });
    } catch (err: any) {
      const statusCode =
        err?.statusCode ||
        (err?.message && err.message.includes('Access Denied') ? 403 : err?.message && err.message.includes('Unauthorized') ? 401 : 400);
      const message = err instanceof Error ? err.message : 'Evaluation service error occurred.';
      res.status(statusCode).json({ success: false, error: message });
    }
  });

  // Authoritative Physical & Financial Progress Calculation Endpoint
  app.post('/api/projects/calculate-progress', (req, res) => {
    try {
      const { milestones, financialRecords, awardedAmount } = req.body || {};

      let physicalResult = null;
      if (Array.isArray(milestones)) {
        let totalWeight = 0;
        let weightedProgressSum = 0;
        for (const m of milestones) {
          const weight = Math.max(0, Math.min(100, Number(m.weightPercent) || 0));
          const prog = Math.max(0, Math.min(100, Number(m.progressPercent) || 0));
          totalWeight += weight;
          weightedProgressSum += (prog * weight) / 100;
        }
        const calculatedProgress = Math.round(weightedProgressSum);
        physicalResult = {
          progress: Math.min(100, Math.max(0, calculatedProgress)),
          totalWeight,
          isCompletePlan: Math.round(totalWeight) === 100,
        };
      }

      let financialResult = null;
      if (Array.isArray(financialRecords) && Number(awardedAmount) > 0) {
        const verifiedRecords = financialRecords.filter((r: any) => r.verificationStatus === 'VERIFIED');
        const verifiedAmount = verifiedRecords.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
        const totalExpenditure = financialRecords.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
        const rawPercent = Math.round((verifiedAmount / Number(awardedAmount)) * 100);
        financialResult = {
          verifiedAmount,
          totalExpenditure,
          progressPercent: Math.min(100, Math.max(0, rawPercent)),
          isOverBudget: verifiedAmount > Number(awardedAmount),
        };
      }

      res.status(200).json({
        success: true,
        physical: physicalResult,
        financial: financialResult,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'Progress calculation error' });
    }
  });

  // Vite Middleware Setup for Dev vs Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express v5 uses '*all' for catch-all routing
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BTI Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[BTI Server] Failed to start server:', err);
  process.exit(1);
});
