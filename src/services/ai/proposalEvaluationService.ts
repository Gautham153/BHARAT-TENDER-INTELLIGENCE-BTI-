// Bharat Tender Intelligence (BTI) — Client-Side AI Proposal Intelligence Service
// Phase 5: Interacts with server-side evaluation boundary and manages immutable Firestore evaluation records

import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db, auth } from '../firebase/firebase';
import { EvaluationResult } from '../../types/evaluation';
import { Proposal } from '../../types/proposal';
import { isLiveFirestoreSession } from '../firebase/proposals';
import { Tender, TenderMatchResult } from '../../types/tender';
import { Organization } from '../../types/organization';
import { AuthUser } from '../../types/auth';
import { AuthService } from '../authService';

const PROPOSAL_EVALUATIONS_COLLECTION = 'proposalEvaluations';
const LOCAL_STORAGE_EVALUATIONS_KEY = 'bti_proposal_evaluations_cache_v1';

function getLocalEvaluations(): EvaluationResult[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_EVALUATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalEvaluations(evals: EvaluationResult[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_EVALUATIONS_KEY, JSON.stringify(evals));
  } catch (err) {
    console.warn('[ProposalEvaluationService] Failed to cache evaluations locally:', err);
  }
}

export class ProposalEvaluationService {
  /**
   * Triggers an explainable AI evaluation for a proposal by calling the server-side boundary.
   * Authoritative AI audit trail events (REQUESTED, FAILED, COMPLETED) and evaluation records
   * are recorded and persisted strictly by the server-side /api/ai handler.
   */
  static async evaluateProposal(params: {
    proposal: Proposal;
    tender: Tender;
    organization: Organization;
    deterministicMatch?: TenderMatchResult;
    user: AuthUser;
    evaluationVersion?: string;
  }): Promise<EvaluationResult> {
    const { proposal, tender, organization, deterministicMatch, user, evaluationVersion = '1.0' } = params;

    if (user.role !== 'government' && user.role !== 'government_admin' && user.role !== 'government_officer') {
      throw new Error('Unauthorized: AI Proposal Intelligence evaluation is strictly restricted to government reviewers.');
    }

    // Call Server-Side Evaluation Boundary with Authoritative Firebase ID Token
    // Note: AI_EVALUATION_REQUESTED, AI_EVALUATION_FAILED, and AI_EVALUATION_COMPLETED audit events
    // are recorded authoritatively by the trusted server flow (/api/ai) using administrative credentials.
    let evaluationResult: EvaluationResult;

    // Acquire caller's Firebase ID token or active session token
    let idToken = '';
    if (auth && auth.currentUser) {
      try {
        idToken = await auth.currentUser.getIdToken();
      } catch {
        // Token acquisition fallback
      }
    }
    if (!idToken) {
      // Fallback for demo or evaluator session
      const storedUser = AuthService.getCurrentUser();
      idToken = storedUser?.uid
        ? `bti-token-${storedUser.uid}`
        : user.uid || user.id
        ? `bti-token-${user.uid || user.id}`
        : 'bti-token-usr-gov-001';
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const response = await fetch('/api/ai', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        proposalId: proposal.id,
        tenderId: tender.id,
        organizationId: organization.organizationId || proposal.organizationId || proposal.agencyId,
        deterministicMatch,
        evaluationVersion,
      }),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok || !responseData.success || !responseData.evaluation) {
      const errorMsg = responseData.error || `Evaluation request failed with status ${response.status}.`;
      throw new Error(errorMsg);
    }

    evaluationResult = responseData.evaluation;

    // In live Firebase mode, authoritative Firestore persistence is performed strictly by the trusted
    // server-side API handler (/api/ai) using administrative credentials before returning the response.
    if (!isLiveFirestoreSession()) {
      // Explicit demo / offline mode only: persist to local cache
      const localEvals = getLocalEvaluations();
      localEvals.unshift(evaluationResult); // newest first
      saveLocalEvaluations(localEvals);
    }

    return evaluationResult;
  }

  /**
   * Retrieves all evaluations for a given proposal, sorted newest first.
   * Preserves version history (1.0, 2.0, etc.).
   */
  static async getEvaluationsForProposal(proposalId: string): Promise<EvaluationResult[]> {
    if (!proposalId) return [];

    if (isLiveFirestoreSession() && db) {
      try {
        // Authoritative query in live session
        const q = query(
          collection(db, PROPOSAL_EVALUATIONS_COLLECTION),
          where('proposalId', '==', proposalId)
        );
        const snapshot = await getDocs(q);
        const results = snapshot.docs.map((d) => d.data() as EvaluationResult);
        results.sort((a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime());
        return results;
      } catch (err) {
        console.warn('[ProposalEvaluationService] Firestore query error in live session:', err);
        throw err;
      }
    }

    // Explicit demo / offline mode only
    const local = getLocalEvaluations().filter((e) => e.proposalId === proposalId);
    local.sort((a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime());
    return local;
  }

  /**
   * Retrieves the latest evaluation for a given proposal, or null if not yet evaluated.
   */
  static async getLatestEvaluationForProposal(proposalId: string): Promise<EvaluationResult | null> {
    const all = await this.getEvaluationsForProposal(proposalId);
    return all.length > 0 ? all[0] : null;
  }
}
