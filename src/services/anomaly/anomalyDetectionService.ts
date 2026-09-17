// Bharat Tender Intelligence (BTI) — Anomaly & Risk Intelligence Service
// Phase 7: MPLAD Anomaly & Risk Intelligence Foundation
// Implements deterministic anomaly engine, explainable risk scoring, AI boundary integration, and audit logging.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../firebase/firebase';
import {
  ProjectAnomaly,
  AnomalyType,
  AnomalySeverity,
  AnomalyStatus,
  AnomalyEvidenceReference,
  AnomalySupportingMetrics,
  ProjectRiskAssessment,
  ProjectRiskScoreBreakdown,
  RiskLevel,
  RiskIntelligenceResult,
  VALID_ANOMALY_STATUS_TRANSITIONS,
  isValidAnomalyTransition,
} from '../../types/anomaly';
import {
  Project,
  ProjectMilestone,
  ProjectProgressUpdate,
  ProjectFinancialRecord,
  ProjectInspection,
  ProjectAuditEvent,
} from '../../types/project';
import { AuthUser } from '../../types/auth';
import { AuthService } from '../authService';
import { ProjectService, isLiveFirestoreSession, sanitizeFirestorePayload } from '../firebase/projects';
import {
  DEMONSTRATION_PROJECTS,
  DEMONSTRATION_MILESTONES,
  DEMONSTRATION_PROGRESS_UPDATES,
  DEMONSTRATION_FINANCIAL_RECORDS,
  DEMONSTRATION_INSPECTIONS,
} from '../../data/demonstrationProjects';

const ANOMALIES_COLLECTION = 'projectAnomalies';
const RISK_ASSESSMENTS_COLLECTION = 'projectRiskAssessments';
const AUDIT_EVENTS_COLLECTION = 'projectAuditEvents';

const LOCAL_STORAGE_ANOMALIES_KEY = 'bti_project_anomalies_cache_v1';
const LOCAL_STORAGE_RISK_ASSESSMENTS_KEY = 'bti_project_risk_assessments_cache_v1';
const LOCAL_STORAGE_AUDIT_EVENTS_KEY = 'bti_project_audit_events_cache_v1';

function getLocalItems<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocalItems<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.warn(`[AnomalyDetectionService] Failed to cache ${key} locally:`, err);
  }
}

export class AnomalyDetectionService {
  /**
   * Version of the deterministic anomaly engine
   */
  static readonly ENGINE_VERSION = '1.0.0-phase7';

  /**
   * Returns all detected anomalies across all projects for government intelligence view.
   */
  static async getAllAnomalies(): Promise<ProjectAnomaly[]> {
    try {
      const demoProjects = await ProjectService.getProjects();
      for (const p of demoProjects) {
        await this.runDeterministicAnomalyChecks(p.id);
      }
    } catch (err) {
      console.warn('[AnomalyDetectionService] Error evaluating live project anomalies in getAllAnomalies:', err);
    }

    let list: ProjectAnomaly[] = [];

    if (isLiveFirestoreSession() && db) {
      try {
        const snap = await getDocs(collection(db, ANOMALIES_COLLECTION));
        snap.forEach((d) => list.push(d.data() as ProjectAnomaly));
      } catch (err) {
        console.warn('[AnomalyDetectionService] Failed to read live anomalies, falling back to local/derived:', err);
      }
    }

    if (list.length === 0) {
      list = getLocalItems<ProjectAnomaly>(LOCAL_STORAGE_ANOMALIES_KEY, []);
    }

    return list;
  }

  /**
   * Evaluates current deterministic anomaly conditions and returns all project anomalies
   * (both actively triggered conditions and historical findings preserved for audit).
   */
  static async getProjectAnomalies(projectId: string): Promise<ProjectAnomaly[]> {
    if (!projectId) return [];

    try {
      // Re-evaluate deterministic anomaly rules against current milestone/financial/progress state.
      // This preserves all historical findings, marks cleared conditions as isConditionActive: false,
      // updates deterministic scores using only active anomalies, and prevents duplicates.
      return await this.runDeterministicAnomalyChecks(projectId);
    } catch (err) {
      console.warn(
        `[AnomalyDetectionService] Live deterministic re-evaluation for project "${projectId}" failed, falling back to stored findings:`,
        err
      );
      return await this.fetchRawAnomalies(projectId);
    }
  }

