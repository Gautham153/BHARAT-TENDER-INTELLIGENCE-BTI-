// Bharat Tender Intelligence (BTI) — Evidence Chain Service
// Phase 8: Authoritative Evidence Graph, Stable Finding Identity & Investigation Intelligence

import { ProjectService, isLiveFirestoreSession, sanitizeFirestorePayload } from '../firebase/projects.js';
import { AnomalyDetectionService } from '../anomaly/anomalyDetectionService.js';
import {
  ProjectAnomaly,
  AnomalyType,
} from '../../types/anomaly.js';
import {
  EvidenceChain,
  EvidenceReference,
  EvidenceSourceType,
  EvidenceClassification,
  ProjectTimelineEvent,
  RelatedFinding,
  InvestigationNote,
  InvestigationAdvisory,
  WhyFlaggedBreakdown,
  getStableFindingId,
} from '../../types/evidence.js';
import {
  Project,
  ProjectMilestone,
  ProjectProgressUpdate,
  ProjectFinancialRecord,
  ProjectInspection,
  ProjectAuditEvent,
} from '../../types/project.js';
import {
  DEMONSTRATION_PROJECTS,
  DEMONSTRATION_MILESTONES,
  DEMONSTRATION_PROGRESS_UPDATES as DEMONSTRATION_UPDATES,
  DEMONSTRATION_FINANCIAL_RECORDS,
  DEMONSTRATION_INSPECTIONS,
} from '../../data/demonstrationProjects.js';
import { db, auth } from '../firebase/firebase.js';
import { collection, doc, setDoc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { ProposalService } from '../firebase/proposals.js';
import { TenderService } from '../firebase/tenders.js';
import { OrganizationService } from '../firebase/organizations.js';

const DEMONSTRATION_AUDIT_EVENTS: ProjectAuditEvent[] = [];

const LOCAL_STORAGE_NOTES_KEY = 'bti_investigation_notes_cache_v1';
const LOCAL_STORAGE_AUDIT_EVENTS_KEY = 'bti_project_audit_events_cache_v1';
const INVESTIGATION_NOTES_COLLECTION = 'projectInvestigationNotes';
const AUDIT_EVENTS_COLLECTION = 'projectAuditEvents';

function getLocalItems<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T[];
  } catch {
    return fallback;
  }
}

function saveLocalItems<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.warn(`[EvidenceChainService] Failed to cache items locally for ${key}:`, err);
  }
}

export class EvidenceChainService {
  static getStableFindingId = getStableFindingId;

  /**
   * Resolves all authoritative underlying records for a project.
   */
  private static async getAuthoritativeProjectData(projectId: string): Promise<{
    project: Project;
    milestones: ProjectMilestone[];
    updates: ProjectProgressUpdate[];
    financialRecords: ProjectFinancialRecord[];
    inspections: ProjectInspection[];
    auditEvents: ProjectAuditEvent[];
    anomalies: ProjectAnomaly[];
  }> {
    let project = await ProjectService.getProjectById(projectId);
    if (!project) {
      project = DEMONSTRATION_PROJECTS.find((p) => p.id === projectId) || null;
    }
    if (!project) {
      throw new Error(`Project "${projectId}" not found in authoritative records.`);
    }

    let [milestones, updates, financialRecords, inspections, auditEvents, anomalies] = await Promise.all([
      ProjectService.getMilestones(projectId).catch(() => []),
      ProjectService.getProgressUpdates(projectId).catch(() => []),
      ProjectService.getFinancialRecords(projectId).catch(() => []),
      ProjectService.getInspections(projectId).catch(() => []),
      ProjectService.getAuditEvents(projectId).catch(() => []),
      AnomalyDetectionService.getProjectAnomalies(projectId).catch(() => []),
    ]);

    // Fallbacks to demonstration dataset if live collections are empty
    if (milestones.length === 0) {
      milestones = DEMONSTRATION_MILESTONES.filter((m) => m.projectId === projectId);
    }
    if (updates.length === 0) {
      updates = DEMONSTRATION_UPDATES.filter((u) => u.projectId === projectId);
    }
    if (financialRecords.length === 0) {
      financialRecords = DEMONSTRATION_FINANCIAL_RECORDS.filter((f) => f.projectId === projectId);
    }
    if (inspections.length === 0) {
      inspections = DEMONSTRATION_INSPECTIONS.filter((i) => i.projectId === projectId);
    }
    if (auditEvents.length === 0) {
      auditEvents = DEMONSTRATION_AUDIT_EVENTS.filter((e) => e.projectId === projectId);
    }

    return {
      project,
      milestones,
      updates,
      financialRecords,
      inspections,
      auditEvents,
      anomalies,
    };
  }

  /**
   * Constructs an explainable evidence chain for a specific anomaly finding.
   */
  static async buildEvidenceChain(anomaly: ProjectAnomaly): Promise<EvidenceChain> {
    const projectId = anomaly.projectId;
    const { project, milestones, updates, financialRecords, inspections, auditEvents, anomalies } =
      await this.getAuthoritativeProjectData(projectId);

    const stableFindingId = getStableFindingId(anomaly);
    const occurrenceId = anomaly.id;

    // 1. Build Why Flagged Breakdown
    const whyFlagged = this.buildWhyFlagged(anomaly, project, milestones, financialRecords, inspections, updates);

    // 2. Build Supporting Evidence Items
    const evidenceItems = this.buildEvidenceItems(anomaly, project, milestones, updates, financialRecords, inspections);

    // 3. Build Unified Chronological Project Timeline
    const timeline = this.buildTimeline(project, milestones, updates, financialRecords, inspections, auditEvents, anomaly);

    // 4. Identify Related Findings on this Project
    const relatedFindings: RelatedFinding[] = anomalies
      .filter((a) => a.id !== anomaly.id)
      .map((a) => ({
        findingId: getStableFindingId(a),
        occurrenceId: a.id,
        type: a.type,
        severity: a.severity,
        status: a.status,
        title: a.title,
        isConditionActive: a.isConditionActive !== false,
      }));

    // 5. Retrieve Investigation Notes
    const investigationNotes = await this.getInvestigationNotes(stableFindingId, projectId);

    // 6. Filter relevant Audit Events for this Anomaly
    const relevantAuditEvents = auditEvents.filter((ev) => {
      const notes = (ev.notes || '').toLowerCase();
      const action = (ev.action || '').toUpperCase();
      return (
        action.startsWith('ANOMALY_') ||
        action.startsWith('AI_RISK_') ||
        action === 'INVESTIGATION_NOTE_ADDED' ||
        notes.includes(anomaly.id) ||
        notes.includes(stableFindingId) ||
        notes.includes(anomaly.title.toLowerCase())
      );
    });

    return {
      findingId: stableFindingId,
      occurrenceId,
      projectId,
      projectTitle: project.title,
      projectNumber: project.projectNumber,
      agencyName: project.implementingAgencyName || project.agencyName,
      anomalyType: anomaly.type,
      severity: anomaly.severity,
      status: anomaly.status,
      title: anomaly.title,
      detectedAt: anomaly.detectedAt,
      isConditionActive: anomaly.isConditionActive !== false,
      whyFlagged,
      evidenceItems,
      timeline,
      relatedFindings,
      investigationNotes,
      auditEvents: relevantAuditEvents,
    };
  }

