// Bharat Tender Intelligence (BTI) — Authoritative Document & Project Resolver
// Phase 11: Authoritative Document Ownership & Access Boundary Resolution

import path from 'node:path';
import { ProjectDocument } from '../../src/types/document.js';
import { Project } from '../../src/types/project.js';
import { DEMONSTRATION_DOCUMENTS } from '../../src/data/demonstrationDocuments.js';
import { mockProjects } from '../../src/data/mockData.js';
import {
  parseFirestoreDoc,
  getServerFirestoreAccessToken,
} from '../evaluation/authoritativeDataService.js';
import { isServerDemoModeEnabled } from '../evaluation/serverAuth.js';

// Demonstration baseline project for Agency A (org-demo-1)
export const DEMO_PROJECT_AGENCY_A: Project = {
  id: 'proj-mplad-2026-001',
  projectNumber: 'BTI/MPLAD/2026/0001',
  tenderId: 'tnd-003',
  proposalId: 'prop-demo-awarded',
  organizationId: 'org-demo-1',
  title: 'Solar Powered Drinking Water & Community Purification Units',
  description: 'Installation of 45 solar-powered drinking water filtration kiosks.',
  authorityId: 'gov-user-1',
  authorityName: 'District Planning & MPLAD Monitoring Cell, Varanasi',
  implementingAgencyName: 'National Civil Infra Ltd.',
  agencyName: 'National Civil Infra Ltd.',
  state: 'Uttar Pradesh',
  district: 'Varanasi',
  sanctionedAmount: 14500000,
  awardedAmount: 13850000,
  status: 'IN_PROGRESS',
  createdAt: '2026-01-10T10:00:00Z',
  updatedAt: '2026-02-28T14:30:00Z',
};

// Demonstration project for Agency B (org-demo-2)
export const DEMO_PROJECT_AGENCY_B: Project = {
  id: 'proj-demo-agency-b',
  projectNumber: 'BTI/MPLAD/2026/0002',
  tenderId: 'tnd-004',
  proposalId: 'prop-demo-agency-b',
  organizationId: 'org-demo-2',
  title: 'Secondary Rural Road Overbridge & Culvert Works (Agency B)',
  description: 'Construction of 2-lane overbridge and allied civil drainage.',
  authorityId: 'gov-user-1',
  authorityName: 'Public Works Department, Varanasi',
  implementingAgencyName: 'Apex BuildTech Enterprises',
  agencyName: 'Apex BuildTech Enterprises',
  state: 'Uttar Pradesh',
  district: 'Varanasi',
  sanctionedAmount: 18500000,
  awardedAmount: 17200000,
  status: 'IN_PROGRESS',
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-02-20T14:30:00Z',
};

// Demonstration document for Agency B (org-demo-2)
export const DEMO_DOCUMENT_AGENCY_B: ProjectDocument = {
  id: 'doc-demo-agency-b',
  projectId: 'proj-demo-agency-b',
  projectNumber: 'BTI/MPLAD/2026/0002',
  projectTitle: 'Secondary Rural Road Overbridge & Culvert Works (Agency B)',
  organizationId: 'org-demo-2',
  organizationName: 'Apex BuildTech Enterprises',
  documentType: 'INVOICE',
  detectedDocumentType: 'INVOICE',
  originalFileName: 'Agency_B_Concrete_Invoice_INV-99.pdf',
  storageReference: 'storage/documents/proj-demo-agency-b/doc-demo-agency-b_invoice.pdf',
  fileHash: 'f4ca4238a0b923820dcc509a6f75849b27ae41e4649b934ca495991b7852b999',
  mimeType: 'application/pdf',
  fileSize: 312000,
  uploadedBy: 'usr-ag-002',
  uploaderName: 'Suresh Chandra Mehta',
  uploaderRole: 'agency',
  uploadedAt: '2026-03-01T10:00:00Z',
  processingStatus: 'UPLOADED',
  extractionStatus: 'PENDING',
  validationStatus: 'NOT_VALIDATED',
  reviewStatus: 'NONE_REQUIRED',
  isDemonstrationData: true,
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
};

// In-memory document vault registry for documents uploaded during current server runtime
const runtimeDocumentCache = new Map<string, ProjectDocument>();

