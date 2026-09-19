// Bharat Tender Intelligence (BTI) — Public Transparency Service
// Phase 9: Public Transparency & Citizen Social Audit Layer
// Strictly allowlisted public data projection engine. Prohibits internal risk/anomaly exposure.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { isLiveFirestoreSession, isDemoSession, sanitizeFirestorePayload } from '../firebase/projects';
import {
  Project,
  ProjectMilestone,
  ProjectFinancialRecord,
  ProjectProgressUpdate,
  ProjectInspection,
  toCanonicalProjectStatus,
  CanonicalProjectStatus,
  isProjectPubliclyDisclosed,
} from '../../types/project';
import {
  PublicProjectDTO,
  PublicMilestoneSummaryDTO,
  PublicMilestoneDTO,
  PublicProgressUpdateDTO,
  PublicInspectionDTO,
  PublicTimelineEventDTO,
  PublicAccountabilityDTO,
  PublicDataProvenanceDTO,
  PublicTransparencyFilterParams,
} from '../../types/publicTransparency';
import {
  DEMONSTRATION_PROJECTS,
  DEMONSTRATION_MILESTONES,
  DEMONSTRATION_PROGRESS_UPDATES,
  DEMONSTRATION_FINANCIAL_RECORDS,
  DEMONSTRATION_INSPECTIONS,
} from '../../data/demonstrationProjects';

const PUBLIC_PROJECTS_COLLECTION = 'publicProjects';

