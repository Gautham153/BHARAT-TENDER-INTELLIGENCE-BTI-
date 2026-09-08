// Bharat Tender Intelligence (BTI) — Server-Side Authentication & RBAC Helper
// Cryptographically verifies Firebase ID tokens, resolves authoritative roles from Firestore users/{uid},
// prevents client-supplied role spoofing, and enforces government authorization with explicit demo mode guards.

import crypto from 'crypto';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  role: string;
  name?: string;
}

const SERVER_DEMO_USERS = {
  government: {
    uid: 'usr-gov-001',
    email: 'alok.verma@gov.in',
    role: 'government',
    name: 'Dr. Alok Verma, IAS',
  },
  agency: {
    uid: 'usr-ag-001',
    email: 'contact@apexinfra.co.in',
    role: 'agency',
    name: 'Vikramaditya Sharma',
  },
};

/**
 * Checks whether server demo mode is explicitly enabled via server environment variable.
 * Demo tokens and mock fallback data are strictly rejected unless this returns true.
 * Demo mode is always disabled in production.
 */
export function isServerDemoModeEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return (
    process.env.BTI_ENABLE_DEMO_MODE === 'true' ||
    process.env.ENABLE_DEMO_MODE === 'true' ||
    process.env.VITE_ENABLE_DEMO_MODE === 'true'
  );
}

interface CachedGoogleCerts {
  certs: Record<string, string>;
  expiresAt: number;
}

let cachedGoogleCerts: CachedGoogleCerts | null = null;

/**
 * Retrieves Google public x509 verification certificates used to verify Firebase ID tokens.
 */
async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedGoogleCerts && cachedGoogleCerts.expiresAt > now) {
    return cachedGoogleCerts.certs;
  }

  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!res.ok) {
    const err: any = new Error(
      `Unauthorized: Failed to retrieve Google public verification certificates (status ${res.status}).`
    );
    err.statusCode = 401;
    throw err;
  }

  const cacheControl = res.headers.get('cache-control') || '';
  const match = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = match ? parseInt(match[1], 10) : 3600;

  const certs = (await res.json()) as Record<string, string>;
  cachedGoogleCerts = {
    certs,
    expiresAt: now + maxAgeSeconds * 1000,
  };
  return certs;
}

/**
 * Performs cryptographic verification of a Firebase ID token.
 * Validates header format, RS256 signature using Google public certificates,
 * token claims (exp, iat, aud, iss, sub), and verifies against Identity Toolkit when configured.
 */
async function verifyFirebaseIdToken(token: string): Promise<{ uid: string; email?: string; name?: string }> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    const err: any = new Error('Unauthorized: Malformed JWT token structure.');
    err.statusCode = 401;
    throw err;
  }

  // 1. Decode header and payload
  let header: Record<string, any>;
  let payload: Record<string, any>;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    const err: any = new Error('Unauthorized: Invalid JWT token encoding.');
    err.statusCode = 401;
    throw err;
  }

  // 2. Validate header algorithm & key ID
  if (header.alg !== 'RS256') {
    const err: any = new Error(`Unauthorized: Unsupported JWT algorithm '${header.alg}'. Expected 'RS256'.`);
    err.statusCode = 401;
    throw err;
  }

  if (!header.kid || typeof header.kid !== 'string') {
    const err: any = new Error('Unauthorized: Missing key ID (kid) in token header.');
    err.statusCode = 401;
    throw err;
  }

  // 3. Cryptographic Signature Verification
  const certs = await getGooglePublicCerts();
  const certPem = certs[header.kid];
  if (!certPem) {
    const err: any = new Error(`Unauthorized: Unknown or invalid token key ID (kid: ${header.kid}).`);
    err.statusCode = 401;
    throw err;
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  const signatureBytes = Buffer.from(parts[2], 'base64url');
  const isValidSignature = verifier.verify(certPem, signatureBytes);

  if (!isValidSignature) {
    const err: any = new Error('Unauthorized: Invalid cryptographic signature on Firebase ID token.');
    err.statusCode = 401;
    throw err;
  }

  // 4. Claims validation
  const nowSec = Math.floor(Date.now() / 1000);

  if (!payload.exp || typeof payload.exp !== 'number' || payload.exp < nowSec) {
    const err: any = new Error('Unauthorized: Firebase ID token has expired.');
    err.statusCode = 401;
    throw err;
  }

  if (!payload.iat || typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    const err: any = new Error('Unauthorized: Firebase ID token issued in the future.');
    err.statusCode = 401;
    throw err;
  }

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (projectId && projectId.trim().length > 0) {
    const expectedProjectId = projectId.trim();
    if (payload.aud !== expectedProjectId) {
      const err: any = new Error(`Unauthorized: Token audience does not match project '${expectedProjectId}'.`);
      err.statusCode = 401;
      throw err;
    }
    if (payload.iss !== `https://securetoken.google.com/${expectedProjectId}`) {
      const err: any = new Error(`Unauthorized: Token issuer does not match project '${expectedProjectId}'.`);
      err.statusCode = 401;
      throw err;
    }
  }

  const uid = payload.user_id || payload.sub;
  if (!uid || typeof uid !== 'string') {
    const err: any = new Error('Unauthorized: Missing or invalid subject/user ID in token payload.');
    err.statusCode = 401;
    throw err;
  }

  // 5. If Identity Toolkit API key is configured, verify account status
  const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey.trim()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );
    if (!verifyRes.ok) {
      const verifyErr = await verifyRes.json().catch(() => ({}));
      const errMsg = verifyErr?.error?.message || 'Token verification failed';
      const err: any = new Error(`Unauthorized: Invalid Firebase ID token (${errMsg}).`);
      err.statusCode = 401;
      throw err;
    }
  }

  return {
    uid,
    email: payload.email,
    name: payload.name || payload.display_name,
  };
}