export function recordInMemoryDocument(doc: ProjectDocument): void {
  if (doc?.id) {
    runtimeDocumentCache.set(doc.id, doc);
  }
}

/**
 * Resolves an authoritative ProjectDocument record by document ID.
 */
export async function getAuthoritativeDocument(
  documentId: string,
  token?: string
): Promise<ProjectDocument | null> {
  if (!documentId || typeof documentId !== 'string') return null;
  const cleanId = documentId.trim();

  // 1. Demo Mode ONLY: Check in-memory session cache and demonstration documents
  if (isServerDemoModeEnabled()) {
    if (runtimeDocumentCache.has(cleanId)) {
      return runtimeDocumentCache.get(cleanId)!;
    }
    if (cleanId === DEMO_DOCUMENT_AGENCY_B.id) {
      return DEMO_DOCUMENT_AGENCY_B;
    }
    const demoMatch = DEMONSTRATION_DOCUMENTS.find((d) => d.id === cleanId);
    if (demoMatch) {
      return demoMatch;
    }

    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    if (projectId && token && !token.startsWith('bti-token-') && !token.startsWith('demo-token-')) {
      try {
        const res = await fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId.trim()}/databases/(default)/documents/projectDocuments/${encodeURIComponent(cleanId)}`,
          { headers: { Authorization: `Bearer ${token.trim()}` } }
        );
        if (res.ok) {
          const docJson = await res.json();
          const parsed = parseFirestoreDoc<ProjectDocument>(docJson);
          if (parsed) {
            return { ...parsed, id: parsed.id || cleanId };
          }
        }
      } catch {
        // Fall through
      }
    }
    return null;
  }

  // 2. Live Mode: Firestore is sole authoritative document source (No cache or demo fallback)
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (!projectId || projectId.trim().length === 0) {
    return null;
  }

  const serverToken = await getServerFirestoreAccessToken();
  const effectiveToken = serverToken || token;
  const headers: Record<string, string> = {};
  if (effectiveToken) {
    headers['Authorization'] = `Bearer ${effectiveToken.trim()}`;
  }

  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId.trim()}/databases/(default)/documents/projectDocuments/${encodeURIComponent(cleanId)}`,
      { headers }
    );
    if (res.ok) {
      const docJson = await res.json();
      const parsed = parseFirestoreDoc<ProjectDocument>(docJson);
      if (parsed) {
        return { ...parsed, id: parsed.id || cleanId };
      }
    }
  } catch (err) {
    console.warn('[AuthoritativeDocumentResolver] Firestore document fetch error:', err);
  }

  return null;
}

/**
 * Resolves an authoritative Project record by project ID.
 */
