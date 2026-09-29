// Bharat Tender Intelligence (BTI) — Public Transparency Projection Builder
// Phase 9: Public Transparency & Citizen Social Audit Layer
// Pure functional DTO builders with 100% EXPLICIT ALLOWLISTING.
// Strict data boundary: Internal anomaly findings, risk scores, AI advisories,
// investigation notes, confidential reviewer comments, and audit details are NEVER admitted.

import {
  Project,
  ProjectMilestone,
  ProjectFinancialRecord,
  ProjectProgressUpdate,
  ProjectInspection,
  CanonicalProjectStatus,
} from '../../types/project.js';
import {
  PublicProjectDTO,
  PublicMilestoneSummaryDTO,
  PublicMilestoneDTO,
  PublicProgressUpdateDTO,
  PublicInspectionDTO,
  PublicTimelineEventDTO,
  PublicAccountabilityDTO,
  PublicDataProvenanceDTO,
} from '../../types/publicTransparency.js';

export function isProjectPubliclyDisclosed(project: any): boolean {
  if (!project) return false;
  if (project.publicDisclosureStatus === 'PUBLIC') return true;
  if (project.isPubliclyVisible === true && project.publicDisclosureStatus !== 'RESTRICTED') return true;
  return false;
}

/**
 * Explicit allowlist constructor for Milestone Summary DTO.
 * Allowed keys: sequence, title, progressPercent, status, weightPercent.
 */
export function buildExplicitPublicMilestoneSummary(m: any, idx: number): PublicMilestoneSummaryDTO {
  const result: PublicMilestoneSummaryDTO = {
    sequence: typeof m?.sequence === 'number' ? m.sequence : idx + 1,
    title: typeof m?.title === 'string' && m.title.trim().length > 0 ? m.title.trim() : `Milestone ${idx + 1}`,
    status: typeof m?.status === 'string' && m.status.trim().length > 0 ? m.status.trim() : 'Status not recorded',
  };
  if (typeof m?.progressPercent === 'number' && !isNaN(m.progressPercent)) {
    result.progressPercent = Math.max(0, Math.min(100, m.progressPercent));
  }
  if (typeof m?.weightPercent === 'number' && !isNaN(m.weightPercent)) {
    result.weightPercent = Math.max(0, Math.min(100, m.weightPercent));
  }
  return result;
}

/**
 * Explicit allowlist constructor for Detailed Milestone DTO.
 * Allowed keys: sequence, title, description, plannedEndDate, actualEndDate, weightPercent, progressPercent, status.
 */
export function buildExplicitPublicMilestone(m: any, idx: number): PublicMilestoneDTO {
  const result: PublicMilestoneDTO = {
    sequence: typeof m?.sequence === 'number' ? m.sequence : idx + 1,
    title: typeof m?.title === 'string' && m.title.trim().length > 0 ? m.title.trim() : `Milestone ${idx + 1}`,
    status: typeof m?.status === 'string' && m.status.trim().length > 0 ? m.status.trim() : 'Status not recorded',
  };

  if (typeof m?.weightPercent === 'number' && !isNaN(m.weightPercent)) {
    result.weightPercent = Math.max(0, Math.min(100, m.weightPercent));
  }
  if (typeof m?.progressPercent === 'number' && !isNaN(m.progressPercent)) {
    result.progressPercent = Math.max(0, Math.min(100, m.progressPercent));
  }
  if (typeof m?.description === 'string' && m.description.trim().length > 0) {
    result.description = m.description.trim();
  }
  if (typeof m?.plannedEndDate === 'string' && m.plannedEndDate.trim().length > 0) {
    result.plannedEndDate = m.plannedEndDate.trim();
  }
  if (typeof m?.actualEndDate === 'string' && m.actualEndDate.trim().length > 0) {
    result.actualEndDate = m.actualEndDate.trim();
  }

  return result;
}

/**
 * Explicit allowlist constructor for Public Progress Update DTO.
 * Allowed keys: date, progressPercentage, summary, implementationStatus.
 * Issue 4: Never substitute generic fabricated texts ("Routine progress report...") or fake "NORMAL".
 */
