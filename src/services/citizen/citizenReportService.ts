// Bharat Tender Intelligence (BTI) — Citizen Report & Social Audit Service
// Phase 10: Citizen Grievance & Participatory Social Audit Service Layer

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../firebase/firebase.js';
import {
  isLiveFirestoreSession,
  isDemoSession,
  sanitizeFirestorePayload,
  ProjectService,
} from '../firebase/projects.js';
import {
  CitizenProjectReport,
  CitizenReportSubmissionInput,
  CitizenReportVerificationInput,
  CitizenReportStatus,
  CitizenReportAdvisoryResult,
  CITIZEN_REPORT_NATURE_LABELS,
} from '../../types/citizenReport.js';
import { ProjectAuditEvent, ProjectAuditAction } from '../../types/project.js';
import { DEMONSTRATION_CITIZEN_REPORTS } from '../../data/demonstrationCitizenReports.js';
import { PublicTransparencyService } from '../transparency/publicTransparencyService.js';
import { EvidenceChainService } from '../evidence/evidenceChainService.js';

const CITIZEN_REPORTS_COLLECTION = 'citizenProjectReports';
const AUDIT_EVENTS_COLLECTION = 'projectAuditEvents';
const LOCAL_STORAGE_REPORTS_KEY = 'bti_citizen_reports_cache_v1';
const LOCAL_STORAGE_EVENTS_KEY = 'bti_project_audit_events_cache_v1';

function getLocalReports(): CitizenProjectReport[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_REPORTS_KEY);
    if (!raw) {
      if (isDemoSession() || !isLiveFirestoreSession()) {
        localStorage.setItem(LOCAL_STORAGE_REPORTS_KEY, JSON.stringify(DEMONSTRATION_CITIZEN_REPORTS));
        return [...DEMONSTRATION_CITIZEN_REPORTS];
      }
      return [];
    }
    return JSON.parse(raw) as CitizenProjectReport[];
  } catch {
    return isDemoSession() || !isLiveFirestoreSession() ? [...DEMONSTRATION_CITIZEN_REPORTS] : [];
  }
}

function saveLocalReports(reports: CitizenProjectReport[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_REPORTS_KEY, JSON.stringify(reports));
  } catch (err) {
    console.warn('[CitizenReportService] Failed to cache local reports:', err);
  }
}

function getLocalAuditEvents(): ProjectAuditEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_EVENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ProjectAuditEvent[];
  } catch {
    return [];
  }
}

function saveLocalAuditEvents(events: ProjectAuditEvent[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_EVENTS_KEY, JSON.stringify(events));
  } catch (err) {
    console.warn('[CitizenReportService] Failed to cache local audit events:', err);
  }
}