  /**
   * Executes the 10 deterministic anomaly rules against authoritative project records:
   * Rule A: PHYSICAL PROGRESS VS FINANCIAL EXPENDITURE DIVERGENCE
   * Rule B: MILESTONE DELAY
   * Rule C: REPEATED MILESTONE DELAYS
   * Rule D: EXPENDITURE ACCELERATION
   * Rule E: AWARDED VALUE / EXPENDITURE OVER-RUN
   * Rule F: LONG REPORTING GAP
   * Rule G: INSPECTION VS REPORTED PROGRESS DIVERGENCE
   * Rule H: REPEATED CORRECTIVE ACTIONS
   * Rule I: CONFLICTING IMPLEMENTATION RECORDS
   * Rule J: PROJECT STAGNATION
   */
  static async runDeterministicAnomalyChecks(projectId: string): Promise<ProjectAnomaly[]> {
    const project = await ProjectService.getProjectById(projectId);
    if (!project) return [];

    const milestones = await ProjectService.getMilestones(projectId);
    const updates = await ProjectService.getProgressUpdates(projectId);
    const financialRecords = await ProjectService.getFinancialRecords(projectId);
    const inspections = await ProjectService.getInspections(projectId);

    // Fetch existing anomalies to preserve manual investigation status (RESOLVED, DISMISSED, ACKNOWLEDGED, UNDER_REVIEW)
    const existingAnomalies = await this.fetchRawAnomalies(projectId);
    const existingMap = new Map<string, ProjectAnomaly>(existingAnomalies.map((a) => [a.id, a]));

    // Occurrence resolution helper for deterministic anomalies.
    // Enforces the lifecycle integrity rule:
    // - RESOLVED and DISMISSED anomalies are terminal historical occurrences and must never transition back to active states.
    // - If an existing occurrence is active / non-terminal (OPEN, UNDER_REVIEW, ACKNOWLEDGED), continue updating/reusing it.
    // - If prior occurrences were terminal (RESOLVED or DISMISSED) and the condition becomes active again:
    //    - preserve the old terminal document unchanged;
    //    - create a NEW active anomaly occurrence with a unique occurrence ID;
    //    - new occurrence status = OPEN, isConditionActive = true;
    //    - preserve the existing deterministic anomaly type/indicator/category so the recurrence remains traceable to the same rule.
    const resolveOccurrence = (baseRuleId: string): {
      occurrenceId: string;
      existing?: ProjectAnomaly;
    } => {
      const matching = existingAnomalies.filter(
        (a) => a.id === baseRuleId || a.id.startsWith(`${baseRuleId}-`) || a.ruleKey === baseRuleId
      );

      // Prioritize most recent active/non-terminal occurrence (OPEN, UNDER_REVIEW, ACKNOWLEDGED)
      const activeExisting = matching
        .filter((a) => a.status !== 'RESOLVED' && a.status !== 'DISMISSED')
        .sort((a, b) => new Date(b.detectedAt || 0).getTime() - new Date(a.detectedAt || 0).getTime())[0];

      if (activeExisting) {
        return {
          occurrenceId: activeExisting.id,
          existing: activeExisting,
        };
      }

      // Check if there are previous terminal occurrences (RESOLVED or DISMISSED)
      const hasTerminal = matching.some(
        (a) => a.status === 'RESOLVED' || a.status === 'DISMISSED'
      );

      if (hasTerminal) {
        // Recurrence after terminal state: create a NEW active occurrence with a unique occurrence ID
        const newOccurrenceId = `${baseRuleId}-rec-${Date.now()}`;
        return {
          occurrenceId: newOccurrenceId,
          existing: undefined,
        };
      }

      // Initial occurrence (first time detected)
      return {
        occurrenceId: baseRuleId,
        existing: undefined,
      };
    };

    const now = new Date();
    const evaluatedAnomalies: ProjectAnomaly[] = [];

    // Helper to calculate total verified financial expenditure
    const verifiedFinancialRecords = financialRecords.filter((f) => f.verificationStatus === 'VERIFIED');
    const totalVerifiedExpenditure = verifiedFinancialRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const awardedBudget = Number(project.awardedAmount || project.sanctionedAmount || 1);
    const financialUtilizationPercent = Math.min(100, Math.round((totalVerifiedExpenditure / awardedBudget) * 100));

    // Logical precedence: governmentVerifiedPhysicalProgressPercent takes precedence over agency/project reported progress
    const physicalProgressPercent = Number(
      project.governmentVerifiedPhysicalProgressPercent !== undefined &&
        project.governmentVerifiedPhysicalProgressPercent !== null
        ? project.governmentVerifiedPhysicalProgressPercent
        : (project.agencyReportedPhysicalProgressPercent ?? project.physicalProgressPercent ?? 0)
    );

    // -------------------------------------------------------------
    // RULE A: PHYSICAL PROGRESS VS FINANCIAL EXPENDITURE DIVERGENCE
    // -------------------------------------------------------------
    const divergencePercent = financialUtilizationPercent - physicalProgressPercent;
    if (divergencePercent >= 15 && awardedBudget > 0) {
      let severity: AnomalySeverity = 'LOW';
      if (divergencePercent >= 45) severity = 'CRITICAL';
      else if (divergencePercent >= 30) severity = 'HIGH';
      else if (divergencePercent >= 20) severity = 'MEDIUM';

      const baseRuleId = `anom-div-${projectId}`;
      const { occurrenceId: anomalyId, existing } = resolveOccurrence(baseRuleId);

      const evidence: AnomalyEvidenceReference[] = [
        {
          entityType: 'PROJECT',
          entityId: project.id,
          label: `Authoritative Contract Award: ₹${awardedBudget.toLocaleString('en-IN')}`,
          detail: `Physical progress: ${physicalProgressPercent}%`,
        },
        ...verifiedFinancialRecords.slice(0, 3).map((f) => ({
          entityType: 'FINANCIAL_RECORD' as const,
          entityId: f.id,
          label: `Verified Invoice ${f.referenceNumber || f.id}: ₹${Number(f.amount).toLocaleString('en-IN')}`,
          detail: f.description,
          date: f.entryDate,
        })),
      ];

      evaluatedAnomalies.push({
        id: anomalyId,
        projectId,
        projectNumber: project.projectNumber,
        projectTitle: project.title,
        organizationId: project.organizationId,
        agencyName: project.implementingAgencyName || project.agencyName,
        type: 'PHYSICAL_FINANCIAL_DIVERGENCE',
        severity,
        title: 'Physical vs Financial Utilization Divergence',
        explanation: `Significant divergence of ${divergencePercent}% observed between reported physical completion (${physicalProgressPercent}%) and verified financial utilization (${financialUtilizationPercent}%).`,
        detectedAt: existing?.detectedAt || now.toISOString(),
        status: existing?.status || 'OPEN',
        evidence,
        metrics: {
          physicalProgressPercent,
          financialUtilizationPercent,
          divergencePercent,
          awardedAmount: awardedBudget,
          verifiedExpenditure: totalVerifiedExpenditure,
        },
        ruleVersion: this.ENGINE_VERSION,
        ruleKey: baseRuleId,
        detectionSource: 'SYSTEM_RULE',
        acknowledgedBy: existing?.acknowledgedBy,
        acknowledgedByName: existing?.acknowledgedByName,
        acknowledgedAt: existing?.acknowledgedAt,
        underReviewBy: existing?.underReviewBy,
        underReviewByName: existing?.underReviewByName,
        underReviewAt: existing?.underReviewAt,
        resolvedAt: existing?.resolvedAt,
        resolvedBy: existing?.resolvedBy,
        resolvedByName: existing?.resolvedByName,
        resolutionNote: existing?.resolutionNote,
        dismissedAt: existing?.dismissedAt,
        dismissedBy: existing?.dismissedBy,
        dismissedByName: existing?.dismissedByName,
        dismissalReason: existing?.dismissalReason,
      });
    }

    // -------------------------------------------------------------
    // RULE B & C: MILESTONE DELAYS, PRE-DEADLINE PRESSURE & REPEATED DELAYS
    // -------------------------------------------------------------
    const delayedMilestones: { milestone: ProjectMilestone; daysDelayed: number }[] = [];

    for (const ms of milestones) {
      if (ms.status !== 'COMPLETED' && ms.plannedEndDate) {
        const plannedEnd = new Date(ms.plannedEndDate);
        if (!isNaN(plannedEnd.getTime())) {
          if (now > plannedEnd) {
            const daysOverdue = Math.floor((now.getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24));
            if (daysOverdue > 7) {
              delayedMilestones.push({ milestone: ms, daysDelayed: daysOverdue });

              // Rule B: Single Milestone Delay
              const msBaseRuleId = `anom-ms-delay-${ms.id}`;
              const { occurrenceId: msAnomalyId, existing: existingMs } = resolveOccurrence(msBaseRuleId);
              const msSeverity: AnomalySeverity = daysOverdue > 60 ? 'HIGH' : daysOverdue > 30 ? 'MEDIUM' : 'LOW';

              evaluatedAnomalies.push({
                id: msAnomalyId,
                projectId,
                projectNumber: project.projectNumber,
                projectTitle: project.title,
                organizationId: project.organizationId,
                agencyName: project.implementingAgencyName || project.agencyName,
                type: 'MILESTONE_DELAY',
                severity: msSeverity,
                title: `Milestone Overdue: ${ms.title}`,
                explanation: `Milestone #${ms.sequence} is overdue by ${daysDelayedToReadable(daysOverdue)} relative to the planned schedule. Planned completion was ${plannedEnd.toLocaleDateString('en-IN')}; current progress is ${ms.progressPercent}%.`,
                detectedAt: existingMs?.detectedAt || now.toISOString(),
                status: existingMs?.status || 'OPEN',
                evidence: [
                  {
                    entityType: 'MILESTONE',
                    entityId: ms.id,
                    label: `Milestone #${ms.sequence}: ${ms.title}`,
                    detail: `Weight: ${ms.weightPercent}%, Current Progress: ${ms.progressPercent}%`,
                    date: ms.plannedEndDate,
                  },
                ],
                metrics: {
                  daysDelayed: daysOverdue,
                  physicalProgressPercent: ms.progressPercent,
                },
                ruleVersion: this.ENGINE_VERSION,
                ruleKey: msBaseRuleId,
                detectionSource: 'SYSTEM_RULE',
                acknowledgedBy: existingMs?.acknowledgedBy,
                acknowledgedByName: existingMs?.acknowledgedByName,
                acknowledgedAt: existingMs?.acknowledgedAt,
                underReviewBy: existingMs?.underReviewBy,
                underReviewByName: existingMs?.underReviewByName,
                underReviewAt: existingMs?.underReviewAt,
                resolvedAt: existingMs?.resolvedAt,
                resolvedBy: existingMs?.resolvedBy,
                resolvedByName: existingMs?.resolvedByName,
                resolutionNote: existingMs?.resolutionNote,
                dismissedAt: existingMs?.dismissedAt,
                dismissedBy: existingMs?.dismissedBy,
                dismissedByName: existingMs?.dismissedByName,
                dismissalReason: existingMs?.dismissalReason,
              });
            }
          } else {
            // Pre-deadline Schedule Pressure Check for incomplete milestones approaching deadline
            const remainingDays = Math.max(0, Math.ceil((plannedEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            const currentProgress = Math.max(0, Math.min(100, Number(ms.progressPercent ?? 0)));
            const remainingWork = 100 - currentProgress;

            if (currentProgress < 100 && remainingWork >= 20) {
              let elapsedDurationRatio: number | null = null;
              if (ms.plannedStartDate) {
                const plannedStart = new Date(ms.plannedStartDate);
                if (!isNaN(plannedStart.getTime()) && plannedEnd > plannedStart) {
                  const totalPlannedDays = Math.max(1, (plannedEnd.getTime() - plannedStart.getTime()) / (1000 * 60 * 60 * 24));
                  const elapsedDays = Math.max(0, (now.getTime() - plannedStart.getTime()) / (1000 * 60 * 60 * 24));
                  elapsedDurationRatio = Math.min(1, elapsedDays / totalPlannedDays);
                }
              }

              // Evaluate deterministic schedule pressure conditions
              const isImminentPressure =
                (remainingDays <= 1 && remainingWork >= 15) ||
                (remainingDays <= 3 && remainingWork >= 20) ||
                (remainingDays <= 7 && remainingWork >= 30) ||
                (remainingDays <= 14 && remainingWork >= 40) ||
                (remainingDays <= 30 && remainingWork >= 60);

              const isDurationCompressionPressure =
                elapsedDurationRatio !== null &&
                elapsedDurationRatio >= 0.70 &&
                remainingWork >= 40 &&
                (currentProgress / 100) < (elapsedDurationRatio - 0.30);

              if (isImminentPressure || isDurationCompressionPressure) {
                const msPressureBaseRuleId = `anom-ms-pressure-${ms.id}`;
                const { occurrenceId: msPressureAnomalyId, existing: existingPressure } = resolveOccurrence(msPressureBaseRuleId);

                let pressureSeverity: AnomalySeverity = 'LOW';
                if ((remainingDays <= 1 && remainingWork >= 50) || (remainingDays <= 3 && remainingWork >= 75)) {
                  pressureSeverity = 'CRITICAL';
                } else if (remainingDays <= 7 && remainingWork >= 50) {
                  pressureSeverity = 'HIGH';
                } else if (remainingDays <= 14 && remainingWork >= 40) {
                  pressureSeverity = 'MEDIUM';
                } else if (remainingDays <= 30 || remainingWork >= 30) {
                  pressureSeverity = 'LOW';
                }

                const readableRemaining =
                  remainingDays === 0
                    ? 'less than 24 hours'
                    : remainingDays === 1
                    ? '1 day'
                    : `${remainingDays} days`;

                evaluatedAnomalies.push({
                  id: msPressureAnomalyId,
                  projectId,
                  projectNumber: project.projectNumber,
                  projectTitle: project.title,
                  organizationId: project.organizationId,
                  agencyName: project.implementingAgencyName || project.agencyName,
                  type: 'MILESTONE_SCHEDULE_PRESSURE',
                  severity: pressureSeverity,
                  title: `Pre-Deadline Schedule Pressure: ${ms.title}`,
                  explanation: `Milestone #${ms.sequence} ("${ms.title}") is approaching its planned completion date (${plannedEnd.toLocaleDateString('en-IN')}) with ${readableRemaining} remaining while ${remainingWork}% of physical scope remains incomplete (current progress: ${currentProgress}%). Proactive schedule acceleration and resource mobilization are advised prior to deadline breach.`,
                  detectedAt: existingPressure?.detectedAt || now.toISOString(),
                  status: existingPressure?.status || 'OPEN',
                  evidence: [
                    {
                      entityType: 'MILESTONE',
                      entityId: ms.id,
                      label: `Milestone #${ms.sequence}: ${ms.title}`,
                      detail: `Weight: ${ms.weightPercent}%, Current Progress: ${currentProgress}%, Incomplete Scope: ${remainingWork}%, Days to Deadline: ${remainingDays}`,
                      date: ms.plannedEndDate,
                    },
                  ],
                  metrics: {
                    daysRemaining: remainingDays,
                    physicalProgressPercent: currentProgress,
                    remainingWorkPercent: remainingWork,
                    plannedEndDate: ms.plannedEndDate,
                  },
                  ruleVersion: this.ENGINE_VERSION,
                  ruleKey: msPressureBaseRuleId,
                  detectionSource: 'SYSTEM_RULE',
                  acknowledgedBy: existingPressure?.acknowledgedBy,
                  acknowledgedByName: existingPressure?.acknowledgedByName,
                  acknowledgedAt: existingPressure?.acknowledgedAt,
                  underReviewBy: existingPressure?.underReviewBy,
                  underReviewByName: existingPressure?.underReviewByName,
                  underReviewAt: existingPressure?.underReviewAt,
                  resolvedAt: existingPressure?.resolvedAt,
                  resolvedBy: existingPressure?.resolvedBy,
                  resolvedByName: existingPressure?.resolvedByName,
                  resolutionNote: existingPressure?.resolutionNote,
                  dismissedAt: existingPressure?.dismissedAt,
                  dismissedBy: existingPressure?.dismissedBy,
                  dismissedByName: existingPressure?.dismissedByName,
                  dismissalReason: existingPressure?.dismissalReason,
                });
              }
            }
          }
        }
      }
    }

    // Rule C: Repeated Milestone Delays across project
    if (delayedMilestones.length >= 2) {
      const repBaseRuleId = `anom-rep-ms-${projectId}`;
      const { occurrenceId: repAnomalyId, existing: existingRep } = resolveOccurrence(repBaseRuleId);

      evaluatedAnomalies.push({
        id: repAnomalyId,
        projectId,
        projectNumber: project.projectNumber,
        projectTitle: project.title,
        organizationId: project.organizationId,
        agencyName: project.implementingAgencyName || project.agencyName,
        type: 'REPEATED_MILESTONE_DELAYS',
        severity: delayedMilestones.length >= 3 ? 'CRITICAL' : 'HIGH',
        title: 'Repeated Schedule Delays Across Project Milestones',
        explanation: `Systemic implementation delay identified: ${delayedMilestones.length} distinct milestones are overdue relative to approved project timelines.`,
        detectedAt: existingRep?.detectedAt || now.toISOString(),
        status: existingRep?.status || 'OPEN',
        evidence: delayedMilestones.map((dm) => ({
          entityType: 'MILESTONE' as const,
          entityId: dm.milestone.id,
          label: `Milestone #${dm.milestone.sequence} (${dm.milestone.title})`,
          detail: `Overdue by ${dm.daysDelayed} days (Progress: ${dm.milestone.progressPercent}%)`,
          date: dm.milestone.plannedEndDate,
        })),
        metrics: {
          delayedMilestoneCount: delayedMilestones.length,
          daysDelayed: Math.max(...delayedMilestones.map((d) => d.daysDelayed)),
        },
        ruleVersion: this.ENGINE_VERSION,
        ruleKey: repBaseRuleId,
        detectionSource: 'SYSTEM_RULE',
        acknowledgedBy: existingRep?.acknowledgedBy,
        acknowledgedByName: existingRep?.acknowledgedByName,
        acknowledgedAt: existingRep?.acknowledgedAt,
        underReviewBy: existingRep?.underReviewBy,
        underReviewByName: existingRep?.underReviewByName,
        underReviewAt: existingRep?.underReviewAt,
        resolvedAt: existingRep?.resolvedAt,
        resolvedBy: existingRep?.resolvedBy,
        resolvedByName: existingRep?.resolvedByName,
        resolutionNote: existingRep?.resolutionNote,
        dismissedAt: existingRep?.dismissedAt,
        dismissedBy: existingRep?.dismissedBy,
        dismissedByName: existingRep?.dismissedByName,
        dismissalReason: existingRep?.dismissalReason,
      });
    }

    // -------------------------------------------------------------
    // RULE D: EXPENDITURE ACCELERATION
    // -------------------------------------------------------------
    if (verifiedFinancialRecords.length >= 2 && awardedBudget > 0) {
      const sortedRecords = [...verifiedFinancialRecords].sort(
        (a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
      );

      // Check for clusters within 14 days where >= 40% of total budget was verified
      for (let i = 0; i < sortedRecords.length; i++) {
        const startRecord = sortedRecords[i];
        const startDate = new Date(startRecord.entryDate).getTime();
        let windowAmount = 0;
        const windowRecords: ProjectFinancialRecord[] = [];

        for (let j = i; j < sortedRecords.length; j++) {
          const recDate = new Date(sortedRecords[j].entryDate).getTime();
          const diffDays = (recDate - startDate) / (1000 * 60 * 60 * 24);
          if (diffDays <= 14) {
            windowAmount += Number(sortedRecords[j].amount) || 0;
            windowRecords.push(sortedRecords[j]);
          } else {
            break;
          }
        }

        const accelerationPct = (windowAmount / awardedBudget) * 100;
        if (accelerationPct >= 35 && windowRecords.length >= 2) {
          const accelBaseRuleId = `anom-accel-${projectId}`;
          const { occurrenceId: accelAnomalyId, existing: existingAccel } = resolveOccurrence(accelBaseRuleId);

          evaluatedAnomalies.push({
            id: accelAnomalyId,
            projectId,
            projectNumber: project.projectNumber,
            projectTitle: project.title,
            organizationId: project.organizationId,
            agencyName: project.implementingAgencyName || project.agencyName,
            type: 'EXPENDITURE_ACCELERATION',
            severity: accelerationPct >= 50 ? 'HIGH' : 'MEDIUM',
            title: 'Unusual Expenditure Acceleration Detected',
            explanation: `Rapid financial billing detected: ₹${windowAmount.toLocaleString('en-IN')} (${Math.round(accelerationPct)}% of total awarded contract) claimed and verified within a 14-day window.`,
            detectedAt: existingAccel?.detectedAt || now.toISOString(),
            status: existingAccel?.status || 'OPEN',
            evidence: windowRecords.map((wr) => ({
              entityType: 'FINANCIAL_RECORD' as const,
              entityId: wr.id,
              label: `Invoice ${wr.referenceNumber || wr.id}: ₹${Number(wr.amount).toLocaleString('en-IN')}`,
              detail: wr.description,
              date: wr.entryDate,
            })),
            metrics: {
              accelerationWindowDays: 14,
              acceleratedAmount: windowAmount,
              acceleratedPercentage: Math.round(accelerationPct),
              awardedAmount: awardedBudget,
            },
            ruleVersion: this.ENGINE_VERSION,
            ruleKey: accelBaseRuleId,
            detectionSource: 'SYSTEM_RULE',
            acknowledgedBy: existingAccel?.acknowledgedBy,
            acknowledgedByName: existingAccel?.acknowledgedByName,
            acknowledgedAt: existingAccel?.acknowledgedAt,
            underReviewBy: existingAccel?.underReviewBy,
            underReviewByName: existingAccel?.underReviewByName,
            underReviewAt: existingAccel?.underReviewAt,
            resolvedAt: existingAccel?.resolvedAt,
            resolvedBy: existingAccel?.resolvedBy,
            resolvedByName: existingAccel?.resolvedByName,
            resolutionNote: existingAccel?.resolutionNote,
            dismissedAt: existingAccel?.dismissedAt,
            dismissedBy: existingAccel?.dismissedBy,
            dismissedByName: existingAccel?.dismissedByName,
            dismissalReason: existingAccel?.dismissalReason,
          });
          break; // Flag once
        }
      }
    }

    // -------------------------------------------------------------
    // RULE E: AWARDED VALUE / EXPENDITURE OVER-RUN
    // -------------------------------------------------------------
    if (totalVerifiedExpenditure > awardedBudget && awardedBudget > 0) {
      const overrunAmount = totalVerifiedExpenditure - awardedBudget;
      const overrunBaseRuleId = `anom-overrun-${projectId}`;
      const { occurrenceId: overrunAnomalyId, existing: existingOverrun } = resolveOccurrence(overrunBaseRuleId);

      evaluatedAnomalies.push({
        id: overrunAnomalyId,
        projectId,
        projectNumber: project.projectNumber,
        projectTitle: project.title,
        organizationId: project.organizationId,
        agencyName: project.implementingAgencyName || project.agencyName,
        type: 'AWARDED_VALUE_OVERRUN',
        severity: 'HIGH',
        title: 'Verified Expenditure Exceeds Awarded Contract Value',
        explanation: `Total verified expenditure of ₹${totalVerifiedExpenditure.toLocaleString('en-IN')} exceeds the sanctioned/awarded contract value of ₹${awardedBudget.toLocaleString('en-IN')} by ₹${overrunAmount.toLocaleString('en-IN')}.`,
        detectedAt: existingOverrun?.detectedAt || now.toISOString(),
        status: existingOverrun?.status || 'OPEN',
        evidence: [
          {
            entityType: 'PROJECT',
            entityId: project.id,
            label: `Statutory Awarded Value: ₹${awardedBudget.toLocaleString('en-IN')}`,
          },
          ...verifiedFinancialRecords.slice(-2).map((r) => ({
            entityType: 'FINANCIAL_RECORD' as const,
            entityId: r.id,
            label: `Invoice ${r.referenceNumber || r.id}: ₹${Number(r.amount).toLocaleString('en-IN')}`,
            detail: r.description,
            date: r.entryDate,
          })),
        ],
        metrics: {
          awardedAmount: awardedBudget,
          verifiedExpenditure: totalVerifiedExpenditure,
          overrunAmount,
        },
        ruleVersion: this.ENGINE_VERSION,
        ruleKey: overrunBaseRuleId,
        detectionSource: 'SYSTEM_RULE',
        acknowledgedBy: existingOverrun?.acknowledgedBy,
        acknowledgedByName: existingOverrun?.acknowledgedByName,
        acknowledgedAt: existingOverrun?.acknowledgedAt,
        underReviewBy: existingOverrun?.underReviewBy,
        underReviewByName: existingOverrun?.underReviewByName,
        underReviewAt: existingOverrun?.underReviewAt,
        resolvedAt: existingOverrun?.resolvedAt,
        resolvedBy: existingOverrun?.resolvedBy,
        resolvedByName: existingOverrun?.resolvedByName,
        resolutionNote: existingOverrun?.resolutionNote,
        dismissedAt: existingOverrun?.dismissedAt,
        dismissedBy: existingOverrun?.dismissedBy,
        dismissedByName: existingOverrun?.dismissedByName,
        dismissalReason: existingOverrun?.dismissalReason,
      });
    }

    // -------------------------------------------------------------
    // RULE F: LONG REPORTING GAP
    // -------------------------------------------------------------
    if (project.status === 'IN_PROGRESS') {
      let lastReportDate: Date | null = null;

      if (updates.length > 0) {
        const sortedUpdates = [...updates].sort(
          (a, b) => new Date(b.updateDate || b.createdAt).getTime() - new Date(a.updateDate || a.createdAt).getTime()
        );
        lastReportDate = new Date(sortedUpdates[0].updateDate || sortedUpdates[0].createdAt);
      } else if (project.implementationStartDate || project.startDate) {
        lastReportDate = new Date(project.implementationStartDate || project.startDate!);
      }

      if (lastReportDate && !isNaN(lastReportDate.getTime())) {
        const gapDays = Math.floor((now.getTime() - lastReportDate.getTime()) / (1000 * 60 * 60 * 24));
        if (gapDays >= 45) {
          const gapBaseRuleId = `anom-gap-${projectId}`;
          const { occurrenceId: gapAnomalyId, existing: existingGap } = resolveOccurrence(gapBaseRuleId);

          evaluatedAnomalies.push({
            id: gapAnomalyId,
            projectId,
            projectNumber: project.projectNumber,
            projectTitle: project.title,
            organizationId: project.organizationId,
            agencyName: project.implementingAgencyName || project.agencyName,
            type: 'LONG_REPORTING_GAP',
            severity: gapDays >= 75 ? 'HIGH' : 'MEDIUM',
            title: 'Extended Implementation Reporting Gap',
            explanation: `No progress update submitted for ${gapDays} days. Active IN_PROGRESS projects require regular periodic monitoring submissions under MPLAD guidelines.`,
            detectedAt: existingGap?.detectedAt || now.toISOString(),
            status: existingGap?.status || 'OPEN',
            evidence: updates.slice(0, 1).map((u) => ({
              entityType: 'PROGRESS_UPDATE' as const,
              entityId: u.id,
              label: `Last Progress Update: ${u.milestoneTitle || 'General Progress'}`,
              detail: u.workCompletedDescription,
              date: u.updateDate || u.createdAt,
            })),
            metrics: {
              reportingGapDays: gapDays,
            },
            ruleVersion: this.ENGINE_VERSION,
            ruleKey: gapBaseRuleId,
            detectionSource: 'SYSTEM_RULE',
            acknowledgedBy: existingGap?.acknowledgedBy,
            acknowledgedByName: existingGap?.acknowledgedByName,
            acknowledgedAt: existingGap?.acknowledgedAt,
            underReviewBy: existingGap?.underReviewBy,
            underReviewByName: existingGap?.underReviewByName,
            underReviewAt: existingGap?.underReviewAt,
            resolvedAt: existingGap?.resolvedAt,
            resolvedBy: existingGap?.resolvedBy,
            resolvedByName: existingGap?.resolvedByName,
            resolutionNote: existingGap?.resolutionNote,
            dismissedAt: existingGap?.dismissedAt,
            dismissedBy: existingGap?.dismissedBy,
            dismissedByName: existingGap?.dismissedByName,
            dismissalReason: existingGap?.dismissalReason,
          });
        }
      }
    }

    // -------------------------------------------------------------
    // RULE G: INSPECTION VS REPORTED PROGRESS DIVERGENCE
    // -------------------------------------------------------------
    const hasInspections = inspections.length > 0;
    const sortedInspections = hasInspections
      ? [...inspections].sort(
          (a, b) => new Date(b.inspectionDate || b.createdAt).getTime() - new Date(a.inspectionDate || a.createdAt).getTime()
        )
      : [];
    const latestInspection = sortedInspections[0];
    const inspectedProgress = Number(
      latestInspection?.governmentVerifiedPhysicalProgressPercent ??
        latestInspection?.physicalProgressObserved ??
        project.governmentVerifiedPhysicalProgressPercent ??
        0
    );
    const hasInspectedValue =
      (latestInspection &&
        (latestInspection.governmentVerifiedPhysicalProgressPercent !== undefined ||
          latestInspection.physicalProgressObserved !== undefined)) ||
      (project.governmentVerifiedPhysicalProgressPercent !== undefined &&
        project.governmentVerifiedPhysicalProgressPercent !== null);

    if (hasInspectedValue) {
      const reportedProgress = Number(
        project.agencyReportedPhysicalProgressPercent ?? project.physicalProgressPercent ?? 0
      );

      const inspectionDiscrepancy = Math.abs(reportedProgress - inspectedProgress);
      if (inspectionDiscrepancy >= 15) {
        const inspBaseRuleId = `anom-insp-div-${projectId}`;
        const { occurrenceId: inspAnomalyId, existing: existingInsp } = resolveOccurrence(inspBaseRuleId);

        evaluatedAnomalies.push({
          id: inspAnomalyId,
          projectId,
          projectNumber: project.projectNumber,
          projectTitle: project.title,
          organizationId: project.organizationId,
          agencyName: project.implementingAgencyName || project.agencyName,
          type: 'INSPECTION_PROGRESS_DIVERGENCE',
          severity: inspectionDiscrepancy >= 25 ? 'HIGH' : 'MEDIUM',
          title: 'Inspection vs Agency Reported Progress Discrepancy',
          explanation: `Official on-site inspection observed ${inspectedProgress}% physical progress, diverging by ${inspectionDiscrepancy}% from agency self-reported progress of ${reportedProgress}%.`,
          detectedAt: existingInsp?.detectedAt || now.toISOString(),
          status: existingInsp?.status || 'OPEN',
          evidence: latestInspection
            ? [
                {
                  entityType: 'INSPECTION',
                  entityId: latestInspection.id,
                  label: `Official Inspection by ${latestInspection.officerName || 'Government Officer'} (${
                    latestInspection.officerDesignation || 'Engineer'
                  })`,
                  detail: latestInspection.observations || `Observed physical progress: ${inspectedProgress}%`,
                  date: latestInspection.inspectionDate || latestInspection.createdAt || now.toISOString(),
                },
              ]
            : [
                {
                  entityType: 'PROJECT',
                  entityId: project.id,
                  label: 'Authoritative Government Verification Record',
                  detail: `Official government verified progress is ${inspectedProgress}% vs agency self-reported progress of ${reportedProgress}%.`,
                  date: project.updatedAt || now.toISOString(),
                },
              ],
          metrics: {
            inspectedProgressPercent: inspectedProgress,
            reportedProgressPercent: reportedProgress,
            divergencePercent: inspectionDiscrepancy,
          },
          ruleVersion: this.ENGINE_VERSION,
          ruleKey: inspBaseRuleId,
          detectionSource: 'SYSTEM_RULE',
          acknowledgedBy: existingInsp?.acknowledgedBy,
          acknowledgedByName: existingInsp?.acknowledgedByName,
          acknowledgedAt: existingInsp?.acknowledgedAt,
          underReviewBy: existingInsp?.underReviewBy,
          underReviewByName: existingInsp?.underReviewByName,
          underReviewAt: existingInsp?.underReviewAt,
          resolvedAt: existingInsp?.resolvedAt,
          resolvedBy: existingInsp?.resolvedBy,
          resolvedByName: existingInsp?.resolvedByName,
          resolutionNote: existingInsp?.resolutionNote,
          dismissedAt: existingInsp?.dismissedAt,
          dismissedBy: existingInsp?.dismissedBy,
          dismissedByName: existingInsp?.dismissedByName,
          dismissalReason: existingInsp?.dismissalReason,
        });
      }
    }

    // -------------------------------------------------------------
    // RULE H: REPEATED CORRECTIVE ACTIONS
    // -------------------------------------------------------------
    const inspectionsWithCorrectiveActions = inspections.filter(
      (insp) => Array.isArray(insp.correctiveActions) && insp.correctiveActions.length > 0
    );

    if (inspectionsWithCorrectiveActions.length >= 2) {
      const totalCorrectiveActions = inspectionsWithCorrectiveActions.reduce(
        (sum, insp) => sum + (insp.correctiveActions?.length || 0),
        0
      );

      const corBaseRuleId = `anom-rep-cor-${projectId}`;
      const { occurrenceId: corAnomalyId, existing: existingCor } = resolveOccurrence(corBaseRuleId);

      evaluatedAnomalies.push({
        id: corAnomalyId,
        projectId,
        projectNumber: project.projectNumber,
        projectTitle: project.title,
        organizationId: project.organizationId,
        agencyName: project.implementingAgencyName || project.agencyName,
        type: 'REPEATED_CORRECTIVE_ACTIONS',
        severity: inspectionsWithCorrectiveActions.length >= 3 ? 'HIGH' : 'MEDIUM',
        title: 'Repeated Corrective Actions Issued in Inspections',
        explanation: `Multiple official site inspections (${inspectionsWithCorrectiveActions.length}) have issued binding corrective actions (${totalCorrectiveActions} total corrective actions required).`,
        detectedAt: existingCor?.detectedAt || now.toISOString(),
        status: existingCor?.status || 'OPEN',
        evidence: inspectionsWithCorrectiveActions.map((i) => ({
          entityType: 'INSPECTION' as const,
          entityId: i.id,
          label: `Inspection on ${new Date(i.inspectionDate).toLocaleDateString('en-IN')}`,
          detail: `Corrective Actions: ${(i.correctiveActions || []).join('; ')}`,
          date: i.inspectionDate,
        })),
        metrics: {
          correctiveActionsCount: totalCorrectiveActions,
        },
        ruleVersion: this.ENGINE_VERSION,
        ruleKey: corBaseRuleId,
        detectionSource: 'SYSTEM_RULE',
        acknowledgedBy: existingCor?.acknowledgedBy,
        acknowledgedByName: existingCor?.acknowledgedByName,
        acknowledgedAt: existingCor?.acknowledgedAt,
        underReviewBy: existingCor?.underReviewBy,
        underReviewByName: existingCor?.underReviewByName,
        underReviewAt: existingCor?.underReviewAt,
        resolvedAt: existingCor?.resolvedAt,
        resolvedBy: existingCor?.resolvedBy,
        resolvedByName: existingCor?.resolvedByName,
        resolutionNote: existingCor?.resolutionNote,
        dismissedAt: existingCor?.dismissedAt,
        dismissedBy: existingCor?.dismissedBy,
        dismissedByName: existingCor?.dismissedByName,
        dismissalReason: existingCor?.dismissalReason,
      });
    }

    // -------------------------------------------------------------
    // RULE I: CONFLICTING IMPLEMENTATION RECORDS
    // -------------------------------------------------------------
    const conflicts: string[] = [];
    for (const ms of milestones) {
      if (ms.status === 'COMPLETED' && (ms.progressPercent < 100 || ms.progressPercent === 0)) {
        conflicts.push(`Milestone #${ms.sequence} is marked COMPLETED but recorded progress is only ${ms.progressPercent}%.`);
      }
    }
    if (project.status === 'COMPLETED' && physicalProgressPercent < 100) {
      conflicts.push(`Project status is COMPLETED but physical progress is ${physicalProgressPercent}%.`);
    }

    if (conflicts.length > 0) {
      const confBaseRuleId = `anom-conflict-${projectId}`;
      const { occurrenceId: confAnomalyId, existing: existingConf } = resolveOccurrence(confBaseRuleId);

      evaluatedAnomalies.push({
        id: confAnomalyId,
        projectId,
        projectNumber: project.projectNumber,
        projectTitle: project.title,
        organizationId: project.organizationId,
        agencyName: project.implementingAgencyName || project.agencyName,
        type: 'CONFLICTING_RECORDS',
        severity: 'MEDIUM',
        title: 'Conflicting Implementation Records Requiring Administrative Review',
        explanation: conflicts.join(' '),
        detectedAt: existingConf?.detectedAt || now.toISOString(),
        status: existingConf?.status || 'OPEN',
        evidence: [
          {
            entityType: 'PROJECT',
            entityId: project.id,
            label: 'Project Record',
            detail: conflicts.join('; '),
          },
        ],
        metrics: {
          physicalProgressPercent,
        },
        ruleVersion: this.ENGINE_VERSION,
        ruleKey: confBaseRuleId,
        detectionSource: 'SYSTEM_RULE',
        acknowledgedBy: existingConf?.acknowledgedBy,
        acknowledgedByName: existingConf?.acknowledgedByName,
        acknowledgedAt: existingConf?.acknowledgedAt,
        underReviewBy: existingConf?.underReviewBy,
        underReviewByName: existingConf?.underReviewByName,
        underReviewAt: existingConf?.underReviewAt,
        resolvedAt: existingConf?.resolvedAt,
        resolvedBy: existingConf?.resolvedBy,
        resolvedByName: existingConf?.resolvedByName,
        resolutionNote: existingConf?.resolutionNote,
        dismissedAt: existingConf?.dismissedAt,
        dismissedBy: existingConf?.dismissedBy,
        dismissedByName: existingConf?.dismissedByName,
        dismissalReason: existingConf?.dismissalReason,
      });
    }

    // -------------------------------------------------------------
    // RULE J: PROJECT STAGNATION
    // -------------------------------------------------------------
    if (project.status === 'IN_PROGRESS') {
      const dates = [
        ...updates.map((u) => new Date(u.updateDate || u.createdAt).getTime()),
        ...financialRecords.map((f) => new Date(f.entryDate || f.createdAt).getTime()),
        ...inspections.map((i) => new Date(i.inspectionDate || i.createdAt).getTime()),
      ].filter((t) => !isNaN(t));

      const mostRecentActivityTime = dates.length > 0 ? Math.max(...dates) : new Date(project.updatedAt || project.createdAt || 0).getTime();
      const inactiveDays = Math.floor((now.getTime() - mostRecentActivityTime) / (1000 * 60 * 60 * 24));

      if (inactiveDays >= 60 && evaluatedAnomalies.some((a) => a.type === 'LONG_REPORTING_GAP')) {
        const stagBaseRuleId = `anom-stag-${projectId}`;
        const { occurrenceId: stagAnomalyId, existing: existingStag } = resolveOccurrence(stagBaseRuleId);

        evaluatedAnomalies.push({
          id: stagAnomalyId,
          projectId,
          projectNumber: project.projectNumber,
          projectTitle: project.title,
          organizationId: project.organizationId,
          agencyName: project.implementingAgencyName || project.agencyName,
          type: 'PROJECT_STAGNATION',
          severity: inactiveDays >= 90 ? 'HIGH' : 'MEDIUM',
          title: 'Project Implementation Stagnation',
          explanation: `Project appears stagnant with no recorded physical progress, financial utilization, or field inspection activity for over ${inactiveDays} days.`,
          detectedAt: existingStag?.detectedAt || now.toISOString(),
          status: existingStag?.status || 'OPEN',
          evidence: [
            {
              entityType: 'PROJECT',
              entityId: project.id,
              label: 'Last Recorded Activity',
              detail: `Inactive duration: ${inactiveDays} days`,
              date: new Date(mostRecentActivityTime).toISOString(),
            },
          ],
          metrics: {
            inactiveDays,
          },
          ruleVersion: this.ENGINE_VERSION,
          ruleKey: stagBaseRuleId,
          detectionSource: 'SYSTEM_RULE',
          acknowledgedBy: existingStag?.acknowledgedBy,
          acknowledgedByName: existingStag?.acknowledgedByName,
          acknowledgedAt: existingStag?.acknowledgedAt,
          underReviewBy: existingStag?.underReviewBy,
          underReviewByName: existingStag?.underReviewByName,
          underReviewAt: existingStag?.underReviewAt,
          resolvedAt: existingStag?.resolvedAt,
          resolvedBy: existingStag?.resolvedBy,
          resolvedByName: existingStag?.resolvedByName,
          resolutionNote: existingStag?.resolutionNote,
          dismissedAt: existingStag?.dismissedAt,
          dismissedBy: existingStag?.dismissedBy,
          dismissedByName: existingStag?.dismissedByName,
          dismissalReason: existingStag?.dismissalReason,
        });
      }
    }

    const nowIso = now.toISOString();

    // Mark all actively evaluated anomalies as currently condition-active
    const activeEvaluated: ProjectAnomaly[] = evaluatedAnomalies.map((a) => ({
      ...a,
      isConditionActive: true,
      conditionEvaluatedAt: nowIso,
    }));

    const evaluatedActiveIds = new Set(activeEvaluated.map((a) => a.id));
    const allMergedAnomalies: ProjectAnomaly[] = [...activeEvaluated];

    // Preserve historical terminal occurrences (RESOLVED / DISMISSED) completely unchanged without mutating documents,
    // and mark non-terminal anomalies whose underlying condition is no longer actively detected as condition inactive.
    for (const existing of existingAnomalies) {
      if (!evaluatedActiveIds.has(existing.id)) {
        if (existing.status === 'RESOLVED' || existing.status === 'DISMISSED') {
          // Terminal historical occurrence: preserve existing document completely unchanged
          allMergedAnomalies.push(existing);
        } else {
          // Non-terminal anomaly whose condition has cleared: mark inactive
          allMergedAnomalies.push({
            ...existing,
            isConditionActive: false,
            conditionEvaluatedAt: nowIso,
          });
        }
      }
    }

    // Persist all anomalies (both active conditions and historical audit records)
    await this.persistProjectAnomalies(projectId, allMergedAnomalies);
    await this.calculateAndPersistRiskScore(projectId, allMergedAnomalies, project);

    return allMergedAnomalies;
  }

  /**
   * Deterministic, explainable Project-level Risk Score calculation (0–100)
   * Section 7: Uses weighted contributing indicators.
   * Only anomalies with currently active underlying conditions contribute to the current score.
   * Stale/historical conditions (isConditionActive === false) or closed ones (RESOLVED, DISMISSED)
   * do NOT inflate current risk scores.
   */
  static calculateProjectRiskScore(
    anomalies: ProjectAnomaly[],
    project: Project
  ): ProjectRiskScoreBreakdown {
    // Ground truth: Only active conditions contribute to current deterministic risk
    const activeAnomalies = anomalies.filter(
      (a) =>
        a.isConditionActive !== false &&
        (a.status === 'OPEN' || a.status === 'UNDER_REVIEW' || a.status === 'ACKNOWLEDGED')
    );

    // 1. Financial Divergence Component (Weight up to 25)
    let financialDivergenceScore = 0;
    const divAnomaly = activeAnomalies.find((a) => a.type === 'PHYSICAL_FINANCIAL_DIVERGENCE');
    if (divAnomaly) {
      const divPct = Number(divAnomaly.metrics?.divergencePercent || 0);
      if (divPct >= 50) financialDivergenceScore = 25;
      else if (divPct >= 35) financialDivergenceScore = 20;
      else if (divPct >= 25) financialDivergenceScore = 15;
      else if (divPct >= 15) financialDivergenceScore = 10;
    }

    // 2. Progress / Inspection Divergence (Weight up to 20)
    let progressDivergenceScore = 0;
    const inspDivAnomaly = activeAnomalies.find((a) => a.type === 'INSPECTION_PROGRESS_DIVERGENCE');
    if (inspDivAnomaly) {
      const inspDivPct = Number(inspDivAnomaly.metrics?.divergencePercent || 0);
      if (inspDivPct >= 30) progressDivergenceScore = 20;
      else if (inspDivPct >= 20) progressDivergenceScore = 15;
      else if (inspDivPct >= 10) progressDivergenceScore = 10;
    }

    // 3. Milestone Delays & Pre-Deadline Schedule Pressure (Weight up to 20)
    let milestoneDelaysScore = 0;
    const hasRepeatedDelays = activeAnomalies.some((a) => a.type === 'REPEATED_MILESTONE_DELAYS');
    const delayAnomalies = activeAnomalies.filter((a) => a.type === 'MILESTONE_DELAY');
    const pressureAnomalies = activeAnomalies.filter((a) => a.type === 'MILESTONE_SCHEDULE_PRESSURE');

    if (hasRepeatedDelays) {
      milestoneDelaysScore = 20;
    } else if (delayAnomalies.length > 0) {
      const maxDelay = Math.max(...delayAnomalies.map((a) => Number(a.metrics?.daysDelayed || 0)));
      if (maxDelay >= 60) milestoneDelaysScore = 15;
      else if (maxDelay >= 30) milestoneDelaysScore = 10;
      else milestoneDelaysScore = 5;
    } else if (pressureAnomalies.length > 0) {
      const hasCritical = pressureAnomalies.some((a) => a.severity === 'CRITICAL');
      const hasHigh = pressureAnomalies.some((a) => a.severity === 'HIGH');
      const hasMedium = pressureAnomalies.some((a) => a.severity === 'MEDIUM');
      if (hasCritical) milestoneDelaysScore = 15;
      else if (hasHigh) milestoneDelaysScore = 10;
      else if (hasMedium) milestoneDelaysScore = 5;
      else milestoneDelaysScore = 3;
    }

    // 4. Reporting Gaps / Stagnation (Weight up to 15)
    let reportingGapsScore = 0;
    const stagAnomaly = activeAnomalies.find((a) => a.type === 'PROJECT_STAGNATION');
    const gapAnomaly = activeAnomalies.find((a) => a.type === 'LONG_REPORTING_GAP');
    if (stagAnomaly) {
      reportingGapsScore = 15;
    } else if (gapAnomaly) {
      const gapDays = Number(gapAnomaly.metrics?.reportingGapDays || 0);
      if (gapDays >= 75) reportingGapsScore = 12;
      else if (gapDays >= 45) reportingGapsScore = 8;
    }

    // 5. Inspection Inconsistencies / Repeated Directives (Weight up to 10)
    let inspectionInconsistenciesScore = 0;
    const correctiveAnomaly = activeAnomalies.find((a) => a.type === 'REPEATED_CORRECTIVE_ACTIONS');
    if (correctiveAnomaly) {
      const count = Number(correctiveAnomaly.metrics?.correctiveActionsCount || 0);
      inspectionInconsistenciesScore = count >= 4 ? 10 : 7;
    }

    // 6. Budget Overrun & Expenditure Acceleration (Weight up to 10)
    let budgetAndAccelerationScore = 0;
    const overrunAnomaly = activeAnomalies.find((a) => a.type === 'AWARDED_VALUE_OVERRUN');
    const accelAnomaly = activeAnomalies.find((a) => a.type === 'EXPENDITURE_ACCELERATION');
    if (overrunAnomaly) {
      budgetAndAccelerationScore = 10;
    } else if (accelAnomaly) {
      budgetAndAccelerationScore = 8;
    }

    // If there are conflicting records, add a baseline check
    const conflictAnomaly = activeAnomalies.find((a) => a.type === 'CONFLICTING_RECORDS');
    if (conflictAnomaly && budgetAndAccelerationScore < 5) {
      budgetAndAccelerationScore = Math.min(10, budgetAndAccelerationScore + 5);
    }

    const totalRaw =
      financialDivergenceScore +
      progressDivergenceScore +
      milestoneDelaysScore +
      reportingGapsScore +
      inspectionInconsistenciesScore +
      budgetAndAccelerationScore;

    const totalRiskScore = Math.min(100, Math.max(0, totalRaw));

    let riskLevel: RiskLevel = 'LOW';
    if (totalRiskScore >= 80) riskLevel = 'CRITICAL';
    else if (totalRiskScore >= 60) riskLevel = 'HIGH';
    else if (totalRiskScore >= 30) riskLevel = 'MODERATE';

    return {
      financialDivergenceScore,
      progressDivergenceScore,
      milestoneDelaysScore,
      reportingGapsScore,
      inspectionInconsistenciesScore,
      budgetAndAccelerationScore,
      totalRiskScore,
      riskLevel,
      methodology:
        'Weighted Composite Risk Model: Financial Divergence (25), Progress/Inspection Discrepancy (20), Milestone Delays (20), Reporting Inactivity (15), Inspection Directives (10), Expenditure Acceleration & Budget Overrun (10).',
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Retrieves stored or computes on-the-fly risk assessment for a project.
   */
  static async getProjectRiskAssessment(projectId: string): Promise<ProjectRiskAssessment | null> {
    if (!projectId) return null;

    if (isLiveFirestoreSession() && db) {
      try {
        const snap = await getDoc(doc(db, RISK_ASSESSMENTS_COLLECTION, projectId));
        if (snap.exists()) {
          return snap.data() as ProjectRiskAssessment;
        }
      } catch (err) {
        console.warn(`[AnomalyDetectionService] Failed to read live assessment for ${projectId}:`, err);
      }
    }

    const localAssessments = getLocalItems<ProjectRiskAssessment>(LOCAL_STORAGE_RISK_ASSESSMENTS_KEY, []);
    const found = localAssessments.find((a) => a.projectId === projectId);
    if (found) return found;

    // Calculate dynamically if not found
    const project = await ProjectService.getProjectById(projectId);
    if (!project) return null;

    const anomalies = await this.getProjectAnomalies(projectId);
    return await this.calculateAndPersistRiskScore(projectId, anomalies, project);
  }

  /**
   * Investigation Workflow: Updates an anomaly's investigation status with authoritative audit trail.
   * Actions: ACKNOWLEDGED, UNDER_REVIEW, RESOLVED (requires resolutionNote), DISMISSED (requires dismissalReason).
   */
  static async updateAnomalyStatus(params: {
    anomalyId: string;
    projectId: string;
    status: AnomalyStatus;
    user: AuthUser;
    resolutionNote?: string;
    dismissalReason?: string;
    acknowledgementNote?: string;
  }): Promise<ProjectAnomaly> {
    const { anomalyId, projectId, status, user, resolutionNote, dismissalReason, acknowledgementNote } = params;

    const userRole = (user.role || '').toLowerCase();
    if (!userRole.includes('gov')) {
      throw new Error('Unauthorized: Anomaly investigation actions are strictly restricted to government officials.');
    }

    if (status === 'ACKNOWLEDGED' && (!acknowledgementNote || acknowledgementNote.trim().length < 5)) {
      throw new Error('Validation Error: Acknowledging an anomaly requires an initial investigation note or officer observation (minimum 5 characters).');
    }

    if (status === 'RESOLVED' && (!resolutionNote || resolutionNote.trim().length < 5)) {
      throw new Error('Validation Error: Resolving an anomaly requires a detailed resolution note (minimum 5 characters).');
    }

    if (status === 'DISMISSED' && (!dismissalReason || dismissalReason.trim().length < 5)) {
      throw new Error('Validation Error: Dismissing an anomaly requires an administrative justification reason.');
    }

    const anomalies = await this.getProjectAnomalies(projectId);
    const target = anomalies.find((a) => a.id === anomalyId);
    if (!target) {
      throw new Error(`Anomaly "${anomalyId}" not found for project "${projectId}".`);
    }

    // Authoritative transition matrix validation
    if (target.status === status) {
      throw new Error(`Invalid Transition: Anomaly is already in "${status}" status.`);
    }

    if (!isValidAnomalyTransition(target.status, status)) {
      const allowed = VALID_ANOMALY_STATUS_TRANSITIONS[target.status] || [];
      const allowedMsg = allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)';
      throw new Error(
        `Invalid Status Transition: Cannot transition anomaly from "${target.status}" to "${status}". Allowed transitions from "${target.status}": ${allowedMsg}.`
      );
    }

    const nowIso = new Date().toISOString();
    const updated: ProjectAnomaly = {
      ...target,
      status,
    };

    let auditAction:
      | 'ANOMALY_ACKNOWLEDGED'
      | 'ANOMALY_UNDER_REVIEW'
      | 'ANOMALY_RESOLVED'
      | 'ANOMALY_DISMISSED' = 'ANOMALY_ACKNOWLEDGED';

    if (status === 'ACKNOWLEDGED') {
      updated.acknowledgedBy = user.uid || user.id;
      updated.acknowledgedByName = user.name || 'Government Nodal Officer';
      updated.acknowledgedAt = nowIso;
      updated.acknowledgementNote = acknowledgementNote?.trim();
      auditAction = 'ANOMALY_ACKNOWLEDGED';
    } else if (status === 'UNDER_REVIEW') {
      updated.underReviewBy = user.uid || user.id;
      updated.underReviewByName = user.name || 'Government Nodal Officer';
      updated.underReviewAt = nowIso;
      auditAction = 'ANOMALY_UNDER_REVIEW';
    } else if (status === 'RESOLVED') {
      updated.resolvedBy = user.uid || user.id;
      updated.resolvedByName = user.name || 'Government Nodal Officer';
      updated.resolvedAt = nowIso;
      updated.resolutionNote = resolutionNote?.trim();
      auditAction = 'ANOMALY_RESOLVED';
    } else if (status === 'DISMISSED') {
      updated.dismissedBy = user.uid || user.id;
      updated.dismissedByName = user.name || 'Government Nodal Officer';
      updated.dismissedAt = nowIso;
      updated.dismissalReason = dismissalReason?.trim();
      auditAction = 'ANOMALY_DISMISSED';
    }

    const eventId = `evt-anom-${status.toLowerCase()}-${anomalyId}-${Date.now()}`;
    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId,
      action: auditAction,
      actorId: user.uid || user.id || 'usr-gov-001',
      actorRole: 'government',
      actorName: user.name || 'Government Nodal Officer',
      timestamp: nowIso,
      previousState: { status: target.status },
      newState: {
        anomalyId,
        status,
        acknowledgementNote: updated.acknowledgementNote,
        resolutionNote: updated.resolutionNote,
        dismissalReason: updated.dismissalReason,
      },
      notes: `Anomaly "${target.title}" status changed from ${target.status} to ${status}.`,
    };

    if (isLiveFirestoreSession() && db) {
      const batch = writeBatch(db);
      batch.update(doc(db, ANOMALIES_COLLECTION, anomalyId), sanitizeFirestorePayload(updated));
      batch.set(doc(db, AUDIT_EVENTS_COLLECTION, eventId), sanitizeFirestorePayload(auditEvent));
      await batch.commit();
    } else {
      const allAnomalies = getLocalItems<ProjectAnomaly>(LOCAL_STORAGE_ANOMALIES_KEY, []);
      const idx = allAnomalies.findIndex((a) => a.id === anomalyId);
      if (idx !== -1) {
        allAnomalies[idx] = updated;
      } else {
        allAnomalies.push(updated);
      }
      saveLocalItems(LOCAL_STORAGE_ANOMALIES_KEY, allAnomalies);

      const allEvents = getLocalItems<ProjectAuditEvent>(LOCAL_STORAGE_AUDIT_EVENTS_KEY, []);
      allEvents.unshift(auditEvent);
      saveLocalItems(LOCAL_STORAGE_AUDIT_EVENTS_KEY, allEvents);
    }

    // Re-calculate and persist updated risk assessment
    const project = await ProjectService.getProjectById(projectId);
    if (project) {
      const refreshedAnomalies = await this.getProjectAnomalies(projectId);
      await this.calculateAndPersistRiskScore(projectId, refreshedAnomalies, project);
    }

    return updated;
  }

  /**
   * Invokes the Server-Side AI Risk Intelligence endpoint (/api/ai/project-risk-intelligence).
   * Advisory narrative decision support grounded strictly in project records and deterministic anomalies.
   */
  static async runAiRiskAnalysis(projectId: string, user: AuthUser): Promise<RiskIntelligenceResult> {
    const userRole = (user.role || '').toLowerCase();
    if (!userRole.includes('gov')) {
      throw new Error('Unauthorized: AI Risk Intelligence is strictly restricted to government officials.');
    }

    const project = await ProjectService.getProjectById(projectId);
    if (!project) {
      throw new Error(`Project "${projectId}" not found.`);
    }

    const anomalies = await this.getProjectAnomalies(projectId);
    const milestones = await ProjectService.getMilestones(projectId);
    const financialRecords = await ProjectService.getFinancialRecords(projectId);
    const inspections = await ProjectService.getInspections(projectId);

    // Acquire Bearer ID token or session token
    let idToken = '';
    if (auth && auth.currentUser) {
      try {
        idToken = await auth.currentUser.getIdToken();
      } catch {
        // Fallback
      }
    }
    if (!idToken) {
      const storedUser = AuthService.getCurrentUser();
      idToken = storedUser?.uid ? `bti-token-${storedUser.uid}` : 'bti-demo-token-government';
    }

    const nowIso = new Date().toISOString();

    // Record AI_RISK_ANALYSIS_REQUESTED audit event
    const reqEventId = `evt-ai-req-${projectId}-${Date.now()}`;
    const reqAuditEvent: ProjectAuditEvent = {
      eventId: reqEventId,
      projectId,
      action: 'AI_RISK_ANALYSIS_REQUESTED',
      actorId: user.uid || user.id || 'usr-gov-001',
      actorRole: 'government',
      actorName: user.name || 'Government Officer',
      timestamp: nowIso,
      notes: `AI Risk Intelligence analysis initiated for project ${project.projectNumber || project.id}.`,
    };

    if (isLiveFirestoreSession() && db) {
      try {
        await setDoc(doc(db, AUDIT_EVENTS_COLLECTION, reqEventId), sanitizeFirestorePayload(reqAuditEvent));
      } catch (err) {
        console.warn('Failed to record live AI_RISK_ANALYSIS_REQUESTED event:', err);
      }
    } else {
      const localEvents = getLocalItems<ProjectAuditEvent>(LOCAL_STORAGE_AUDIT_EVENTS_KEY, []);
      localEvents.unshift(reqAuditEvent);
      saveLocalItems(LOCAL_STORAGE_AUDIT_EVENTS_KEY, localEvents);
    }

    let aiResult: RiskIntelligenceResult;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch('/api/ai/project-risk-intelligence', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId,
          project,
          anomalies,
          milestonesSummary: milestones.map((m) => ({
            sequence: m.sequence,
            title: m.title,
            weight: m.weightPercent,
            progress: m.progressPercent,
            status: m.status,
            plannedEnd: m.plannedEndDate,
          })),
          financialSummary: {
            awardedAmount: project.awardedAmount,
            verifiedRecordsCount: financialRecords.filter((r) => r.verificationStatus === 'VERIFIED').length,
            totalVerified: financialRecords
              .filter((r) => r.verificationStatus === 'VERIFIED')
              .reduce((s, r) => s + (Number(r.amount) || 0), 0),
          },
          inspectionSummary: inspections.map((i) => ({
            date: i.inspectionDate,
            officer: i.officerName,
            type: i.inspectionType,
            observedProgress: i.physicalProgressObserved,
            issuesCount: i.issues?.length || 0,
            hasCorrectiveActions: (i.correctiveActions?.length || 0) > 0,
          })),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success || !data.assessment) {
        throw new Error(data.error || `AI Risk Analysis endpoint responded with status ${response.status}.`);
      }

      aiResult = data.assessment;

      // Record AI_RISK_ANALYSIS_COMPLETED
      const compEventId = `evt-ai-comp-${projectId}-${Date.now()}`;
      const compEvent: ProjectAuditEvent = {
        eventId: compEventId,
        projectId,
        action: 'AI_RISK_ANALYSIS_COMPLETED',
        actorId: user.uid || user.id || 'usr-gov-001',
        actorRole: 'government',
        actorName: user.name || 'Government Officer',
        timestamp: new Date().toISOString(),
        notes: `AI Risk Intelligence analysis completed successfully via model ${aiResult.model}.`,
      };

      if (isLiveFirestoreSession() && db) {
        await setDoc(doc(db, AUDIT_EVENTS_COLLECTION, compEventId), sanitizeFirestorePayload(compEvent));
      } else {
        const localEvents = getLocalItems<ProjectAuditEvent>(LOCAL_STORAGE_AUDIT_EVENTS_KEY, []);
        localEvents.unshift(compEvent);
        saveLocalItems(LOCAL_STORAGE_AUDIT_EVENTS_KEY, localEvents);
      }
    } catch (err: any) {
      // Record AI_RISK_ANALYSIS_FAILED
      const failEventId = `evt-ai-fail-${projectId}-${Date.now()}`;
      const failEvent: ProjectAuditEvent = {
        eventId: failEventId,
        projectId,
        action: 'AI_RISK_ANALYSIS_FAILED',
        actorId: user.uid || user.id || 'usr-gov-001',
        actorRole: 'government',
        actorName: user.name || 'Government Officer',
        timestamp: new Date().toISOString(),
        notes: `AI Risk Intelligence analysis failed: ${err.message || 'Unknown network error'}.`,
      };

      if (isLiveFirestoreSession() && db) {
        try {
          await setDoc(doc(db, AUDIT_EVENTS_COLLECTION, failEventId), sanitizeFirestorePayload(failEvent));
        } catch {
          // Ignore
        }
      } else {
        const localEvents = getLocalItems<ProjectAuditEvent>(LOCAL_STORAGE_AUDIT_EVENTS_KEY, []);
        localEvents.unshift(failEvent);
        saveLocalItems(LOCAL_STORAGE_AUDIT_EVENTS_KEY, localEvents);
      }

      // Generate robust grounded deterministic fallback advisory if offline or Gemini API unconfigured
      const breakdown = this.calculateProjectRiskScore(anomalies, project);
      aiResult = {
        assessmentId: `risk-ai-fallback-${projectId}-${Date.now()}`,
        projectId,
        riskLevel: breakdown.riskLevel,
        overallRiskLevel: breakdown.riskLevel,
        riskScore: breakdown.totalRiskScore,
        summary: `Deterministic analysis indicates ${breakdown.riskLevel.toLowerCase()} risk profile (${breakdown.totalRiskScore}/100) based on ${anomalies.filter((a) => a.status === 'OPEN').length} active implementation indicators. Grounded strictly in submitted project records.`,
        priorityFindings: anomalies.slice(0, 3).map((a) => ({
          title: a.title,
          explanation: a.explanation,
          severity: a.severity,
          reviewRecommendation: `Conduct administrative review of ${a.type.toLowerCase().replace(/_/g, ' ')} and request reconciliation documentation from executing agency.`,
        })),
        contributingIndicators: anomalies.map((a) => a.title),
        recommendedReviewAreas: [
          'Verify contractor measurement book entries with District Executive Engineer.',
          'Review bank guarantee validity and mobilization expenditure vouchers.',
          'Schedule targeted physical verification inspection for overdue milestones.',
        ],
        limitations:
          'Advisory decision support grounded strictly in authoritative project records; does not constitute a formal legal, forensic, or statutory audit finding.',
        provider: 'BTI Deterministic Advisory Fallback',
        model: 'Deterministic-v1',
        version: this.ENGINE_VERSION,
        timestamp: new Date().toISOString(),
      };
    }

    // Attach to stored ProjectRiskAssessment
    let currentAssessment = await this.getProjectRiskAssessment(projectId);
    if (!currentAssessment) {
      const project = await ProjectService.getProjectById(projectId);
      if (project) {
        currentAssessment = await this.calculateAndPersistRiskScore(projectId, anomalies, project);
      }
    }

    if (currentAssessment) {
      const updatedAssessment: ProjectRiskAssessment = {
        ...currentAssessment,
        aiAssessment: aiResult,
        lastAnalysisAt: aiResult.timestamp,
        updatedAt: new Date().toISOString(),
      };
      await this.saveRiskAssessment(updatedAssessment);
    }

    return aiResult;
  }

  // ==========================================
  // INTERNAL PERSISTENCE & HELPERS
  // ==========================================

  private static async fetchRawAnomalies(projectId: string): Promise<ProjectAnomaly[]> {
    if (isLiveFirestoreSession() && db) {
      try {
        const q = query(collection(db, ANOMALIES_COLLECTION), where('projectId', '==', projectId));
        const snap = await getDocs(q);
        const list: ProjectAnomaly[] = [];
        snap.forEach((d) => list.push(d.data() as ProjectAnomaly));
        return list;
      } catch {
        // Fallback
      }
    }
    const local = getLocalItems<ProjectAnomaly>(LOCAL_STORAGE_ANOMALIES_KEY, []);
    return local.filter((a) => a.projectId === projectId);
  }

  private static async persistProjectAnomalies(projectId: string, anomalies: ProjectAnomaly[]): Promise<void> {
    if (isLiveFirestoreSession() && db) {
      try {
        const batch = writeBatch(db);
        for (const a of anomalies) {
          // Terminal records (RESOLVED / DISMISSED) are immutable historical documents and must not be overwritten
          if (a.status === 'RESOLVED' || a.status === 'DISMISSED') {
            continue;
          }
          const aRef = doc(db, ANOMALIES_COLLECTION, a.id);
          batch.set(aRef, sanitizeFirestorePayload(a), { merge: true });
        }
        await batch.commit();
        return;
      } catch (err) {
        console.warn('[AnomalyDetectionService] Failed to persist anomalies to Firestore, caching locally:', err);
      }
    }

    const all = getLocalItems<ProjectAnomaly>(LOCAL_STORAGE_ANOMALIES_KEY, []);
    const others = all.filter((a) => a.projectId !== projectId);
    saveLocalItems(LOCAL_STORAGE_ANOMALIES_KEY, [...others, ...anomalies]);
  }

  private static async calculateAndPersistRiskScore(
    projectId: string,
    anomalies: ProjectAnomaly[],
    project: Project
  ): Promise<ProjectRiskAssessment> {
    const breakdown = this.calculateProjectRiskScore(anomalies, project);
    const existing = await this.fetchStoredRiskAssessment(projectId);

    const activeCount = anomalies.filter(
      (a) =>
        a.isConditionActive !== false &&
        (a.status === 'OPEN' || a.status === 'UNDER_REVIEW' || a.status === 'ACKNOWLEDGED')
    ).length;
    const historicalCount = anomalies.filter((a) => a.isConditionActive === false).length;
    const resolvedCount = anomalies.filter((a) => a.status === 'RESOLVED').length;
    const dismissedCount = anomalies.filter((a) => a.status === 'DISMISSED').length;

    const assessment: ProjectRiskAssessment = {
      id: projectId,
      projectId,
      riskScore: breakdown.totalRiskScore,
      riskLevel: breakdown.riskLevel,
      scoreBreakdown: breakdown,
      activeAnomalyCount: activeCount,
      historicalAnomalyCount: historicalCount,
      resolvedAnomalyCount: resolvedCount,
      dismissedAnomalyCount: dismissedCount,
      deterministicIndicators: anomalies
        .filter((a) => a.isConditionActive !== false)
        .map((a) => a.title),
      aiAssessment: existing?.aiAssessment,
      lastAnalysisAt: existing?.aiAssessment?.timestamp || breakdown.calculatedAt,
      updatedAt: breakdown.calculatedAt,
    };

    await this.saveRiskAssessment(assessment);
    return assessment;
  }

  private static async fetchStoredRiskAssessment(projectId: string): Promise<ProjectRiskAssessment | null> {
    if (isLiveFirestoreSession() && db) {
      try {
        const snap = await getDoc(doc(db, RISK_ASSESSMENTS_COLLECTION, projectId));
        if (snap.exists()) return snap.data() as ProjectRiskAssessment;
      } catch {
        // Fallback
      }
    }
    const local = getLocalItems<ProjectRiskAssessment>(LOCAL_STORAGE_RISK_ASSESSMENTS_KEY, []);
    return local.find((a) => a.projectId === projectId) || null;
  }

  private static async saveRiskAssessment(assessment: ProjectRiskAssessment): Promise<void> {
    if (isLiveFirestoreSession() && db) {
      try {
        await setDoc(
          doc(db, RISK_ASSESSMENTS_COLLECTION, assessment.projectId),
          sanitizeFirestorePayload(assessment)
        );
        return;
      } catch (err) {
        console.warn('[AnomalyDetectionService] Failed to save risk assessment to Firestore:', err);
      }
    }

    const all = getLocalItems<ProjectRiskAssessment>(LOCAL_STORAGE_RISK_ASSESSMENTS_KEY, []);
    const filtered = all.filter((a) => a.projectId !== assessment.projectId);
    filtered.unshift(assessment);
    saveLocalItems(LOCAL_STORAGE_RISK_ASSESSMENTS_KEY, filtered);
  }
}

function daysDelayedToReadable(days: number): string {
  if (days >= 365) {
    const years = (days / 365).toFixed(1);
    return `${years} years (${days} days)`;
  }
  if (days >= 60) {
    const months = Math.round(days / 30);
    return `${months} months (${days} days)`;
  }
  return `${days} days`;
}