export function buildExplicitPublicProgressUpdate(u: any): PublicProgressUpdateDTO {
  const rawProg = typeof u?.progressPercentage === 'number'
    ? u.progressPercentage
    : (typeof u?.physicalProgressPercent === 'number' ? u.physicalProgressPercent : undefined);

  const result: PublicProgressUpdateDTO = {
    date: typeof u?.date === 'string' && u.date.trim().length > 0
      ? u.date.trim()
      : (u?.updateDate || u?.createdAt || 'Not recorded in the available public record'),
    summary: typeof u?.summary === 'string' && u.summary.trim().length > 0
      ? u.summary.trim()
      : (typeof u?.workCompletedDescription === 'string' && u.workCompletedDescription.trim().length > 0
          ? u.workCompletedDescription.trim()
          : 'Not recorded in the available public record'),
    implementationStatus: typeof u?.implementationStatus === 'string' && u.implementationStatus.trim().length > 0
      ? u.implementationStatus.trim()
      : (typeof u?.status === 'string' && u.status.trim().length > 0 ? u.status.trim() : 'Status not recorded'),
  };

  if (typeof rawProg === 'number' && !isNaN(rawProg)) {
    result.progressPercentage = Math.max(0, Math.min(100, rawProg));
  }

  return result;
}

/**
 * Explicit allowlist constructor for Public Inspection DTO.
 * Allowed keys: inspectionDate, observedProgress, qualityObservation, publicDirective, inspectionType.
 * Prohibits raw internal officer notes, issues, corrective actions, and recommendations.
 */
export function buildExplicitPublicInspection(i: any): PublicInspectionDTO {
  const publicObs = (typeof i?.publicObservation === 'string' && i.publicObservation.trim().length > 0)
    ? i.publicObservation.trim()
    : 'No public observation recorded in available records';

  const rawObserved = typeof i?.observedProgress === 'number'
    ? i.observedProgress
    : (typeof i?.physicalProgressObserved === 'number'
        ? i.physicalProgressObserved
        : (typeof i?.governmentVerifiedPhysicalProgressPercent === 'number'
            ? i.governmentVerifiedPhysicalProgressPercent
            : undefined));

  const result: PublicInspectionDTO = {
    inspectionDate: typeof i?.inspectionDate === 'string' && i.inspectionDate.trim().length > 0
      ? i.inspectionDate.trim()
      : 'Not recorded in the available public record',
    qualityObservation: publicObs,
  };

  if (typeof rawObserved === 'number' && !isNaN(rawObserved)) {
    result.observedProgress = Math.max(0, Math.min(100, rawObserved));
  }
  if (typeof i?.inspectionType === 'string' && i.inspectionType.trim().length > 0) {
    result.inspectionType = i.inspectionType.trim();
  }
  if (typeof i?.publicDirective === 'string' && i.publicDirective.trim().length > 0) {
    result.publicDirective = i.publicDirective.trim();
  }

  return result;
}

/**
 * Explicit allowlist constructor for Public Timeline Event DTO.
 * Allowed keys: id, type, title, date, description, progressPercent, rawDate.
 */
export function buildExplicitPublicTimelineEvent(t: any): PublicTimelineEventDTO {
  const result: PublicTimelineEventDTO = {
    id: String(t?.id || ''),
    type: t?.type || 'STATUS_CHANGE',
    title: String(t?.title || ''),
    date: String(t?.date || ''),
    description: String(t?.description || ''),
  };

  if (typeof t?.progressPercent === 'number') {
    result.progressPercent = t.progressPercent;
  }
  if (typeof t?.rawDate === 'string' && t.rawDate.trim().length > 0) {
    result.rawDate = t.rawDate.trim();
  }

  return result;
}

/**
 * Explicit allowlist constructor for Location map.
 * Allowed keys: state, district, constituency, address, lat, lng.
 * Issue 4: Never substitute fabricated defaults like Uttar Pradesh or Varanasi.
 */
