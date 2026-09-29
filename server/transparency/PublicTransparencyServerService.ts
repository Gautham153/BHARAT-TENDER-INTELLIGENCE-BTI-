// Bharat Tender Intelligence (BTI) — Server-Side Public Transparency Projection Engine
// Phase 9: Public Transparency & Citizen Social Audit Layer
// Derives, sanitizes, and writes public project projections strictly on the server from authoritative records.
// Ordinary clients cannot directly write to publicProjects in Firestore.

import {
  AuthenticatedUser,
  verifyServerAuth,
  isServerDemoModeEnabled,
} from '../evaluation/serverAuth.js';
import {
  parseFirestoreDoc,
  toFirestoreValue,
  getServerFirestoreAccessToken,
} from '../evaluation/authoritativeDataService.js';
import {
  buildAuthoritativePublicProjectProjection,
  isProjectPubliclyDisclosed,
} from '../../src/services/transparency/publicProjectionBuilder.js';
import { Project, ProjectMilestone, ProjectFinancialRecord, ProjectProgressUpdate, ProjectInspection } from '../../src/types/project.js';
import { PublicProjectDTO } from '../../src/types/publicTransparency.js';
import {
  DEMONSTRATION_PROJECTS,
  DEMONSTRATION_MILESTONES,
  DEMONSTRATION_FINANCIAL_RECORDS,
  DEMONSTRATION_PROGRESS_UPDATES,
  DEMONSTRATION_INSPECTIONS,
} from '../../src/data/demonstrationProjects.js';
import { mockProjects } from '../../src/data/mockData.js';

