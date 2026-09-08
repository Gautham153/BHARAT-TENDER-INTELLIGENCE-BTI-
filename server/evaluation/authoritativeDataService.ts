// Bharat Tender Intelligence (BTI) — Server Authoritative Data Service
// Phase 5: Authoritative Backend Repository & Data Boundary
// Fetches sealed proposals, tenders, and organizations directly from authoritative database records.
// In live Firebase mode, never falls back to mock/seed data on lookup failures.

import crypto from 'crypto';
import { Proposal, ProposalAuditEvent } from '../../src/types/proposal';
import { Tender } from '../../src/types/tender';
import { Organization } from '../../src/types/organization';
import { EvaluationResult } from '../../src/types/evaluation';
import { SEED_TENDERS } from '../../src/services/firebase/tenders';
import { SEED_DEMO_ORGANIZATIONS } from '../../src/services/firebase/organizations';
import { mockProposals, mockTenders } from '../../src/data/mockData';
import { isServerDemoModeEnabled } from './serverAuth';

export function convertFirestoreValue(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    const values = val.arrayValue?.values || [];
    return values.map(convertFirestoreValue);
  }
  if ('mapValue' in val) {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue?.fields || {})) {
      res[k] = convertFirestoreValue(v);
    }
    return res;
  }
  return val;
}

export function parseFirestoreDoc<T = any>(doc: any): T {
  const fields = doc?.fields || {};
  const res: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    res[k] = convertFirestoreValue(v);
  }
  return res as T;
}

export function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: val.toString() };
    }
    return { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(toFirestoreValue),
      },
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return {
      mapValue: { fields },
    };
  }
  return { stringValue: String(val) };
}

let cachedServerAccessToken: { token: string; expiresAt: number } | null = null;

/**
 * Acquires a Google Cloud service account access token for server-side authoritative Firestore operations.
 */
async function getServerFirestoreAccessToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedServerAccessToken && cachedServerAccessToken.expiresAt > now) {
    return cachedServerAccessToken.token;
  }

  // 1. Direct FIREBASE_ADMIN_TOKEN
  if (process.env.FIREBASE_ADMIN_TOKEN && process.env.FIREBASE_ADMIN_TOKEN.trim().length > 0) {
    return process.env.FIREBASE_ADMIN_TOKEN.trim();
  }

  // 2. FIREBASE_SERVICE_ACCOUNT_KEY JSON credentials
  const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saKey && saKey.trim().length > 0) {
    try {
      const sa = JSON.parse(saKey.trim());
      const nowSec = Math.floor(now / 1000);
      const header = { alg: 'RS256', typ: 'JWT' };
      const payload = {
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/datastore',
        aud: 'https://oauth2.googleapis.com/token',
        exp: nowSec + 3600,
        iat: nowSec,
      };
      const b64 = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64url');
      const unsigned = `${b64(header)}.${b64(payload)}`;
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(unsigned);
      const signature = sign.sign(sa.private_key, 'base64url');
      const assertion = `${unsigned}.${signature}`;

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${assertion}`,
      });

      if (res.ok) {
        const data = await res.json();
        cachedServerAccessToken = {
          token: data.access_token,
          expiresAt: now + (data.expires_in || 3600) * 1000 - 60000,
        };
        return data.access_token;
      }
    } catch {
      // Fall through
    }
  }

  // 3. Google Cloud Metadata Server (when running on GCP / Cloud Run)
  try {
    const metaRes = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      {
        headers: { 'Metadata-Flavor': 'Google' },
        signal: AbortSignal.timeout(1000),
      }
    );
    if (metaRes.ok) {
      const data = await metaRes.json();
      if (data.access_token) {
        cachedServerAccessToken = {
          token: data.access_token,
          expiresAt: now + (data.expires_in || 3600) * 1000 - 60000,
        };
        return data.access_token;
      }
    }
  } catch {
    // Metadata server not reachable outside GCP
  }

  return null;
}

/**
 * Persists an evaluation record to the authoritative Firestore database server-side.
 * Ensures evaluation records are strictly server-authoritative and append-only.
 */
export async function saveAuthoritativeEvaluation(evaluation: EvaluationResult): Promise<void> {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (!projectId || projectId.trim().length === 0) {
    if (isServerDemoModeEnabled()) {
      return;
    }
    const err: any = new Error(
      'Server Configuration Error: Firebase Project ID is not configured. Authoritative evaluation cannot be persisted.'
    );
    err.statusCode = 500;
    throw err;
  }

  const serverToken = await getServerFirestoreAccessToken();
  if (!serverToken) {
    if (isServerDemoModeEnabled()) {
      return;
    }
    const err: any = new Error(
      'Authoritative Persistence Failure: Server service account credentials (FIREBASE_SERVICE_ACCOUNT_KEY) are required to persist authoritative evaluations to Firestore.'
    );
    err.statusCode = 500;
    throw err;
  }

  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(evaluation)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId.trim()}/databases/(default)/documents/proposalEvaluations?documentId=${encodeURIComponent(evaluation.id)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serverToken}`,
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    if (res.status === 409) {
      const err: any = new Error(
        `Authoritative Persistence Conflict: Evaluation record '${evaluation.id}' already exists. Overwriting existing evaluation records is strictly forbidden.`
      );
      err.statusCode = 409;
      throw err;
    }
    const errJson = await res.json().catch(() => ({}));
    const msg = errJson?.error?.message || `Firestore save failed with status ${res.status}`;
    const err: any = new Error(`Authoritative Persistence Failure: ${msg}`);
    err.statusCode = res.status >= 400 && res.status < 500 ? res.status : 500;
    throw err;
  }
}