export function buildExplicitLocation(loc: any): PublicProjectDTO['location'] {
  const result: PublicProjectDTO['location'] = {};
  if (loc && typeof loc === 'object') {
    if (typeof loc.state === 'string' && loc.state.trim().length > 0) {
      result.state = loc.state.trim();
    }
    if (typeof loc.district === 'string' && loc.district.trim().length > 0) {
      result.district = loc.district.trim();
    }
    if (typeof loc.constituency === 'string' && loc.constituency.trim().length > 0) {
      result.constituency = loc.constituency.trim();
    }
    if (typeof loc.address === 'string' && loc.address.trim().length > 0) {
      result.address = loc.address.trim();
    }
    if (typeof loc.lat === 'number' && !isNaN(loc.lat)) {
      result.lat = loc.lat;
    }
    if (typeof loc.lng === 'number' && !isNaN(loc.lng)) {
      result.lng = loc.lng;
    }
  }
  return result;
}

/**
 * Explicit allowlist constructor for Accountability Indicators DTO.
 * Allowed keys: lastUpdated, lastInspectionDate, milestonesCompletedCount, milestonesTotalCount,
 * financialUtilizationPercent, physicalProgressPercent, statusLabel.
 */
export function buildExplicitAccountabilityIndicators(acc: any): PublicAccountabilityDTO {
  const result: PublicAccountabilityDTO = {
    lastUpdated: typeof acc?.lastUpdated === 'string' && acc.lastUpdated.trim().length > 0 ? acc.lastUpdated.trim() : 'Not recorded in the available public record',
    lastInspectionDate: typeof acc?.lastInspectionDate === 'string' && acc.lastInspectionDate.trim().length > 0 ? acc.lastInspectionDate.trim() : 'None recorded',
    milestonesCompletedCount: typeof acc?.milestonesCompletedCount === 'number' ? Math.max(0, acc.milestonesCompletedCount) : 0,
    milestonesTotalCount: typeof acc?.milestonesTotalCount === 'number' ? Math.max(0, acc.milestonesTotalCount) : 0,
    statusLabel: typeof acc?.statusLabel === 'string' && acc.statusLabel.trim().length > 0 ? acc.statusLabel.trim() : 'Status not recorded',
  };

  if (typeof acc?.financialUtilizationPercent === 'number' && !isNaN(acc.financialUtilizationPercent)) {
    result.financialUtilizationPercent = Math.max(0, Math.min(100, acc.financialUtilizationPercent));
  }
  if (typeof acc?.physicalProgressPercent === 'number' && !isNaN(acc.physicalProgressPercent)) {
    result.physicalProgressPercent = Math.max(0, Math.min(100, acc.physicalProgressPercent));
  }

  return result;
}

/**
 * Explicit allowlist constructor for Data Provenance DTO.
 * Allowed keys: sourceCategories, explanation, disclaimer.
 * Only includes source categories for data that actually exists in the project records.
 */
export function buildExplicitDataProvenance(params?: {
  project?: Project;
  milestones?: ProjectMilestone[];
  financials?: ProjectFinancialRecord[];
  updates?: ProjectProgressUpdate[];
  inspections?: ProjectInspection[];
  prov?: any;
}): PublicDataProvenanceDTO {
  const { project, milestones, financials, updates, inspections, prov } = params || {};

  const sourceCategories: string[] = [];
  if (project && (project.title || project.projectCode || project.sanctionedAmount || project.sanctionedBudget || project.id)) {
    sourceCategories.push('Project Master Record');
  }
  if ((milestones && milestones.length > 0) || (project?.milestonesSummary && project.milestonesSummary.length > 0)) {
    sourceCategories.push('Project Milestone Records');
  }
  if (financials && financials.some((f) => f.verificationStatus === 'VERIFIED')) {
    sourceCategories.push('Verified Financial Records');
  }
  if (updates && updates.length > 0) {
    sourceCategories.push('Project Progress Update Records');
  }
  if (inspections && inspections.length > 0) {
    sourceCategories.push('Project Inspection Records');
  }

  // If prov was explicitly supplied with custom allowlisted sourceCategories
  if (sourceCategories.length === 0 && Array.isArray(prov?.sourceCategories) && prov.sourceCategories.length > 0) {
    const custom = prov.sourceCategories
      .filter((s: any) => typeof s === 'string' && s.trim().length > 0)
      .map((s: string) => s.trim());
    if (custom.length > 0) {
      sourceCategories.push(...custom);
    }
  }

  if (sourceCategories.length === 0) {
    sourceCategories.push('Source records not specified in the available public projection.');
  }

  return {
    sourceCategories,
    explanation: typeof prov?.explanation === 'string' && prov.explanation.trim().length > 0
      ? prov.explanation.trim()
      : 'Public project transparency records are derived from official monitoring documents maintained within the Bharat Tender Intelligence (BTI) MPLAD portal.',
    disclaimer: typeof prov?.disclaimer === 'string' && prov.disclaimer.trim().length > 0
      ? prov.disclaimer.trim()
      : 'Information displayed here represents records available through the BTI transparency layer. Demonstration environments contain synthetic data and should not be interpreted as live government records.',
  };
}

