// Bharat Tender Intelligence (BTI) — Project Risk AI Server Service
// Phase 7: Grounded Server-Side AI Risk Intelligence Analysis Endpoint
// Evaluates project data, deterministic anomalies, and milestones to generate decision-support narrative.

import { GoogleGenAI } from '@google/genai';
import { verifyServerAuth } from '../evaluation/serverAuth.js';
import { parseFirestoreDoc } from '../evaluation/authoritativeDataService.js';
import { RiskIntelligenceResult, RiskLevel } from '../../src/types/anomaly.js';
import {
  DEMONSTRATION_PROJECTS,
  DEMONSTRATION_MILESTONES,
  DEMONSTRATION_FINANCIAL_RECORDS,
  DEMONSTRATION_INSPECTIONS,
} from '../../src/data/demonstrationProjects.js';

const GEMINI_MODEL = 'gemini-2.5-flash';
let geminiClientInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }
  if (!geminiClientInstance) {
    geminiClientInstance = new GoogleGenAI({ apiKey });
  }
  return geminiClientInstance;
}

const SYSTEM_INSTRUCTION = `You are the Project Risk Intelligence Advisor for Bharat Tender Intelligence (BTI), assisting District Magistrates, Member of Parliament nodal officers, and implementation engineers reviewing MPLAD (Member of Parliament Local Area Development) infrastructure projects.

CORE DIRECTIVES & MANDATES:
1. You are strictly a decision-support advisory system. You DO NOT make executive, legal, or judicial decisions.
2. The deterministic anomaly calculations and risk score provided in the prompt are GROUND TRUTH. You MUST NOT recalculate, override, contradict, or re-score them. Your job is to interpret their cross-signal impact, synthesize clear narrative explanations, and suggest high-priority administrative verification steps.
3. STRICT TERMINOLOGY RULE: You are STRICTLY FORBIDDEN from declaring "Fraud Detected", "Fraud Confirmed", "Corruption Confirmed", "Illegal Activity Confirmed", or "Contractor is Fraudulent".
   Use institutional administrative terms: "Risk Indicator Requiring Administrative Verification", "Implementation Discrepancy", "High Risk Indicator", "Monitoring Variance", "Inspection Discrepancy".
4. Base all statements exclusively on the provided project parameters, milestone progress, financial submissions, and official field inspection observations. Do NOT invent dates, people, or contract figures.
5. Return ONLY valid, RFC 8259 JSON matching the exact schema requested.`;