/**
 * Persists an AI proposal audit event to the authoritative Firestore database server-side.
 * Ensures audit events are created using authenticated government identity and authoritative IDs.
 */
export async function saveAuthoritativeAuditEvent(event: ProposalAuditEvent): Promise<void> {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (!projectId || projectId.trim().length === 0) {
    if (isServerDemoModeEnabled()) {
      return;
    }
    const err: any = new Error(
      'Server Configuration Error: Firebase Project ID is not configured. Authoritative audit event cannot be persisted.'
    );
    err.statusCode = 500;
    throw err;
  }

  const serverToken = await getServerFirestoreAccessToken();
  if (!serverToken) {
    if (isServerDemoModeEnabled()) {
      return;
    }
    const err: any = new Error(
      'Authoritative Persistence Failure: Server service account credentials (FIREBASE_SERVICE_ACCOUNT_KEY) are required to persist authoritative audit events to Firestore.'
    );
    err.statusCode = 500;
    throw err;
  }

  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(event)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId.trim()}/databases/(default)/documents/proposalEvents?documentId=${encodeURIComponent(event.eventId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serverToken}`,
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    if (res.status === 409) {
      // Idempotent write if event already exists
      return;
    }
    const errJson = await res.json().catch(() => ({}));
    const msg = errJson?.error?.message || `Firestore save failed with status ${res.status}`;
    const err: any = new Error(`Authoritative Persistence Failure: ${msg}`);
    err.statusCode = res.status >= 400 && res.status < 500 ? res.status : 500;
    throw err;
  }
}

/**
 * Fetches the authoritative sealed proposal record from Firestore.
 * In live mode, lookup failure throws an authoritative error and NEVER falls back to mock data.
 * Mock data is strictly permitted only under explicit server demo mode.
 */
export async function getAuthoritativeProposal(proposalId: string, token?: string): Promise<Proposal> {
  if (!proposalId) {
    const err: any = new Error('Invalid parameter: proposalId is required.');
    err.statusCode = 400;
    throw err;
  }

  const inDemoMode = isServerDemoModeEnabled();
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

  // In live mode (!inDemoMode), Firestore is strictly authoritative and mock data is completely forbidden.
  if (!inDemoMode) {
    if (!projectId || projectId.trim().length === 0) {
      const err: any = new Error(
        'Server Configuration Error: Firebase Project ID is not configured. Authoritative records cannot be loaded.'
      );
      err.statusCode = 500;
      throw err;
    }

    const effectiveToken = token || (await getServerFirestoreAccessToken());
    const headers: Record<string, string> = {};
    if (effectiveToken) {
      headers['Authorization'] = `Bearer ${effectiveToken.trim()}`;
    }

    let res: Response;
    try {
      res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId.trim()}/databases/(default)/documents/proposals/${proposalId.trim()}`,
        { headers }
      );
    } catch (networkErr: any) {
      const err: any = new Error(
        `Authoritative Backend Failure: Unable to connect to Firestore to retrieve proposal '${proposalId}': ${networkErr.message}`
      );
      err.statusCode = 500;
      throw err;
    }

    if (!res.ok) {
      if (res.status === 404) {
        const err: any = new Error(
          `Authoritative Record Not Found: Proposal '${proposalId}' does not exist in authoritative Firestore.`
        );
        err.statusCode = 404;
        throw err;
      }
      const err: any = new Error(
        `Authoritative Backend Failure: Failed to retrieve proposal '${proposalId}' from Firestore (status ${res.status}).`
      );
      err.statusCode = res.status >= 400 && res.status < 500 ? res.status : 500;
      throw err;
    }

    const docJson = await res.json();
    const parsed = parseFirestoreDoc<Proposal>(docJson);
    if (!parsed) {
      const err: any = new Error(
        `Authoritative Data Integrity Violation: Proposal '${proposalId}' record is corrupt or unreadable.`
      );
      err.statusCode = 500;
      throw err;
    }

    return {
      ...parsed,
      id: parsed.id || proposalId,
    };
  }

  // Explicit server-side demo mode:
  // If a real Firebase token is provided, try Firestore first
  if (projectId && projectId.trim().length > 0 && token && !token.startsWith('bti-token-') && !token.startsWith('demo-token-')) {
    try {
      const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId.trim()}/databases/(default)/documents/proposals/${proposalId.trim()}`,
        { headers: { Authorization: `Bearer ${token.trim()}` } }
      );
      if (res.ok) {
        const docJson = await res.json();
        const parsed = parseFirestoreDoc<Proposal>(docJson);
        if (parsed) {
          return { ...parsed, id: parsed.id || proposalId };
        }
      }
    } catch {
      // Allow demo fallthrough
    }
  }

  // Demo seed lookup
  const mockMatch = mockProposals.find((p) => p.id === proposalId);
  if (mockMatch) {
    return { ...mockMatch };
  }

  const err: any = new Error(
    `Authoritative Record Not Found: Proposal '${proposalId}' does not exist in the database.`
  );
  err.statusCode = 404;
  throw err;
}

/**
 * Fetches the authoritative tender notice record from Firestore.
 * In live mode, lookup failure throws an authoritative error and NEVER falls back to mock data.
 * Mock data is strictly permitted only under explicit server demo mode.
 */
export async function getAuthoritativeTender(tenderId: string, token?: string): Promise<Tender> {
  if (!tenderId) {
    const err: any = new Error('Invalid parameter: tenderId is required.');
    err.statusCode = 400;
    throw err;
  }

  const inDemoMode = isServerDemoModeEnabled();
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

  // In live mode (!inDemoMode), Firestore is strictly authoritative and mock data is completely forbidden.
  if (!inDemoMode) {
    if (!projectId || projectId.trim().length === 0) {
      const err: any = new Error(
        'Server Configuration Error: Firebase Project ID is not configured. Authoritative records cannot be loaded.'
      );
      err.statusCode = 500;
      throw err;
    }

    const effectiveToken = token || (await getServerFirestoreAccessToken());
    const headers: Record<string, string> = {};
    if (effectiveToken) {
      headers['Authorization'] = `Bearer ${effectiveToken.trim()}`;
    }

    let res: Response;
    try {
      res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId.trim()}/databases/(default)/documents/tenders/${tenderId.trim()}`,
        { headers }
      );
    } catch (networkErr: any) {
      const err: any = new Error(
        `Authoritative Backend Failure: Unable to connect to Firestore to retrieve tender '${tenderId}': ${networkErr.message}`
      );
      err.statusCode = 500;
      throw err;
    }

    if (!res.ok) {
      if (res.status === 404) {
        const err: any = new Error(
          `Authoritative Record Not Found: Tender '${tenderId}' does not exist in authoritative Firestore.`
        );
        err.statusCode = 404;
        throw err;
      }
      const err: any = new Error(
        `Authoritative Backend Failure: Failed to retrieve tender '${tenderId}' from Firestore (status ${res.status}).`
      );
      err.statusCode = res.status >= 400 && res.status < 500 ? res.status : 500;
      throw err;
    }

    const docJson = await res.json();
    const parsed = parseFirestoreDoc<Tender>(docJson);
    if (!parsed) {
      const err: any = new Error(
        `Authoritative Data Integrity Violation: Tender '${tenderId}' record is corrupt or unreadable.`
      );
      err.statusCode = 500;
      throw err;
    }

    return {
      ...parsed,
      id: parsed.id || tenderId,
    };
  }

  // Explicit server-side demo mode:
  // If a real Firebase token is provided, try Firestore first
  if (projectId && projectId.trim().length > 0 && token && !token.startsWith('bti-token-') && !token.startsWith('demo-token-')) {
    try {
      const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId.trim()}/databases/(default)/documents/tenders/${tenderId.trim()}`,
        { headers: { Authorization: `Bearer ${token.trim()}` } }
      );
      if (res.ok) {
        const docJson = await res.json();
        const parsed = parseFirestoreDoc<Tender>(docJson);
        if (parsed) {
          return { ...parsed, id: parsed.id || tenderId };
        }
      }
    } catch {
      // Allow demo fallthrough
    }
  }

  // Demo seed lookup
  const seedMatch = SEED_TENDERS.find((t) => t.id === tenderId);
  if (seedMatch) {
    return { ...seedMatch };
  }

  const mockMatch = mockTenders.find((t) => t.id === tenderId);
  if (mockMatch) {
    return { ...mockMatch };
  }

  const err: any = new Error(`Authoritative Record Not Found: Tender '${tenderId}' does not exist in the database.`);
  err.statusCode = 404;
  throw err;
}

/**
 * Fetches the authoritative organization record from Firestore.
 * In live mode, lookup failure throws an authoritative error and NEVER falls back to seed/synthetic data.
 * Seed data is strictly permitted only under explicit server demo mode.
 */
export async function getAuthoritativeOrganization(
  organizationId: string,
  fallbackProposal?: Proposal,
  token?: string
): Promise<Organization> {
  if (!organizationId) {
    const err: any = new Error('Invalid parameter: organizationId is required.');
    err.statusCode = 400;
    throw err;
  }

  const inDemoMode = isServerDemoModeEnabled();
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

  // In live mode (!inDemoMode), Firestore is strictly authoritative and mock/seed data is completely forbidden.
  if (!inDemoMode) {
    if (!projectId || projectId.trim().length === 0) {
      const err: any = new Error(
        'Server Configuration Error: Firebase Project ID is not configured. Authoritative records cannot be loaded.'
      );
      err.statusCode = 500;
      throw err;
    }

    const effectiveToken = token || (await getServerFirestoreAccessToken());
    const headers: Record<string, string> = {};
    if (effectiveToken) {
      headers['Authorization'] = `Bearer ${effectiveToken.trim()}`;
    }

    let res: Response;
    try {
      res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId.trim()}/databases/(default)/documents/organizations/${organizationId.trim()}`,
        { headers }
      );
    } catch (networkErr: any) {
      const err: any = new Error(
        `Authoritative Backend Failure: Unable to connect to Firestore to retrieve organization '${organizationId}': ${networkErr.message}`
      );
      err.statusCode = 500;
      throw err;
    }

    if (!res.ok) {
      if (res.status === 404) {
        const err: any = new Error(
          `Authoritative Record Not Found: Organization '${organizationId}' does not exist in authoritative Firestore.`
        );
        err.statusCode = 404;
        throw err;
      }
      const err: any = new Error(
        `Authoritative Backend Failure: Failed to retrieve organization '${organizationId}' from Firestore (status ${res.status}).`
      );
      err.statusCode = res.status >= 400 && res.status < 500 ? res.status : 500;
      throw err;
    }

    const docJson = await res.json();
    const parsed = parseFirestoreDoc<Organization>(docJson);
    if (!parsed) {
      const err: any = new Error(
        `Authoritative Data Integrity Violation: Organization '${organizationId}' record is corrupt or unreadable.`
      );
      err.statusCode = 500;
      throw err;
    }

    return {
      ...parsed,
      organizationId: parsed.organizationId || organizationId,
    };
  }

  // Explicit server-side demo mode:
  // If a real Firebase token is provided, try Firestore first
  if (projectId && projectId.trim().length > 0 && token && !token.startsWith('bti-token-') && !token.startsWith('demo-token-')) {
    try {
      const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId.trim()}/databases/(default)/documents/organizations/${organizationId.trim()}`,
        { headers: { Authorization: `Bearer ${token.trim()}` } }
      );
      if (res.ok) {
        const docJson = await res.json();
        const parsed = parseFirestoreDoc<Organization>(docJson);
        if (parsed) {
          return { ...parsed, organizationId: parsed.organizationId || organizationId };
        }
      }
    } catch {
      // Allow demo fallthrough
    }
  }

  // Demo seed lookup
  if (SEED_DEMO_ORGANIZATIONS[organizationId]) {
    return { ...SEED_DEMO_ORGANIZATIONS[organizationId] };
  }
  const match = Object.values(SEED_DEMO_ORGANIZATIONS).find(
    (o) => o.organizationId === organizationId || (o as any).id === organizationId
  );
  if (match) {
    return { ...match };
  }

  const err: any = new Error(
    `Authoritative Record Not Found: Organization '${organizationId}' does not exist in authoritative Firestore. AI evaluation cannot proceed without verified organization data.`
  );
  err.statusCode = 404;
  throw err;
}