  /**
   * Deterministic "Why Was It Flagged?" breakdown with explicit math and thresholds.
   */
  private static buildWhyFlagged(
    anomaly: ProjectAnomaly,
    project: Project,
    milestones: ProjectMilestone[],
    financialRecords: ProjectFinancialRecord[],
    inspections: ProjectInspection[],
    updates: ProjectProgressUpdate[]
  ): WhyFlaggedBreakdown {
    const verifiedRecords = financialRecords.filter((f) => f.verificationStatus === 'VERIFIED');
    const totalVerified = verifiedRecords.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const awarded = Number(project.awardedAmount || project.sanctionedAmount || 1);
    const finPct = Math.min(100, Math.round((totalVerified / awarded) * 100));
    const physPct = Number(project.physicalProgressPercent ?? project.physicalProgress ?? 0);

    switch (anomaly.type) {
      case 'PHYSICAL_FINANCIAL_DIVERGENCE': {
        const divergence = finPct - physPct;
        return {
          ruleName: 'Physical / Financial Progress Divergence',
          ruleKey: anomaly.ruleKey || 'RULE_PHYSICAL_FINANCIAL_DIVERGENCE',
          description:
            'Detects when cumulative verified financial disbursements significantly outpace reported physical completion.',
          inputs: [
            {
              label: 'Reported Physical Progress',
              value: `${physPct}%`,
              source: 'Latest Progress Update / Project Record',
            },
            {
              label: 'Verified Financial Utilization',
              value: `${finPct}% (₹${totalVerified.toLocaleString('en-IN')} of ₹${awarded.toLocaleString('en-IN')})`,
              source: 'Verified Financial Records / Invoices',
            },
          ],
          calculation: `${finPct}% (Financial) - ${physPct}% (Physical) = ${divergence} percentage points divergence`,
          threshold: 'Triggered when financial utilization exceeds physical progress by ≥ 20 percentage points.',
          result: `Excess disbursement divergence of ${divergence} percentage points generated ${anomaly.severity} risk alert.`,
        };
      }

      case 'MILESTONE_DELAY': {
        const targetMsId = (anomaly.metrics?.milestoneId as string) || '';
        const targetMs = milestones.find((m) => m.id === targetMsId) || milestones[0];
        const daysDelayed = Number(anomaly.metrics?.daysDelayed || 0);
        return {
          ruleName: 'Milestone Execution Delay',
          ruleKey: anomaly.ruleKey || 'RULE_MILESTONE_DELAY',
          description:
            'Identifies project milestones that have breached their scheduled target completion date without achieving 100% completion.',
          inputs: [
            {
              label: 'Milestone Title',
              value: targetMs ? `#${targetMs.sequence} - ${targetMs.title}` : 'Scheduled Milestone',
              source: 'Project Milestone Schedule',
            },
            {
              label: 'Planned End Date',
              value: targetMs?.plannedEndDate ? targetMs.plannedEndDate.split('T')[0] : 'N/A',
              source: 'Contract Milestone Baseline',
            },
            {
              label: 'Current Milestone Progress',
              value: `${targetMs?.progressPercent || 0}%`,
              source: 'Milestone Progress Tracker',
            },
          ],
          calculation: `Elapsed days past planned target date without 100% completion: ${daysDelayed} days`,
          threshold: 'Triggered when a milestone exceeds planned end date by ≥ 14 days without completion.',
          result: `Milestone delayed by ${daysDelayed} days past statutory baseline.`,
        };
      }

      case 'REPEATED_MILESTONE_DELAYS': {
        const delayedCount = Number(anomaly.metrics?.delayedMilestoneCount || 0);
        return {
          ruleName: 'Repeated / Chronic Milestone Delays',
          ruleKey: anomaly.ruleKey || 'RULE_REPEATED_MILESTONE_DELAYS',
          description:
            'Triggers when multiple distinct scheduled milestones across the project schedule are concurrently delayed.',
          inputs: [
            {
              label: 'Delayed Milestones Count',
              value: `${delayedCount} milestones delayed`,
              source: 'Project Milestones Schedule',
            },
            {
              label: 'Total Milestones Scheduled',
              value: `${milestones.length} milestones`,
              source: 'Project Baseline Schedule',
            },
          ],
          calculation: `Count of delayed milestones (${delayedCount}) vs configured tolerance`,
          threshold: 'Triggered when 2 or more distinct milestones are simultaneously delayed by ≥ 14 days.',
          result: `Systemic delivery impediment: ${delayedCount} milestones in delayed state.`,
        };
      }

      case 'MILESTONE_SCHEDULE_PRESSURE': {
        const targetMsId = (anomaly.metrics?.milestoneId as string) || '';
        const targetMs = milestones.find((m) => m.id === targetMsId) || milestones[0];
        const daysRem = Number(anomaly.metrics?.daysRemaining || 0);
        const remWork = Number(anomaly.metrics?.remainingWorkPercent || 0);
        return {
          ruleName: 'Pre-Deadline Schedule Pressure',
          ruleKey: anomaly.ruleKey || 'RULE_MILESTONE_SCHEDULE_PRESSURE',
          description:
            'Predictive early warning calculating required completion velocity when milestone deadlines are imminent with substantial remaining scope.',
          inputs: [
            {
              label: 'Days Remaining to Deadline',
              value: `${daysRem} days`,
              source: 'Contract Calendar Baseline',
            },
            {
              label: 'Remaining Work to Execute',
              value: `${remWork}%`,
              source: 'Milestone Progress Tracker',
            },
          ],
          calculation: `Required execution rate: ${(remWork / Math.max(1, daysRem)).toFixed(2)}% physical progress per calendar day`,
          threshold: 'Triggered when days remaining ≤ 30 and remaining work exceeds 40%.',
          result: `Unrealistic execution velocity required to meet contractual milestone delivery.`,
        };
      }

      case 'EXPENDITURE_ACCELERATION': {
        const accelAmount = Number(anomaly.metrics?.acceleratedAmount || 0);
        const accelPct = Number(anomaly.metrics?.acceleratedPercentage || 0);
        const windowDays = Number(anomaly.metrics?.accelerationWindowDays || 30);
        return {
          ruleName: 'Unusual Expenditure Acceleration',
          ruleKey: anomaly.ruleKey || 'RULE_EXPENDITURE_ACCELERATION',
          description:
            'Detects sudden spikes in verified financial claims clustered within a short time window compared to total contract value.',
          inputs: [
            {
              label: 'Claims Verified in Window',
              value: `₹${accelAmount.toLocaleString('en-IN')}`,
              source: 'Financial Invoicing Ledger',
            },
            {
              label: 'Time Window Examined',
              value: `${windowDays} days`,
              source: 'Surveillance Time Window',
            },
            {
              label: 'Acceleration Share of Budget',
              value: `${accelPct}% of total budget`,
              source: 'Calculated from Awarded Value',
            },
          ],
          calculation: `₹${accelAmount.toLocaleString('en-IN')} disbursed in ${windowDays} days (${accelPct}% of total budget)`,
          threshold: 'Triggered when > 35% of total contract budget is billed within a 30-day window.',
          result: `Rapid capital draw without commensurate multi-stage milestone verification.`,
        };
      }

      case 'AWARDED_VALUE_OVERRUN': {
        const overrun = totalVerified - awarded;
        return {
          ruleName: 'Awarded Value Expenditure Overrun',
          ruleKey: anomaly.ruleKey || 'RULE_AWARDED_VALUE_OVERRUN',
          description:
            'Detects when cumulative verified financial disbursements exceed the total sanctioned or awarded contract value.',
          inputs: [
            {
              label: 'Awarded Contract Value',
              value: `₹${awarded.toLocaleString('en-IN')}`,
              source: 'Official Award Document',
            },
            {
              label: 'Total Verified Claims',
              value: `₹${totalVerified.toLocaleString('en-IN')}`,
              source: 'Cumulative Verified Financial Ledger',
            },
          ],
          calculation: `₹${totalVerified.toLocaleString('en-IN')} - ₹${awarded.toLocaleString('en-IN')} = ₹${overrun.toLocaleString('en-IN')} excess`,
          threshold: 'Triggered when verified financial expenditure exceeds awarded budget by > 0%.',
          result: `Financial disbursements have breached the statutory contract ceiling by ₹${overrun.toLocaleString('en-IN')}.`,
        };
      }

      case 'LONG_REPORTING_GAP': {
        const gapDays = Number(anomaly.metrics?.reportingGapDays || 0);
        const latestUpd = updates[0];
        return {
          ruleName: 'Extended Reporting Inactivity Gap',
          ruleKey: anomaly.ruleKey || 'RULE_LONG_REPORTING_GAP',
          description:
            'Detects absence of regular monthly or bi-monthly statutory progress submissions from the executing agency.',
          inputs: [
            {
              label: 'Latest Agency Progress Update',
              value: latestUpd ? latestUpd.updateDate.split('T')[0] : 'None Submitted',
              source: 'Agency Progress Filing Records',
            },
            {
              label: 'Elapsed Inactive Days',
              value: `${gapDays} days`,
              source: 'Calculated Surveillance Time',
            },
          ],
          calculation: `Calendar days since last official update: ${gapDays} days`,
          threshold: 'Triggered when active projects exceed 45 consecutive days without an official progress filing.',
          result: `Contractual reporting non-compliance for ${gapDays} days.`,
        };
      }

      case 'INSPECTION_PROGRESS_DIVERGENCE': {
        const latestInsp = inspections[0];
        const inspObserved = Number(anomaly.metrics?.inspectedProgressPercent ?? latestInsp?.physicalProgressObserved ?? 0);
        const agRep = Number(anomaly.metrics?.reportedProgressPercent ?? project.physicalProgressPercent ?? 0);
        const div = Number(anomaly.metrics?.divergencePercent ?? Math.abs(agRep - inspObserved));
        return {
          ruleName: 'Inspection vs Agency Progress Divergence',
          ruleKey: anomaly.ruleKey || 'RULE_INSPECTION_PROGRESS_DIVERGENCE',
          description:
            'Compares independent on-site government field inspection measurements directly against agency-reported progress.',
          inputs: [
            {
              label: 'Government Field Inspection Observed',
              value: `${inspObserved}%`,
              source: latestInsp ? `Inspection by ${latestInsp.officerName} on ${latestInsp.inspectionDate.split('T')[0]}` : 'Field Inspection Report',
            },
            {
              label: 'Agency Self-Reported Progress',
              value: `${agRep}%`,
              source: 'Agency Progress Filing / Billing Submission',
            },
          ],
          calculation: `Agency Reported (${agRep}%) vs Inspected (${inspObserved}%) = ${div} percentage points divergence`,
          threshold: 'Triggered when government field measurement diverges from agency reported progress by ≥ 15 percentage points.',
          result: `Material on-site discrepancy of ${div} percentage points between filed claims and ground reality.`,
        };
      }

      case 'REPEATED_CORRECTIVE_ACTIONS': {
        const actionsCount = Number(anomaly.metrics?.correctiveActionsCount || 0);
        return {
          ruleName: 'Unresolved Corrective Directives',
          ruleKey: anomaly.ruleKey || 'RULE_REPEATED_CORRECTIVE_ACTIONS',
          description:
            'Flags projects where multiple government inspections have repeatedly issued rectification directives without verified closure.',
          inputs: [
            {
              label: 'Recorded Corrective Directives',
              value: `${actionsCount} corrective actions`,
              source: 'Field Inspection Quality Reports',
            },
            {
              label: 'Inspections Filed',
              value: `${inspections.length} inspection reports`,
              source: 'Government Inspection Log',
            },
          ],
          calculation: `Total unresolved quality and compliance directives: ${actionsCount}`,
          threshold: 'Triggered when 2 or more unresolved corrective actions persist across inspections.',
          result: `Chronic quality or safety non-compliance identified across multiple field audits.`,
        };
      }

      case 'CONFLICTING_RECORDS': {
        return {
          ruleName: 'Conflicting Record Discrepancy',
          ruleKey: anomaly.ruleKey || 'RULE_CONFLICTING_RECORDS',
          description:
            'Detects internal mathematical contradictions or irreconcilable inconsistencies between agency submissions.',
          inputs: [
            {
              label: 'Primary Record',
              value: 'Agency Milestone Completion Claim',
              source: 'Agency Milestone Filing',
            },
            {
              label: 'Contradictory Record',
              value: 'Overall Physical Progress Log / Inspection Notes',
              source: 'Project Log Registry',
            },
          ],
          calculation: 'Direct contradiction detected between reported status and granular milestone data',
          threshold: 'Triggered on mathematical inconsistency or contradictory completion claims.',
          result: 'Conflicting record statements require administrative reconciliation.',
        };
      }

      case 'PROJECT_STAGNATION': {
        const inactiveDays = Number(anomaly.metrics?.inactiveDays || 0);
        return {
          ruleName: 'Prolonged Project Stagnation',
          ruleKey: anomaly.ruleKey || 'RULE_PROJECT_STAGNATION',
          description:
            'Detects projects marked IN_PROGRESS with zero reported physical progress, zero financial disbursements, and zero inspection activity over an extended duration.',
          inputs: [
            {
              label: 'Inactivity Duration',
              value: `${inactiveDays} days`,
              source: 'Cross-Domain Inactivity Analysis',
            },
            {
              label: 'Current Status',
              value: project.status,
              source: 'Project Registry',
            },
          ],
          calculation: `Days elapsed without physical or financial movement: ${inactiveDays} days`,
          threshold: 'Triggered when an active project experiences > 60 days of total dormancy.',
          result: `Dormant public work project requires executive intervention or contract review.`,
        };
      }

      default: {
        return {
          ruleName: anomaly.title,
          ruleKey: anomaly.ruleKey || 'SYSTEM_RULE',
          description: anomaly.explanation,
          inputs: [
            {
              label: 'Trigger Metric',
              value: JSON.stringify(anomaly.metrics),
              source: 'System Monitoring Engine',
            },
          ],
          calculation: 'Rule evaluation condition met based on stored project records',
          threshold: 'Configured monitoring threshold breached',
          result: 'Anomaly flagged for administrative triage',
        };
      }
    }
  }