/**
 * Builds an authoritative PublicProjectDTO from raw authoritative records.
 * Uses 100% explicit field-by-field allowlisting.
 * Replaces factual defaults (category, sector, etc.) with explicit missing-data presentations.
 */
export function buildAuthoritativePublicProjectProjection(params: {
  project: Project;
  milestones?: ProjectMilestone[];
  financials?: ProjectFinancialRecord[];
  updates?: ProjectProgressUpdate[];
  inspections?: ProjectInspection[];
  isDemonstration?: boolean;
}): PublicProjectDTO {
  const {
    project,
    milestones = [],
    financials = [],
    updates = [],
    inspections = [],
    isDemonstration = false,
  } = params;

  // Status canonicalization: Do NOT invent IN_PROGRESS or NOT_STARTED if status is missing
  const rawStatus = project.status ? String(project.status).toUpperCase() : undefined;
  const validStatuses: CanonicalProjectStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CLOSED'];
  const canonicalStatus: CanonicalProjectStatus | undefined =
    rawStatus && validStatuses.includes(rawStatus as CanonicalProjectStatus)
      ? (rawStatus as CanonicalProjectStatus)
      : undefined;

  const statusLabels: Record<CanonicalProjectStatus, string> = {
    NOT_STARTED: 'Not Started',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    ON_HOLD: 'On Hold',
    CLOSED: 'Closed',
  };
  const statusLabel = canonicalStatus
    ? statusLabels[canonicalStatus]
    : 'Status not recorded';

  // Authoritative Financial Calculations: Do NOT convert missing sanctioned amount to 0
  const rawSanctionedAmount = (project as any).sanctionedAmount ?? (project as any).sanctionedBudget;
  const numSanctioned =
    rawSanctionedAmount === null ||
    rawSanctionedAmount === undefined ||
    rawSanctionedAmount === ''
      ? undefined
      : Number(rawSanctionedAmount);
  const sanctionedAmount = typeof numSanctioned === 'number' && Number.isFinite(numSanctioned)
    ? numSanctioned
    : undefined;
  const awardedAmount = project.awardedAmount !== undefined ? Number(project.awardedAmount) : undefined;

  // Verified Public Fund Disbursals
  // Must ONLY be calculated from authoritative financial records with verificationStatus === 'VERIFIED'.
  const verifiedRecords = financials.filter((f) => f.verificationStatus === 'VERIFIED');
  const hasVerifiedExpenditureRecords = verifiedRecords.length > 0;
  const verifiedExpenditure = hasVerifiedExpenditureRecords
    ? verifiedRecords.reduce((sum, f) => sum + Number(f.amount || 0), 0)
    : 0;

  // Overrun / balance calculations: ONLY when verified expenditure records actually exist
  const remainingAwardedBalance = awardedAmount !== undefined && hasVerifiedExpenditureRecords
    ? (awardedAmount - verifiedExpenditure)
    : undefined;

  const isOverExpenditure = hasVerifiedExpenditureRecords && awardedAmount !== undefined && verifiedExpenditure > awardedAmount;
  const overExpenditureAmount = isOverExpenditure && awardedAmount !== undefined ? (verifiedExpenditure - awardedAmount) : 0;
  const isFinancialIncomplete = sanctionedAmount === undefined || sanctionedAmount <= 0;

  // Physical Progress: preserve genuine 0, do not convert undefined/null to 0
  const rawProgress =
    project.governmentVerifiedPhysicalProgressPercent ??
    project.physicalProgressPercent ??
    project.physicalProgress;
  const physicalProgressPercent = typeof rawProgress === 'number' && !isNaN(rawProgress)
    ? Math.max(0, Math.min(100, rawProgress))
    : undefined;

  // Nested Milestones Summary (Explicit allowlist)
  const sourceMilestones = milestones.length > 0 ? milestones : project.milestonesSummary || [];
  const milestonesSummary: PublicMilestoneSummaryDTO[] = sourceMilestones.map((m, idx) =>
    buildExplicitPublicMilestoneSummary(m, idx)
  );

  // Detailed Public Milestones (Explicit allowlist)
  const publicMilestones: PublicMilestoneDTO[] = milestones.map((m, idx) =>
    buildExplicitPublicMilestone(m, idx)
  );

  // Public Progress Updates (Explicit allowlist)
  const publicUpdates: PublicProgressUpdateDTO[] = updates.map((u) =>
    buildExplicitPublicProgressUpdate(u)
  );

  // Public Inspections (Explicit allowlist)
  const publicInspections: PublicInspectionDTO[] = inspections.map((i) =>
    buildExplicitPublicInspection(i)
  );

  // Timeline (Chronological actual recorded events only)
  const publicTimeline: PublicTimelineEventDTO[] = [];

  // 1. Authoritative Sanction event: ONLY when actual sanction date exists
  const sanctionDate = (project as any).sanctionDate || (project as any).sanctionedDate || (project as any).administrativeApprovalDate;
  if (sanctionDate) {
    publicTimeline.push({
      id: `${project.id}-sanction`,
      type: 'SANCTION',
      title: 'Project Sanctioned',
      date: new Date(sanctionDate).toLocaleDateString('en-IN'),
      rawDate: sanctionDate,
      description: sanctionedAmount !== undefined
        ? `Administrative sanction and financial outlay of ₹ ${(sanctionedAmount / 10000000).toFixed(2)} Cr approved.`
        : 'Administrative sanction approved.',
    });
  }

  // 2. Contract Awarded event: ONLY when actual contract award date exists
  // Do NOT misidentify implementingAgencyName as contractor/awardee
  const awardDate = (project as any).awardDate || (project as any).awardedDate || (project as any).contractAwardDate || (project as any).contractDate;
  if (awardDate) {
    const authoritativeAwardee =
      typeof (project as any).awardedContractorName === 'string' && (project as any).awardedContractorName.trim().length > 0
        ? (project as any).awardedContractorName.trim()
        : typeof (project as any).contractorName === 'string' && (project as any).contractorName.trim().length > 0
          ? (project as any).contractorName.trim()
          : typeof (project as any).awardeeName === 'string' && (project as any).awardeeName.trim().length > 0
            ? (project as any).awardeeName.trim()
            : undefined;

    let awardDesc = 'Contract award recorded';
    if (authoritativeAwardee) {
      awardDesc += ` to ${authoritativeAwardee}`;
    }
    if (awardedAmount !== undefined) {
      awardDesc += ` for ₹ ${(awardedAmount / 10000000).toFixed(2)} Cr.`;
    } else {
      awardDesc += '.';
    }

    publicTimeline.push({
      id: `${project.id}-award`,
      type: 'AWARD',
      title: 'Contract Awarded',
      date: new Date(awardDate).toLocaleDateString('en-IN'),
      rawDate: awardDate,
      description: awardDesc,
    });
  }

  // 3. Implementation Started: ONLY when actual start date exists
  const actualStartDate = project.implementationStartDate || (project.status && project.status !== 'NOT_STARTED' && project.startDate ? project.startDate : undefined);
  if (actualStartDate) {
    publicTimeline.push({
      id: `${project.id}-start`,
      type: 'START',
      title: 'Implementation Started',
      date: new Date(actualStartDate).toLocaleDateString('en-IN'),
      rawDate: actualStartDate,
      description: typeof (project as any).implementationStartRemarks === 'string' && (project as any).implementationStartRemarks.trim().length > 0
        ? (project as any).implementationStartRemarks.trim()
        : 'Project implementation start recorded.',
    });
  }

  // 4. Milestone events
  milestones.forEach((m) => {
    if (m.actualEndDate) {
      publicTimeline.push({
        id: `${project.id}-ms-comp-${m.sequence}`,
        type: 'MILESTONE',
        title: `Milestone ${m.sequence} Completed: ${m.title}`,
        date: new Date(m.actualEndDate).toLocaleDateString('en-IN'),
        rawDate: m.actualEndDate,
        description: `Milestone completed${m.weightPercent !== undefined ? ` (${m.weightPercent}% weight)` : ''}.${m.progressPercent !== undefined ? ` Recorded progress: ${m.progressPercent}%.` : ''}`,
        progressPercent: m.progressPercent,
      });
    } else if (m.actualStartDate) {
      publicTimeline.push({
        id: `${project.id}-ms-start-${m.sequence}`,
        type: 'MILESTONE',
        title: `Milestone ${m.sequence} Commenced: ${m.title}`,
        date: new Date(m.actualStartDate).toLocaleDateString('en-IN'),
        rawDate: m.actualStartDate,
        description: `Milestone work commenced${m.weightPercent !== undefined ? ` (${m.weightPercent}% weight)` : ''}.`,
        progressPercent: m.progressPercent,
      });
    }
  });

  // 5. Progress updates
  updates.forEach((u, idx) => {
    const uDate = u.updateDate || u.createdAt;
    if (uDate) {
      publicTimeline.push({
        id: `${project.id}-upd-${idx + 1}`,
        type: 'UPDATE',
        title: `Field Progress Filing #${idx + 1}`,
        date: new Date(uDate).toLocaleDateString('en-IN'),
        rawDate: uDate,
        description: u.workCompletedDescription?.trim() || (u as any).summary?.trim() || 'Field progress filing recorded.',
        progressPercent: u.physicalProgressPercent ?? (u as any).progressPercentage,
      });
    }
  });

  // 6. Inspection events
  inspections.forEach((ins, idx) => {
    if (ins.inspectionDate) {
      const observedProg = ins.physicalProgressObserved ?? ins.governmentVerifiedPhysicalProgressPercent ?? (ins as any).observedProgress;
      publicTimeline.push({
        id: `${project.id}-insp-${idx + 1}`,
        type: 'INSPECTION',
        title: `Statutory Field Inspection #${idx + 1}`,
        date: new Date(ins.inspectionDate).toLocaleDateString('en-IN'),
        rawDate: ins.inspectionDate,
        description: ins.publicObservation?.trim() || (ins as any).qualityObservation?.trim() || 'Statutory field inspection recorded on site.',
        progressPercent: observedProg,
      });
    }
  });

  // 7. Completion event
  if (project.status === 'COMPLETED' && project.actualCompletionDate) {
    publicTimeline.push({
      id: `${project.id}-completed`,
      type: 'STATUS_CHANGE',
      title: 'Project Completed',
      date: new Date(project.actualCompletionDate).toLocaleDateString('en-IN'),
      rawDate: project.actualCompletionDate,
      description: typeof (project as any).completionRemarks === 'string' && (project as any).completionRemarks.trim().length > 0
        ? (project as any).completionRemarks.trim()
        : 'Project completion recorded in official records.',
      progressPercent: 100,
    });
  }

  // Sort timeline chronologically (latest first for display)
  publicTimeline.sort((a, b) => {
    const dateA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
    const dateB = b.rawDate ? new Date(b.rawDate).getTime() : 0;
    return dateB - dateA;
  });

  // Accountability Indicators
  const milestonesCompletedCount = milestones.filter(
    (m) => m.status === 'COMPLETED' || m.progressPercent === 100
  ).length;

  const latestInspection = inspections.length > 0
    ? [...inspections].sort((a, b) => new Date(b.inspectionDate).getTime() - new Date(a.inspectionDate).getTime())[0]
    : undefined;

  const lastInspectionDate = latestInspection?.inspectionDate
    ? new Date(latestInspection.inspectionDate).toLocaleDateString('en-IN')
    : 'None recorded';

  const rawLastUpdated = project.updatedAt || project.lastUpdated || project.createdAt;
  const lastUpdatedDisplay = rawLastUpdated && !isNaN(new Date(rawLastUpdated).getTime())
    ? new Date(rawLastUpdated).toLocaleDateString('en-IN')
    : 'Not recorded in the available public record';

  const accountabilityIndicators: PublicAccountabilityDTO = {
    lastUpdated: lastUpdatedDisplay,
    lastInspectionDate,
    milestonesCompletedCount,
    milestonesTotalCount: milestonesSummary.length,
    financialUtilizationPercent:
      sanctionedAmount !== undefined && sanctionedAmount > 0 && hasVerifiedExpenditureRecords
        ? Math.round((verifiedExpenditure / sanctionedAmount) * 100)
        : (hasVerifiedExpenditureRecords ? 0 : undefined),
    physicalProgressPercent,
    statusLabel,
  };

  const dataProvenance = buildExplicitDataProvenance({
    project,
    milestones,
    financials,
    updates,
    inspections,
  });

  // Issue 4: Category and Sector must not use fake defaults ("Civil Works", "Infrastructure")
  const category = project.category?.trim() || 'Not recorded in the available public record';
  const sector = project.sector?.trim() || undefined;

  // Construct Explicit Allowlisted PublicProjectDTO
  const result: PublicProjectDTO = {
    projectId: project.id,
    projectName: project.title || (project as any).projectName || 'Project Title Not Recorded',
    category,
    location: buildExplicitLocation({
      state: project.state,
      district: project.district,
      constituency: project.constituency,
      address: project.locationCoordinates?.address,
      lat: project.lat ?? project.locationCoordinates?.lat,
      lng: project.lng ?? project.locationCoordinates?.lng,
    }),
    statusLabel,
    verifiedExpenditure,
    hasVerifiedExpenditureRecords,
    physicalProgressPercent,
    milestonesSummary,
    milestones: publicMilestones,
    publicUpdates,
    publicInspections,
    publicTimeline,
    accountabilityIndicators,
    dataProvenance,
    isDemonstrationData: Boolean(isDemonstration),
    isPubliclyVisible: true,
    publicDisclosureStatus: 'PUBLIC',
  };

  if (canonicalStatus !== undefined) {
    result.status = canonicalStatus;
  }
  if (sanctionedAmount !== undefined) {
    result.sanctionedAmount = sanctionedAmount;
  }

  if (project.projectNumber || project.projectCode) {
    result.projectNumber = (project.projectNumber || project.projectCode)?.trim();
  }
  if (project.description && project.description.trim().length > 0) {
    result.description = project.description.trim();
  }
  if (sector) {
    result.sector = sector;
  }
  const agencyName = (project.implementingAgencyName || project.executingAgencyName || project.agencyName)?.trim();
  if (agencyName) {
    result.implementingAgencyName = agencyName;
  }
  if (project.authorityName && project.authorityName.trim().length > 0) {
    result.authorityName = project.authorityName.trim();
  }
  if (project.mpName && project.mpName.trim().length > 0) {
    result.mpName = project.mpName.trim();
  }
  if (awardedAmount !== undefined) {
    result.awardedAmount = awardedAmount;
  }
  if (remainingAwardedBalance !== undefined) {
    result.remainingAwardedBalance = remainingAwardedBalance;
  }
  if (isOverExpenditure !== undefined) {
    result.isOverExpenditure = isOverExpenditure;
  }
  if (overExpenditureAmount > 0) {
    result.overExpenditureAmount = overExpenditureAmount;
  }
  if (isFinancialIncomplete !== undefined) {
    result.isFinancialIncomplete = isFinancialIncomplete;
  }
  if (project.updatedAt || project.lastUpdated) {
    result.lastUpdated = project.updatedAt || project.lastUpdated;
  }
  if (project.startDate) {
    result.startDate = project.startDate;
  }
  if (project.plannedCompletionDate) {
    result.plannedCompletionDate = project.plannedCompletionDate;
  }
  if (project.actualCompletionDate) {
    result.actualCompletionDate = project.actualCompletionDate;
  }

  return result;
}
