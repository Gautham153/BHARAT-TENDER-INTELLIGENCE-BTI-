// Bharat Tender Intelligence (BTI) — Verification Audit Events Repository
// Phase 2A: Traceable Audit Trail for Statutory Organization Verification

import {
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { VerificationEvent, VerificationAuditAction } from '../../types/organization';

const EVENTS_REGISTRY_KEY = 'bti_verification_events_v1';

// Seed events for synthetic demo organizations
const SEED_EVENTS: VerificationEvent[] = [
  {
    eventId: 'evt-vikram-01',
    organizationId: 'ORG-VIKRAM-09A',
    action: 'SUBMITTED',
    actorId: 'usr-ag-001',
    actorName: 'Vikramaditya Infrastructure Ltd',
    actorRole: 'agency',
    previousStatus: 'not_started',
    newStatus: 'pending',
    timestamp: '2025-02-01T10:00:00Z',
    source: 'onboarding-wizard',
    reference: 'DEV-VERIF-09-8812',
    notes: 'Registration submitted with GSTIN 09AABCV9821L1ZS.',
  },
  {
    eventId: 'evt-vikram-02',
    organizationId: 'ORG-VIKRAM-09A',
    action: 'VERIFICATION_COMPLETED',
    actorId: 'system-verifier',
    actorName: 'Development Verification Service',
    actorRole: 'system',
    previousStatus: 'pending',
    newStatus: 'verified',
    timestamp: '2025-02-01T10:05:00Z',
    source: 'development-provider',
    reference: 'DEV-VERIF-09-8812',
    notes: 'GSTIN verified with active taxpayer status in development simulation.',
  },
  {
    eventId: 'evt-apex-01',
    organizationId: 'ORG-APEX-27A',
    action: 'SUBMITTED',
    actorId: 'usr-ag-002',
    actorName: 'Apex BuildTech Enterprises',
    actorRole: 'agency',
    previousStatus: 'not_started',
    newStatus: 'pending',
    timestamp: '2026-03-01T08:30:00Z',
    source: 'onboarding-wizard',
    reference: 'DEV-VERIF-27-4102',
    notes: 'Agency registration submitted with GSTIN 27AABCA1234F1Z9. Queued for District Nodal Officer review.',
  },
  {
    eventId: 'evt-patli-01',
    organizationId: 'ORG-PATLIPUTRA-10A',
    action: 'SUBMITTED',
    actorId: 'usr-ag-003',
    actorName: 'Patliputra Civil Constellation LLP',
    actorRole: 'agency',
    previousStatus: 'not_started',
    newStatus: 'pending',
    timestamp: '2026-03-02T09:15:00Z',
    source: 'onboarding-wizard',
    reference: 'DEV-VERIF-10-9904',
    notes: 'Registration submitted with GSTIN 10AABCR9999P1ZI.',
  },
  {
    eventId: 'evt-patli-02',
    organizationId: 'ORG-PATLIPUTRA-10A',
    action: 'MARKED_FOR_REVIEW',
    actorId: 'system-verifier',
    actorName: 'Development Verification Service',
    actorRole: 'system',
    previousStatus: 'pending',
    newStatus: 'requires_review',
    timestamp: '2026-03-02T09:16:00Z',
    source: 'development-provider',
    reference: 'DEV-VERIF-10-9904',
    notes: 'Simulated check flagged multiple active registrations under same PAN.',
  },
  {
    eventId: 'evt-bengal-01',
    organizationId: 'ORG-BENGAL-19A',
    action: 'SUBMITTED',
    actorId: 'usr-ag-004',
    actorName: 'Bengal Heavy Construction Syndicate',
    actorRole: 'agency',
    previousStatus: 'not_started',
    newStatus: 'pending',
    timestamp: '2026-03-02T11:00:00Z',
    source: 'onboarding-wizard',
    reference: 'DEV-VERIF-19-0011',
    notes: 'Registration submitted with GSTIN 19AABCF0000X1ZE.',
  },
  {
    eventId: 'evt-bengal-02',
    organizationId: 'ORG-BENGAL-19A',
    action: 'REJECTED',
    actorId: 'system-verifier',
    actorName: 'Development Verification Service',
    actorRole: 'system',
    previousStatus: 'pending',
    newStatus: 'failed',
    timestamp: '2026-03-02T11:01:00Z',
    source: 'development-provider',
    reference: 'DEV-VERIF-19-0011',
    notes: 'Verification failed: GSTIN reported inactive/cancelled in registrar records.',
  },
];

function getLocalEvents(): VerificationEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_REGISTRY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as VerificationEvent[];
      // Combine with seeds avoiding duplicates
      const ids = new Set(parsed.map((e) => e.eventId));
      const merged = [...parsed];
      SEED_EVENTS.forEach((e) => {
        if (!ids.has(e.eventId)) merged.push(e);
      });
      return merged;
    }
  } catch {
    // ignore
  }
  return [...SEED_EVENTS];
}

function saveLocalEvents(events: VerificationEvent[]) {
  try {
    localStorage.setItem(EVENTS_REGISTRY_KEY, JSON.stringify(events));
  } catch {
    // ignore
  }
}

/**
 * Record a verification audit event
 */
export async function recordVerificationEvent(
  params: Omit<VerificationEvent, 'eventId' | 'timestamp'> & { timestamp?: string }
): Promise<VerificationEvent> {
  const nowIso = params.timestamp || new Date().toISOString();
  const eventId = `EVT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const event: VerificationEvent = {
    ...params,
    eventId,
    timestamp: nowIso,
  };

  // 1. Persist to Firestore first if configured — must be authoritative in Firebase mode
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'verificationEvents', eventId);
      await setDoc(docRef, event);
    } catch (err) {
      throw new Error(
        `Failed to record verification audit event to authoritative Firestore: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  // 2. Save to local audit registry for immediate UI reactivity and local fallback
  const events = getLocalEvents();
  events.unshift(event);
  saveLocalEvents(events);

  return event;
}

/**
 * Fetch all verification audit events for a given organization (chronological)
 */
export async function fetchVerificationAuditTrail(organizationId: string): Promise<VerificationEvent[]> {
  if (isFirebaseConfigured && db) {
    try {
      const eventsRef = collection(db, 'verificationEvents');
      const q = query(eventsRef, where('organizationId', '==', organizationId));
      const snap = await getDocs(q);
      const firestoreEvents: VerificationEvent[] = [];
      snap.forEach((d) => {
        firestoreEvents.push(d.data() as VerificationEvent);
      });
      firestoreEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      return firestoreEvents;
    } catch (err) {
      throw new Error(
        `Failed to fetch verification audit trail from authoritative Firestore: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  // Explicit local/demo fallback
  const localEvents = getLocalEvents().filter((e) => e.organizationId === organizationId);
  localEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return localEvents;
}