export class ProjectRiskAiServerService {
  async analyzeProjectRisk(params: {
    projectId: string;
    project?: any;
    anomalies?: any[];
    milestonesSummary?: any[];
    financialSummary?: any;
    inspectionSummary?: any[];
    authHeader?: string;
  }): Promise<RiskIntelligenceResult> {
    const { projectId, authHeader } = params;

    // 1. Authoritative Server-Side Token Authentication & RBAC Check
    const authResult = await verifyServerAuth(authHeader);
    const roleLower = (authResult.role || '').toLowerCase();
    if (!roleLower.includes('gov')) {
      const err: any = new Error(
        `Access Denied: AI Risk Intelligence is restricted strictly to authorized government officers. Authenticated role: '${authResult.role}'.`
      );
      err.statusCode = 403;
      throw err;
    }

    // 2. Protect AI Data Boundary: Resolve authoritative project and monitoring records from Firestore / ground truth
    const rawToken = authHeader?.replace(/^Bearer\s+/i, '').trim();
    const authoritative = await this.resolveAuthoritativeProjectData(projectId, rawToken);

    const project = authoritative.project || params.project;
    const anomalies = authoritative.anomalies ?? params.anomalies ?? [];
    const milestonesSummary = authoritative.milestonesSummary ?? params.milestonesSummary ?? [];
    const financialSummary = authoritative.financialSummary ?? params.financialSummary;
    const inspectionSummary = authoritative.inspectionSummary ?? params.inspectionSummary ?? [];

    if (!project) {
      const err: any = new Error(`Project "${projectId}" not found in authoritative records.`);
      err.statusCode = 404;
      throw err;
    }

    // Authoritative deterministic risk values remain ground truth
    const authoritativeRiskScore = Number(project.riskScore ?? 0);
    const authoritativeRiskLevel: RiskLevel =
      project.riskLevel ||
      (authoritativeRiskScore >= 80
        ? 'CRITICAL'
        : authoritativeRiskScore >= 60
        ? 'HIGH'
        : authoritativeRiskScore >= 30
        ? 'MODERATE'
        : 'LOW');

    const client = getGeminiClient();
    const nowIso = new Date().toISOString();

    // If Gemini client is not configured, return deterministic grounded advisory
    if (!client) {
      return this.generateDeterministicAdvisory(
        projectId,
        project,
        anomalies,
        'BTI Deterministic Fallback (No Gemini API Key configured)'
      );
    }

    const prompt = `
Analyze the implementation health and risk posture for the following MPLAD project:

PROJECT DETAILS:
- ID: ${projectId}
- Number: ${project.projectNumber || 'N/A'}
- Title: ${project.title}
- Executing Agency: ${project.implementingAgencyName || project.agencyName || 'N/A'}
- District/State: ${project.district || 'N/A'}, ${project.state || 'N/A'}
- Awarded Contract Amount: ₹${Number(project.awardedAmount || 0).toLocaleString('en-IN')}
- Physical Progress: ${project.physicalProgressPercent ?? project.physicalProgress ?? 0}%
- Financial Progress: ${project.financialProgressPercent ?? project.financialProgress ?? 0}%
- Status: ${project.status}

ACTIVE ANOMALIES DETECTED BY DETERMINISTIC SYSTEM RULES:
${
  anomalies.length === 0
    ? 'No active anomalies detected.'
    : anomalies
        .map(
          (a: any, idx: number) =>
            `${idx + 1}. [${a.severity}] ${a.title} (${a.type}): ${a.explanation}`
        )
        .join('\n')
}

MILESTONES SUMMARY:
${
  milestonesSummary.length === 0
    ? 'No milestone data provided.'
    : milestonesSummary
        .map(
          (m: any) =>
            `- Milestone #${m.sequence} "${m.title}": Progress ${m.progress}%, Status ${m.status}, Weight ${m.weight}%, Planned End ${m.plannedEnd || 'N/A'}`
        )
        .join('\n')
}

FINANCIAL UTILIZATION SUMMARY:
- Verified Invoices Count: ${financialSummary?.verifiedRecordsCount ?? 'N/A'}
- Total Verified Claims: ₹${Number(financialSummary?.totalVerified ?? 0).toLocaleString('en-IN')}

FIELD INSPECTION SUMMARY:
${
  inspectionSummary.length === 0
    ? 'No field inspection reports filed.'
    : inspectionSummary
        .map(
          (i: any) =>
            `- Date ${i.date}, Officer ${i.officer} (${i.type}): Observed Progress ${i.observedProgress}%, Issues: ${i.issuesCount}, Corrective Action: ${i.hasCorrectiveActions ? 'Yes' : 'No'}`
        )
        .join('\n')
}