  /**
   * Builds supporting evidence references classified as DIRECT, CALCULATED, RELATED, or MISSING.
   */
  private static buildEvidenceItems(
    anomaly: ProjectAnomaly,
    project: Project,
    milestones: ProjectMilestone[],
    updates: ProjectProgressUpdate[],
    financialRecords: ProjectFinancialRecord[],
    inspections: ProjectInspection[]
  ): EvidenceReference[] {
    const evidence: EvidenceReference[] = [];
    const projectId = project.id;
    const verifiedRecords = financialRecords.filter((f) => f.verificationStatus === 'VERIFIED');
    const totalVerified = verifiedRecords.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const awarded = Number(project.awardedAmount || project.sanctionedAmount || 1);
    const finPct = Math.min(100, Math.round((totalVerified / awarded) * 100));
    const physPct = Number(project.physicalProgressPercent ?? project.physicalProgress ?? 0);

    // 1. PHYSICAL_FINANCIAL_DIVERGENCE
    if (anomaly.type === 'PHYSICAL_FINANCIAL_DIVERGENCE') {
      const latestUpdate = updates[0];
      if (latestUpdate) {
        evidence.push({
          evidenceId: `ev-${latestUpdate.id}`,
          sourceType: 'PROGRESS_UPDATE',
          sourceId: latestUpdate.id,
          projectId,
          timestamp: latestUpdate.updateDate,
          title: `Progress Update #${latestUpdate.id.slice(-6)}: ${latestUpdate.physicalProgressPercent}% Physical Progress`,
          description: latestUpdate.workCompletedDescription || 'Agency periodic work progress submission.',
          relevance: `Directly records the current agency-claimed physical progress of ${latestUpdate.physicalProgressPercent}%.`,
          classification: 'DIRECT',
          recordSnippet: {
            updateDate: latestUpdate.updateDate,
            physicalProgressPercent: latestUpdate.physicalProgressPercent,
            reportedBy: latestUpdate.submittedByName,
            workDescription: latestUpdate.workCompletedDescription,
          },
        });
      } else {
        evidence.push({
          evidenceId: `ev-missing-update`,
          sourceType: 'PROGRESS_UPDATE',
          sourceId: 'N/A',
          projectId,
          title: 'Latest Physical Progress Record',
          description: 'Evidence not available in the current system records.',
          relevance: 'Physical progress basis falls back to project registry baseline.',
          classification: 'MISSING',
        });
      }

      // Verified Financial Records
      if (verifiedRecords.length > 0) {
        evidence.push({
          evidenceId: `ev-fin-summary`,
          sourceType: 'FINANCIAL_RECORD',
          sourceId: `batch-${verifiedRecords.length}-records`,
          projectId,
          timestamp: verifiedRecords[0]?.verifiedAt || verifiedRecords[0]?.entryDate,
          title: `${verifiedRecords.length} Verified Invoices Totaling ₹${totalVerified.toLocaleString('en-IN')}`,
          description: `Cumulative disbursements verified by nodal finance cell: ₹${totalVerified.toLocaleString('en-IN')} (${finPct}% of awarded budget).`,
          relevance: `Directly establishes the financial utilization baseline evaluated in the divergence calculation.`,
          classification: 'DIRECT',
          recordSnippet: {
            verifiedInvoicesCount: verifiedRecords.length,
            totalVerifiedAmount: totalVerified,
            awardedContractAmount: awarded,
            financialUtilizationPercent: finPct,
            sampleInvoices: verifiedRecords.slice(0, 3).map((v) => ({
              id: v.id,
              amount: v.amount,
              verifiedAt: v.verifiedAt,
              reference: v.referenceNumber,
            })),
          },
        });
      } else {
        evidence.push({
          evidenceId: `ev-missing-fin`,
          sourceType: 'FINANCIAL_RECORD',
          sourceId: 'N/A',
          projectId,
          title: 'Verified Financial Claims',
          description: 'Evidence not available in the current system records.',
          relevance: 'No verified financial records exist in project ledger.',
          classification: 'MISSING',
        });
      }

      // Calculated Divergence Record
      evidence.push({
        evidenceId: `ev-calc-divergence`,
        sourceType: 'RISK_ASSESSMENT',
        sourceId: `calc-${anomaly.id}`,
        projectId,
        timestamp: anomaly.detectedAt,
        title: `Divergence Variance: ${finPct - physPct} Percentage Points`,
        description: `Derived variance: ${finPct}% verified expenditure minus ${physPct}% physical progress equals ${finPct - physPct} percentage points.`,
        relevance: `Calculated metric that breached the monitoring tolerance threshold.`,
        classification: 'CALCULATED',
        metrics: {
          physicalProgressPercent: physPct,
          financialUtilizationPercent: finPct,
          divergencePercentagePoints: finPct - physPct,
        },
      });

      // Project Award Document Reference
      evidence.push({
        evidenceId: `ev-proj-award`,
        sourceType: 'PROJECT',
        sourceId: project.id,
        projectId,
        timestamp: project.startDate,
        title: `Contract Award Baseline: ₹${awarded.toLocaleString('en-IN')}`,
        description: `Sanctioned work order for ${project.title}, awarded to ${project.implementingAgencyName || project.agencyName || 'Agency'}.`,
        relevance: `Provides the financial denominator used to compute percentage utilization.`,
        classification: 'RELATED',
        recordSnippet: {
          awardedAmount: project.awardedAmount,
          sanctionedAmount: project.sanctionedAmount,
          startDate: project.startDate,
          plannedCompletionDate: project.plannedCompletionDate,
        },
      });
    }

    // 2. MILESTONE_DELAY
    else if (anomaly.type === 'MILESTONE_DELAY') {
      const targetMsId = (anomaly.metrics?.milestoneId as string) || '';
      const targetMs = milestones.find((m) => m.id === targetMsId) || milestones[0];

      if (targetMs) {
        evidence.push({
          evidenceId: `ev-${targetMs.id}`,
          sourceType: 'MILESTONE',
          sourceId: targetMs.id,
          projectId,
          timestamp: targetMs.plannedEndDate,
          title: `Milestone #${targetMs.sequence}: "${targetMs.title}"`,
          description: `Planned completion date was ${targetMs.plannedEndDate.split('T')[0]}. Current progress: ${targetMs.progressPercent}%. Status: ${targetMs.status}.`,
          relevance: `Direct baseline record establishing contractual deadline breach.`,
          classification: 'DIRECT',
          recordSnippet: {
            sequence: targetMs.sequence,
            title: targetMs.title,
            weightPercent: targetMs.weightPercent,
            progressPercent: targetMs.progressPercent,
            plannedEndDate: targetMs.plannedEndDate,
            status: targetMs.status,
          },
        });

        const daysDelayed = Number(anomaly.metrics?.daysDelayed || 0);
        evidence.push({
          evidenceId: `ev-delay-calc`,
          sourceType: 'ANOMALY',
          sourceId: `calc-delay-${targetMs.id}`,
          projectId,
          timestamp: anomaly.detectedAt,
          title: `Schedule Breach Duration: ${daysDelayed} Days Overdue`,
          description: `Calculated elapsed calendar days beyond scheduled target date (${targetMs.plannedEndDate.split('T')[0]}) without 100% completion.`,
          relevance: `Quantifies the severity of delivery delay against agreed timetable.`,
          classification: 'CALCULATED',
          metrics: { daysDelayed },
        });
      } else {
        evidence.push({
          evidenceId: `ev-missing-ms`,
          sourceType: 'MILESTONE',
          sourceId: 'N/A',
          projectId,
          title: 'Scheduled Milestone Record',
          description: 'Evidence not available in the current system records.',
          relevance: 'Target milestone ID could not be resolved from active schedule.',
          classification: 'MISSING',
        });
      }

      // Related progress updates
      if (updates.length > 0) {
        evidence.push({
          evidenceId: `ev-rel-update-${updates[0].id}`,
          sourceType: 'PROGRESS_UPDATE',
          sourceId: updates[0].id,
          projectId,
          timestamp: updates[0].updateDate,
          title: `Latest Work Status: ${updates[0].physicalProgressPercent}% Overall`,
          description: updates[0].workCompletedDescription || 'Periodic update logged by executing agency.',
          relevance: `Contextual indicator of current physical activity on site.`,
          classification: 'RELATED',
        });
      }
    }

    // 3. REPEATED_MILESTONE_DELAYS
    else if (anomaly.type === 'REPEATED_MILESTONE_DELAYS') {
      const delayedMilestones = milestones.filter(
        (m) => m.status === 'DELAYED' || (m.progressPercent < 100 && new Date(m.plannedEndDate) < new Date())
      );

      if (delayedMilestones.length > 0) {
        delayedMilestones.forEach((m) => {
          evidence.push({
            evidenceId: `ev-ms-${m.id}`,
            sourceType: 'MILESTONE',
            sourceId: m.id,
            projectId,
            timestamp: m.plannedEndDate,
            title: `Delayed Milestone #${m.sequence}: "${m.title}"`,
            description: `Target date: ${m.plannedEndDate.split('T')[0]}, Progress: ${m.progressPercent}%, Weight: ${m.weightPercent}%.`,
            relevance: `Contributes to the pattern of systemic delivery delay across multiple project stages.`,
            classification: 'DIRECT',
            recordSnippet: {
              sequence: m.sequence,
              title: m.title,
              plannedEndDate: m.plannedEndDate,
              progressPercent: m.progressPercent,
              status: m.status,
            },
          });
        });

        evidence.push({
          evidenceId: `ev-calc-delayed-sequence`,
          sourceType: 'RISK_ASSESSMENT',
          sourceId: `calc-rep-delays`,
          projectId,
          timestamp: anomaly.detectedAt,
          title: `Chronological Delay Pattern: ${delayedMilestones.length} Milestone Failures`,
          description: `Cumulative weight of delayed milestones: ${delayedMilestones.reduce((s, m) => s + (m.weightPercent || 0), 0)}% of project scope.`,
          relevance: `Calculated multi-stage failure exceeding administrative monitoring thresholds.`,
          classification: 'CALCULATED',
        });
      } else {
        evidence.push({
          evidenceId: `ev-missing-delayed-ms`,
          sourceType: 'MILESTONE',
          sourceId: 'N/A',
          projectId,
          title: 'Milestone Schedule Records',
          description: 'Evidence not available in the current system records.',
          relevance: 'Delayed milestone records could not be resolved.',
          classification: 'MISSING',
        });
      }
    }

    // 4. EXPENDITURE_ACCELERATION
    else if (anomaly.type === 'EXPENDITURE_ACCELERATION') {
      const recentClaims = verifiedRecords.slice(0, 3);
      if (recentClaims.length > 0) {
        recentClaims.forEach((rec) => {
          evidence.push({
            evidenceId: `ev-fin-${rec.id}`,
            sourceType: 'FINANCIAL_RECORD',
            sourceId: rec.id,
            projectId,
            timestamp: rec.entryDate,
            title: `Disbursement Claim: ₹${Number(rec.amount).toLocaleString('en-IN')}`,
            description: `Invoice ref ${rec.referenceNumber || rec.id} for ${rec.expenditureType || 'Civil works'}: ${rec.description || 'Disbursement'}.`,
            relevance: `Direct invoice submission contributing to the concentrated expenditure surge.`,
            classification: 'DIRECT',
            recordSnippet: {
              amount: rec.amount,
              entryDate: rec.entryDate,
              referenceNumber: rec.referenceNumber,
              verificationStatus: rec.verificationStatus,
            },
          });
        });

        evidence.push({
          evidenceId: `ev-accel-calc`,
          sourceType: 'ANOMALY',
          sourceId: `calc-accel-${anomaly.id}`,
          projectId,
          timestamp: anomaly.detectedAt,
          title: `Acceleration Velocity: ₹${Number(anomaly.metrics?.acceleratedAmount || 0).toLocaleString('en-IN')} in 30-Day Window`,
          description: `Represents ${anomaly.metrics?.acceleratedPercentage || 0}% of the entire contract budget billed within a single surveillance window.`,
          relevance: `Derived metric indicating rapid billing clustering.`,
          classification: 'CALCULATED',
        });
      } else {
        evidence.push({
          evidenceId: `ev-missing-accel-fin`,
          sourceType: 'FINANCIAL_RECORD',
          sourceId: 'N/A',
          projectId,
          title: 'Recent Financial Submissions',
          description: 'Evidence not available in the current system records.',
          relevance: 'Individual accelerated financial invoices not found.',
          classification: 'MISSING',
        });
      }
    }

    // 5. AWARDED_VALUE_OVERRUN
    else if (anomaly.type === 'AWARDED_VALUE_OVERRUN') {
      evidence.push({
        evidenceId: `ev-award-doc`,
        sourceType: 'PROJECT',
        sourceId: project.id,
        projectId,
        timestamp: project.startDate,
        title: `Contract Award Ceiling: ₹${awarded.toLocaleString('en-IN')}`,
        description: `Statutory sanctioned expenditure limit for ${project.title}.`,
        relevance: `Authoritative legal ceiling for total permissible project disbursals.`,
        classification: 'DIRECT',
        recordSnippet: {
          awardedAmount: project.awardedAmount,
          sanctionedAmount: project.sanctionedAmount,
        },
      });

      if (verifiedRecords.length > 0) {
        evidence.push({
          evidenceId: `ev-fin-overrun-ledger`,
          sourceType: 'FINANCIAL_RECORD',
          sourceId: `ledger-${projectId}`,
          projectId,
          timestamp: verifiedRecords[0]?.verifiedAt,
          title: `Total Verified Invoices: ₹${totalVerified.toLocaleString('en-IN')}`,
          description: `Cumulative amount cleared across ${verifiedRecords.length} verified invoices.`,
          relevance: `Direct sum of approved payments demonstrating breach of awarded value.`,
          classification: 'DIRECT',
        });

        evidence.push({
          evidenceId: `ev-overrun-calc`,
          sourceType: 'ANOMALY',
          sourceId: `calc-overrun`,
          projectId,
          timestamp: anomaly.detectedAt,
          title: `Calculated Overrun: ₹${(totalVerified - awarded).toLocaleString('en-IN')} Excess Disbursed`,
          description: `Disbursements exceed sanctioned contract amount by ${(((totalVerified - awarded) / awarded) * 100).toFixed(1)}%.`,
          relevance: `Derived excess amount requiring administrative budget regularisation.`,
          classification: 'CALCULATED',
        });
      } else {
        evidence.push({
          evidenceId: `ev-missing-overrun-fin`,
          sourceType: 'FINANCIAL_RECORD',
          sourceId: 'N/A',
          projectId,
          title: 'Financial Ledger Records',
          description: 'Evidence not available in the current system records.',
          relevance: 'Detailed invoice records missing.',
          classification: 'MISSING',
        });
      }
    }

    // 6. LONG_REPORTING_GAP
    else if (anomaly.type === 'LONG_REPORTING_GAP') {
      const latestUpdate = updates[0];
      if (latestUpdate) {
        evidence.push({
          evidenceId: `ev-last-update-${latestUpdate.id}`,
          sourceType: 'PROGRESS_UPDATE',
          sourceId: latestUpdate.id,
          projectId,
          timestamp: latestUpdate.updateDate,
          title: `Most Recent Progress Update: ${latestUpdate.updateDate.split('T')[0]}`,
          description: `Filing #${latestUpdate.id.slice(-6)}: "${latestUpdate.workCompletedDescription || 'Routine work'}"`,
          relevance: `Authoritative reference point establishing the date when agency reporting ceased.`,
          classification: 'DIRECT',
          recordSnippet: {
            updateDate: latestUpdate.updateDate,
            reportedBy: latestUpdate.submittedByName,
            physicalProgressPercent: latestUpdate.physicalProgressPercent,
          },
        });
      } else {
        evidence.push({
          evidenceId: `ev-missing-gap-update`,
          sourceType: 'PROGRESS_UPDATE',
          sourceId: 'N/A',
          projectId,
          title: 'Historical Agency Updates',
          description: 'Evidence not available in the current system records.',
          relevance: 'No agency progress updates have been submitted since project initiation.',
          classification: 'MISSING',
        });
      }

      const gapDays = Number(anomaly.metrics?.reportingGapDays || 0);
      evidence.push({
        evidenceId: `ev-gap-calc`,
        sourceType: 'ANOMALY',
        sourceId: `calc-gap-${anomaly.id}`,
        projectId,
        timestamp: anomaly.detectedAt,
        title: `Elapsed Gap: ${gapDays} Consecutive Days Inactive`,
        description: `Calculated duration without mandatory statutory update filing (threshold is 45 days).`,
        relevance: `Quantifies contractual reporting lapse.`,
        classification: 'CALCULATED',
      });
    }

    // 7. INSPECTION_PROGRESS_DIVERGENCE
    else if (anomaly.type === 'INSPECTION_PROGRESS_DIVERGENCE') {
      const latestInsp = inspections[0];
      const latestUpdate = updates[0];

      if (latestInsp) {
        evidence.push({
          evidenceId: `ev-insp-${latestInsp.id}`,
          sourceType: 'INSPECTION',
          sourceId: latestInsp.id,
          projectId,
          timestamp: latestInsp.inspectionDate,
          title: `Government Field Inspection: ${latestInsp.physicalProgressObserved}% Measured`,
          description: `Conducted by ${latestInsp.officerName} (${latestInsp.officerDesignation || 'Inspection Officer'}). Findings: ${latestInsp.observations}`,
          relevance: `Direct physical measurement by government authority on site.`,
          classification: 'DIRECT',
          recordSnippet: {
            officerName: latestInsp.officerName,
            officerDesignation: latestInsp.officerDesignation,
            inspectionDate: latestInsp.inspectionDate,
            physicalProgressObserved: latestInsp.physicalProgressObserved,
            observations: latestInsp.observations,
            issues: latestInsp.issues,
            correctiveActions: latestInsp.correctiveActions,
          },
        });
      } else {
        evidence.push({
          evidenceId: `ev-missing-insp`,
          sourceType: 'INSPECTION',
          sourceId: 'N/A',
          projectId,
          title: 'Government Field Inspection Report',
          description: 'Evidence not available in the current system records.',
          relevance: 'Direct inspection report not found in storage.',
          classification: 'MISSING',
        });
      }

      if (latestUpdate) {
        evidence.push({
          evidenceId: `ev-upd-${latestUpdate.id}`,
          sourceType: 'PROGRESS_UPDATE',
          sourceId: latestUpdate.id,
          projectId,
          timestamp: latestUpdate.updateDate,
          title: `Agency Self-Claimed Progress: ${latestUpdate.physicalProgressPercent}%`,
          description: `Filed on ${latestUpdate.updateDate.split('T')[0]} by ${latestUpdate.submittedByName || 'Executing Agency'}.`,
          relevance: `Direct agency filing being compared against on-site physical measurement.`,
          classification: 'DIRECT',
          recordSnippet: {
            updateDate: latestUpdate.updateDate,
            physicalProgressPercent: latestUpdate.physicalProgressPercent,
            workDescription: latestUpdate.workCompletedDescription,
          },
        });
      } else {
        evidence.push({
          evidenceId: `ev-upd-project-claim`,
          sourceType: 'PROJECT',
          sourceId: project.id,
          projectId,
          title: `Registry Progress Record: ${project.physicalProgressPercent}%`,
          description: `Current registry physical progress claim.`,
          relevance: `Primary agency progress claim on file.`,
          classification: 'DIRECT',
        });
      }

      const inspPct = Number(anomaly.metrics?.inspectedProgressPercent ?? latestInsp?.physicalProgressObserved ?? 0);
      const repPct = Number(anomaly.metrics?.reportedProgressPercent ?? project.physicalProgressPercent ?? 0);
      evidence.push({
        evidenceId: `ev-insp-div-calc`,
        sourceType: 'ANOMALY',
        sourceId: `calc-insp-div`,
        projectId,
        timestamp: anomaly.detectedAt,
        title: `Side-by-Side Divergence: ${Math.abs(repPct - inspPct)} Percentage Points`,
        description: `Agency reported ${repPct}% vs Government inspected ${inspPct}%. Notice: System presents both records side-by-side for administrative reconciliation without making a judicial determination of correctness.`,
        relevance: `Derived discrepancy triggering on-site review directive.`,
        classification: 'CALCULATED',
      });
    }

    // 8. REPEATED_CORRECTIVE_ACTIONS
    else if (anomaly.type === 'REPEATED_CORRECTIVE_ACTIONS') {
      const inspectionsWithActions = inspections.filter(
        (i) => i.correctiveActions && i.correctiveActions.length > 0
      );

      if (inspectionsWithActions.length > 0) {
        inspectionsWithActions.forEach((insp) => {
          evidence.push({
            evidenceId: `ev-insp-action-${insp.id}`,
            sourceType: 'INSPECTION',
            sourceId: insp.id,
            projectId,
            timestamp: insp.inspectionDate,
            title: `Inspection Directive (${insp.inspectionDate.split('T')[0]}): ${insp.correctiveActions.length} Action(s)`,
            description: `Directives issued by ${insp.officerName}: ${insp.correctiveActions.join('; ')}`,
            relevance: `Authoritative record of quality/safety rectification order issued to agency.`,
            classification: 'DIRECT',
            recordSnippet: {
              inspectionDate: insp.inspectionDate,
              officerName: insp.officerName,
              correctiveActions: insp.correctiveActions,
              issues: insp.issues,
            },
          });
        });

        evidence.push({
          evidenceId: `ev-calc-directives-count`,
          sourceType: 'ANOMALY',
          sourceId: `calc-directives`,
          projectId,
          timestamp: anomaly.detectedAt,
          title: `Pattern Summary: ${anomaly.metrics?.correctiveActionsCount || inspectionsWithActions.length} Rectification Directives`,
          description: `Multiple inspections have cited persistent non-compliance without documented verification of completion.`,
          relevance: `Quantifies repeated corrective burden.`,
          classification: 'CALCULATED',
        });
      } else {
        evidence.push({
          evidenceId: `ev-missing-actions`,
          sourceType: 'INSPECTION',
          sourceId: 'N/A',
          projectId,
          title: 'Inspection Directives',
          description: 'Evidence not available in the current system records.',
          relevance: 'Inspection records with corrective actions missing.',
          classification: 'MISSING',
        });
      }
    }

    // 9. CONFLICTING_RECORDS
    else if (anomaly.type === 'CONFLICTING_RECORDS') {
      const latestUpdate = updates[0];
      if (latestUpdate) {
        evidence.push({
          evidenceId: `ev-conflict-update-${latestUpdate.id}`,
          sourceType: 'PROGRESS_UPDATE',
          sourceId: latestUpdate.id,
          projectId,
          timestamp: latestUpdate.updateDate,
          title: `First Contradictory Record: Progress Update #${latestUpdate.id.slice(-6)}`,
          description: `Filed progress: ${latestUpdate.physicalProgressPercent}%. Work notes: ${latestUpdate.workCompletedDescription}`,
          relevance: `Contains statements that conflict with milestone tracker records.`,
          classification: 'DIRECT',
        });
      }

      if (milestones.length > 0) {
        evidence.push({
          evidenceId: `ev-conflict-ms-${milestones[0].id}`,
          sourceType: 'MILESTONE',
          sourceId: milestones[0].id,
          projectId,
          timestamp: milestones[0].plannedEndDate,
          title: `Second Contradictory Record: Milestone Schedule Tracker`,
          description: `Individual milestone progress contradicts overall summary declarations.`,
          relevance: `Contains contradictory completion statements.`,
          classification: 'DIRECT',
        });
      }

      evidence.push({
        evidenceId: `ev-conflict-statement`,
        sourceType: 'ANOMALY',
        sourceId: `calc-conflict`,
        projectId,
        timestamp: anomaly.detectedAt,
        title: 'Conflict Identified Between System Records',
        description:
          'Internal discrepancy identified between progress updates and milestone execution logs. Administrative reconciliation required.',
        relevance: 'Direct conflict flagged for verification.',
        classification: 'CALCULATED',
      });
    }

    // 10. PROJECT_STAGNATION
    else if (anomaly.type === 'PROJECT_STAGNATION') {
      const latestUpdate = updates[0];
      const latestFin = verifiedRecords[0];
      const latestInsp = inspections[0];

      if (latestUpdate) {
        evidence.push({
          evidenceId: `ev-stag-update`,
          sourceType: 'PROGRESS_UPDATE',
          sourceId: latestUpdate.id,
          projectId,
          timestamp: latestUpdate.updateDate,
          title: `Last Recorded Progress Update: ${latestUpdate.updateDate.split('T')[0]}`,
          description: `No subsequent progress updates have been filed since this date.`,
          relevance: `Establishes starting point of physical inactivity.`,
          classification: 'DIRECT',
        });
      } else {
        evidence.push({
          evidenceId: `ev-missing-stag-update`,
          sourceType: 'PROGRESS_UPDATE',
          sourceId: 'N/A',
          projectId,
          title: 'Physical Progress Submissions',
          description: 'Evidence not available in the current system records.',
          relevance: 'Zero physical progress updates have been submitted for this project.',
          classification: 'MISSING',
        });
      }

      if (latestFin) {
        evidence.push({
          evidenceId: `ev-stag-fin`,
          sourceType: 'FINANCIAL_RECORD',
          sourceId: latestFin.id,
          projectId,
          timestamp: latestFin.entryDate,
          title: `Last Financial Activity: ${latestFin.entryDate.split('T')[0]}`,
          description: `Last invoice claim of ₹${Number(latestFin.amount).toLocaleString('en-IN')}.`,
          relevance: `Establishes starting point of financial dormancy.`,
          classification: 'DIRECT',
        });
      }

      if (latestInsp) {
        evidence.push({
          evidenceId: `ev-stag-insp`,
          sourceType: 'INSPECTION',
          sourceId: latestInsp.id,
          projectId,
          timestamp: latestInsp.inspectionDate,
          title: `Last Field Inspection: ${latestInsp.inspectionDate.split('T')[0]}`,
          description: `Conducted by ${latestInsp.officerName}.`,
          relevance: `Establishes last on-site monitoring interaction.`,
          classification: 'DIRECT',
        });
      }

      evidence.push({
        evidenceId: `ev-calc-stagnation`,
        sourceType: 'ANOMALY',
        sourceId: `calc-stag`,
        projectId,
        timestamp: anomaly.detectedAt,
        title: `Total Dormancy Duration: ${anomaly.metrics?.inactiveDays || 60} Days`,
        description: `No verifiable physical, financial, or inspection activity recorded across surveillance period.`,
        relevance: `Confirms systemic project halt.`,
        classification: 'CALCULATED',
      });
    }

    // Default / Milestone schedule pressure fallback
    else {
      if (milestones.length > 0) {
        evidence.push({
          evidenceId: `ev-ms-sched-${milestones[0].id}`,
          sourceType: 'MILESTONE',
          sourceId: milestones[0].id,
          projectId,
          timestamp: milestones[0].plannedEndDate,
          title: `Milestone Schedule Baseline`,
          description: `Target date: ${milestones[0].plannedEndDate.split('T')[0]}`,
          relevance: `Baseline delivery schedule.`,
          classification: 'DIRECT',
        });
      }
      evidence.push({
        evidenceId: `ev-gen-metric`,
        sourceType: 'ANOMALY',
        sourceId: `metric-${anomaly.id}`,
        projectId,
        timestamp: anomaly.detectedAt,
        title: anomaly.title,
        description: anomaly.explanation,
        relevance: 'System monitoring rule criteria satisfied.',
        classification: 'CALCULATED',
      });
    }

    return evidence;
  }