/**
 * Resolves authoritative user role strictly from the authoritative Firestore users/{uid} document.
 * Never guesses roles, never trusts client-supplied role claims, and never relies on email domain.
 */
async function resolveAuthoritativeRole(uid: string, token: string): Promise<string> {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (!projectId || projectId.trim().length === 0) {
    // If Firebase project ID is not configured and demo mode is active
    if (isServerDemoModeEnabled()) {
      return 'government';
    }
    const err: any = new Error(
      'Server Configuration Error: Firebase Project ID is not configured. Authoritative user role cannot be verified.'
    );
    err.statusCode = 500;
    throw err;
  }

  let firestoreRole: string | undefined = undefined;
  try {
    const userDocRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId.trim()}/databases/(default)/documents/users/${uid}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!userDocRes.ok) {
      if (userDocRes.status === 404) {
        const err: any = new Error(
          `Access Denied: User record for '${uid}' was not found in authoritative users repository.`
        );
        err.statusCode = 403;
        throw err;
      }
      const err: any = new Error(
        `Access Denied: Failed to retrieve authoritative user record from Firestore (status ${userDocRes.status}).`
      );
      err.statusCode = 403;
      throw err;
    }

    const userDocJson = await userDocRes.json();
    firestoreRole = userDocJson?.fields?.role?.stringValue;
  } catch (fetchErr: any) {
    if (fetchErr.statusCode) throw fetchErr;
    const err: any = new Error(
      `Access Denied: Unable to verify authoritative role due to backend communication error: ${fetchErr.message}`
    );
    err.statusCode = 403;
    throw err;
  }

  if (!firestoreRole || firestoreRole.trim().length === 0) {
    const err: any = new Error(`Access Denied: User '${uid}' has no authoritative role assigned in database.`);
    err.statusCode = 403;
    throw err;
  }

  return firestoreRole.trim();
}

/**
 * Verifies Authorization header bearer token and resolves the caller's authoritative identity and role.
 * Strictly rejects missing tokens, malformed headers, expired tokens, and invalid signatures.
 */
export async function verifyServerAuth(authHeader?: string): Promise<AuthenticatedUser> {
  // 1. Validate presence of Authorization header
  if (!authHeader || typeof authHeader !== 'string' || authHeader.trim().length === 0) {
    const err: any = new Error(
      'Unauthorized: Missing Authorization header. Provide Firebase ID token using format: Authorization: Bearer <token>'
    );
    err.statusCode = 401;
    throw err;
  }

  // 2. Validate Bearer format
  if (!authHeader.startsWith('Bearer ') && !authHeader.startsWith('bearer ')) {
    const err: any = new Error("Unauthorized: Malformed Authorization header. Expected format: 'Bearer <token>'.");
    err.statusCode = 401;
    throw err;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    const err: any = new Error('Unauthorized: Empty Bearer token provided.');
    err.statusCode = 401;
    throw err;
  }

  // 3. Demo / Evaluator Session Tokens Handling
  const isGovDemo =
    token === 'bti-token-usr-gov-001' ||
    token.includes('usr-gov-001') ||
    token.includes('demo-token-government') ||
    token === 'bti-demo-token-government';

  const isAgencyDemo =
    token === 'bti-token-usr-ag-001' ||
    token === 'bti-token-usr-ag-002' ||
    token.includes('usr-ag-001') ||
    token.includes('usr-ag-002') ||
    token.includes('demo-token-agency');

  if (isGovDemo || isAgencyDemo) {
    if (!isServerDemoModeEnabled()) {
      const err: any = new Error(
        'Unauthorized: Demo authentication tokens are disabled. A cryptographically verified Firebase ID token is required.'
      );
      err.statusCode = 401;
      throw err;
    }

    if (isGovDemo) {
      const gov = SERVER_DEMO_USERS.government;
      return {
        uid: gov.uid,
        email: gov.email,
        role: gov.role,
        name: gov.name,
      };
    }

    const ag = SERVER_DEMO_USERS.agency;
    return {
      uid: ag.uid,
      email: ag.email,
      role: ag.role,
      name: ag.name,
    };
  }

  // 4. Real Firebase ID Token Cryptographic Verification
  const verifiedUser = await verifyFirebaseIdToken(token);

  // 5. Authoritative Role Resolution from Firestore users/{uid}
  const authoritativeRole = await resolveAuthoritativeRole(verifiedUser.uid, token);

  return {
    uid: verifiedUser.uid,
    email: verifiedUser.email,
    role: authoritativeRole,
    name: verifiedUser.name,
  };
}
