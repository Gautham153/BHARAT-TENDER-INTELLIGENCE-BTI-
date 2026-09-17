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
  DEMONSTRATION_PROGRESS_UPDATES,
} from '../../src/data/demonstrationProjects.js';

const GEMINI_MODEL = 'gemini-3.8-flash';
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
5. DETERMINISTIC SEVERITY PRESERVATION: When active deterministic anomalies are present in the prompt, any corresponding item in "priorityFindings" MUST preserve the EXACT anomaly type, title, and deterministic severity (e.g., a HIGH severity deterministic anomaly must remain HIGH; do NOT downgrade to MEDIUM or upgrade).
6. If there are NO active deterministic anomalies, do NOT invent or manufacture phantom deterministic system anomalies.
7. Return ONLY valid, RFC 8259 JSON matching the exact schema requested.`;

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

    // Phase 8: Finding-specific Investigation Intelligence Advisory
    if ((params as any).mode === 'INVESTIGATION_ADVISORY' || (params as any).findingId) {
      return this.analyzeFindingInvestigation(params as any) as any;
    }

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
    const riskAssessment = authoritative.riskAssessment;

    // Filter to ensure ONLY current active anomalies are passed to Gemini and evaluation:
    // isConditionActive !== false AND status in ['OPEN', 'UNDER_REVIEW', 'ACKNOWLEDGED']
    const rawAnomalies = authoritative.anomalies ?? params.anomalies ?? [];
    const anomalies = rawAnomalies.filter((a: any) => {
      const isConditionActive = a.isConditionActive !== false;
      const status = (a.status || 'OPEN').toUpperCase();
      return isConditionActive && ['OPEN', 'UNDER_REVIEW', 'ACKNOWLEDGED'].includes(status);
    });

    const milestonesSummary = authoritative.milestonesSummary ?? params.milestonesSummary ?? [];
    const financialSummary = authoritative.financialSummary ?? params.financialSummary;
    const inspectionSummary = authoritative.inspectionSummary ?? params.inspectionSummary ?? [];

    if (!project) {
      const err: any = new Error(`Project "${projectId}" not found in authoritative records.`);
      err.statusCode = 404;
      throw err;
    }

    // Authoritative deterministic risk values remain ground truth:
    // Prioritize projectRiskAssessments/{projectId}, then project.riskScore/riskLevel, then safe derivation
    const authoritativeRiskScore = Number(
      riskAssessment?.riskScore ?? project.riskScore ?? 0
    );
    const authoritativeRiskLevel: RiskLevel =
      riskAssessment?.riskLevel ||
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
        'BTI Deterministic Fallback (No Gemini API Key configured)',
        riskAssessment
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

CRITICAL INSTRUCTIONS FOR priorityFindings:
- When ACTIVE ANOMALIES DETECTED BY DETERMINISTIC SYSTEM RULES are present above, your priorityFindings MUST directly include them and reflect their EXACT deterministic severity (e.g. HIGH must be "HIGH"). You must NOT downgrade, upgrade, or alter the deterministic severity.
- If there are NO active deterministic anomalies, do NOT invent phantom deterministic system anomalies.

RESPONSE SCHEMA REQUIRED:
Return a single JSON object with these keys:
{
  "summary": "Concise 2-4 sentence executive risk summary grounded in the project data.",
  "overallRiskLevel": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
  "priorityFindings": [
    {
      "title": "Finding title matching or derived from the deterministic indicator",
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

      // Sanitize output to guarantee anti-slop, forbidden phrase enforcement, and authoritative severity preservation
      const sanitizedSummary = this.sanitizeTerminology(parsed.summary || '');
      const sanitizedFindings = (parsed.priorityFindings || []).map((f: any) => {
        const title = this.sanitizeTerminology(f.title || 'Risk Indicator');
        const explanation = this.sanitizeTerminology(f.explanation || '');

        // Match against deterministic anomalies to enforce authoritative severity
        const matchedAnomaly = anomalies.find(
          (a: any) =>
            (a.title && title.toLowerCase().includes(a.title.toLowerCase())) ||
            (a.title && a.title.toLowerCase().includes(title.toLowerCase())) ||
            (a.type && title.toLowerCase().includes(a.type.toLowerCase().replace(/_/g, ' '))) ||
            (a.type === 'INSPECTION_PROGRESS_DIVERGENCE' &&
              (title.toLowerCase().includes('inspection') ||
                title.toLowerCase().includes('verification') ||
                title.toLowerCase().includes('progress discrepancy') ||
                explanation.toLowerCase().includes('official on-site inspection')))
        );

        const severity = matchedAnomaly
          ? matchedAnomaly.severity
          : ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(f.severity)
          ? f.severity
          : 'MEDIUM';

        return {
          title,
          explanation,
          severity,
          reviewRecommendation: this.sanitizeTerminology(f.reviewRecommendation || 'Review project measurement book.'),
        };
      });

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
        `Deterministic Fallback (Gemini call exception: ${err.message || 'API error'})`,
        riskAssessment
      );
    }
  }

  /**
   * Helper to query Firestore collections for a given project via REST API.
   */
  private async queryFirestoreCollection(
    firebaseProjectId: string,
    token: string,
    collectionId: string,
    projectId: string
  ): Promise<any[]> {
    try {
      const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents:runQuery`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId }],
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
      if (res.ok) {
        const results = await res.json();
        return (Array.isArray(results) ? results : [])
          .filter((r: any) => r.document)
          .map((r: any) => parseFirestoreDoc(r.document));
      }
    } catch (e) {
      console.warn(`[ProjectRiskAiServerService] Failed querying collection ${collectionId}:`, e);
    }
    return [];
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
    riskAssessment?: any;
    anomalies?: any[];
    allAnomalies?: any[];
    milestones?: any[];
    financialRecords?: any[];
    updates?: any[];
    inspections?: any[];
    exceptions?: any[];
    auditEvents?: any[];
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

          // Parallelize subcollection & risk assessment queries
          const [
            authoritativeRiskAssessment,
            allFetchedAnomalies,
            liveMilestones,
            liveFinancials,
            liveUpdates,
            liveInspections,
            liveExceptions,
            liveAuditEvents,
          ] = await Promise.all([
            // projectRiskAssessments/{projectId}
            fetch(
              `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/projectRiskAssessments/${projectId}`,
              { headers: { Authorization: `Bearer ${token}` } }
            )
              .then((r) => (r.ok ? r.json() : null))
              .then((d) => (d ? parseFirestoreDoc(d) : null))
              .catch(() => null),
            this.queryFirestoreCollection(firebaseProjectId, token, 'projectAnomalies', projectId),
            this.queryFirestoreCollection(firebaseProjectId, token, 'projectMilestones', projectId),
            this.queryFirestoreCollection(firebaseProjectId, token, 'projectFinancialRecords', projectId),
            this.queryFirestoreCollection(firebaseProjectId, token, 'projectProgressUpdates', projectId),
            this.queryFirestoreCollection(firebaseProjectId, token, 'projectInspections', projectId),
            this.queryFirestoreCollection(firebaseProjectId, token, 'projectExceptions', projectId),
            this.queryFirestoreCollection(firebaseProjectId, token, 'projectAuditEvents', projectId),
          ]);

          // Filter to strictly current active anomalies:
          // isConditionActive !== false AND status is OPEN, UNDER_REVIEW, or ACKNOWLEDGED
          const authoritativeAnomalies = allFetchedAnomalies.filter((a: any) => {
            const isConditionActive = a.isConditionActive !== false;
            const status = (a.status || 'OPEN').toUpperCase();
            return isConditionActive && ['OPEN', 'UNDER_REVIEW', 'ACKNOWLEDGED'].includes(status);
          });

          return {
            project: proj,
            riskAssessment: authoritativeRiskAssessment,
            anomalies: authoritativeAnomalies,
            allAnomalies: allFetchedAnomalies,
            milestones: liveMilestones,
            financialRecords: liveFinancials,
            updates: liveUpdates,
            inspections: liveInspections,
            exceptions: liveExceptions,
            auditEvents: liveAuditEvents,
            milestonesSummary: liveMilestones.map((m: any) => ({
              sequence: m.sequence,
              title: m.title,
              progress: m.progressPercent ?? m.progress ?? 0,
              status: m.status,
              weight: m.weightPercent ?? m.weight ?? 0,
              plannedEnd: m.plannedEndDate || m.plannedEnd,
            })),
            financialSummary: {
              verifiedRecordsCount: liveFinancials.filter(
                (f: any) => f.verificationStatus === 'VERIFIED' || f.status === 'VERIFIED'
              ).length,
              totalVerified: liveFinancials
                .filter((f: any) => f.verificationStatus === 'VERIFIED' || f.status === 'VERIFIED')
                .reduce((sum: number, f: any) => sum + (Number(f.amount) || 0), 0),
              totalExpenditure: liveFinancials.reduce((sum: number, f: any) => sum + (Number(f.amount) || 0), 0),
            },
            inspectionSummary: liveInspections.map((i: any) => ({
              date: i.inspectionDate || i.date,
              officer: i.officerName || i.inspectorName || 'Government Engineer',
              type: i.type,
              observedProgress: i.physicalProgressObserved ?? i.observedPhysicalProgressPercent ?? 0,
              issuesCount: Array.isArray(i.issues)
                ? i.issues.length
                : Array.isArray(i.issuesIdentified)
                ? i.issuesIdentified.length
                : 0,
              hasCorrectiveActions:
                (Array.isArray(i.correctiveActions) && i.correctiveActions.length > 0) ||
                (Array.isArray(i.correctiveActionsRequired) && i.correctiveActionsRequired.length > 0),
            })),
          };
        }
      } catch (err) {
        console.warn('[ProjectRiskAiServerService] Firestore fetch error for AI boundary:', err);
      }
    }

    // Ground truth fallback: Check demonstration projects repository
    const demoProj = DEMONSTRATION_PROJECTS.find((p) => p.id === projectId);
    if (demoProj) {
      const demoMilestones = DEMONSTRATION_MILESTONES.filter((m) => m.projectId === projectId);
      const demoFinancials = DEMONSTRATION_FINANCIAL_RECORDS.filter((f) => f.projectId === projectId);
      const demoInspections = DEMONSTRATION_INSPECTIONS.filter((i) => i.projectId === projectId);
      const demoUpdates = DEMONSTRATION_PROGRESS_UPDATES.filter((u) => u.projectId === projectId);

      return {
        project: demoProj,
        milestones: demoMilestones,
        financialRecords: demoFinancials,
        updates: demoUpdates,
        inspections: demoInspections,
        milestonesSummary: demoMilestones.map((m) => ({
          sequence: m.sequence,
          title: m.title,
          progress: m.progressPercent,
          status: m.status,
          weight: m.weightPercent,
          plannedEnd: m.plannedEndDate,
        })),
        financialSummary: {
          verifiedRecordsCount: demoFinancials.filter((f) => f.verificationStatus === 'VERIFIED').length,
          totalVerified: demoFinancials
            .filter((f) => f.verificationStatus === 'VERIFIED')
            .reduce((sum, f) => sum + (f.amount || 0), 0),
          totalExpenditure: demoFinancials.reduce((sum, f) => sum + (f.amount || 0), 0),
        },
        inspectionSummary: demoInspections.map((i) => ({
          date: i.inspectionDate,
          officer: i.officerName,
          type: i.inspectionType,
          observedProgress: i.physicalProgressObserved ?? i.governmentVerifiedPhysicalProgressPercent ?? 0,
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
    reason: string,
    riskAssessment?: any
  ): RiskIntelligenceResult {
    // Ensure deterministic fallback advisory only uses current active anomalies
    const currentActiveAnomalies = (anomalies || []).filter((a: any) => {
      const isConditionActive = a.isConditionActive !== false;
      const status = (a.status || 'OPEN').toUpperCase();
      return isConditionActive && ['OPEN', 'UNDER_REVIEW', 'ACKNOWLEDGED'].includes(status);
    });

    const authoritativeRiskScore = Number(
      riskAssessment?.riskScore ?? project.riskScore ?? 0
    );
    const authoritativeRiskLevel: RiskLevel =
      riskAssessment?.riskLevel ||
      project.riskLevel ||
      (authoritativeRiskScore >= 80
        ? 'CRITICAL'
        : authoritativeRiskScore >= 60
        ? 'HIGH'
        : authoritativeRiskScore >= 30
        ? 'MODERATE'
        : 'LOW');

    const activeCount = currentActiveAnomalies.length;

    return {
      assessmentId: `risk-ai-fallback-${projectId}-${Date.now()}`,
      projectId,
      riskLevel: authoritativeRiskLevel,
      overallRiskLevel: authoritativeRiskLevel,
      riskScore: authoritativeRiskScore,
      summary: `System analysis identifies a ${authoritativeRiskLevel.toLowerCase()} implementation risk posture for "${project.title || projectId}" based on ${activeCount} active deterministic monitoring indicators. Review recommended for physical execution divergence and milestone timelines. (${reason})`,
      priorityFindings: currentActiveAnomalies.slice(0, 3).map((a: any) => ({
        title: a.title,
        explanation: a.explanation,
        severity: a.severity,
        reviewRecommendation: `Verify on-site execution against measurement book and request reconciliation explanation from executing agency (${project.implementingAgencyName || 'contractor'}).`,
      })),
      contributingIndicators: currentActiveAnomalies.map((a: any) => a.title),
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

  /**
   * Phase 8: Authoritative Server-Side AI Finding Investigation Advisory
   * Resolves authoritative evidence purely from server-side ground truth to protect the AI prompt context.
   */
  async analyzeFindingInvestigation(params: {
    projectId: string;
    findingId?: string;
    anomaly?: any;
    evidenceItems?: any[];
    authHeader?: string;
  }): Promise<any> {
    const { projectId, findingId, anomaly, authHeader } = params;

    // 1. Authoritative Server-Side Token Authentication & RBAC Check
    const authResult = await verifyServerAuth(authHeader);
    const roleLower = (authResult.role || '').toLowerCase();
    if (!roleLower.includes('gov')) {
      const err: any = new Error(
        `Access Denied: AI Investigation Advisory is restricted strictly to authorized government officers. Authenticated role: '${authResult.role}'.`
      );
      err.statusCode = 403;
      throw err;
    }

    // 2. Resolve authoritative project data and verify project existence
    const rawToken = authHeader?.replace(/^Bearer\s+/i, '').trim();
    const authoritative = await this.resolveAuthoritativeProjectData(projectId, rawToken);
    const project = authoritative.project;
    if (!project) {
      const err: any = new Error(`Project "${projectId}" not found in authoritative records.`);
      err.statusCode = 404;
      throw err;
    }

    // 3. Resolve authoritative anomaly server-side to guarantee integrity
    const rawAnomalies: any[] = authoritative.allAnomalies || authoritative.anomalies || [];
    const targetAnomaly = rawAnomalies.find((a: any) => {
      if (findingId) {
        if (a.id === findingId) return true;
        if (a.findingId === findingId) return true;
        if (a.ruleKey && findingId.includes(a.ruleKey)) return true;
        const slug = (a.type || '').toLowerCase().replace(/_/g, '-');
        if (slug && findingId.includes(slug)) return true;
      }
      if (anomaly?.id && a.id === anomaly.id) return true;
      if (anomaly?.type && a.type === anomaly.type) {
        const targetMsId = anomaly.metrics?.milestoneId || anomaly.metrics?.targetMilestoneId;
        const aMsId = a.metrics?.milestoneId || a.metrics?.targetMilestoneId;
        if (targetMsId && aMsId) {
          return targetMsId === aMsId;
        }
        return true;
      }
      return false;
    });

    if (!targetAnomaly) {
      const err: any = new Error(
        `Surveillance finding "${findingId || anomaly?.id || 'unknown'}" could not be resolved from authoritative project records for project "${projectId}".`
      );
      err.statusCode = 404;
      throw err;
    }

    // 4. Resolve authoritative evidence items strictly from server-side records (replaces/protects against client-supplied payloads)
    const {
      evidenceItems: authoritativeEvidenceItems,
      directItems,
      calcItems,
      missingItems,
    } = this.resolveAuthoritativeEvidenceItems(projectId, project, targetAnomaly, authoritative);

    const client = getGeminiClient();
    if (!client) {
      return this.generateDeterministicInvestigationAdvisory(findingId || '', targetAnomaly, directItems, calcItems, missingItems);
    }

    const prompt = `You are the BTI Investigation Advisor assisting government officers reviewing public work anomalies.
PROJECT DETAILS:
- Title: ${project?.title || projectId}
- Executing Agency: ${project?.implementingAgencyName || project?.agencyName || 'N/A'}
- District/State: ${project?.district || ''}, ${project?.state || ''}

SURVEILLANCE FINDING:
- Finding ID: ${findingId || targetAnomaly?.id || 'N/A'}
- Title: ${targetAnomaly?.title || 'System Flagged Anomaly'}
- Type: ${targetAnomaly?.type || 'N/A'}
- Deterministic Severity: ${targetAnomaly?.severity || 'HIGH'}
- Explanation: ${targetAnomaly?.explanation || 'N/A'}

UNDERLYING EVIDENCE ITEMS (Authoritative Stored Records):
${authoritativeEvidenceItems.map((e: any, idx: number) => `${idx + 1}. [${e.classification}] ${e.sourceType}: ${e.title} — ${e.description} (Relevance: ${e.relevance})`).join('\n')}

INVESTIGATION ADVISORY RULES:
1. Provide an objective, grounded investigation advisory for a reviewing government nodal officer.
2. Base all observations strictly on the supplied evidence items. Do NOT invent missing records or make factual claims not in the prompt.
3. STRICT TERMINOLOGY RULE: NEVER accuse the contractor or state "fraud", "corruption", "guilt", or "crime". Frame as "discrepancies requiring administrative verification", "monitoring variance", or "areas for field inquiry".
4. Suggest 2-4 specific, neutral questions or areas that an investigating officer should verify on site or with administrative records.
5. Identify any missing evidence sources from the list.

RESPONSE SCHEMA (RFC 8259 JSON ONLY):
{
  "summary": "Concise 2-3 sentence overview of why this indicator matters from an administrative standpoint.",
  "evidenceSummary": "Concise synthesis of direct and calculated evidence items provided.",
  "relatedSignals": ["Signal 1", "Signal 2"],
  "recommendedReviewAreas": ["Question/area 1 to verify", "Question/area 2 to verify", "Question/area 3 to verify"],
  "missingEvidence": ["Missing item 1", ...],
  "limitations": "Advisory decision support grounded strictly in project records; does not constitute a legal or forensic finding.",
  "provider": "Gemini 3.8 Flash via Google GenAI SDK",
  "model": "gemini-3.8-flash",
  "version": "1.0",
  "timestamp": "${new Date().toISOString()}"
}`;

    try {
      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const text = response.text || '';
      const parsed = JSON.parse(text);
      return {
        summary: this.sanitizeTerminology(parsed.summary || 'Investigation advisory based on project records.'),
        evidenceSummary: this.sanitizeTerminology(parsed.evidenceSummary || 'Direct and calculated evidence evaluated.'),
        relatedSignals: Array.isArray(parsed.relatedSignals) ? parsed.relatedSignals.map((s: string) => this.sanitizeTerminology(s)) : [],
        recommendedReviewAreas: Array.isArray(parsed.recommendedReviewAreas) ? parsed.recommendedReviewAreas.map((r: string) => this.sanitizeTerminology(r)) : [],
        missingEvidence: Array.isArray(parsed.missingEvidence) ? parsed.missingEvidence : missingItems.map((m: any) => m.title),
        limitations: parsed.limitations || 'Advisory decision support grounded strictly in project records.',
        provider: 'Gemini 3.8 Flash via Google GenAI SDK',
        model: GEMINI_MODEL,
        version: '1.0',
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      console.warn('[ProjectRiskAiServerService] Gemini call failed for finding advisory, using deterministic fallback:', err);
      return this.generateDeterministicInvestigationAdvisory(findingId || '', targetAnomaly, directItems, calcItems, missingItems);
    }
  }

  /**
   * Resolves authoritative evidence items on the server from grounded project data and deterministic anomaly records.
   */
  private resolveAuthoritativeEvidenceItems(
    projectId: string,
    project: any,
    targetAnomaly: any,
    authoritative: any
  ): {
    evidenceItems: any[];
    directItems: any[];
    calcItems: any[];
    missingItems: any[];
  } {
    const directItems: any[] = [];
    const calcItems: any[] = [];
    const missingItems: any[] = [];

    // 1. Direct items from targetAnomaly.evidence if present
    if (Array.isArray(targetAnomaly?.evidence) && targetAnomaly.evidence.length > 0) {
      for (const ev of targetAnomaly.evidence) {
        directItems.push({
          sourceType: ev.entityType || 'SYSTEM_RECORD',
          sourceId: ev.entityId || 'REC-001',
          title: ev.label || 'Direct Ground Truth Record',
          description: ev.detail || 'Authoritative evidence cited in deterministic anomaly rule evaluation.',
          classification: 'DIRECT',
          relevance: 'Directly linked ground truth record cited by surveillance rule.',
          date: ev.date || project.updatedAt || project.createdAt,
        });
      }
    } else {
      directItems.push({
        sourceType: 'PROJECT',
        sourceId: projectId,
        title: `Project Record: ${project.title || projectId}`,
        description: `Awarded contract: ₹${Number(project.awardedAmount || 0).toLocaleString('en-IN')}, Reported Physical Progress: ${project.physicalProgressPercent ?? project.physicalProgress ?? 0}%, Financial Progress: ${project.financialProgressPercent ?? project.financialProgress ?? 0}%.`,
        classification: 'DIRECT',
        relevance: 'Primary project registration and sanction baseline record.',
      });
    }

    // 2. Add specific underlying records matching the anomaly type from authoritative records
    const anomType = targetAnomaly?.type || '';
    const financialRecords = authoritative.financialRecords || [];
    const milestones = authoritative.milestones || [];
    const updates = authoritative.updates || [];
    const inspections = authoritative.inspections || [];

    if (anomType === 'PHYSICAL_FINANCIAL_DIVERGENCE') {
      const verified = financialRecords.filter(
        (f: any) => f.verificationStatus === 'VERIFIED' || f.status === 'VERIFIED'
      );
      const totalVer = verified.reduce((s: number, f: any) => s + (Number(f.amount) || 0), 0);
      const awarded = Number(project.awardedAmount || project.sanctionedAmount || 1);
      const finPct = Math.min(100, Math.round((totalVer / awarded) * 100));
      const physPct = Number(project.physicalProgressPercent ?? project.physicalProgress ?? 0);
      const div = finPct - physPct;

      calcItems.push({
        sourceType: 'ANOMALY',
        sourceId: targetAnomaly.id || 'VAR-01',
        title: 'Financial vs Physical Divergence Metric',
        description: `Verified expenditure at ${finPct}% exceeds reported physical progress of ${physPct}% by ${div} percentage points.`,
        classification: 'CALCULATED',
        relevance: 'Cross-signal divergence calculated by deterministic surveillance engine.',
      });

      if (verified.length > 0) {
        verified.slice(0, 3).forEach((rec: any) => {
          directItems.push({
            sourceType: 'FINANCIAL_RECORD',
            sourceId: rec.id || rec.invoiceNumber || 'FIN-REC',
            title: `Verified Invoice ${rec.invoiceNumber || rec.id || ''}: ₹${Number(rec.amount || 0).toLocaleString('en-IN')}`,
            description: `Disbursement record verified on ${rec.verificationDate || rec.createdAt || 'N/A'}.`,
            classification: 'DIRECT',
            relevance: 'Authoritative disbursement contributing to cumulative expenditure.',
          });
        });
      } else {
        missingItems.push({
          sourceType: 'FINANCIAL_RECORD',
          sourceId: 'MISSING_FINANCIAL_RECORDS',
          title: 'Verified Financial Disbursement Records',
          description: 'No verified financial records found in project accounts to corroborate expenditure claim.',
          classification: 'MISSING',
          relevance: 'Authoritative financial records required to verify fiscal drawdown.',
        });
      }
    } else if (anomType === 'MILESTONE_DELAY' || anomType === 'REPEATED_MILESTONE_DELAYS') {
      const targetMilestoneId = targetAnomaly.metrics?.milestoneId || targetAnomaly.metrics?.targetMilestoneId;
      const targetMs = milestones.find(
        (m: any) => m.id === targetMilestoneId || m.sequence === targetAnomaly.metrics?.sequence
      );

      if (targetMs) {
        directItems.push({
          sourceType: 'MILESTONE',
          sourceId: targetMs.id,
          title: `Milestone #${targetMs.sequence || ''} "${targetMs.title}": ${targetMs.progressPercent ?? targetMs.progress ?? 0}% complete`,
          description: `Planned completion date: ${targetMs.plannedEndDate || 'N/A'}. Status: ${targetMs.status}.`,
          classification: 'DIRECT',
          relevance: 'Contract milestone record subject to delay schedule evaluation.',
        });
      } else if (milestones.length === 0) {
        missingItems.push({
          sourceType: 'MILESTONE',
          sourceId: 'MISSING_MILESTONE_SCHEDULE',
          title: 'Approved Milestone Schedule Register',
          description: 'No baseline milestone schedule found for this project.',
          classification: 'MISSING',
          relevance: 'Baseline schedule required to track milestone delivery.',
        });
      }

      const days = Number(targetAnomaly.metrics?.daysDelayed || targetAnomaly.metrics?.maxDelayDays || 30);
      calcItems.push({
        sourceType: 'MILESTONE',
        sourceId: targetMilestoneId || 'MS-DELAY',
        title: 'Milestone Execution Delay Metric',
        description: `Milestone has breached planned target completion date by ${days} calendar days without verified completion.`,
        classification: 'CALCULATED',
        relevance: 'Schedule baseline delay computed against contract milestone plan.',
      });

      missingItems.push({
        sourceType: 'EXCEPTION',
        sourceId: 'MISSING_EOT',
        title: 'Contractor Extension of Time (EOT) Justification',
        description: 'No formal statutory extension of time or weather/site obstruction declaration has been recorded.',
        classification: 'MISSING',
        relevance: 'Required administrative filing under contract dispute and delay clauses.',
      });
    } else if (anomType === 'MILESTONE_SCHEDULE_PRESSURE') {
      const targetMilestoneId = targetAnomaly.metrics?.milestoneId;
      const targetMs = milestones.find((m: any) => m.id === targetMilestoneId);
      if (targetMs) {
        directItems.push({
          sourceType: 'MILESTONE',
          sourceId: targetMs.id,
          title: `Milestone #${targetMs.sequence || ''} "${targetMs.title}": ${targetMs.progressPercent ?? targetMs.progress ?? 0}% complete`,
          description: `Planned completion date: ${targetMs.plannedEndDate || 'N/A'}.`,
          classification: 'DIRECT',
          relevance: 'Target milestone under severe compression schedule.',
        });
      }
      const daysRemaining = Number(targetAnomaly.metrics?.daysRemaining || 0);
      const requiredDailyRate = Number(targetAnomaly.metrics?.requiredDailyProgressRate || 0);
      calcItems.push({
        sourceType: 'MILESTONE',
        sourceId: targetMilestoneId || 'MS-PRESSURE',
        title: 'Milestone Schedule Compression Metric',
        description: `Milestone requires an accelerated progress velocity of ${requiredDailyRate}% per day with only ${daysRemaining} days remaining.`,
        classification: 'CALCULATED',
        relevance: 'Mathematical schedule compression indicator.',
      });
      missingItems.push({
        sourceType: 'PROGRESS_UPDATE',
        sourceId: 'MISSING_ACCELERATION_PLAN',
        title: 'Contractor Mobilization & Acceleration Plan',
        description: 'No revised site manpower or equipment deployment plan submitted to meet the impending milestone deadline.',
        classification: 'MISSING',
        relevance: 'Required plan to support compressed milestone schedule.',
      });
    } else if (anomType === 'EXPENDITURE_ACCELERATION') {
      const windowDays = Number(targetAnomaly.metrics?.windowDays || 30);
      const billedAmount = Number(targetAnomaly.metrics?.windowExpenditure || targetAnomaly.metrics?.billedAmount || 0);
      const percentOfAward = Number(targetAnomaly.metrics?.percentOfAwardedAmount || 0);
      calcItems.push({
        sourceType: 'FINANCIAL_RECORD',
        sourceId: 'EXP-ACCEL-METRIC',
        title: 'Rapid Expenditure Acceleration Metric',
        description: `₹${billedAmount.toLocaleString('en-IN')} (${percentOfAward}% of total contract budget) billed within a ${windowDays}-day window.`,
        classification: 'CALCULATED',
        relevance: 'Disproportionate expenditure acceleration detected by surveillance rule.',
      });
      missingItems.push({
        sourceType: 'INSPECTION',
        sourceId: 'MISSING_INTERIM_INSPECTION',
        title: 'Concurrent Physical Field Inspection Report',
        description: 'No interim on-site measurement inspection filed during the 30-day rapid billing surge.',
        classification: 'MISSING',
        relevance: 'Independent field verification required to support rapid expenditure drawdowns.',
      });
    } else if (anomType === 'AWARDED_VALUE_OVERRUN') {
      const totalVer = financialRecords
        .filter((f: any) => f.verificationStatus === 'VERIFIED' || f.status === 'VERIFIED')
        .reduce((s: number, f: any) => s + (Number(f.amount) || 0), 0);
      const awarded = Number(project.awardedAmount || 0);
      const overrun = Number(targetAnomaly.metrics?.excessAmount || Math.max(0, totalVer - awarded));
      calcItems.push({
        sourceType: 'FINANCIAL_RECORD',
        sourceId: 'OVERRUN-METRIC',
        title: 'Awarded Value Expenditure Overrun Metric',
        description: `Verified disbursements (₹${totalVer.toLocaleString('en-IN')}) exceed awarded contract ceiling (₹${awarded.toLocaleString('en-IN')}) by ₹${overrun.toLocaleString('en-IN')}.`,
        classification: 'CALCULATED',
        relevance: 'Statutory contract ceiling overrun calculated by surveillance engine.',
      });
      missingItems.push({
        sourceType: 'EXCEPTION',
        sourceId: 'MISSING_VARIATION_SANCTION',
        title: 'Administrative Revised Sanction & Variation Approval',
        description: 'No formal revised administrative approval or cost variation sanction has been filed for excess expenditure.',
        classification: 'MISSING',
        relevance: 'Statutory prerequisite for disbursements exceeding sanctioned contract value.',
      });
    } else if (anomType === 'LONG_REPORTING_GAP') {
      if (updates.length > 0) {
        const latestUpd = updates[0];
        directItems.push({
          sourceType: 'PROGRESS_UPDATE',
          sourceId: latestUpd.id || 'LATEST-UPD',
          title: `Latest Filed Progress Report: ${latestUpd.updateDate ? latestUpd.updateDate.split('T')[0] : 'Recorded'}`,
          description: `Reported physical progress: ${latestUpd.reportedPhysicalProgressPercent ?? latestUpd.progressPercent ?? 'N/A'}%.`,
          classification: 'DIRECT',
          relevance: 'Last recorded statutory filing before prolonged dormancy.',
        });
      } else {
        missingItems.push({
          sourceType: 'PROGRESS_UPDATE',
          sourceId: 'MISSING_PROGRESS_FILING',
          title: 'Statutory Monthly Physical Progress Report',
          description: 'Mandatory monthly progress filing is absent from project monitoring records.',
          classification: 'MISSING',
          relevance: 'Statutory monitoring submission required under MPLAD implementation guidelines.',
        });
      }
      const gap = Number(targetAnomaly.metrics?.reportingGapDays || 45);
      calcItems.push({
        sourceType: 'PROGRESS_UPDATE',
        sourceId: 'GAP-METRIC',
        title: 'Elapsed Reporting Inactivity Period',
        description: `No statutory progress updates filed for ${gap} consecutive calendar days.`,
        classification: 'CALCULATED',
        relevance: 'Non-compliance with periodic statutory reporting requirements.',
      });
    } else if (anomType === 'INSPECTION_PROGRESS_DIVERGENCE') {
      if (inspections.length > 0) {
        const latestInsp = inspections[0];
        directItems.push({
          sourceType: 'INSPECTION',
          sourceId: latestInsp.id || 'INSP-REC',
          title: `Field Inspection by ${latestInsp.officerName || latestInsp.inspectorName || 'Government Engineer'} (${latestInsp.inspectionDate ? latestInsp.inspectionDate.split('T')[0] : 'Date Recorded'})`,
          description: `Observed physical progress: ${latestInsp.physicalProgressObserved ?? latestInsp.observedPhysicalProgressPercent ?? 0}%. Issues recorded: ${(latestInsp.issues || []).length}.`,
          classification: 'DIRECT',
          relevance: 'Independent on-site ground measurement record.',
        });
      } else {
        missingItems.push({
          sourceType: 'INSPECTION',
          sourceId: 'MISSING_INSPECTION_RECORD',
          title: 'Official Field Inspection Report',
          description: 'No government field inspection report found in project register.',
          classification: 'MISSING',
          relevance: 'Official field measurement report required to substantiate divergence.',
        });
      }
      const inspDiv = Number(targetAnomaly.metrics?.divergencePercent || 20);
      calcItems.push({
        sourceType: 'INSPECTION',
        sourceId: 'INSP-DIV-METRIC',
        title: 'Ground Inspection Discrepancy Metric',
        description: `Independent field inspection measurement diverges by ${inspDiv} percentage points from agency-reported figures.`,
        classification: 'CALCULATED',
        relevance: 'Mathematical divergence between field observation and contractor billing claims.',
      });
      missingItems.push({
        sourceType: 'MEASUREMENT_BOOK',
        sourceId: 'MISSING_JOINT_MB',
        title: 'Joint Measurement Reconciliation Certificate',
        description: 'Joint site measurement book (MB) reconciling contractor claims with engineer observations is absent.',
        classification: 'MISSING',
        relevance: 'Required regulatory instrument to resolve on-site measurement conflicts.',
      });
    } else if (anomType === 'REPEATED_CORRECTIVE_ACTIONS') {
      const count = Number(targetAnomaly.metrics?.correctiveActionsCount || 2);
      calcItems.push({
        sourceType: 'INSPECTION',
        sourceId: 'CORR-ACTION-METRIC',
        title: 'Unresolved Rectification Directives',
        description: `${count} recorded quality inspection directives remain open without verified agency closure reports.`,
        classification: 'CALCULATED',
        relevance: 'Compliance quality tracking indicates repeated unaddressed inspection orders.',
      });
      missingItems.push({
        sourceType: 'EXCEPTION',
        sourceId: 'MISSING_RECTIFICATION_LOG',
        title: 'Verified Rectification and Quality Compliance Certificate',
        description: 'Agency has not filed formal engineering compliance sign-off on prior inspection notices.',
        classification: 'MISSING',
        relevance: 'Mandatory quality clearance document needed before milestone sign-off.',
      });
    } else if (anomType === 'CONFLICTING_RECORDS') {
      calcItems.push({
        sourceType: 'ANOMALY',
        sourceId: targetAnomaly.id || 'CONFLICT-METRIC',
        title: 'Conflicting Record Discrepancy',
        description: targetAnomaly.explanation || 'Direct contradiction detected between reported status and granular milestone data.',
        classification: 'CALCULATED',
        relevance: 'Cross-record mathematical inconsistency flagged by surveillance engine.',
      });
      missingItems.push({
        sourceType: 'PROGRESS_UPDATE',
        sourceId: 'MISSING_CLARIFICATION_LOG',
        title: 'Executing Agency Clarification Declaration',
        description: 'No formal clarifying statement submitted by agency to reconcile contradictory progress claims.',
        classification: 'MISSING',
        relevance: 'Required administrative clarification to resolve conflicting filings.',
      });
    } else if (anomType === 'PROJECT_STAGNATION') {
      const inactiveDays = Number(targetAnomaly.metrics?.inactiveDays || 60);
      calcItems.push({
        sourceType: 'PROJECT',
        sourceId: projectId,
        title: 'Prolonged Dormancy Period',
        description: `Project marked ${project.status || 'IN_PROGRESS'} with zero physical or financial movement for ${inactiveDays} days.`,
        classification: 'CALCULATED',
        relevance: 'Surveillance inactivity detector identified complete project dormancy.',
      });
      missingItems.push({
        sourceType: 'PROGRESS_UPDATE',
        sourceId: 'MISSING_RESUMPTION_NOTICE',
        title: 'Work Resumption Notice or Site Encumbrance Report',
        description: 'No site obstacle declaration, encumbrance log, or work resumption notice has been filed.',
        classification: 'MISSING',
        relevance: 'Statutory documentation explaining prolonged site stagnation.',
      });
    }

    const allItems = [...directItems, ...calcItems, ...missingItems];
    return {
      evidenceItems: allItems,
      directItems,
      calcItems,
      missingItems,
    };
  }

  private generateDeterministicInvestigationAdvisory(
    findingId: string,
    anomaly: any,
    directItems: any[],
    calcItems: any[],
    missingItems: any[]
  ): any {
    const missingNames = missingItems.map((m: any) => m.title || 'Unknown record');
    const anomType = anomaly?.type || '';

    const reviewQuestions: Record<string, string[]> = {
      PHYSICAL_FINANCIAL_DIVERGENCE: [
        'Verify whether verified invoice billing items correspond to physical construction work executed on site during the same period.',
        'Request the Executive Engineer measurement book (MB) entries corresponding to the latest cleared financial claims.',
        'Ascertain whether procurement of materials has been verified through certified unspent material inventory logs on site.',
      ],
      MILESTONE_DELAY: [
        'Review contractor justification for milestone schedule overrun to ascertain weather, land clearance, or labour factors.',
        'Verify if contractor has requested a formal extension of time (EOT) under contract clause 4.2.',
      ],
      REPEATED_MILESTONE_DELAYS: [
        'Evaluate overall contractor staffing capacity and on-site equipment mobilization across all work fronts.',
        'Verify if notice under liquidated damages or milestone breach provisions has been issued by the competent authority.',
      ],
      EXPENDITURE_ACCELERATION: [
        'Review invoices submitted in the accelerated window against certified physical inspection logs.',
        'Verify if batch material deliveries were physically inspected prior to financial sign-off.',
      ],
      AWARDED_VALUE_OVERRUN: [
        'Determine whether variation orders or revised administrative sanctions were approved prior to excess disbursals.',
        'Halt further payment vouchers pending formal excess expenditure regularisation by the District Magistrate.',
      ],
      LONG_REPORTING_GAP: [
        'Issue a formal administrative show-cause letter requesting immediate submission of monthly progress logs.',
        'Depute a junior engineer for an unscheduled on-site status check to confirm if work is active or abandoned.',
      ],
      INSPECTION_PROGRESS_DIVERGENCE: [
        'Depute a joint re-measurement committee comprising the Executive Engineer and Agency Representative with GPS survey.',
        'Review measurement discrepancies side-by-side with official site measurement book entries.',
      ],
      REPEATED_CORRECTIVE_ACTIONS: [
        'Inspect on-site material test certificates for non-compliant batch items cited in previous inspection notices.',
        'Verify whether agency has submitted photographic and laboratory evidence of rectification for prior directives.',
      ],
      CONFLICTING_RECORDS: [
        'Reconcile conflicting milestone progress percentages against the primary physical measurement register.',
        'Direct agency nodal officer to submit an official clarifying declaration on the discrepant figures.',
      ],
      PROJECT_STAGNATION: [
        'Confirm whether contractor has abandoned the site or temporarily suspended operations due to dispute.',
        'Verify if local site access encumbrances or fund clearance holds have caused the prolonged dormancy.',
      ],
    };

    return {
      summary: `System surveillance flagged indicator "${anomaly?.title || findingId}". This advisory provides institutional decision support and does not establish wrongdoing.`,
      evidenceSummary: `Evaluation grounded in ${directItems.length} direct stored records and ${calcItems.length} calculated metrics.${missingItems.length > 0 ? ` Note: ${missingItems.length} expected evidence sources are missing from system records.` : ''}`,
      relatedSignals: [
        `Deterministic anomaly indicator: ${anomType} (${anomaly?.severity || 'HIGH'})`,
        `Direct records available: ${directItems.length}`,
      ],
      recommendedReviewAreas: reviewQuestions[anomType] || [
        'Conduct field verification to reconcile on-site work with submitted claims.',
        'Examine statutory measurement books and invoice vouchers.',
      ],
      missingEvidence: missingNames.length > 0 ? missingNames : ['None; all core expected records are present in system records.'],
      limitations:
        'These records support the identification of a monitoring anomaly but do not, by themselves, establish fraud or wrongdoing. Final determination requires on-site measurement and administrative inquiry.',
      provider: 'BTI Grounded Surveillance Engine (Deterministic Fallback)',
      model: 'deterministic-rules-v1.0',
      version: '1.0',
      timestamp: new Date().toISOString(),
    };
  }
}