  /**
   * Builds an ordered chronological timeline of all relevant events on this project.
   */
  private static buildTimeline(
    project: Project,
    milestones: ProjectMilestone[],
    updates: ProjectProgressUpdate[],
    financialRecords: ProjectFinancialRecord[],
    inspections: ProjectInspection[],
    auditEvents: ProjectAuditEvent[],
    targetAnomaly: ProjectAnomaly
  ): ProjectTimelineEvent[] {
    const events: ProjectTimelineEvent[] = [];

    // 1. Project Creation
    if (project.createdAt || project.startDate) {
      events.push({
        eventId: `tl-proj-created`,
        date: project.createdAt || project.startDate,
        eventType: 'PROJECT_CREATED',
        title: 'Project Registered & Work Order Sanctioned',
        description: `Project ${project.projectNumber || project.id} sanctioned for ₹${Number(project.awardedAmount || project.sanctionedAmount || 0).toLocaleString('en-IN')}.`,
        sourceType: 'PROJECT',
        sourceId: project.id,
        badgeText: 'Sanction',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      });
    }

    // 2. Milestones Planned
    milestones.forEach((m) => {
      events.push({
        eventId: `tl-ms-${m.id}`,
        date: m.plannedEndDate,
        eventType: 'MILESTONE_PLANNED',
        title: `Milestone Deadline: "${m.title}"`,
        description: `Planned target completion for Milestone #${m.sequence} (${m.weightPercent}% weight). Current progress: ${m.progressPercent}%.`,
        sourceType: 'MILESTONE',
        sourceId: m.id,
        badgeText: 'Milestone Target',
        badgeColor: m.status === 'DELAYED' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-blue-100 text-blue-800 border-blue-300',
        isDirectlySupportingFinding: targetAnomaly.type.includes('MILESTONE'),
      });
    });

    // 3. Progress Updates
    updates.forEach((u) => {
      events.push({
        eventId: `tl-upd-${u.id}`,
        date: u.updateDate,
        eventType: 'PROGRESS_UPDATE',
        title: `Progress Update: ${u.physicalProgressPercent}% Work Reported`,
        description: `${u.submittedByName || 'Executing agency'}: ${u.workCompletedDescription || 'Periodic progress update'}`,
        sourceType: 'PROGRESS_UPDATE',
        sourceId: u.id,
        badgeText: 'Progress Filing',
        badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        isDirectlySupportingFinding: targetAnomaly.type.includes('PROGRESS') || targetAnomaly.type.includes('DIVERGENCE'),
      });
    });

    // 4. Financial Records
    financialRecords.forEach((f) => {
      events.push({
        eventId: `tl-fin-${f.id}`,
        date: f.verifiedAt || f.entryDate,
        eventType: 'FINANCIAL_VERIFIED',
        title: `Invoice Claim: ₹${Number(f.amount).toLocaleString('en-IN')} (${f.verificationStatus})`,
        description: `Ref: ${f.referenceNumber || f.id} — ${f.description || 'Expenditure claim verified'}`,
        sourceType: 'FINANCIAL_RECORD',
        sourceId: f.id,
        badgeText: f.verificationStatus === 'VERIFIED' ? 'Disbursement Verified' : 'Financial Claim',
        badgeColor: f.verificationStatus === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-800 border-slate-300',
        isDirectlySupportingFinding: targetAnomaly.type.includes('FINANCIAL') || targetAnomaly.type.includes('ACCELERATION') || targetAnomaly.type.includes('OVERRUN'),
      });
    });

    // 5. Inspections Conducted
    inspections.forEach((i) => {
      events.push({
        eventId: `tl-insp-${i.id}`,
        date: i.inspectionDate,
        eventType: 'INSPECTION_CONDUCTED',
        title: `Field Inspection by ${i.officerName} (${i.physicalProgressObserved}% Observed)`,
        description: i.observations || 'Official field verification conducted on site.',
        sourceType: 'INSPECTION',
        sourceId: i.id,
        badgeText: 'Field Inspection',
        badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
        isDirectlySupportingFinding: targetAnomaly.type.includes('INSPECTION') || targetAnomaly.type.includes('CORRECTIVE'),
      });
    });

    // 6. Anomaly Detected
    events.push({
      eventId: `tl-anom-${targetAnomaly.id}`,
      date: targetAnomaly.detectedAt,
      eventType: 'ANOMALY_DETECTED',
      title: `Surveillance Alert Flagged: ${targetAnomaly.title}`,
      description: `${targetAnomaly.severity} risk signal identified by deterministic surveillance engine (${targetAnomaly.type}).`,
      sourceType: 'ANOMALY',
      sourceId: targetAnomaly.id,
      badgeText: `${targetAnomaly.severity} Anomaly Flagged`,
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
      isDirectlySupportingFinding: true,
    });

    // 7. Investigation Actions
    auditEvents
      .filter((ev) => (ev.action || '').startsWith('ANOMALY_') || ev.action === 'INVESTIGATION_NOTE_ADDED')
      .forEach((ev) => {
        events.push({
          eventId: `tl-audit-${ev.eventId}`,
          date: ev.timestamp,
          eventType: 'INVESTIGATION_ACTION',
          title: `Investigation Action: ${(ev.action || '').replace(/_/g, ' ')}`,
          description: ev.notes || `Action recorded by ${ev.actorName || 'Government Officer'}.`,
          sourceType: 'AUDIT_EVENT',
          sourceId: ev.eventId,
          badgeText: 'Officer Action',
          badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
          isDirectlySupportingFinding: true,
        });
      });

    // Sort chronologically ascending
    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // ==========================================
  // INVESTIGATION NOTES (APPEND-ONLY)
  // ==========================================

  /**
   * Retrieves append-only investigation notes for a stable finding ID.
   * Merges authoritative Firestore notes (when in live session) with local fallback cache.
   */
  static async getInvestigationNotes(findingId: string, projectId?: string): Promise<InvestigationNote[]> {
    const localNotes = getLocalItems<InvestigationNote>(LOCAL_STORAGE_NOTES_KEY, []);
    let liveNotes: InvestigationNote[] = [];

    if (isLiveFirestoreSession() && db) {
      try {
        const notesRef = collection(db, INVESTIGATION_NOTES_COLLECTION);
        const q = query(notesRef, where('findingId', '==', findingId));
        const snap = await getDocs(q);
        snap.forEach((d) => {
          liveNotes.push(d.data() as InvestigationNote);
        });
      } catch (err) {
        console.warn('[EvidenceChainService] Failed to query live investigation notes, falling back to local cache:', err);
      }
    }

    const noteMap = new Map<string, InvestigationNote>();
    for (const note of liveNotes) {
      noteMap.set(note.noteId, note);
    }
    for (const note of localNotes) {
      if (
        (note.findingId === findingId || (projectId && note.projectId === projectId && note.findingId.includes(findingId))) &&
        !noteMap.has(note.noteId)
      ) {
        noteMap.set(note.noteId, note);
      }
    }

    return Array.from(noteMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Appends an immutable investigation note for a finding.
   * Atomically records an INVESTIGATION_NOTE_ADDED audit event for administrative accountability.
   */
  static async addInvestigationNote(params: {
    findingId: string;
    occurrenceId?: string;
    projectId: string;
    note: string;
    user: {
      uid?: string;
      id?: string;
      name?: string;
      role?: string;
    };
    actionReference?: string;
  }): Promise<InvestigationNote> {
    const { findingId, occurrenceId, projectId, note, user, actionReference } = params;

    const userRole = (user?.role || '').toLowerCase();
    if (!userRole.includes('gov')) {
      throw new Error('Unauthorized: Investigation notes may only be authored by authorized government officials.');
    }

    if (!note || note.trim().length < 5) {
      throw new Error('Investigation note must contain at least 5 characters of substantive observation.');
    }

    // Authoritative actor binding: authorId MUST match request.auth.uid in live Firestore
    const currentUid = auth?.currentUser?.uid || user.uid || user.id;
    const authorId = currentUid || 'usr-gov-001';
    const nowIso = new Date().toISOString();
    const noteId = `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newNote: InvestigationNote = {
      noteId,
      findingId,
      occurrenceId,
      projectId,
      authorId,
      authorName: user.name || 'Government Nodal Officer',
      authorRole: 'government',
      timestamp: nowIso,
      note: note.trim(),
      actionReference,
    };

    // Record INVESTIGATION_NOTE_ADDED audit event
    const eventId = `evt-note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const auditEvent: ProjectAuditEvent = {
      eventId,
      projectId,
      action: 'INVESTIGATION_NOTE_ADDED',
      actorId: authorId,
      actorRole: 'government',
      actorName: user.name || 'Government Nodal Officer',
      timestamp: nowIso,
      notes: `Investigation observation recorded on finding "${findingId}": "${note.trim().substring(0, 80)}..."`,
      newState: {
        findingId,
        occurrenceId,
        noteId,
      },
    };

    // Authoritative atomic commit to Firestore if live session
    if (isLiveFirestoreSession() && db) {
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, INVESTIGATION_NOTES_COLLECTION, noteId), sanitizeFirestorePayload(newNote));
        batch.set(doc(db, AUDIT_EVENTS_COLLECTION, eventId), sanitizeFirestorePayload(auditEvent));
        await batch.commit();
      } catch (err: any) {
        console.error('[EvidenceChainService] Authoritative Firestore write rejected:', err);
        throw new Error(`Authoritative persistence failed: ${err?.message || 'Firestore write rejected by security rules'}`);
      }
    }

    // Save locally for fallback/demo cache
    const existingNotes = getLocalItems<InvestigationNote>(LOCAL_STORAGE_NOTES_KEY, []);
    existingNotes.unshift(newNote);
    saveLocalItems(LOCAL_STORAGE_NOTES_KEY, existingNotes);

    const allEvents = getLocalItems<ProjectAuditEvent>(LOCAL_STORAGE_AUDIT_EVENTS_KEY, []);
    allEvents.unshift(auditEvent);
    saveLocalItems(LOCAL_STORAGE_AUDIT_EVENTS_KEY, allEvents);

    return newNote;
  }