export class CitizenReportService {
  /**
   * Submits a new citizen social audit / observation report.
   * Public-facing submission path:
   * - Authoritatively resolves project context (never trusts client-supplied names or financials)
   * - Generates stable institutional tracking code CPR-YYYY-XXXXXX
   * - Protects reporter identity: stored securely in citizenProjectReports, never exposed to public list
   */
  static async submitReport(input: CitizenReportSubmissionInput): Promise<{
    report: CitizenProjectReport;
    receipt: {
      reportId: string;
      submittedAt: string;
      status: CitizenReportStatus;
      projectTitle: string;
      trackingNote: string;
    };
  }> {
    const { projectId, reporterMode, natureOfAnomaly, specificEvidence, locationDetails, media = [] } = input;

    if (!projectId) {
      throw new Error('Project ID is required.');
    }

    if (!specificEvidence || specificEvidence.trim().length < 10) {
      throw new Error('Specific observation evidence must be at least 10 characters.');
    }

    if (specificEvidence.trim().length > 4000) {
      throw new Error('Specific observation evidence exceeds maximum allowed length (4000 characters).');
    }

    if (locationDetails && locationDetails.trim().length > 1000) {
      throw new Error('Location details exceed maximum allowed length (1000 characters).');
    }

    if (reporterMode === 'IDENTIFIED') {
      if (!input.reporterName || input.reporterName.trim().length === 0) {
        throw new Error('Full Name is required for identified submissions.');
      }
      if (!input.reporterMobile || input.reporterMobile.trim().length < 7) {
        throw new Error('A valid Contact Mobile number is required for identified submissions.');
      }
    }

    // Authoritatively resolve public project context (no internal fallback for public submissions)
    const publicProj = await PublicTransparencyService.getPublicProjectById(projectId);
    if (!publicProj) {
      throw new Error('Project is not available for public citizen reporting or does not exist.');
    }
    const projectTitle = publicProj.projectName;
    const projectLocation = `${publicProj.location?.district || ''}, ${publicProj.location?.state || ''}`.trim().replace(/^,\s*/, '');
    const constituency = publicProj.location?.constituency || 'Parliamentary Constituency';
    const projectNumber = publicProj.projectNumber || '';

    const year = new Date().getFullYear();
    const randomCode = Math.floor(100000 + Math.random() * 900000);
    const reportId = `CPR-${year}-${randomCode}`;
    const nowIso = new Date().toISOString();

    const report: CitizenProjectReport = {
      reportId,
      projectId,
      projectNameSnapshot: projectTitle,
      projectLocationSnapshot: projectLocation,
      constituencySnapshot: constituency,
      projectNumberSnapshot: projectNumber,
      reporterMode,
      reporterName: reporterMode === 'IDENTIFIED' ? input.reporterName?.trim() : undefined,
      reporterMobile: reporterMode === 'IDENTIFIED' ? input.reporterMobile?.trim() : undefined,
      natureOfAnomaly,
      specificEvidence: specificEvidence.trim(),
      locationDetails: (locationDetails || '').trim(),
      media: media.map((m) => ({
        mediaId: m.mediaId || `med-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: m.name || 'attachment.jpg',
        type: m.type || 'image/jpeg',
        size: Number(m.size) || 0,
        caption: m.caption,
        uploadedAt: m.uploadedAt || nowIso,
      })),
      submittedAt: nowIso,
      updatedAt: nowIso,
      status: 'SUBMITTED',
      isDemonstrationData: isDemoSession() || projectId.includes('demo') || projectId.includes('2026'),
    };

    // Record Append-Only Audit Event with actorRole: 'public'
    const eventId = `evt-cpr-${reportId}-${Date.now()}`;
    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId,
      action: 'CITIZEN_REPORT_SUBMITTED',
      actorId: reporterMode === 'IDENTIFIED' ? 'citizen-identified' : 'citizen-anonymous',
      actorRole: 'public',
      actorName: reporterMode === 'IDENTIFIED' ? 'Citizen (Identified Social Audit)' : 'Citizen (Anonymous Submission)',
      timestamp: nowIso,
      newState: {
        reportId,
        status: 'SUBMITTED',
        natureOfAnomaly,
      },
      metadata: {
        reportId,
        reporterMode,
        natureOfAnomaly,
        mediaCount: media.length,
      },
      notes: `Citizen social audit observation filed [${reportId}] on project "${projectTitle}". Status: SUBMITTED.`,
    };

    const isLive = isLiveFirestoreSession() && db;

    if (isLive) {
      const batch = writeBatch(db);
      const reportRef = doc(db, CITIZEN_REPORTS_COLLECTION, reportId);
      const auditRef = doc(db, AUDIT_EVENTS_COLLECTION, eventId);
      batch.set(reportRef, sanitizeFirestorePayload(report));
      batch.set(auditRef, sanitizeFirestorePayload(auditEvent));
      await batch.commit();
    } else {
      const local = getLocalReports();
      local.unshift(report);
      saveLocalReports(local);

      const localEvents = getLocalAuditEvents();
      localEvents.unshift(auditEvent);
      saveLocalAuditEvents(localEvents);
    }

    return {
      report,
      receipt: {
        reportId,
        submittedAt: nowIso,
        status: 'SUBMITTED',
        projectTitle,
        trackingNote:
          'Your report has been logged in the official BTI monitoring registry and queued for administrative review by the district nodal monitoring officer.',
      },
    };
  }

  /**
   * Retrieves reports for the Government Review Desk.
   * Access restricted to authorized government officers.
   */
  static async getReports(params: {
    projectId?: string;
    status?: CitizenReportStatus;
    search?: string;
  } = {}): Promise<CitizenProjectReport[]> {
    const { projectId, status, search = '' } = params;

    let reports: CitizenProjectReport[] = [];
    const isLive = isLiveFirestoreSession() && db;
    const isDemo = isDemoSession();
    const isExplicitDemoProject = Boolean(projectId && (projectId.startsWith('demo-') || projectId.startsWith('proj-demo-')));

    if (isLive && !isExplicitDemoProject) {
      try {
        const colRef = collection(db, CITIZEN_REPORTS_COLLECTION);
        let q = query(colRef, limit(100));

        if (projectId) {
          q = query(colRef, where('projectId', '==', projectId), limit(100));
        }

        const snap = await getDocs(q);
        snap.forEach((d) => reports.push(d.data() as CitizenProjectReport));
      } catch (err) {
        console.error('[CitizenReportService] Live Firestore error fetching reports:', err);
        // Live Firestore failure must NEVER silently display demonstration citizen reports
        throw err;
      }
    } else {
      reports = getLocalReports();
      if (reports.length === 0 && (isDemo || !isLive || isExplicitDemoProject)) {
        reports = [...DEMONSTRATION_CITIZEN_REPORTS];
        saveLocalReports(reports);
      }
    }

    // Filter by Project
    if (projectId) {
      reports = reports.filter((r) => r.projectId === projectId);
    }

    // Filter by Status
    if (status) {
      reports = reports.filter((r) => r.status === status);
    }

    // Filter by Keyword
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      reports = reports.filter(
        (r) =>
          r.reportId.toLowerCase().includes(s) ||
          r.projectNameSnapshot.toLowerCase().includes(s) ||
          r.constituencySnapshot.toLowerCase().includes(s) ||
          r.specificEvidence.toLowerCase().includes(s) ||
          (r.locationDetails && r.locationDetails.toLowerCase().includes(s)) ||
          r.natureOfAnomaly.toLowerCase().includes(s)
      );
    }

    // Sort descending by submittedAt
    reports.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    return reports;
  }

  /**
   * Retrieves all reports across all projects.
   */
  static async getAllReports(): Promise<CitizenProjectReport[]> {
    return this.getReports();
  }

  /**
   * Retrieves a single report by ID.
   * In a live session, queries Firestore authoritatively and strictly rejects demo fallback
   * unless explicitly targeting a demo record ID.
   */
  static async getReportById(reportId: string): Promise<CitizenProjectReport | null> {
    if (!reportId) return null;

    const isLive = isLiveFirestoreSession() && db;
    const isExplicitDemo = reportId.startsWith('CPR-DEMO-') || reportId.startsWith('demo-');

    if (isLive && !isExplicitDemo) {
      try {
        const docRef = doc(db, CITIZEN_REPORTS_COLLECTION, reportId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return snap.data() as CitizenProjectReport;
        }
        return null;
      } catch (err) {
        console.error(`[CitizenReportService] Live Firestore error fetching report ${reportId}:`, err);
        throw err;
      }
    }

    const local = getLocalReports();
    return local.find((r) => r.reportId === reportId) || DEMONSTRATION_CITIZEN_REPORTS.find((r) => r.reportId === reportId) || null;
  }

  /**
   * Updates report status during government triage.
   * Supports both (reportId, status, user, notes) and ({ reportId, newStatus, reviewNotes, user, exceptionId }) formats.
   */
  static async updateReportStatus(
    paramsOrId:
      | string
      | {
          reportId: string;
          newStatus?: CitizenReportStatus;
          status?: CitizenReportStatus;
          reviewNotes?: string;
          notes?: string;
          user?: any;
          exceptionCreated?: boolean;
          exceptionId?: string;
        },
    secondArgStatus?: CitizenReportStatus,
    thirdArgUser?: any,
    fourthArgNotes?: string
  ): Promise<CitizenProjectReport> {
    let reportId: string;
    let status: CitizenReportStatus;
    let user: any;
    let notes: string | undefined;
    let linkedExceptionId: string | undefined;

    if (typeof paramsOrId === 'object' && paramsOrId !== null) {
      reportId = paramsOrId.reportId;
      status = paramsOrId.newStatus || paramsOrId.status || 'UNDER_REVIEW';
      user = paramsOrId.user;
      notes = paramsOrId.reviewNotes || paramsOrId.notes;
      linkedExceptionId = paramsOrId.exceptionId;
    } else {
      reportId = paramsOrId as string;
      status = secondArgStatus!;
      user = thirdArgUser;
      notes = fourthArgNotes;
    }

    const userRole = (user?.role || '').toLowerCase();
    if (!userRole.includes('gov')) {
      throw new Error('Unauthorized: Citizen report review is restricted strictly to authorized government officers.');
    }

    const report = await this.getReportById(reportId);
    if (!report) {
      throw new Error(`Citizen report ${reportId} not found.`);
    }

    const nowIso = new Date().toISOString();
    const updated: CitizenProjectReport = {
      ...report,
      status,
      updatedAt: nowIso,
      reviewedBy: user?.id || user?.uid || 'gov-officer',
      reviewedByName: user?.name || user?.displayName || 'Authorized Officer',
      reviewedAt: nowIso,
      verificationNotes: notes || report.verificationNotes,
      reviewNotes: notes || report.reviewNotes,
      linkedExceptionId: linkedExceptionId || report.linkedExceptionId,
    };

    // Statutory Audit Event
    const eventId = `evt-cpr-status-${reportId}-${Date.now()}`;
    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId: report.projectId,
      action: 'CITIZEN_REPORT_STATUS_CHANGED',
      actorId: user?.id || user?.uid || 'gov-officer',
      actorRole: 'government',
      actorName: user?.name || user?.displayName || 'Authorized Officer',
      timestamp: nowIso,
      newState: {
        reportId,
        status,
        previousStatus: report.status,
      },
      metadata: {
        reportId,
        status,
        notes: notes || '',
      },
      notes: `Report [${reportId}] status transitioned from ${report.status} to ${status} by ${user?.name || 'Authorized Officer'}.`,
    };

    if (isLiveFirestoreSession() && db) {
      const batch = writeBatch(db);
      const docRef = doc(db, CITIZEN_REPORTS_COLLECTION, reportId);
      const auditRef = doc(db, AUDIT_EVENTS_COLLECTION, eventId);
      batch.update(docRef, sanitizeFirestorePayload(updated));
      batch.set(auditRef, sanitizeFirestorePayload(auditEvent));
      await batch.commit();
    } else {
      const events = getLocalAuditEvents();
      events.unshift(auditEvent);
      saveLocalAuditEvents(events);
    }

    const local = getLocalReports().filter((r) => r.reportId !== reportId);
    local.unshift(updated);
    saveLocalReports(local);

    return updated;
  }

  /**
   * Records official government verification decision.
   * Connects verified findings to the Phase 6/7/8 intelligence and exception architecture.
   */
  static async recordVerificationDecision(
    reportId: string,
    input: CitizenReportVerificationInput,
    user: any
  ): Promise<CitizenProjectReport> {
    const userRole = (user?.role || '').toLowerCase();
    if (!userRole.includes('gov')) {
      throw new Error('Unauthorized: Only authorized government officers can record verification decisions.');
    }

    const report = await this.getReportById(reportId);
    if (!report) {
      throw new Error(`Citizen report ${reportId} not found.`);
    }

    let { status, verificationDecision, verificationNotes, linkedFindingId, linkedFindingTitle, createProjectException, exceptionSeverity = 'MEDIUM', relatedReportIds } = input;

    // Unify to canonical status
    if (status === 'VERIFIED') {
      status = 'VERIFIED_DISCREPANCY';
    }

    if (!verificationNotes || verificationNotes.trim().length < 10) {
      throw new Error('Official verification notes and rationale must be at least 10 characters.');
    }

    const nowIso = new Date().toISOString();
    let linkedExceptionId = report.linkedExceptionId;
    let linkedExceptionTitle = report.linkedExceptionTitle;

    const isLive = isLiveFirestoreSession() && db;
    // We prepare the write batch for live sessions so all state transitions commit atomically
    const liveBatch = isLive ? writeBatch(db) : null;

    // Optional: Log official project monitoring exception if citizen discrepancy was substantiated
    if (createProjectException && status === 'VERIFIED_DISCREPANCY') {
      try {
        const exceptionResult = await ProjectService.createExceptionFromCitizenReport({
          projectId: report.projectId,
          report,
          user,
          severity: exceptionSeverity,
          verificationNotes,
          batch: liveBatch || undefined,
        });
        if (exceptionResult) {
          linkedExceptionId = exceptionResult.id;
          linkedExceptionTitle = exceptionResult.title;
        }
      } catch (err) {
        console.error('[CitizenReportService] Exception creation hook error:', err);
        throw new Error(
          `Failed to create institutional monitoring exception for verified report: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }

    const updated: CitizenProjectReport = {
      ...report,
      status,
      verificationDecision,
      verificationNotes: verificationNotes.trim(),
      reviewedBy: user?.id || user?.uid || 'gov-officer',
      reviewedByName: user?.name || user?.displayName || 'Authorized Officer',
      reviewedAt: nowIso,
      verifiedBy: user?.id || user?.uid || 'gov-officer',
      verifiedByName: user?.name || user?.displayName || 'Authorized Officer',
      verifiedAt: nowIso,
      linkedFindingId: linkedFindingId || report.linkedFindingId,
      linkedFindingTitle: linkedFindingTitle || report.linkedFindingTitle,
      linkedExceptionId,
      linkedExceptionTitle,
      relatedReportIds: relatedReportIds || report.relatedReportIds,
      updatedAt: nowIso,
    };

    // Statutory Audit Event
    const action: ProjectAuditAction = status === 'VERIFIED_DISCREPANCY'
      ? 'CITIZEN_REPORT_VERIFIED'
      : status === 'NOT_SUBSTANTIATED'
      ? 'CITIZEN_REPORT_NOT_SUBSTANTIATED'
      : status === 'DISMISSED'
      ? 'CITIZEN_REPORT_DISMISSED'
      : status === 'CLOSED'
      ? 'CITIZEN_REPORT_CLOSED'
      : status === 'VERIFICATION_REQUIRED'
      ? 'CITIZEN_REPORT_INFO_REQUESTED'
      : 'CITIZEN_REPORT_STATUS_CHANGED';

    const eventId = `evt-cpr-verif-${reportId}-${Date.now()}`;
    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId: report.projectId,
      action,
      actorId: user?.id || user?.uid || 'gov-officer',
      actorRole: 'government',
      actorName: user?.name || user?.displayName || 'Authorized Officer',
      timestamp: nowIso,
      newState: {
        reportId,
        status,
        verificationDecision,
        linkedFindingId: updated.linkedFindingId,
        linkedExceptionId: updated.linkedExceptionId,
      },
      metadata: {
        reportId,
        status,
        decision: verificationDecision,
        notes: verificationNotes,
      },
      notes: `Official verification decision recorded for Citizen Report [${reportId}]: ${status} (${verificationDecision || 'PROCESSED'}) by ${user?.name || 'Authorized Officer'}.`,
    };

    // Atomic write batch prevents partial verification states in Firestore
    if (liveBatch && db) {
      try {
        const docRef = doc(db, CITIZEN_REPORTS_COLLECTION, reportId);
        const auditRef = doc(db, AUDIT_EVENTS_COLLECTION, eventId);
        liveBatch.update(docRef, sanitizeFirestorePayload(updated));
        liveBatch.set(auditRef, sanitizeFirestorePayload(auditEvent));
        await liveBatch.commit();
      } catch (commitErr) {
        console.error('[CitizenReportService] Atomic batch commit error:', commitErr);
        throw new Error(
          `Failed to commit official verification decision for citizen report [${reportId}]: ${
            commitErr instanceof Error ? commitErr.message : String(commitErr)
          }`
        );
      }
    } else {
      const events = getLocalAuditEvents();
      events.unshift(auditEvent);
      saveLocalAuditEvents(events);
    }

    const local = getLocalReports().filter((r) => r.reportId !== reportId);
    local.unshift(updated);
    saveLocalReports(local);

    // Integrate verified finding into Evidence Chain (Phase 8) cache ONLY for demo/offline sessions.
    // In live Firestore sessions, citizenProjectReports/{reportId} is the authoritative source of truth.
    if (!isLive && status === 'VERIFIED_DISCREPANCY') {
      try {
        await EvidenceChainService.addCitizenReportEvidence({
          projectId: report.projectId,
          reportId: report.reportId,
          title: `Citizen Social Audit Discrepancy: ${CITIZEN_REPORT_NATURE_LABELS[report.natureOfAnomaly]?.label || report.natureOfAnomaly}`,
          summary: report.specificEvidence,
          severity: exceptionSeverity,
          natureOfAnomaly: report.natureOfAnomaly,
          specificEvidence: report.specificEvidence,
          reporterMode: report.reporterMode,
          locationDetails: report.locationDetails,
          createdExceptionId: linkedExceptionId,
          linkedFindingId: linkedFindingId || report.linkedFindingId,
          linkedFindingTitle: linkedFindingTitle || report.linkedFindingTitle,
          officerName: user?.name || user?.displayName || 'District Nodal Officer',
          timestamp: nowIso,
          relevance: `Substantiated field observation lead verified by nodal officer and linked to project registers.`,
          metadata: {
            verificationDecision,
            verificationNotes,
          },
        });
      } catch (err) {
        console.warn('[CitizenReportService] Non-authoritative demo evidence cache sync warning:', err);
      }
    }

    return updated;
  }

  /**
   * Generates or retrieves advisory comparison for a citizen report.
   * Supports both generateAdvisoryComparison(report) and generateAdvisoryComparison(projectId, report).
   */
  static async generateAdvisoryComparison(
    param1: string | CitizenProjectReport,
    param2?: CitizenProjectReport | string
  ): Promise<CitizenReportAdvisoryResult> {
    const report = typeof param1 === 'object' ? param1 : (param2 as CitizenProjectReport);
    return this.getCitizenReportAdvisory(report);
  }

  /**
   * Pre-review AI Evidence Comparison & Advisory.
   * Calls server-side AI evaluation to assist government officers in comparing citizen claims
   * against authoritative ground truth (milestones, physical progress, financial records, inspections).
   * Server-authoritative: strictly sends bearer credentials and prevents client-side bypassing.
   */
  static async getCitizenReportAdvisory(
    report: CitizenProjectReport,
    userToken?: string
  ): Promise<CitizenReportAdvisoryResult> {
    let token = userToken;
    if (!token && auth && auth.currentUser) {
      try {
        token = await auth.currentUser.getIdToken();
      } catch (tokenErr) {
        console.warn('[CitizenReportService] Unable to retrieve Firebase ID token:', tokenErr);
      }
    }
    if (!token && !isLiveFirestoreSession()) {
      token = 'bti-demo-token-government';
    }

    if (!token) {
      throw new Error(
        'Authentication required: An active government officer session token is required to evaluate citizen report AI advisory.'
      );
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    let response: Response;
    try {
      response = await fetch('/api/ai/project-risk-intelligence', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId: report.projectId,
          reportId: report.reportId,
          mode: 'CITIZEN_REPORT_ADVISORY',
          report,
        }),
      });
    } catch (networkErr: any) {
      if (isLiveFirestoreSession()) {
        throw new Error(
          `Server connection failed: Unable to reach AI risk intelligence server (${networkErr.message || 'Offline'}).`
        );
      }
      console.warn('[CitizenReportService] AI server advisory network failure in demo mode, providing grounded fallback:', networkErr);
      return this.buildDeterministicAdvisory(report);
    }

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const serverErrMsg = errJson.error || errJson.message || `Server responded with status ${response.status}`;
      throw new Error(`AI Advisory evaluation rejected by server (${response.status}): ${serverErrMsg}`);
    }

