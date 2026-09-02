// Bharat Tender Intelligence (BTI) — Organization & Verification Types
// Phase 2A: Organization Model, GSTIN Verification Architecture & Audit Trail

export type VerificationStatus =
  | 'not_started'
  | 'pending'
  | 'verified'
  | 'failed'
  | 'requires_review';

export type BTIAuthorizationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'under_review';

export interface Organization {
  organizationId: string;
  legalName: string;
  displayName: string;
  gstin: string; // 15-character uppercase normalized GSTIN
  gstStateCode: string;
  businessCategory: string;
  registeredAddress: string;
  state: string;
  verificationStatus: VerificationStatus; // Authoritative combined operational status
  providerVerificationStatus?: VerificationStatus; // Outcome from statutory registrar / simulation check
  btiAuthorizationStatus?: BTIAuthorizationStatus; // District Nodal Officer clearance status
  verificationProvider: string; // e.g. 'development-simulation'
  verificationReference: string;
  verificationRequestedAt: string;
  verificationCompletedAt?: string;
  rejectionReason?: string;
  reviewNotes?: string;
  contactEmail?: string;
  contactPhone?: string;
  primaryUserId: string; // Auth UID of the registering representative
  verified: boolean;
  applicationId: string;
  createdAt: string;
  updatedAt: string;
}

export type VerificationAuditAction =
  | 'SUBMITTED'
  | 'VERIFICATION_STARTED'
  | 'VERIFICATION_COMPLETED'
  | 'MARKED_FOR_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'RETRY_REQUESTED';

export interface VerificationEvent {
  eventId: string;
  organizationId: string;
  action: VerificationAuditAction;
  actorId: string;
  actorName: string;
  actorRole: 'agency' | 'government' | 'system';
  previousStatus?: VerificationStatus;
  newStatus: VerificationStatus;
  timestamp: string;
  source: string; // e.g. 'onboarding-wizard', 'gov-nodal-desk', 'development-provider'
  reference?: string;
  notes?: string;
}

export interface GSTINValidationResult {
  isValid: boolean;
  cleanGstin: string;
  stateCode?: string;
  stateName?: string;
  pan?: string;
  calculatedCheckDigit?: string;
  error?: string;
}

export interface VerificationResult {
  gstin: string;
  status: VerificationStatus;
  legalName?: string;
  businessName?: string;
  stateCode?: string;
  stateName?: string;
  taxpayerType?: string;
  activeStatus?: boolean;
  provider: string;
  reference: string;
  isSimulation: boolean;
  message: string;
  timestamp: string;
  applicationId?: string;
  verifiedAt?: string;
}

export interface VerificationProvider {
  id: string;
  name: string;
  isSimulation: boolean;
  verifyGSTIN(
    gstin: string,
    context?: {
      legalName?: string;
      businessCategory?: string;
      state?: string;
    }
  ): Promise<VerificationResult>;
}