  /**
   * Retrieves underlying source record payload for modal/drawer record inspection.
   * Authoritatively resolves all 12 EvidenceSourceType variants backed by existing data models.
   */
  static async getEvidenceSource(
    sourceType: EvidenceSourceType,
    sourceId: string,
    projectId: string
  ): Promise<unknown> {
    const data = await this.getAuthoritativeProjectData(projectId);
    switch (sourceType) {
      case 'PROJECT':
        return data.project || null;
      case 'MILESTONE':
        return data.milestones.find((m) => m.id === sourceId) || null;
      case 'PROGRESS_UPDATE':
        return data.updates.find((u) => u.id === sourceId) || null;
      case 'FINANCIAL_RECORD':
        return data.financialRecords.find((f) => f.id === sourceId) || null;
      case 'INSPECTION':
        return data.inspections.find((i) => i.id === sourceId) || null;
      case 'AUDIT_EVENT':
        return data.auditEvents.find((e) => e.eventId === sourceId || (e as any).id === sourceId) || null;
      case 'ANOMALY':
        return data.anomalies.find((a) => a.id === sourceId) || null;
      case 'EXCEPTION': {
        try {
          const exceptions = await ProjectService.getExceptions(projectId);
          return exceptions.find((e) => e.id === sourceId) || null;
        } catch {
          return null;
        }
      }
      case 'RISK_ASSESSMENT': {
        try {
          const assessment = await AnomalyDetectionService.getProjectRiskAssessment(projectId);
          return assessment || (data.project as any)?.riskAssessment || null;
        } catch {
          return (data.project as any)?.riskAssessment || null;
        }
      }
      case 'PROPOSAL': {
        try {
          const propId = sourceId || (data.project as any)?.proposalId;
          if (propId) {
            return await ProposalService.getProposalById(propId);
          }
          return null;
        } catch {
          return null;
        }
      }
      case 'TENDER': {
        try {
          const tenderId = sourceId || (data.project as any)?.tenderId;
          if (tenderId) {
            return await TenderService.getTenderById(tenderId);
          }
          return null;
        } catch {
          return null;
        }
      }
      case 'ORGANIZATION': {
        try {
          const orgId = sourceId || (data.project as any)?.organizationId;
          if (orgId) {
            return await OrganizationService.getOrganizationById(orgId);
          }
          return null;
        } catch {
          return null;
        }
      }
      default:
        return null;
    }
  }