export async function getAuthoritativeProject(
  projectId: string,
  token?: string
): Promise<Project | null> {
  if (!projectId || typeof projectId !== 'string') return null;
  const cleanId = projectId.trim();

  // 1. Demo Mode ONLY: Check known demonstration projects and mockData
  if (isServerDemoModeEnabled()) {
    if (cleanId === DEMO_PROJECT_AGENCY_A.id) {
      return DEMO_PROJECT_AGENCY_A;
    }
    if (cleanId === DEMO_PROJECT_AGENCY_B.id) {
      return DEMO_PROJECT_AGENCY_B;
    }
    const mockMatch = mockProjects.find((p) => p.id === cleanId || p.projectCode === cleanId);
    if (mockMatch) {
      return mockMatch;
    }

    const fbProjectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    if (fbProjectId && token && !token.startsWith('bti-token-') && !token.startsWith('demo-token-')) {
      try {
        const res = await fetch(
          `https://firestore.googleapis.com/v1/projects/${fbProjectId.trim()}/databases/(default)/documents/projects/${encodeURIComponent(cleanId)}`,
          { headers: { Authorization: `Bearer ${token.trim()}` } }
        );
        if (res.ok) {
          const docJson = await res.json();
          const parsed = parseFirestoreDoc<Project>(docJson);
          if (parsed) {
            return { ...parsed, id: parsed.id || cleanId };
          }
        }
      } catch {
        // Fall through
      }
    }
    return null;
  }

  // 2. Live Mode: Firestore is authoritative (No demo/mock fallbacks)
  const fbProjectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (!fbProjectId || fbProjectId.trim().length === 0) {
    return null;
  }

  const serverToken = await getServerFirestoreAccessToken();
  const effectiveToken = serverToken || token;
  const headers: Record<string, string> = {};
  if (effectiveToken) {
    headers['Authorization'] = `Bearer ${effectiveToken.trim()}`;
  }

  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${fbProjectId.trim()}/databases/(default)/documents/projects/${encodeURIComponent(cleanId)}`,
      { headers }
    );
    if (res.ok) {
      const docJson = await res.json();
      const parsed = parseFirestoreDoc<Project>(docJson);
      if (parsed) {
        return { ...parsed, id: parsed.id || cleanId };
      }
    }
  } catch (err) {
    console.warn('[AuthoritativeDocumentResolver] Firestore project fetch error:', err);
  }

  return null;
}

/**
 * Resolves an authoritative ProjectDocument record from a storage reference.
 * Strictly verifies storage reference is mapped to an authoritative document.
 */
export async function getAuthoritativeDocumentByStorageRef(
  storageReference: string,
  token?: string
): Promise<ProjectDocument | null> {
  if (!storageReference || typeof storageReference !== 'string') return null;

  // Path traversal guard
  if (
    storageReference.includes('..') ||
    storageReference.startsWith('/') ||
    storageReference.includes('\\') ||
    storageReference.includes('\0')
  ) {
    const err: any = new Error('Invalid storage reference path.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedRef = storageReference.trim().replace(/^\.?\//, '');
  const baseName = path.basename(normalizedRef);

  // 1. Demo Mode ONLY: Check in-memory session cache and demonstration documents
  if (isServerDemoModeEnabled()) {
    for (const doc of runtimeDocumentCache.values()) {
      if (
        doc.storageReference === normalizedRef ||
        doc.storageReference === storageReference ||
        path.basename(doc.storageReference) === baseName
      ) {
        return doc;
      }
    }

    if (
      DEMO_DOCUMENT_AGENCY_B.storageReference === normalizedRef ||
      path.basename(DEMO_DOCUMENT_AGENCY_B.storageReference) === baseName
    ) {
      return DEMO_DOCUMENT_AGENCY_B;
    }

    for (const doc of DEMONSTRATION_DOCUMENTS) {
      if (
        doc.storageReference === normalizedRef ||
        doc.storageReference === storageReference ||
        path.basename(doc.storageReference) === baseName
      ) {
        return doc;
      }
    }

    const idMatch = baseName.match(/^(doc-[a-zA-Z0-9_-]+?)(?:_|\.|$)/);
    if (idMatch && idMatch[1]) {
      const byId = await getAuthoritativeDocument(idMatch[1], token);
      if (byId) {
        if (
          byId.storageReference === normalizedRef ||
          byId.storageReference === storageReference ||
          path.basename(byId.storageReference) === baseName ||
          baseName.startsWith(byId.id)
        ) {
          return byId;
        }
      }
    }
  }

  // 2. Live Mode Firestore Query: find document by storageReference (Authoritative, no demo or runtime cache fallback)
  const fbProjectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (!fbProjectId || fbProjectId.trim().length === 0) {
    return null;
  }

  const serverToken = await getServerFirestoreAccessToken();
  const effectiveToken = serverToken || token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (effectiveToken) {
    headers['Authorization'] = `Bearer ${effectiveToken.trim()}`;
  }

  try {
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${fbProjectId.trim()}/databases/(default)/documents:runQuery`;
    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: 'projectDocuments' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'storageReference' },
            op: 'EQUAL',
            value: { stringValue: normalizedRef },
          },
        },
        limit: 1,
      },
    };

    const res = await fetch(queryUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(queryBody),
    });

    if (res.ok) {
      const results = await res.json();
      if (Array.isArray(results) && results.length > 0 && results[0].document) {
        const parsed = parseFirestoreDoc<ProjectDocument>(results[0].document);
        if (parsed) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('[AuthoritativeDocumentResolver] Firestore storage reference query error:', err);
  }

  return null;
}