    const json = await response.json();
    if (json.advisory || json.assessment) {
      return json.advisory || json.assessment;
    }

    throw new Error('Invalid server response: Advisory evaluation payload missing from server output.');
  }

  /**
   * Pure deterministic fallback comparator when server-side AI is offline or key is unconfigured.
   */
  private static async buildDeterministicAdvisory(
    report: CitizenProjectReport
  ): Promise<CitizenReportAdvisoryResult> {
    const project = await ProjectService.getProjectById(report.projectId);
    const milestones = await ProjectService.getMilestones(report.projectId);
    const financials = await ProjectService.getFinancialRecords(report.projectId);
    const inspections = await ProjectService.getInspections(report.projectId);

    const verifiedFinancials = financials.filter((f) => f.verificationStatus === 'VERIFIED');
    const totalVerified = verifiedFinancials.reduce((sum, f) => sum + Number(f.amount || 0), 0);
    const sanctioned = Number(project?.sanctionedAmount || 1);
    const utilizationPct = Math.round((totalVerified / sanctioned) * 100);

    const completedMilestones = milestones
      .filter((m) => m.status === 'COMPLETED')
      .map((m) => m.title);
    const pendingMilestones = milestones
      .filter((m) => m.status !== 'COMPLETED')
      .map((m) => `${m.title} (${m.progressPercent}%)`);

    const latestInspection = inspections[inspections.length - 1];

    let consistency: 'CONSISTENT' | 'INCONCLUSIVE' | 'INCONSISTENT' | 'INSUFFICIENT_EVIDENCE' = 'INCONCLUSIVE';
    let summary = '';

    if (report.natureOfAnomaly === 'GHOST_PROJECT' || report.natureOfAnomaly === 'PROGRESS_MISREPRESENTATION') {
      if ((project?.physicalProgressPercent || 0) > 40) {
        consistency = 'CONSISTENT';
        summary = `Official records show ${project?.physicalProgressPercent}% physical completion with ${completedMilestones.length} milestones marked completed. The citizen reports significant physical divergence on site. Observation warrants priority on-site engineering verification.`;
      } else {
        consistency = 'INCONCLUSIVE';
        summary = `Citizen claims physical divergence. Current project baseline records ${project?.physicalProgressPercent || 0}% completion. A field inspection is required to substantiate divergence.`;
      }
    } else if (report.natureOfAnomaly === 'FINANCIAL_WORK_MISMATCH') {
      consistency = utilizationPct > 50 && (project?.physicalProgressPercent || 0) < 30 ? 'CONSISTENT' : 'INCONCLUSIVE';
      summary = `Verified financial utilization stands at ₹${totalVerified.toLocaleString('en-IN')} (${utilizationPct}%). Physical progress is currently recorded at ${project?.physicalProgressPercent || 0}%. Cross-comparison suggests checking voucher measurements against site book.`;
    } else {
      consistency = report.media && report.media.length > 0 ? 'CONSISTENT' : 'INCONCLUSIVE';
      summary = `Citizen logged observation under "${CITIZEN_REPORT_NATURE_LABELS[report.natureOfAnomaly]?.label || report.natureOfAnomaly}". Official records confirm project is active.`;
    }

    return {
      advisorySummary: summary,
      evidenceConsistency: consistency,
      visualEvidenceAssessment:
        report.media && report.media.length > 0
          ? `${report.media.length} visual asset(s) metadata attached. Multi-modal vision analysis was not performed in this text-based evaluation pass; metadata indicates ${report.media.length} file(s) present. Ground-level physical verification by an authorized engineering officer is required.`
          : 'No visual attachments submitted. Observation relies on citizen textual description and location details.',
      officialComparison: {
        milestoneComparison: {
          claimedDiscrepancy: report.specificEvidence,
          officialReportedProgress: project?.physicalProgressPercent || 0,
          completedMilestones,
          pendingMilestones,
        },
        financialComparison: {
          sanctionedAmount: sanctioned,
          verifiedExpenditure: totalVerified,
          utilizationPercent: utilizationPct,
        },
        inspectionComparison: latestInspection
          ? {
              lastInspectionDate: latestInspection.inspectionDate,
              lastInspectedProgress: latestInspection.physicalProgressObserved ?? latestInspection.governmentVerifiedPhysicalProgressPercent ?? 0,
              findingsSummary: latestInspection.observations || '',
            }
          : undefined,
      },
      recommendedVerificationAreas: [
        'Conduct physical field inspection with geo-tagged photographic documentation',
        'Verify measurement book (MB) entries against current physical stage',
        'Inspect raw material delivery challans and quality testing certificates',
      ],
      missingEvidence: [
        'Statutory technical engineering inspection report',
        'Certified contractor measurement sheets',
      ],
      limitations:
        'Advisory assessment only. Citizen observations are preliminary evidence leads and do not constitute an official finding. Human verification and statutory engineering inspection by an authorized officer are required.',
      generatedAt: new Date().toISOString(),
    };
  }
}