  /**
   * Fetches Server-Side AI Investigation Advisory using existing endpoint.
   * If AI fails or returns non-200, provides deterministic grounded advisory.
   */
  static async fetchInvestigationAdvisory(params: {
    findingId: string;
    anomaly: ProjectAnomaly;
    evidenceItems: EvidenceReference[];
    projectId: string;
  }): Promise<InvestigationAdvisory> {
    const { findingId, anomaly, evidenceItems, projectId } = params;

    try {
      let idToken = '';
      if (auth && auth.currentUser) {
        try {
          idToken = await auth.currentUser.getIdToken();
        } catch {
          // Fallback
        }
      }
      if (!idToken) {
        idToken = 'bti-demo-token-government';
      }

      const res = await fetch('/api/ai/project-risk-intelligence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          mode: 'INVESTIGATION_ADVISORY',
          findingId,
          projectId,
          anomaly,
          evidenceItems: evidenceItems.map((e) => ({
            title: e.title,
            description: e.description,
            sourceType: e.sourceType,
            relevance: e.relevance,
            classification: e.classification,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.advisory) {
          return data.advisory as InvestigationAdvisory;
        }
        if (data && data.assessment && data.assessment.summary) {
          // Adapt if assessment format was returned
          return {
            summary: data.assessment.summary,
            evidenceSummary: `Based on ${evidenceItems.filter((e) => e.classification === 'DIRECT').length} direct stored records and ${evidenceItems.filter((e) => e.classification === 'CALCULATED').length} calculated metrics.`,
            relatedSignals: data.assessment.contributingIndicators || [],
            recommendedReviewAreas: data.assessment.recommendedReviewAreas || [],
            missingEvidence: evidenceItems.filter((e) => e.classification === 'MISSING').map((e) => e.title),
            limitations: data.assessment.limitations || 'Advisory decision support grounded strictly in project records.',
            provider: data.assessment.provider || 'Gemini 3.8 Flash',
            model: data.assessment.model || 'gemini-3.8-flash',
            version: data.assessment.version || '1.0',
            timestamp: new Date().toISOString(),
          };
        }
      }
    } catch (err) {
      console.warn('[EvidenceChainService] Server AI advisory request failed, using deterministic fallback:', err);
    }

    // Deterministic fallback grounded strictly in supplied records
    return this.buildDeterministicAdvisory(findingId, anomaly, evidenceItems);
  }

  /**
   * Deterministic grounded advisory fallback when Gemini endpoint is unconfigured or offline.
   */
  private static buildDeterministicAdvisory(
    findingId: string,
    anomaly: ProjectAnomaly,
    evidenceItems: EvidenceReference[]
  ): InvestigationAdvisory {
    const directCount = evidenceItems.filter((e) => e.classification === 'DIRECT').length;
    const calcCount = evidenceItems.filter((e) => e.classification === 'CALCULATED').length;
    const missingCount = evidenceItems.filter((e) => e.classification === 'MISSING').length;
    const missingItems = evidenceItems.filter((e) => e.classification === 'MISSING').map((e) => e.title);

    const questionsMap: Record<AnomalyType, string[]> = {
      PHYSICAL_FINANCIAL_DIVERGENCE: [
        'Verify whether verified invoice billing items correspond to physical construction work executed on site during the same period.',
        'Request the Executive Engineer measurement book (MB) entries corresponding to the latest cleared financial claims.',
        'Ascertain whether procurement of materials has been verified through certified unspent material inventory logs on site.',
      ],
      MILESTONE_DELAY: [
        'Review contractor justification for milestone schedule overrun to ascertain weather, land clearance, or labour factors.',
        'Verify if contractor has requested a formal extension of time (EOT) under contract clause 4.2.',
        'Assess whether subsequent downstream milestones have been affected by this milestone delay.',
      ],
      REPEATED_MILESTONE_DELAYS: [
        'Evaluate overall contractor staffing capacity and on-site equipment mobilization across all work fronts.',
        'Verify if notice under liquidated damages or milestone breach provisions has been issued by the competent authority.',
        'Determine if site hindrance register indicates unaddressed departmental encumbrances.',
      ],
      MILESTONE_SCHEDULE_PRESSURE: [
        'Review whether the contractor has mobilized additional shifts or heavy machinery to meet the upcoming target date.',
        'Verify realistic daily casting or laying capacity against the required progress acceleration rate.',
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
        'Withhold current interim payment vouchers until joint reconciliation report is formally placed on record.',
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
      summary: `System surveillance flagged ${anomaly.severity} indicator "${anomaly.title}". This advisory is decision support only and does not establish wrongdoing.`,
      evidenceSummary: `Evaluation grounded strictly in ${directCount} direct stored records and ${calcCount} calculated metrics.${missingCount > 0 ? ` ${missingCount} expected evidence items are missing from system records.` : ''}`,
      relatedSignals: [
        `Deterministic anomaly indicator: ${anomaly.type} (${anomaly.severity})`,
        `Direct records available: ${directCount}`,
      ],
      recommendedReviewAreas: questionsMap[anomaly.type] || [
        'Conduct field verification to reconcile on-site work with submitted claims.',
        'Examine statutory measurement books and invoice vouchers.',
      ],
      missingEvidence: missingItems.length > 0 ? missingItems : ['None; all core expected records are present in system records.'],
      limitations:
        'These records support the identification of a monitoring anomaly but do not, by themselves, establish fraud or wrongdoing. Final determination requires on-site measurement and administrative inquiry.',
      provider: 'BTI Grounded Surveillance Engine (Deterministic Fallback)',
      model: 'deterministic-rules-v1.0',
      version: '1.0',
      timestamp: new Date().toISOString(),
    };
  }
}