export class PublicTransparencyService {
  /**
   * Pure deterministic public projection transformer.
   * STRICT ALLOWLIST: Extracts only fields explicitly approved for public transparency.
   * Internal risk scores, anomaly findings, investigation notes, and private contact info are never copied.
   */
  static buildPublicProjectProjection(params: {
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

    const canonicalStatus: CanonicalProjectStatus = toCanonicalProjectStatus(project.status);
    const statusLabels: Record<CanonicalProjectStatus, string> = {
      NOT_STARTED: 'Not Started',
      IN_PROGRESS: 'In Progress',
      ON_HOLD: 'On Hold',
      COMPLETED: 'Completed',
      CLOSED: 'Closed',
    };
    const statusLabel = statusLabels[canonicalStatus] || 'In Progress';

    // Authoritative Financial Calculations using allowlisted fields
    const sanctionedAmount = Number(project.sanctionedAmount || project.sanctionedBudget || 0);
    const awardedAmount = project.awardedAmount !== undefined ? Number(project.awardedAmount) : undefined;

    // Verified Public Fund Disbursals / Verified Expenditure
    // Must ONLY be calculated from authoritative financial records with verificationStatus === 'VERIFIED'.
    // If no verified financial records exist, do NOT substitute unverified project amount fields.
    const verifiedRecords = financials.filter(
      (f) => f.verificationStatus === 'VERIFIED'
    );
    const hasVerifiedExpenditureRecords = verifiedRecords.length > 0;
    const verifiedExpenditure = hasVerifiedExpenditureRecords
      ? verifiedRecords.reduce((sum, f) => sum + Number(f.amount || 0), 0)
      : 0;

    const remainingAwardedBalance = awardedAmount !== undefined
      ? Math.max(0, awardedAmount - verifiedExpenditure)
      : undefined;

    const isFinancialIncomplete = sanctionedAmount <= 0;

    // Physical Progress
    const physicalProgressPercent =
      project.governmentVerifiedPhysicalProgressPercent ??
      project.physicalProgressPercent ??
      project.physicalProgress ??
      0;

    // Sanitized Milestones Summary (Strict Allowlist)
    const milestonesSummary: PublicMilestoneSummaryDTO[] = (milestones.length > 0
      ? milestones
      : project.milestonesSummary || []
    ).map((m, idx) => ({
      sequence: m.sequence ?? idx + 1,
      title: m.title || `Milestone ${idx + 1}`,
      progressPercent: Number(m.progressPercent ?? 0),
      status: m.status || 'IN_PROGRESS',
      weightPercent: Number(m.weightPercent ?? 0),
    }));

    // Detailed Public Milestones (Strict Allowlist)
    const publicMilestones: PublicMilestoneDTO[] = milestones.map((m, idx) => ({
      sequence: m.sequence ?? idx + 1,
      title: m.title || `Milestone ${idx + 1}`,
      description: m.description,
      plannedEndDate: m.plannedEndDate,
      actualEndDate: m.actualEndDate,
      weightPercent: Number(m.weightPercent ?? 0),
      progressPercent: Number(m.progressPercent ?? 0),
      status: m.status || 'NOT_STARTED',
    }));

    // Sanitized Public Progress Updates (Strict Allowlist — internal reviewer notes omitted)
    const publicUpdates: PublicProgressUpdateDTO[] = updates.map((u) => ({
      date: u.updateDate || u.createdAt || 'Date not available in the current record.',
      progressPercentage: Number(u.physicalProgressPercent ?? 0),
      summary: u.workCompletedDescription || 'Routine progress report recorded by implementing agency.',
      implementationStatus: 'NORMAL',
    }));

    // Sanitized Public Inspections (Strict Allowlist — only explicitly public-safe factual fields; no raw internal narrative, officer identities, or corrective action text)
    const publicInspections: PublicInspectionDTO[] = inspections.map((i) => {
      const typeLabel = i.inspectionType
        ? `${i.inspectionType.charAt(0).toUpperCase() + i.inspectionType.slice(1).toLowerCase()} site inspection`
        : 'Statutory field inspection';

      return {
        inspectionDate: i.inspectionDate || 'Date not available in the current record.',
        observedProgress: Number(
          i.physicalProgressObserved ??
          i.governmentVerifiedPhysicalProgressPercent ??
          0
        ),
        qualityObservation: `${typeLabel} completed.`,
        inspectionType: i.inspectionType || 'ROUTINE',
      };
    });

    // Implementation Timeline (Chronological actual recorded events only)
    const publicTimeline: PublicTimelineEventDTO[] = [];

    // 1. Initial Project Record Creation (Authoritative system creation record)
    if (project.createdAt) {
      publicTimeline.push({
        id: `${project.id}-created`,
        type: 'STATUS_CHANGE',
        title: 'Project Record Created',
        date: new Date(project.createdAt).toLocaleDateString('en-IN'),
        rawDate: project.createdAt,
        description: `Project record established in monitoring portal with sanctioned outlay of ₹ ${(sanctionedAmount / 10000000).toFixed(2)} Cr.`,
      });
    }

    // 2. Implementation Started: only when an actual start date was authoritatively recorded
    const actualStartDate = project.implementationStartDate || (project.status !== 'NOT_STARTED' && project.startDate ? project.startDate : undefined);
    if (actualStartDate) {
      publicTimeline.push({
        id: `${project.id}-start`,
        type: 'START',
        title: 'Implementation Started',
        date: new Date(actualStartDate).toLocaleDateString('en-IN'),
        rawDate: actualStartDate,
        description: 'Ground mobilization and execution commenced by designated contractor.',
      });
    }

    // 3. Milestone actual events:
    // Strictly actual completion or commencement dates from authoritative milestone records
    milestones.forEach((m) => {
      if (m.actualEndDate) {
        publicTimeline.push({
          id: `${project.id}-ms-comp-${m.sequence}`,
          type: 'MILESTONE',
          title: `Milestone ${m.sequence} Completed: ${m.title}`,
          date: new Date(m.actualEndDate).toLocaleDateString('en-IN'),
          rawDate: m.actualEndDate,
          description: `Milestone completed (${m.weightPercent}% weight). Recorded progress: ${m.progressPercent}%.`,
          progressPercent: m.progressPercent,
        });
      } else if (m.actualStartDate && m.status === 'IN_PROGRESS') {
        publicTimeline.push({
          id: `${project.id}-ms-start-${m.sequence}`,
          type: 'MILESTONE',
          title: `Milestone ${m.sequence} Commenced: ${m.title}`,
          date: new Date(m.actualStartDate).toLocaleDateString('en-IN'),
          rawDate: m.actualStartDate,
          description: `Work commenced on milestone (${m.weightPercent}% weight). Recorded progress: ${m.progressPercent}%.`,
          progressPercent: m.progressPercent,
        });
      }
    });

    // 4. Progress update reports (actual filed reports)
    updates.forEach((u, idx) => {
      const uDate = u.updateDate || u.createdAt;
      if (uDate) {
        publicTimeline.push({
          id: `${project.id}-update-${idx}`,
          type: 'UPDATE',
          title: 'Field Progress Report',
          date: new Date(uDate).toLocaleDateString('en-IN'),
          rawDate: uDate,
          description: `Implementing agency reported ${u.physicalProgressPercent ?? 0}% physical progress.${u.workCompletedDescription ? ` ${u.workCompletedDescription}` : ''}`,
          progressPercent: Number(u.physicalProgressPercent ?? 0),
        });
      }
    });

    // 5. Inspection events (actual statutory inspections)
    inspections.forEach((ins, idx) => {
      if (ins.inspectionDate) {
        const observedProg = ins.physicalProgressObserved ?? ins.governmentVerifiedPhysicalProgressPercent ?? 0;
        publicTimeline.push({
          id: `${project.id}-insp-${idx}`,
          type: 'INSPECTION',
          title: 'Statutory Government Inspection',
          date: new Date(ins.inspectionDate).toLocaleDateString('en-IN'),
          rawDate: ins.inspectionDate,
          description: `Official site review observed physical progress of ${observedProg}%.`,
          progressPercent: observedProg,
        });
      }
    });

    // 6. Project Completion event: only when actual completion date is recorded
    if (project.status === 'COMPLETED' && project.actualCompletionDate) {
      publicTimeline.push({
        id: `${project.id}-completed`,
        type: 'STATUS_CHANGE',
        title: 'Project Completed',
        date: new Date(project.actualCompletionDate).toLocaleDateString('en-IN'),
        rawDate: project.actualCompletionDate,
        description: `Project officially recorded as completed with 100% verified physical progress.`,
        progressPercent: 100,
      });
    }

    // Sort timeline chronologically by rawDate
    publicTimeline.sort((a, b) => {
      const timeA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
      const timeB = b.rawDate ? new Date(b.rawDate).getTime() : 0;
      return timeA - timeB;
    });

    // Public Accountability Indicators (No internal risk or anomaly data)
    const milestonesCompletedCount = milestonesSummary.filter((m) => m.status === 'COMPLETED').length;
    const latestInspection = inspections[inspections.length - 1];
    const lastInspectionDate = latestInspection?.inspectionDate
      ? new Date(latestInspection.inspectionDate).toLocaleDateString('en-IN')
      : 'None recorded';

    const lastUpdated = project.updatedAt || project.lastUpdated || project.createdAt || 'Recent';

    const accountabilityIndicators: PublicAccountabilityDTO = {
      lastUpdated: new Date(lastUpdated).toLocaleDateString('en-IN'),
      lastInspectionDate,
      milestonesCompletedCount,
      milestonesTotalCount: milestonesSummary.length,
      financialUtilizationPercent:
        sanctionedAmount > 0 && hasVerifiedExpenditureRecords
          ? Math.round((verifiedExpenditure / sanctionedAmount) * 100)
          : 0,
      physicalProgressPercent,
      statusLabel,
    };

    // Transparent Data Provenance
    const dataProvenance: PublicDataProvenanceDTO = {
      sourceCategories: [
        'Project Master Record (Sanction Order & Agency Allocation)',
        'Verified Milestone Progress (Physical Completion Baselines)',
        'Government Disbursal Verification (Statutory Public Accounts)',
        'Field Progress Reports (Implementing Agency Filings)',
        'Statutory Field Inspection (Government Engineer Verification)',
      ],
      explanation:
        'Public project transparency records are derived from official monitoring documents maintained within the Bharat Tender Intelligence (BTI) MPLAD portal.',
      disclaimer:
        'Information displayed here represents records available through the BTI transparency layer. Demonstration environments contain synthetic data and should not be interpreted as live government records.',
    };

    return {
      projectId: project.id,
      projectNumber: project.projectNumber || project.projectCode,
      projectName: project.title,
      description: project.description,
      category: typeof project.category === 'string' ? project.category : 'Civil Works',
      sector: project.sector || 'Infrastructure',
      location: {
        state: project.state || 'Uttar Pradesh',
        district: project.district || 'Varanasi',
        constituency: project.constituency || 'Varanasi (PC-77)',
        address: project.locationCoordinates?.address,
        lat: project.lat ?? project.locationCoordinates?.lat,
        lng: project.lng ?? project.locationCoordinates?.lng,
      },
      status: canonicalStatus,
      statusLabel,
      implementingAgencyName: project.implementingAgencyName || project.executingAgencyName || project.agencyName,
      authorityName: project.authorityName,
      mpName: project.mpName,
      sanctionedAmount,
      awardedAmount,
      verifiedExpenditure,
      hasVerifiedExpenditureRecords,
      remainingAwardedBalance,
      isFinancialIncomplete,
      physicalProgressPercent,
      milestonesSummary,
      milestones: publicMilestones,
      publicUpdates,
      publicInspections,
      publicTimeline,
      accountabilityIndicators,
      dataProvenance,
      isDemonstrationData: isDemonstration,
      isPubliclyVisible: isProjectPubliclyDisclosed(project),
      publicDisclosureStatus: 'PUBLIC',
      lastUpdated,
      startDate: project.startDate || project.implementationStartDate,
      plannedCompletionDate: project.plannedCompletionDate || project.targetCompletionDate,
      actualCompletionDate: project.actualCompletionDate,
    };
  }

  /**
   * Retrieves paginated public project records.
   * Public clients query only explicitly public-safe records.
   */
  static async getPublicProjects(
    params: PublicTransparencyFilterParams = {}
  ): Promise<{ projects: PublicProjectDTO[]; total: number; hasMore: boolean }> {
    const {
      search = '',
      status = '',
      district = '',
      state = '',
      category = '',
      sortBy = 'lastUpdated',
      sortOrder = 'desc',
      page = 1,
      pageSize = 12,
    } = params;

    let allProjections: PublicProjectDTO[] = [];

    if (isLiveFirestoreSession() && db) {
      try {
        const publicCol = collection(db, PUBLIC_PROJECTS_COLLECTION);
        const q = query(publicCol, limit(100));
        const snap = await getDocs(q);

        snap.forEach((d) => {
          const item = d.data() as PublicProjectDTO;
          if (item && isProjectPubliclyDisclosed(item)) {
            allProjections.push(item);
          }
        });
      } catch (err) {
        console.warn('[PublicTransparencyService] Error querying publicProjects:', err);
      }
    } else {
      // Demonstration / Local session: Project all explicitly public projects
      const { ProjectService } = await import('../firebase/projects');
      const allProjects = await ProjectService.getProjects();
      const publicProjects = allProjects.filter((dp) => isProjectPubliclyDisclosed(dp));

      allProjections = await Promise.all(
        publicProjects.map(async (dp) => {
          const [m, f, u, i] = await Promise.all([
            ProjectService.getMilestones(dp.id),
            ProjectService.getFinancialRecords(dp.id),
            ProjectService.getProgressUpdates(dp.id),
            ProjectService.getInspections(dp.id),
          ]);
          return this.buildPublicProjectProjection({
            project: dp,
            milestones: m,
            financials: f,
            updates: u,
            inspections: i,
            isDemonstration: dp.id.includes('demo') || (dp.projectCode && dp.projectCode.includes('2026/000')),
          });
        })
      );
    }

    // Apply Public Search & Filters
    let filtered = allProjections.filter((p) => {
      if (search.trim()) {
        const queryNorm = search.trim().toLowerCase();
        const matchesName = p.projectName.toLowerCase().includes(queryNorm);
        const matchesId = (p.projectId.toLowerCase().includes(queryNorm)) ||
          (p.projectNumber ? p.projectNumber.toLowerCase().includes(queryNorm) : false);
        const matchesDistrict = (p.location.district || '').toLowerCase().includes(queryNorm);
        const matchesState = (p.location.state || '').toLowerCase().includes(queryNorm);
        const matchesCategory = (p.category || '').toLowerCase().includes(queryNorm);
        const matchesAgency = (p.implementingAgencyName || '').toLowerCase().includes(queryNorm);

        if (!matchesName && !matchesId && !matchesDistrict && !matchesState && !matchesCategory && !matchesAgency) {
          return false;
        }
      }

      if (status && status !== 'ALL') {
        if (p.status !== status && p.statusLabel.toUpperCase() !== status.toUpperCase()) {
          return false;
        }
      }

      if (district && district !== 'ALL') {
        if ((p.location.district || '').toLowerCase() !== district.toLowerCase()) {
          return false;
        }
      }

      if (state && state !== 'ALL') {
        if ((p.location.state || '').toLowerCase() !== state.toLowerCase()) {
          return false;
        }
      }

      if (category && category !== 'ALL') {
        if ((p.category || '').toLowerCase() !== category.toLowerCase()) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      let valA: any = a.lastUpdated || '';
      let valB: any = b.lastUpdated || '';

      if (sortBy === 'sanctionedAmount') {
        valA = a.sanctionedAmount;
        valB = b.sanctionedAmount;
      } else if (sortBy === 'physicalProgress') {
        valA = a.physicalProgressPercent;
        valB = b.physicalProgressPercent;
      } else if (sortBy === 'title') {
        valA = a.projectName.toLowerCase();
        valB = b.projectName.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return valA > valB ? 1 : -1;
      }
      return valA < valB ? 1 : -1;
    });

    const total = filtered.length;
    const startIndex = (page - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < total;

    return {
      projects: paginated,
      total,
      hasMore,
    };
  }

  /**
   * Retrieves a single public project record by ID.
   * PROTECTION AGAINST ENUMERATION: If project does not exist or is not public,
   * returns null so the client gets the exact same generic unavailable response.
   */
  static async getPublicProjectById(projectId: string): Promise<PublicProjectDTO | null> {
    if (!projectId) return null;

    if (isLiveFirestoreSession() && db) {
      try {
        const docRef = doc(db, PUBLIC_PROJECTS_COLLECTION, projectId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data() as PublicProjectDTO;
          if (data && isProjectPubliclyDisclosed(data)) {
            return data;
          }
        }
        return null;
      } catch (err) {
        console.warn('[PublicTransparencyService] Error fetching public project:', err);
        return null;
      }
    }

    // Demonstration / Local session
    const { ProjectService } = await import('../firebase/projects');
    const project = await ProjectService.getProjectById(projectId);

    if (project && isProjectPubliclyDisclosed(project)) {
      const [m, f, u, i] = await Promise.all([
        ProjectService.getMilestones(project.id),
        ProjectService.getFinancialRecords(project.id),
        ProjectService.getProgressUpdates(project.id),
        ProjectService.getInspections(project.id),
      ]);

      return this.buildPublicProjectProjection({
        project,
        milestones: m,
        financials: f,
        updates: u,
        inspections: i,
        isDemonstration: project.id.includes('demo') || (project.projectCode && project.projectCode.includes('2026/000')),
      });
    }

    return null;
  }

  /**
   * Aggregates public macro indicators for the Transparency Landing page.
   */
  static async getPublicTransparencyMetrics(): Promise<{
    totalProjects: number;
    totalSanctioned: number;
    totalVerifiedDisbursed: number;
    byStatus: Record<string, number>;
    recentProjects: PublicProjectDTO[];
  }> {
    const { projects } = await this.getPublicProjects({ pageSize: 50 });

    const totalProjects = projects.length;
    const totalSanctioned = projects.reduce((acc, p) => acc + (p.sanctionedAmount || 0), 0);
    const totalVerifiedDisbursed = projects.reduce((acc, p) => acc + (p.verifiedExpenditure || 0), 0);

    const byStatus: Record<string, number> = {
      IN_PROGRESS: 0,
      COMPLETED: 0,
      ON_HOLD: 0,
      NOT_STARTED: 0,
      CLOSED: 0,
    };

    projects.forEach((p) => {
      const st = p.status || 'IN_PROGRESS';
      byStatus[st] = (byStatus[st] || 0) + 1;
    });

    const recentProjects = projects.slice(0, 4);

    return {
      totalProjects,
      totalSanctioned,
      totalVerifiedDisbursed,
      byStatus,
      recentProjects,
    };
  }

  /**
   * Trusted Mutation Boundary: Synchronizes internal project changes to the public projection.
   * If isPubliclyVisible is false, deletes any existing public projection.
   */
  static async syncPublicProjection(
    projectOrId: Project | string,
    milestones?: ProjectMilestone[],
    financials?: ProjectFinancialRecord[],
    updates?: ProjectProgressUpdate[],
    inspections?: ProjectInspection[]
  ): Promise<void> {
    if (!isLiveFirestoreSession() || !db) return;

    let project: Project | null = null;
    let finalMilestones: ProjectMilestone[] = milestones || [];
    let finalFinancials: ProjectFinancialRecord[] = financials || [];
    let finalUpdates: ProjectProgressUpdate[] = updates || [];
    let finalInspections: ProjectInspection[] = inspections || [];

    if (typeof projectOrId === 'string') {
      const { ProjectService } = await import('../firebase/projects');
      project = await ProjectService.getProjectById(projectOrId);
      if (!project) return;

      const [ms, fin, up, insp] = await Promise.all([
        milestones ? Promise.resolve(milestones) : ProjectService.getMilestones(project.id),
        financials ? Promise.resolve(financials) : ProjectService.getFinancialRecords(project.id),
        updates ? Promise.resolve(updates) : ProjectService.getProgressUpdates(project.id),
        inspections ? Promise.resolve(inspections) : ProjectService.getInspections(project.id),
      ]);
      finalMilestones = ms;
      finalFinancials = fin;
      finalUpdates = up;
      finalInspections = insp;
    } else {
      project = projectOrId;
      if (!milestones || !financials || !updates || !inspections) {
        const { ProjectService } = await import('../firebase/projects');
        const [ms, fin, up, insp] = await Promise.all([
          milestones ? Promise.resolve(milestones) : ProjectService.getMilestones(project.id),
          financials ? Promise.resolve(financials) : ProjectService.getFinancialRecords(project.id),
          updates ? Promise.resolve(updates) : ProjectService.getProgressUpdates(project.id),
          inspections ? Promise.resolve(inspections) : ProjectService.getInspections(project.id),
        ]);
        finalMilestones = ms;
        finalFinancials = fin;
        finalUpdates = up;
        finalInspections = insp;
      }
    }

    if (!project || !project.id) return;

    const publicDocRef = doc(db, PUBLIC_PROJECTS_COLLECTION, project.id);

    // Strict Fail-Closed Check: ONLY when eligible for public disclosure (PUBLIC) is it published.
    // If restricted or unestablished (including undefined, null, RESTRICTED), fail closed and remove projection.
    if (!isProjectPubliclyDisclosed(project)) {
      try {
        await deleteDoc(publicDocRef);
      } catch (err) {
        console.warn('[PublicTransparencyService] Failed to remove non-public projection:', err);
      }
      return;
    }

    const publicProjection = this.buildPublicProjectProjection({
      project,
      milestones: finalMilestones,
      financials: finalFinancials,
      updates: finalUpdates,
      inspections: finalInspections,
      isDemonstration: false,
    });

    try {
      await setDoc(publicDocRef, sanitizeFirestorePayload(publicProjection), { merge: true });
    } catch (err) {
      console.warn('[PublicTransparencyService] Failed to write public projection:', err);
    }
  }
}
