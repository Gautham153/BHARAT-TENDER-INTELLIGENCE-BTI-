// Bharat Tender Intelligence (BTI) — Public Transparency Service
// Phase 9: Public Transparency & Citizen Social Audit Layer
// Strictly allowlisted public data projection engine. Prohibits internal risk/anomaly exposure.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  orderBy,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { isLiveFirestoreSession, isDemoSession } from '../firebase/projects';
import {
  buildAuthoritativePublicProjectProjection,
  isProjectPubliclyDisclosed,
} from './publicProjectionBuilder';
import {
  Project,
  ProjectMilestone,
  ProjectFinancialRecord,
  ProjectProgressUpdate,
  ProjectInspection,
  toCanonicalProjectStatus,
  CanonicalProjectStatus,
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
   * Pure deterministic public projection transformer with 100% EXPLICIT ALLOWLISTING.
   * Internal risk scores, anomaly findings, investigation notes, and private contact info are never admitted.
   */
  static buildPublicProjectProjection(params: {
    project: Project;
    milestones?: ProjectMilestone[];
    financials?: ProjectFinancialRecord[];
    updates?: ProjectProgressUpdate[];
    inspections?: ProjectInspection[];
    isDemonstration?: boolean;
  }): PublicProjectDTO {
    return buildAuthoritativePublicProjectProjection(params);
  }

  /**
   * Helper to filter, sort, and paginate public projects.
   */
  private static filterAndPaginate(
    allProjections: PublicProjectDTO[],
    params: PublicTransparencyFilterParams
  ): { projects: PublicProjectDTO[]; total: number; hasMore: boolean } {
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

    const filtered = allProjections.filter((p) => {
      if (search.trim()) {
        const queryNorm = search.trim().toLowerCase();
        const matchesName = (p.projectName || '').toLowerCase().includes(queryNorm);
        const matchesId = (p.projectId || '').toLowerCase().includes(queryNorm) ||
          (p.projectNumber ? p.projectNumber.toLowerCase().includes(queryNorm) : false);
        const matchesDistrict = (p.location?.district || '').toLowerCase().includes(queryNorm);
        const matchesState = (p.location?.state || '').toLowerCase().includes(queryNorm);
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
        if ((p.location?.district || '').toLowerCase() !== district.toLowerCase()) {
          return false;
        }
      }

      if (state && state !== 'ALL') {
        if ((p.location?.state || '').toLowerCase() !== state.toLowerCase()) {
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
        valA = (a.projectName || '').toLowerCase();
        valB = (b.projectName || '').toLowerCase();
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
   * Retrieves paginated public project records.
   * Public clients query only explicitly public-safe records.
   * Issue 1: Fails closed when Firebase is not live and demo mode is not explicitly enabled.
   * Issue 9: Proper pagination without silent 100-record ceiling.
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

    // Issue 1: Fail closed if not live session and not explicit demo session
    if (!isLiveFirestoreSession() || !db) {
      if (isDemoSession()) {
        // Explicit demo session path
        const { ProjectService } = await import('../firebase/projects');
        const allProjects = await ProjectService.getProjects();
        const publicProjects = allProjects.filter((dp) => isProjectPubliclyDisclosed(dp));

        const allProjections = await Promise.all(
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
              isDemonstration: true,
            });
          })
        );

        return this.filterAndPaginate(allProjections, params);
      }

      // Neither live nor explicit demo -> Fail Closed!
      return {
        projects: [],
        total: 0,
        hasMore: false,
      };
    }

    // Live Firestore Path: Read ONLY from publicProjects with proper pagination (no silent 100-record ceiling)
    try {
      const publicCol = collection(db, PUBLIC_PROJECTS_COLLECTION);

      const hasSearch = Boolean(search.trim());
      const hasStatus = Boolean(status && status !== 'ALL');
      const hasDistrict = Boolean(district && district !== 'ALL');
      const hasState = Boolean(state && state !== 'ALL');
      const hasCategory = Boolean(category && category !== 'ALL');
      const hasFilters = hasSearch || hasStatus || hasDistrict || hasState || hasCategory;

      // Fast path: Default directory browse without filters uses getCountFromServer and page limit
      if (!hasFilters && sortBy === 'lastUpdated') {
        const countSnap = await getCountFromServer(publicCol);
        const total = countSnap.data().count;

        const fetchLimit = page * pageSize;
        const q = query(
          publicCol,
          orderBy('lastUpdated', sortOrder === 'asc' ? 'asc' : 'desc'),
          limit(fetchLimit)
        );
        const snap = await getDocs(q);
        const docs: PublicProjectDTO[] = [];
        snap.forEach((d) => {
          const item = d.data() as PublicProjectDTO;
          if (item && isProjectPubliclyDisclosed(item)) {
            docs.push(item);
          }
        });

        const startIndex = (page - 1) * pageSize;
        const paginated = docs.slice(startIndex, startIndex + pageSize);
        const hasMore = startIndex + paginated.length < total;

        return {
          projects: paginated,
          total,
          hasMore,
        };
      }

      // Filtered/search path: Fetch all public project records without arbitrary 100-record ceiling
      const snap = await getDocs(publicCol);
      const allProjections: PublicProjectDTO[] = [];

      snap.forEach((d) => {
        const item = d.data() as PublicProjectDTO;
        if (item && isProjectPubliclyDisclosed(item)) {
          allProjections.push(item);
        }
      });

      return this.filterAndPaginate(allProjections, params);
    } catch (err) {
      console.warn('[PublicTransparencyService] Error querying publicProjects:', err);
      return {
        projects: [],
        total: 0,
        hasMore: false,
      };
    }
  }

  /**
   * Retrieves a single public project record by ID.
   * PROTECTION AGAINST ENUMERATION: If project does not exist or is not public,
   * returns null so the client gets the exact same generic unavailable response.
   * Issue 1: Fails closed when Firebase is not live and demo mode is not explicitly enabled.
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

    if (isDemoSession()) {
      // Demonstration / Local session ONLY when explicitly enabled
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
          isDemonstration: true,
        });
      }
      return null;
    }

    // Fail closed! If Firebase is not live AND demo mode is not explicitly enabled:
    return null;
  }

  /**
   * Aggregates public macro indicators for the Transparency Landing page across ALL public projects.
   * Fails closed if Firebase is not live and demo mode is not explicitly enabled.
   * Does not truncate metrics with an arbitrary ceiling.
   */
  static async getPublicTransparencyMetrics(): Promise<{
    totalProjects: number;
    totalSanctioned: number;
    totalVerifiedDisbursed: number;
    byStatus: Record<string, number>;
    recentProjects: PublicProjectDTO[];
    isDemonstration: boolean;
  }> {
    if (!isLiveFirestoreSession() && !isDemoSession()) {
      return {
        totalProjects: 0,
        totalSanctioned: 0,
        totalVerifiedDisbursed: 0,
        byStatus: {
          IN_PROGRESS: 0,
          COMPLETED: 0,
          ON_HOLD: 0,
          NOT_STARTED: 0,
          CLOSED: 0,
        },
        recentProjects: [],
        isDemonstration: false,
      };
    }

    let allPublicProjects: PublicProjectDTO[] = [];
    let isDemonstration = false;

    if (isLiveFirestoreSession() && db) {
      try {
        const publicCol = collection(db, PUBLIC_PROJECTS_COLLECTION);
        const snap = await getDocs(publicCol);
        snap.forEach((d) => {
          const item = d.data() as PublicProjectDTO;
          if (item && isProjectPubliclyDisclosed(item)) {
            allPublicProjects.push(item);
          }
        });
        isDemonstration = allPublicProjects.some((p) => p.isDemonstrationData);
      } catch (err) {
        console.warn('[PublicTransparencyService] Error querying all publicProjects for metrics:', err);
      }
    } else if (isDemoSession()) {
      isDemonstration = true;
      try {
        const { ProjectService } = await import('../firebase/projects');
        const allProjects = await ProjectService.getProjects();
        const publicProjects = allProjects.filter((dp) => isProjectPubliclyDisclosed(dp));

        allPublicProjects = await Promise.all(
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
              isDemonstration: true,
            });
          })
        );
      } catch (err) {
        console.warn('[PublicTransparencyService] Error loading demo metrics:', err);
      }
    }

    const totalProjects = allPublicProjects.length;
    const totalSanctioned = allPublicProjects.reduce(
      (acc, p) => acc + (p.sanctionedAmount !== undefined ? p.sanctionedAmount : 0),
      0
    );
    const totalVerifiedDisbursed = allPublicProjects.reduce(
      (acc, p) => acc + (p.hasVerifiedExpenditureRecords ? (p.verifiedExpenditure || 0) : 0),
      0
    );

    const byStatus: Record<string, number> = {
      IN_PROGRESS: 0,
      COMPLETED: 0,
      ON_HOLD: 0,
      NOT_STARTED: 0,
      CLOSED: 0,
    };

    allPublicProjects.forEach((p) => {
      if (p.status && byStatus[p.status] !== undefined) {
        byStatus[p.status] += 1;
      }
    });

    const recentProjects = [...allPublicProjects]
      .sort((a, b) => {
        const timeA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
        const timeB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 4);

    return {
      totalProjects,
      totalSanctioned,
      totalVerifiedDisbursed,
      byStatus,
      recentProjects,
      isDemonstration,
    };
  }

  /**
   * Trusted Mutation Boundary: Synchronizes internal project changes to the public projection.
   * Calls the authoritative server-side endpoint (POST /api/data action: "sync-public-projection").
   * The server authenticates government identity, resolves authoritative records,
   * constructs the allowlisted public DTO, and writes directly to publicProjects/{projectId}.
   */
  static async syncPublicProjection(
    projectOrId: Project | string,
    _milestones?: ProjectMilestone[],
    _financials?: ProjectFinancialRecord[],
    _updates?: ProjectProgressUpdate[],
    _inspections?: ProjectInspection[]
  ): Promise<void> {
    const projectId = typeof projectOrId === 'string' ? projectOrId : projectOrId?.id;
    if (!projectId) return;

    let token: string | undefined;
    try {
      const { auth } = await import('../firebase/firebase');
      if (auth?.currentUser) {
        token = await auth.currentUser.getIdToken();
      }
    } catch {
      // Offline / fallback
    }

    if (!token && isDemoSession()) {
      token = 'bti-demo-token-government';
    }

    const res = await fetch('/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        action: 'sync-public-projection',
        projectId,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const errorMsg = data?.error || data?.message || `Server returned HTTP ${res.status}`;
      throw new Error(`Public projection sync failed: ${errorMsg}`);
    }
  }

  /**
   * Trusted Mutation Boundary: Authoritatively deletes the public projection for a project.
   * Calls the server endpoint (POST /api/data action: "delete-public-projection").
   * Used when restricting public disclosure to guarantee no stale public projection exists before
   * committing the RESTRICTED status to Firestore.
   */
  static async deletePublicProjection(projectId: string): Promise<void> {
    if (!projectId) return;

    let token: string | undefined;
    try {
      const { auth } = await import('../firebase/firebase');
      if (auth?.currentUser) {
        token = await auth.currentUser.getIdToken();
      }
    } catch {
      // Offline / fallback
    }

    if (!token && isDemoSession()) {
      token = 'bti-demo-token-government';
    }

    const res = await fetch('/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        action: 'delete-public-projection',
        projectId,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const errorMsg = data?.error || data?.message || `Server returned HTTP ${res.status}`;
      throw new Error(`Public projection deletion failed: ${errorMsg}`);
    }
  }
}