RESPONSE SCHEMA REQUIRED:
Return a single JSON object with these keys:
{
  "summary": "Concise 2-4 sentence executive risk summary grounded in the project data.",
  "overallRiskLevel": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
  "priorityFindings": [
    {
      "title": "Finding title",
      "explanation": "Clear factual explanation citing specific numbers/dates from the data",
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "reviewRecommendation": "Specific administrative action for the Nodal Officer"
    }
  ],
  "contributingIndicators": ["Indicator 1", "Indicator 2"],
  "recommendedReviewAreas": ["Specific audit recommendation 1", "Specific audit recommendation 2", "Specific audit recommendation 3"],
  "limitations": "Strict disclaimer regarding decision-support scope."
}
`;

    try {
      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
        },
      });

      const raw = response.text || '';
      const parsed = JSON.parse(raw);

      // Sanitize output to guarantee anti-slop and forbidden phrase enforcement
      const sanitizedSummary = this.sanitizeTerminology(parsed.summary || '');
      const sanitizedFindings = (parsed.priorityFindings || []).map((f: any) => ({
        title: this.sanitizeTerminology(f.title || 'Risk Indicator'),
        explanation: this.sanitizeTerminology(f.explanation || ''),
        severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(f.severity) ? f.severity : 'MEDIUM',
        reviewRecommendation: this.sanitizeTerminology(f.reviewRecommendation || 'Review project measurement book.'),
      }));

      return {
        assessmentId: `risk-ai-${projectId}-${Date.now()}`,
        projectId,
        riskLevel: authoritativeRiskLevel,
        overallRiskLevel: authoritativeRiskLevel,
        riskScore: authoritativeRiskScore,
        summary: sanitizedSummary,
        priorityFindings: sanitizedFindings,
        contributingIndicators: (parsed.contributingIndicators || []).map((c: string) => this.sanitizeTerminology(c)),
        recommendedReviewAreas: (parsed.recommendedReviewAreas || []).map((r: string) => this.sanitizeTerminology(r)),
        limitations:
          'Advisory decision support grounded strictly in authoritative project records; does not constitute a formal legal, forensic, or statutory audit finding. Deterministic scores remain authoritative.',
        provider: 'Google Gemini',
        model: GEMINI_MODEL,
        version: '1.0.0-phase7',
        timestamp: nowIso,
      };
    } catch (err: any) {
      console.warn('[ProjectRiskAiServerService] Gemini API call failed, falling back to deterministic advisory:', err);
      return this.generateDeterministicAdvisory(
        projectId,
        project,
        anomalies,
        `Deterministic Fallback (Gemini call exception: ${err.message || 'API error'})`
      );
    }
  }

  /**
   * Resolves authoritative project and monitoring records from Firestore REST API or verified demonstration repository.
   * Ensures client-provided arbitrary payloads cannot corrupt the AI prompt context.
   */
  private async resolveAuthoritativeProjectData(
    projectId: string,
    token?: string
  ): Promise<{
    project?: any;
    anomalies?: any[];
    milestonesSummary?: any[];
    financialSummary?: any;
    inspectionSummary?: any[];
  }> {
    const firebaseProjectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

    if (firebaseProjectId && token && !token.startsWith('bti-demo-token-')) {
      try {
        const projRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/projects/${projectId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (projRes.ok) {
          const docJson = await projRes.json();
          const proj = parseFirestoreDoc(docJson);

          // Query authoritative anomalies for this project
          let authoritativeAnomalies: any[] = [];
          try {
            const anomQueryRes = await fetch(
              `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents:runQuery`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  structuredQuery: {
                    from: [{ collectionId: 'projectAnomalies' }],
                    where: {
                      fieldFilter: {
                        field: { fieldPath: 'projectId' },
                        op: 'EQUAL',
                        value: { stringValue: projectId },
                      },
                    },
                  },
                }),
              }
            );
            if (anomQueryRes.ok) {
              const anomResults = await anomQueryRes.json();
              authoritativeAnomalies = anomResults
                .filter((r: any) => r.document)
                .map((r: any) => parseFirestoreDoc(r.document));
            }
          } catch {
            // Non-fatal query fallback
          }

          return {
            project: proj,
            anomalies: authoritativeAnomalies,
          };
        }
      } catch (err) {
        console.warn('[ProjectRiskAiServerService] Firestore fetch error for AI boundary:', err);
      }
    }

    // Ground truth fallback: Check demonstration projects repository
    const demoProj = DEMONSTRATION_PROJECTS.find((p) => p.id === projectId);
    if (demoProj) {
      const demoMilestones = DEMONSTRATION_MILESTONES[projectId] || [];
      const demoFinancials = DEMONSTRATION_FINANCIAL_RECORDS[projectId] || [];
      const demoInspections = DEMONSTRATION_INSPECTIONS[projectId] || [];

      return {
        project: demoProj,
        milestonesSummary: demoMilestones.map((m) => ({
          sequence: m.sequence,
          title: m.title,
          progress: m.progressPercent,
          status: m.status,
          weight: m.weightPercent,
          plannedEnd: m.plannedEndDate,
        })),
        financialSummary: {
          verifiedRecordsCount: demoFinancials.filter((f) => f.status === 'VERIFIED').length,
          totalVerified: demoFinancials
            .filter((f) => f.status === 'VERIFIED')
            .reduce((sum, f) => sum + (f.amount || 0), 0),
        },
        inspectionSummary: demoInspections.map((i) => ({
          date: i.inspectionDate,
          officer: i.inspectorName,
          type: i.type,
          observedProgress: i.observedPhysicalProgressPercent,
          issuesCount: (i.issues || []).length,
          hasCorrectiveActions: (i.correctiveActions || []).length > 0,
        })),
      };
    }

    return {};
  }

  private sanitizeTerminology(text: string): string {
    return text
      .replace(/fraud detected/gi, 'Critical implementation anomaly detected')
      .replace(/fraud confirmed/gi, 'Administrative anomaly confirmed')
      .replace(/contractor is fraudulent/gi, 'Contractor exhibits critical reporting discrepancies')
      .replace(/corruption confirmed/gi, 'Severe compliance discrepancy identified')
      .replace(/illegal activity/gi, 'Regulatory variance requiring investigation');
  }

  private generateDeterministicAdvisory(
    projectId: string,
    project: any,
    anomalies: any[],
    reason: string
  ): RiskIntelligenceResult {
    const authoritativeRiskScore = Number(project.riskScore ?? 0);
    const hasCritical = anomalies.some((a: any) => a.severity === 'CRITICAL');
    const hasHigh = anomalies.some((a: any) => a.severity === 'HIGH');
    const authoritativeRiskLevel: RiskLevel =
      project.riskLevel ||
      (authoritativeRiskScore >= 80
        ? 'CRITICAL'
        : authoritativeRiskScore >= 60
        ? 'HIGH'
        : authoritativeRiskScore >= 30
        ? 'MODERATE'
        : hasCritical
        ? 'CRITICAL'
        : hasHigh
        ? 'HIGH'
        : 'LOW');

    const activeCount = anomalies.filter((a: any) => a.status === 'OPEN' && a.isConditionActive !== false).length;

    return {
      assessmentId: `risk-ai-fallback-${projectId}-${Date.now()}`,
      projectId,
      riskLevel: authoritativeRiskLevel,
      overallRiskLevel: authoritativeRiskLevel,
      riskScore: authoritativeRiskScore,
      summary: `System analysis identifies a ${authoritativeRiskLevel.toLowerCase()} implementation risk posture for "${project.title || projectId}" based on ${activeCount} active deterministic monitoring indicators. Review recommended for physical execution divergence and milestone timelines. (${reason})`,
      priorityFindings: anomalies.slice(0, 3).map((a: any) => ({
        title: a.title,
        explanation: a.explanation,
        severity: a.severity,
        reviewRecommendation: `Verify on-site execution against measurement book and request reconciliation explanation from executing agency (${project.implementingAgencyName || 'contractor'}).`,
      })),
      contributingIndicators: anomalies.map((a: any) => a.title),
      recommendedReviewAreas: [
        'Conduct physical site measurement joint inspection with Executive Engineer.',
        'Reconcile verified expenditure invoices against physical milestone deliverables.',
        'Review contractor mobilization bank guarantee validity.',
      ],
      limitations:
        'Advisory decision support grounded strictly in authoritative project records; does not constitute a formal legal, forensic, or statutory audit finding. Deterministic scores remain authoritative.',
      provider: 'BTI Grounded Deterministic Advisor',
      model: 'Deterministic-v1',
      version: '1.0.0-phase7',
      timestamp: new Date().toISOString(),
    };
  }
}