export class PublicTransparencyServerService {
  /**
   * Authoritatively synchronizes a project's public transparency projection.
   * Authenticates caller, verifies government role, reads authoritative records,
   * constructs allowlisted public DTO, and writes to publicProjects/{projectId}.
   */
  async syncPublicProjection(params: {
    projectId: string;
    authHeader?: string;
  }): Promise<{
    success: boolean;
    action: 'synchronized' | 'deleted_or_hidden';
    projectId: string;
    projection?: PublicProjectDTO;
  }> {
    const { projectId, authHeader } = params;

    // 1. Validate projectId
    if (!projectId || typeof projectId !== 'string' || projectId.trim().length === 0) {
      const err: any = new Error('Invalid Request: projectId is required for public projection synchronization.');
      err.statusCode = 400;
      throw err;
    }

    const cleanProjectId = projectId.trim();
    if (
      cleanProjectId.includes('/') ||
      cleanProjectId.includes('\\') ||
      cleanProjectId.includes('..') ||
      cleanProjectId.includes('\0')
    ) {
      const err: any = new Error('Invalid Request: Malformed projectId.');
      err.statusCode = 400;
      throw err;
    }

    // 2. Authenticate Firebase user and verify government role
    const caller: AuthenticatedUser = await verifyServerAuth(authHeader);
    if (caller.role !== 'government') {
      const err: any = new Error(
        `Access Denied: Only authorized government officers may trigger public transparency projection synchronization (caller role: '${caller.role}').`
      );
      err.statusCode = 403;
      throw err;
    }

    const inDemoMode = isServerDemoModeEnabled();
    const firebaseProjectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

    // 3. Explicit Server Demo Mode Path
    if (inDemoMode) {
      const demoProject =
        DEMONSTRATION_PROJECTS.find((p) => p.id === cleanProjectId || (p as any).projectCode === cleanProjectId) ||
        mockProjects.find((p) => p.id === cleanProjectId || (p as any).projectCode === cleanProjectId);

      if (demoProject) {
        const milestones = DEMONSTRATION_MILESTONES.filter((m) => m.projectId === demoProject.id);
        const financials = DEMONSTRATION_FINANCIAL_RECORDS.filter((f) => f.projectId === demoProject.id);
        const updates = DEMONSTRATION_PROGRESS_UPDATES.filter((u) => u.projectId === demoProject.id);
        const inspections = DEMONSTRATION_INSPECTIONS.filter((i) => i.projectId === demoProject.id);

        if (!isProjectPubliclyDisclosed(demoProject)) {
          if (firebaseProjectId) {
            await this.deleteFirestoreProjection(firebaseProjectId, cleanProjectId);
          }
          return {
            success: true,
            action: 'deleted_or_hidden',
            projectId: cleanProjectId,
          };
        }

        const projection = buildAuthoritativePublicProjectProjection({
          project: demoProject,
          milestones,
          financials,
          updates,
          inspections,
          isDemonstration: true,
        });

        if (firebaseProjectId) {
          await this.writeFirestoreProjection(firebaseProjectId, cleanProjectId, projection);
        }

        return {
          success: true,
          action: 'synchronized',
          projectId: cleanProjectId,
          projection,
        };
      }
    }

    // 4. Production / Live Mode: Authoritative Firestore Data Resolution ONLY
    if (!firebaseProjectId || firebaseProjectId.trim().length === 0) {
      const err: any = new Error(
        'Server Configuration Error: Firebase Project ID is not configured. Authoritative records cannot be loaded.'
      );
      err.statusCode = 500;
      throw err;
    }

    const serverToken = await getServerFirestoreAccessToken();
    const bearerToken = serverToken || (authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : undefined);

    // Fetch authoritative project record from Firestore
    let projectDoc: Project;
    try {
      const projRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${firebaseProjectId.trim()}/databases/(default)/documents/projects/${encodeURIComponent(cleanProjectId)}`,
        {
          headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {},
        }
      );

      if (!projRes.ok) {
        if (projRes.status === 404) {
          const err: any = new Error(`Authoritative project '${cleanProjectId}' was not found in database.`);
          err.statusCode = 404;
          throw err;
        }
        const err: any = new Error(
          `Failed to retrieve authoritative project from Firestore (status ${projRes.status}).`
        );
        err.statusCode = 502;
        throw err;
      }

      const projJson = await projRes.json();
      projectDoc = parseFirestoreDoc<Project>(projJson);
      projectDoc.id = projectDoc.id || cleanProjectId;
    } catch (err: any) {
      if (err.statusCode) throw err;
      const netErr: any = new Error(`Communication error reading project from Firestore: ${err.message}`);
      netErr.statusCode = 502;
      throw netErr;
    }

    // Fail-Closed Check: If project is not publicly disclosed, remove projection if it exists
    if (!isProjectPubliclyDisclosed(projectDoc)) {
      await this.deleteFirestoreProjection(firebaseProjectId.trim(), cleanProjectId, bearerToken);
      return {
        success: true,
        action: 'deleted_or_hidden',
        projectId: cleanProjectId,
      };
    }

    // Fetch subcollections authoritatively via Firestore runQuery
    const [milestones, financials, updates, inspections] = await Promise.all([
      this.queryFirestoreCollection(firebaseProjectId.trim(), bearerToken, 'projectMilestones', cleanProjectId),
      this.queryFirestoreCollection(firebaseProjectId.trim(), bearerToken, 'projectFinancialRecords', cleanProjectId),
      this.queryFirestoreCollection(firebaseProjectId.trim(), bearerToken, 'projectProgressUpdates', cleanProjectId),
      this.queryFirestoreCollection(firebaseProjectId.trim(), bearerToken, 'projectInspections', cleanProjectId),
    ]);

    // Construct allowlisted public DTO
    const projection = buildAuthoritativePublicProjectProjection({
      project: projectDoc,
      milestones: milestones as ProjectMilestone[],
      financials: financials as ProjectFinancialRecord[],
      updates: updates as ProjectProgressUpdate[],
      inspections: inspections as ProjectInspection[],
      isDemonstration: Boolean((projectDoc as any).isDemonstrationData),
    });

    // Write projection to publicProjects/{cleanProjectId} via Firestore REST API
    await this.writeFirestoreProjection(firebaseProjectId.trim(), cleanProjectId, projection, bearerToken);

    return {
      success: true,
      action: 'synchronized',
      projectId: cleanProjectId,
      projection,
    };
  }

  /**
   * Helper to query Firestore subcollections by projectId.
   */
  private async queryFirestoreCollection(
    firebaseProjectId: string,
    token: string | undefined,
    collectionId: string,
    projectId: string
  ): Promise<any[]> {
    try {
      const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents:runQuery`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `HTTP ${res.status}`;
        const err: any = new Error(
          `Failed querying authoritative Firestore collection '${collectionId}': ${errMsg}`
        );
        err.statusCode = res.status >= 500 ? 502 : res.status;
        throw err;
      }

      const results = await res.json();
      return (Array.isArray(results) ? results : [])
        .filter((r: any) => r.document)
        .map((r: any) => parseFirestoreDoc(r.document));
    } catch (e: any) {
      if (e.statusCode) throw e;
      const netErr: any = new Error(
        `Communication error querying Firestore collection '${collectionId}': ${e.message}`
      );
      netErr.statusCode = 502;
      throw netErr;
    }
  }

  /**
   * Writes an allowlisted projection to publicProjects/{projectId} via Firestore REST API.
   * Enforces strict replacement semantics: removes stale/unapproved top-level fields using updateMask.
   * Throws an error on write failure (never silently reports success).
   */
  private async writeFirestoreProjection(
    firebaseProjectId: string,
    projectId: string,
    projection: PublicProjectDTO,
    token?: string
  ): Promise<void> {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(projection)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }

    const serverToken = await getServerFirestoreAccessToken();
    const effectiveToken = serverToken || token;
    const docUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/publicProjects/${encodeURIComponent(projectId)}`;

    // 1. Obtain existing document fields to identify any stale/unapproved fields for deletion
    // Strictly fail-closed: 404 proceeds with empty list; any other error aborts synchronization.
    let existingFieldKeys: string[] = [];
    try {
      const getRes = await fetch(docUrl, {
        method: 'GET',
        headers: effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {},
      });
      if (getRes.ok) {
        const existingData = await getRes.json();
        if (existingData?.fields && typeof existingData.fields === 'object') {
          existingFieldKeys = Object.keys(existingData.fields);
        }
      } else if (getRes.status === 404) {
        existingFieldKeys = [];
      } else {
        const errJson = await getRes.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `HTTP ${getRes.status}`;
        const err: any = new Error(
          `Failed to retrieve existing public project projection prior to replacement: ${errMsg}`
        );
        err.statusCode = getRes.status >= 500 ? 502 : getRes.status;
        throw err;
      }
    } catch (err: any) {
      if (err.statusCode) throw err;
      const netErr: any = new Error(
        `Communication error retrieving existing public projection: ${err.message}`
      );
      netErr.statusCode = 502;
      throw netErr;
    }

    // 2. Build complete updateMask covering all existing + new field paths
    // In Firestore REST PATCH, any field specified in updateMask that is omitted from body.fields is deleted.
    const allMaskKeys = Array.from(new Set([...existingFieldKeys, ...Object.keys(fields)]));
    const queryParams = allMaskKeys.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    const patchUrl = queryParams ? `${docUrl}?${queryParams}` : docUrl;

    // 3. Perform atomic replacement write
    try {
      const res = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
        },
        body: JSON.stringify({ fields }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `HTTP ${res.status}`;
        const err: any = new Error(
          `Failed to persist public project projection to database: ${errMsg}`
        );
        err.statusCode = res.status >= 500 ? 502 : res.status;
        throw err;
      }
    } catch (err: any) {
      if (err.statusCode) throw err;
      const netErr: any = new Error(
        `Communication error persisting public projection: ${err.message}`
      );
      netErr.statusCode = 502;
      throw netErr;
    }
  }

  /**
   * Deletes a projection from publicProjects/{projectId} via Firestore REST API.
   * Surfaces failures rather than silently treating them as successful (except 404).
   */
  private async deleteFirestoreProjection(
    firebaseProjectId: string,
    projectId: string,
    token?: string
  ): Promise<void> {
    const serverToken = await getServerFirestoreAccessToken();
    const effectiveToken = serverToken || token;

    const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/publicProjects/${encodeURIComponent(projectId)}`;
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {},
      });

      // 404 is fine (already deleted / non-existent)
      if (!res.ok && res.status !== 404) {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `HTTP ${res.status}`;
        const err: any = new Error(
          `Failed to remove public project projection from database: ${errMsg}`
        );
        err.statusCode = res.status >= 500 ? 502 : res.status;
        throw err;
      }
    } catch (err: any) {
      if (err.statusCode) throw err;
      const netErr: any = new Error(
        `Communication error deleting public projection: ${err.message}`
      );
      netErr.statusCode = 502;
      throw netErr;
    }
  }
}
